/* ══════════════════════════════════════════════════════════════════════════
   STIKER — AVTOMATIK TANLOVLAR (2026-10-03)

   ⚠ NEGA SINOV. Oddiy ekranda do'konchi printer TILINI, qog'oz profilini va
   dizaynni TANLAMAYDI — ularni shu qoidalar tanlaydi. Bitta xato qoida va
   chek printeriga TSPL ketadi (rulon to'la tushunarsiz yozuv) yoki 58×40
   rulonga 30×20 dizayn tushib, stiker burchagida mitti bo'lib chiqadi.
   Ekranda bularning hech biri ko'rinmaydi.

   Ishga tushirish:  node test/sticker-auto.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const {
  printerKind, sortPrinters, autoPrinter, profileFor, mediaFor, stickerMedias,
  pickTemplate, setupDone, printerErrorKey, MAIN_SIZES, designOf, designsFor, DESIGN_ORDER,
  sheetMedia,
} = await import("../src/lib/ek-sticker-auto.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(Object.is(got, want), name, `olindi: ${got}, kutilgan: ${want}`);

console.log("\n── Printer nomidan turi ──");
{
  eq(printerKind("Xprinter XP-365B"), "tspl", "Xprinter XP-365B — stiker (TSPL)");
  eq(printerKind("XP-420B"), "tspl", "XP-420B — stiker");
  eq(printerKind("TSC TE200"), "tspl", "TSC — stiker");
  eq(printerKind("Zebra ZD230"), "zpl", "Zebra — ZPL");
  eq(printerKind("Godex G500"), "ezpl", "Godex — EZPL");
  eq(printerKind("XP-80C"), "receipt", "⚠ Xprinter XP-80C — CHEK printeri, TSPL emas");
  eq(printerKind("XP-58IIH"), "receipt", "⚠ XP-58 — chek printeri");
  eq(printerKind("POS-80"), "receipt", "POS-80 — chek");
  eq(printerKind("Microsoft Print to PDF"), "virtual", "PDF — virtual");
  eq(printerKind("HP LaserJet M1132"), "other", "ofis printeri — boshqa");
}

console.log("\n── Ro'yxat va avtomatik tanlov ──");
{
  const names = ["Microsoft Print to PDF", "XP-80C", "HP LaserJet", "Xprinter XP-365B", "Fax"];
  const s = sortPrinters(names, "XP-80C");
  eq(s[0].name, "Xprinter XP-365B", "stiker printeri ro'yxat boshida");
  eq(s[s.length - 1].kind, "virtual", "virtual printerlar oxirida");
  eq(autoPrinter(names, "XP-80C"), "Xprinter XP-365B", "yagona stiker printeri — avtomatik tanlanadi");
  eq(autoPrinter(["Xprinter XP-365B", "TSC TE200"]), null,
    "⚠ ikkita stiker printeri — taxmin qilinmaydi");
  eq(autoPrinter(["HP LaserJet", "XP-80C"]), null, "stiker printeri yo'q — tanlanmaydi");
  eq(sortPrinters(["My Label"], "My Label")[0].kind, "receipt",
    "kassada chek printeri sifatida turgan nom — chek");
}

console.log("\n── Printer profili ──");
{
  const P = [
    { id: 1, code: "xprinter_365b", lang: "TSPL", system: true },
    { id: 2, code: "tsc_te200", lang: "TSPL", system: true },
    { id: 3, code: "zebra_zd230", lang: "ZPL", system: true },
    { id: 4, code: "godex_g500", lang: "EZPL", system: true },
    { id: 5, code: "rongta_rp400", lang: "TSPL", system: true },
    { id: 8, code: "driver_a4", lang: "DRAYVER", system: true },
  ];
  eq(profileFor("Xprinter XP-365B", P)?.id, 1, "Xprinter → xprinter_365b");
  eq(profileFor("TSC TTP-244", P)?.id, 2, "TSC → tsc_te200");
  eq(profileFor("Rongta RP410", P)?.id, 5, "Rongta → rongta_rp400");
  eq(profileFor("Zebra GK420d", P)?.id, 3, "Zebra → ZPL");
  eq(profileFor("HP LaserJet", P)?.id, 8, "⚠ noma'lum printer → drayver (oyna), TSPL emas");
  eq(profileFor("XP-80C", P)?.id, 8, "⚠ chek printeri → drayver, TSPL emas");
}

console.log("\n── Qog'oz va dizayn ──");
{
  const M = [
    { id: 1, mediaType: "RULON", labelWidthMm: 58, labelHeightMm: 40, across: 1, sensor: "ORALIQ" },
    { id: 2, mediaType: "RULON", labelWidthMm: 40, labelHeightMm: 30, across: 1, sensor: "ORALIQ" },
    { id: 3, mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20, across: 2, sensor: "ORALIQ" },
    { id: 4, mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20, across: 3, sensor: "ORALIQ" },
    { id: 5, mediaType: "RULON", labelWidthMm: 48, labelHeightMm: 40, across: 1, sensor: "UZLUKSIZ" },
    { id: 6, mediaType: "VARAQ", labelWidthMm: 50, labelHeightMm: 30, across: 3, sensor: "ORALIQ" },
  ];
  eq(mediaFor(58, 40, M)?.id, 1, "58×40 → rulon");
  eq(mediaFor(30, 20, M)?.id, 3, "30×20 → bir qatorlisi bo'lmasa birinchisi");
  eq(MAIN_SIZES.every(([w, h]) => mediaFor(w, h, M)), true, "uchta asosiy o'lcham ham topiladi");
  is(!stickerMedias(M).some((m) => m.id === 5 || m.id === 6), "chek lentasi va varaq stiker ro'yxatida yo'q");

  const T = [
    { id: 10, kind: "STICKER", widthMm: 30, heightMm: 20, system: true },
    { id: 11, kind: "STICKER", widthMm: 40, heightMm: 30, system: true },
    { id: 12, kind: "STICKER", widthMm: 58, heightMm: 40, system: true },
    { id: 13, kind: "STICKER", widthMm: 40, heightMm: 60, system: true },
    { id: 14, kind: "SHELF", widthMm: 58, heightMm: 40, system: true },
    { id: 15, kind: "STICKER", widthMm: 40, heightMm: 30, system: false },
  ];
  eq(pickTemplate(T, M[0])?.id, 12, "58×40 rulon → aynan 58×40 dizayn");
  eq(pickTemplate(T, M[1])?.id, 15, "aynan o'lchamda do'konning o'zinikisi tizimnikidan oldin");
  eq(pickTemplate(T, { labelWidthMm: 50, labelHeightMm: 35 })?.id, 11,
    "⚠ aniq mos yo'q — sig'adiganlarning ENG KATTASI (mitti emas)");
  eq(pickTemplate(T, M[1], 13)?.id, 15, "do'konchi tanlagani sig'masa — mosi");
  eq(pickTemplate(T, { labelWidthMm: 20, labelHeightMm: 10 })?.id, 10, "hech biri sig'masa — eng kichigi");
  is(pickTemplate(T, M[0])?.kind === "STICKER", "javon yorlig'i stiker sifatida tanlanmaydi");
}

console.log("\n── Sozlash tugaganmi ──");
{
  eq(setupDone({}, { desktop: false }), false, "qog'oz yo'q — sozlanmagan");
  eq(setupDone({ media: { id: 1 } }, { desktop: false }), true, "brauzerda qog'oz yetarli");
  eq(setupDone({ media: { id: 1 } }, { desktop: true, queue: "" }), false,
    "⚠ desktopda printer tanlanmagan — sozlanmagan (baytlar standart printerga ketmasin)");
  eq(setupDone({ media: { id: 1 } }, { desktop: true, queue: "XP-365B" }), true, "desktop: qog'oz + printer");
}

console.log("\n── Xato odam tilida ──");
{
  eq(printerErrorKey("Printer ochilmadi (XP-365B): 0x80070709"), "stk.errPrinter", "printer ochilmadi");
  eq(printerErrorKey("StartDocPrinter muvaffaqiyatsiz"), "stk.errPrinter", "StartDocPrinter");
  eq(printerErrorKey("Printerga ulanib bo'lmadi (1.2.3.4:9100)"), "stk.errNetwork", "tarmoq");
  eq(printerErrorKey("Tovarda kod yo'q"), null, "boshqa xato — o'z matni bilan");
}


console.log("\n── Dizayn hamma o'lchamda (V142) ──");
{
  const D = (code, w, h, extra = {}) => ({ id: code, code, kind: "STICKER", widthMm: w, heightMm: h, system: true, ...extra });
  const T = [
    D("stk_big_price_58x40", 58, 40), D("stk_standard_58x40", 58, 40), D("stk_side_58x40", 58, 40),
    D("sticker_standard", 40, 30), D("stk_big_price_40x30", 40, 30), D("stk_side_40x30", 40, 30),
    D("sticker_small", 30, 20), D("stk_big_price_30x20", 30, 20),
    { id: 99, code: null, kind: "STICKER", widthMm: 40, heightMm: 30, system: false },
  ];
  const R58 = { labelWidthMm: 58, labelHeightMm: 40 }, R40 = { labelWidthMm: 40, labelHeightMm: 30 };
  eq(designOf(T[0]), "big_price", "kod → dizayn");
  eq(designOf(T[3]), "standard", "eski sticker_standard → standart");
  eq(designOf(T[6]), "barcode_price", "eski sticker_small → barkod va narx");
  eq(designOf(T[8]), null, "do'konning o'z shabloni — dizaynsiz");
  eq(pickTemplate(T, R58)?.code, "stk_standard_58x40",
    "⚠ tanlov yo'q — «Standart», alifbo bo'yicha birinchisi («Barkod…») emas");
  eq(pickTemplate(T, R58, "stk_big_price_40x30")?.code, "stk_big_price_58x40",
    "⚠ rulon almashdi — o'sha KO'RINISH yangi o'lchamda");
  eq(pickTemplate(T, R40, "stk_side_58x40")?.code, "stk_side_40x30", "kattadan kichikka ham");
  eq(pickTemplate(T, R40)?.id, 99, "aynan o'lchamda do'konning o'zinikisi birinchi");
  const g = designsFor(T, R58).map((x) => designOf(x));
  eq(g.join(","), "standard,big_price,side", "galereya: faqat shu o'lcham, DESIGN_ORDER tartibida");
  eq(designsFor(T, R40)[0].id, 99, "galereyada do'konning o'zinikisi tepada");
  eq(DESIGN_ORDER.length, 14, "14 dizayn");
}


console.log("\n── Narx yorlig'i oddiy rejimda ──");
{
  const S = (code, w, h, extra = {}) => ({ id: code, code, kind: "SHELF", widthMm: w, heightMm: h, system: true, ...extra });
  const T = [S("shf_big_price_58x40", 58, 40), S("shf_classic_58x40", 58, 40),
    S("shelf_classic", 70, 37, { isDefault: true }), S("shf_classic_148x105", 148, 105),
    { id: "stk", code: "stk_standard_58x40", kind: "STICKER", widthMm: 58, heightMm: 40, system: true }];
  const A4 = { id: 9, code: "sheet_a4", mediaType: "VARAQ", labelWidthMm: 50, labelHeightMm: 30, pageWidthMm: 210, pageHeightMm: 297 };
  eq(pickTemplate(T, { mediaType: "RULON", labelWidthMm: 58, labelHeightMm: 40 }, null, "SHELF")?.code,
    "shf_classic_58x40", "rulonda — «Klassik» o'sha o'lchamda");
  eq(pickTemplate(T, A4, null, "SHELF")?.code, "shelf_classic",
    "⚠ A4 da varaq katagiga (50×30) qarab emas — standart javon dizayni");
  eq(pickTemplate(T, A4, "shf_classic_148x105", "SHELF")?.code, "shf_classic_148x105",
    "A4 da do'konchi tanlagan o'lcham saqlanadi");
  eq(pickTemplate(T, { mediaType: "RULON", labelWidthMm: 58, labelHeightMm: 40 }, null, "STICKER")?.code,
    "stk_standard_58x40", "stiker tanlovi javon shablonini olmaydi");
  eq(setupDone({ media: A4 }, { desktop: true, queue: "" }), true,
    "⚠ A4 — navbatsiz ham tayyor (oddiy printer chop etish oynasida tanlanadi)");
  eq(sheetMedia([{ id: 1, mediaType: "RULON" }, A4])?.id, 9, "A4 varaq profili topiladi");
}

/* ⚠ «4 TA KIRITILSA 2 TA CHIQYAPTI» (egasi, 2026-10-05). 30×20 ning bir
   qatorli profili yo'q edi va katta tugma «2 qatorda» ni olardi: bir ustunli
   rulonda har qator 62 mm chizilib, o'ng stiker qog'ozdan tashqariga tushardi.
   V147 bir qatorli profil qo'shdi — u bor bo'lsa, AYNAN u tanlanadi. */
{
  const { rollRows } = await import("../src/lib/ek-label-print.js");
  const R = [
    { id: 21, mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20, across: 2, sensor: "ORALIQ" },
    { id: 22, mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20, across: 3, sensor: "ORALIQ" },
    { id: 23, mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20, across: 1, sensor: "ORALIQ" },
  ];
  eq(mediaFor(30, 20, R)?.id, 23, "⚠ 30×20 → bir qatorli rulon (2 qatorlisi emas)");
  const rows = rollRows([{ product: { id: 1 }, quantity: 4 }], 1);
  eq(rows.reduce((s, r) => s + r.copies * r.cells.length, 0), 4, "⚠ 4 ta kiritildi — bir qatorli rulonda 4 ta chiqadi");
  const two = rollRows([{ product: { id: 1 }, quantity: 4 }], 2);
  eq(two.reduce((s, r) => s + r.copies * r.cells.length, 0), 4, "2 qatorli rulonda ham jami 4 ta (2 qator × 2)");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
