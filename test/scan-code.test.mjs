/* ══════════════════════════════════════════════════════════════════════════
   Skanerlangan yoki yozilgan kod → ro'yxatdagi tovar (2026-10-01).

   ⚠ NEGA: egasining talabi — «skaner hamma bo'limda Katalog va Ombordagidek
   ishlasin». Yorliqlar sahifasida kod endi tovarni DARHOL tanlaydi
   (navbatda — darhol qo'shadi), ko'chirishda esa nom bilan Enter faqat
   kod AYNAN mos kelsa tovarni oladi. Qisman moslik bu yerda xavfli:
   skanerlangan tovar o'rniga boshqasining yorlig'i chiqib ketardi.

   Ishga tushirish:  node test/scan-code.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { findByCode } from "../src/lib/ek-code.js";

let pass = 0, fail = 0;
const eq = (a, e, m) => {
  if (a === e) { pass++; console.log("  ✅ " + m); }
  else { fail++; console.log(`  ❌ ${m} (kutilgan: ${JSON.stringify(e)})\n     olindi: ${JSON.stringify(a)}`); }
};

const LIST = [
  { id: 1, name: "Pepsi 1L", barcode: "4780000000011", searchCode: "425" },
  { id: 2, name: "Non", barcode: null, shortCode: "7" },
  /* Ataylab to'qnashuv: 3-tovarning BARKODI 4-tovarning KODIGA teng. */
  { id: 3, name: "Saqich", barcode: "1001" },
  { id: 4, name: "Sut", barcode: "4780000000028", searchCode: "1001" },
];
const id = (p) => (p ? p.id : null);

console.log("\n═══ 1. Barkod va tovar kodi ═══");
eq(id(findByCode(LIST, "4780000000011")), 1, "barkod — aynan");
eq(id(findByCode(LIST, " 4780000000011 ")), 1, "chetdagi bo'shliq hisobga olinmaydi");
eq(id(findByCode(LIST, "*425")), 1, "kod rejimi — tovar kodi");
eq(id(findByCode(LIST, "425")), 1, "yulduzchasiz kod ham topiladi (barkod mos kelmasa)");
eq(id(findByCode(LIST, "*7")), 2, "eski tovar — `shortCode`");

console.log("\n═══ 2. To'qnashuv — odam nimani nazarda tutgani ustun ═══");
eq(id(findByCode(LIST, "1001")), 3, "yulduzchasiz — avval barkod");
eq(id(findByCode(LIST, "*1001")), 4, "yulduzcha bilan — avval tovar kodi");

console.log("\n═══ 3. Qisman moslik — YO'Q ═══");
eq(findByCode(LIST, "478000000001"), null, "barkodning boshi — tovar emas");
eq(findByCode(LIST, "42"), null, "kodning boshi — tovar emas");
eq(findByCode(LIST, "Pepsi"), null, "nom — kod emas (uni qidiruv topadi)");

console.log("\n═══ 4. Chekka holatlar ═══");
eq(findByCode(LIST, ""), null, "bo'sh kod");
eq(findByCode(LIST, "*"), null, "faqat yulduzcha");
eq(findByCode(LIST, null), null, "kod yo'q");
eq(findByCode(null, "425"), null, "ro'yxat yo'q");
eq(findByCode([{ id: 9, barcode: 4780000000035 }], "4780000000035")?.id, 9, "barkod son bo'lib kelsa ham");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
