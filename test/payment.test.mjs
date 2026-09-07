/* ══════════════════════════════════════════════════════════════════════════
   TO'LOVNI TAQSIMLASH — sinov (V58).

   ⚠ NEGA MUHIM: bu modul CHEKKA VA KASSAGA tushadigan raqamlarni
   belgilaydi. Bir tiyin xato — smena oxirida kassa hisobi to'g'ri
   kelmaydi va kassir sababini topa olmaydi.

   Do'kon egasining misoli aynan shu yerda qulflangan: jami 100 000,
   naqd 20 000 → qolgani nasiya; keyin Click 15 000 → yana qolgani
   nasiya.

   Ishga tushirish:  node test/payment.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { settle, payType, restFor, savingsMax,
        enteredTotal, enteredParts, enteredMax } = await import("../src/lib/ek-payment.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));
/** Obyektlarni kalit tartibidan qat'i nazar solishtiradi. */
const eqObj = (a, b, m) => {
  const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
  return norm(a) === norm(b) ? ok(m) : bad(m, JSON.stringify(a));
};
const eqArr = (a, b, m) =>
  (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, JSON.stringify(a)));

console.log("\n══ ⚠ SETTLE — qaytim, nasiya va jamg'arma chegarasi ══");
/* ⚠ `settle` — bu moduldagi ENG KATTA funksiya va unda birorta
   sinov yo'q edi. U chekka tushadigan taqsimotni, QAYTIMNI,
   NASIYANI va jamg'arma chegarasini belgilaydi: bu yerdagi xato
   to'g'ridan-to'g'ri kassadagi pulga tegadi. */

console.log("\n─ Naqd: aniq, ortiqcha, kam ─");
{
  const s = settle({ CASH: 50000 }, 50000);
  eq(s.cashPaid, 50000, "aniq to'langanda hammasi chekka tushadi");
  eq(s.change, 0, "qaytim yo'q");
  eq(s.credit, 0, "nasiya yo'q");
}
{
  const s = settle({ CASH: 100000 }, 73000);
  eq(s.cashPaid, 73000, "ortiqcha berilganda chekka FAQAT chek summasi tushadi");
  eq(s.change, 27000, "qolgani qaytim");
  eq(s.credit, 0, "nasiya yo'q");
  eqArr(s.parts, [{ type: "CASH", amount: 73000 }],
        "qatorga KESILGAN naqd ketadi - ortiqcha pul kassaga tushmaydi");
}
{
  const s = settle({ CASH: 30000 }, 50000);
  eq(s.cashPaid, 30000, "kam berilganda bergani chekka tushadi");
  eq(s.credit, 20000, "qolgani NASIYAGA yoziladi");
  eqArr(s.parts.map((p) => p.type), ["CASH", "CREDIT"],
        "nasiya qatori qo'shiladi");
}

console.log("\n─ ⚠⚠ JAMG'ARMADAN NAQD YECHIB BO'LMAYDI (V78 xavfsizlik qoidasi) ─");
{
  /* Ilgari jamg'arma oddiy naqdsiz usul edi: 30 000 lik chekka
     20 000 karta + 20 000 jamg'arma yozilsa, ortiqcha 10 000 QAYTIM
     bo'lib chiqardi — ya'ni mijoz jamg'armasidan NAQD PUL yechib
     olardi va jamg'arma hisob bo'lishdan to'xtardi. */
  const s = settle({ CARD: 20000, SAVINGS: 20000 }, 30000);
  eq(s.savingsPaid, 10000, "jamg'armadan FAQAT qolgan summa yechildi");
  eq(s.savingsCut, 10000, "ortiqchasi kesildi va hisobda qoldi");
  eq(s.change, 0,
     "QAYTIM YO'Q - aks holda mijoz jamg'armasidan naqd pul yechib olardi");
  eq(s.credit, 0, "chek to'liq yopildi");
  eqObj(Object.fromEntries(s.parts.map((p) => [p.type, p.amount])),
        { CARD: 20000, SAVINGS: 10000 },
        "qatorga kesilgan jamg'arma ketadi");
}
{
  /* ⚠ Chegara NAQDDAN KEYIN ham hisoblanadi. */
  const s = settle({ CASH: 20000, SAVINGS: 20000 }, 30000);
  eq(s.savingsPaid, 10000, "naqd bergan bo'lsa jamg'armadan faqat qolgani yechiladi");
  eq(s.change, 0, "naqd ham to'liq ishlatildi, qaytim yo'q");
}
{
  const s = settle({ SAVINGS: 90000 }, 30000);
  eq(s.savingsPaid, 30000, "jamg'arma yolg'iz bo'lsa ham chek summasidan oshmaydi");
  eq(s.savingsCut, 60000, "qolgani tegilmadi");
  eq(s.change, 0, "va qaytim yaratmadi");
}

