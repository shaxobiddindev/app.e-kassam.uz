/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN BUYURTMALARI — `src/lib/ek-restaurant-orders.js`

   Ishga tushirish:  node test/restaurant-orders.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const O = await import("../src/lib/ek-restaurant-orders.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Filtrlar ──");
const R = [
  { kind: "TABLE", status: "OPEN" }, { kind: "TABLE", status: "BILL" }, { kind: "TABLE", status: "PAID" },
  { kind: "TABLE", status: "CANCELLED" }, { kind: "AWAY", status: "TAKEAWAY" },
];
const c = O.countBy(R);
ok(c.all === 5 && c.open === 2 && c.paid === 1 && c.away === 1 && c.void === 1, "⚠ «Ochiq» ichida hisob berilgani ham");

console.log("\n── Kurslar ──");
const g = O.byCourse([{ name: "Osh", course: 2 }, { name: "Non", course: null }, { name: "Choy", course: 1 }]);
ok(g.map((x) => x.course).join() === "1,2,", "1, 2, keyin kurssiz");
ok(O.byCourse([{ name: "Osh" }, { name: "Choy" }]).length === 1 && O.byCourse([{ name: "Osh" }])[0].course === undefined, "hammasi kurssiz — bitta guruh, sarlavhasiz");
ok(O.byCourse([]).length === 0, "bo'sh");

console.log("\n── Davomiylik ──");
ok(O.durationMin([{ at: "2026-10-10T12:00:00Z" }, { at: "2026-10-10T12:58:00Z" }]) === 58, "58 daqiqa");
ok(O.durationMin([{ at: "2026-10-10T12:00:00Z" }]) === null, "bitta voqea — davomiylik yo'q");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
