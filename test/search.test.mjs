/* ══════════════════════════════════════════════════════════════════════════
   Tovar qidiruvi — normallashtirish va reyting sinovi.

   ⚠ NEGA MUHIM: qidiruv kassaning eng ko'p ishlatiladigan amali. Ilgari
   u bitta `LIKE '%so'z%'` edi va reyting umuman yo'q edi — natija
   `sortOrder, name` bo'yicha kelardi, ya'ni kassir mijoz oldida
   ro'yxatni ko'zdan kechirishga majbur bo'lardi.

   ⚠ Bu yerdagi tartib SERVERDAGI bilan bir xil bo'lishi shart
   (`ProductRepository.searchRanked`). Ikki tomon boshqacha tartiblasa,
   kassir yozishda davom etganda ro'yxat SAKRAB ketardi.

   Ishga tushirish:  node test/search.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import {
  normSearch, looksLikeCode, trigrams, trigramSimilarity,
  wordSimilarity, scoreProduct, rankLocal, RANK,
} from "../src/lib/ek-search.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));
const yes = (v, m) => (v ? ok(m) : bad(m, v));

const P = (name, extra = {}) => ({ id: name, name, ...extra });

console.log("\n═══ 1. Normallashtirish: o'zbek apostrofi ═══");
/* ⚠ Bitta tovar bazada uch xil apostrof bilan yotishi mumkin —
   klaviaturaga qarab o'zgaradi. Kassir esa umuman yozmaydi. */
eq(normSearch("Oq yog'"),  "oq yog", "to'g'ri tirnoq tashlanadi");
eq(normSearch("Oq yogʻ"),  "oq yog", "o'zbek apostrofi (U+02BB) tashlanadi");
eq(normSearch("Oq yog`"),  "oq yog", "teskari tirnoq tashlanadi");
eq(normSearch("Oq yog‘"),  "oq yog", "chap qo'shtirnoq tashlanadi");
eq(normSearch("oq yog"),   "oq yog", "apostrofsiz yozuv ham shu shaklga keladi");
eq(normSearch("  Qog'oz   sochiq  "), "qogoz sochiq", "ortiqcha bo'shliqlar yig'ishtiriladi");
/* ⚠ «ў» → «o», «u» EMAS: lotinchada u «oʻ» deb yoziladi va apostrof
   tashlanadi. Aks holda kirillcha yozuv lotinchasini topmasdi. */
eq(normSearch("Кўк чой"), "kok choy", "kirill lotinchaga o'tadi (ў→o, ч→ch)");
eq(normSearch("Ko'k choy"), "kok choy", "lotincha yozuv ham AYNAN shu shaklga keladi");
eq(normSearch("Pepsi 1.75L"), "pepsi 1 75l", "tinish belgisi ajratgichga aylanadi");

console.log("\n═══ 2. Kod ko'rinishi ═══");
yes(looksLikeCode("4780000000011"), "13 raqamli barkod — kod");
yes(looksLikeCode("123456"), "6 raqam — kod (ichki kodlar shundan boshlanadi)");
yes(!looksLikeCode("12345"), "5 raqam kod emas");
yes(!looksLikeCode("7up"), "«7up» — tovar nomi, kod emas");
yes(!looksLikeCode(""), "bo'sh matn kod emas");

console.log("\n═══ 3. Trigrammlar ═══");
yes(trigrams("suv").has("suv"), "«suv» o'zi bo'lak sifatida bor");
yes(trigrams("suv").has("  s"), "so'z boshi ikki bo'shliq bilan kuchaytiriladi");
yes(trigramSimilarity("oq yog", "oq yogʻ 1l") > 0.5, "apostrof farqi o'xshashlikni buzmaydi");
yes(trigramSimilarity("ketchup", "ketchup") === 1, "aynan bir xil matn — 1.0");
yes(trigramSimilarity("suv", "kofe") < 0.2, "aloqasiz so'zlar past ball oladi");
/* ⚠ Uzun nom qisqa so'rovni SUYULTIRMASLIGI kerak — shuning uchun
   so'rov nomning eng mos SO'ZI bilan solishtiriladi (`pg_trgm` dagi
   `word_similarity` bilan bir xil ma'no). */
yes(wordSimilarity("ketchp", "Monarx ketchup") > trigramSimilarity("ketchp", "Monarx ketchup"),
    "so'z bo'yicha o'xshashlik butun nomdan yuqori");

console.log("\n═══ 4. Reyting bosqichlari ═══");
const codeHit = scoreProduct(P("Boshqa nom", { barcode: "4780000000011" }), "4780000000011");
eq(codeHit, RANK.CODE_EXACT, "aniq barkod — eng yuqori ball");
yes(scoreProduct(P("Suv"), "suv") > scoreProduct(P("Suv 1L"), "suv"),
    "aynan mos nom prefiksdan yuqori");
yes(scoreProduct(P("Suv 1L"), "suv") > scoreProduct(P("Ichimlik suvi"), "suv"),
    "nom boshi so'z boshidan yuqori");
yes(scoreProduct(P("Ichimlik suvi"), "suv") > scoreProduct(P("Gazsuv aralashma"), "suv"),
    "so'z boshi ichkaridagi uchrashuvdan yuqori");
yes(scoreProduct(P("Kofe premium aralashma"), "kofe aralashma") > RANK.ALL_TOKENS - 1,
    "barcha so'zlar bor — tartibi muhim emas");
eq(scoreProduct(P("Sovun"), "kofe"), 0, "mos kelmasa — nol");
eq(scoreProduct(P("Suv"), ""), 0, "bo'sh so'rov — nol");

console.log("\n═══ 5. Uzun nom jarimasi ═══");
/* Bir xil bosqichdagi ikki tovardan QISQAROG'I odatda aynan
   qidirilgani bo'ladi. */
yes(scoreProduct(P("Suv 1L"), "suv") > scoreProduct(P("Suv gazsiz katta shisha 1.5L"), "suv"),
    "qisqa nom uzun nomdan oldin turadi");

console.log("\n═══ 6. Xato yozilgan so'rov ═══");
yes(scoreProduct(P("Monarx ketchup"), "ketchup") > 0, "to'g'ri yozuv topiladi");
yes(scoreProduct(P("Monarx ketchup"), "ketchp") > 0, "harf tushib qolsa ham topiladi (trigramm)");
yes(scoreProduct(P("Monarx ketchup"), "kecthup") > 0, "harflar almashsa ham topiladi");

console.log("\n═══ 7. Mahalliy saralash ═══");
const list = [
  P("Ichimlik suvi gazsiz 1.5L"),
  P("Suv 1L"),
  P("Sovun"),
  P("Suv"),
];
const ranked = rankLocal(list, "suv").map((x) => x.name);
eq(ranked[0], "Suv", "eng mos tovar birinchi");
eq(ranked[1], "Suv 1L", "keyin prefiks bo'yicha");
yes(!ranked.includes("Sovun"), "mos kelmagan tovar ro'yxatga kirmaydi");
eq(rankLocal(list, "").length, list.length, "bo'sh so'rovda ro'yxat o'zgarmaydi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} ta o'tdi, ${fail} ta yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
