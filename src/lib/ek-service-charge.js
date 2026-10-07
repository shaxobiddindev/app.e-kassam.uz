/* ══════════════════════════════════════════════════════════════════════════
   BUYURTMA TURI VA XIZMAT HAQI — kassa hisobi (R5, V152, docs/22-RESTORAN.md)

   ⚠ SERVERNING NUSXASI (`SaleService`, «XIZMAT HAQI»): mijoz to'laydigan
   summa ikki tomonda bir xil chiqishi shart — aks holda to'lov rejasi
   («berilgan pul ≠ chek jamisi») serverda rad etiladi.
     · faqat ZALDA (`DINE_IN`), do'konda foiz va MXIK kodi bo'lsa;
     · asos — chegirma va balldan KEYINGI summa;
     · BUTUN SO'MGA PASTGA (ortiqcha yarim so'm mijozda).

   ⚠ SOF MANTIQ — Node'da sinaladi (`test/service-charge.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

export const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"];

/** Do'kon sozlamasidan amaldagi foiz; MXIK yo'q yoki foiz 0 — 0. */
export function servicePercent(cfg) {
  const pct = Number(cfg?.percent);
  if (!(pct > 0) || pct > 50) return 0;
  return /^\d{17}$/.test(String(cfg?.mxik || "")) ? pct : 0;
}

/** Xizmat haqi summasi (butun so'm, pastga). */
export function serviceCharge(base, orderType, pct) {
  if (orderType !== "DINE_IN" || !(pct > 0)) return 0;
  const b = Math.max(0, Number(base) || 0);
  /* ⚠ Avval ko'paytirib, keyin bo'linadi va mayda xato yeyiladi:
     105 000 × 10 / 100 suzuvchi nuqtada 10 499,999… bo'lib qolmasin. */
  return Math.floor((b * pct) / 100 + 1e-7);
}
