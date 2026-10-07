/* ══════════════════════════════════════════════════════════════════════════
   XIZMAT HAQI — kassa hisobi serverniki bilan bir xil (R5)
   Ishga tushirish:  node test/service-charge.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { servicePercent, serviceCharge, ORDER_TYPES } = await import("../src/lib/ek-service-charge.js");

let pass = 0, fail = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${ok ? "" : `\n     olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`}`);
};
const MX = "10399001001000000";

console.log("\n── Sozlama ──");
eq(servicePercent({ percent: 10, mxik: MX }), 10, "foiz va MXIK — 10%");
eq(servicePercent({ percent: 10, mxik: null }), 0, "⚠ MXIKsiz — o'chiq (server ham rad etadi)");
eq(servicePercent({ percent: 10, mxik: "123" }), 0, "noto'g'ri MXIK — o'chiq");
eq(servicePercent({ percent: 0, mxik: MX }) + servicePercent({ percent: 60, mxik: MX }) + servicePercent(null), 0, "0, 50 dan ko'p, yo'q — o'chiq");

console.log("\n── Summa (serverdagi ServiceChargeTest bilan bir xil) ──");
eq(serviceCharge(105000, "DINE_IN", 10), 10500, "3 × 35 000, 10% → 10 500");
eq(serviceCharge(35000, "DINE_IN", 7.5), 2625, "7,5% → 2 625");
eq(serviceCharge(33333, "DINE_IN", 10), 3333, "3 333,3 → 3 333 (pastga)");
eq(serviceCharge(35000, "TAKEAWAY", 10), 0, "olib ketish — yo'q");
eq(serviceCharge(35000, "DELIVERY", 10), 0, "yetkazish — yo'q");
eq(serviceCharge(35000, null, 10), 0, "restoran bo'lmagan do'kon — yo'q");
eq(serviceCharge(-5, "DINE_IN", 10), 0, "manfiy asos — 0");
eq(ORDER_TYPES, ["DINE_IN", "TAKEAWAY", "DELIVERY"], "server enum'i bilan bir xil tartib");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
