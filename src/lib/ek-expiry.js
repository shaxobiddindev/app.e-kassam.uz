/* ══════════════════════════════════════════════════════════════════════════
   YAROQLILIK MUDDATI — umumiy hisob

   Ikki joyda kerak: ombor jadvali (qator rangi va filtri) va Sozlamalar
   (chegarani qo'yish). Ikkinchisisiz standart qiymat ikki faylda
   takrorlanardi va biri o'zgarganda ikkinchisi eskisicha qolardi.

   ⚠ Bu fayl ILOVA-LOKAL — `packages/ui` dan sync bo'lmaydi
   (`sync-tokens.ps1` faqat sanab o'tilgan fayllarni ko'chiradi).
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * «Muddati yaqin» oynasining STANDART qiymati, kunlarda.
 *
 * ⚠ Do'kon o'z qiymatini qo'yishi mumkin (V41, `shops.near_expiry_days`).
 * Ustun bo'sh bo'lsa — aynan shu raqam ishlaydi, ya'ni bo'sh ustun
 * «ogohlantirish o'chiq» degani EMAS.
 */
export const DEFAULT_NEAR_EXPIRY_DAYS = 7;

/**
 * Muddatgacha necha kun qolgani. Muddatsiz tovarda `null`.
 *
 * ⚠ Hisob SANA bo'yicha, soat bo'yicha emas. `expiryDate` — kun
 * (`YYYY-MM-DD`) va `new Date("2026-08-20")` uni UTC yarim tuni deb
 * o'qiydi; Toshkent (+5) da bu bugun tugaydigan tovarni «kecha tugagan»
 * qilib ko'rsatardi. Shuning uchun sana qismlarga bo'lib, MAHALLIY kun
 * sifatida quriladi.
 */
export function daysLeft(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}
