/* ══════════════════════════════════════════════════════════════════════════
   Chegirmani qatorlarga taqsimlash — sinov (V48).

   ⚠ NEGA MUHIM: bu modul SERVERDAGI qoidaning nusxasi
   (`SaleService.distributeSaleDiscount`). Kassir to'lov oynasida
   «chegirma qaysi tovarga qanchadan tushdi?» degan javobni ko'radi,
   keyin esa AYNAN o'sha raqamlar chekda va bazada turishi kerak —
   qaytarish ham o'sha raqamlardan hisoblanadi. Ikki joyda ikki xil
   yaxlitlash bo'lsa, mijoz chekni ko'rib «siz boshqa aytdingiz» derdi
   va do'kon qaytarishda pul yo'qotardi.

   Bu yerda qat'iy qayd etiladi:
     · ulushlar yig'indisi chegirmaga TENG (bir tiyin ham yo'qolmaydi)
     · yaxlitlash PASTGA, qoldiq esa ENG KATTA qatorga
     · qator o'z chegirmasi bilan kelsa, ulush QOLGANIDAN olinadi
     · buzuq kirish (nol, manfiy, bo'sh savat) yiqilmaydi

   Ishga tushirish:  node test/discount.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { lineNet, spreadDiscount, lineRoom, cartRoom, roundingOffers, spreadByRoom }
  = await import("../src/lib/ek-discount.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));
const yes = (v, msg) => (v ? ok(msg) : bad(msg, v));
const eqArr = (actual, expected, msg) =>
  (JSON.stringify(actual) === JSON.stringify(expected) ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));
/** Ulushlar yig'indisi — tiyin xatosisiz. */
const sum = (a) => Math.round(a.reduce((s, n) => s + n, 0) * 100) / 100;

console.log("\n═══ 1. Qator jamisi — o'z chegirmasidan keyin ═══");
eq(lineNet({ salePrice: 25000, qty: 2, discount: 8000 }), 42000, "2 × 25 000 − 8 000 = 42 000");
eq(lineNet({ salePrice: 25000, qty: 2 }), 50000, "chegirmasiz qatorda o'zgarmaydi");
eq(lineNet({ salePrice: 1000, qty: 1, discount: 5000 }), 0, "chegirma jamidan katta bo'lsa nol (manfiy emas)");

console.log("\n═══ 2. Teng qatorlarga teng bo'linadi ═══");
const two = [{ salePrice: 50000, qty: 1 }, { salePrice: 50000, qty: 1 }];
eqArr(spreadDiscount(two, 10000), [5000, 5000], "10 000 ikkiga teng bo'lindi");

console.log("\n═══ 3. Ulush qator jamisiga MUTANOSIB ═══");
const mix = [{ salePrice: 75000, qty: 1 }, { salePrice: 25000, qty: 1 }];
eqArr(spreadDiscount(mix, 20000), [15000, 5000], "75/25 nisbatida");

console.log("\n═══ 4. ⚠ Yaxlitlash qoldig'i YO'QOLMAYDI ═══");
/* 100 ni uchga bo'lish — klassik holat: 33.33 + 33.33 + 33.33 = 99.99,
   qolgan 0.01 esa eng katta qatorga qo'shiladi. */
const three = [{ salePrice: 100, qty: 1 }, { salePrice: 100, qty: 1 }, { salePrice: 100, qty: 1 }];
const s3 = spreadDiscount(three, 100);
eq(sum(s3), 100, "yig'indi chegirmaga teng");
eq(s3.filter((v) => v === 33.33).length >= 2, true, "ikkitasi pastga yaxlitlangan");

console.log("\n═══ 5. ⚠ Qoldiq ENG KATTA qatorga tushadi ═══");
/* 10 000 ni 70 000 / 20 000 / 10 000 ga bo'lganda ham bir tiyin qoladi. */
const big = [{ salePrice: 7000, qty: 1 }, { salePrice: 2000, qty: 1 }, { salePrice: 1000, qty: 1 }];
const sb = spreadDiscount(big, 1000);
eq(sum(sb), 1000, "yig'indi buzilmadi");
eq(sb[0] >= sb[1] && sb[1] >= sb[2], true, "eng katta qator eng ko'p oldi");

console.log("\n═══ 6. ⚠ Qatorning O'Z chegirmasi hisobga olinadi ═══");
/* Kassir birinchi qator narxini allaqachon tushirgan: chek chegirmasi
   endi QOLGAN summalar nisbatida bo'linishi kerak, aks holda arzonlashgan
   tovar ikkinchi marta arzonlashardi. */
const own = [
  { salePrice: 50000, qty: 1, discount: 25000 },   // qoldiq 25 000
  { salePrice: 25000, qty: 1 },                    // qoldiq 25 000
];
eqArr(spreadDiscount(own, 10000), [5000, 5000], "qoldiqlar teng — chegirma ham teng");

