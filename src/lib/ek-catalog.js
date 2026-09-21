/* ══════════════════════════════════════════════════════════════════════════
   KASSA OFLAYN KATALOGI

   ═══ NEGA BU MODUL BOR ════════════════════════════════════════════════

   «Kassir ekrani internetsiz ishlaydi» — loyihaning o'zgarmas
   qoidalaridan biri (CLAUDE.md, №5). Amalda esa uning YARMI ishlardi:

     · tayyor savatni YUBORISH oflayn ishlardi — `ek-offline.js`,
       IndexedDB navbati, idempotentlik kaliti, cheksiz urinish;
     · savatni YIG'ISH esa yo'q edi. Barkod skanerlansa
       `/products/scan` ga so'rov ketardi va internetsiz kassir
       «topilmadi» ni ko'rardi. Sahifa yangilansa katalog umuman
       bo'sh qolardi: u faqat komponent xotirasida turardi.

   Ya'ni internet uzilganda kassir BOSHLAB BO'LGAN sotuvni tugata
   olardi, YANGISINI esa boshlay olmasdi. Bu — va'daning eng ko'p
   kerak bo'ladigan yarmi.

   ═══ ⚠ NEGA ALOHIDA BAZA ══════════════════════════════════════════════

   Sotuv navbati (`ekassam`/`sales_queue`) tizimdagi eng qimmat
   ma'lumot: unda hali serverga yetmagan, PULI OLINGAN sotuvlar
   turadi. Katalog esa istalgan payt tashlab, qaytadan yuklab
   olinadigan nusxa.

   Ikkalasini bitta bazaga qo'yish versiya oshirishni umumiy qilardi:
   katalog uchun qilingan `onupgradeneeded` xatosi sotuv navbatini
   ochib bo'lmaydigan qilib qo'yishi mumkin edi. Shuning uchun baza
   alohida — `ekassam-catalog`.

   ═══ ⚠ QOLDIQ KESHLANMAYDI ════════════════════════════════════════════

   `sw.js` dagi eski izoh to'g'ri edi: «kassir eskirgan narx yoki
   qoldiqni ko'rsa noto'g'ri sotadi». Lekin undan chiqarilgan xulosa
   — HECH NARSANI keshlamaslik — muammoni hal qilmasdi, faqat uni
   kassirning yelkasiga o'tkazardi.

   To'g'ri chegara boshqa joyda: kesh «BU BARKOD NIMA VA NARXI
   QANCHA» degan savolga javob beradi, «NECHTA QOLGAN» ga emas.

     · narx tovarning xossasi va u kuniga bir marta o'zgaradi —
       eskirgani kam uchraydi va sotuv serverga yetganda haqiqiy
       narx bilan qayta hisoblanadi;
     · qoldiq esa har sotuvda o'zgaradi va ikki soat oldingi
       «omborda 5 ta» bugun yolg'on.

   Shuning uchun serverdagi ixcham DTO qoldiqni UMUMAN yubormaydi
   (`OfflineCatalogDtos`), bu yerdagi tovar esa `stockQuantity: null`
   bilan keladi. `KassaPage.stockError` uchun bu «qoldiq tushunchasi
   yo'q» degani va u tekshirmaydi — xizmat tovaridagi bilan bir xil
   yo'l. Qoldiq yetmasa sotuv SERVERDA rad etiladi va navbat uni
   «failed» qilib kassirga ko'rsatadi (`ek-offline.js`).

   ═══ ⚠ NIMA QILA OLMAYDI ══════════════════════════════════════════════

   TAROZI BARKODI (`WEIGHT`) oflaynda tanilmaydi. Uni ochish uchun
   do'konning tarozi sozlamalari (prefiks, PLU xonalari) klientda
   bo'lishi kerak, hozir esa ular faqat serverda. Bu ataylab ochiq
   qoldirilgan: yarim ishlaydigan tarozi mantig'i noto'g'ri OG'IRLIK
   hisoblashi mumkin va u «topilmadi» dan ancha yomon.
   ══════════════════════════════════════════════════════════════════════════ */

const DB_NAME = "ekassam-catalog";
const DB_VERSION = 1;
const STORE = "products";
const META = "meta";
const META_KEY = "sync";

/* ══════════════════════════════════════════════════════════════════════
   1. TOZA MANTIQ — bazasiz ishlaydi, shuning uchun sinaladi
   ══════════════════════════════════════════════════════════════════════ */

const clean = (s) => String(s ?? "").trim();

