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

const { lineNet, spreadDiscount } = await import("../src/lib/ek-discount.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));
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
console.log(`  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
