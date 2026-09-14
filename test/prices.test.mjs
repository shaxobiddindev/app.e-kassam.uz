/* ══════════════════════════════════════════════════════════════════════════
   UCH NARX QOIDASI — sinov (V53).

   ⚠ NEGA MUHIM: bu modul SERVERDAGI qoidaning nusxasi
   (`common/util/Prices.java`). Ikkalasi bir xil javob berishi SHART —
   aks holda do'kon egasi «formada yashil edi, saqlaganda qizil chiqdi»
   degan holatga tushadi.

   Bu yerdagi holatlar serverdagi `PriceRulesTest` bilan JUFT: o'sha
   holatlar, o'sha kutilgan javoblar.

   Ishga tushirish:  node test/prices.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { checkPrices, marginPercent, markupPercent, recommendSale, VIOLATION } =
  await import("../src/lib/ek-prices.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));
const near = (a, e, m) => (a != null && Math.abs(a - e) < 0.01 ? ok(m) : bad(`${m} (kutilgan: ${e})`, a));

console.log("\n═══ 1. Tartib ═══");
eq(checkPrices(8000, 9000, 10000), null, "to'g'ri tartib — buzilish yo'q");
eq(checkPrices(8000, 7000, 10000), VIOLATION.WHOLESALE_BELOW_COST, "optom tannarxdan past");
eq(checkPrices(8000, 11000, 10000), VIOLATION.WHOLESALE_ABOVE_SALE, "optom sotuvdan baland");
eq(checkPrices(8000, null, 7000), VIOLATION.SALE_BELOW_COST, "sotuv tannarxdan past");
eq(checkPrices(9000, 9000, 9000), null, "uchalasi teng — qonuniy");

console.log("\n═══ 2. Bo'sh qiymatlar ═══");
eq(checkPrices(8000, "", 10000), null, "optom bo'sh — tekshirilmaydi");
eq(checkPrices(8000, 0, 10000), null, "optom 0 — «yo'q» degani, xato emas");
eq(checkPrices("", 9000, 10000), null, "tannarx hali yo'q — tekshirilmaydi");
eq(checkPrices(null, null, null), null, "hammasi bo'sh — xato emas");

console.log("\n═══ 3. Marja ═══");
near(marginPercent(8000, 10000), 20, "8000 → 10000 = 20% marja");
near(marginPercent(10000, 10000), 0, "tannarx = sotuv → 0%");
near(marginPercent(12000, 10000), -20, "zarariga → MANFIY marja, nolga qisilmaydi");
eq(marginPercent(8000, 0), null, "sotuv nol — hisoblanmaydi");

/* ══ USTAMA ═══════════════════════════════════════════════════════════
   ⚠ MARJA BILAN ADASHTIRILMASIN. Do'kon egasining savoli: «100 000 lik
   tovarni 120 000 ga sotdim — daromad 20% mi, 16,6% mi?». Ikkalasi ham
   to'g'ri, lekin boshqa savolga javob beradi va ular TESKARI
   QAYTARILMAYDI. Shu sinov ikkovini bir joyda qulflaydi. */
near(markupPercent(100000, 120000), 20, "100 000 → 120 000 = 20% ustama");
near(marginPercent(100000, 120000), 16.6667, "...o'sha tovarda marja esa 16,67%");

/* ⚠ 20% USTAMA ≠ 20% MARJA: 20% marja uchun 25% ustama kerak. */
near(markupPercent(8000, 10000), 25, "8000 → 10000 = 25% ustama (marja 20%)");
near(marginPercent(8000, 10000), 20, "...aynan shu narxda marja 20%");

near(markupPercent(10000, 10000), 0, "tannarx = sotuv → 0%");
near(markupPercent(10000, 8000), -20, "zarariga → MANFIY ustama");
/* ⚠ CHEKSIZ EMAS, `null`: tannarxsiz tovarda ustama TA'RIFLANMAGAN va
   ekranda «—» turishi kerak. Nolga bo'lish `Infinity` berardi va u
   ekranga «Infinity%» bo'lib chiqardi. */
eq(markupPercent(0, 10000), null, "tannarx nol — hisoblanmaydi");
eq(markupPercent(null, 10000), null, "tannarx yo'q — hisoblanmaydi");
eq(marginPercent("", 10000), null, "tannarx yo'q — hisoblanmaydi");

console.log("\n═══ 4. Marjani saqlaydigan tavsiya ═══");
eq(recommendSale(8000, 10000, 10000, null), 12500, "tannarx 8000→10000 da 25% marja 12500 da saqlanadi");
eq(recommendSale(8000, 10000, 9000, 500), 11500, "500 lik qadamda yaxlitlanadi");
eq(recommendSale(0, 10000, 9000, null), null, "eski tannarx nol — tavsiya yo'q");
eq(recommendSale(null, 10000, 9000, null), null, "eski tannarx yo'q — tavsiya yo'q");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} ta o'tdi, ${fail} ta yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