/**
 * Serverdagi ixcham yozuvni KASSA kutgan shaklga keltiradi.
 *
 * ⚠ `stockQuantity: null` — «qoldiq NOMA'LUM», nol emas. Nol bo'lsa
 * `addToCart` «omborda qolmagan» deb rad etardi va oflayn kassa
 * umuman sotmasdi. `null` esa `stockError` uchun «bu tovarda qoldiq
 * tushunchasi yo'q» degani.
 *
 * ⚠ `offline: true` — ekranda ROSTNI aytish uchun: bu qator keshdan
 * keldi va uning qoldig'i tekshirilmagan.
 */
export const asUiProduct = (p) => ({
  ...p,
  stockQuantity: null,
  expired: false,
  offline: true,
});

/**
 * Tovarning HAMMA kodlari: asosiy barkod, do'kon kodi, SKU va qadoqlar.
 *
 * ⚠ Qadoq barkodi ham shu yerda: quti skanerlanganda kassa uni
 * tanishi va miqdorni `packQty` dan olishi kerak. Oflaynda buni
 * qiladigan boshqa hech narsa yo'q.
 */
export function codesOf(product) {
  const out = [];
  const add = (code, quantity, packLabel) => {
    const c = clean(code);
    if (c) out.push({ code: c, quantity, packLabel });
  };
  add(product.barcode, 1, null);
  add(product.searchCode, 1, null);
  add(product.sku, 1, null);
  for (const pack of product.packs || []) {
    add(pack.barcode, Number(pack.packQty) || 1, pack.label || null);
  }
  return out;
}

/** Kod → tovar xaritasi. Birinchi uchragani yutadi (asosiy barkod oldin). */
export function buildIndex(products) {
  const index = new Map();
  for (const p of products) {
    for (const { code, quantity, packLabel } of codesOf(p)) {
      if (!index.has(code)) index.set(code, { product: p, quantity, packLabel });
    }
  }
  return index;
}

/**
 * Kod bo'yicha qidiruv — javob shakli SERVERDAGI `ScanResponse` bilan
 * bir xil, chunki `KassaPage.addByBarcode` aynan shu shaklni kutadi.
 *
 * ⚠ `WEIGHT`, `GLOBAL`, `ARCHIVED`, `OTHER_BRANCH` oflaynda
 * QAYTMAYDI: ularning har biri serverdagi ma'lumotga tayanadi
 * (tarozi sozlamalari, umumiy katalog, arxiv, boshqa filial).
 * Oflaynda javob faqat `PRODUCT`, `PACK` yoki `NONE` bo'ladi.
 */
export function lookupIn(index, code) {
  const hit = index.get(clean(code));
  if (!hit) return { source: "NONE" };
  return {
    source: hit.quantity === 1 && !hit.packLabel ? "PRODUCT" : "PACK",
    product: asUiProduct(hit.product),
    quantity: hit.quantity,
    packLabel: hit.packLabel,
  };
}

/**
 * Nom bo'yicha qidiruv.
 *
 * ⚠ TARTIB SERVERDAGIDEK BO'LISHGA URINMAYDI va urinmasligi ham
 * kerak: server tartibi sotuv tarixi va qoldiqqa tayanadi, ular esa
 * keshda yo'q. Bu yerdagi qoida sodda va oldindan aytsa bo'ladigan:
 * NOMI BOSHLANADIGANLAR oldin, keyin ichida uchraganlar, ikkalasi
 * ham alifbo bo'yicha. Kassir «nega bu tartib?» deb o'ylamasligi
 * kerak.
 */
export function searchIn(products, query, opts = {}) {
  const q = clean(query).toLowerCase();
  const { categoryId = null, favorites = false, limit = 60 } = opts;

  let rows = products;
  if (categoryId) rows = rows.filter((p) => String(p.categoryId) === String(categoryId));
  if (favorites) rows = rows.filter((p) => p.favorite);

  if (!q) {
    return rows
      .slice()
      .sort(byName)
      .slice(0, limit)
      .map(asUiProduct);
  }

  const starts = [];
  const inside = [];
  for (const p of rows) {
    const name = clean(p.name).toLowerCase();
    if (name.startsWith(q)) { starts.push(p); continue; }
    if (name.includes(q)) { inside.push(p); continue; }
    /* Kod bo'yicha ham topiladi: kassir yorliqdagi raqamni terishi
       oddiy hol va oflaynda ham ishlashi kerak. */
    if (codesOf(p).some(({ code }) => code.toLowerCase().includes(q))) inside.push(p);
  }
  starts.sort(byName);
  inside.sort(byName);
  return [...starts, ...inside].slice(0, limit).map(asUiProduct);
}

const byName = (a, b) => clean(a.name).localeCompare(clean(b.name), "uz");

