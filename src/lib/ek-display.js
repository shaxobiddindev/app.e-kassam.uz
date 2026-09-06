/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ EKRANI — IKKINCHI MONITOR (V77)

   ═══ NIMA UCHUN ══════════════════════════════════════════════════════

   Mijoz kassirning ekranini ko'rmaydi va nima urilayotganini bilmaydi.
   Natijada ishonch faqat kassirning so'ziga qoladi, chek esa hammasi
   tugagandan KEYIN chiqadi — o'shanda bahslashish kech. Mijozga
   qaragan ekran har qatorni o'sha zahoti ko'rsatadi.

   ═══ QANDAY ULANADI ══════════════════════════════════════════════════

   Ikkinchi monitor — O'SHA brauzerning ikkinchi oynasi (`window.open`),
   ya'ni bir xil manba (origin). Server umuman ishtirok etmaydi:

     · aloqa `BroadcastChannel` orqali — bir manbadagi oynalar
       o'rtasidagi eng arzon yo'l, tarmoq ham, ruxsat ham talab
       qilmaydi;
     · brauzerda `BroadcastChannel` bo'lmasa `localStorage` ning
       `storage` hodisasi ishlaydi — u BOSHQA oynalarda otiladi, ya'ni
       aynan bizga kerak bo'lgan xulq.

   ⚠ HOLAT `localStorage` DA HAM SAQLANADI va bu MAJBURIY, nusxa emas.
   Mijoz ekrani odatda kassa ochilgandan KEYIN ochiladi: o'sha paytda
   `BroadcastChannel` ga hech narsa yuborilmagan bo'ladi va yangi oyna
   bo'sh ekran ko'rsatardi. Saqlangan holat bilan u darhol joriy
   savatni chizadi.

   ⚠ SERVERGA HECH NARSA YUBORILMAYDI va yuborilmasligi kerak: bu
   ekran do'konning ichida, bitta kompyuterda turadi. Tarmoqqa
   chiqarish savat tarkibini keraksiz joyga tarqatardi.

   ═══ NEGA SOF MODUL ══════════════════════════════════════════════════

   Xabar yuborish va holatni yig'ish — SINALADIGAN qaror (qaysi
   holatda nima ko'rinadi). React ichida bo'lganda uni faqat brauzer
   ochib tekshirish mumkin bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

const CHANNEL = "ek-display";
const KEY = "ek_display";

/** Sozlamadagi kalit — mijoz ekrani yoqilganmi. */
export const HW_KEY = "customerDisplay";

/**
 * Ekranning holatlari.
 *
 * ⚠ `done` ALOHIDA va `idle` ga darhol o'tmaydi: mijoz qaytimni va
 * «rahmat» ni o'qishga ulgurishi kerak. Ilgari o'ylangan «sotuvdan
 * keyin darrov tozalash» varianti qaytimni ko'rsatmay yopib
 * yuborardi.
 */
export const MODES = ["idle", "cart", "pay", "done"];

/** Bo'sh holat — ekran birinchi ochilganda va savat tozalanganda. */
export const EMPTY = { mode: "idle", items: [], total: 0, at: 0 };

/* ══════════════════════════════════════════════════════════════════════
   HOLATNI YIG'ISH
   ══════════════════════════════════════════════════════════════════════ */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Kassaning ichki holatidan mijoz ekrani uchun MINIMAL nusxa.
 *
 * ⚠ FAQAT MIJOZGA TEGISHLISI. Tannarx, marja, qoldiq va xodimning
 * ismi bu yerga TUSHMAYDI: ular mijozning ishi emas va ekran
 * do'konning ichki raqamlarini ko'chaga qaratib qo'yardi.
 *
 * ⚠ Nom `name`, `productName` va `title` dan olinadi: savat qatori
 * turli yo'llardan (skaner, qidiruv, kartochka) yig'iladi va maydon
 * nomi bir xil emas. Nomsiz qator ekranda bo'sh satr bo'lib qolardi.
 */
