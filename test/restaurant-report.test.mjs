/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN HISOBOTI — `src/lib/ek-restaurant-report.js`

   Ishga tushirish:  node test/restaurant-report.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const R = await import("../src/lib/ek-restaurant-report.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Manbalar ──");
const s = R.sourceShares([{ kind: "HALL", revenue: 118 }, { kind: "TAKEAWAY", revenue: 29.6 }, { kind: "DELIVERY", revenue: 16.4 }, { kind: "TILL", revenue: 0 }]);
ok(s.length === 3, "nol manba tashlanadi");
ok(s.reduce((a, x) => a + x.share, 0) === 100, "⚠ ulushlar yig'indisi aynan 100");
ok(s[0].share === 72, "zal 72%");
ok(R.sourceShares([]).length === 0, "bo'sh");

console.log("\n── O'sish ──");
ok(R.growth(109, 100) === 9, "▲ 9%");
ok(R.growth(50, 0) === null, "oldingi davr yo'q — solishtirilmaydi");

console.log("\n── Bandlik jadvali ──");
const g = R.heatGrid([{ dow: 5, hour: 13, occupancy: 88 }, { dow: 6, hour: 1, occupancy: 20 }]);
ok(g.rows.length === 7, "7 kun");
ok(g.hours[0] === 1 && g.hours[g.hours.length - 1] === 23, "⚠ tungi soat (01:00) — oyna kengayadi");
ok(g.rows[4].cells[g.hours.indexOf(13)] === 88, "juma 13:00 — 88%");
ok(g.rows[0].cells.every((v) => v === 0), "ma'lumotsiz kun — 0");

console.log("\n── ABC xulosasi ──");
const a = R.abcSummary([{ group: "A", revenue: 80 }, { group: "A", revenue: 5 }, { group: "C", revenue: 1 }]);
ok(a.A.n === 2 && a.A.revenue === 85 && a.B.n === 0 && a.C.n === 1, "guruh bo'yicha soni va tushumi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
