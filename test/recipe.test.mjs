/* ══════════════════════════════════════════════════════════════════════════
   TEXNOLOGIK KARTA — ekrandagi hisob (R3, V150)
   Ishga tushirish:  node test/recipe.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { recipeCost, isIngredient, toRequest } = await import("../src/lib/ek-recipe.js");

let pass = 0, fail = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${ok ? "" : `\n     olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`}`);
};

console.log("\n── Tannarx ──");
eq(recipeCost([{ costPrice: 12000, quantity: "0.150" }, { costPrice: 90000, quantity: 0.1 }]), 10800,
   "osh: 0,150 × 12 000 + 0,100 × 90 000 = 10 800");
eq(recipeCost([{ costPrice: null, quantity: 1 }, { costPrice: 5000, quantity: "" }]), 0,
   "narxsiz va miqdorsiz qator hisobga kirmaydi");
eq(recipeCost(null), 0, "bo'sh retsept");

console.log("\n── Masalliq bo'la oladimi ──");
eq(isIngredient({ type: "GOODS" }) && isIngredient({}), true, "tovar (turi yo'q ham) — masalliq");
eq(isIngredient({ type: "SERVICE" }) || isIngredient({ type: "DISH" }), false, "xizmat va taom — yo'q");
eq(isIngredient({ type: "GOODS", active: false }), false, "arxivlangan — yo'q");

console.log("\n── Serverga ──");
eq(toRequest([{ ingredientId: 1, quantity: "0.150" }, { ingredientId: 2, quantity: "" }, { ingredientId: 3, quantity: "0" }]),
   [{ ingredientId: 1, quantity: 0.15 }], "bo'sh va nol miqdor tashlanadi, son bo'lib ketadi");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
