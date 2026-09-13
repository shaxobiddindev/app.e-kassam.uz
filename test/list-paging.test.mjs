/* ══════════════════════════════════════════════════════════════════════════
   SAHIFALANGAN RO'YXAT BRAUZERDA QAYTA FILTRLANMASIN

   ═══ NIMANI QO'RIQLAYDI ════════════════════════════════════════════════

   Ro'yxat sahifa-sahifa kelganda brauzerdagi har qanday filtr, qidiruv
   yoki jamlama JIMGINA YOLG'ON bo'lib qoladi — chunki u endi butun
   ro'yxatni emas, YUKLANGAN 50 qatorni ko'radi:

       do'konchi «Coca» deb yozadi  →  birinchi 50 qatorda yo'q
                                    →  «tovar yo'q» degan XATO xulosa
                                    →  tovarni QAYTA yaratadi

   Ekranda hech qanday xato ko'rinmaydi. Aynan shuning uchun bu sinov
   kerak: nuqson faqat ma'lumot ko'payganda chiqadi va o'shanda uni
   sahifalash bilan bog'lash qiyin bo'ladi.

   ⚠ SINOV KODNI O'QIYDI, ISHGA TUSHIRMAYDI. Sahifani haqiqiy ishga
   tushirish uchun server va baza kerak; bu esa `npm test` da har
   safar bajariladigan tez tekshiruv. Shuning uchun u «shu chaqiruv
   bormi» degan savolga javob beradi, «natija to'g'rimi» degan
   savolga emas — oxirgisi backenddagi `SalePageTest` ning ishi.

   Ishga tushirish:  node test/list-paging.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
/* Izohlar tashlanadi: ular eski yo'lni TARIX sifatida eslaydi va
   sinovni yolg'on yiqitardi. */
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg); }
};

/* ══ 1. Umumiy qoidalar — har sahifada ═════════════════════════════ */

/**
 * @param apply `colFlt.apply(` chaqiruviga RUXSAT berilganmi.
 *              Ikki sahifada u to'g'ri: ro'yxat o'sha yo'lda TO'LIQ
 *              keladi (tovarlarda kod rejimi, mijozlarda qarzdorlar)
 *              va to'liq ro'yxatni brauzerda kesish xato emas.
 */
const PAGES = [
  { file: "pages/ProductsPage.jsx",  api: "productApi.getPage",  apply: true },
  { file: "pages/CustomersPage.jsx", api: "customerApi.getPage", apply: true },
  { file: "pages/SalesPage.jsx",     api: "saleApi.getPage",     apply: false },
];

console.log("\n═══ Sahifalangan ro'yxatlar ═══\n");

