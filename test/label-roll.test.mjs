/* ══════════════════════════════════════════════════════════════════════════
   RULONGA CHOP ETISH — A4 EMAS (2026-10-03)

   ⚠ NEGA SINOV. Sozlash sehrgari «Rulon 58×40 + Xprinter» ni saqlardi,
   chop etish esa har doim A4 varaq yasardi: `sheetFor(template,
   PAGES.A4)` qattiq yozilgan edi va tanlov HECH QAYERDA o'qilmasdi.
   Bu ekranda ko'rinmaydi — faqat chop etish oynasi ochilganda yoki
   printer butun varaqni bitta yorliqqa kichraytirib chiqarganda.

   Sinov uchta narsani qulflaydi:
     1. qog'oz tanlovi yo'lni hal qiladi va A4 faqat VARAQ tanlansa;
     2. drayver yo'lida sahifa = yorliq (yoki rulon qatori);
     3. bayt yo'lida TSPL qog'oz o'lchamida, matn rasm, barkod buyruq.

   ⚠ HAQIQIY QOG'OZDA SINALMAGAN — bu bayt va HTML darajasi.

   Ishga tushirish:  node test/label-roll.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { outputMode, rollFor, rollRows, buildRollDoc, buildRollBytes, pageOf, PAGES } =
  await import("../src/lib/ek-label-print.js");
const { packMono } = await import("../src/lib/ek-label-bytes.js");
const { rollCalibrationDoc } = await import("../src/lib/ek-label-calibrate.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(Object.is(got, want), name, `olindi: ${got}, kutilgan: ${want}`);

const tpl = (w, h, over = {}) => ({
  id: 7, kind: "STICKER", widthMm: w, heightMm: h, dpi: 203,
  spec: JSON.stringify({
    padding: 1,
    barcode: { moduleDots: 2, showText: true },
    fields: [
      { key: "nameShort", x: 1, y: 1, w: w - 2, h: 6, size: 8, visible: true },
      { key: "barcode", x: 1, y: 8, w: w - 2, h: h - 16, visible: true },
      { key: "price", x: 1, y: h - 7, w: w - 2, h: 6, size: 11, visible: true,
        style: "major-minor", align: "center" },
    ],
  }),
  ...over,
});
const prod = (id, over = {}) => ({
  id, name: "Сахар 1кг", salePrice: 12000, barcode: "4780000000007", ...over,
});
const ROLL_58x40 = { mediaType: "RULON", labelWidthMm: 58, labelHeightMm: 40,
  across: 1, gapXMm: 0, gapYMm: 2, linerWidthMm: 60, sensor: "ORALIQ" };
const ROLL_30x20_3 = { mediaType: "RULON", labelWidthMm: 30, labelHeightMm: 20,
  across: 3, gapXMm: 2, gapYMm: 2, linerWidthMm: 96, sensor: "ORALIQ" };
const SHEET_A4 = { mediaType: "VARAQ", labelWidthMm: 50, labelHeightMm: 30,
  across: 3, pageWidthMm: 210, pageHeightMm: 297, name: "A4" };
const XPRINTER = { lang: "TSPL", dpi: 203, printWidthMm: 104, density: 8, speed: 4,
  offsetXMm: 0, offsetYMm: 0 };

/* ══════════════════════════════════════════════════════════════════
   1. YO'LNI QOG'OZ HAL QILADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Qayerga chiqadi ──");
{
  eq(outputMode(SHEET_A4, XPRINTER, { desktop: true, queue: "XP-365B" }), "sheet",
    "VARAQ tanlansa — varaq (printer TSPL bo'lsa ham)");
  eq(outputMode(ROLL_58x40, XPRINTER, { desktop: true, queue: "XP-365B" }), "bytes",
    "rulon + TSPL + desktop + navbat — bayt yo'li");
  eq(outputMode(ROLL_58x40, XPRINTER, { desktop: true, queue: "" }), "driver",
    "⚠ navbat tanlanmagan — bayt standart printerga ketmasin, drayver yo'li");
  eq(outputMode(ROLL_58x40, XPRINTER, { desktop: false, queue: "XP-365B" }), "driver",
    "brauzerda — drayver yo'li");
  eq(outputMode(ROLL_58x40, { lang: "EZPL" }, { desktop: true, queue: "G500" }), "driver",
    "bayt tili yo'q model — drayver yo'li");
  eq(outputMode(null, null, {}), "driver",
    "⚠ qog'oz tanlanmagan — A4 EMAS, drayver yo'li");
  eq(pageOf(SHEET_A4).heightMm, 297, "VARAQ sahifasi profildan");
  eq(pageOf({ mediaType: "VARAQ" }), PAGES.A4, "sahifa o'lchami yo'q — A4");
}

/* ══════════════════════════════════════════════════════════════════
   2. RULON QATORI VA MARKAZLASH
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Rulon qatori ──");
{
  const r = rollFor(tpl(40, 30), ROLL_58x40);
  eq(r.rowWidthMm, 58, "qator eni = yorliq eni");
  eq(r.rowHeightMm, 40, "qator bo'yi = yorliq bo'yi");
  eq(r.insetXMm, 9, "40 mm dizayn 58 mm qog'ozda o'rtada (9 mm)");
  eq(r.insetYMm, 5, "30 mm dizayn 40 mm qog'ozda o'rtada (5 mm)");

  const r3 = rollFor(tpl(30, 20), ROLL_30x20_3);
  eq(r3.rowWidthMm, 94, "3 qatorli rulon: 3×30 + 2×2 = 94 mm");

  const none = rollFor(tpl(40, 30), null);
  eq(none.rowWidthMm, 40, "qog'oz yo'q — dizayn eni");
  eq(none.rowHeightMm, 30, "qog'oz yo'q — dizayn bo'yi");

  const rows = rollRows([{ product: prod(1), quantity: 5 }, { product: prod(2), quantity: 1 }], 1);
  eq(rows.length, 2, "⚠ bir xil qatorlar yig'iladi — 6 yorliq, 2 guruh");
  eq(rows[0].copies, 5, "birinchi guruh — 5 nusxa");

  const rows3 = rollRows([{ product: prod(1), quantity: 7 }], 3);
  eq(rows3.reduce((s, x) => s + x.copies, 0), 3, "7 yorliq 3 qatorda — 3 qator");
  eq(rows3[rows3.length - 1].cells.length, 1, "oxirgi qatorda 1 yorliq");
}

/* ══════════════════════════════════════════════════════════════════
   3. DRAYVER YO'LI — SAHIFA = YORLIQ
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Drayver yo'li ──");
{
  const doc = buildRollDoc(tpl(40, 30), [{ product: prod(1), quantity: 3 }], ROLL_58x40);
  is(/@page \{ size: 58mm 40mm; margin: 0 \}/.test(doc.css),
    "⚠ @page aynan yorliq o'lchamida", doc.css.split("\n")[1]);
  is(!/210mm|297mm/.test(doc.css + doc.html), "⚠ A4 o'lchami hujjatda YO'Q");
  eq(doc.pages, 3, "har yorliq — alohida sahifa");
  eq((doc.html.match(/class="lp-page"/g) || []).length, 3, "uchta sahifa bloki");
  is(/translate\(9,5\)/.test(doc.html), "dizayn qog'oz o'rtasiga suriladi");
  eq(doc.page.widthMm, 58, "Android uchun sahifa eni");

  const bare = buildRollDoc(tpl(40, 30), [{ product: prod(1), quantity: 1 }], null);
  is(/size: 40mm 30mm/.test(bare.css), "qog'oz yo'q — sahifa dizayn o'lchamida");

  const three = buildRollDoc(tpl(30, 20), [{ product: prod(1), quantity: 4 }], ROLL_30x20_3);
  is(/size: 94mm 20mm/.test(three.css), "3 qatorli rulon: sahifa = butun qator");
  eq(three.pages, 2, "4 yorliq 3 qatorda — 2 sahifa");

  const shifted = buildRollDoc(tpl(40, 30), [{ product: prod(1), quantity: 1 }], ROLL_58x40,
    { printer: { offsetXMm: 1.5, offsetYMm: -2 } });
  is(/translate\(1\.5,-2\)/.test(shifted.html), "⚠ siljish tuzatishi drayver yo'lida ham");
}

/* ══════════════════════════════════════════════════════════════════
   4. BAYT YO'LI — TSPL
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── TSPL ──");
{
  const calls = [];
  const fakeRaster = async (svg, w, h) => {
    calls.push({ svg, w, h });
    return packMono(new Uint8ClampedArray(w * h * 4).fill(255), w, h);
  };
  const bytes = await buildRollBytes(tpl(40, 30),
    [{ product: prod(1), quantity: 5 }, { product: prod(2), quantity: 1 }],
    ROLL_58x40, XPRINTER, { raster: fakeRaster });
  const text = new TextDecoder("latin1").decode(bytes);

  eq(calls.length, 2, "rasm har guruhga bir marta (5 nusxa — bitta rasm)");
  eq(calls[0].w, 464, "rasm eni nuqtada: 58 mm × 8 = 464");
  eq(calls[0].h, 320, "rasm bo'yi nuqtada: 40 mm × 8 = 320");
  /* Barkod 30 ga yaqin `<rect>` bo'lib chiziladi; rasmda faqat ikkita
     fon qolishi kerak (qator va yorliq). */
  eq((calls[0].svg.match(/<rect/g) || []).length, 2,
    "⚠ rasmda barkod yo'q (u printer buyrug'i bilan)");
  is(/SIZE 58 mm,40 mm/.test(text), "⚠ SIZE qog'oz o'lchamida, dizayniki emas");
  is(/GAP 2 mm,0 mm/.test(text), "oraliq datchigi");
  is(/BITMAP 0,0,58,320,0,/.test(text), "BITMAP: 58 bayt × 320 qator");
  is(!/\bTEXT /.test(text), "⚠ ichki shrift ishlatilmaydi — kirill nom «????» bo'lmasin");
  is(/BARCODE 80,\d+,"EAN13"/.test(text), "barkod buyrug'i siljigan joyda (9+1 mm = 80 nuqta)");
  /* Maydon 14 mm, raqamlar printerda chiziq OSTIGA qo'shiladi:
     chiziqlar 14 − 2,6 = 11,4 mm = 91 nuqta. Butun 112 nuqta yuborilsa
     raqamlar narx ustiga chiqardi. */
  is(/"EAN13",91,1,/.test(text), "⚠ barkod raqamlari maydon ichida (chiziq 91 nuqta)",
    (text.match(/BARCODE [^\r]*/) || [""])[0]);
  is(/PRINT 5,1/.test(text), "⚠ 5 nusxa — bitta PRINT 5");
  eq((text.match(/PRINT /g) || []).length, 2, "ikki guruh — ikki PRINT");

  let threw = false;
  try { await buildRollBytes(tpl(40, 30), [{ product: prod(1) }], ROLL_58x40, XPRINTER, {}); }
  catch { threw = true; }
  is(threw, "rasterlovchisiz TSPL — xato, jim bo'sh chiqish emas");

  const zpl = new TextDecoder().decode(await buildRollBytes(tpl(40, 30),
    [{ product: prod(1), quantity: 2 }], ROLL_58x40, { ...XPRINTER, lang: "ZPL" }));
  is(/\^CI28/.test(zpl), "ZPL: UTF-8 yoqilgan (kirill nom)");
  is(/\^PQ2/.test(zpl), "ZPL: 2 nusxa");
  is(/\^PW464/.test(zpl), "ZPL: eni qog'oz bo'yicha");
}