console.log("\n─ ⚠ NAQDSIZ ORTIQCHA — qaytim emas, JAMG'ARMAGA ─");
{
  /* Terminal aynan so'ralgan summani oladi va u yerdan naqd
     QAYTMAYDI. Shuning uchun bu pulni mijozga qo'lda berib
     bo'lmaydi - uning yagona to'g'ri manzili jamg'arma. */
  const s = settle({ CARD: 50000 }, 30000);
  eq(s.over, 20000, "naqdsiz ortiqcha alohida hisoblanadi");
  eq(s.change, 0, "QAYTIM EMAS - kartadan naqd qaytmaydi");
  eq(s.excess, 20000, "ortiqcha jamg'armaga yo'naltiriladi");
  eq(s.credit, 0, "nasiya yo'q");
}
{
  /* Ikkala ortiqcha ham bitta raqamga yig'iladi. */
  const s = settle({ CASH: 40000, CARD: 50000 }, 30000);
  eq(s.excess, s.change + s.over, "ortiqcha = qaytim + naqdsiz ortiqcha");
}

console.log("\n─ Aralash va tartib ─");
{
  const s = settle({ CLICK: 15000, CASH: 20000 }, 100000);
  eq(s.others, 15000, "naqdsiz jami");
  eq(s.cashPaid, 20000, "naqd to'liq ishlatildi");
  eq(s.credit, 65000, "qolgani nasiyaga");
  eqArr(s.parts.map((p) => p.type), ["CASH", "CLICK", "CREDIT"],
        "qatorlar TARTIBDA: naqd birinchi, nasiya oxirida");
}

console.log("\n─ Buzuq kiritish yiqitmaydi ─");
{
  eq(settle(null, 50000).credit, 50000, "kiritish yo'q - hammasi nasiya");
  eq(settle({}, 0).credit, 0, "bo'sh chek - nol");
  eq(settle({ CASH: "30000" }, 50000).cashPaid, 30000, "matn ko'rinishidagi raqam");
  eq(settle({ CASH: -5000 }, 50000).cashPaid, 0, "manfiy kiritish e'tiborsiz");
  eq(settle({ CASH: "abc" }, 50000).cashPaid, 0, "raqam bo'lmagan qiymat - nol, NaN emas");
  eq(settle({ CASH: 50000 }, null).change, 50000, "chek summasi yo'q - hammasi qaytim");
  eqArr(settle({ CASH: 0, CARD: 0 }, 0).parts, [], "nol qatorlar tashlanadi");
}

console.log("── Do'kon egasining misoli ──");

const s1 = settle({ CASH: 20000 }, 100000);
eq(s1.credit, 80000, "naqd 20 000 → qolgan 80 000 NASIYAGA");
eq(s1.change, 0, "qaytim yo'q");

const s2 = settle({ CASH: 20000, CLICK: 15000 }, 100000);
eq(s2.credit, 65000, "Click 15 000 qo'shildi → nasiya 65 000");
eqArr(s2.parts, [
  { type: "CASH", amount: 20000 },
  { type: "CLICK", amount: 15000 },
  { type: "CREDIT", amount: 65000 },
], "chekka uchala qism ham tushadi");

/* ⚠ Yozilmagan chek — BUTUNLAY nasiya. Bu «hammasini qarzga» yo'li:
   kassir hech narsa yozmaydi. */
eq(settle({}, 100000).credit, 100000, "hech narsa yozilmasa — hammasi nasiya");

console.log("\n── Qaytim faqat NAQDDA ──");

const s3 = settle({ CASH: 150000 }, 100000);
eq(s3.change, 50000, "150 000 berdi → qaytim 50 000");
eq(s3.credit, 0, "nasiya yo'q");
eqArr(s3.parts, [{ type: "CASH", amount: 100000 }],
      "chekka KESILGAN naqd tushadi — ortiqcha pul kassaga kirmaydi");

/* ⚠ Kartada ortiqcha — XATO, qaytim emas: terminal aynan so'ralgan
   summani oladi va u yerdan pul qaytmaydi. */
const s4 = settle({ CARD: 150000 }, 100000);
eq(s4.over, 50000, "kartada ortiqcha — «over» deb belgilanadi");
eq(s4.change, 0, "kartadan qaytim BERILMAYDI");

