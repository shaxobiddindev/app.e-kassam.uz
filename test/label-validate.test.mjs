/* ══════════════════════════════════════════════════════════════════════════
   F4 — VALIDATSIYA: MAYDON VA MAYDONLARARO

   ⚠ ASOSIY QISM — MAYDONLARARO. Har bir qiymat alohida to'g'ri
   bo'lishi mumkin: chekka 10 mm normal, ustun 5 ta normal, yorliq
   70 mm normal. Birgalikda esa ular A4 ga sig'maydi.

   ⚠ XATO ANIQ SONNI AYTSIN. «Sig'madi» degan xabar foydalanuvchini
   taxmin qilishga majbur qiladi.

   Ishga tushirish:  node test/label-validate.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const v = await import("../src/lib/ek-label-validate.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); }
                       else { fail++; console.log("  ❌ " + m); } };

const tpl = (over = {}) => ({
  kind: "SHELF", widthMm: 70, heightMm: 37, dpi: 300, thermal: false,
  spec: {
    barcode: { moduleDots: 2, quietLeftModules: 9, quietRightModules: 7 },
    fields: [{ key: "name", x: 2, y: 2, w: 66, h: 8, size: 10, visible: true }],
    ...(over.spec || {}),
  },
  ...over,
});
const sheet = (over = {}) => ({
  sheetWidthMm: 210, sheetHeightMm: 297,
  marginLeftMm: 8, marginRightMm: 8, marginTopMm: 10, marginBottomMm: 10,
  gapXMm: 2, gapYMm: 0, cols: 2, rows: 7, startPosition: 1, ...over,
});
const errs = (list) => v.blocking(list).map((x) => x.text).join(" | ");

console.log("\n── Maydon darajasi ──");
{
  ok(v.blocking(v.validateTemplate(tpl())).length === 0, "to'g'ri shablon — xato yo'q");

  const small = errs(v.validateTemplate(tpl({ widthMm: 5 })));
  ok(/10/.test(small), "⚠ 10 mm dan kichik yorliq rad etiladi");

  const frac = errs(v.validateTemplate(tpl({ widthMm: 70.55 })));
  ok(/kasr/.test(frac), "⚠ ikkinchi kasr xona rad etiladi");

  const font = errs(v.validateTemplate(tpl({
    spec: { fields: [{ key: "name", x: 2, y: 2, w: 60, h: 8, size: 120, visible: true }] } })));
  ok(/120/.test(font), "⚠ 120 pt shrift rad etiladi");

  const out = errs(v.validateTemplate(tpl({
    spec: { fields: [{ key: "name", x: 2, y: 2, w: 80, h: 8, size: 10, visible: true }] } })));
  ok(/12 mm/.test(out), "⚠ chiqib ketgan maydon: aynan 12 mm deyiladi");

  ok(errs(v.validateTemplate(tpl({ dpi: 150 }))).includes("150"), "noma'lum dpi rad etiladi");
}

console.log("\n── Barkod ──");
{
  const bad = errs(v.validateTemplate(tpl({
    spec: { barcode: { moduleDots: 5 },
            fields: [{ key: "barcode", x: 2, y: 2, w: 60, h: 20, visible: true }] } })));
  ok(/2 yoki 3/.test(bad), "⚠ oraliq modul kengligi rad etiladi");

  /* 203 dpi, 3 nuqta → EAN-13 uchun 41,7 mm kerak; joy 20 mm. */
  const narrow = errs(v.validateTemplate({
    ...tpl({ dpi: 203 }),
    spec: { barcode: { moduleDots: 3, quietLeftModules: 9, quietRightModules: 7 },
            fields: [{ key: "barcode", x: 2, y: 2, w: 20, h: 20, visible: true }] } }));
  ok(/41\.7|41,7/.test(narrow) && /yetmayapti/.test(narrow),
     "⚠ tor barkod: necha mm yetmayotgani aytiladi");
}

console.log("\n── Maydonlararo: varaq ──");
{
  ok(v.blocking(v.validateSheet(tpl(), sheet())).length === 0, "2×7 A4 ga sig'adi");

  /* 8+8 + 3×70 + 2×2 = 230 > 210 → 20 mm toshdi. */
  const wide = errs(v.validateSheet(tpl(), sheet({ cols: 3 })));
  ok(/20 mm toshdi/.test(wide), "⚠ eniga toshgani — aynan 20 mm");
  ok(/ustunni 2 ga/.test(wide), "⚠ va nima qilish kerakligi aytiladi");

  /* 10+10 + 9×37 = 353 > 297. */
  const tall = errs(v.validateSheet(tpl(), sheet({ rows: 9 })));
  ok(/toshdi/.test(tall) && /qatorni/.test(tall), "⚠ bo'yiga toshgani ham aytiladi");

  const start = errs(v.validateSheet(tpl(), sheet({ startPosition: 99 })));
  ok(/1 dan 14 gacha/.test(start), "⚠ boshlanish pozitsiyasi chegarasi aniq");
  ok(v.blocking(v.validateSheet(tpl(), sheet({ startPosition: 7 }))).length === 0,
     "7-katakdan boshlash qonuniy");

  ok(/butun son/.test(errs(v.validateSheet(tpl(), sheet({ cols: 2.5 })))),
     "ustun butun son bo'lishi kerak");
}

console.log("\n── Navbat: soni ──");
{
  ok(v.blocking(v.validateJob([{ quantity: 5 }], sheet())).length === 0, "5 dona — normal");
  ok(/999/.test(errs(v.validateJob([{ quantity: 5000 }], sheet()))), "⚠ 999 dan ortiq rad etiladi");
  /* ⚠ Ko'p yorliq TO'SILMAYDI — tasdiq so'raladi. */
  const many = v.validateJob([{ quantity: 900 }, { quantity: 900 }], sheet());
  ok(v.blocking(many).length === 0, "⚠ ko'p yorliq to'silmaydi");
  ok(many.some((x) => x.level === "warning" && /varaq chiqadi/.test(x.text)),
     "⚠ nechta varaq chiqishi aytiladi");
}

console.log("\n── Termal printerda rang ──");
{
  const t = tpl({ thermal: true, spec: { background: "#ff0000",
    fields: [{ key: "name", x: 2, y: 2, w: 60, h: 8, size: 10, visible: true }] } });
  const list = v.validateTemplate(t);
  ok(v.blocking(list).length === 0, "⚠ rang XATO emas — shablon baribir chiqadi");
  ok(list.some((x) => x.level === "warning" && /rang yo'q/.test(x.text)),
     "⚠ lekin sababi aytiladi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
