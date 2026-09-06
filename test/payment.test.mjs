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

const { settle, payType, restFor, effective, savingsMax } = await import("../src/lib/ek-payment.js");

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

console.log("\n── Bo'sh maydon: hammasi naqd ──");

/* ⚠ Do'kon egasining talabi: maydon BO'SH ochilsin, unga summa
   yozilmasin. Lekin bo'sh maydon «to'lanmadi» degani EMAS — odatiy
   chekda mijoz butun summani naqd beradi va kassir hech narsa
   yozmasdan «Sotish» ni bosadi. Bo'sh = nol deb olinsa, o'sha odatiy
   chek BUTUNLAY nasiyaga yozilardi. */
eqArr(effective({}, 100000), { CASH: 100000 }, "hech narsa yozilmadi — hammasi naqd");
eqArr(effective(null, 100000), { CASH: 100000 }, "kirish yo'q — hammasi naqd");
eqArr(effective({ CLICK: 15000 }, 100000), { CLICK: 15000 }, "yozilgan bo'lsa — tegilmaydi");
/* ⚠ NOL — «yozilgan» hisoblanadi: to'liq nasiya shu yo'l bilan
   qilinadi va qoida uni bosib ketmasligi kerak. */
eqArr(effective({ CASH: "0" }, 100000), { CASH: "0" }, "nol ham yozuv — bosib ketilmaydi");
eq(settle(effective({}, 100000), 100000).credit, 0, "bo'sh chekda nasiya yo'q");
eq(settle(effective({}, 100000), 100000).parts[0].type, "CASH", "chekka naqd tushadi");
eq(payType(settle(effective({}, 100000), 100000).parts), "CASH", "turi — naqd");
eq(settle(effective({ CASH: "0" }, 100000), 100000).credit, 100000, "naqdga 0 — to'liq nasiya");
eqArr(effective({}, 0), { CASH: 0 }, "jami nol — nol naqd");

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

console.log("\n═══ ⚠ BO'SH MAYDON — TANLANGAN USULGA (V85) ═══");
/* Do'kon egasining ekrani: Click tanlangan, maydon bo'sh, hisobda esa
   «Naqd 20 000» va «Sotish» ochiq. Pul Click orqali kelgan — yashikda
   20 000 ortiqcha, Click tushumi shuncha kam. Kassir sezmasdi: farq
   faqat smena yopilganda, qaysi chek ekani topib bo'lmaydigan paytda
   chiqardi. */
{
  eqObj(effective({}, 20000, "CLICK"), { CLICK: 20000 },
        "Click tanlangan — bo'sh maydon Click bo'ladi");
  eqObj(effective({}, 20000, "CARD"), { CARD: 20000 }, "Karta ham shunday");
  /* ⚠ USUL BERILMASA — ESKI XATTI-HARAKAT. Oflayn navbatdagi eski
     chaqiruvlar va sinovlar buzilmaydi. */
  eqObj(effective({}, 20000), { CASH: 20000 }, "usul berilmasa — naqd, eskidek");
  eqObj(effective({}, 20000, null), { CASH: 20000 }, "usul null — naqd");
  /* ⚠ NIMADIR YOZILGAN bo'lsa qoida umuman ishlamaydi. */
  eqObj(effective({ CASH: 5000 }, 20000, "CLICK"), { CASH: 5000 },
        "yozilgan qiymat tanlangan usuldan ustun");

  /* Hisob ham to'g'ri chiqadi: butun chek Click, qaytim yo'q. */
  const s2 = settle(effective({}, 20000, "CLICK"), 20000);
  eq(s2.others, 20000, "hammasi naqdsiz usuldan");
  eq(s2.cashIn, 0, "yashikka pul TUSHMAYDI");
  eq(s2.change, 0, "qaytim yo'q");
  eq(s2.credit, 0, "nasiya yo'q");
  eq(s2.parts.length, 1, "bitta qism");
  eq(s2.parts[0].type, "CLICK", "va u — Click");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
