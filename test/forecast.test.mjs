/* ══════════════════════════════════════════════════════════════════════════
   PROGNOZ VA REJA (V70)

   ⚠ Prognoz — EKRANDAGI VA'DA. U bir marta ko'zga tashlanadigan
   darajada noto'g'ri chiqsa, unga ishonch qaytmaydi. Shuning uchun
   bu yerda javoblar QO'LDA hisoblangan qiymat bilan solishtiriladi va
   chegaralar (ma'lumot kam, manfiy trend, nol reja) alohida
   tekshiriladi — aynan shular ekranga `NaN`, `Infinity` yoki manfiy
   savdo chiqarishi mumkin edi.
   ══════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import { trend, forecast, expectedTotal, targetProgress, MIN_POINTS } from "../src/lib/ek-forecast.js";

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

/** 14 kunlik qator, 2026-09-01 dan. */
const days = (vals) => vals.map((v, i) => ({ at: new Date(2026, 8, 1 + i), value: v }));

console.log("\n── Trend ──");
it("aniq chiziqda qiyalik topiladi", () => {
  const { a, b } = trend([10, 20, 30, 40]);
  near(a, 10); near(b, 10);
});
it("tekis qatorda qiyalik nol", () => {
  const { a, b } = trend([7, 7, 7, 7]);
  near(a, 7); near(b, 0);
});
it("⚠ bitta nuqtada NaN chiqmaydi", () => {
  const { a, b } = trend([5]);
  near(a, 5); near(b, 0);
});
it("bo'sh qator yiqilmaydi", () => {
  const { a, b } = trend([]);
  near(a, 0); near(b, 0);
});

console.log("\n── Prognoz ──");
it(`⚠ ${MIN_POINTS} tadan kam nuqtada prognoz YO'Q (null)`, () => {
  assert.equal(forecast(days([1, 2, 3]), 7), null,
    "uch kunlik qatordan chiqarilgan taxmin son bo'lib ko'rinadi-yu, tasodif");
});
it("o'sib borayotgan qatorda prognoz ham o'sadi", () => {
  const f = forecast(days([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36]), 3);
  assert.equal(f.length, 3);
  assert.ok(f[0].value > 30, `kelgan: ${f[0].value}`);
  assert.ok(f[2].value > f[0].value, "keyingi kunlar kattaroq");
});
it("⚠ tushayotgan trend MANFIYGA o'tmaydi", () => {
  const f = forecast(days([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 2, 1, 0]), 10);
  assert.ok(f.every((x) => x.value >= 0), "«−1.2 mln sotamiz» degan ekran ma'nosiz");
  assert.ok(f.every((x) => x.low >= 0), "oraliq pastki chegarasi ham manfiy emas");
});
it("oraliq prognozni qamrab oladi", () => {
  const f = forecast(days([10, 14, 9, 16, 11, 15, 12, 13, 10, 17, 12, 14, 11, 15]), 2);
  assert.ok(f.every((x) => x.low <= x.value && x.value <= x.high), "low ≤ value ≤ high");
  assert.ok(f[0].high > f[0].low, "oraliq kengligi nol emas — taxmin ekani ko'rinadi");
});
it("sanalar ketma-ket kunlar", () => {
  const f = forecast(days(Array.from({ length: 14 }, () => 10)), 3);
  assert.equal(f[0].at.getDate(), 15);
  assert.equal(f[1].at.getDate(), 16);
  assert.equal(f[2].at.getDate(), 17);
});
it("hech qayerda NaN yo'q", () => {
  const f = forecast(days([0, 0, 0, 0, 0, 0, 0, 0]), 5);
  assert.ok(f.every((x) => Number.isFinite(x.value) && Number.isFinite(x.low) && Number.isFinite(x.high)));
});

console.log("\n── Davr oxiri ──");
it("qolgan kunlar prognozi jamiga qo'shiladi", () => {
  const pts = days(Array.from({ length: 14 }, () => 10));
  const total = expectedTotal(140, pts, 5);
  assert.ok(total > 140, `kelgan: ${total}`);
  assert.ok(total < 250, "besh kunga ~50 qo'shiladi, ko'p emas");
});
it("⚠ kun qolmasa — hozirgi jamining O'ZI", () => {
  assert.equal(expectedTotal(140, days(Array.from({ length: 14 }, () => 10)), 0), 140);
});
it("ma'lumot kam bo'lsa kutilayotgan jami ham YO'Q", () => {
  assert.equal(expectedTotal(30, days([10, 10, 10]), 5), null);
});

console.log("\n── Reja ──");
it("bajarilish foizi", () => {
  const r = targetProgress(2_000_000_000, 1_620_000_000, 8);
  near(r.percent, 81);
  near(r.left, 380_000_000);
  near(r.perDayNeeded, 47_500_000);
});
it("⚠ REJA YO'Q bo'lsa — null, «100% bajarildi» EMAS", () => {
  assert.equal(targetProgress(null, 5000, 10), null);
  assert.equal(targetProgress(0, 5000, 10), null, "nol reja bo'lish xatosi berardi");
});
it("reja oshib bajarilsa foiz 100 dan katta", () => {
  const r = targetProgress(100, 130, 3);
  near(r.percent, 130);
  assert.equal(r.left, 0, "ortiqcha bajarilganda «qolgan» manfiy emas, nol");
});
it("⚠ kun qolmaganda «kuniga qancha kerak» — null", () => {
  assert.equal(targetProgress(100, 40, 0).perDayNeeded, null,
    "«kuniga cheksiz kerak» degan javob foydasiz");
});

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