/**
 * Kesh qanchalik eski.
 *
 * ⚠ SON EMAS, HOLAT qaytaradi: ekranda «14:32 da yangilangan» degan
 * aniq vaqtdan ko'ra «bugun» / «kecha» / «eski» foydali. Kassirning
 * savoli «qachon?» emas, «ishonsam bo'ladimi?».
 */
export function freshness(syncedAtMs, now = Date.now()) {
  if (!syncedAtMs) return "none";
  const hours = (now - syncedAtMs) / 3_600_000;
  if (hours < 12) return "fresh";
  if (hours < 72) return "stale";
  return "old";
}

/* ══════════════════════════════════════════════════════════════════════
   2. BAZA
   ══════════════════════════════════════════════════════════════════════ */

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
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

const readAll = () => tx(STORE, "readonly", (s) => s.getAll());
const readMeta = () => tx(META, "readonly", (s) => s.get(META_KEY));
const writeMeta = (value) => tx(META, "readwrite", (s) => s.put({ key: META_KEY, ...value }));

/* ══════════════════════════════════════════════════════════════════════
   3. XOTIRADAGI NUSXA — kassa har skanerda bazaga bormasin
   ══════════════════════════════════════════════════════════════════════ */

let cache = null;      // { products, index, syncedAt, shopId }

async function load() {
  if (cache) return cache;
  const [products, meta] = await Promise.all([readAll(), readMeta()]);
  cache = {
    products: products || [],
    index: buildIndex(products || []),
    syncedAt: meta?.syncedAt || null,
    at: meta?.at || null,
    shopId: meta?.shopId ?? null,
  };
  return cache;
}

const drop = () => { cache = null; };

/* ══════════════════════════════════════════════════════════════════════
   4. TASHQI YO'L
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Serverdan katalogni oladi.
 *
 * ⚠ FILIAL ALMASHSA KESH TASHLANADI. Tovar ro'yxati, narxlar va
 * kodlar filialga bog'liq: birinchi filialning keshi bilan
 * ikkinchisida sotish boshqa tovarni savatga solishi mumkin edi.
 * Shuning uchun `shopId` metada saqlanadi va farq qilsa to'liq
 * qayta yuklanadi.
 *
 * ⚠ XATO YUTILADI: katalog kelmagani sotuvni to'xtatmasligi kerak —
 * ilova onlayn ishlashda davom etadi, kesh esa eskicha qoladi.
 */
export async function sync({ shopId = null, force = false, fetcher = null } = {}) {
  const current = await load();
  const branchChanged = String(current.shopId ?? "") !== String(shopId ?? "");
  const since = force || branchChanged ? null : current.syncedAt;

  /* ⚠ `../api` DINAMIK YUKLANADI. Modul darajasidagi import uni
     Node'dagi sinovga ham tortib kelardi (`window`, `localStorage`,
     `fetch`), holbuki bu yerdagi mantiqning brauzerga aloqasi yo'q.
     Sinov o'z `fetcher` ini beradi va `../api` umuman ochilmaydi. */
  const call = fetcher
    || (async (sinceArg, shopArg) =>
          (await import("../api")).productApi.offlineCatalog(sinceArg, shopArg));

  const res = await call(since, shopId);
  const data = res?.data;
  if (!data) return null;

  await openDb();
  if (data.full) {
    await tx(STORE, "readwrite", (s) => { s.clear(); });
  }
  if (data.products?.length) {
    await tx(STORE, "readwrite", (s) => { for (const p of data.products) s.put(p); });
  }
  if (!data.full && data.goneIds?.length) {
    await tx(STORE, "readwrite", (s) => { for (const id of data.goneIds) s.delete(id); });
  }
  await writeMeta({ syncedAt: data.syncedAt, at: Date.now(), shopId });

  drop();
  const next = await load();
  return { count: next.products.length, full: data.full, changed: data.products?.length || 0 };
}

/** Kod bo'yicha — `ScanResponse` shaklida. */
export async function lookup(code) {
  const c = await load();
  return lookupIn(c.index, code);
}

/** Nom yoki kod bo'yicha ro'yxat. */
export async function search(query, opts) {
  const c = await load();
  return searchIn(c.products, query, opts);
}

/** Ekranda ko'rsatish uchun: nechta tovar bor va kesh qanchalik eski. */
export async function info() {
  const c = await load();
  return {
    count: c.products.length,
    at: c.at,
    freshness: freshness(c.at),
  };
}

/** Sinov va filial almashinuvi uchun. */
export async function clear() {
  await tx(STORE, "readwrite", (s) => { s.clear(); });
  await writeMeta({ syncedAt: null, at: null, shopId: null });
  drop();
}
