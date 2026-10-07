/* ══════════════════════════════════════════════════════════════════════════
   TEXNOLOGIK KARTA — ekrandagi hisob (R3, V150)

   ⚠ Bu faqat KO'RSATISH: sotuvdagi haqiqiy tannarx serverda, masalliq
   partiyasining tannarxidan (FEFO). Bu yerdagi son — kartochkadagi joriy
   tannarxdan, egasi retsept yozayotganda «osh menga qanchaga tushadi?»
   degan savolga darhol javob olsin.
   ══════════════════════════════════════════════════════════════════════════ */

/** Masalliq bo'la oladimi: omborda turadigan tovar (xizmat va taom emas). */
export const isIngredient = (p) => !!p && (p.type == null || p.type === "GOODS") && p.active !== false;

/** Retseptning joriy tannarxi (1 porsiya). Narxi yo'q masalliq hisobga kirmaydi. */
export function recipeCost(lines) {
  let sum = 0;
  for (const l of lines || []) {
    const c = Number(l?.costPrice);
    const q = Number(l?.quantity);
    if (Number.isFinite(c) && Number.isFinite(q) && q > 0) sum += c * q;
  }
  return Math.round(sum * 100) / 100;
}

/** Serverga: bo'sh va nol miqdorli qatorlar tashlanadi. */
export function toRequest(lines) {
  return (lines || [])
    .filter((l) => l?.ingredientId != null && Number(l.quantity) > 0)
    .map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) }));
}