export function buildState({ mode = "cart", shop = "", items = [], total = 0,
                             discount = 0, customer = null, given = null,
                             change = null, receiptNo = null, promo = [] } = {}) {
  const lines = (items || []).map((i) => ({
    name: String(i.name ?? i.productName ?? i.title ?? "").trim(),
    qty: n(i.qty ?? i.quantity ?? 1),
    unit: i.unit || null,
    price: n(i.price ?? i.salePrice),
    sum: n(i.sum ?? (i.price ?? i.salePrice) * (i.qty ?? i.quantity ?? 1)),
  }));

  return {
    mode: MODES.includes(mode) ? mode : "cart",
    shop: String(shop || ""),
    items: lines,
    count: lines.reduce((s, x) => s + x.qty, 0),
    total: n(total),
    discount: n(discount),
    customer: customer ? { name: String(customer.name || ""), bonus: n(customer.bonus) } : null,
    given: given == null ? null : n(given),
    change: change == null ? null : n(change),
    receiptNo: receiptNo == null ? null : String(receiptNo),
    /* Bo'sh ekranda aylanadigan takliflar — sabab `DisplayPage` da. */
    promo: (promo || []).slice(0, 6).map((p) => ({
      name: String(p.name || ""), price: n(p.price), was: p.was == null ? null : n(p.was),
    })),
    at: Date.now(),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   YUBORISH VA TINGLASH
   ══════════════════════════════════════════════════════════════════════ */

let chan = null;
function channel() {
  if (chan !== null) return chan;
  try {
    chan = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : false;
  } catch { chan = false; }
  return chan;
}

/** Holatni ikkinchi oynaga uzatadi (va saqlaydi). */
export function publish(state) {
  const s = state && state.mode ? state : EMPTY;
  /* ⚠ AVVAL SAQLANADI: yozish `BroadcastChannel` dan ko'ra ishonchli
     va keyin ochiladigan oyna aynan shundan o'qiydi. */
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* to'lgan xotira — kanal baribir ishlaydi */ }
  const c = channel();
  if (c) { try { c.postMessage(s); } catch { /* oyna yopilgan */ } }
  return s;
}

/** Oxirgi saqlangan holat — oyna endi ochilganda. */
export function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    return raw && MODES.includes(raw.mode) ? raw : EMPTY;
  } catch { return EMPTY; }
}

/**
 * Holat o'zgarishlarini tinglaydi.
 *
 * @returns tinglashni to'xtatuvchi funksiya
 *
 * ⚠ IKKALA yo'l ham ulanadi (`BroadcastChannel` VA `storage`), chunki
 * ular bir-birini to'ldiradi: kanal tezroq, `storage` esa kanal
 * qo'llab-quvvatlanmagan brauzerda yagona yo'l. Bir xil holat ikki
 * marta kelishi zarar qilmaydi — u shunchaki qayta chiziladi.
 */
export function subscribe(fn) {
  const c = channel();
  const onMsg = (e) => { if (e?.data?.mode) fn(e.data); };
  const onStorage = (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { const s = JSON.parse(e.newValue); if (s?.mode) fn(s); } catch { /* buzuq yozuv */ }
  };
  if (c) c.addEventListener("message", onMsg);
  window.addEventListener("storage", onStorage);
  return () => {
    if (c) c.removeEventListener("message", onMsg);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Mijoz ekranini ikkinchi monitorda ochadi.
 *
 * ⚠ `window.open` FOYDALANUVCHI BOSGANDA chaqirilishi shart — aks
 * holda brauzer uni qalqib chiquvchi deb to'sadi va kassir hech
 * qanday sabab ko'rmaydi. Shuning uchun bu funksiya tugmadan
 * chaqiriladi, avtomatik emas.
 *
 * ⚠ Oyna nomi QAT'IY (`ek-display`): ikkinchi marta bosilganda yangi
 * oyna ochilmaydi, borini oldinga chiqaradi. Aks holda monitorda
 * bir-birining ustida o'nlab oyna yig'ilardi.
 */
export function openDisplay() {
  const w = window.open("/display", "ek-display",
    "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no");
  try { w?.focus(); } catch { /* boshqa monitorda — fokus shart emas */ }
  return w;
}
