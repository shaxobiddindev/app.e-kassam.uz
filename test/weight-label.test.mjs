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
     ["2700001002550", 3825, "0.255 kg", "00001"], "barkod, jami, og'irlik, PLU");
  eq(weighedProduct({ name: "X", salePrice: 1 }, 1, {}).error, "wl.err.noPlu", "PLU siz tovar — xato, jim emas");
  is(isWeighed({ unit: "kg" }) && !isWeighed({ unit: "PCS" }), "kg tortiladi, dona — yo'q");
  eq(weightText(1.5), "1.500 kg", "og'irlik matni");
  eq(stamp(new Date(2026, 8, 30, 13, 25)), "2026-09-30 13:25", "vaqt");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
