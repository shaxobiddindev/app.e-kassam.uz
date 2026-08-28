/* ══════════════════════════════════════════════════════════════════════════
   CHEK CHEGIRMASINI QATORLARGA TAQSIMLASH

   ⚠⚠ SERVERDAGI QOIDANING AYNAN NUSXASI (`SaleService.distributeSaleDiscount`).
   Kassir to'lov oynasida «bu chegirma qaysi tovarga qanchadan tushadi?»
   degan javobni ko'radi, keyin esa AYNAN o'sha raqamlar chekda va
   hisobotda turishi kerak. Ikki joyda ikki xil yaxlitlash bo'lsa, mijoz
   chekni ko'rib «siz boshqa aytdingiz» derdi.

   Qoida: ulush = chegirma × qator jami / hammasining jami, ikki xonagacha
   PASTGA yaxlitlanadi; yaxlitlashdan qolgan tiyin esa ENG KATTA qatorga
   qo'shiladi (u yerda u eng kam seziladi).
   ══════════════════════════════════════════════════════════════════════════ */

/** Bitta qatorning o'z chegirmasidan keyingi jami. */
export const lineNet = (l) =>
  Math.max(0, (Number(l.salePrice) || 0) * (Number(l.qty) || 0) - (Number(l.discount) || 0));

/**
 * @param lines  `{ salePrice, qty, discount? }` ro'yxati
 * @param total  chek bo'yicha chegirma (so'm)
 * @returns har qatorga tushgan ulush (`lines` bilan bir tartibda)
 */
export function spreadDiscount(lines, total) {
  const d = Number(total) || 0;
  const out = lines.map(() => 0);
  if (d <= 0 || !lines.length) return out;

  const nets = lines.map(lineNet);
  const base = nets.reduce((s, n) => s + n, 0);
  if (base <= 0) return out;

  let given = 0;
  let biggest = 0;
  for (let i = 0; i < lines.length; i++) {
    /* ⚠ PASTGA yaxlitlash (`floor`), yumaloqlash emas — serverda ham
       `RoundingMode.DOWN`. Aks holda ulushlar yig'indisi chegirmadan
       oshib ketishi mumkin edi. */
    const share = Math.floor((d * nets[i]) / base * 100) / 100;
    out[i] = share;
    given += share;
    if (nets[i] > nets[biggest]) biggest = i;
  }
  const rest = Math.round((d - given) * 100) / 100;
  if (rest !== 0) out[biggest] = Math.round((out[biggest] + rest) * 100) / 100;
  return out;
}