/* Naqd + naqdsiz: naqd faqat QOLGANINI yopadi. */
const s5 = settle({ CLICK: 40000, CASH: 100000 }, 100000);
eq(s5.cashPaid, 60000, "naqddan faqat 60 000 kerak");
eq(s5.change, 40000, "qolgan 40 000 — qaytim");
eq(s5.credit, 0, "nasiya yo'q");

console.log("\n── Chegaralar ──");

eq(settle({ CASH: 100000 }, 100000).credit, 0, "aniq summa — nasiyasiz");
eq(settle({ CASH: 0 }, 100000).credit, 100000, "nol yozilsa ham hammasi nasiya");
eq(settle({ CASH: "-500" }, 100000).credit, 100000, "manfiy qiymat e'tiborsiz");
eq(settle({ CASH: "abc" }, 100000).credit, 100000, "son bo'lmagan qiymat e'tiborsiz");
eqArr(settle({ CASH: 50000 }, 0).parts, [], "jami nol — chek bo'sh");
eq(settle(null, 100000).credit, 100000, "kirish yo'q — yiqilmaydi");

console.log("\n── Chekning turi ──");

eq(payType(settle({ CASH: 100000 }, 100000).parts), "CASH", "bitta usul — o'sha usul");
eq(payType(settle({ CARD: 100000 }, 100000).parts), "CARD", "karta");
eq(payType(settle({ CASH: 20000 }, 100000).parts), "MIXED", "naqd + nasiya — aralash");
eq(payType(settle({}, 100000).parts), "CREDIT", "butunlay nasiya");
/* ⚠ «Aralash» EKRANDAN yo'qoldi, lekin HISOBOTDA qoladi: aks holda
   bir chek ikki bo'limda sanalardi. */
eq(payType([]), "CASH", "bo'sh ro'yxat — yiqilmaydi");

console.log("\n── «Qolganini» tugmasi ──");

/* ⚠ SHU usulning o'zi hisobga olinmaydi: kassir 20 000 yozib, keyin
   «qolganini» bossa, u 20 000 ustiga QO'SHILMAYDI — almashadi. */
eq(restFor({ CASH: 20000 }, 100000, "CASH"), 100000, "naqdning o'zi hisobga olinmaydi");
eq(restFor({ CASH: 20000 }, 100000, "CLICK"), 80000, "Click uchun qolgani 80 000");
eq(restFor({ CASH: 20000, CLICK: 15000 }, 100000, "CARD"), 65000, "kartaga qolgani 65 000");
eq(restFor({ CASH: 200000 }, 100000, "CARD"), 0, "ortiqcha to'langanda — nol");

console.log("\n── Bo'sh maydon: to'lov yo'q (V86) ──");

/* ══ SUMMA KIRITILMASA — TO'LOV YO'Q (V86) ═══════════════════════════

   ⚠ ILGARI BO'SH MAYDON «HAMMASI NAQD» DEGANI EDI (`effective`) va bu
   qulaylik deb qo'yilgan edi. Amalda esa pul hisobini buzardi:
   hisobda kassir YOZMAGAN «Naqd 20 000» qatori o'zi paydo bo'lardi,
   uni ✕ bilan o'chirib ham bo'lmasdi (u `paid` da yo'q edi), Click
   tanlangan bo'lsa ham «naqd» derdi. Yashikda bo'lmagan pul
   ko'rinardi va farq faqat smena yopilganda chiqardi.

   Endi qoida bitta va istisnosiz: kiritilmagan pul — to'lov emas.
   `settle` bo'sh kirishda hech qanday qism qaytarmaydi; ekran esa
   «Sotish» tugmasini yopiq tutadi (`canSubmit`). */
{
  const empty = settle({}, 100000);
  const methods = empty.parts.filter((p) => p.type !== "CREDIT");
  eq(methods.length, 0, "bo'sh kirish — birorta TO'LOV qismi yo'q");
  eq(empty.cashIn, 0, "yashikka pul tushmaydi");
  eq(empty.change, 0, "qaytim yo'q");
  /* ⚠ QOLDIQ NASIYAGA TUSHADI va bu HISOBNING to'g'ri javobi: pul
     kelmagan bo'lsa, chek qarzda. Lekin EKRAN buni ko'rsatmasligi
     kerak — kassir hali hech narsa yozmagan va «Nasiya 20 000»
     degan qator uni chalg'itardi. Shuning uchun `KassaPage` nasiya
     qatorini `payUntouched` holatida yashiradi va o'rniga «Summani
     kiriting» deb aytadi. */
  eq(empty.credit, 100000, "hisobda qoldiq nasiyada — matematik javob");
  eq(settle(null, 100000).parts.filter((p) => p.type !== "CREDIT").length, 0,
     "kirish umuman yo'q — baribir to'lov qismi yo'q");
}
/* ⚠ NOL — «YOZILGAN» hisoblanadi va to'liq nasiya shu yo'l bilan
   qilinadi. Ekran uni `payUntouched` orqali ajratadi: `{CASH:"0"}`
   bo'sh emas, ya'ni kassir NIYATINI bildirgan va sotuv ochiq. */
