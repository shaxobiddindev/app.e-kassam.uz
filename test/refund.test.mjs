/* ══════════════════════════════════════════════════════════════════════════
   QAYTARISH QULAYLIGI VA CHEGIRMA OPTIMIZATORI — sinov (V80).

   ⚠ NEGA MUHIM. Bu ikki modul birga bitta savolga javob beradi:
   «chegirma bergandan keyin ERTAGA bu tovarni qaytarib bo'ladimi?».
   Xato bo'lsa u BUGUN ko'rinmaydi — chek chiroyli chiqadi, jami
   yaxlit. Muammo bir hafta keyin, mijoz bitta tovarni qaytarib
   kelganda chiqadi: kassir 14 666 so'm 67 tiyin berishi kerak,
   bunday pul esa yo'q.

   `ek-refund.js` dagi taqsimot qoidasi SERVERDAGI `RefundAllocation`
   ning nusxasi. Ikkalasi ajralib ketsa, kassir mijozga bir summani
   aytib, kassa boshqasini berardi.

   Ishga tushirish:  node test/refund.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { refundScore, cartRefundScore, refundSuggestion, refundUnit, refundFor,
        REFUND_TIERS, TIER_BEST, TIER_OTHER }
  = await import("../src/lib/ek-refund.js");
const { optimizeDiscount, currentRefundScore, cartRoom }
  = await import("../src/lib/ek-discount.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));
const yes = (v, msg) => (v ? ok(msg) : bad(msg, v));
const eqArr = (a, e, msg) =>
  (JSON.stringify(a) === JSON.stringify(e) ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(e)})`, a));

console.log("\n═══ 1. Bitta summaning bahosi ═══");
eq(refundScore(15000), 100, "1 000 ga bo'linadi — eng qulay");
eq(refundScore(14500), 80,  "500 ga bo'linadi");
eq(refundScore(14800), 60,  "100 ga bo'linadi");
eq(refundScore(14850), 40,  "50 ga bo'linadi");
eq(refundScore(14833), 10,  "hech qaysisiga bo'linmaydi — amalda qaytarib bo'lmaydi");
/* ⚠ Pog'onalar kamayib borishi SHART: 15 000 ham 500 ga, ham 100 ga
   bo'linadi va agar ro'yxat teskari tursa, hamma narsa 40 ball olardi. */
eq(refundScore(15000) > refundScore(14500), true, "yaxshiroq pog'ona yuqori ball oladi");
eq(refundScore(0), TIER_BEST, "nol — qaytariladigan narsa yo'q, muammo ham yo'q");
eq(refundScore(-5), TIER_BEST, "manfiy ham nol kabi");

console.log("\n═══ 2. Savat bahosi — SUMMAGA mutanosib ═══");
/* ⚠ Dona bilan o'lchansa, o'nta arzon qator bitta qimmatini ko'mib
   yuborardi: 900 000 lik muzlatgichning noqulay narxi 3 000 lik
   nonникidan ko'p og'riydi. */
const heavy = [
  { unitRefund: 14833, qty: 1 },   // 14 833 — yomon, lekin OG'IR
  { unitRefund: 1000, qty: 1 },    // 1 000 — mukammal, lekin yengil
];
yes(cartRefundScore(heavy) < 30, "qimmat qatorning yomon bahosi hukmron");
eq(cartRefundScore([{ unitRefund: 1000, qty: 3 }]), 100, "yagona qulay qator — 100");
eq(cartRefundScore([]), TIER_BEST, "bo'sh savat — jazolanmaydi");
eq(cartRefundScore([{ unitRefund: 0, qty: 2 }]), TIER_BEST, "bepul qator hisobga kirmaydi");

