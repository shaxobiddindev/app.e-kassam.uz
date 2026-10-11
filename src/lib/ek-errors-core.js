/* Xato kuzatuvining sof qismi — bog'liqliksiz, Node sinovida ham ishlaydi
   (`test/errors.test.mjs`). Ulanish va sabablar — `ek-errors.js`. */

export const MAX_PER_SESSION = 20;
export const MAX_QUEUE = 10;
export const QUEUE_KEY = "ek_err_queue";

/** Yuborishga arzimaydigan xato. */
export function isNoise(err, message, stack) {
  /* Server javobi (`err.status`) — backend logida allaqachon bor;
     tarmoq uzilishi (`err.offline`) — nosozlik emas, kassa oflayn ishlaydi. */
  if (err && (err.status || err.offline)) return true;
  if (err && (err.name === "AbortError" || err.name === "BadgeRequiredError")) return true;
  const m = String(message || "");
  if (!m.trim()) return true;
  /* Boshqa domendagi skript — matni yashirilgan, foydasi yo'q. */
  if (m === "Script error." || m === "Script error") return true;
  /* Brauzer ogohlantirishi, ilovani buzmaydi. */
  if (/ResizeObserver loop/.test(m)) return true;
  /* `api/index.js` ning ataylab tashlaydigan oqim signallari. */
  if (m === "SESSION_TAKEN_OVER" || m === "AUTH_FAILED") return true;
  /* Brauzer kengaytmasi — bizning kodimiz emas. */
  if (/(chrome|moz|safari)-extension:\/\//.test(String(stack || ""))) return true;
  return false;
}

/** Eskirgan bo'lak (`ek-lazy.js`) — alohida tur: sababi relizda, kodda emas. */
export function classify(kind, message) {
  return /dynamically imported module|Importing a module script failed|Loading chunk/i.test(String(message || ""))
    ? "chunk" : kind;
}

/**
 * Sessiya darvozasi: bir xil xato — bir marta, jami `max` ta. Buzilgan
 * effekt sekundiga yuz marta yiqilishi mumkin — har birini yuborish
 * kassaning o'zini sekinlatardi.
 */
export function createGate(max = MAX_PER_SESSION) {
  const seen = new Set();
  let n = 0;
  return (key) => {
    if (seen.has(key) || n >= max) return false;
    seen.add(key);
    n++;
    return true;
  };
}

export function queuePush(storage, payload) {
  try {
    const q = JSON.parse(storage.getItem(QUEUE_KEY) || "[]");
    q.push(payload);
    storage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch (_) { /* to'la yoki yopiq xotira — yo'qotamiz, kassa muhimroq */ }
}

/** Navbatni olib, tozalaydi. Buzuq qiymat — bo'sh navbat. */
export function queueTake(storage) {
  try {
    const q = JSON.parse(storage.getItem(QUEUE_KEY) || "[]");
    storage.removeItem(QUEUE_KEY);
    return Array.isArray(q) ? q : [];
  } catch (_) {
    try { storage.removeItem(QUEUE_KEY); } catch (__) { /* yopiq */ }
    return [];
  }
}

/** So'rov qatori yuborilmaydi: unda token bo'lishi mumkin (`?token=` auth'dan). */
export const pathOnly = (p) => String(p || "").split(/[?#]/)[0];