eq(settle({ CASH: "0" }, 100000).credit, 100000, "naqdga 0 — to'liq nasiya");
eq(settle({ CLICK: 15000 }, 100000).credit, 85000, "yozilgani olinadi, qolgani nasiya");
eq(payType(settle({ CASH: 100000 }, 100000).parts), "CASH", "to'liq naqd — turi naqd");

console.log("\n── Qatorlar tartibi ──");

/* ⚠ NEGA SINOV. `Object.entries` kalitlarni QO'SHILISH tartibida
   beradi. Kassir naqdni o'chirib qayta yozganda «Naqd» qatori pastga
   tushib qolardi — ro'yxat u yozayotgan paytda qayta saflanardi
   (brouzerda ko'rildi). Tartib ENDI qat'iy: Naqd, Karta, Click, Payme. */
eqArr(
  settle({ PAYME: 10000, CASH: 20000, CLICK: 15000, CARD: 5000 }, 100000).parts,
  [{ type: "CASH", amount: 20000 }, { type: "CARD", amount: 5000 },
   { type: "CLICK", amount: 15000 }, { type: "PAYME", amount: 10000 },
   { type: "CREDIT", amount: 50000 }],
  "kiritilish tartibi emas — qat'iy tartib");
eqArr(
  settle({ CLICK: 15000, CASH: 20000 }, 100000).parts,
  settle({ CASH: 20000, CLICK: 15000 }, 100000).parts,
  "naqdni qayta yozish qatorlarni surmaydi");
/* Nasiya — HAR DOIM oxirgi qator: u to'lov emas, QOLDIQ. */
eq(settle({ CASH: 1000 }, 100000).parts.at(-1).type, "CREDIT", "nasiya oxirida");
/* Ro'yxatda yo'q usul yiqitmaydi va oxiriga tushadi. */
eqArr(
  settle({ BONUS: 10000, CASH: 20000 }, 100000).parts.map((x) => x.type),
  ["CASH", "BONUS", "CREDIT"], "notanish usul — oxiriga, yiqilmaydi");


/* ══════════════════════════════════════════════════════════════════════════
   JAMG'ARMA — QAYTIM CHIQARA OLMAYDI (V78)

   ⚠⚠ BU XAVFSIZLIK QOIDASI, qulaylik emas. Ilgari jamg'arma oddiy
   naqdsiz usul edi: 30 000 lik chekka 20 000 boshqa usul + 20 000
   jamg'arma yozilar, ortiqcha 10 000 esa QAYTIM bo'lib chiqardi —
   ya'ni mijoz o'z jamg'armasidan naqd pul yechib olardi. Jamg'arma
   shu bilan do'kondagi hisob bo'lishdan to'xtab, pul chiqarish
   yo'liga aylanardi.
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── Jamg'arma: qaytim chiqmaydi ──");

const sv1 = settle({ CASH: 20000, SAVINGS: 20000 }, 30000);
eq(sv1.savingsPaid, 10000, "jamg'armadan FAQAT qolgan 10 000 yechildi");
eq(sv1.savingsCut, 10000, "ortiqcha 10 000 hisobda qoldi");
eq(sv1.change, 0, "QAYTIM YO'Q — pul chiqarish yo'li yopiq");
eq(sv1.excess, 0, "ortiqcha to'lov ham yo'q");
eq(sv1.credit, 0, "chek to'liq yopildi");
eqArr(sv1.parts, [{ type: "CASH", amount: 20000 }, { type: "SAVINGS", amount: 10000 }],
  "chekka kesilgan qiymat tushadi");

const sv2 = settle({ SAVINGS: 100000 }, 30000);
eq(sv2.savingsPaid, 30000, "yolg'iz jamg'arma ham chek summasidan oshmaydi");
eq(sv2.change, 0, "va qaytim bermaydi");

/* Naqd jamg'armadan KEYIN kelsa ham qoida buzilmaydi: chegara
   boshqa usullarning JAMIDAN hisoblanadi, tartibdan emas. */
