/* ══════════════════════════════════════════════════════════════════════════
   QAYTARISH QULAYLIGI (V80)

   ═══ MUAMMONING KELIB CHIQISHI ════════════════════════════════════════

   Chegirma takliflari shu paytgacha bitta savolga javob berardi:
   «CHEK JAMISI yaxlit bo'lsinmi?». 44 200 lik chekdan 200 tushirib
   44 000 qilish — kassa uchun qulay, mijoz uchun tushunarli.

   Lekin ERTAGA mijoz shu chekdan bitta tovarni qaytarib keladi. Va o'sha
   paytda ma'lum bo'ladiki, jami yaxlit bo'lgani bilan BIR DONANING
   narxi 14 733.33 ekan. Kassir mijozga 14 733 so'm 33 tiyin qaytarishi
   kerak — bunday pul yo'q. U yaxlitlaydi, ayirma esa hisobsiz qoladi;
   qaytarish qanchalik ko'p bo'lsa, farq shuncha o'sadi.

   ═══ QOIDA ════════════════════════════════════════════════════════════

   Chegirma tanlashda IKKI shart bir vaqtda qaraladi: jami ham qulay
   bo'lsin, BIR DONANING narxi ham. Ikkalasi to'qnashsa — bir dona
   ustun: jami bilan bir marta ishlanadi, bir donaning narxi esa har
   qaytarishda qaytadan chiqadi.

   Baho pog'onalari (do'kon egasi belgilagan tartib):

       1 000 ga bo'linadi → 100   eng qulay: maydasiz beriladi
         500 ga bo'linadi →  80   yarim minglik ham bor
         100 ga bo'linadi →  60   chidasa bo'ladi
          50 ga bo'linadi →  40   noqulay, lekin sanaladi
       boshqasi          →  10   amalda qaytarib bo'lmaydi

   ⚠ Shu sabab 100 baholi 9 800 lik chegirma 40 baholi 10 000 likdan
   USTUN turadi — garchi ikkinchisi byudjetni to'laroq ishlatsa ham.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Yaxlitlik pog'onalari — yaxshisidan yomoniga.
 *
 * ⚠ TARTIB MUHIM: qidiruv birinchi mos kelganida to'xtaydi, ya'ni
 * ro'yxat kamayib borishi shart. 1 000 ga bo'linadigan son 500 ga ham
 * bo'linadi va agar 500 birinchi tursa, hamma narsa 80 ball olardi.
 */
export const REFUND_TIERS = [
  { step: 1000, score: 100 },
  { step: 500, score: 80 },
  { step: 100, score: 60 },
  { step: 50, score: 40 },
];

/** Hech qaysi pog'onaga tushmagan summa. */
export const TIER_OTHER = 10;

/** Eng yuqori baho — «bundan yaxshisi yo'q» degan tekshiruv uchun. */
export const TIER_BEST = REFUND_TIERS[0].score;

/**
 * Bitta summaning qaytarish qulayligi: 0–100.
 *
 * ⚠ NOL — MUKAMMAL. Qaytariladigan narsa yo'q bo'lsa (bepul tovar,
 * to'liq chegirma) qaytarish muammosi ham yo'q. Uni «yomon» deb
 * baholash bepul qatorli chekni sun'iy ravishda pastga tushirardi.
 */
export function refundScore(amount, tiers = REFUND_TIERS) {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return TIER_BEST;
  for (const t of tiers) {
    if (n % t.step === 0) return t.score;
  }
  return TIER_OTHER;
}

/**
 * Savatning umumiy qaytarish qulayligi.
 *
 * ⚠ QATOR SUMMASIGA MUTANOSIB, dona soniga emas. 900 000 lik
 * muzlatgichning noqulay narxi 3 000 lik nonникidan ko'p og'riydi:
 * qaytarishda aynan katta summa muammo tug'diradi. Dona bilan
 * o'lchansa, o'nta arzon qator bitta qimmatini ko'mib yuborardi.
 *
 * @param lines `{ unitRefund, qty }` — bir donaning summasi va miqdor
 */
