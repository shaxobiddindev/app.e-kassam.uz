/* ══════════════════════════════════════════════════════════════════════════
   SOTUVLAR TARIXI — HAR CHEK UCHUN HISOB (V97)

   ⚠ NEGA SINOV KERAK. Bu hisob UCH JOYDA ishlatiladi: jadval qatori,
   Excel eksporti va yuqoridagi KPI paneli. Xato bo'lsa u uchalasiga
   BIR XIL tarqalardi — ya'ni ekranga qarab topib bo'lmasdi: uchtasi
   ham bir xil noto'g'ri raqamni ko'rsatib turardi va hammasi
   «kelishgan» bo'lib tuyulardi.

   Ishga tushirish:  node test/sales-row.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { saleRow, salesTotals, creditOf, paidOf, returnState } =
  await import("../src/lib/ek-sales-row.js");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log(`  ❌ ${msg}\n     kutildi: ${JSON.stringify(want)}\n     olindi:  ${JSON.stringify(got)}`); }
};

const sale = (o) => ({ status: "PAID", items: [], payments: [], ...o });

console.log("\n── QARZ QISMI ──");
{
  eq(creditOf(sale({ payments: [{ type: "CASH", amount: 60000 },
                                 { type: "CREDIT", amount: 40000 }] })), 40000,
     "nasiya qismi qismlardan olinadi");
  eq(creditOf(sale({ payments: [] })), 0, "qismlarsiz chekda qarz nol");
  eq(creditOf(sale({ payments: null })), 0, "`payments` null bo'lsa ham yiqilmaydi");

  /* ⚠⚠ ENG MUHIM BAND. `status` «bu savdo qanday bo'lgan» ni aytadi va
     u KEYIN O'ZGARMAYDI: qarz to'langanidan keyin ham chek `CREDIT`
     bo'lib qoladi (`SaleStatus.CREDIT` izohi). Agar qarz statusdan
     olinsa, to'langan qarz ham «qarzda» bo'lib ko'rinar va KPI
     mijozlar allaqachon to'lagan pulni qarz deb sanardi. */
  eq(creditOf(sale({ status: "CREDIT", payments: [{ type: "CASH", amount: 100000 }] })), 0,
     "⚠ status CREDIT, lekin qismlarda nasiya yo'q — qarz NOL");
}

console.log("\n── TO'LANGAN ──");
{
  eq(paidOf(sale({ totalAmount: 100000,
                   payments: [{ type: "CASH", amount: 60000 },
                              { type: "CREDIT", amount: 40000 }] })), 60000,
     "to'langan = jami − qarz");
  eq(paidOf(sale({ totalAmount: 100000 })), 100000, "qarzsiz chekda hammasi to'langan");
}

console.log("\n── QAYTARILGANLIK ──");
{
  eq(returnState(sale({ items: [{ quantity: 2, returnedQuantity: 0 }] })), "none",
     "qaytarilmagan");
  eq(returnState(sale({ items: [{ quantity: 2, returnedQuantity: 1 }] })), "partial",
     "qisman qaytarilgan");
  eq(returnState(sale({ items: [{ quantity: 2, returnedQuantity: 2 }] })), "full",
     "to'liq qaytarilgan");
  eq(returnState(sale({ items: [{ quantity: 2, returnedQuantity: 2 },
                                { quantity: 1, returnedQuantity: 0 }] })), "partial",
     "bir qator qaytgan, ikkinchisi yo'q — qisman");
  eq(returnState(sale({ items: [] })), "none", "qatorsiz chek");

  /* ⚠ MIQDOR KASRLI bo'lishi mumkin (2.350 kg). Suzuvchi nuqta
     arifmetikasida 0.1+0.2 ≠ 0.3, shuning uchun taqqoslash kichik
     dopusk bilan. Usiz to'liq qaytarilgan kilogrammli chek
     «qisman» bo'lib qolardi. */
  eq(returnState(sale({ items: [{ quantity: 0.3, returnedQuantity: 0.1 + 0.2 }] })), "full",
     "⚠ kasrli miqdor to'liq qaytarilgan deb sanaladi");
}

console.log("\n── JAMLAMA (KPI) ──");
{
  const list = [
    sale({ totalAmount: 100000, discountAmount: 5000,
           payments: [{ type: "CASH", amount: 60000 }, { type: "CREDIT", amount: 40000 }] }),
    sale({ totalAmount: 50000, payments: [{ type: "CARD", amount: 50000 }] }),
    /* ⚠ QAYTARISH SUMMASI MANFIY (`Sale.totalAmount` manfiy) —
       `PaymentSplitter` dagi bilan bir xil qoida. */
    sale({ type: "RETURN", totalAmount: -20000 }),
  ];
  const k = salesTotals(list);
  eq(k.sales, 150000, "sotuv — faqat sotuv cheklari");
  eq(k.returns, 20000, "⚠ qaytaruv MUSBAT ko'rsatiladi");
  eq(k.net, 130000, "sof = sotuv − qaytaruv");
  eq(k.credit, 40000, "qarzga berilgani");
  eq(k.paid, 110000, "haqiqatan kelgan pul");
  eq(k.count, 2, "sotuv cheklari soni");
  eq(k.returnCount, 1, "qaytaruv cheklari soni");

  /* ⚠ BEKOR QILINGAN CHEK HECH QAYERDA SANALMAYDI: undan na pul
     kelgan, na tovar chiqqan. Sanalsa, kassir «bugun 2 mln sotdim»
     deb ko'rar, yashikda esa yo'q pul kutilardi. */
  const withCancelled = salesTotals([...list, sale({ status: "CANCELLED", totalAmount: 999999 })]);
  eq(withCancelled.sales, 150000, "⚠ bekor qilingan chek sotuvga qo'shilmaydi");
  eq(withCancelled.count, 2, "va sanoqqa ham");

  eq(salesTotals([]).net, 0, "bo'sh ro'yxat yiqitmaydi");
  eq(salesTotals(null).net, 0, "null ham");
}

console.log("\n── QATOR (jadval uchun) ──");
{
  eq(saleRow(sale({ totalAmount: 100000, discountAmount: 5000,
                    payments: [{ type: "CREDIT", amount: 40000 }],
                    items: [{ quantity: 1, returnedQuantity: 1 }] })),
     { credit: 40000, paid: 60000, discount: 5000, returned: "full" },
     "qator hamma raqamni beradi");
  eq(saleRow({}), { credit: 0, paid: 0, discount: 0, returned: "none" },
     "bo'sh obyekt ham yiqitmaydi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} sotuvlar tarixi: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
