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
  у:"u", ф:"f", х:"h", ц:"ts", ч:"ch", ш:"sh", щ:"sh", ъ:"", ы:"i", ь:"",
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
    /* ⚠ «x» va «h» BITTA harf deb qaraladi (V55).
       Kirillcha «х» yuqorida «h» ga o'tdi, bu satr esa LOTINCHA «x» ni
       ham unga qo'shadi.

       Sabab imloda: o'sha tovushni lotinchada odamlar goh «x», goh «h»
       bilan yozadi va bitta ism bazada «Shohruh», qidiruvda esa
       «shoxrux» bo'lib chiqardi — ikkalasi hech qachon uchrashmasdi.
       Trigramm o'xshashligi ham yetmasdi (0.19, chegara 0.3).

       Bu — apostrof qoidasining aynan davomi: odam qaysi belgi
       to'g'ri ekanini bilmaydi, farqni qidiruv o'zi yopishi kerak.

       ⚠ SERVER HAM SHUNDAY QILADI (`ek_search_norm`, V55). Biri
       qolib ketsa, kassir yozayotganda ro'yxat SAKRAB ketardi. */
    .replace(/x/g, "h")
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
  return jaccard(trigrams(a), trigrams(b));
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
export function wordSimilarity(query, text, queryGrams) {
  /* ⚠ `queryGrams` — TAYYOR to'plam (ixtiyoriy). Usiz so'rovning
     trigrammlari HAR TOVAR uchun qaytadan qurilardi: 5000 tovarli
     katalogda bu 5000 marta ortiqcha ish va qidiruv sezilarli
     sekinlashardi. Natijaga ta'sir qilmaydi — bir xil to'plam. */
  const Q = queryGrams || trigrams(query);
  let best = jaccard(Q, trigrams(text));            // butun nom — ko'p so'zli so'rov uchun
  for (const w of normSearch(text).split(" ")) {
    if (w) best = Math.max(best, jaccard(Q, trigrams(w)));
  }
  return best;
}

/** Ikki tayyor to'plam orasidagi Jaccard — `trigramSimilarity` ning yadrosi. */
function jaccard(A, B) {
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / (A.size + B.size - shared);
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
export function scoreText(query, text, queryGrams) {
  const q = normSearch(query);
  const name = normSearch(text);
  if (!q || !name) return 0;

  /* ⚠ UZUN NOM JARIMA OLADI. Bir xil bosqichdagi ikki tovardan
     qisqarog'i odatda aynan qidirilgani bo'ladi: «Suv 1L» «Ichimlik
     suvi gazsiz 1.5L» dan oldin turishi kerak. */
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
      const sim = wordSimilarity(q, name, queryGrams);
      if (sim < FUZZY_MIN) return 0;
      base = RANK.FUZZY + sim * 300;
    }
  }
  return base - penalty;
}

/**
 * RAQAMLI maydon: telefon, chek raqami, hisob raqami.
 *
 * ⚠ NEGA MATNDAN ALOHIDA. Telefonni hech kim to'liq yozmaydi — odam
 * OXIRGI raqamlarni eslaydi («…45 67») yoki operator kodini
 * («90»). Matn qoidasi bunda ishlamaydi: «4567» so'rovi
 * «+998901234567» ning na boshi, na so'zi bilan mos tushadi va
 * trigramm o'xshashligi ham chegaradan o'tmaydi.
 *
 * Shuning uchun ikkala tomondan ham RAQAM BO'LMAGAN belgilar
 * tashlanadi va bo'lak bo'yicha qidiriladi.
 */
export function scoreDigits(query, value) {
  const q = String(query ?? "").replace(/\D/g, "");
  const v = String(value ?? "").replace(/\D/g, "");
  if (!q || !v) return 0;

  if (v === q) return RANK.CODE_EXACT;
  /* Boshi ham, OXIRI ham bir xil vaznda: «90» bilan boshlanadigan
     raqam ham, «4567» bilan tugaydigani ham bir xil darajada
     qidirilgan bo'lishi mumkin. */
  if (v.startsWith(q) || v.endsWith(q)) return RANK.NAME_PREFIX;
  if (v.includes(q)) return RANK.CONTAINS;
  return 0;
}