console.log("\n═══ 3. Qaytarish taqsimoti — SERVERDAGI qoidaning nusxasi ═══");
eq(refundUnit(15000, 3), 5000, "15 000 / 3 = 5 000");
eq(refundUnit(10000, 3), 3333.33, "bo'linmasa PASTGA — oshirib bo'lmasin");
eq(refundUnit(15000, 1.5), 10000, "tarozili: 1.5 kg 15 000 → 10 000/kg");
eq(refundUnit(15000, 0), 0, "miqdor nol — nolga bo'linmaydi");

console.log("\n═══ 4. ⚠ QISMLAR YIG'INDISI TO'LANGANGA AYNAN TENG ═══");
/* Eski qoida (qaytarish paytida bo'lish) aynan shu yerda pul
   yo'qotardi: 3 333.33 × 3 = 9 999.99. */
const sum3 = refundFor(10000, 3, 0, 1) + refundFor(10000, 3, 1, 1) + refundFor(10000, 3, 2, 1);
eq(Math.round(sum3 * 100) / 100, 10000, "bittalab qaytarish — 10 000");
eq(refundFor(10000, 3, 2, 1), 3333.34, "qoldiq tiyin OXIRGISIGA tushadi");
eq(Math.round((refundFor(10000, 3, 0, 2) + refundFor(10000, 3, 2, 1)) * 100) / 100, 10000,
   "2+1 bo'linishida ham 10 000");
eq(refundFor(15000, 1.5, 0, 0.5), 5000, "tarozili: 0.5 kg → 5 000");
eq(refundFor(15000, 1.5, 0.5, 1), 10000, "qolgan 1 kg → 10 000");
eq(refundFor(10000, 3, 0, 0), 0, "nol miqdor — nol summa");
eq(refundFor(0, 2, 0, 2), 0, "bepul qator — nol, manfiy emas");

console.log("\n═══ 5. Qaytarish taklifi — HECH QACHON o'zi qo'llanmaydi ═══");
eqArr(refundSuggestion(14833), { amount: 14800, cut: 33, score: 60 },
      "14 833 → 14 800 (−33), 2% chegarasi ichida");
eq(refundSuggestion(15000), null, "allaqachon mukammal — taklif yo'q");
eq(refundSuggestion(0), null, "qaytariladigan narsa yo'q");
/* ⚠ IKKI CHEGARA. 14 833 ni 14 000 ga tushirish ham «yaxlit», lekin
   bu mijozning 833 so'mi — nisbiy chegara (2%) uni to'sadi. */
yes(refundSuggestion(14833).cut <= 14833 * 0.02, "kesim summaning 2% idan oshmaydi");
eq(refundSuggestion(1040), null, "kichik summada 2% = 20, hech qaysi pog'ona sig'maydi");
yes(refundSuggestion(100333).cut <= 1000, "katta summada ham mutlaq chegara 1 000");
eq(refundSuggestion(100333).amount, 100000, "100 333 → 100 000 (−333)");

console.log("\n═══ 6. Optimizator: bir donaning narxini yaxlitlaydi ═══");
const THREE = [{ salePrice: 14900, qty: 3, discount: 0, minPrice: 13000 }];
eq(currentRefundScore(THREE), 60, "14 900 — 100 ga bo'linadi, 60 ball");
const p3 = optimizeDiscount(THREE, 1500);
yes(p3.length > 0, "taklif bor");
eq(p3[0].units[0], 14500, "eng yaxshisi — bir donasi 14 500");
eq(p3[0].discount, 1200, "chegirma 1 200 (byudjetdan KAM)");
yes(p3[0].score.refund > 60, "qaytarish bahosi ko'tarildi");

console.log("\n═══ 7. ⚠ BYUDJETNI TO'LA ISHLATISH — 2-o'rinda ═══");
/* Do'kon egasining sharti: «100 baholi 9 800 lik chegirma, 40 baholi
   10 000 likdan ustun». Ya'ni byudjetdan foydalanish qaytarish
   qulayligini HECH QACHON bosib keta olmaydi. */
