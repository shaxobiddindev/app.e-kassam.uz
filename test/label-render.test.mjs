/* ══════════════════════════════════════════════════════════════════════════
   F2 — YAGONA RENDERER VA BARKOD FIZIKASI

   ⚠ ENG MUHIM BAND — «bir xil kirish, bir xil chiqish». Ko'rish oynasi
   va chop etish bitta funksiyadan o'tishi SHART: ikkita chizuvchi
   bo'lsa, ko'rish oynasi ertami-kechmi yolg'on gapiradi va buni
   do'konchi 200 ta yorliq chiqargandan keyin biladi.

   Ishga tushirish:  node test/label-render.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { renderLabel, renderSheet } = await import("../src/lib/ek-label-render.js");
const { barcodeMetrics, barcodeKind, dotMm } =
  await import("../src/lib/ek-label-barcode.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); }
                       else { fail++; console.log("  ❌ " + m); } };
const eq = (g, w, m) => ok(Object.is(g, w), `${m}  (kutilgan ${w}, keldi ${g})`);

const TPL = {
  kind: "SHELF", widthMm: 70, heightMm: 37, dpi: 300, thermal: false,
  spec: {
    background: "#fff", border: { widthMm: 0.2 },
    barcode: { moduleDots: 2, quietLeftModules: 9, quietRightModules: 7, showText: true },
    fields: [
      { key: "name",    x: 2, y: 2,  w: 66, h: 8,  size: 10, weight: 700, overflow: "shrink", visible: true },
      { key: "price",   x: 2, y: 11, w: 42, h: 14, size: 26, weight: 900, style: "major-minor", visible: true },
      { key: "barcode", x: 2, y: 26, w: 66, h: 9,  visible: true },
    ],
  },
};
const P = { id: 1, name: "Shokolad Alpen Gold", salePrice: 24500,
            barcode: "5901234123457", searchCode: "425" };

console.log("\n── Barkod fizikasi ──");
{
  /* ⚠ Modul BUTUN NUQTAGA tushsin. 203 dpi: 1 nuqta = 0,125 mm. */
  eq(Number(dotMm(203).toFixed(4)), 0.1251, "203 dpi da nuqta kengligi");
  eq(Number(dotMm(300).toFixed(4)), 0.0847, "300 dpi da nuqta kengligi");

  const m2 = barcodeMetrics("5901234123457", { dpi: 203, moduleDots: 2, heightMm: 20 });
  const m3 = barcodeMetrics("5901234123457", { dpi: 203, moduleDots: 3, heightMm: 20 });
  eq(Number(m2.widthMm.toFixed(2)), 27.78, "EAN-13, 203 dpi, 2 nuqta");
  eq(Number(m3.widthMm.toFixed(2)), 41.67, "EAN-13, 203 dpi, 3 nuqta");
  eq(Number(barcodeMetrics("5901234123457", { dpi: 300, moduleDots: 2, heightMm: 20 })
      .widthMm.toFixed(2)), 18.80, "EAN-13, 300 dpi, 2 nuqta");

  /* ⚠ Modul mm da EMAS, nuqtada berilgani uchun kenglik har doim
     nuqtaga karrali. Bu sinov aynan shu saqlash shaklini qo'riqlaydi. */
  const perDot = m2.moduleMm / dotMm(203);
  ok(Math.abs(perDot - 2) < 1e-9, "⚠ modul aynan 2 nuqta — kasr nuqta yo'q");

  eq(barcodeKind("5901234123457"), "EAN13", "to'g'ri EAN-13 tanildi");
  eq(barcodeKind("96385074"), "EAN8", "EAN-8 tanildi");
  /* ⚠ Nazorat raqami buzuq EAN — EAN bo'lib CHIZILMAYDI. */
  eq(barcodeKind("5901234123450"), "CODE128", "⚠ buzuq nazorat raqami EAN bo'lmaydi");
  eq(barcodeKind(""), null, "bo'sh kod — chizilmaydi");
}

