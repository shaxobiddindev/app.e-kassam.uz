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

   ═══ TAROZI BARKODI ══════════════════════════════════════════════════

   Go'sht, pishloq va meva sotadigan do'konda tarozi o'zi EAN-13 chop
   etadi va u HAR TORTISHDA boshqacha bo'ladi. Uni tushunmaydigan
   kassa kassirni har safar miqdorni qo'lda kiritishga majbur qiladi —
   kuniga yuzlab marta.

   Format do'kon sozlamasidan keladi va u endi KATALOG BILAN BIRGA
   yuklanadi (`OfflineCatalogDtos.OfflineScale`).

   ⚠ NAZORAT RAQAMI TEKSHIRILADI va bu bo'sh rasmiyatchilik emas:
   skaner xato o'qigan `...008500...` tekshiruvsiz jimgina 8.5 kg deb
   qabul qilinardi — mijoz uch baravar ko'p to'lardi, ombor esa
   hisobdan chiqib ketardi. Serverdagi qoida ham aynan shunday
   (`WeightBarcode`).

   ⚠ NATIJA JIMGINA SAVATGA TUSHMAYDI. Do'kon formati tarozining
   haqiqiy formatiga mos kelmasa, nazorat raqami baribir to'g'ri
   chiqadi va PLU noto'g'ri o'qiladi. Shuning uchun kassa miqdorni
   ekranda ko'rsatadi va kassir tasdiqlaydi — onlayn yo'ldagi bilan
   bir xil.

   ═══ ⚠ NIMA QILA OLMAYDI ══════════════════════════════════════════════

   `GLOBAL` (umumiy katalog taklifi), `ARCHIVED` va `OTHER_BRANCH`
   javoblari oflaynda qaytmaydi — ularning har biri serverdagi
   ma'lumotga tayanadi.
   ══════════════════════════════════════════════════════════════════════════ */

import { ean13Valid } from "./ek-barcode-check.js";
import { isWeighUnit, weightQty } from "./ek-scale.js";

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

/**
 * PLU ni SOLISHTIRISH SHAKLIGA keltiradi — boshidagi nollar tashlanadi.
 *
 * ⚠ SERVERDAGI `canonicalPlu` NING JUFTI. Barkodda PLU qat'iy
 * uzunlikda («00012»), tovar formasida esa odam «12» deb yozadi.
 * Aynan solishtirilsa, SOZLANGAN tovar «topilmadi» bo'lardi.
 */
export const canonicalPlu = (v) => {
  const digits = clean(v).replace(/\D/g, "");
  const trimmed = digits.replace(/^0+/, "");
  return trimmed || (digits ? "0" : "");
};

/** PLU → tovar. Bo'sh PLU li tovarlar tushmaydi. */
export function buildPluIndex(products) {
  const index = new Map();
  for (const p of products) {
    const key = canonicalPlu(p.plu);
    if (key && !index.has(key)) index.set(key, p);
  }
  return index;
}

/**
 * Tarozi barkodini ochadi — serverdagi `WeightBarcode.parse` ning jufti.
 *
 * @returns `{ plu, type, value }` yoki `null`
 */
export function parseWeight(code, scale) {
  if (!scale) return null;
  const digits = clean(code);
  if (digits.length !== 13 || !/^\d+$/.test(digits)) return null;

  const prefixes = scale.prefixes || [];
  if (!prefixes.length) return null;
  const prefixLength = String(prefixes[0]).length;
  /* Hamma prefiks bir xil uzunlikda bo'lishi shart — server ham shu
     tenglik bilan tekshiradi (`ScaleFormat.validationError`). */
  if (prefixes.some((p) => String(p).length !== prefixLength)) return null;
  if (prefixLength + scale.pluDigits + scale.valueDigits + 1 !== 13) return null;

  if (!prefixes.includes(digits.slice(0, prefixLength))) return null;
  if (!ean13Valid(digits)) return null;

  const valueStart = prefixLength + scale.pluDigits;
  const plu = digits.slice(prefixLength, valueStart);
  const raw = digits.slice(valueStart, valueStart + scale.valueDigits);

  const value = Number(raw) / 10 ** (scale.valueDecimals || 0);
  /* Nol qiymat — tarozi xatosi yoki oddiy ichki barkod. Miqdorni 0
     qilib savatga qo'shishdan ko'ra, uni umuman tanimagan ma'qul. */
  if (!Number.isFinite(value) || value <= 0) return null;

  return { plu, type: scale.valueType || "WEIGHT", value };
}

/**
 * Barkoddagi qiymatdan MIQDOR chiqaradi — `scaleQuantity` ning jufti.
 *
 * ⚠ «TORTILADI», «bo'linadi» emas: gramm bo'linmaydi (butun son),
 * lekin tortiladi; metr bo'linadi, lekin tarozida o'lchanmaydi. Shu
 * farq qilinmasa, 0.488 kg lik yorliq mato sotadigan do'konda
 * «0.488 metr» bo'lib chekka tushardi.
 */
