/* ══════════════════════════════════════════════════════════════════════════
   `*` QIDIRUVI BARCHA SAHIFADA (V130)

   ⚠ NEGA ULANISH QO'RIQCHISI. Bu yerdagi xavf hisobda emas: raqam
   qidiruvi bir sahifada SERVERDAN, boshqasida MAHALLIY ro'yxatdan
   ishlab ketsa, bir xil raqam ikki xil javob berardi — eski kod
   (alias) faqat bazada saqlanadi va mahalliy qidiruv uni ko'rmaydi.
   Javondagi eski yorliq kassada topilib, omborda «yo'q» bo'lardi.

   Ishga tushirish:  node test/code-search.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg); }
};

console.log("\n── Yordamchi: kod so'rovi ──");
{
  const lib = src("lib/ek-code-search.js");

  ok(/export const isCodeQuery/.test(lib), "isCodeQuery eksport qilinadi");
  ok(/slice\(1\)\.replace\(\/\\D\/g, ""\)\.slice\(0, 12\)/.test(lib),
     "⚠ yulduzchadan keyin faqat raqam, uzunligi 12 — kassadagi bilan bir xil");

  /* ⚠ ENG MUHIM BAND. Server chaqirilmasa alias ishlamaydi. */
  ok(/productApi\s*\n?\s*\.search\("\*" \+ digits/.test(lib),
     "⚠ raqam SERVERDAN so'raladi (alias va tartib server qoidasi bo'yicha)");

  /* ⚠ Tartibsiz javob eski so'rovni yangisining ustiga yozmasin. */
  ok(/mine !== seq\.current/.test(lib),
     "⚠ kechikkan javob yangi so'rov natijasini bosib ketmaydi");

  /* ⚠ Xato ≠ bo'sh natija. */
  const err = lib.slice(lib.indexOf(".catch("));
  ok(/ready: false/.test(err.slice(0, 400)),
     "⚠ tarmoq xatosida «topilmadi» EMAS, «tayyor emas»");

  const fn = lib.slice(lib.indexOf("export function filterByCode"));
  ok(/if \(!code\.ready\) return \[\]/.test(fn),
     "⚠ javob kelmaguncha bo'sh — eski ro'yxat ko'rinib qolmaydi");

  /* ⚠ TARTIB — JAVOBNING BIR QISMI. Server aynan mos kodni birinchi
     qo'yadi, keyin qisqadan uzunga. Sahifa buni o'z tartibiga
     almashtirsa, «*1» da kodi «1» bo'lgan tovar «10» va «100» orasida
     ko'milib ketardi — kassa ekranida esa birinchi turardi. Bir xil
     raqam, ikki xil javob: aynan shu yordamchi oldini oladi. */
  ok(/new Map\(list\.map\(\(p, i\) => \[p\.id, i\]\)\)/.test(lib),
     "⚠ serverdagi O'RIN saqlanadi (Map, Set emas)");
  ok(/\.sort\(\(a, b\) => code\.order\.get\(getId\(a\)\) - code\.order\.get\(getId\(b\)\)\)/.test(fn),
     "⚠ qatorlar SERVER tartibida chiqadi — aynan mos kod birinchi");
}

console.log("\n── Ulanish: sahifalar ──");
{
  /* Har bir tovarli sahifa AYNAN shu yordamchini ishlatsin. Sahifa
     o'z nusxasini yozsa, u bir kuni ajralib ketadi. */
  for (const page of ["pages/ProductsPage.jsx", "pages/InventoryPage.jsx"]) {
    const p = src(page);
    ok(/from "\.\.\/lib\/ek-code-search"/.test(p), `${page}: umumiy yordamchi import qilinadi`);
    ok(/useCodeSearch\(/.test(p) && /filterByCode\(/.test(p),
       `${page}: raqam rejimi ulangan`);
    ok(/code\.active[\s\S]{0,200}?filterByCode/.test(p),
       `${page}: ⚠ raqam rejimida MAHALLIY reyting ishlamaydi`);
  }
}

console.log("\n── SearchBar: rejim bir joyda ──");
{
  const ui = src("components/ui/index.jsx");
  const bar = ui.slice(ui.indexOf("export function SearchBar"),
                       ui.indexOf("export function ClearButton"));
  ok(/code = false/.test(bar), "kod rejimi ixtiyoriy — mijoz qidiruvi o'zgarmaydi");
  ok(/replace\(\/\\D\/g, ""\)/.test(bar), "yulduzchadan keyin raqamdan boshqasi tushadi");
  ok(/search-bar__mode/.test(bar), "⚠ rejim MATN bilan ko'rinadi");
  /* ⚠ Bayroqsiz maydon o'zgarmasin: mijoz/ta'minotchi qidiruvida `*`
     oddiy belgi bo'lib qolishi kerak. */
  ok(/code && v\.startsWith\("\*"\)/.test(bar),
     "⚠ `code` bayrog'isiz `*` oddiy belgi bo'lib qoladi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