console.log("\n═══ 7. Buzuq kirishda yiqilmaydi ═══");
eqArr(spreadDiscount([], 5000), [], "bo'sh savat");
eqArr(spreadDiscount(two, 0), [0, 0], "chegirma nol");
eqArr(spreadDiscount(two, -100), [0, 0], "manfiy chegirma");
eqArr(spreadDiscount([{ salePrice: 0, qty: 0 }], 500), [0], "jami nol bo'lsa bo'lish yo'q");

console.log("\n─────────────────────────────");

/* ══════════════════════════════════════════════════════════════════════════
   YAXLITLASH TAKLIFLARI (V56)

   ⚠ Do'kon egasining so'rovi: chek 141 200 chiqdi, mijoz 142 000 beradi,
   kassir 800 qaytaradi — maydasi yo'q, navbat kutadi va oxir-oqibat
   o'sha 800 hisobsiz ketadi. Tizim shu qoldiqni O'ZI ko'rib chegirma
   qilib taklif qilsin.

   ⚠ ENG MUHIM XOSSA: taqsimot qator QIYMATIGA emas, BO'SH JOYIGA
   mutanosib. Egasining misolida piyoz va kartoshka yutadi, 700 so'mlik
   Kola deyarli hech narsa. Qiymatga mutanosib bo'lsa, marjasi past
   qator o'z chegarasidan oshib ketardi va chek bajik so'rardi.
   ══════════════════════════════════════════════════════════════════════════ */

console.log("\n═══ 6. Qatorning bo'sh joyi ═══");
eq(lineRoom({ salePrice: 15000, qty: 1, minPrice: 10200 }), 4800, "Pepsi: 15000 → 10200 = 4800");
eq(lineRoom({ salePrice: 15000, qty: 3, minPrice: 10200 }), 14400, "miqdor ko'paytiriladi");
eq(lineRoom({ salePrice: 15000, qty: 1, minPrice: 10200, discount: 4000 }), 800,
   "berilgan chegirma ayiriladi");
eq(lineRoom({ salePrice: 15000, qty: 1, minPrice: 15000 }), 0, "eng past narx = narx → nol");
eq(lineRoom({ salePrice: 15000, qty: 1 }), 0,
   "eng past narx YO'Q → nol (eski server javobida taklif berilmaydi)");
eq(lineRoom({ salePrice: 15000, qty: 1, minPrice: 10200, discount: 9999 }), 0,
   "chegirma bo'sh joydan oshsa — manfiy emas, nol");

console.log("\n═══ 7. Yaxlitlash takliflari ═══");
const CART = [
  { salePrice: 45500, qty: 1, minPrice: 40000 },   // bo'sh joy 5500
  { salePrice: 15700, qty: 1, minPrice: 14000 },   // 1700
  { salePrice: 700,   qty: 1, minPrice: 690 },     // 10
];
eq(cartRoom(CART), 7210, "savatning bo'sh joyi");

const offers = roundingOffers(CART, 61900);
eq(offers.length, 3, "uchta taklif");
eq(offers[0].discount, 400,  "eng arzoni birinchi: −400 → 61 500");
eq(offers[0].target,   61500, "maqsad yaxlit");
eq(offers[2].discount, 1900, "eng kattasi oxirida: −1 900 → 60 000");
yes(offers.every((o) => o.discount <= cartRoom(CART)), "hech biri bo'sh joydan oshmaydi");

/* ⚠ Maqsad — noqulay QOLDIQNI yo'qotish, «yaxlit chegirma berish»
   emas. 61 000 lik chekda qaytim muammosi yo'q va unga taklif berish
   do'konni har chekda bekorga puldan qilardi. */
eqArr(roundingOffers(CART, 61000), [], "jami allaqachon yaxlit — taklif yo'q");
eqArr(roundingOffers(CART, 61500), [], "500 ga bo'linsa ham qoldiq yo'q");
eq(roundingOffers(CART, 61200)[0].discount, 200, "200 lik qoldiq — eng arzon taklif");
eqArr(roundingOffers([], 61900), [], "bo'sh savat — taklif yo'q");
eqArr(roundingOffers([{ salePrice: 700, qty: 1 }], 61900), [],
      "eng past narx yo'q — taklif yo'q");

console.log("\n═══ 8. Bo'sh joyga mutanosib taqsimot ═══");
const spread = spreadByRoom(CART, 400);
eq(spread[2], 0, "Kola'ga 0 — bo'sh joyi kichik (egasining talabi)");
yes(spread[0] > spread[1], "piyoz kartoshkadan ko'proq yutadi");
eq(spread[0] + spread[1] + spread[2], 400, "yig'indi chegirmaga TENG — tiyin yo'qolmaydi");
spread.forEach((v, i) => yes(v <= lineRoom(CART[i]),
  `${i}-qator o'z chegarasidan oshmadi (${v} ≤ ${lineRoom(CART[i])})`));

const fullSpread = spreadByRoom(CART, 7210);
eq(fullSpread.reduce((a, b) => a + b, 0), 7210, "to'liq bo'sh joy taqsimlanadi");
eqArr(spreadByRoom(CART, 0), [0, 0, 0], "nol chegirma — nol taqsimot");
eqArr(spreadByRoom([], 400), [], "bo'sh savat — yiqilmaydi");

console.log(`  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
