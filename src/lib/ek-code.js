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

