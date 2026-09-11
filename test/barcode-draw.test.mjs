/* ══════════════════════════════════════════════════════════════════════════
   BARKODNI CHIZISH — EAN-13 va EAN-8 (V108)

   ⚠ NEGA SINOV MUHIM. Yorliq QOG'OZGA chiqadi va xatosi faqat
   javonda, skaner o'qimaganda ko'rinadi. O'shanda kassir «skaner
   buzilibdi» deb o'ylaydi, do'kon esa yuzlab stikerni qaytadan
   chiqaradi. Ya'ni bu yerdagi bitta modul xatosi — bir kunlik ish.

   Sinov standartning O'ZIGA tayanadi: modul soni, qo'riqlovchi
   chiziqlar, ma'lum kodlarning ma'lum naqshi.
   ══════════════════════════════════════════════════════════════════════════ */
import { eanValid, eanModules, eanSvg } from "../src/lib/ek-barcode-ean.js";

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else      { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (a, b, name) => is(a === b, name, `olindi: ${a}, kutilgan: ${b}`);

console.log("\n═══ 1. Nazorat raqami ═══");
is(eanValid("5901234123457"), "EAN-13 namunasi (standart hujjatidan)");
is(eanValid("5449000000996"), "EAN-13 — Coca-Cola");
is(eanValid("96385074"),      "EAN-8 namunasi");
is(eanValid("20001421"),      "do'kon kodi — 142-tovar");
is(!eanValid("5901234123458"), "buzilgan nazorat raqami RAD ETILADI");
is(!eanValid("2000142"),       "7 xonali kod rad etiladi");
is(!eanValid("590123412345"),  "12 xonali kod rad etiladi");
is(!eanValid("59012341234a7"), "harf bor kod rad etiladi");
is(!eanValid(""),              "bo'sh satr rad etiladi");
is(!eanValid(null),            "null rad etiladi");

console.log("\n═══ 2. Modul soni — standart bo'yicha ═══");
eq(eanModules("5901234123457").length, 95, "EAN-13 → 95 modul");
eq(eanModules("96385074").length,      67, "EAN-8 → 67 modul");
eq(eanModules("5901234123458"),      null, "yaroqsiz kod → null (chizilmaydi)");

console.log("\n═══ 3. Qo'riqlovchi chiziqlar joyida ═══");
{
  const m13 = eanModules("5901234123457");
  eq(m13.slice(0, 3),   "101",   "EAN-13 chap qo'riqchi");
  eq(m13.slice(45, 50), "01010", "EAN-13 o'rta qo'riqchi");
  eq(m13.slice(-3),     "101",   "EAN-13 o'ng qo'riqchi");
  const m8 = eanModules("96385074");
  eq(m8.slice(0, 3),   "101",   "EAN-8 chap qo'riqchi");
  eq(m8.slice(31, 36), "01010", "EAN-8 o'rta qo'riqchi");
  eq(m8.slice(-3),     "101",   "EAN-8 o'ng qo'riqchi");
}

console.log("\n═══ 4. Raqamlarning naqshi ═══");
{
  /* ⚠ EAN-13 NING BIRINCHI RAQAMI CHIZILMAYDI — u chap oltilikning
     L/G tartibi bilan kodlanadi. Shu sabab birinchi raqami boshqa,
     qolgani bir xil ikki kod BOSHQACHA chiziladi. Agar juftlik
     jadvali yozilmagan bo'lsa, ikkalasi bir xil chiqardi va
     skaner noto'g'ri tovarni o'qirdi. */
  const a = eanModules("0012345678905");   // birinchi raqam 0 → LLLLLL
  const b = eanModules("1234567890128");   // birinchi raqam 1 → LLGLGG
  is(eanValid("0012345678905"), "0 bilan boshlanuvchi kod yaroqli");
  is(eanValid("1234567890128"), "1 bilan boshlanuvchi kod yaroqli");
  is(a !== b, "birinchi raqami boshqa kodlar BOSHQACHA chiziladi");

  /* Chap tomondagi birinchi raqam «0» va juftlik L bo'lsa,
     naqsh AYNAN L[0] = 0001101 bo'lishi kerak. */
  eq(a.slice(3, 10), "0001101", "EAN-13, birinchi raqam 0 → L[0] naqshi");
}

console.log("\n═══ 5. SVG ═══");
{
  const svg = eanSvg("20001421");
  is(svg.startsWith("<svg"), "SVG qaytdi");
  is(svg.includes('aria-label="20001421"'), "kod aria-label da — skrin-riderga ham");
  is(svg.includes("20001421".slice(0, 4)), "raqamlar chizmada yozilgan");
  is((svg.match(/<rect/g) || []).length > 10, "chiziqlar chizilgan");
  eq(eanSvg("5901234123458"), null, "⚠ yaroqsiz kod CHIZILMAYDI");

  /* ⚠ EAN-13 ning birinchi raqami chizmadan CHAPDA yoziladi —
     `viewBox` uni sig'dirmasa, u kesilib qolardi. */
  const svg13 = eanSvg("5901234123457");
  is(/viewBox="-\d/.test(svg13), "EAN-13 da viewBox chapga kengaytirilgan");
}

console.log(`\n${fail ? "❌" : "✅"} Barkod chizish: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
