/* ══════════════════════════════════════════════════════════════════════════
   KUNLIK HISOBOT — `src/lib/ek-day-report.js`

   ⚠ ENG MUHIMI: kun Toshkent bo'yicha — kassa soati boshqa mintaqada
   bo'lsa ham xulosa va jadval bitta kunni ko'rsatadi.

   Ishga tushirish:  node test/day-report.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const D = await import("../src/lib/ek-day-report.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Kun ──");
ok(D.todayIso(Date.parse("2026-10-08T20:30:00Z")) === "2026-10-09", "⚠ UTC 20:30 — Toshkentda allaqachon ertangi kun");
ok(D.todayIso(Date.parse("2026-10-09T18:59:00Z")) === "2026-10-09", "UTC 18:59 — hali bugun");
ok(D.shiftDay("2026-10-01", -1) === "2026-09-30" && D.shiftDay("2026-12-31", 1) === "2027-01-01", "oy va yil chegarasi");
{
  const b = D.dayBounds("2026-10-09");
  ok(b.from === "2026-10-08T19:00:00.000Z" && b.to === "2026-10-09T19:00:00.000Z", "chegara — Toshkent yarim tuni");
}

console.log("\n── Jadval ──");
{
  const rows = [{ sold: 2, returned: 0 }, { sold: 0, returned: 1 }, { sold: 0, returned: 0, received: 5 }];
  ok(D.rowFilter(rows, "moved").length === 3, "harakat bo'lganlar — hammasi");
  ok(D.rowFilter(rows, "sold").length === 2, "faqat sotilgan yoki qaytarilgan");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
