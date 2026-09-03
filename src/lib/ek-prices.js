/* ══════════════════════════════════════════════════════════════════════════
   UCH NARX QOIDASI — serverdagi qoidaning nusxasi

   ⚠ Manba `api.e-kassam.uz/common/util/Prices.java`. Bu yerdagi nusxa
   HIMOYA EMAS: himoya serverda va u har doim ishlaydi. Bu yerdagisi —
   QULAYLIK: do'kon egasi formani to'ldirayotganda xatoni saqlash
   tugmasini bosishdan OLDIN ko'rsin.

   ⚠ Ikkalasi bir xil javob berishi SHART. Farq bo'lsa foydalanuvchi
   «formada yashil edi, saqlaganda qizil chiqdi» degan holatga tushadi
   va bunday nomuvofiqlik ishonchni tez yo'qotadi. Shu sababdan bu
   modul sinovlar bilan qotirilgan (`test/prices.test.mjs`).

   Tartib:  tannarx  ≤  optom narx  ≤  sotuv narxi
   ══════════════════════════════════════════════════════════════════════════ */

/** Buzilish turlari — serverdagi `Prices.Violation` bilan bir xil. */
export const VIOLATION = {
  WHOLESALE_BELOW_COST: "WHOLESALE_BELOW_COST",
  WHOLESALE_ABOVE_SALE: "WHOLESALE_ABOVE_SALE",
  SALE_BELOW_COST: "SALE_BELOW_COST",
};

const nOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Tartibni tekshiradi. Hammasi joyida bo'lsa `null`.
 *
 * ⚠ Bo'sh narx TEKSHIRILMAYDI, buzilish emas: optom narx ixtiyoriy
 * (chakana do'konda kerak emas), tannarx esa tovar birinchi kiritilganda
 * hali noma'lum bo'lishi mumkin.
 *
 * ⚠ Optom `0` — «yo'q» degani, «bepul» emas: raqamli maydon bo'shatilganda
 * front ba'zan `0` yuboradi va u tannarxdan past bo'lib qolardi.
 */
export function checkPrices(cost, wholesale, sale) {
  const c = nOrNull(cost);
  const w = nOrNull(wholesale);
  const s = nOrNull(sale);
  const wh = w != null && w > 0 ? w : null;

  if (wh != null && c != null && wh < c) return VIOLATION.WHOLESALE_BELOW_COST;
  if (wh != null && s != null && wh > s) return VIOLATION.WHOLESALE_ABOVE_SALE;
  if (s != null && c != null && s < c) return VIOLATION.SALE_BELOW_COST;
  return null;
}

/**
 * Marja foizda: (sotuv − tannarx) / sotuv × 100.
 *
 * ⚠ Tannarxdan emas, SOTUVDAN hisoblanadi — chakana savdoda «marja»
 * shuni anglatadi va do'kon egasi raqamni aynan shu ma'noda o'qiydi.
 * Tannarxdan hisoblansa (ustama) bir xil tovarda boshqa raqam chiqib,
 * ikki hisobot bir-biriga zid bo'lardi.
 *
 * `null` — hisoblab bo'lmaydi (narx yo'q yoki nol).
 */
export function marginPercent(cost, sale) {
  const c = nOrNull(cost);
  const s = nOrNull(sale);
  if (c == null || s == null || s <= 0) return null;
  return ((s - c) / s) * 100;
}

/**
 * Tannarx o'zgarganda MARJANI SAQLAB qoladigan sotuv narxi.
 * `null` — eski marja noma'lum, tavsiya berilmaydi.
 */
export function recommendSale(oldCost, oldSale, newCost, roundTo) {
  const oc = nOrNull(oldCost);
  const os = nOrNull(oldSale);
  const nc = nOrNull(newCost);
  if (!oc || !os || !nc || oc <= 0 || os <= 0 || nc <= 0) return null;

  const next = nc * (os / oc);
  const step = nOrNull(roundTo);
  if (!step || step <= 0) return Math.round(next);
  return Math.round(next / step) * step;
}
