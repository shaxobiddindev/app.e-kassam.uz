/* ==========================================================================
   e-Kassam — TOVAR QIDIRUVI: normallashtirish va reyting

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.

   ── Nega bu fayl bor ──────────────────────────────────────────────────────
   Ilgari qidiruv bitta `LIKE '%so'z%'` edi va natijalar `sortOrder, name`
   bo'yicha kelardi. Ya'ni REYTING UMUMAN YO'Q edi: «suv» so'roviga
   «Ichimlik suvi» ham, «Suv 1L» ham bir xil vaznda chiqar va ro'yxatning
   qayerda turishi tasodifga qolardi. Kassir mijoz oldida ro'yxatni
   ko'zdan kechirishga majbur bo'lardi.

   Bu yerda ikkita narsa bor:

     1. NORMALLASHTIRISH — o'zbek matnining haqiqiy ko'rinishi uchun.
        Bitta tovar bazada «Oq yog'», «Oq yogʻ», «Oq yog`» yoki
        «Oq yog‘» bo'lib yotishi mumkin: apostrof uch xil belgi bilan
        yoziladi va klaviaturaga qarab o'zgaradi. Kassir esa ko'pincha
        umuman apostrofsiz «oq yog» deb yozadi. Normallashtirmasak,
        bularning hech biri bir-birini topmaydi.

     2. REYTING — nima oldinroq turishi.

   ⚠ SERVER BILAN BIR XIL QOIDA. Xuddi shu bosqichlar `ProductRepository`
   dagi so'rovda ham bor. Ikki tomon boshqacha tartiblasa, kassir yozishda
   davom etganda ro'yxat SAKRAB ketardi: mahalliy javob bir tartib,
   serverniki boshqa tartib ko'rsatardi.
   ========================================================================== */

/**
 * Kirill → lotin (o'zbek imlosi).
 *
 * ⚠ NEGA KERAK. Bitta do'konda tovar nomi ikkala yozuvda kiritilgan
 * bo'ladi: omborchi kirillcha «Кўк чой» deb yozadi, kassir esa lotincha
 * «kok choy» deb qidiradi — va topa olmaydi. Bu ikki xil tovar emas,
 * bitta tovarning ikki yozuvi.
 *
 * ⚠ `ў → o`, `u` EMAS. Lotinchada u «oʻ» deb yoziladi, apostrof esa
 * yuqorida tashlanadi — ya'ni «oʻ» dan «o» qoladi. `u` deb o'girsak
 * kirillcha yozuv lotinchasini HECH QACHON topmasdi. `ғ → g` ham shu
 * sababdan («gʻ» → «g»).
 */
const CYR = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"j", з:"z", и:"i",
  й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t",
  у:"u", ф:"f", х:"x", ц:"ts", ч:"ch", ш:"sh", щ:"sh", ъ:"", ы:"i", ь:"",
  э:"e", ю:"yu", я:"ya", ў:"o", қ:"q", ғ:"g", ҳ:"h",
};

/**
 * Qidiruv uchun matnni bir shaklga keltiradi.
 *
 * ⚠ Apostrof VARIANTLARI birlashtiriladi va keyin BUTUNLAY TASHLANADI:
 * «yog'» va «yog» bir xil so'z bo'lib qoladi. Odam apostrofni yozmaydi,
 * baza esa uni saqlaydi — farqni qidiruv o'zi yopishi kerak.
 *
 * ⚠ Kirill «ў/ғ/қ/ҳ» lotinchaga o'tkaziladi: bitta do'konda ikkala
 * yozuvda kiritilgan tovar bo'lishi odatiy hol.
 */
