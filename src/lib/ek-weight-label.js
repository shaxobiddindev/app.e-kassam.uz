/* ══════════════════════════════════════════════════════════════════════════
   TAROZI YORLIG'I — og'irlikli barkod va yorliq ma'lumotlari (2026-10-04)

   Egasi (do'kondagi tarozi stikerining surati bilan): «bu stikerlardan
   shablon ol». Qarori — «tortib chiqarish»: tovar tanlanadi, og'irlik
   tarozidan o'qiladi (yoki qo'lda yoziladi) va shu ko'rinishdagi stiker
   chiqadi — og'irlik, jami summa va KASSA SKANER QILADIGAN barkod bilan.

   ⚠ BARKOD DO'KONNING O'Z TAROZI FORMATIDA (Sozlamalar → Tarozi barkodi):
   kassa uni `parseWeight` bilan ochadi (`ek-catalog.js`, serverda
   `WeightBarcode`). Bu yerda boshqa format yasalsa, stiker chiroyli
   chiqadi-yu, kassada «topilmadi» bo'lardi. Shuning uchun sinov har
   barkodni o'sha `parseWeight` bilan QAYTA OCHIB tekshiradi.

   Haqiqiy namuna (egasining surati): «2700001002550» — prefiks 27,
   PLU 00001, 00255 = 0,255 kg, nazorat raqami 0.
   ══════════════════════════════════════════════════════════════════════════ */
import { canonicalPlu } from "./ek-catalog.js";

/** Shu birliklar tarozida tortiladi (`ek-scale.js` dagi WEIGHT_UNITS bilan bir xil ma'no). */
export const isWeighed = (p) => ["KG", "G", "GRAM", "KILOGRAM"].includes(String(p?.unit ?? "").toUpperCase());

/** Do'kon sozlamasi yoki katalog meta'sidan — bir xil shaklga. Bo'sh joylar standart. */
export function normScale(s = {}) {
  const raw = s.prefixes ?? s.scalePrefixes ?? "2";
  const prefixes = (Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/))
    .map((x) => String(x).trim()).filter(Boolean);
  return {
    prefixes: prefixes.length ? prefixes : ["2"],
    pluDigits: Number(s.pluDigits ?? s.scalePluDigits ?? 5),
    valueDigits: Number(s.valueDigits ?? s.scaleValueDigits ?? 6),
    valueDecimals: Number(s.valueDecimals ?? s.scaleValueDecimals ?? 3),
    valueType: s.valueType ?? s.scaleValueType ?? "WEIGHT",
  };
}

function ean13Check(body12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Gramm bilan sotiladigan birlik — narx 1 gramm uchun. */
const isGram = (unit) => ["G", "GRAM"].includes(String(unit ?? "").toUpperCase());

/**
 * Jami summa — so'mgacha yaxlitlanadi.
 *
 * ⚠ GRAMM (2026-10-06): narx BIRLIK uchun — kg li tovarda 1 kg, grammli
 * tovarda 1 gramm uchun. Ilgari har doim `narx × kg` olinardi va grammli
 * tovarda yorliqdagi jami 1000 baravar kam chiqardi (barkodning o'zi to'g'ri
 * edi — kassa miqdorni grammga o'giradi).
 */
export const totalOf = (price, kg, unit) =>
  Math.round((Number(price) || 0) * (Number(kg) || 0) * (isGram(unit) ? 1000 : 1));

/**
 * Og'irlikli EAN-13. Xato bo'lsa `{ error }` — kalit lug'atda (`wl.err.*`).
 *
 * @param scale  `normScale` natijasi
 * @param plu    tovar PLU si
 * @param kg     og'irlik (kg)
 * @param total  jami summa — tarozi NARX kodlasa (`valueType: PRICE`)
 */
export function weightBarcode(scale, plu, kg, total = 0) {
  const s = normScale(scale);
  const key = canonicalPlu(plu);
  if (!key) return { error: "wl.err.noPlu" };
  if (key.length > s.pluDigits) return { error: "wl.err.pluLong" };
  const prefix = s.prefixes[0];
  if (prefix.length + s.pluDigits + s.valueDigits + 1 !== 13) return { error: "wl.err.format" };
  const value = s.valueType === "PRICE"
    ? Math.round(Number(total) * 10 ** s.valueDecimals)
    : Math.round(Number(kg) * 10 ** s.valueDecimals);
  if (!(value > 0)) return { error: "wl.err.noWeight" };
  const v = String(value);
  if (v.length > s.valueDigits) return { error: "wl.err.tooHeavy" };
  const body = prefix + key.padStart(s.pluDigits, "0") + v.padStart(s.valueDigits, "0");
  return { code: body + ean13Check(body) };
}

/**
 * «0,255 kg» — verguldan keyin DOIM 3 xona (2026-10-06).
 *
 * ⚠ Ilgari nuqta edi («tarozi yorliqlarida nuqta odatiy»). Egasi: «tarozili
 * mahsulotlarda og'irlik verguldan keyin 3 xona ko'rsatilsin» — kassa, chek
 * va yorliq bir xil yozsin (`ek-format.quantity` ham shunday).
 */
export const weightText = (kg) => `${(Number(kg) || 0).toFixed(3).replace(".", ",")} kg`;

/** Yorliq vaqti: «2026-09-30 13:25» (mahalliy). */
export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Renderer uchun tovar nusxasi: barkod o'rnida og'irlikli kod, qo'shimcha
 * maydonlar (`weight`, `total`, `plu`). Asl tovar o'zgarmaydi.
 */
export function weighedProduct(product, kg, scale) {
  const total = totalOf(product?.salePrice, kg, product?.unit);
  const bc = weightBarcode(scale, product?.plu, kg, total);
  if (bc.error) return { error: bc.error };
  return {
    product: {
      ...product, barcode: bc.code, weightKg: Number(kg), weightText: weightText(kg),
      total, pluText: String(product.plu ?? "").replace(/\D/g, "").padStart(normScale(scale).pluDigits, "0"),
    },
  };
}