export function weightQuantity(product, parsed) {
  if (!parsed) return null;
  /* ⚠ BIRLIK JADVALI `ek-scale.js` DA — bu yerda takrorlanmaydi.
     Ikkinchi nusxa yozilganda ertami-kechmi bittasi tuzatilib,
     ikkinchisi eskicha qolardi va bir xil barkod ikki ekranda ikki
     xil miqdor berardi. */
  if (!isWeighUnit(product?.unit)) return null;

  let raw;
  if (parsed.type === "WEIGHT") {
    raw = weightQty(product.unit, parsed.value);
  } else {
    const price = Number(product?.salePrice);
    /* Narxsiz tovarda bo'lishning iloji yo'q — nolga bo'lish ham,
       «cheksiz miqdor» ham xato bo'lardi. */
    if (!Number.isFinite(price) || price <= 0) return null;
    /* ⚠ BU YERDA KILOGRAMMGA O'GIRISH YO'Q va bu ataylab: narx
       TOVAR BIRLIGIGA qo'yilgan (grammda sotiladigan tovarda —
       bir gramm uchun), ya'ni summani narxga bo'lish darhol
       tovar birligidagi miqdorni beradi. Bu yerda ham `weightQty`
       chaqirilsa, grammdagi tovar ming baravar ko'p chiqardi.
       Serverdagi `scaleQuantity` ham shu ikki yo'lni ajratadi. */
    raw = parsed.value / price;
  }
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const decimals = Number(product?.unitDecimals) || 0;
  const factor = 10 ** decimals;
  const qty = Math.round(raw * factor) / factor;
  return qty > 0 ? qty : null;
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
export function lookupIn(index, code, opts = {}) {
  const hit = index.get(clean(code));
  if (hit) {
    return {
      source: hit.quantity === 1 && !hit.packLabel ? "PRODUCT" : "PACK",
      product: asUiProduct(hit.product),
      quantity: hit.quantity,
      packLabel: hit.packLabel,
    };
  }

  /* ⚠ TAROZI OXIRIDA TEKSHIRILADI — serverdagi tartib ham shunday.
     Oddiy barkod bilan tarozi barkodi to'qnashishi mumkin (ikkalasi
     ham `2…` bilan boshlanishi mumkin) va o'shanda ro'yxatdagi
     HAQIQIY tovar ustun turishi kerak. */
  const { scale = null, pluIndex = null } = opts;
  const parsed = parseWeight(code, scale);
  if (parsed && pluIndex) {
    const product = pluIndex.get(canonicalPlu(parsed.plu))
      /* PLU ustuni V42 da qo'shilgan va do'konlar uni bir kunda
         to'ldirmaydi — eski ma'lumot uchun barkod/SKU ham ko'riladi
         (serverdagi tartib bilan bir xil). */
      || index.get(parsed.plu)?.product
      || index.get(String(Number(parsed.plu)))?.product;

    if (product) {
      const quantity = weightQuantity(product, parsed);
      if (quantity) {
        return { source: "WEIGHT", product: asUiProduct(product), quantity, packLabel: null };
      }
    }
  }

  return { source: "NONE" };
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

let cache = null;      // { products, index, pluIndex, scale, syncedAt, shopId }

async function load() {
  if (cache) return cache;
  const [products, meta] = await Promise.all([readAll(), readMeta()]);
  const rows = products || [];
  cache = {
    products: rows,
    index: buildIndex(rows),
    /* ⚠ PLU ALOHIDA XARITADA: u barkod emas va kod xaritasiga
       qo'shilsa, «12» degan PLU «12» degan qisqa barkod bilan
       to'qnashardi. */
    pluIndex: buildPluIndex(rows),
    scale: meta?.scale || null,
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
  /* ⚠ TAROZI FORMATI HAR JAVOBDAN OLINADI, farq so'ralganda ham:
     do'kon sozlamani o'zgartirsa, kesh eskirgan format bilan qolib
     ketmasligi kerak — o'shanda barkod ochilardi-yu, PLU noto'g'ri
     o'qilib boshqa tovar savatga tushardi. */
  await writeMeta({
    syncedAt: data.syncedAt, at: Date.now(), shopId,
    scale: data.scale || (await readMeta())?.scale || null,
  });

  drop();
  const next = await load();
  return { count: next.products.length, full: data.full, changed: data.products?.length || 0 };
}

/** Kod bo'yicha — `ScanResponse` shaklida. */
export async function lookup(code) {
  const c = await load();
  return lookupIn(c.index, code, { scale: c.scale, pluIndex: c.pluIndex });
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
    /* Tarozi formati kelganmi — sozlash ekranida foydali. */
    scale: c.scale,
  };
}

/** Sinov va filial almashinuvi uchun. */
export async function clear() {
  await tx(STORE, "readwrite", (s) => { s.clear(); });
  await writeMeta({ syncedAt: null, at: null, shopId: null, scale: null });
  drop();
}
