/* ══════════════════════════════════════════════════════════════════════════
   FISKAL QR NING JISMONIY O'LCHAMI (V85)

   ═══ TALAB ═════════════════════════════════════════════════════════════

   943-son qaror fiskal QR ning tomonini KAMIDA 30 mm qilishni talab
   qiladi. Bu shunchaki raqam emas: kichik QR ni eski telefon kamerasi
   yoki g'ijimlangan qog'ozdan o'qiy olmaydi va xaridor chekni
   tekshira olmaydi — ya'ni QR ning butun ma'nosi yo'qoladi.

   ═══ ⚠ MUAMMO: ESC/POS DA O'LCHAM YO'Q, MODUL KATTALIGI BOR ════════════

   Printerga «30 mm qilib chiqar» deb aytib bo'lmaydi. Unga MODUL
   kattaligi (nuqtalarda) beriladi, jismoniy o'lcham esa QR dagi modul
   SONIGA ham bog'liq:

       o'lcham (mm) = modullar_soni × modul_kattaligi / nuqta_zichligi

   Modullar soni esa MA'LUMOT UZUNLIGIDAN kelib chiqadi. Ya'ni bir xil
   `size` bilan qisqa havola KICHIK, uzuni esa KATTA chiqadi.

   ⚠ AYNAN SHU YERDA XATO BOR EDI. Kodda `qr(url)` — standart `size=8`
   ishlatilardi. Uzun havola uchun bu ~33 mm beradi va talab bajariladi;
   QISQA havola uchun esa (21 modul, 1-versiya) atigi 21 mm chiqadi va
   talab BUZILADI. Xato jimgina: chek chiqadi, QR ko'rinadi, faqat
   kichik.

   ═══ YECHIM ════════════════════════════════════════════════════════════

   Ma'lumot uzunligidan modullar soni baholanadi, keyin 30 mm ni
   beradigan eng kichik modul kattaligi tanlanadi. Qog'oz eni ham
   hisobga olinadi: QR qog'ozdan kengroq bo'lsa printer uni qirqib
   tashlaydi va natija 30 mm dan ham yomon bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Termal printerlarning deyarli barchasi — 203 dpi = 8 nuqta/mm. */
export const DOTS_PER_MM = 8;

/** 943-son qaror talabi. */
export const MIN_QR_MM = 30;

/**
 * Chop etiladigan eng katta kenglik, mm.
 *
 * ⚠ Qog'oz enidan KICHIKROQ: 58 mm qog'ozda chop etiladigan soha ~48 mm,
 * 80 mm da ~72 mm. Chetlari printerning o'zi tomonidan qoldiriladi va
 * ularga chizib bo'lmaydi.
 */
const PRINTABLE_MM = { 58: 48, 80: 72 };

/**
 * QR versiyalari: baytli rejim, xatoni tuzatish darajasi M.
 *
 * ⚠ Bu QR STANDARTINING raqamlari, fiskal spetsifikatsiyaniki emas —
 * ularni bu yerda yozish taxmin emas. `capacity` — shu versiyaga
 * sig'adigan bayt soni, `modules` — tomonidagi modullar soni.
 */
const VERSIONS = [
  { capacity: 14,  modules: 21 },   // 1
  { capacity: 26,  modules: 25 },   // 2
  { capacity: 42,  modules: 29 },   // 3
  { capacity: 62,  modules: 33 },   // 4
  { capacity: 84,  modules: 37 },   // 5
  { capacity: 106, modules: 41 },   // 6
  { capacity: 122, modules: 45 },   // 7
  { capacity: 152, modules: 49 },   // 8
  { capacity: 180, modules: 53 },   // 9
  { capacity: 213, modules: 57 },   // 10
];

/** Ma'lumot uzunligi uchun modullar soni. */
export function modulesFor(text) {
  const len = new TextEncoder().encode(String(text ?? "")).length;
  for (const v of VERSIONS) {
    if (len <= v.capacity) return v.modules;
  }
  /* ⚠ Ro'yxatdan oshgan ma'lumot: eng katta ma'lum versiya olinadi.
     Bu BAHOLASHNI PASAYTIRADI, ya'ni modul kattaligi kerakligidan
     KATTA chiqadi — xavfsiz tomon. Teskarisi (kichik chiqishi) QR ni
     talabdan kichik qilardi. */
  return VERSIONS[VERSIONS.length - 1].modules;
}

/**
 * 30 mm ni beradigan modul kattaligi.
 *
 * @param text  QR ga yoziladigan matn
 * @param paper 58 yoki 80 (mm)
 * @returns 1..16 oralig'idagi butun son — `Receipt.qr(text, size)` uchun
 */
export function qrModuleSize(text, paper = 80) {
  const modules = modulesFor(text);
  /* Kerakli kattalik: yuqoriga yaxlitlanadi — pastga yaxlitlash
     30 mm dan bir oz kichik berardi va talab buzilardi. */
  let size = Math.ceil((MIN_QR_MM * DOTS_PER_MM) / modules);

  /* ⚠ Qog'ozdan oshib ketmasin: printer ortiqchasini QIRQADI va
     yarim QR umuman o'qilmaydi — bu 30 mm dan ham yomon natija. */
  const maxMm = PRINTABLE_MM[paper] ?? PRINTABLE_MM[80];
  const maxSize = Math.floor((maxMm * DOTS_PER_MM) / modules);
  if (maxSize >= 1) size = Math.min(size, maxSize);

  return Math.max(1, Math.min(16, size));
}

/** Tanlangan kattalikda QR necha mm bo'lishi — sinov va tekshiruv uchun. */
export function qrSizeMm(text, paper = 80) {
  return (modulesFor(text) * qrModuleSize(text, paper)) / DOTS_PER_MM;
}
