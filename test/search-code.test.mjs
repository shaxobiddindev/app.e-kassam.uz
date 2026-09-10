/* ══════════════════════════════════════════════════════════════════════════
   KOD REJIMI (V115) — `*425`

   ⚠ NEGA MATN BO'YICHA QO'RIQCHI. Bu yerdagi xavf HISOBDA emas,
   ULANISHDA: kod rejimida MAHALLIY REYTING ishlamasligi kerak. U ishlab
   ketsa, kassir ekranda O'XSHASH tovarlarni ko'radi va navbat oldida
   ulardan birini tanlab, BOSHQA tovarni sotib yuborishi mumkin —
   ya'ni aynan taqiqlangan narsa sodir bo'ladi. Buni hisob sinovi
   ushlay olmaydi.

   Ishga tushirish:  node test/search-code.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const { productCode } = await import("../src/lib/ek-code.js");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (Object.is(got, want)) { pass++; console.log("  \u2705 " + msg); }
  else { fail++; console.log(`  \u274c ${msg}\n      kutilgan: ${want}\n      keldi:    ${got}`); }
};

console.log("\n\u2500\u2500 Tovar kodi \u2500\u2500");
{
  eq(productCode({ searchCode: "425" }), "425", "yangi kod olinadi");
  /* \u26a0 Eski tovarda kod ayni `shortCode` ning o'zi \u2014 migratsiya
     ommaviy qayta kodlash qilmagan. */
  eq(productCode({ shortCode: 142 }), "142", "eski raqam zaxira sifatida ishlaydi");
  eq(productCode({ searchCode: "425", shortCode: 142 }), "425", "yangi kod ustun");
  /* \u26a0 MATN qaytadi: «001» ning boshidagi nollari yo'qolmasin. */
  eq(productCode({ searchCode: "001" }), "001", "\u26a0 boshidagi nollar saqlanadi");
  eq(typeof productCode({ shortCode: 142 }), "string", "\u26a0 son emas, matn qaytadi");
  eq(productCode({}), null, "kodsiz tovarda null");
  eq(productCode(null), null, "tovar bo'lmasa ham yiqilmaydi");
}

console.log("\n\u2500\u2500 Ulanish: kod rejimi \u2500\u2500");
{
  const kassa = readFileSync(new URL("../src/pages/KassaPage.jsx", import.meta.url), "utf8");

  const i = kassa.indexOf('if (val.startsWith("*"))');
  eq(i > 0, true, "\u26a0 qidiruv maydonida kod rejimi umuman yo'q");

  const body = kassa.slice(i, kassa.indexOf("\n    }", i));
  eq(/setProducts\(\[\]\)/.test(body), true,
     "\u26a0 kod rejimida mahalliy ro'yxat tozalanmaydi \u2014 o'xshash tovar ko'rinib qoladi");
  eq(/rankLocal/.test(body), false,
     "\u26a0 kod rejimi mahalliy REYTINGGA tushyapti \u2014 aynan taqiqlangan xatti-harakat");
  eq(/replace\(\/\\D\/g, ""\)/.test(body), true,
     "yulduzchadan keyin faqat raqam qabul qilinmayapti");

  eq(kassa.includes('search.startsWith("*") && ('), true,
     "\u26a0 rejim belgisi ekranda ko'rinmaydi \u2014 kassir yulduzchani sezmay qoladi");

  const labels = readFileSync(new URL("../src/lib/ek-code.js", import.meta.url), "utf8");
  eq(/export function productCode/.test(labels), true, "kod maydoni bitta joydan olinmayapti");

  const tile = readFileSync(new URL("../src/components/ProductTile.jsx", import.meta.url), "utf8");
  eq(tile.includes("p.shortCode"), false,
     "\u26a0 kafel hali ham to'g'ridan-to'g'ri eski maydonni o'qiyapti");
}

/* ══ PREFIKS QIDIRUVI (V128) ═════════════════════════════

   `*2` endi bitta tovar emas, «2» bilan boshlanadigan HAMMA kodni
   qaytaradi (server: `ProductService.searchByCode`). Shu bilan
   katakchadagi RAQAM majburiy bo'lib qoldi: ro'yxatda o'nlab tovar
   turadi va kassir ularni faqat raqami bilan ajrata oladi.

   ⚠ ILGARI AKSINCHA EDI: shart faqat YALANG raqamni («142»)
   tanirdi, yulduzcha esa uni buzardi — ya'ni raqam bo'yicha
   qidirilayotgan aynan o'sha paytda raqam KO'RINMASDI. */
console.log("\n── Kod rejimida raqam ko'rinadi ──");
{
  const kassa = readFileSync(new URL("../src/pages/KassaPage.jsx", import.meta.url), "utf8");

  eq(/const codeMode = search\.trim\(\)\.startsWith\("\*"\)/.test(kassa), true,
     "kod rejimi belgisi (`codeMode`) yo'q");
  eq(/const numericSearch = codeMode \|\|/.test(kassa), true,
     "⚠ katakchadagi raqam kod rejimini hisobga olmayapti — `*2` o'nlab "
     + "tovar qaytaradi va kassir ularni ajrata olmaydi");
  eq(/showCode=\{numericSearch\}/.test(kassa), true,
     "kafelga raqam ko'rsatish belgisi uzatilmayapti");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
