/* ══════════════════════════════════════════════════════════════════════════
   STOL BUYURTMASI ↔ SAVAT (T1)
   Ishga tushirish:  node test/table-order.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { linesOf, sigOf, itemsFrom, minutesSince } = await import("../src/lib/ek-table-order.js");
const { lineFor, keyOf } = await import("../src/lib/ek-modifiers.js");

let pass = 0, fail = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${ok ? "" : `\n     olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`}`);
};

const OSH = { id: 7, name: "Osh", salePrice: 35000 };
const SUV = { id: 3, name: "Suv", salePrice: 3000 };
const G = [{ id: 1, options: [{ id: 11, name: "Katta", price: 8000 }, { id: 12, name: "Piyozsiz", price: 0 }] }];

console.log("\n── Savat → server ──");
const cart = [
  { ...lineFor(OSH, [G[0].options[1], G[0].options[0]]), qty: 2, discount: 1000 },
  { ...SUV, qty: 1 },
  { ...SUV, id: 9, qty: 0 },
];
eq(linesOf(cart), [
  { productId: 7, quantity: 2, modifierIds: [11, 12], discount: 1000 },
  { productId: 3, quantity: 1, modifierIds: [], discount: 0 },
], "qo'shimchalar saralangan, nol miqdor tashlanadi, narx YUBORILMAYDI");
eq(sigOf(cart) === sigOf(cart.map((i) => ({ ...i, _pulse: 123 }))), true, "⚠ animatsiya belgisi o'zgarish emas (bekor PUT yo'q)");
eq(sigOf(cart) === sigOf([{ ...cart[0], qty: 3 }, cart[1]]), false, "miqdor o'zgarsa — o'zgarish");

console.log("\n── Server → savat ──");
const order = { lines: [
  { productId: 7, quantity: 2, modifierIds: [12, 11], discount: 1000 },
  { productId: 3, quantity: 1, modifierIds: [], discount: 0 },
  { productId: 99, quantity: 1, modifierIds: [], discount: 0 },
] };
const prods = new Map([["7", OSH], ["3", SUV]]);
const { items, missing } = itemsFrom(order, prods, G);
eq(items.map((i) => [keyOf(i), i.salePrice, i.qty, i.discount]), [["7~11.12", 43000, 2, 1000], [3, 3000, 1, 0]],
   "qo'shimcha narxi qayta qo'shiladi, kalit kassadagi bilan bir xil");
eq(missing, 1, "⚠ tovari topilmagan qator jimgina yo'qolmaydi — sanaladi");
eq(linesOf(items), linesOf(cart), "aylanib qaytgan savat — o'sha qatorlar (ikki qurilma bir xil ko'radi)");

console.log("\n── Mehmon, kurs, izoh, oshxonaga ketgani (D3) ──");
{
  const { seatKey } = await import("../src/lib/ek-table-order.js");
  const o3 = { lines: [
    { productId: 3, quantity: 2, modifierIds: [], discount: 0, seat: 1, course: 2, note: "muzsiz", sentQty: 1, sentAt: "2026-10-08T19:00:00Z" },
    { productId: 3, quantity: 1, modifierIds: [], discount: 0, seat: 2 },
  ] };
  const r = itemsFrom(o3, prods, G).items;
  eq(r.length, 2, "M1 va M2 dagi bir xil tovar — ikki qator");
  eq(r[0]._key !== r[1]._key, true, "kalitlari farqli (kassa ularni qo'shib yubormaydi)");
  eq([r[0].seat, r[0].course, r[0].note, r[0].sentQty], [1, 2, "muzsiz", 1], "maydonlar savatga o'tdi");
  const back = linesOf(r);
  eq(back[0], { productId: 3, quantity: 2, modifierIds: [], discount: 0, seat: 1, course: 2, note: "muzsiz" },
     "⚠ serverga qaytishda yo'qolmaydi; sentQty yuborilmaydi");
  eq(seatKey({ id: 5 }), 5, "mehmonsiz qator — oddiy kalit");
  eq(seatKey(r[0]) === seatKey({ ...r[0], _key: seatKey(r[0]) }), true, "⚠ kalit barqaror — o'zidan qayta hisoblansa ham bir xil (ikki bosish = ×2)");
}

console.log("\n── Vaqt ──");
eq(minutesSince("2026-10-08T10:00:00Z", Date.parse("2026-10-08T10:45:30Z")), 45, "45 daqiqa");
eq(minutesSince("buzuq"), null, "buzuq sana — null");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