const sv3 = settle({ SAVINGS: 20000, CASH: 40000 }, 30000);
eq(sv3.savingsPaid, 0, "naqd chekni yopgan bo'lsa jamg'armaga tegilmaydi");
eq(sv3.change, 10000, "ortiqcha NAQD esa qaytim bo'ladi — u mijozning naqd puli");

const sv4 = settle({ SAVINGS: 30000 }, 30000);
eq(sv4.savingsPaid, 30000, "aynan chek summasi — to'liq yechiladi");
eq(sv4.savingsCut, 0, "kesilmadi");

console.log("\n── Jamg'arma chegarasi (savingsMax) ──");
eq(savingsMax({ CASH: 20000 }, 30000, 500000), 10000,
   "chegara — QOLGAN summa (qoldiq katta bo'lsa ham)");
eq(savingsMax({ CASH: 20000 }, 30000, 5000), 5000,
   "chegara — QOLDIQ (u kichik bo'lsa)");
eq(savingsMax({ CASH: 40000 }, 30000, 500000), 0,
   "chek yopilgan bo'lsa jamg'armadan hech narsa yechilmaydi");
eq(savingsMax({}, 30000, 500000), 30000, "bo'sh chekda — butun summa");
eq(savingsMax({ SAVINGS: 99999 }, 30000, 500000), 30000,
   "O'ZINI hisobga olmaydi — aks holda maydon o'zini o'zi qisqartirardi");
eq(savingsMax({}, 30000, 0), 0, "qoldiqsiz mijozda nol");

/* ══════════════════════════════════════════════════════════════════════════
   ORTIQCHA TO'LOV — HAR QANDAY USULDAN (V78)

   ⚠ Ilgari faqat naqd qaytimi jamg'armaga yo'naltirilardi. Kartadan
   ortiq to'langan pulning yo'li umuman yo'q edi: u ekranda «xato»
   bo'lib turar, lekin bu MIJOZNING puli va uni qaytarishning yagona
   to'g'ri yo'li — jamg'arma.
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── Ortiqcha to'lov: har qanday usuldan ──");

const ex1 = settle({ CLICK: 50000 }, 30000);
eq(ex1.over, 20000, "Click 50 000 → 20 000 ortiqcha");
eq(ex1.excess, 20000, "va u YO'NALTIRILISHI mumkin");
eq(ex1.change, 0, "naqd qaytimi esa yo'q — terminal naqd bermaydi");

const ex2 = settle({ CASH: 50000 }, 30000);
eq(ex2.change, 20000, "naqd 50 000 → 20 000 qaytim");
eq(ex2.excess, 20000, "u ham yo'naltirilishi mumkin");

/* ⚠ 40 000 naqd + 20 000 karta, chek 30 000. Kartadan keyin naqddan
   atigi 10 000 kerak bo'ladi — qolgan 30 000 QAYTIM. Ya'ni ortiqcha
   to'lov naqddan chiqadi, garchi kartaning O'ZI chekdan oshmagan
   bo'lsa ham. */
const ex3 = settle({ CASH: 40000, CARD: 20000 }, 30000);
eq(ex3.excess, 30000, "jami ortiqcha — 60 000 to'landi, 30 000 kerak edi");
eq(ex3.change, 30000, "hammasi naqd qaytimi: karta chekka to'liq tushdi");
eq(ex3.over, 0, "karta yolg'iz o'zi chekdan oshmadi");
eq(ex3.cashPaid, 10000, "chekka faqat kerakli naqd tushadi");

/* Teskarisi: karta chekdan oshsa — naqd qaytimi ham, kartaning
   ortiqchasi ham bo'ladi va ikkalasi `excess` da qo'shiladi. */
const ex3b = settle({ CASH: 10000, CARD: 40000 }, 30000);
eq(ex3b.over, 10000, "kartadan 10 000 ortiq");
eq(ex3b.change, 10000, "naqdning hammasi ortiqcha — chekka kerak emas");
eq(ex3b.excess, 20000, "ikkalasi qo'shiladi");

const ex4 = settle({ CASH: 30000 }, 30000);
eq(ex4.excess, 0, "aniq to'langan chekda ortiqcha yo'q");

