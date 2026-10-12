/* ══════════════════════════════════════════════════════════════════════════
   BITTA SOTUV VAQTI (C4, 2026-10-12, V165)

   `docs/00-OVERVIEW.md` mezoni: «bitta sotuv (3 ta tovar) < 12 s». Ilgari uni
   odam sekundomer bilan o'lchashi kerak edi; endi kassa o'zi yozadi —
   savatga BIRINCHI tovar tushgan paytdan sotuv yuborilgunigacha — va bosh
   admin panelida platforma bo'yicha mediana ko'rinadi.

   ⚠ Savat bo'shdan to'laga o'tganda boshlanadi, bo'shaganda o'chadi
   (`KassaPage.setCart`). Stol buyurtmasi boshqa yo'ldan yuklanadi va
   boshlanish vaqti bo'lmaydi — restoranda hisob soatlab ochiq turadi, bu
   sotuv tezligi emas.
   ⚠ 30 daqiqadan uzuni yuborilmaydi (savat kutib turgan; server ham rad
   etadi). Sotuv O'ZI har holda o'tadi — bu faqat o'lchov.
   ══════════════════════════════════════════════════════════════════════════ */

export const MAX_MS = 30 * 60 * 1000;

/** Savat elementlari o'zgarganda — yangi boshlanish vaqti. */
export function nextStartedAt(prevItems, nextItems, prevStartedAt, now = Date.now()) {
  if (!nextItems?.length) return undefined;
  if (prevItems?.length && prevStartedAt) return prevStartedAt;
  return now;
}

/** Sotuv payload'iga: ms yoki `null` (o'lchanmagan). */
export function durationOf(startedAt, { tableOrderId } = {}, now = Date.now()) {
  if (!startedAt || tableOrderId) return null;
  const d = Math.round(now - startedAt);
  return d > 0 && d <= MAX_MS ? d : null;
}