/* ══════════════════════════════════════════════════════════════════
   5. BITMAP QUTBLI — TSPL DA 1 = OQ
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── packMono ──");
{
  const w = 10, h = 1;
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  px.set([0, 0, 0, 255], 0);          // 1-piksel qora
  px.set([0, 0, 0, 0], 4);            // 2-piksel shaffof
  const m = packMono(px, w, h);
  eq(m.data.length, 2, "10 nuqta — 2 bayt");
  eq(m.data[0], 0x7f, "⚠ qora = 0, oq = 1 (TSPL); shaffof — oq");
  eq(m.data[1], 0xff, "⚠ qator oxiridagi ortiqcha bitlar oq — o'ngda qora chiziq yo'q");
}

/* ══════════════════════════════════════════════════════════════════
   6. RULON SINOV YORLIG'I
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Sinov yorlig'i ──");
{
  const c = rollCalibrationDoc({ widthMm: 58, heightMm: 40 });
  is(/size: 58mm 40mm/.test(c.css), "sinov sahifasi — bitta yorliq, A4 emas");
  eq(c.lengthMm, 50, "o'lchanadigan chiziq butun 10 mm ga yaxlit (58 → 50)");
}


/* ══════════════════════════════════════════════════════════════════
   7. STIKERDA BARKOD — HAR DOIM (egasining talabi)
   Barkodi yo'q tovarga do'kon kodi; kod berilmasa — chop etish to'xtaydi.
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Stikerda barkod ──");
{
  const { storeCodeOf } = await import("../src/lib/ek-store-code.js");
  const { ensureBarcodes, withPreviewBarcode, drawsBarcode } =
    await import("../src/lib/ek-label-codes.js");
  const { validateTemplate } = await import("../src/lib/ek-label-validate.js");

  /* Qiymatlar `StoreCodeFromSearchCodeTest.java` dan — server bilan bir xil. */
  eq(storeCodeOf("1"), "20000011", "maxsus kod 1 → 20000011 (server bilan bir xil)");
  eq(storeCodeOf("142"), "20001421", "142 → 20001421");
  eq(storeCodeOf("101"), "20001018", "101 → 20001018");
  eq(storeCodeOf("999999"), "29999996", "999999 → 29999996");
  eq(storeCodeOf("001"), storeCodeOf("1"), "oldingi nollar bir xil kod beradi");
  eq(storeCodeOf("*142"), "20001421", "«*142» yozuvi ham");
  const long = storeCodeOf("1234567");
  is(long?.length === 13 && long.startsWith("02"), "7 xonali kod → 02… EAN-13", long);
  eq(storeCodeOf("abc"), null, "raqam bo'lmasa — null");
  eq(storeCodeOf("12345678901"), null, "sig'maydigan kod — null (jim qisqartirilmaydi)");

  const sticker = tpl(40, 30);
  const shelf = { ...tpl(70, 37), kind: "SHELF",
    spec: JSON.stringify({ fields: [{ key: "price", x: 1, y: 1, w: 60, h: 10, visible: true }] }) };
  is(drawsBarcode(sticker) && !drawsBarcode(shelf), "barkod maydoni aniqlanadi");

  const shown = withPreviewBarcode({ id: 5, name: "Parda", searchCode: "142" });
  eq(shown.barcode, "20001421", "ko'rish oynasida chiqadigan kod ko'rinadi");
  eq(shown.barcodePending, true, "«chop etishda beriladi» belgisi");
  eq(withPreviewBarcode({ id: 6, barcode: "4780000000007" }).barcodePending, undefined,
    "barkodi bor tovarga tegilmaydi");

  const calls = [];
  const gen = async (id) => {
    calls.push(id);
    if (id === 9) throw new Error("Tovarda kod yo'q");
    return { data: { barcode: storeCodeOf(String(id)) } };
  };
  const res = await ensureBarcodes([
    { product: { id: 1, name: "Choy", barcode: "4780000000007" }, quantity: 2 },
    { product: { id: 142, name: "Parda" }, quantity: 3 },
    { product: { id: 142, name: "Parda" }, quantity: 1 },
    { product: { id: 9, name: "Kabel" }, quantity: 1 },
  ], sticker, gen);
  eq(calls.filter((x) => x === 142).length, 1, "bitta tovarga bitta so'rov");
  is(!calls.includes(1), "barkodi bor tovarga kod so'ralmaydi");
  eq(res.items[1].product.barcode, "20001421", "barkodsiz tovarga serverdagi kod");
  eq(res.failed.length, 1, "⚠ kod berilmagan tovar yutilmaydi");
  eq(res.failed[0].message, "Tovarda kod yo'q", "sababi saqlanadi");

  const before = calls.length;
  const none = await ensureBarcodes([{ product: { id: 142 } }], shelf, gen);
  is(calls.length === before && none.failed.length === 0, "barkodsiz dizaynda kod so'ralmaydi");

  const ean8 = new TextDecoder("latin1").decode(await buildRollBytes(sticker,
    [{ product: prod(142, { barcode: "20001421" }), quantity: 1 }], ROLL_58x40, XPRINTER,
    { raster: async (svg, w, h) => packMono(new Uint8ClampedArray(w * h * 4).fill(255), w, h) }));
  is(/"EAN8",[^\r]*"20001421"/.test(ean8), "do'kon kodi printerga EAN-8 bo'lib boradi");

  const noBc = { ...sticker, spec: JSON.stringify({ fields: [
    { key: "price", x: 1, y: 1, w: 38, h: 10, size: 12, visible: true },
    { key: "barcode", x: 1, y: 12, w: 38, h: 14, visible: false }] }) };
  is(validateTemplate(noBc).some((e) => e.level === "error" && e.field === "barcode"),
    "⚠ barkodsiz STIKER dizayni saqlanmaydi");
  is(!validateTemplate(shelf).some((e) => e.field === "barcode"),
    "javon yorlig'ida barkod talab qilinmaydi (G1)");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