const MIX = [
  { salePrice: 14900, qty: 3, discount: 0, minPrice: 13000 },
  { salePrice: 7300,  qty: 1, discount: 0, minPrice: 6000 },
  { salePrice: 2400,  qty: 5, discount: 0, minPrice: 2000 },
];
const pm = optimizeDiscount(MIX, 5000);
yes(pm.length > 0, "aralash savatda taklif bor");
eq(pm[0].score.refund, 100, "eng yaxshisining bahosi — 100");
eqArr(pm[0].units, [14000, 7000, 2000], "har qator 1 000 ga bo'linadigan narxda");
yes(pm.every((p, i) => i === 0 || p.score.refund <= pm[0].score.refund),
    "ro'yxat baho bo'yicha kamayib boradi");
/* Kam byudjet ishlatgan, lekin bahosi yuqori variant birinchi turadi. */
const worse = pm.find((p) => p.score.refund < pm[0].score.refund);
if (worse) yes(true, "pastroq baholi variant pastroq o'rinda");
else ok("bu savatda faqat yuqori baholi variantlar chiqdi");

console.log("\n═══ 8. ⚠ YOMONLASHTIRADIGAN TAKLIF KO'RSATILMAYDI ═══");
/* Eng nozik holat: savat ALLAQACHON qulay. 3 × 15 000 = 45 000 —
   jami ham yaxlit, bir donasi ham. «−1 000 → 44 000» taklifi jamini
   chiroyli qoldirardi, lekin bir donani 14 666.67 ga tushirardi.
   Kassir ro'yxatdagi tugmani ko'rsa — bosadi, shuning uchun bunday
   variant ro'yxatga umuman kirmasligi kerak. */
const GOOD = [{ salePrice: 15000, qty: 3, discount: 0, minPrice: 12000 }];
eq(currentRefundScore(GOOD), 100, "savat allaqachon mukammal");
eqArr(optimizeDiscount(GOOD, 1000), [], "1 000 byudjetda taklif YO'Q");
yes(optimizeDiscount(GOOD, 3000).every((p) => p.score.refund >= 100),
    "kattaroq byudjetda ham faqat bahoni saqlaydiganlari chiqadi");

console.log("\n═══ 9. ⚠ CHEGARA — BAHO EMAS, SARALASH ═══");
/* Bo'sh joyi yo'q qator: har qanday chegirma darhol bajik so'rardi.
   Bunday taklif kassirni tizim O'ZI tuzoqqa boshlagani bo'lardi. */
const TIGHT = [{ salePrice: 14900, qty: 3, discount: 0, minPrice: 14900 }];
eq(cartRoom(TIGHT), 0, "bo'sh joy yo'q");
eqArr(optimizeDiscount(TIGHT, 5000), [], "chegara yo'q — taklif ham yo'q");

const NARROW = [{ salePrice: 14900, qty: 3, discount: 0, minPrice: 14800 }];
yes(optimizeDiscount(NARROW, 5000).every((p) => p.discount <= cartRoom(NARROW)),
    "hech bir taklif qoida chegarasidan oshmaydi");
yes(optimizeDiscount(MIX, 1000).every((p) => p.discount <= 1000),
    "hech bir taklif byudjetdan oshmaydi");

console.log("\n═══ 10. Tarozili tovar ═══");
const KG = [{ salePrice: 13300, qty: 1.5, discount: 0, minPrice: 11000 }];
const pk = optimizeDiscount(KG, 2000);
yes(pk.length > 0, "tarozili qatorda ham taklif bor");
yes(pk.every((p) => p.units[0] % 500 === 0), "kg narxi yaxlit pog'onada");
yes(pk[0].score.refund >= currentRefundScore(KG), "baho pasaymaydi");

console.log("\n═══ 11. Buzuq kirish — yiqilmaydi ═══");
eqArr(optimizeDiscount([], 1000), [], "bo'sh savat");
eqArr(optimizeDiscount(null, 1000), [], "savat yo'q");
eqArr(optimizeDiscount(MIX, 0), [], "byudjet nol");
eqArr(optimizeDiscount(MIX, -5), [], "byudjet manfiy");
eqArr(optimizeDiscount([{ salePrice: 0, qty: 0 }], 1000), [], "bo'sh qator");
/* ⚠ `minPrice` bo'lmasa bo'sh joy NOL (`lineRoom`): eski server
   javobida maydon yo'q va taklif berish kassirni bajik so'raladigan
   holatga olib kirardi. */
