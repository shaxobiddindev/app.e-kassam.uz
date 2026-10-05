/* ══════════════════════════════════════════════════════════════════════════
   SESSIYANI TOZALASH — KOMPYUTER SOZLAMALARI QOLADI (2026-10-04)

   Egasi: «har safar ilova yangilanganda stiker chiqarishni qayta sozlash
   kerak bo'lyapti».

   ⚠ SABABI. Sessiya tiklanmasa (refresh rad etildi, token yo'q) ikki joy
   `localStorage.clear()` qilardi: `api/index.js` (`forceLogout`) va
   `App.jsx` (tokensiz ochilish). `clear()` esa sessiyani emas, BUTUN
   xotirani o'chiradi — shu jumladan shu KOMPYUTERGA tegishli narsalarni:
   chek va stiker printerining nomi, tarozi porti, ekran kalibrovkasi.
   Yangilanishdan keyin ilova qayta ochilganda sessiya qayta tiklanadi va
   aynan shu yo'lga tushadi. Server sozlamasi (qog'oz, printer turi)
   joyida qolardi, printer nomi esa yo'qolib, stiker ekrani butun sozlashni
   qaytadan ochardi.

   ⚠ RO'YXAT — «OQ RO'YXAT», «QORA» EMAS. Saqlanadigan kalitlar aniq
   sanaladi; qolgan hammasi o'chadi. Teskarisi (faqat sessiya kalitlarini
   o'chirish) yangi qo'shilgan sessiya kalitini keyingi xodimga qoldirib
   ketardi — umumiy kompyuterda bu boshqa odamning ma'lumoti.
   Bu yerga FAQAT shu kompyuter yoki ekranga tegishli narsa kiradi:
   do'kon, xodim yoki savatga tegishli narsa (tovar sevimlilari, chek
   sarlavhasi, savat) KIRMAYDI — keyingi kirgan boshqa do'kon bo'lishi mumkin.
   ══════════════════════════════════════════════════════════════════════════ */

export const DEVICE_KEYS = [
  "ek_hw",              // chek/stiker printeri, tarozi, ovoz, pul qutisi (ek-hw-settings)
  "ek_display",         // xaridor ekrani (ek-display)
  "ek_scale_port",      // tarozi porti (ek-scale-live)
  "ek.screen.pxPerMm",  // ekran kalibrovkasi (ek-screen-calibration)
  "ek_theme",           // yorug'/qorong'i
  "ek_zoom",            // desktop sahifa masshtabi (ek-zoom)
  "ek_touchMode",       // sensorli rejim
  "ek_lang",            // til — brauzerga tegishli
  "ek_forceMobile",     // ishlab chiqish bayrog'i
  "sb_collapsed",       // yon menyu yig'ilgan
  "ek_kassaRightW",     // kassa o'ng paneli eni
  "ek_kassaView",       // kassa ko'rinishi (katak/ro'yxat)
  "ek_lbl_last_tpl",    // oxirgi stiker dizayni (topilmasa o'zi boshqasini tanlaydi)
  "ek_lbl_mode",        // yorliqlar: oddiy/kengaytirilgan
  "ek_simple_kind",     // yorliqlar: stiker/narx yorlig'i
];

/**
 * Sessiyani tozalaydi, `DEVICE_KEYS` va `keep` dagi kalitlarni saqlab qoladi.
 * ⚠ `localStorage.clear()` ni to'g'ridan-to'g'ri chaqirmang — shu funksiya
 * (`test/session-keep.test.mjs` buni tekshiradi).
 */
export function clearSession(keep = []) {
  const saved = [];
  for (const k of [...DEVICE_KEYS, ...keep]) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) saved.push([k, v]);
    } catch { /* yopiq xotira */ }
  }
  try { localStorage.clear(); } catch { /* yopiq xotira */ }
  for (const [k, v] of saved) {
    try { localStorage.setItem(k, v); } catch { /* to'la xotira */ }
  }
}
