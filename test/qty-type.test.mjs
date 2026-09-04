/* ══════════════════════════════════════════════════════════════════════════
   SAVATDA RAQAM BILAN MIQDOR (V66)

   Do'kon egasining talabi so'zma-so'z: «123 ni ketma-ket bossa 123
   bo'ladi; qanchadirdan keyin 32 deb yozsa eskisi o'rniga; vaqt
   tugamasdan yozsa ketidan 3245». Bu yerda vaqt qo'lda beriladi —
   sinov soniyalarni kutmaydi.

   Ishga tushirish:  node test/qty-type.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { typeQtyKey, isBurst, QTY_TYPE_MS, BURST_MS } = await import("../src/lib/ek-qty-type.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

/* Ketma-ket bosish: `keys` — [tugma, vaqt] juftliklari. */
const play = (keys, line = 7) => {
  let s = null, last = null;
  for (const [k, at] of keys) { const r = typeQtyKey(s, line, k, at); s = r.session; last = r.apply; }
  return { text: s?.text ?? "", apply: last };
};

console.log("── Ketma-ket yozish ──");
let r = play([["1", 0], ["2", 200], ["3", 450]]);
eq(r.text, "123", "1,2,3 → 123");
eq(r.apply, 123, "miqdor 123 qo'llanadi");

console.log("\n── Oyna tugagach — ESKISI O'RNIGA ──");
r = play([["1", 0], ["2", 200], ["3", 450], ["3", 450 + QTY_TYPE_MS + 10], ["2", 450 + QTY_TYPE_MS + 300]]);
eq(r.text, "32", "1,5 soniyadan keyin 3,2 → 32 (123 emas)");

console.log("\n── Oyna tugamasdan — DAVOM ──");
r = play([["3", 0], ["2", 300], ["4", 300 + QTY_TYPE_MS - 50], ["5", 300 + QTY_TYPE_MS + 100]]);
eq(r.text, "3245", "har raqam oldingisidan 1,5 s ichida → 3245");

console.log("\n── Chegaralar ──");
r = play([["0", 0]]);
eq(r.text, "0", "«0» yoziladi…");
eq(r.apply, null, "…lekin miqdor 0 ga TUSHMAYDI");
r = play([["0", 0], ["5", 100]]);
eq(r.text, "5", "boshidagi nol tashlanadi: 0,5 → 5");
r = play([["1", 0], ["2", 100], ["3", 200], ["4", 300], ["5", 400]]);
eq(r.text, "1234", "to'rt raqamdan ortig'i qabul qilinmaydi");

console.log("\n── Backspace ──");
r = play([["1", 0], ["2", 100], ["Backspace", 200]]);
eq(r.text, "1", "12 → Backspace → 1");
eq(r.apply, 1, "miqdor 1 bo'ladi");
r = play([["1", 0], ["Backspace", 100]]);
eq(r.text, "", "oxirgi raqam o'chdi — bo'sh");
eq(r.apply, null, "bo'sh matn miqdorni tegmaydi");
let one = typeQtyKey(null, 7, "Backspace", 0);
eq(one.session, null, "yozilmagan paytda Backspace hech narsa qilmaydi");

console.log("\n── Boshqa qator — yangidan ──");
let s = typeQtyKey(null, 7, "1", 0).session;
s = typeQtyKey(s, 7, "2", 100).session;
const other = typeQtyKey(s, 9, "5", 200);
eq(other.session.text, "5", "boshqa qatorda «5» — «125» emas");
eq(other.session.id, 9, "sessiya yangi qatorniki");

console.log("\n── Skaner ──");
eq(isBurst(0, BURST_MS - 5), true, "45 ms dan tez kelgan belgi — skaner");
eq(isBurst(0, 200), false, "200 ms — odam");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