/**
 * UMUMIY BAHOLASH — istalgan yozuv uchun.
 *
 * ═══ NEGA UMUMIY ═══════════════════════════════════════════════════════
 *
 * Ilgari tizimda OLTITA alohida qidiruv bor edi va har biri
 * `nom.toLowerCase().includes(so'rov)` deb yozilgan edi. Bu — eng sodda
 * va eng yomon qidiruv: u apostrofni ham, kirillcha yozuvni ham, xato
 * yozilgan harfni ham topa olmasdi. Kassada bu tuzatilgan edi, qolgan
 * beshta sahifada esa eski holicha qolgan.
 *
 * Endi qoida BITTA joyda. Har sahifa faqat QAYSI MAYDONLAR qidirilishini
 * aytadi:
 *
 *     rankItems(customers, q, {
 *       texts:  (c) => [c.fullName],
 *       digits: (c) => [c.phone],
 *     })
 *
 * @param spec.codes  aynan mos kelishi kerak (barkod, artikul)
 * @param spec.digits raqamli maydon — bo'lak bo'yicha ham topiladi
 * @param spec.texts  nomlar — to'liq reyting bosqichlari
 */
export function scoreItem(item, query, spec, queryGrams) {
  const raw = String(query ?? "").trim();
  if (!raw) return 0;

  /* ⚠ KODLAR BIRINCHI va AYNAN mos kelishi shart. Skanerlangan barkod
     nomdan har doim ustun turishi kerak — aks holda «Coca-Cola 1L»
     so'rovi bilan skanerlangan kod bir xil vaznda bo'lib qolardi. */
  for (const code of spec.codes?.(item) || []) {
    if (code && String(code) === raw) return RANK.CODE_EXACT;
  }

  let best = 0;
  for (const value of spec.digits?.(item) || []) {
    best = Math.max(best, scoreDigits(raw, value));
  }
  const texts = spec.texts?.(item) || [];
  for (let i = 0; i < texts.length; i++) {
    /* ⚠ Maydon tartibi ARZIMAS jarima oladi (`i/10000`): ismi mos
       kelgan mijoz, familiyasi mos kelganidan oldin tursin. Jarima
       nom uzunligi jarimasidan ham kichik, ya'ni bosqichlarni
       aralashtirib yubormaydi. */
    const s = scoreText(raw, texts[i], queryGrams);
    if (s > 0) best = Math.max(best, s - i / 10000);
  }
  return best;
}

/**
 * Ro'yxatni so'rov bo'yicha saralaydi va mos kelmaganini tashlaydi.
 *
 * ⚠ So'rovning trigrammlari BIR MARTA quriladi va hamma yozuvga
 * uzatiladi — 5000 tovarli katalogda bu 5000 marta ortiqcha ishni
 * yo'q qiladi.
 *
 * ⚠ Bo'sh so'rovda ro'yxat O'ZGARMASDAN qaytadi: filtr yo'q paytda
 * sahifa o'z tartibini (masalan sotuv sanasi) saqlab qolishi kerak.
 */
export function rankItems(items, query, spec, limit = 0) {
  if (!query || !Array.isArray(items)) return items || [];
  const grams = trigrams(query);
  const scored = items
    .map((it) => ({ it, s: scoreItem(it, query, spec, grams) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return (limit > 0 ? scored.slice(0, limit) : scored).map((x) => x.it);
}

/* ── Tovar (kassa) ───────────────────────────────────────────────────── */

/** Tovar maydonlari — `scoreProduct` va `rankLocal` uchun. */
export const PRODUCT_SPEC = {
  codes: (p) => [p.barcode, p.sku, p.plu],
  texts: (p) => [p.name],
};

/** Tovarning so'rovga mosligi. `0` — umuman mos emas. */
export function scoreProduct(product, query, queryGrams) {
  return scoreItem(product, query, PRODUCT_SPEC, queryGrams);
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
  return rankItems(products, query, PRODUCT_SPEC, limit);
}
