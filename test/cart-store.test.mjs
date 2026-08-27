/* ══════════════════════════════════════════════════════════════════════════
   Savatni saqlash — sinov.

   ⚠ NEGA MUHIM: bu modul XAVFSIZLIK nazoratining bir qismi. Savatdan
   o'chirish bajik bilan qo'riqlanadi, lekin savatning o'zi brauzerda
   yashaydi — ilgari bitta F5 uni izsiz yo'q qilardi va qo'riqlash
   marosimga aylanib qolgan edi.

   Bu yerda uchta xatti-harakat qat'iy qayd etiladi:
     · saqlangan savat qaytariladi (F5 endi yo'qotmaydi)
     · ESKIRGAN savat qaytarilmaydi, lekin XABAR QILINADI
     · kalit do'kon va kassir bo'yicha — smena almashganda savat meros
       bo'lib o'tmaydi

   Ishga tushirish:  node test/cart-store.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

/* localStorage stubi — node da yo'q. Modul import qilinishidan OLDIN
   qo'yilishi shart: `keyFor()` uni chaqiruv paytida o'qiydi. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { save, take, describe, totalOf, STALE_MS } =
  await import("../src/lib/ek-cart-store.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));

const asUser = (shop, user) => {
  localStorage.setItem("ek_shopCode", shop);
  localStorage.setItem("ek_username", user);
};
const CART = [
  { id: 1, name: "Suv",  qty: 2, salePrice: 5000 },
  { id: 2, name: "Non",  qty: 1, salePrice: 4000 },
];

console.log("\n═══ 1. Saqlanadi va qaytariladi ═══");
store.clear(); asUser("gulzor", "aziz");
save(CART);
const restored = take();
eq(restored?.stale, false, "yaqinda saqlangan savat eskirgan emas");
eq(restored?.cart?.length, 2, "ikkala tovar ham qaytdi");
eq(restored?.cart?.[0]?.name, "Suv", "tarkibi o'zgarmadi");

console.log("\n═══ 2. O'qish bilan birga O'CHIRILADI ═══");
eq(take(), null, "ikkinchi o'qishda yozuv yo'q — bir marta hal qilinadi");

console.log("\n═══ 3. Bo'sh savat yozuvni o'chiradi ═══");
store.clear(); asUser("gulzor", "aziz");
save(CART);
save([]);
eq(take(), null, "bo'sh savat saqlanmaydi");

console.log("\n═══ 4. ⚠ ESKIRGAN savat qaytarilmaydi, lekin xabar qilinadi ═══");
store.clear(); asUser("gulzor", "aziz");
save(CART);
// Saqlangan vaqtni orqaga suramiz — kecha yopilgan terminalni taqlid qiladi
{
  // ⚠ Aynan SAVAT kaliti — Map da `ek_shopCode` va `ek_username` ham bor.
  const key = [...store.keys()].find((k) => k.startsWith("ek_cart_"));
  const rec = JSON.parse(store.get(key));
  rec.savedAt = Date.now() - STALE_MS - 1000;
  store.set(key, JSON.stringify(rec));
}
const stale = take();
eq(stale?.stale, true, "6 soatdan eski savat ESKIRGAN deb belgilanadi");
eq(stale?.cart?.length, 2, "tarkibi baribir beriladi — jurnalga yozish uchun");

console.log("\n═══ 5. ⚠ Kalit do'kon va KASSIR bo'yicha ═══");
store.clear();
asUser("gulzor", "aziz");   save(CART);
asUser("gulzor", "bobur");
eq(take(), null, "boshqa kassir oldingisining savatini KO'RMAYDI");
asUser("gulzor", "aziz");
eq(take()?.cart?.length, 2, "o'z savati esa joyida");

store.clear();
asUser("gulzor", "aziz");   save(CART);
asUser("chorsu", "aziz");
eq(take(), null, "boshqa do'kondagi savat ham ko'rinmaydi");

console.log("\n═══ 6. Buzuq yozuv yiqitmaydi ═══");
store.clear(); asUser("gulzor", "aziz");
localStorage.setItem("ek_cart_gulzor_aziz", "{buzuq json");
eq(take(), null, "buzuq JSON — yo'q deb hisoblanadi, xato tashlanmaydi");

console.log("\n═══ 7. Jurnal uchun matn va summa ═══");
eq(totalOf(CART), 14000, "jami: 2×5000 + 1×4000 = 14 000");
eq(describe(CART), "Suv ×2; Non ×1", "o'qiladigan ro'yxat");
eq(totalOf(null), 0, "bo'sh savatda nol");
eq(describe(null), "", "bo'sh savatda bo'sh matn");

console.log("\n─────────────────────────────");
console.log(`  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