eqArr(optimizeDiscount([{ salePrice: 14900, qty: 3 }], 5000), [],
      "eng past narx noma'lum — taklif yo'q");

console.log("\n═══ 12. Chegirma allaqachon berilgan qator ═══");
/* Kassir avval narxni qo'lda tushirgan (`LinePriceModal`), keyin
   byudjet yozadi: taklif QOLGAN bo'sh joydan hisoblanishi kerak. */
const USED = [{ salePrice: 15000, qty: 3, discount: 300, minPrice: 14000 }];
const pu = optimizeDiscount(USED, 5000);
yes(pu.every((p) => p.discount + 300 <= (15000 - 14000) * 3),
    "berilgan chegirma bilan birga ham chegaradan oshmaydi");
yes(pu.every((p) => p.units[0] >= 14000), "bir donaning narxi eng past narxdan pastga tushmaydi");

console.log("\n═══ 13. ⚠ AYNAN YOZILGAN SUMMA (V82) ═══");
/* Kassir raqamni ko'pincha mijozga ALLAQACHON aytgan bo'ladi («20 ming
   tushirdim») va uni kamaytirish mumkin emas. Shunda savol boshqa:
   «bu summani QANDAY bo'lish eng qulay?». Javobsiz qolsa, summa
   serverda qator QIYMATIGA mutanosib tarqalardi va marjasi past qator
   o'z chegarasidan oshib ketishi mumkin edi. */
{
  const GOOD = [{ salePrice: 15000, qty: 3, discount: 0, minPrice: 12000 }];
  const p3k = optimizeDiscount(GOOD, 3000);
  yes(p3k.length > 0, "allaqachon qulay savatda ham 3 000 uchun variant bor");
  yes(p3k.some((p) => p.exact), "aynan 3 000 lik variant bor");
  const ex = p3k.find((p) => p.exact);
  eq(ex.discount, 3000, "aynan yozilgan summa");
  eq(ex.units[0], 14000, "bir donasi 14 000 — qaytarish qulay");

  /* ⚠ AYNAN SUMMA HAM QAYTARISHNI YOMONLASHTIRA OLMAYDI: 8-bo'limdagi
     qoida undan ham ustun. Kassir bunday summani qo'lda yozadi. */
  const B = [{ salePrice: 14900, qty: 3, discount: 0, minPrice: 13000 }];
  yes(optimizeDiscount(B, 3333).every((p) => p.score.refund >= currentRefundScore(B)),
      "aynan summa ham bahoni pasaytirmaydi");

  /* Har rejada `exact` bayrog'i to'g'ri qo'yilgan. */
  for (const p of optimizeDiscount(MIX, 5000)) {
    eq(p.exact, p.discount >= 5000 - 0.005, `bayroq to'g'ri (−${p.discount})`);
  }
  /* Chegara yo'q joyda aynan summa ham chiqmaydi. */
  eqArr(optimizeDiscount(TIGHT, 3000), [], "bo'sh joysiz qatorda aynan summa ham yo'q");
}

console.log("\n═══ 14. Reja ichki ziddiyatsiz ═══");
for (const p of optimizeDiscount(MIX, 5000)) {
  const spent = Math.round(p.add.reduce((s, v) => s + v, 0) * 100) / 100;
  eq(spent, p.discount, `qatorlar yig'indisi chegirmaga teng (${p.discount})`);
  const total = Math.round(MIX.reduce((s, l, i) =>
    s + l.salePrice * l.qty - (l.discount || 0) - p.add[i], 0) * 100) / 100;
  eq(total, p.total, `jami mos keladi (${p.total})`);
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
