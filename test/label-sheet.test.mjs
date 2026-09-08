/* ══════════════════════════════════════════════════════════════════════════
   JAVON YORLIG'I — A4 VARAQ (V108)

   ⚠ NEGA SINOV. Yorliq QOG'OZGA chiqadi: xatosi ekranda emas,
   printerdan chiqqan varaqda ko'rinadi va o'shanda qog'oz ham,
   vaqt ham ketgan bo'ladi. Shuning uchun varaqning MANTIG'I
   (nechta yorliq, nima yozilgan, qanday qochirilgan) chop
   etishdan alohida tekshiriladi.

   ⚠ O'lchamlar A4 dan hisoblangan: 210 mm − 2×8 mm chekka = 194 mm;
   uchga bo'linsa 64 mm, to'rtga bo'linsa 48 mm. Sinov shu
   arifmetikani ham qo'riqlaydi — ustun kengligi o'zgarib, oxirgi
   ustun keyingi varaqqa tushib ketmasin.
   ══════════════════════════════════════════════════════════════════════════ */
import { buildLabelSheet, labelSheetCss, LABEL_SIZES } from "../src/lib/ek-label-sheet.js";

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else      { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (a, b, name) => is(a === b, name, `olindi: ${a}, kutilgan: ${b}`);
const count = (html, re) => (html.match(re) || []).length;

const P = [
  { name: "Sut 2,5% 1l",   salePrice: 12000, barcode: "20001421",      shortCode: 142 },
  { name: "Coca-Cola 0.5", salePrice: 9000,  barcode: "5449000000996", shortCode: 7 },
];

console.log("\n═══ 1. Varaqqa sig'ish arifmetikasi ═══");
for (const [key, s] of Object.entries(LABEL_SIZES)) {
  is(s.cols * s.w <= 194, `${key}: ${s.cols} ustun × ${s.w} mm ≤ 194 mm (A4 chekkasiz)`);
  is(s.rows * s.h <= 281, `${key}: ${s.rows} qator × ${s.h} mm ≤ 281 mm`);
}

console.log("\n═══ 2. Yorliqlar soni ═══");
{
  const html = buildLabelSheet(P, { size: "big" });
  eq(count(html, /class="lb"/g), 2, "ikki tovar → ikki yorliq");

  const three = buildLabelSheet(P, { size: "big", copies: 3 });
  eq(count(three, /class="lb"/g), 6, "nusxa 3 → olti yorliq");

  /* ⚠ CHEGARA: «0» bo'sh varaq, «1000» esa yuz varaqni printerga
     yuborardi va uni to'xtatib bo'lmasdi. */
  eq(count(buildLabelSheet(P, { copies: 0 }), /class="lb"/g), 2, "nusxa 0 → 1 deb olinadi");
  eq(count(buildLabelSheet(P, { copies: 999 }), /class="lb"/g), 100, "nusxa 50 dan oshmaydi");
}

console.log("\n═══ 3. Yorliqda nima bor ═══");
{
  const html = buildLabelSheet(P, { size: "big", shopName: "Anvar do'koni" });
  is(html.includes("№142"), "qisqa raqam yozilgan");
  is(html.includes("Sut 2,5% 1l"), "tovar nomi yozilgan");
  is(/12\s*000/.test(html), "narx yozilgan");
  is(html.includes("Anvar do&#39;koni") || html.includes("Anvar do'koni"), "do'kon nomi yozilgan");
  eq(count(html, /<svg/g), 2, "ikkala barkod ham chizilgan");
}

console.log("\n═══ 4. Barkodning uch holati ═══");
{
  /* ⚠ EAN NAZORAT RAQAMI BUZUQ BO'LSA — Code 128 ga tushadi, «hech
     narsa» ga emas. Sabab: bazadagi kod aynan o'sha raqamlar va
     Code 128 ularni bekamu-ko'st ko'taradi — skaner o'qiydi, kassada
     tovar TOPILADI. EAN ko'rinishida chizish esa mumkin emas edi:
     nazorat raqami to'g'ri kelmasa, skaner butun kodni rad etadi. */
  const html = buildLabelSheet([
    { name: "Buzuq EAN",     salePrice: 1000, barcode: "5901234123458", shortCode: 5 },
    { name: "Ixtiyoriy kod", salePrice: 1000, barcode: "ART-9912",      shortCode: 6 },
    { name: "Kodsiz",        salePrice: 1000, barcode: null,            shortCode: 7 },
  ]);
  eq(count(html, /<svg/g), 2, "buzuq EAN va ixtiyoriy kod — Code 128 bilan chizildi");
  is(html.includes("№5") && html.includes("№6") && html.includes("№7"),
     "uchalasida ham qisqa raqam bor");
  is(!/xato|error|invalid/i.test(html), "yorliqqa «xato» deb yozilmadi (mijoz ko'radi)");
}

console.log("\n═══ 5. Qochirish (HTML in'ektsiyasi) ═══");
{
  const html = buildLabelSheet([
    { name: '<script>alert(1)</script>', salePrice: 100, barcode: null, shortCode: 1 },
  ]);
  is(!html.includes("<script>"), "tovar nomidagi teg qochirilgan");
  is(html.includes("&lt;script&gt;"), "nom matn sifatida ko'rinadi");
}

console.log("\n═══ 6. Bo'sh ro'yxat ═══");
{
  let threw = false;
  try { buildLabelSheet([]); } catch { threw = true; }
  is(threw, "bo'sh ro'yxatda xato beriladi — bo'sh varaq chiqmaydi");
}

console.log("\n═══ 7. Uslub ═══");
{
  const css = labelSheetCss("small");
  is(css.includes("@page { size: A4"), "⚠ @page bor — usiz ustunlar sig'masdi");
  is(css.includes(`repeat(${LABEL_SIZES.small.cols}`), "ustunlar soni o'lchamdan olingan");
  is(css.includes("page-break-inside: avoid"), "yorliq ikki varaqqa bo'linmaydi");
}

console.log(`\n${fail ? "❌" : "✅"} Javon yorlig'i: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
