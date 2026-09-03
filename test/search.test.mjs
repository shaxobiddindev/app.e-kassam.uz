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
  scoreText, scoreDigits, scoreItem, rankItems,
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


/* ══════════════════════════════════════════════════════════════════════════
   UMUMIY QIDIRUV — tizimning HAMMA joyi uchun

   ⚠ Ilgari tizimda TO'QQIZTA alohida qidiruv bor edi va har biri
   `nom.toLowerCase().includes(so'rov)` deb yozilgan edi. Kassada
   algoritm tuzatilgan, qolgan sakkiztasida esa eski holicha qolgan:
   kassada topilgan tovar Katalogda topilmasdi va do'kon egasi «tovar
   yo'qolib qoldi» deb o'ylardi.

   Endi qoida bitta joyda. Bu blok o'sha umumiy qoidani qamrab oladi.
   ══════════════════════════════════════════════════════════════════════════ */

console.log("\n═══ 8. Umumiy matn bahosi ═══");
yes(scoreText("suv", "Suv 1L") > scoreText("suv", "Ichimlik suvi gazsiz"),
    "aniq nom o'xshashidan yuqori turadi");
eq(scoreText("", "Suv"), 0, "bo'sh so'rov — nol");
eq(scoreText("suv", ""), 0, "bo'sh matn — nol");
yes(scoreText("сув", "Suv 1L") > 0, "kirillcha so'rov lotincha nomni topadi");
yes(scoreText("oq yog", "Oq yog'") > 0, "apostrofsiz so'rov apostrofli nomni topadi");

console.log("\n═══ 9. Raqamli maydon (telefon, chek raqami) ═══");
eq(scoreDigits("+998901234567", "+998 90 123-45-67"), RANK.CODE_EXACT,
   "boshqacha yozilgan bir xil raqam — aynan mos");
eq(scoreDigits("4567", "+998901234567"), RANK.NAME_PREFIX,
   "OXIRGI raqamlar bo'yicha topiladi — odam shuni eslaydi");
eq(scoreDigits("998", "+998901234567"), RANK.NAME_PREFIX,
   "boshi bo'yicha ham topiladi");
eq(scoreDigits("0123", "+998901234567"), RANK.CONTAINS,
   "o'rtasidan ham topiladi, lekin pastroq vaznda");
eq(scoreDigits("777", "+998901234567"), 0, "mos kelmasa — nol");
eq(scoreDigits("", "+998901234567"), 0, "bo'sh so'rov — nol");

console.log("\n═══ 10. Yozuv bahosi (kodlar + raqamlar + matnlar) ═══");
const CUST = { texts: (c) => [c.fullName], digits: (c) => [c.phone] };
const ali = { fullName: "Abdullayev Ali", phone: "+998901234567" };
yes(scoreItem(ali, "abdullayev", CUST) > 0, "ism bo'yicha topiladi");
yes(scoreItem(ali, "4567", CUST) > 0, "telefon oxiri bo'yicha topiladi");
eq(scoreItem(ali, "zzz", CUST), 0, "mos kelmasa — nol");
eq(scoreItem(ali, "", CUST), 0, "bo'sh so'rov — nol");

const SPEC = { codes: (p) => [p.barcode], texts: (p) => [p.name] };
eq(scoreItem({ name: "Suv", barcode: "4780000000011" }, "4780000000011", SPEC),
   RANK.CODE_EXACT, "aynan barkod — eng yuqori");

console.log("\n═══ 11. Ro'yxatni saralash ═══");
const people = [
  { fullName: "Botirov Bek",     phone: "+998901112233" },
  { fullName: "Abdullayev Ali",  phone: "+998907654321" },
  { fullName: "Aliyev Sardor",   phone: "+998935554433" },
];
const byName = rankItems(people, "ali", CUST).map((c) => c.fullName);
yes(byName[0] === "Aliyev Sardor", "so'z boshidagi mos oldin turadi (olindi: " + byName[0] + ")");
yes(byName.includes("Abdullayev Ali"), "ichida uchragani ham kiradi");
yes(!byName.includes("Botirov Bek"), "mos kelmagani chiqmaydi");

eq(rankItems(people, "4433", CUST).length, 1, "telefon bo'yicha aniq bitta");
eq(rankItems(people, "", CUST).length, 3, "bo'sh so'rovda ro'yxat o'zgarmaydi");
eq(rankItems(null, "ali", CUST).length, 0, "ro'yxat yo'q — yiqilmaydi");
eq(rankItems(people, "ali", CUST, 1).length, 1, "chegara hurmat qilinadi");

console.log("\n═══ 12. Tovar qidiruvi umumiy qoidaning ustida qurilgan ═══");
/* ⚠ Refaktordan keyin natija O'ZGARMAGANINI qayd etadi: foydalanuvchi
   talabi aynan shu edi — «natijaga ta'sir qilmasa». */
const prods = [P("Suv 1L", { barcode: "111111" }), P("Ichimlik suvi gazsiz 1.5L")];
eq(scoreProduct(prods[0], "111111"), RANK.CODE_EXACT, "barkod aynan mos — o'zgarmadi");
yes(scoreProduct(prods[0], "suv") > scoreProduct(prods[1], "suv"),
    "qisqa nom uzun nomdan oldin — o'zgarmadi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} ta o'tdi, ${fail} ta yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
