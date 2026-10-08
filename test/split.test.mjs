/* ══════════════════════════════════════════════════════════════════════════
   TENG BO'LISH VA CHOY PULI — `src/lib/ek-split.js`

   ⚠ ENG MUHIMI: ulushlar yig'indisi chek jamisiga AYNAN teng.

   Ishga tushirish:  node test/split.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const S = await import("../src/lib/ek-split.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };
const sum = (a) => a.reduce((x, y) => x + y, 0);

console.log("\n── Teng bo'lish ──");
ok(S.splitEven(100000, 4).join() === "25000,25000,25000,25000", "100 000 / 4");
{
  const a = S.splitEven(100000, 3);
  ok(a.join() === "33333,33333,33334" && sum(a) === 100000, "⚠ qoldiq oxirgisiga, yig'indi aynan 100 000");
}
ok(S.splitEven(70000, 0).join() === "70000" && S.splitEven(70000, -2).length === 1, "noto'g'ri N — bitta ulush");
ok(sum(S.splitEven(123457, 7)) === 123457, "har qanday N da yig'indi to'g'ri");

console.log("\n── Choy puli ──");
ok(S.tipOf(73500, 10) === 7000, "10% → 1 000 ga yaxlit (7 350 → 7 000)");
ok(S.tipOf(70000, 5) === 4000, "5% → 3 500 → 4 000");
ok(S.tipOf(0, 10) === 0 && S.tipOf(50000, 0) === 0, "nol");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
