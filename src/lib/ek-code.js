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
 * TO'QNASHUV QATORIDAN YORLIQ ELEMENTI (B0).
 *
 * ⚠ YORLIQQA YANGI RAQAM BOSILADI, ESKISI EMAS. Butun hisobotning
 * ma'nosi shu: javondagi yorliqda ESKI raqam turibdi va u endi
 * boshqa tovarni ochadi. Yorliqni eski raqam bilan qayta chiqarish
 * aynan o'sha yolg'onni qayta chop etish bo'lardi — ega ishni
 * qilgandek bo'lardi, lekin hech narsa tuzalmasdi.
 *
 * ⚠ ALOHIDA FUNKSIYA VA BOG'LIQLIKSIZ: bu qoida sinaladigan narsa,
 * komponent ichida yashiringan bo'lsa uni sinov ushlay olmasdi.
 */
export function conflictLabelItems(rows) {
  return (Array.isArray(rows) ? rows : []).map((c) => ({
    name: c?.name,
    salePrice: c?.salePrice,
    barcode: c?.barcode,
    shortCode: c?.newCode == null || c?.newCode === "" ? null : String(c.newCode),
  }));
}
