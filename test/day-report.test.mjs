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

console.log("\n── Davr (2026-10-11) ──");
{
  const T = "2026-10-11";                                    // yakshanba
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(D.periodDays("today", T), { from: T, to: T }), "bugun");
  ok(eq(D.periodDays("yesterday", T), { from: "2026-10-10", to: "2026-10-10" }), "kecha");
  ok(eq(D.periodDays("week", T), { from: "2026-10-05", to: T }), "⚠ hafta dushanbadan (yakshanba — haftaning oxiri)");
  ok(eq(D.periodDays("lastWeek", T), { from: "2026-09-28", to: "2026-10-04" }), "o'tgan hafta");
  ok(eq(D.periodDays("month", T), { from: "2026-10-01", to: T }), "shu oy");
  ok(eq(D.periodDays("lastMonth", T), { from: "2026-09-01", to: "2026-09-30" }), "o'tgan oy — 30 kun");
  ok(eq(D.periodDays("lastMonth", "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" }), "fevral — 28 kun");
  ok(eq(D.periodDays("quarter", T), { from: "2026-10-01", to: T }), "chorak");
  ok(eq(D.periodDays("year", T), { from: "2026-01-01", to: T }), "shu yil");
  ok(eq(D.periodDays("lastYear", T), { from: "2025-01-01", to: "2025-12-31" }), "o'tgan yil");
  ok(eq(D.periodDays("custom", T, { from: "2026-10-09", to: "2026-10-01" }), { from: "2026-10-01", to: "2026-10-09" }), "teskari oraliq — almashtiriladi");
  ok(eq(D.periodDays("custom", T, { from: "", to: "" }), { from: T, to: T }), "bo'sh — bugun");
  ok(D.daysBetween("2026-10-01", "2026-10-11") === 11, "11 kun");
  const rows = [{ name: "a", soldMoney: 5, sold: 1, tracksStock: true, closing: 2 },
                { name: "b", soldMoney: 0, sold: 0, tracksStock: true, closing: 10, salePrice: 100 },
                { name: "c", soldMoney: 9, sold: 3, tracksStock: false }];
  ok(D.topBy(rows, (r) => r.soldMoney).map((r) => r.name).join() === "c,a", "eng ko'p sotilgan; nolinchi tashlandi");
  ok(D.idleRows(rows).map((r) => r.name).join() === "b", "sotilmay yotgan — qoldig'i bor, sotilmagan");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
