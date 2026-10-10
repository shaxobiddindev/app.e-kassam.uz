/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN «BUGUN» — `src/lib/ek-restaurant-today.js`

   Ishga tushirish:  node test/restaurant-today.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const R = await import("../src/lib/ek-restaurant-today.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

const day = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, occupancy: 0 }));

console.log("\n── Soatlar oynasi ──");
{
  const w = R.hourWindow(day);
  ok(w[0].hour === 10 && w[w.length - 1].hour === 22, "bo'sh kun — 10:00–22:00");
  const late = day.map((h) => (h.hour === 1 ? { ...h, revenue: 50000 } : h));
  const w2 = R.hourWindow(late);
  ok(w2[0].hour === 1 && w2[w2.length - 1].hour === 22, "⚠ tungi savdo (01:00) — oyna kengayadi");
  const busy = day.map((h) => (h.hour === 23 ? { ...h, occupancy: 40 } : h));
  ok(R.hourWindow(busy).slice(-1)[0].hour === 23, "kech bandlik ham oynaga kiradi");
}

console.log("\n── O'tgan hafta bilan ──");
ok(JSON.stringify(R.changeText(112, 100)) === JSON.stringify({ up: true, pct: 12 }), "▲ 12%");
ok(JSON.stringify(R.changeText(80, 100)) === JSON.stringify({ up: false, pct: 20 }), "▼ 20%");
ok(R.changeText(50, 0) === null, "o'tgan hafta yo'q — solishtirilmaydi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
