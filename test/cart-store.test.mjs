/* ══════════════════════════════════════════════════════════════════════════
   Savatlarni saqlash — sinov.

   ⚠ NEGA MUHIM: bu modul XAVFSIZLIK nazoratining bir qismi. Savatdan
   o'chirish bajik bilan qo'riqlanadi, lekin savatning o'zi brauzerda
   yashaydi — ilgari bitta F5 uni izsiz yo'q qilardi va qo'riqlash
   marosimga aylanib qolgan edi.

   Bu yerda qat'iy qayd etiladi:
     · saqlangan savat qaytariladi (F5 endi yo'qotmaydi)
     · ESKIRGAN savat qaytarilmaydi, lekin XABAR QILINADI
     · kalit do'kon va kassir bo'yicha — smena almashganda savat meros
       bo'lib o'tmaydi
     · BIR NECHTA savat saqlanadi, bo'shlari tashlanadi
     · ESKI (bitta savatli) yozuv ham o'qiladi — yangilanish kassa
       o'rtasida turgan savatni yo'qotmasligi kerak

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

const { save, take, describe, totalOf, flatten, blank, MAX_CARTS, STALE_MS } =
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
const OTHER = [{ id: 3, name: "Choy", qty: 1, salePrice: 12000 }];
/** Bitta savatli ro'yxat. */
const one = (items, id = 1) => [{ id, items, customer: null }];
/** ⚠ Aynan SAVAT kaliti — Map da `ek_shopCode` va `ek_username` ham bor. */
const cartKey = () => [...store.keys()].find((k) => k.startsWith("ek_cart_"));

console.log("\n═══ 1. Saqlanadi va qaytariladi ═══");
store.clear(); asUser("gulzor", "aziz");
save(one(CART), 1);
const restored = take();
eq(restored?.stale, false, "yaqinda saqlangan savat eskirgan emas");
eq(restored?.carts?.length, 1, "bitta savat qaytdi");
eq(restored?.carts?.[0]?.items?.length, 2, "ikkala tovar ham qaytdi");
eq(restored?.carts?.[0]?.items?.[0]?.name, "Suv", "tarkibi o'zgarmadi");
eq(restored?.activeId, 1, "ochiq turgan savat eslab qolindi");

console.log("\n═══ 2. O'qish bilan birga O'CHIRILADI ═══");
eq(take(), null, "ikkinchi o'qishda yozuv yo'q — bir marta hal qilinadi");

console.log("\n═══ 3. Bo'sh savat yozuvni o'chiradi ═══");
store.clear(); asUser("gulzor", "aziz");
save(one(CART), 1);
save(one([]), 1);
eq(take(), null, "bo'sh savat saqlanmaydi");

console.log("\n═══ 4. ⚠ ESKIRGAN savat qaytarilmaydi, lekin xabar qilinadi ═══");
store.clear(); asUser("gulzor", "aziz");
save(one(CART), 1);
// Saqlangan vaqtni orqaga suramiz — kecha yopilgan terminalni taqlid qiladi
{
  const rec = JSON.parse(store.get(cartKey()));
  rec.savedAt = Date.now() - STALE_MS - 1000;
  store.set(cartKey(), JSON.stringify(rec));
}
const stale = take();
eq(stale?.stale, true, "6 soatdan eski savat ESKIRGAN deb belgilanadi");
eq(stale?.carts?.[0]?.items?.length, 2, "tarkibi baribir beriladi — jurnalga yozish uchun");

console.log("\n═══ 5. ⚠ Kalit do'kon va KASSIR bo'yicha ═══");
store.clear();
asUser("gulzor", "aziz");   save(one(CART), 1);
asUser("gulzor", "bobur");
eq(take(), null, "boshqa kassir oldingisining savatini KO'RMAYDI");
asUser("gulzor", "aziz");
eq(take()?.carts?.[0]?.items?.length, 2, "o'z savati esa joyida");

store.clear();
asUser("gulzor", "aziz");   save(one(CART), 1);
asUser("chorsu", "aziz");
eq(take(), null, "boshqa do'kondagi savat ham ko'rinmaydi");

console.log("\n═══ 6. Buzuq yozuv yiqitmaydi ═══");
store.clear(); asUser("gulzor", "aziz");
localStorage.setItem("ek_cart_gulzor_aziz", "{buzuq json");
eq(take(), null, "buzuq JSON — yo'q deb hisoblanadi, xato tashlanmaydi");

console.log("\n═══ 7. ⚠ BIR NECHTA savat ═══");
store.clear(); asUser("gulzor", "aziz");
save([
  { id: 1, items: CART,  customer: null },
  { id: 2, items: [],    customer: null },          // bo'sh — saqlanmaydi
  { id: 3, items: OTHER, customer: { id: 9, name: "Alisher" } },
], 3);
const multi = take();
eq(multi?.carts?.length, 2, "bo'sh savat tashlandi, ikkitasi qoldi");
eq(multi?.carts?.[1]?.id, 3, "raqamlar o'zgarmaydi — kassir tabni tanigan holda qaytadi");
eq(multi?.carts?.[1]?.customer?.name, "Alisher", "har savat O'Z MIJOZI bilan qaytadi");
eq(multi?.activeId, 3, "ochiq turgan savat eslab qolindi");

console.log("\n═══ 8. Yo'q bo'lib ketgan ochiq savat — birinchisiga tushadi ═══");
store.clear(); asUser("gulzor", "aziz");
save([{ id: 1, items: CART, customer: null }, { id: 2, items: [], customer: null }], 2);
eq(take()?.activeId, 1, "bo'sh savat saqlanmagan, ochiq savat birinchisiga o'tdi");

console.log("\n═══ 9. ⚠ ESKI (bitta savatli) yozuv ham o'qiladi ═══");
store.clear(); asUser("gulzor", "aziz");
localStorage.setItem("ek_cart_gulzor_aziz",
  JSON.stringify({ savedAt: Date.now(), cart: CART }));
const legacy = take();
eq(legacy?.carts?.length, 1, "eski yozuvdan bitta savat chiqdi");
eq(legacy?.carts?.[0]?.items?.[1]?.name, "Non", "tarkibi buzilmadi");

console.log("\n═══ 10. Chegara — ortiqcha savatlar kesiladi ═══");
store.clear(); asUser("gulzor", "aziz");
save(Array.from({ length: MAX_CARTS + 3 }, (_, i) => ({ id: i + 1, items: OTHER, customer: null })), 1);
eq(take()?.carts?.length, MAX_CARTS, `ko'pi bilan ${MAX_CARTS} ta savat qaytadi`);

console.log("\n═══ 11. Jurnal uchun matn va summa ═══");
eq(totalOf(CART), 14000, "jami: 2×5000 + 1×4000 = 14 000");
eq(describe(CART), "Suv ×2; Non ×1", "o'qiladigan ro'yxat");
eq(totalOf(null), 0, "bo'sh savatda nol");
eq(describe(null), "", "bo'sh savatda bo'sh matn");
eq(flatten([{ items: CART }, { items: OTHER }]).length, 3, "barcha savatlar bitta ro'yxatga yig'iladi");
eq(blank(7).id, 7, "bo'sh savat berilgan raqam bilan tug'iladi");
eq(blank(7).items.length, 0, "va tarkibi bo'sh");

console.log("\n─────────────────────────────");
console.log(`  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
