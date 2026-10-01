/* ══════════════════════════════════════════════════════════════════════════
   TOVAR KODI (V115) — kassir `*` bilan teradigan raqam

   ⚠ ALOHIDA FAYL VA BOG'LIQLIKSIZ. Bu funksiya `ek-labels.js` da
   turgan edi, lekin u `ek-i18n` ni import qiladi va shu sababli sof
   node sinovidan chaqirib bo'lmasdi. Kodni ko'rsatish qoidasi esa
   aynan sinaladigan narsa: u YAGONA joyda turishi kerak, aks holda
   yorliq bir raqamni, jadval boshqasini ko'rsatib qo'yardi.
   ══════════════════════════════════════════════════════════════════════════ */
/**
 * TOVARNING KO'RINADIGAN KODI — kassir `*` bilan teradigan raqam (V115).
 *
 * ⚠ IKKI MANBA BITTA JOYDA. Yangi kod `searchCode` da, eski tovarlarda
 * esa u ayni `shortCode` ning o'zi (migratsiya ommaviy qayta kodlash
 * qilmagan). Zaxira sifatida `shortCode` qoldirilgan: eski javob
 * qaytaradigan server bilan ham ekran bo'sh qolmasin.
 *
 * ⚠ MATN QAYTARADI, SON EMAS: «001» ning boshidagi nollari yo'qolmasin.
 */
export function productCode(p) {
  const v = p?.searchCode ?? p?.shortCode;
  return v == null || v === "" ? null : String(v);
}

/**
 * SKANERLANGAN YOKI YOZILGAN KOD → ro'yxatdagi tovar (2026-10-01).
 *
 * Yorliqlar va ko'chirish sahifalari kodni shu bilan taniydi: barkod yoki
 * tovar kodi AYNAN mos kelishi shart — qisman moslik qidiruvning ishi.
 *
 * ⚠ `*` — kassadagi «kod rejimi»: avval tovar kodi qaraladi, keyin barkod.
 * Yulduzchasiz — aksincha. Ikki tovarning biridagi barkod boshqasining
 * kodiga teng bo'lib qolsa ham, odam nimani nazarda tutgani ustun turadi.
 */
export function findByCode(list, raw) {
  const s = String(raw ?? "").trim();
  const starred = s.startsWith("*");
  const code = starred ? s.slice(1).trim() : s;
  if (!code) return null;
  const items = Array.isArray(list) ? list : [];
  const byBarcode = (p) => p?.barcode != null && String(p.barcode) === code;
  const byOwn = (p) => productCode(p) === code;
  return items.find(starred ? byOwn : byBarcode)
      || items.find(starred ? byBarcode : byOwn)
      || null;
}

