/* ══════════════════════════════════════════════════════════════════════════
   SOTUVLAR TARIXI — HAR CHEK UCHUN HISOB (V97)

   ═══ NEGA ALOHIDA FAYL ═════════════════════════════════════════════════

   Bu sof hisob va uni JSX ichida yozib bo'lmaydi: uch joy bir xil
   raqamni talab qiladi — jadval qatori, Excel eksporti va yuqoridagi
   KPI paneli. Uchtasida alohida hisoblansa, ular bir kuni bir-biridan
   ajralib ketardi va ekranda bir raqam, eksportda boshqasi turardi.

   ⚠ SERVER QAYTA HISOBLAMAYDI. Hamma narsa `SaleResponse` da
   allaqachon bor: `discountAmount`, `payments` (qismlar) va
   `items[].returnedQuantity`. Yangi so'rov qo'shish sahifani
   sekinlashtirar va ikkinchi haqiqat manbaini yaratardi.
   ══════════════════════════════════════════════════════════════════════════ */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Chekning NASIYAGA ketgan qismi.
 *
 * ⚠ `payments` DAN, `status` dan EMAS. Status «bu savdo qanday
 * bo'lgan» ni aytadi va u KEYIN O'ZGARMAYDI (`SaleStatus.CREDIT`
 * izohi) — qarz to'langanidan keyin ham chek `CREDIT` bo'lib qoladi.
 * Qismlardagi `CREDIT` esa AYNAN shu chekda qancha qarzga
 * yozilganini beradi.
 */
export function creditOf(sale) {
  return (sale?.payments || [])
    .filter((p) => p.type === "CREDIT")
    .reduce((s, p) => s + num(p.amount), 0);
}

/** Chek yopilgan paytda HAQIQATAN kelgan pul. */
export function paidOf(sale) {
  return num(sale?.totalAmount) - creditOf(sale);
}

/**
 * Chek qaytarilganmi: `"none"` | `"partial"` | `"full"`.
 *
 * ⚠ QATORLAR BO'YICHA, alohida bayroq bo'yicha EMAS. Bayroq
 * saqlansa, u qaytarish qatorlari bilan bir kuni kelishmay qolardi;
 * `returnedQuantity` esa qaytarishning O'ZI yozadigan raqam.
 *
 * ⚠ Miqdorlar KASRLI bo'lishi mumkin (2.350 kg), shuning uchun
 * taqqoslash butun songa emas, kichik dopuskka tayanadi.
 */
export function returnState(sale) {
  const items = sale?.items || [];
  if (!items.length) return "none";
  let sold = 0, back = 0;
  for (const it of items) {
    sold += num(it.quantity);
    back += num(it.returnedQuantity);
  }
  if (back <= 0.0001) return "none";
  return back >= sold - 0.0001 ? "full" : "partial";
}

/** Jadval, eksport va KPI uchun bitta qatorning hamma raqami. */
export function saleRow(sale) {
  return {
    credit: creditOf(sale),
    paid: paidOf(sale),
    discount: num(sale?.discountAmount),
    returned: returnState(sale),
  };
}

/**
 * KPI paneli uchun jamlama.
 *
 * ⚠ QAYTARISH CHEKLARI SUMMASI MANFIY (`Sale.totalAmount` manfiy) —
 * `PaymentSplitter` dagi bilan bir xil qoida. Shuning uchun ular
 * ayirilmaydi, QO'SHILADI va o'zi kamaytiradi. Ikki marta ayirish
 * eng oson qilinadigan xato bo'lardi.
 */
export function salesTotals(sales) {
  const out = {
    sales: 0,      // sotuv cheklari summasi (qaytarishsiz)
    returns: 0,    // qaytarilgan summa — MUSBAT ko'rsatiladi
    net: 0,        // sof: sotuv − qaytarish
    credit: 0,     // shu cheklardan qarzga ketgani
    paid: 0,       // shu cheklarda haqiqatan kelgan pul
    discount: 0,
    count: 0,      // sotuv cheklari soni
    returnCount: 0,
  };
  for (const s of sales || []) {
    /* Bekor qilingan chek hech qayerda sanalmaydi: undan na pul
       kelgan, na tovar chiqqan. */
    if (s?.status === "CANCELLED") continue;
    const total = num(s?.totalAmount);
    if (s?.type === "RETURN" || total < 0) {
      out.returns += Math.abs(total);
      out.returnCount += 1;
    } else {
      out.sales += total;
      out.count += 1;
      out.credit += creditOf(s);
      out.paid += paidOf(s);
      out.discount += num(s?.discountAmount);
    }
  }
  out.net = out.sales - out.returns;
  return out;
}
