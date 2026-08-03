/* ==========================================================================
   e-Kassam — oflayn sotuv navbati
   01-ARCHITECTURE.md → "Oflayn arxitektura (kassir uchun kritik)"

   Oqim:
     1. Sotuv IndexedDB'dagi `sales_queue` ga yoziladi (status: pending)
     2. Chek darhol chop etiladi, UI muvaffaqiyat ko'rsatadi
     3. Fon jarayoni navbatni serverga yuboradi
     4. Server tasdiqlasa → o'chiriladi
     5. Xato bo'lsa → exponential backoff, maksimum 10 urinish

   Har bir sotuvda klient tomonida yaratilgan `idempotencyKey` (UUID) bo'ladi.
   Server bir xil kalitli so'rovni ikki marta qayd etmaydi — takroriy sotuv
   shu bilan oldi olinadi. Backend: SaleController + `sale_idempotency` jadvali.

   ⚠ Chetlanish: hujjat Dexie ni tavsiya qiladi. Bu yerda toza IndexedDB
   ishlatilgan — bir xil funksiya, qo'shimcha bog'liqliksiz (~0 KB).
   ========================================================================== */

const DB_NAME = "ekassam";
const DB_VERSION = 1;
const STORE = "sales_queue";

const MAX_ATTEMPTS = 10;
/** Exponential backoff, ms. 10-urinishdan keyin sotuv "failed" bo'ladi. */
const backoff = (attempt) => Math.min(60_000, 1000 * 2 ** attempt);

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("status", "status");
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        try {
          result = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(result?.result ?? result);
        t.onerror = () => reject(t.error);
      })
  );
}

/** RFC 4122 v4. crypto.randomUUID yo'q bo'lsa (eski Android WebView) — zaxira. */
export function newIdempotencyKey() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

/* ── Navbat bilan ishlash ────────────────────────────────────────────────── */

export async function enqueue(payload, meta = {}) {
  const item = {
    key: payload.idempotencyKey || newIdempotencyKey(),
    payload,
    meta,                    // chek chiqarish uchun: savat, jami, to'lov turi
    status: "pending",       // pending | failed
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    createdAt: Date.now(),
  };
  item.payload.idempotencyKey = item.key;
  await tx("readwrite", (s) => s.put(item));
  notify();
  return item;
}

export function all() {
  return tx("readonly", (s) => s.getAll());
}

export async function count() {
  const items = await all();
  return items.length;
}

async function remove(key) {
  await tx("readwrite", (s) => s.delete(key));
}

async function update(item) {
  await tx("readwrite", (s) => s.put(item));
}

/** Muvaffaqiyatsiz bo'lgan sotuvni qo'lda qayta urinishga qo'yish. */
export async function retry(key) {
  const items = await all();
  const item = items.find((i) => i.key === key);
  if (!item) return;
  item.status = "pending";
  item.attempts = 0;
  item.nextAttemptAt = 0;
  await update(item);
  notify();
  flush();
}

/* ── Kuzatuvchilar ───────────────────────────────────────────────────────── */

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  notify();
  return () => listeners.delete(fn);
}

async function notify() {
  const items = await all();
  const state = {
    online: navigator.onLine,
    pending: items.filter((i) => i.status === "pending").length,
    failed: items.filter((i) => i.status === "failed").length,
    items,
  };
  listeners.forEach((fn) => fn(state));
}

/* ── Yuborish tsikli ─────────────────────────────────────────────────────── */

let sender = null;   // enqueue paytida o'rnatiladi: (payload) => Promise
let flushing = false;
let timer = null;

/** KassaPage ilova ko'tarilishida haqiqiy API chaqiruvini beradi. */
export function setSender(fn) {
  sender = fn;
}

export async function flush() {
  if (flushing || !sender || !navigator.onLine) return;
  flushing = true;
  try {
    const items = (await all())
      .filter((i) => i.status === "pending" && i.nextAttemptAt <= Date.now())
      .sort((a, b) => a.createdAt - b.createdAt);   // FIFO — chek raqami tartibi

    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        await sender(item.payload);
        await remove(item.key);
      } catch (err) {
        item.attempts += 1;
        item.lastError = err?.message || "Noma'lum xato";
        if (item.attempts >= MAX_ATTEMPTS) {
          item.status = "failed";
        } else {
          item.nextAttemptAt = Date.now() + backoff(item.attempts);
        }
        await update(item);
        // Tarmoq yiqilgan bo'lsa qolganini urinib ovora bo'lmaymiz
        if (!navigator.onLine) break;
      }
    }
  } finally {
    flushing = false;
    notify();
  }
}

/** Ilova ko'tarilishida bir marta chaqiriladi. */
export function startSync({ intervalMs = 15_000 } = {}) {
  if (timer) return;
  window.addEventListener("online", () => { notify(); flush(); });
  window.addEventListener("offline", notify);
  timer = setInterval(flush, intervalMs);
  notify();
  flush();
}
