/* ══════════════════════════════════════════════════════════════════════════
   NAQD TUGMALARI (V76)

   Tekshirilayotgan narsa — TAKLIFNING FOYDALILIGI, ko'rinish emas.
   Xato jimgina bo'ladi: tugmalar chiziladi, faqat ularning soni
   kassirga hech qachon to'g'ri kelmaydi va u baribir qo'lda yozadi.
   ══════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import { cashSuggestions } from "../src/lib/ek-cash.js";

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};

console.log("\n── Naqd tugmalari ──");

it("o'rtacha chek: eng yaqin yaxlit sonlar", () => {
  assert.deepEqual(cashSuggestions(73_000), [75_000, 80_000, 100_000]);
});

it("kichik chek ham ISHLAYDI — qotib qolgan 50 000 foydasiz edi", () => {
  assert.deepEqual(cashSuggestions(8_000), [10_000, 50_000, 100_000]);
});

it("katta chek: takliflar ham kattalashadi", () => {
  /* ⚠ 425 000 CHIQMAYDI va bu to'g'ri: 420 000 allaqachon besh
     minglikka bo'linadi, ya'ni mayda qadamlar yangi son bermaydi. */
  assert.deepEqual(cashSuggestions(420_000), [450_000, 500_000]);
});

it("SUMMANING O'ZI taklif qilinmaydi — «Qolganini» tugmasi bor", () => {
  const out = cashSuggestions(73_000);
  assert.ok(!out.includes(73_000), "aniq summa ikki marta chiqmasligi kerak: " + out);
});

it("YUMALOQ summada ham tugma BOR — ro'yxat hech qachon bo'sh emas", () => {
  /* ⚠ HAQIQIY TESHIK: har bir qadam 100 000 ni qaytarardi va hammasi
     «summaning o'zi» deb tashlanardi — naqd tugmalari umuman
     chizilmasdi. */
  assert.deepEqual(cashSuggestions(100_000), [200_000]);
  assert.deepEqual(cashSuggestions(500_000), [600_000]);
  assert.deepEqual(cashSuggestions(1_000_000), [1_100_000]);
  for (const v of [1_000, 5_000, 10_000, 50_000, 100_000, 200_000, 1_000_000]) {
    assert.ok(cashSuggestions(v).length > 0, `${v} uchun tugma yo'q`);
  }
});

it("takroriy qiymat bir marta chiqadi", () => {
  /* 12 000 → 5000:15 000, 10000:20 000, 50000:50 000
     (1000 lik qadam 12 000 ning o'zini beradi va tashlanadi). */
  assert.deepEqual(cashSuggestions(12_000), [15_000, 20_000, 50_000]);
  /* 5 000 → 10000:10 000, 50000:50 000, 100000:100 000 — 10 000 ikki
     qadamdan chiqadi, lekin ro'yxatda BIR marta turadi. */
  assert.deepEqual(cashSuggestions(5_000), [10_000, 50_000, 100_000]);
});

it("takliflar ENG YAQINIDAN boshlanadi — kesish uni yo'qotmaydi", () => {
  /* ⚠ Qadamlar bo'yicha yig'ilgan ro'yxat o'sish tartibida bo'lishi
     shart emas; tartiblanmasdan kesilganda eng foydali variant
     tushib qolardi. */
  assert.equal(cashSuggestions(73_000)[0], 75_000);
  assert.equal(cashSuggestions(8_000)[0], 10_000);
});

it("UCHTADAN oshmaydi — to'lov oynasida scrol bo'lmasligi kerak", () => {
  for (const v of [1, 999, 7_777, 123_456, 9_999_999]) {
    assert.ok(cashSuggestions(v).length <= 3, `${v} uchun ${cashSuggestions(v).length} ta`);
  }
});

it("takliflar O'SISH tartibida", () => {
  for (const v of [1, 3_500, 73_000, 420_000, 1_234_567]) {
    const out = cashSuggestions(v);
    assert.deepEqual(out, [...out].sort((a, b) => a - b), String(v));
  }
});

it("har bir taklif summadan KATTA — aks holda qaytim manfiy bo'lardi", () => {
  for (const v of [1, 999, 8_000, 73_000, 420_000]) {
    for (const s of cashSuggestions(v)) assert.ok(s > v, `${v} → ${s}`);
  }
});

it("nol va manfiy — BO'SH ro'yxat, «0» degan tugma emas", () => {
  assert.deepEqual(cashSuggestions(0), []);
  assert.deepEqual(cashSuggestions(-100), []);
  assert.deepEqual(cashSuggestions(null), []);
  assert.deepEqual(cashSuggestions(undefined), []);
  assert.deepEqual(cashSuggestions("salom"), []);
});

it("kasrli summa ham ishlaydi", () => {
  assert.deepEqual(cashSuggestions(999.5), [1_000, 5_000, 10_000]);
});

console.log(`\n${fail ? "❌" : "✅"} naqd tugmalari: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
