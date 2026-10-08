/* ══════════════════════════════════════════════════════════════════════════
   TENG BO'LISH VA CHOY PULI — sof hisoblar (restoran, 2026-10-09)

   TENG BO'LISH — BITTA fiskal chek, to'lov N ta ulushda. Ilgari «hisobni
   N ga bo'lish» qilinmagan edi: alohida cheklarga bo'lsa, fiskal chekda
   taom kasr miqdor bilan chiqishi kerak bo'lardi (0,25 osh). Endi chek
   bitta, faqat pul qismlarga bo'linadi — har mehmon naqd yoki karta bilan
   o'z ulushini beradi.

   CHOY PULI — chek jamisiga ham, soliqqa ham kirmaydi (V160).

   Bu fayl DOM bilmaydi — node'da sinaladi (`test/split.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Jamini N ta teng ulushga bo'ladi, butun so'mda.
 *
 * ⚠ Qoldiq OXIRGI ulushga: yig'indi chek jamisiga AYNAN teng bo'lishi
 * shart, aks holda to'lov «yetmaydi» yoki «ortiqcha» bo'lib qolardi.
 */
export function splitEven(total, n) {
  const sum = Math.max(0, Math.round(Number(total) || 0));
  const k = Math.max(1, Math.min(50, Math.floor(Number(n) || 1)));
  const base = Math.floor(sum / k);
  return Array.from({ length: k }, (_, i) => (i === k - 1 ? sum - base * (k - 1) : base));
}

/**
 * Foizdan choy puli — 1 000 so'mga yaxlitlab (mijoz «10%» deydi, kassir
 * esa 7 350 emas, 7 000 oladi). Nol yoki manfiy — 0.
 */
export function tipOf(total, pct) {
  const v = (Math.max(0, Number(total) || 0) * (Number(pct) || 0)) / 100;
  return Math.round(v / 1000) * 1000;
}
