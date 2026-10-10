/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN MASALLIQLARI — `src/lib/ek-restaurant-ingredients.js`

   Ishga tushirish:  node test/restaurant-ingredients.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const I = await import("../src/lib/ek-restaurant-ingredients.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Necha kunga yetadi ──");
ok(I.daysTone(0.5).kind === "today", "0,5 kun — bugun tugaydi");
ok(I.daysTone(1.4).kind === "order", "1,4 kun — buyurtma bering");
ok(I.daysTone(2).kind === "ok", "2 kun — yetarli (chegara)");
ok(I.daysTone(null).kind === "idle", "⚠ sarf yo'q — baho yo'q, «∞» emas");

console.log("\n── Filtr ──");
const R = [
  { name: "Guruch", daysLeft: 3.8, stock: 18, minQuantity: 0 },
  { name: "Mol go‘shti", daysLeft: 0.5, stock: 3, minQuantity: 0 },
  { name: "Ziravor", daysLeft: null, stock: 0.2, minQuantity: 0.5 },
];
ok(I.visibleRows(R, { lowOnly: true }).map((r) => r.name).join() === "Mol go‘shti,Ziravor", "kam qolganlar: kun bo'yicha va minimal qoldiq bo'yicha");
ok(I.visibleRows(R, { query: "go'sht" }).length === 1, "⚠ qidiruv: ‘ va ' bir xil");

console.log("\n── Yetkazuvchiga matn ──");
const fmt = { qty: (n) => String(n).replace(".", ","), money: (n) => `${n} so'm`, unit: (u) => u.toLowerCase(),
              title: "Buyurtma", total: "Jami", noSupplier: "Yetkazuvchi ko'rsatilmagan" };
const txt = I.orderText({ supplierName: "Bozor", sum: 44000, lines: [{ name: "Guruch", qty: 2.5, unit: "KG" }] }, fmt);
ok(txt === "Buyurtma: Bozor\n• Guruch — 2,5 kg\nJami: 44000 so'm", "oddiy matn, qatorma-qator");
ok(I.orderText({ supplierName: null, sum: 0, lines: [] }, fmt).startsWith("Buyurtma: Yetkazuvchi ko'rsatilmagan"), "yetkazuvchisiz");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