for (const p of PAGES) {
  const code = bare(src(p.file));
  const name = p.file.split("/").pop();
  console.log(`── ${name}`);

  ok(/useInfinite\(/.test(code) && /<InfiniteList/.test(code),
     `${name}: ro'yxat \`useInfinite\` + \`InfiniteList\` orqali keladi`);

  ok(code.includes(p.api),
     `${name}: sahifa serverdan so'raladi (\`${p.api}\`)`);

  /* ⚠ FILTR VA QIDIRUV SERVERGA. Ular yuborilmasa, server butun
     ro'yxatni sahifalaydi va ekrandagi filtr chipi YOLG'ON bo'ladi:
     u turadi-yu, ro'yxat unga bo'ysunmaydi. */
  const call = code.slice(code.indexOf(p.api));
  ok(/flt:/.test(call.slice(0, 400)) && /q:/.test(call.slice(0, 400)),
     `${name}: ⚠ ustun filtri va qidiruv SERVERGA yuboriladi`);

  /* ⚠ `rankItems` — BRAUZERDAGI qidiruv. Sahifalangan ro'yxatda u
     faqat yuklangan qatorlarni saralaydi va foydalanuvchi buni
     «qidiruv ishlamayapti» deb tushunadi. */
  ok(!/rankItems\(/.test(code),
     `${name}: ⚠ brauzerda qayta qidiruv (\`rankItems\`) YO'Q`);

  if (!p.apply) {
    ok(!/colFlt\.apply\(/.test(code),
       `${name}: ⚠ brauzerda qayta filtrlash (\`colFlt.apply\`) YO'Q`);
  }

  /* ⚠ JAMI SON SERVERDAN. `rows.length` — «shu sahifada nechta»
     degan boshqa savolning javobi va ekranda «137 ta» o'rniga
     «50 ta» deb turardi. */
  ok(/\btotal\b/.test(call.slice(0, 2000)) || /total={total}/.test(code),
     `${name}: jami son serverdan olinadi`);
}

/* ══ 2. Sotuvlar sahifasiga xos ════════════════════════════════════ */

const sales = bare(src("pages/SalesPage.jsx"));
console.log("\n── SalesPage: sotuvlarga xos qoidalar");

/* ⚠ KPI PANELI. Ilgari u `salesTotals(filtered)` edi va bu to'g'ri
   edi — `filtered` butun davrni qamrardi. Sahifada esa u 50 qator:
   panel «bu oy 4 200 000» o'rniga «bu sahifada 4 200 000» degan
   raqamni ko'rsatar va ekranda hech qanday belgi qolmasdi. */
ok(!/salesTotals\(/.test(sales),
   "⚠ KPI paneli sahifadagi qatorlardan HISOBLANMAYDI");

ok(/saleApi\.summary\(/.test(sales),
   "KPI va chip sonlari alohida jamlama so'rovidan keladi");

/* ⚠ CHIP SONLARI ham serverdan: `sales.filter(...).length` bilan
   sanash «bekor qilinganlar: 0» deb ko'rsatar, aslida ular keyingi
   sahifalarda bo'lardi. */
ok(/sum\?\.counts/.test(sales),
   "⚠ holat chiplaridagi sonlar SERVERDAN");

/* ⚠ SKANER. Ilgari `sales.find((x) => x.id === id)` turardi. Mijoz
   ertalabki chekni olib kelsa, u yuklangan 50 chek ichida bo'lmas va
   kassir «topilmadi» degan YOLG'ON xatoni olardi — qaytarish umuman
   mumkin bo'lmasdi. */
ok(!/sales\.find\(/.test(sales),
   "⚠ skanerlangan chek RO'YXATDAN qidirilmaydi");
ok(/useScanner\(async/.test(sales) && /saleApi\.getById\(/.test(sales),
   "⚠ skanerlangan chek SERVERDAN olinadi");

/* ⚠ EXCEL. «Ko'ringan ro'yxatni chiqarish» va'dasi sahifalashdan
   keyin to'liqsiz faylni to'liqdek ko'rsatardi — eng yomon natija,
   chunki uni faqat Excel'ni ochganda bilib bo'ladi. */
ok(/const collectAll\s*=\s*async/.test(sales),
   "⚠ Excel uchun QOLGAN SAHIFALAR ham so'raladi");
ok(/EXPORT_CAP/.test(sales) && /exportTooMany/.test(sales),
   "⚠ chegaradan oshsa ogohlantiriladi va HECH NARSA chiqarilmaydi");

/* ⚠ KASSIRNING «BUGUN» CHEGARASI SERVERGA. Brauzerda kesish
   sahifalashdan keyin BO'SH ro'yxat berardi: server birinchi 50
   chekni yuboradi, ular kechagi bo'lsa — hammasi kesilib ketadi. */
ok(/setHours\(0, 0, 0, 0\)/.test(sales) && /fromIso/.test(sales),
   "⚠ kassirning «bugun» chegarasi SO'ROVGA kiradi");
/* ⚠ `toISOString().slice(0, 10)` — UTC sanasi. UTC+5 da yarim
   tundan keyingi soatlarda u KECHAGI kunni berardi. */
ok(!/toISOString\(\)\.slice\(0, 10\)/.test(sales.slice(0, sales.indexOf("const exportXlsx"))),
   "⚠ bugungi sana MAHALLIY yarim tundan olinadi, UTC dan emas");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