export function cartRefundScore(lines, tiers = REFUND_TIERS) {
  let weight = 0;
  let sum = 0;
  for (const l of lines || []) {
    const unit = Number(l.unitRefund) || 0;
    const qty = Number(l.qty) || 0;
    const w = Math.max(0, unit * qty);
    if (w <= 0) continue;
    sum += refundScore(unit, tiers) * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : TIER_BEST;
}

/**
 * Qaytarishda kassirga ko'rsatiladigan TAKLIF — hech qachon o'zi
 * qo'llanmaydi.
 *
 * ═══ NEGA AVTOMATIK EMAS ══════════════════════════════════════════════
 *
 * Qaytariladigan summa sotuv paytida muzlatilgan taqsimotdan chiqadi
 * va u — mijoz TO'LAGAN pul. Tizim uni o'zi kamaytirsa, mijoz chekni
 * ko'rsatib «bu yerda boshqa raqam» derdi va haq bo'lardi. Shuning
 * uchun bu yerdan faqat TAKLIF chiqadi; uni kassir bosadi, mijoz
 * ko'radi va farq jurnalga tushadi.
 *
 * ═══ NEGA IKKI CHEGARA ════════════════════════════════════════════════
 *
 * 14 833 ni 14 000 ga tushirish ham «yaxlit» — lekin bu mijozning
 * 833 so'mi. Shuning uchun kesim IKKI tomondan bo'g'iladi:
 *
 *   · mutlaq — 1 000 so'mdan ortiq emas (bir marta ham katta bo'lmasin);
 *   · nisbiy — summaning 2% idan ortiq emas (kichik qaytarishda
 *     1 000 ning o'zi ham juda ko'p).
 *
 * 14 833 uchun: 2% = 296, ya'ni 14 000 (−833) ham, 14 500 (−333) ham
 * o'tmaydi; 14 800 (−33) o'tadi. Aynan shu — kassirning amaldagi
 * javobi.
 *
 * @returns `{ amount, cut, score }` yoki `null` (taklif yo'q)
 */
export const SUGGEST_MAX_CUT = 1000;
export const SUGGEST_MAX_SHARE = 0.02;

export function refundSuggestion(exact, opts = {}) {
  const n = Math.round(Number(exact) || 0);
  if (n <= 0) return null;
  /* Allaqachon eng qulay — taklif berish kassirni bekorga chalg'itardi. */
  if (refundScore(n) >= TIER_BEST) return null;

  const maxCut = Math.min(
    opts.maxCut == null ? SUGGEST_MAX_CUT : opts.maxCut,
    n * (opts.maxShare == null ? SUGGEST_MAX_SHARE : opts.maxShare),
  );
  if (maxCut < 1) return null;

  /* Pog'onalar yaxshisidan yomoniga tekshiriladi: sig'adiganlaridan
     ENG QULAYI olinadi. */
  for (const t of REFUND_TIERS) {
    const v = Math.floor(n / t.step) * t.step;
    if (v <= 0 || v >= n) continue;
    const cut = n - v;
    if (cut <= maxCut) return { amount: v, cut, score: t.score };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   MUZLATILGAN TAQSIMOT — SERVERDAGI QOIDANING NUSXASI

   ⚠⚠ `RefundAllocation.java` bilan BIR XIL bo'lishi SHART. Kassir
   qaytarish oynasida summani tugmani bosishdan OLDIN ko'radi va u
   serverdan chiqadigan raqam bilan aynan bir xil bo'lishi kerak —
   aks holda kassir mijozga bir summani aytib, boshqasini berardi.

   Qoida: bir dona = to'langan / miqdor, ikki xonagacha PASTGA. Qoldiq
   tiyin OXIRGI qaytarishga qo'shiladi, ya'ni qismlar yig'indisi
   to'langan summaga aynan teng chiqadi.
   ══════════════════════════════════════════════════════════════════════════ */

const down2 = (v) => Math.floor((Number(v) || 0) * 100) / 100;

/** Bir dona (kg) uchun qaytariladigan summa. */
export function refundUnit(paid, qty) {
  const p = Number(paid) || 0;
  const q = Number(qty) || 0;
  if (q <= 0 || p <= 0) return 0;
  return down2(p / q);
}

/**
 * Qaytariladigan summa.
 *
 * @param paid    qator bo'yicha to'langan jami
 * @param qty     sotilgan miqdor
 * @param already ilgari qaytarilgani
 * @param back    hozir qaytarilayotgani
 */
export function refundFor(paid, qty, already, back) {
  const b = Number(back) || 0;
  if (b <= 0) return 0;
  const q = Number(qty) || 0;
  const prev = Number(already) || 0;
  const unit = refundUnit(paid, q);

  /* Oxirgi (yoki to'liq) qaytarish — qolganning HAMMASI. Qoldiq tiyin
     aynan shu yerda joyiga tushadi. */
  if (prev + b >= q) {
    const given = down2(unit * prev);
    const rest = Math.round(((Number(paid) || 0) - given) * 100) / 100;
    return rest > 0 ? rest : 0;
  }
  return down2(unit * b);
}