const ex5 = settle({ CASH: 20000 }, 30000);
eq(ex5.excess, 0, "kam to'langan chekda ham yo'q");
eq(ex5.credit, 10000, "qolgani nasiyaga");

console.log("\n═══ ⚠ KIRITILMAGAN PUL — TO'LOV EMAS (V86) ═══");
/* Do'kon egasining ikki suratI:
     1) «CLICK UCHUN SUMMA» turibdi, maydon bo'sh — hisobda «Naqd»;
     2) o'sha «Naqd 20 000» qatorini ✕ bilan o'chirib bo'lmaydi.
   Ikkalasining sababi bitta: qator `paid` dan emas, SINTETIK
   qiymatdan chizilardi. ✕ esa `paid` dan o'chiradi — o'chiradigan
   narsa yo'q edi. */
{
  /* Har usul uchun: yozilmagan — qator ham yo'q. */
  for (const m of ["CASH", "CARD", "CLICK", "PAYME", "SAVINGS"]) {
    eq(settle({}, 20000).parts.find((p) => p.type === m), undefined, `${m}: yozilmagan — qator yo'q`);
  }
  /* Yozilgan zahoti — bor, va u O'CHIRILADIGAN qator (`paid` da bor). */
  const one = settle({ CLICK: 20000 }, 20000);
  eq(one.parts.length, 1, "Click yozildi — bitta qator");
  eq(one.parts[0].type, "CLICK", "va u Click");
  eq(one.cashIn, 0, "yashikka pul TUSHMAYDI");
}

console.log("\n── ARALASH TO'LOV — CHEK SUMMASI YO'Q OYNALAR (V96) ──");
/* ⚠ NEGA ALOHIDA HISOB. `settle` CHEK SUMMASIDAN kelib chiqadi:
   qolgani nasiyaga, ortig'i qaytimga. Qarz to'lash, jamg'arma
   to'ldirish va ta'minotchiga to'lovda esa belgilangan summa YO'Q —
   to'lov summasi kiritilganlarning YIG'INDISI. */
{
  eq(enteredTotal({ CASH: "200000", CARD: "300000" }), 500000, "jami — kiritilganlar yig'indisi");
  eq(enteredTotal({}), 0, "bo'sh — nol");
  eq(enteredTotal(null), 0, "null yiqitmaydi");
  eq(enteredTotal({ CASH: "salom" }), 0, "son bo'lmagan qiymat nolga");

  const parts = enteredParts({ CARD: "300000", CASH: "200000" });
  eq(parts.length, 2, "ikkita qism");
  /* ⚠ TARTIB `ORDER` bo'yicha — kiritilish tartibida EMAS: kassir
     summani o'chirib qayta yozsa, qator ro'yxatda sakrab yurardi. */
  eq(parts[0].type, "CASH", "naqd birinchi — kiritilish tartibi emas");
  eq(parts[1].type, "CARD", "keyin karta");

  /* ⚠ NOL QATOR YUBORILMAYDI: server uni RAD ETADI, chunki u
     klientdagi nosozlik belgisi. */
  eq(enteredParts({ CASH: "50000", CARD: "0" }).length, 1, "nol qator tushib qoladi");
  eq(enteredParts({ CASH: "50000", CARD: "" }).length, 1, "bo'sh qator ham");
  eq(enteredParts({}).length, 0, "bo'shdan bo'sh ro'yxat");

  /* ⚠⚠ CHEGARA JAMIGA QO'YILADI, bitta maydonga emas. Jamg'armadan
     qaytarishda qoldiq 100 000 bo'lsa, «naqd 100 000 + karta 100 000»
     ni har maydonni alohida tekshirib O'TKAZIB YUBORARDI. */
  eq(enteredMax({ CASH: "40000" }, 100000, "CARD"), 60000, "qolgan joy — jamidan");
  eq(enteredMax({ CASH: "100000" }, 100000, "CARD"), 0, "jami to'lgan — boshqasiga joy yo'q");
  eq(enteredMax({ CASH: "150000" }, 100000, "CARD"), 0, "oshib ketgan bo'lsa ham manfiy emas");
  /* ⚠ Tahrirlanayotgan maydonning O'ZI hisobga olinmaydi: aks holda
     20 000 yozilgan maydonni 30 000 ga o'zgartirib bo'lmasdi. */
  eq(enteredMax({ CASH: "40000" }, 100000, "CASH"), 100000, "o'z qiymati chegaradan chiqarilmaydi");
  eq(enteredMax({ CASH: "40000" }, null, "CARD"), null, "chegara berilmasa — yo'q");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
