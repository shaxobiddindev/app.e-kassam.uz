/* ══════════════════════════════════════════════════════════════════════════
   TAROZI YORLIG'I — og'irlikli barkod (2026-10-04)

   ⚠ NEGA SINOV. Stiker chiroyli chiqib, kassada «topilmadi» bo'lsa yoki
   og'irlik boshqacha o'qilsa — mijoz noto'g'ri to'laydi. Har barkod kassa
   ishlatadigan `parseWeight` bilan QAYTA OCHILIB tekshiriladi.

   Ishga tushirish:  node test/weight-label.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { weightBarcode, normScale, totalOf, weightText, weighedProduct, isWeighed, stamp } =
  await import("../src/lib/ek-weight-label.js");
const { parseWeight } = await import("../src/lib/ek-catalog.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(JSON.stringify(got) === JSON.stringify(want), name, `olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`);

console.log("\n── Egasining suratidagi haqiqiy stiker ──");
{
  const scale = normScale({ prefixes: ["27"], pluDigits: 5, valueDigits: 5, valueDecimals: 3 });
  eq(weightBarcode(scale, "1", 0.255).code, "2700001002550", "⚠ «2700001002550» — prefiks 27, PLU 1, 0.255 kg (suratdagi bilan bir xil)");
  eq(parseWeight("2700001002550", scale), { plu: "00001", type: "WEIGHT", value: 0.255 }, "kassa uni qaytadan o'qiydi");
  eq(totalOf(15000, 0.255), 3825, "15 000 × 0.255 = 3 825 so'm (suratdagi jami)");
}

console.log("\n── Standart format (2 · PLU 5 · og'irlik 6 · 3 kasr) ──");
{
  const scale = normScale({});
  const r = weightBarcode(scale, "42", 1.234);
  eq(r.code?.length, 13, "13 xona");
  eq(parseWeight(r.code, scale), { plu: "00042", type: "WEIGHT", value: 1.234 }, "kassa o'qiydi: PLU 42, 1.234 kg");
  eq(normScale({ scalePrefixes: "21, 22", scalePluDigits: 4, scaleValueDigits: 6 }).prefixes, ["21", "22"], "do'kon sozlamasidagi «21, 22»");
}

console.log("\n── Narx kodlaydigan tarozi ──");
{
  const scale = normScale({ prefixes: ["2"], pluDigits: 5, valueDigits: 6, valueDecimals: 0, valueType: "PRICE" });
  const r = weightBarcode(scale, "7", 0.5, 12500);
  eq(parseWeight(r.code, scale), { plu: "00007", type: "PRICE", value: 12500 }, "jami summa barkodda");
}

console.log("\n── Xatolar ──");
{
  const scale = normScale({});
  eq(weightBarcode(scale, "", 1).error, "wl.err.noPlu", "PLU yo'q");
  eq(weightBarcode(scale, "123456", 1).error, "wl.err.pluLong", "PLU format xonasidan uzun");
  eq(weightBarcode(scale, "1", 0).error, "wl.err.noWeight", "og'irlik nol");
  eq(weightBarcode(scale, "1", 1000).error, "wl.err.tooHeavy", "1000 kg — 6 xonaga sig'maydi");
  eq(weightBarcode({ prefixes: ["2"], pluDigits: 5, valueDigits: 5 }, "1", 1).error, "wl.err.format", "jami 13 emas");
}

console.log("\n── Yorliq ma'lumoti ──");
{
  const r = weighedProduct({ name: "Pista", salePrice: 15000, plu: "1", unit: "KG" }, 0.255,
    { prefixes: ["27"], pluDigits: 5, valueDigits: 5, valueDecimals: 3 });
  eq([r.product.barcode, r.product.total, r.product.weightText, r.product.pluText],
     ["2700001002550", 3825, "0,255 kg", "00001"], "barkod, jami, og'irlik (vergul, 3 xona), PLU");
  eq(weighedProduct({ name: "X", salePrice: 1 }, 1, {}).error, "wl.err.noPlu", "PLU siz tovar — xato, jim emas");
  is(isWeighed({ unit: "kg" }) && !isWeighed({ unit: "PCS" }), "kg tortiladi, dona — yo'q");
  eq(weightText(1.5), "1,500 kg", "og'irlik matni — verguldan keyin 3 xona (2026-10-06)");
  /* ⚠ GRAMM: narx 1 gramm uchun — jami 1000 baravar kam chiqmasin. */
  const g = weighedProduct({ name: "Ziravor", salePrice: 50, plu: "7", unit: "GRAM" }, 0.2,
    { prefixes: ["27"], pluDigits: 5, valueDigits: 5, valueDecimals: 3 });
  eq(g.product.total, 10000, "⚠ grammli tovar: 200 g × 50 so'm = 10 000 (ilgari 10 edi)");
  eq(stamp(new Date(2026, 8, 30, 13, 25)), "2026-09-30 13:25", "vaqt");
}

console.log("\n── Miqdor ko'rinishi: verguldan keyin birlik xonalari (2026-10-06) ──");
{
  /* Egasi: «tarozili mahsulotlarda og'irlik verguldan keyin 3 xona ko'rsatilsin».
     Kassa, chek, sotuv tafsiloti — hammasi `ek-format.quantity` dan. */
  const { quantity } = await import("../src/lib/ek-format.js");
  const sp = (s) => s.replace(/ /g, " ");
  eq(quantity(0.35, 3), "0,350", "⚠ kg: 0.35 → «0,350» (nol kesilmaydi, vergul)");
  eq(quantity(2, 3), "2,000", "kg butun bo'lsa ham 3 xona");
  eq(sp(quantity(1234.5, 3)), "1 234,500", "minglar ajratilgan");
  eq(quantity(2, 0), "2", "dona — o'zgarmagan");
  eq(quantity(12.5, 2), "12,50", "metr — 2 xona");
  eq(quantity(0.35), "0,35", "birlik noma'lum — ortiqcha nolsiz, lekin vergul");
  eq(quantity(3), "3", "birlik noma'lum, butun son — «3,000» emas");
  eq(quantity(-0.25, 3), "-0,250", "manfiy (qaytarish)");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
