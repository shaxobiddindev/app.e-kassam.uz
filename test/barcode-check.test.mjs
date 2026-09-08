/* ══════════════════════════════════════════════════════════════════════════
   SHTRIX-KOD NAZORAT RAQAMI — front tomoni

   ⚠ SERVERDAGI `BarcodeCheckTest.java` NING JUFTI va bandlari AYNAN
   bir xil. Ikkala tomonda bir xil javob chiqishi shart: front
   «shubhali» desa-yu server bayroq qo'ymasa, foydalanuvchi qaysi
   biriga ishonishni bilmasdi.

   Sinovning ikkinchi yarmi muhimroq: qonuniy kod OGOHLANTIRILMASIN.
   Yolg'on ogohlantirish bayroqni foydasiz qiladi — birinchi haftada
   o'nlab yolg'on «xato» ni ko'rgan odam ikkinchi haftada bayroqqa
   umuman qaramaydi va haqiqiy xato o'tib ketadi.
   ══════════════════════════════════════════════════════════════════════════ */
import { barcodeVerdict, barcodeSuspicious } from "../src/lib/ek-barcode-check.js";

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else      { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (actual, expected, name) =>
  is(actual === expected, name, `olindi: ${actual}, kutilgan: ${expected}`);

console.log("\n═══ 1. Haqiqiy kodlar ═══");
eq(barcodeVerdict("5449000000996"), "OK", "Coca-Cola EAN-13");
eq(barcodeVerdict("3017620422003"), "OK", "Nutella EAN-13");
eq(barcodeVerdict("4780000000007"), "OK", "O'zbekiston prefiksi (478)");
/* ⚠ EAN-8 ALOHIDA SABAB BILAN: vaznni kod BOSHIDAN sanash EAN-13 da
   to'g'ri, EAN-8 da esa noto'g'ri natija beradi. */
eq(barcodeVerdict("96385074"), "OK", "EAN-8 — vazn oxiridan sanaladi");
eq(barcodeVerdict("73513537"), "OK", "ikkinchi EAN-8");
eq(barcodeVerdict("036000291452"), "OK", "UPC-A (12 xona)");
eq(barcodeVerdict("  5449000000996  "), "OK", "bo'shliq kodni buzmaydi");

console.log("\n═══ 2. Xato kodlar ushlanadi ═══");
eq(barcodeVerdict("5449000000997"), "CHECK_DIGIT", "oxirgi raqam o'zgargan");
eq(barcodeVerdict("5449000010996"), "CHECK_DIGIT", "o'rtadagi raqam o'zgargan");
eq(barcodeVerdict("5449000000969"), "CHECK_DIGIT", "ikki raqam o'rni almashgan");
is(barcodeSuspicious("5449000000997"), "`suspicious` xato kodda rost");

console.log("\n═══ 3. ⚠ YOLG'ON OGOHLANTIRISH BO'LMASIN ═══");
eq(barcodeVerdict("2012345006003"), "INTERNAL", "tarozi barkodi belgilanmaydi");
eq(barcodeVerdict("2900000000000"), "INTERNAL", "ichki kod (29…) belgilanmaydi");
eq(barcodeVerdict("0200000000000"), "INTERNAL", "o'zgaruvchan o'lchov (02…)");
eq(barcodeVerdict("ABC-123"), "NOT_STANDARD", "artikul — EAN emas");
eq(barcodeVerdict("12345"), "NOT_STANDARD", "qisqa ichki kod");
eq(barcodeVerdict("00000000000000"), "NOT_STANDARD", "14 xona — ITF-14");
eq(barcodeVerdict(""), "NOT_STANDARD", "bo'sh qator");
eq(barcodeVerdict(null), "NOT_STANDARD", "null yiqitmaydi");
is(!barcodeSuspicious("2900000000001"), "ichki kod hech qachon shubhali emas");
is(!barcodeSuspicious("ABC-123"), "artikul hech qachon shubhali emas");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