console.log("\n── Yagona renderer ──");
{
  const a = renderLabel(TPL, P);
  const b = renderLabel(TPL, P);
  ok(a.svg === b.svg, "⚠ DETERMINISTIK: bir xil kirish → bayt darajasida bir xil chiqish");

  ok(a.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="37mm"'),
     "⚠ o'lcham MILLIMETRDA — brauzer qog'ozda aynan shuncha chizadi");
  ok(a.svg.includes('viewBox="0 0 70 37"'), "viewBox: 1 birlik = 1 mm");

  /* ⚠ CHOP ETISH AYNAN SHU FUNKSIYADAN O'TADI. */
  const sheet = renderSheet(TPL, [{ product: P, quantity: 1 }],
                            { cols: 2, rows: 7, startPosition: 1 });
  const inner = a.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  ok(sheet.pages[0].includes(inner),
     "⚠ varaqdagi yorliq — `renderLabel` chiqishining O'ZI (ikkinchi chizuvchi yo'q)");

  /* ⚠ Boshlanish pozitsiyasi: 7 dan boshlansa birinchi 6 katak bo'sh. */
  const s7 = renderSheet(TPL, [{ product: P, quantity: 1 }],
                         { cols: 2, rows: 7, startPosition: 7 });
  eq(s7.cellCount, 7, "⚠ 7-katakdan boshlanganda oldingi 6 katak bo'sh qoladi");
  const first = renderSheet(TPL, [{ product: P, quantity: 1 }],
                            { cols: 2, rows: 7, startPosition: 1 });
  ok(s7.pages[0] !== first.pages[0], "boshlanish pozitsiyasi joylashuvni o'zgartiradi");
}

console.log("\n── Ogohlantirishlar: jimgina buzilmasin ──");
{
  /* ⚠ Nazorat raqami buzuq EAN — EAN bo'lib CHIZILMAYDI, lekin
     yo'qolib ham ketmaydi: qoida bo'yicha u Code 128 bo'lib chiqadi
     (§10s). Ya'ni skaner uni BOSHQA tovar deb o'qiy olmaydi.

     ⚠ Bu sinovning birinchi tahriri BO'SH edi: `A || !A || A`
     ko'rinishidagi shart har doim rost bo'lardi. Shunday shart
     sinov emas — u faqat yashil rang beradi. */
  const bad = renderLabel(TPL, { ...P, barcode: "5901234123450" });
  ok(!bad.warnings.some((w) => w.code === "BAD_BARCODE"),
     "buzuq nazorat raqami Code 128 bo'lib chiqadi, tashlanmaydi");
  ok(bad.svg.includes("<rect"), "u haqiqatan chiziladi");
  ok(bad.svg !== renderLabel(TPL, P).svg,
     "⚠ va EAN dan BOSHQACHA chiziladi — ikkalasi bir xil bo'lsa qoida ishlamagan bo'lardi");

  /* Barkodsiz tovar — bo'sh joy emas, ogohlantirish. */
  const none = renderLabel(TPL, { ...P, barcode: null });
  ok(none.warnings.some((w) => w.code === "NO_BARCODE"),
     "⚠ barkodsiz tovarda ogohlantirish chiqadi");

  /* ⚠ Barkod joyga sig'masa — CHIZILMAYDI va necha mm toshgani aytiladi. */
  const narrow = JSON.parse(JSON.stringify(TPL));
  narrow.spec.fields[2].w = 10;
  const tight = renderLabel(narrow, P);
  const w = tight.warnings.find((x) => x.code === "BARCODE_WIDE");
  ok(!!w && /mm toshdi/.test(w.text), "⚠ sig'magan barkod: necha mm toshgani aytiladi");
  ok(!tight.svg.includes("<rect x=\"12"), "sig'magan barkod chizilmaydi");

  /* Uzun nom — kichrayadi, lekin o'qib bo'lmas darajada emas. */
  const long = renderLabel(TPL, { ...P, name: "A".repeat(120) });
  ok(long.warnings.some((x) => x.code === "TEXT_TINY"),
     "⚠ juda kichrayadigan shrift ogohlantiriladi");
}

console.log("\n── Narx: butun yirik, tiyin kichik ──");
{
  const svg = renderLabel(TPL, { ...P, salePrice: 24500.5 }).svg;
  ok(/<tspan[^>]*dy="-/.test(svg), "⚠ tiyin qismi YUQORIDA (dy manfiy)");
  ok(svg.includes("</tspan>"), "tiyin alohida tspan da");
  const whole = renderLabel(TPL, { ...P, salePrice: 24500 }).svg;
  ok(!whole.includes("<tspan"), "butun summada tiyin qismi umuman chizilmaydi");
  /* Minglar ajratgichi — `ek-format` bilan BIR XIL manba. */
  ok(/24 500/.test(whole), "⚠ minglar ajratgichi `ek-format` dagi bilan bir xil");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
