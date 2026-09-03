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

const { settle, payType, restFor } = await import("../src/lib/ek-payment.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));
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

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
