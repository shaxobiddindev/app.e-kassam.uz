/* ══════════════════════════════════════════════════════════════════════════
   DAVR CHEGARALARI (V69)

   Bu sinov borligining sababi — HAQIQIY xato: sutka boshi `Date.UTC`
   bilan olinardi va mahalliy 00:00–05:00 oralig'ida oraliq TESKARI
   bo'lib qolardi, hisobot esa bo'm-bo'sh chiqardi. Ekranda hech narsa
   buzilmasdi: raqamlar shunchaki nol edi.

   Shuning uchun bu yerda hamma chegara QO'LDA hisoblangan sana bilan
   solishtiriladi va «hozir» sifatida aniq lahza beriladi.
   ══════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import {
  periodRange, weekStart, isoDay, parseDate, growth, lengthDays,
} from "../src/lib/ek-period.js";

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};
const eqDay = (d, s) => assert.equal(isoDay(d), s);

/* Payshanba, 2026-09-03 14:30 (mahalliy). */
const NOW = new Date(2026, 8, 3, 14, 30, 0);

console.log("\n── Kunlar ──");
it("bugun — sutka boshidan ertangacha", () => {
  const r = periodRange("today", NOW);
  eqDay(r.from, "2026-09-03");
  eqDay(r.to,   "2026-09-04");
});
it("⚠ tunda ham to'g'ri: 02:00 da «bugun» hamon o'sha kun", () => {
  const night = new Date(2026, 8, 3, 2, 0, 0);
  const r = periodRange("today", night);
  eqDay(r.from, "2026-09-03");
  assert.ok(r.from < r.to, "oraliq TESKARI bo'lib qolmadi — eski xato aynan shu edi");
});
it("kecha — faqat o'sha kun", () => {
  const r = periodRange("yesterday", NOW);
  eqDay(r.from, "2026-09-02");
  eqDay(r.to,   "2026-09-03");
});

console.log("\n── Haftalar ──");
it("hafta boshi — DUSHANBA", () => eqDay(weekStart(NOW), "2026-08-31"));
it("⚠ YAKSHANBA kuni ham hafta o'sha dushanbadan boshlanadi", () => {
  // 2026-09-06 — yakshanba. `getDay()` da u 0 va oddiy ayirish
  // haftani KEYINGI dushanbadan boshlardi.
  const sunday = new Date(2026, 8, 6, 10, 0, 0);
  eqDay(weekStart(sunday), "2026-08-31");
});
it("shu hafta — dushanbadan bugungacha", () => {
  const r = periodRange("week", NOW);
  eqDay(r.from, "2026-08-31");
  eqDay(r.to,   "2026-09-04");
});
it("o'tgan hafta — oldingi dushanbadan shu dushanbagacha", () => {
  const r = periodRange("lastWeek", NOW);
  eqDay(r.from, "2026-08-24");
  eqDay(r.to,   "2026-08-31");
});

console.log("\n── Oy, chorak, yil ──");
it("shu oy", () => {
  const r = periodRange("month", NOW);
  eqDay(r.from, "2026-09-01");
  eqDay(r.to,   "2026-09-04");
});
it("o'tgan oy — TO'LIQ oy, bugungacha emas", () => {
  const r = periodRange("lastMonth", NOW);
  eqDay(r.from, "2026-08-01");
  eqDay(r.to,   "2026-09-01");
});
it("⚠ yanvarda «o'tgan oy» — o'tgan YILNING dekabri", () => {
  const jan = new Date(2026, 0, 15, 12, 0, 0);
  const r = periodRange("lastMonth", jan);
  eqDay(r.from, "2025-12-01");
  eqDay(r.to,   "2026-01-01");
});
it("shu chorak — sentabr uchinchi chorakda", () => {
  eqDay(periodRange("quarter", NOW).from, "2026-07-01");
});
it("shu yil", () => eqDay(periodRange("year", NOW).from, "2026-01-01"));
it("o'tgan yil — TO'LIQ yil", () => {
  const r = periodRange("lastYear", NOW);
  eqDay(r.from, "2025-01-01");
  eqDay(r.to,   "2026-01-01");
});

console.log("\n── O'z oralig'i ──");
it("ikki sana — boshidan oxirigacha", () => {
  const r = periodRange("custom", NOW, { from: "2026-09-01", to: "2026-09-05" });
  eqDay(r.from, "2026-09-01");
  eqDay(r.to,   "2026-09-06");
});
it("⚠ TESKARI oraliq o'zi to'g'rilanadi", () => {
  const r = periodRange("custom", NOW, { from: "2026-09-05", to: "2026-09-01" });
  eqDay(r.from, "2026-09-01");
  eqDay(r.to,   "2026-09-06");
});
it("to'ldirilmagan oraliq — BUGUNGA qaytadi, bo'sh javobga emas", () => {
  eqDay(periodRange("custom", NOW, { from: "", to: "" }).from, "2026-09-03");
});
it("noto'g'ri sana o'qilmaydi", () => {
  assert.equal(parseDate("chalkash"), null);
  assert.equal(parseDate("2026-9-3"), null);
  assert.ok(parseDate("2026-09-03") instanceof Date);
});
it("noma'lum kalit — bugun", () => eqDay(periodRange("chalkash", NOW).from, "2026-09-03"));

console.log("\n── Uzunlik va o'sish ──");
it("uzunlik kunlarda", () => {
  assert.equal(lengthDays(periodRange("today", NOW)), 1);
  assert.equal(lengthDays(periodRange("lastWeek", NOW)), 7);
});
it("o'sish foizi", () => {
  assert.equal(growth(120, 100), 20);
  assert.equal(growth(80, 100), -20);
});
it("⚠ oldingi davr NOL bo'lsa foiz YO'Q (null), «+∞%» emas", () => {
  assert.equal(growth(12000, 0), null);
  assert.equal(growth(0, 0), 0, "ikkalasi ham nol — o'zgarish yo'q");
});
it("manfiy bazadan o'sish ham to'g'ri", () => {
  // −100 dan −50 ga: zarar KAMAYDI, ya'ni +50 %
  assert.equal(growth(-50, -100), 50);
});

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
