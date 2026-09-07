/* ══════════════════════════════════════════════════════════════════════════
   MIQDOR YOKI SUMMA (V104) — SOF MANTIQ

   Do'kon egasi: «ba'zi mahsulotlarga pulini yozsa, miqdorini o'zi qo'yib
   savatga qo'shib beradigan qilish kerak — buni kassadagi miqdor
   so'raladigan mahsulotlarga qil, shunday tanlash imkoniyatini qo'sh:
   miqdor yoki summa».

   Mijoz go'shtni «yarim kilo» deb emas, «50 minglik» deb so'raydi.
   Ilgari kassir buni o'zi bo'lardi: 50000 / 85000 = ? — kalkulyator,
   yoki taxmin. Endi summani yozadi, miqdorni tizim chiqaradi.

   ═══ NEGA ALOHIDA FAYL ═════════════════════════════════════════════════

   Bu yerda PULDAN MIQDOR chiqadi va u to'g'ridan-to'g'ri chekka tushadi.
   Yaxlitlashdagi bir xato ekranda ko'rinmaydi — u tarozidagi og'irlik
   bilan chekdagi raqamning farqi bo'lib chiqadi. Shuning uchun mantiq
   oynadan ajratilgan va sinovlari bor (`test/qty-sum.test.mjs`).

   ═══ PASTGA YAXLITLANADI, YAQINIGA EMAS ════════════════════════════════

   ⚠ `Math.round` EMAS, `Math.floor`. Mijoz «50 mingga bering» dedi —
   50 000 so'm uning CHEGARASI, mo'ljali emas. Yaqiniga yaxlitlansa
   0.588 kg (50 025 so'm) chiqib, mijoz aytgan pulidan ko'proq to'lardi
   va kassir buni og'zaki tushuntirishga majbur bo'lardi. Pastga
   yaxlitlansa 0.588 → 0.588 emas, 0.588 dan pastdagi eng katta
   ruxsat etilgan miqdor olinadi va chek HECH QACHON aytilgan puldan
   oshmaydi.

   Bu dona tovarda ham to'g'ri ishlaydi: 10 000 so'mga 13 500 so'mlik
   tovar 0 dona bo'ladi — «yetmaydi» degani, va tasdiqlash tugmasi
   o'chiq qoladi. Yaqiniga yaxlitlanganda esa 1 dona chiqib, mijoz
   35% ortiq to'lardi.

   ═══ SUZUVCHI NUQTA CHANGI ═════════════════════════════════════════════

   ⚠ `Math.floor` ni yalang'och ishlatib bo'lmaydi: 0.117 ba'zan
   0.11699999999999999 bo'lib turadi va `floor` bir birlikni JIMGINA
   yeb qo'yardi. Shuning uchun kesishdan oldin kichik chidam qo'shiladi.

   U SONNING KATTALIGIGA BOG'LIQ: suzuvchi nuqta xatosi nisbiy (katta
   sonda katta), qat'iy 1e-9 esa 12 345.678 kg da yetmay qolardi.
   Chidam baribir bir qadamdan million marta kichik — haqiqatan ham
   pastdagi son hech qachon yuqoriga ko'tarilmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Kiritish rejimi: miqdor yoziladi. */
export const MODE_QTY = "QTY";
/** Kiritish rejimi: pul yoziladi, miqdorni tizim chiqaradi. */
export const MODE_SUM = "SUM";

/** Suzuvchi nuqta changi — kesishdan oldin qo'shiladi (yuqoriga qarang). */
const EPS = 1e-9;

/** Son bo'lsa — o'zi, bo'lmasa `null`. `""`, `null`, `NaN` bir xil javob. */
const numeric = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Narx yaroqli bo'lsa — o'zi, aks holda `null` (0 ga bo'lib bo'lmaydi). */
const priceOf = (price) => {
  const p = numeric(price);
  return p != null && p > 0 ? p : null;
};

/**
 * Miqdorni birlikning kasr xonalariga PASTGA yaxlitlaydi.
 *
 * @param n         yaxlitlanadigan son
 * @param decimals  birlikdagi kasr xonalari (`unitDecimals`)
 */
export function floorTo(n, decimals = 3) {
  const num = numeric(n);
  if (num == null) return null;
  const d = Number.isFinite(Number(decimals)) ? Math.max(0, Math.trunc(decimals)) : 3;
  const p = 10 ** d;
  const scaled = num * p;
  return Math.floor(scaled + Math.max(EPS, Math.abs(scaled) * 1e-12)) / p;
}

/**
 * Summadan miqdor: «50 000 so'mga qancha tushadi?»
 *
 * @returns miqdor, yoki `null` — summa/narx yaroqsiz bo'lsa.
 *          Natija 0 bo'lishi MUMKIN: pul bir birlikka ham yetmagan
 *          holat ham javob, xato emas — oyna uni «tasdiqlab
 *          bo'lmaydi» deb ko'rsatadi.
 */
export function qtyFromSum(sum, price, decimals = 3) {
  const s = numeric(sum);
  const p = priceOf(price);
  if (s == null || p == null || s < 0) return null;
  return floorTo(s / p, decimals);
}

/**
 * Miqdordan summa: savatga tushganda AYNAN shuncha pul yoziladi.
 *
 * ⚠ Butun so'mga YUQORIGA yaxlitlanadi. Sabab arifmetik emas, mantiqiy:
 * bu son rejim almashganda maydonga qaytib tushadi va undan yana miqdor
 * chiqariladi. Pastga yaxlitlansa har almashtirishda miqdor bir zarradan
 * kamayib borardi — kassir ikki marta bosib, boshqa og'irlikka ega
 * bo'lardi. Yuqoriga yaxlitlanganda esa oldinga-orqaga almashtirish
 * miqdorni AYNAN joyida qoldiradi (sinovda tekshirilgan).
 *
 * ⚠ Bitta istisno bor va u yashirilmaydi: narx bir qadamdan (masalan
 * 1 gramm) arzon bo'lsa — ya'ni `narx < 10^kasrXona`, masalan 777 so'm
 * kilosi — butun so'mda har qadamni ifodalab bo'lmaydi va almashtirish
 * miqdorni BIR QADAMga surishi mumkin. Bir gramm; chek esa baribir
 * kassir ko'rib turgan raqamdan hisoblanadi.
 */
export function sumFromQty(qty, price) {
  const q = numeric(qty);
  const p = priceOf(price);
  if (q == null || p == null || q < 0) return null;
  return Math.ceil(q * p - EPS);
}

/**
 * Rejim almashdi — maydondagi MATNNI yangi rejimga o'giradi.
 *
 * ⚠ TOZALANMAYDI, O'GIRILADI. Kassir 0.5 kg yozib, keyin «summa» ga
 * bossa, maydonda 6 750 turadi — ya'ni savatga tushadigan narsa
 * o'zgarmaydi, faqat SAVOL o'zgaradi. Tozalab yuborish kassirni
 * qaytadan yozishga majbur qilardi; o'girmasdan qoldirish esa bundan
 * ham yomon: «0.5» jimgina «0.5 so'm» bo'lib qolardi.
 *
 * @returns maydonga qo'yiladigan matn (`""` — bo'sh yoki yaroqsiz).
 */
export function switchMode(text, to, price, decimals = 3) {
  const n = numeric(text);
  if (n == null || n <= 0 || priceOf(price) == null) return "";
  const out = to === MODE_SUM ? sumFromQty(n, price) : qtyFromSum(n, price, decimals);
  return out == null || out <= 0 ? "" : String(out);
}
