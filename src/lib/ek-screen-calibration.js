/**
 * ══════════════════════════════════════════════════════════════════════════
 * EKRAN KALIBRLASH — «100% O'LCHAM» HAQIQATAN 100% BO'LSIN (F3)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CSS `mm` BIRLIGI EKRANDA YOLG'ON. Brauzer 1 CSS dyuymni har doim
 * 96 CSS pikselga tenglashtiradi — monitorning HAQIQIY zichligidan
 * qat'i nazar. 24" FullHD da bu ~92 dpi, 27" 4K da ~163 dpi. Ya'ni
 * «70 mm» deb chizilgan yorliq ekranda 60 mm ham, 90 mm ham bo'lishi
 * mumkin.
 *
 * <p>Chop etishda bu muammo YO'Q: u yerda mm haqiqiy mm. Muammo faqat
 * ko'rish oynasida — va aynan o'sha yerda do'konchi «bu yorliq
 * javonimga sig'adimi?» degan qarorni qabul qiladi.
 *
 * ═══ YECHIM: BANK KARTASI ═══
 *
 * Har kimda bor va o'lchami butun dunyoda bir xil: ISO/IEC 7810 ID-1
 * — 85,60 x 53,98 mm. Foydalanuvchi kartani ekranga qo'yib chiziqni
 * moslaydi; shundan px/mm chiqadi.
 *
 * ⚠ NEGA SLAYDER, «dpi kiriting» EMAS: monitorining dpi sini bilgan
 * do'konchi yo'q. Kartani qo'yish esa hamma bajara oladigan ish.
 */
const KEY = "ek.screen.pxPerMm";

/** Kalibrlanmagan ekran uchun taxmin: 96 dpi → 96/25,4 px/mm. */
export const DEFAULT_PX_PER_MM = 96 / 25.4;

/** ISO/IEC 7810 ID-1 — bank kartasining kengligi (mm). */
export const CARD_WIDTH_MM = 85.6;

/**
 * Saqlangan qiymat yoki standart.
 *
 * ⚠ Xato qiymat (0, manfiy, matn) STANDARTGA tushadi: buzuq
 * `localStorage` tufayli ko'rish oynasi umuman ochilmay qolishi
 * mumkin emas.
 */
export function pxPerMm() {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (Number.isFinite(v) && v > 1 && v < 40) return v;
  } catch { /* shaxsiy rejim yoki bloklangan xotira — standart bilan davom etamiz */ }
  return DEFAULT_PX_PER_MM;
}

/** Kalibrlangan bo'lsa `true` — ko'rish oynasi buni aytib turadi. */
export function isCalibrated() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 1 && v < 40;
  } catch { return false; }
}

/** Karta kengligi piksellarda → px/mm. */
export function saveFromCardWidth(px) {
  const v = Number(px) / CARD_WIDTH_MM;
  if (!Number.isFinite(v) || v <= 1 || v >= 40) return false;
  try { localStorage.setItem(KEY, String(v)); return true; } catch { return false; }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* bloklangan xotira */ }
}

/** mm → ekran piksellari (joriy kalibrlash bilan). */
export const mmToPx = (mm, scale = 1) => Number(mm) * pxPerMm() * scale;
