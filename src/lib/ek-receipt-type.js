/* ══════════════════════════════════════════════════════════════════════════
   CHEK TURI: FISKAL BELGI CHIQADIMI (V85)

   ⚠ NEGA ALOHIDA, ENG KICHIK MODUL. Bu qoida `ek-hardware.js` ichida
   ham yashashi mumkin edi, lekin o'sha fayl brauzer modullariga
   (`ek-desktop`, `ek-escpos`) bog'langan va uni Node'dan YUKLAB
   BO'LMAYDI. Ya'ni qoida sinovsiz qolardi — 943-son qarorning eng
   aniq talablaridan biri esa aynan shu.

   Bu yerda hech qanday import yo'q va bo'lmaydi ham.

   ⚠ SERVERDAGI `SaleType.isFiscalDocument()` NING JUFTI. Ikkalasi bir
   xil bo'lishi shart va birga o'zgaradi. Takrorlanishi ataylab: chek
   qayta chop etilganda yoki oflaynda server javobi umuman bo'lmaydi
   va front mustaqil ravishda ham to'g'ri ishlashi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Fiskal belgi va QR CHIQADIGAN chek turlari.
 *
 * ⚠ `ADVANCE` (bo'nak), `INSTALLMENT` (bo'lib to'lash) va `CREDIT` bu
 * ro'yxatda YO'Q va bo'lmaydi ham: 943-son qaror bunday chekda fiskal
 * belgi va QR chiqmasligini talab qiladi. Bo'nakda tovar hali
 * berilmagan, bo'lib to'lashda esa sotuv allaqachon boshqa chekda
 * qayd etilgan — «soliqqa qayd etildi» degan belgi ikkalasida ham
 * yolg'on bo'lardi.
 */
export const FISCAL_RECEIPT_TYPES = new Set(["SALE", "RETURN", "CORRECTION"]);

/** Shu turdagi chekda fiskal belgi chiqadimi. */
export function isFiscalReceipt(saleType) {
  return FISCAL_RECEIPT_TYPES.has(saleType || "SALE");
}