export function normSearch(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼ‘’`´'']/g, "")          // apostrof — barcha variantda tashlanadi
    .replace(/[\u0400-\u04FF]/g, (ch) => CYR[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, " ")     // tinish belgilari — ajratgich
    .trim()
    .replace(/\s+/g, " ");
}

/** Faqat raqamlar — barkod tekshiruvi uchun. */
const digitsOnly = (s) => /^\d+$/.test(String(s ?? "").trim());

/**
 * Yozilgan matn KOD ga o'xshaydimi (barkod, qadoq, tarozi yorlig'i)?
 *
 * ⚠ 6 ta raqam — pastki chegara va u ataylab past emas: EAN-8 sakkizta,
 * ichki kodlar esa oltitadan boshlanadi. Undan qisqasi tovar nomining
 * bir qismi bo'lishi ehtimoli yuqoriroq («7up», «5l»).
 */
export const looksLikeCode = (s) => digitsOnly(s) && String(s).trim().length >= 6;

/* ── n-grammlar ──────────────────────────────────────────────────────── */

/**
 * Matnni uch harfli bo'laklarga bo'ladi (trigramm).
 *
 * ⚠ Chetlariga bo'shliq qo'shiladi — `pg_trgm` ham xuddi shunday qiladi.
 * Bu so'z BOSHINI kuchaytiradi: «suv» so'zidagi `  s`, ` su`, `suv`
 * bo'laklari «Ichimlik suvi» dagi «suv» bilan mos tushadi va ikkala
 * tomon bir xil hisoblaydi.
 */
export function trigrams(s) {
  const out = new Set();
  for (const word of normSearch(s).split(" ")) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Jaccard o'xshashligi: umumiy bo'laklar / jami bo'laklar (0…1). */
export function trigramSimilarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / (A.size + B.size - shared);
}

/**
 * So'rovni matnning ENG MOS SO'ZI bilan solishtiradi.
 *
 * ⚠ NEGA BUTUN NOM BILAN SOLISHTIRIB BO'LMAYDI. Jaccard ikkala
 * tomonning bo'laklarini hisobga oladi, ya'ni uzun nom qisqa so'rovni
 * SUYULTIRIB yuboradi: «ketchp» so'rovi «Monarx ketchup» ga qarshi
 * 0.28 ball olardi — chunki «monarx» ning bo'laklari ham maxrajga
 * qo'shilardi — va chegaradan o'tmasdi. Ya'ni bitta harfi tushib
 * qolgan so'z topilmasdi, holbuki fuzzy qidiruv aynan shuning uchun
 * kerak edi.
 *
 * ⚠ Bu `pg_trgm` dagi `word_similarity` bilan BIR XIL ma'no: so'rov
 * matnning eng o'xshash SO'ZI bilan taqqoslanadi. Server ham shu
 * funksiyani ishlatadi — ikki tomon bir xil hisoblashi shart.
 */
export function wordSimilarity(query, text) {
  let best = trigramSimilarity(query, text);        // butun nom — ko'p so'zli so'rov uchun
  for (const w of normSearch(text).split(" ")) {
    if (w) best = Math.max(best, trigramSimilarity(query, w));
  }
  return best;
}

/* ── Reyting ─────────────────────────────────────────────────────────── */

/**
 * Bosqichlar — YUQORIDAN PASTGA. Har biri o'zidan keyingisidan aniq
 * ustun turadi, ya'ni «aniq barkod» hech qachon «o'xshash nom» ostida
 * qolmaydi.
 *
 * ⚠ Sonlar orasidagi masofa KATTA (100 lik qadam): ichki qo'shimchalar
 * (nom uzunligi jarimasi) bosqichlarni hech qachon aralashtirib
 * yubormasligi kerak.
 */
export const RANK = {
  CODE_EXACT:   1000,   // barkod/artikul aynan mos
  NAME_EXACT:    900,   // nom aynan mos
  NAME_PREFIX:   800,   // nom shu bilan boshlanadi
  WORD_PREFIX:   700,   // biror so'z shu bilan boshlanadi
  CONTAINS:      600,   // nom ichida uchraydi
  ALL_TOKENS:    500,   // barcha so'zlar bor (tartibi muhim emas)
  FUZZY:         100,   // o'xshash (trigramm)
};

/**
 * Shu balldan past o'xshashlik natijaga umuman kirmaydi.
 *
 * ⚠ 0.3 — `pg_trgm` ning O'Z standart chegarasi
 * (`pg_trgm.similarity_threshold`). Server ham shu bilan ishlaydi,
 * ya'ni mahalliy va serverdagi natijalar bir xil chegaradan o'tadi.
 * Undan yuqori qilinsa, o'rtadagi ikki harfi almashgan so'z
 * («kecthup») topilmay qolardi — holbuki fuzzy qidiruv aynan shuning
 * uchun kerak.
 */
export const FUZZY_MIN = 0.3;

/**
 * Tovarning so'rovga mosligi. `0` — umuman mos emas.
 *
 * ⚠ UZUN NOM JARIMA OLADI (`- len/1000`). Bir xil bosqichdagi ikki
 * tovardan qisqarog'i odatda aynan qidirilgani bo'ladi: «Suv 1L»
 * «Ichimlik suvi gazsiz 1.5L» dan oldin turishi kerak.
 */
export function scoreProduct(product, query) {
  const q = normSearch(query);
  if (!q) return 0;

  const raw = String(query).trim();
  if (raw && (product.barcode === raw || product.sku === raw || product.plu === raw)) {
    return RANK.CODE_EXACT;
  }

  const name = normSearch(product.name);
  if (!name) return 0;

  const penalty = name.length / 1000;
  let base = 0;

  if (name === q) base = RANK.NAME_EXACT;
  else if (name.startsWith(q)) base = RANK.NAME_PREFIX;
  else if (name.split(" ").some((w) => w.startsWith(q))) base = RANK.WORD_PREFIX;
  else if (name.includes(q)) base = RANK.CONTAINS;
  else {
    const tokens = q.split(" ").filter(Boolean);
    if (tokens.length > 1 && tokens.every((tk) => name.includes(tk))) base = RANK.ALL_TOKENS;
    else {
      /* Oxirgi imkoniyat — o'xshashlik. Xato yozilgan yoki apostrofi
         boshqacha nom aynan shu yerda topiladi. */
      const sim = wordSimilarity(q, name);
      if (sim < FUZZY_MIN) return 0;
      base = RANK.FUZZY + sim * 300;
    }
  }
  return base - penalty;
}

/**
 * Mahalliy ro'yxatni saralaydi — SERVER JAVOBINI KUTMASDAN.
 *
 * ⚠ Bu serverni ALMASHTIRMAYDI. Ekranda allaqachon turgan katalog
 * bo'yicha darhol javob beradi (0 ms), server javobi kelgach esa
 * to'liq natija bilan almashtiriladi. Kassir uchun qidiruv «bir zumda»
 * ishlagandek bo'ladi, holbuki to'liqligi baribir serverdan keladi.
 */
export function rankLocal(products, query, limit = 60) {
  if (!query || !Array.isArray(products)) return products || [];
  return products
    .map((p) => ({ p, s: scoreProduct(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}
