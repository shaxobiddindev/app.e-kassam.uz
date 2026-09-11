/* ══════════════════════════════════════════════════════════════════════════
   BAYT YO'LI: TSPL VA ZPL (G3)

   ⚠ ASOSIY BAND — HTML VA BAYT YO'LI BIR XIL JOYLASHUVNI CHIQARADI.
   Ikkita alohida joylashuv yozilsa ular ALBATTA ayri tushadi: bugun
   bir xil, olti oydan keyin biri 2 mm chapda. Buni faqat ikkala
   yo'ldan ham chiqarib ko'rgan odam biladi — ya'ni hech kim.

   Bu yerda ikkala chiqishning KOORDINATALARI solishtiriladi.

   ⚠ HAQIQIY PRINTERDA SINALMAGAN va sinov to'plami buni qila
   olmaydi: bu yerda faqat BAYT qatlami tekshiriladi.

   Ishga tushirish:  node test/label-bytes.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { layoutLabel, renderLabel } = await import("../src/lib/ek-label-render.js");
const { toTSPL, toZPL, toBytes, mmToDots, supportsBytes, calibrationCommand } =
  await import("../src/lib/ek-label-bytes.js");

let pass = 0, fail = 0;
const is = (c, n, extra = "") => {
  if (c) { pass++; console.log("  ✅ " + n); }
  else { fail++; console.log(`  ❌ ${n}${extra ? "\n     " + extra : ""}`); }
};
const eq = (g, w, n) => is(Object.is(g, w), n, `olindi: ${g}, kutilgan: ${w}`);

const TPL = {
  kind: "STICKER", widthMm: 58, heightMm: 40, dpi: 203, thermal: true,
  spec: JSON.stringify({
    background: "#ffffff",
    border: { widthMm: 0.2, color: "#000000" },
    barcode: { moduleDots: 2, showText: true, quietLeftModules: 9, quietRightModules: 7 },
    fields: [
      { key: "name", x: 2, y: 2, w: 54, h: 6, size: 9, weight: 700, visible: true },
      { key: "price", x: 2, y: 9, w: 54, h: 8, size: 14, weight: 900,
        align: "right", visible: true },
      { key: "barcode", x: 2, y: 20, w: 54, h: 14, visible: true },
    ],
  }),
};
const P = { id: 1, name: "Choy 100 g", salePrice: 12000,
            searchCode: "425", barcode: "4780000000007" };
const MEDIA = { sensor: "ORALIQ", gapYMm: 2 };
const PRINTER = { density: 8, speed: 4, offsetXMm: 0, offsetYMm: 0 };

const layout = layoutLabel(TPL, P, {});
const tspl = toTSPL(layout, { dpi: 203, media: MEDIA, printer: PRINTER });
const zpl = toZPL(layout, { dpi: 203, media: MEDIA, printer: PRINTER });

/* ══════════════════════════════════════════════════════════════════
   1. YAGONA JOYLASHUV
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── HTML va bayt yo'li bir xil joylashuvdan ──");
{
  /* SVG dagi barkod boshlanish nuqtasi va TSPL/ZPL dagisi bir xil
     mm ga to'g'ri kelishi kerak. */
  const bc = layout.items.find((i) => i.kind === "barcode");
  is(!!bc, "joylashuvda barkod bor");

  const wantX = mmToDots(bc.x, 203), wantY = mmToDots(bc.y, 203);
  const tb = tspl.match(/BARCODE (\d+),(\d+),/);
  is(!!tb, "TSPL da barkod bor");
  eq(Number(tb[1]), wantX, "⚠ TSPL barkod X joylashuvdan farq qilyapti");
  eq(Number(tb[2]), wantY, "⚠ TSPL barkod Y joylashuvdan farq qilyapti");

  const zb = zpl.match(/\^FO(\d+),(\d+)\^BY/);
  is(!!zb, "ZPL da barkod bor");
  eq(Number(zb[1]), wantX, "⚠ ZPL barkod X joylashuvdan farq qilyapti");
  eq(Number(zb[2]), wantY, "⚠ ZPL barkod Y joylashuvdan farq qilyapti");

  /* ⚠ VA ENG MUHIMI — IKKALASI BIR-BIRIGA TENG. */
  eq(Number(tb[1]), Number(zb[1]), "⚠ TSPL va ZPL barkod X lari ayri tushdi");
  eq(Number(tb[2]), Number(zb[2]), "⚠ TSPL va ZPL barkod Y lari ayri tushdi");

  /* Matn maydonlari ham. */
  const name = layout.items.find((i) => i.kind === "text" && i.key === "name");
  const tt = tspl.match(/TEXT (\d+),(\d+),/);
  eq(Number(tt[2]), mmToDots(name.y, 203), "⚠ TSPL matn Y si joylashuvdan farq qilyapti");

  /* ══ O'NGGA TEKISLANGAN MAYDON — IKKI TIL, BITTA JOY ══

     ⚠ BU YERDA IKKALA TILNING KOORDINATASI ATAY BOSHQACHA va
     shuning uchun ularni ko'r-ko'rona solishtirish MUMKIN EMAS:

       · TSPL da maydon qutisi yo'q. Tekislash boshlanish
         nuqtasini SURIB bajariladi: o'ngga tekislangan matn
         qutining O'NG chetidan (x + w) boshlanadi, yonida
         tekislash bayrog'i 3 turadi.
       · ZPL da `^FB` qutisi bor. Boshlanish nuqtasi qutining
         CHAP chetida (x) qoladi, eni va `R` bayrog'i esa
         `^FB` ga beriladi.

     Ya'ni 448 va 16 — ikkalasi ham TO'G'RI va ikkalasi ham
     qog'ozning AYNAN BIR JOYINI ko'rsatadi. Shuning uchun
     tekshiruv koordinatani emas, HAR IKKALA TILDA CHIQADIGAN
     QUTINI solishtiradi.

     ⚠ BU SINOV KEYIN QO'SHILDI: eskisi faqat barkod va `name`
     ni tekshirardi, ya'ni ZPL dan `^FB` yo'qolsa yoki `R`
     bayrog'i `L` ga aylansa, narx yorliqning CHAP chetiga
     ko'chib ketardi va birorta sinov yiqilmasdi. */
  const price = layout.items.find((i) => i.kind === "text" && i.key === "price");
  is(price?.align === "right", "sinov namunasida o'ngga tekislangan maydon bor");

  const left  = mmToDots(price.x, 203);
  const right = mmToDots(price.x + price.w, 203);
  const top   = mmToDots(price.y, 203);

  /* ⚠ QATOR Y BO'YICHA TOPILADI, X bo'yicha emas: `name` ham
     shu x da va shu enda turadi. Birinchi mos qatorni olish
     `name` ni tanlab qo'yardi va bu sinovning O'ZI shunday
     yiqildi — tekislash bayrog'i `L` chiqdi. */
  const tp = tspl.split("\r\n").find((l) => l.startsWith(`TEXT ${right},${top},`));
  is(!!tp, "⚠ TSPL da o'ngga tekislangan matn yo'q");
  eq(Number(tp.match(/TEXT (\d+),/)[1]), right,
     "⚠ TSPL o'ngga tekislashda boshlanish nuqtasi qutining o'ng chetida bo'lishi kerak");
  eq(Number(tp.match(/,(\d),"[^"]*"$/)[1]), 3,
     "⚠ TSPL tekislash bayrog'i 3 (o'ngga) bo'lishi kerak");

  const zp = zpl.split("\n").find((l) => l.startsWith(`^FO${left},${top}^`) && l.includes("^FB"));
  is(!!zp, "⚠ ZPL da chap chetdan boshlanadigan `^FB` qutisi yo'q");
  eq(Number(zp.match(/\^FB(\d+),/)[1]), right - left,
     "⚠ ZPL `^FB` qutisining eni joylashuvdagi maydon enidan farq qilyapti");
  is(/\^FB\d+,1,0,R,/.test(zp), "⚠ ZPL da o'ngga tekislash bayrog'i yo'q");

  /* ⚠ VA XULOSA: ikkala til ham matnni AYNAN bir joyga qo'yadi. */
  const tsplRight = Number(tp.match(/TEXT (\d+),/)[1]);
  const zplRight = Number(zp.match(/\^FO(\d+),/)[1]) + Number(zp.match(/\^FB(\d+),/)[1]);
  eq(tsplRight, zplRight,
     "⚠ TSPL va ZPL matnning O'NG CHETI ayri tushdi — bitta joylashuv, ikki xil natija");
}

/* ══════════════════════════════════════════════════════════════════
   2. MM → NUQTA
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── O'lcham nuqtaga tushadi ──");
{
  eq(mmToDots(58, 203), 464, "58 mm = 464 nuqta (203 dpi): 58 × 203 / 25,4 = 463,54");
  eq(mmToDots(58, 300), 685, "58 mm = 685 nuqta (300 dpi)");
  eq(mmToDots(0, 203), 0, "nol nol bo'lib qoladi");

  /* ⚠ DPI JOYLASHUVNI EMAS, FAQAT NUQTAGA O'GIRISHNI O'ZGARTIRADI:
     yorliqning o'zi baribir 58 mm. */
  const hi = toTSPL(layout, { dpi: 300, media: MEDIA, printer: PRINTER });
  is(hi.includes("SIZE 58 mm,40 mm"), "300 dpi da ham yorliq 58 mm");
  is(!hi.includes("BARCODE 16,"), "⚠ 300 dpi da nuqta soni o'zgarishi kerak edi");
}

/* ══════════════════════════════════════════════════════════════════
   3. SENSOR TURI BUYRUQNI O'ZGARTIRADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Sensor turi ──");
{
  const gap = toTSPL(layout, { media: { sensor: "ORALIQ", gapYMm: 2 }, printer: PRINTER });
  const mark = toTSPL(layout, { media: { sensor: "QORA_BELGI", gapYMm: 3 }, printer: PRINTER });
  const cont = toTSPL(layout, { media: { sensor: "UZLUKSIZ" }, printer: PRINTER });

  is(/GAP 2 mm,0 mm/.test(gap), "oraliqli mediada GAP");
  is(/BLINE 3 mm,0 mm/.test(mark), "⚠ qora belgili mediada BLINE bo'lishi kerak");
  is(/GAP 0 mm,0 mm/.test(cont), "uzluksiz mediada GAP 0");

  /* ⚠ UZLUKSIZDA BALANDLIK BUYRUQDA BO'LISHI SHART: printer uni
     o'zi bila olmaydi va aytilmasa uzun bo'sh joy chiqaradi. */
  is(/SIZE 58 mm,40 mm/.test(cont), "⚠ uzluksiz mediada balandlik yuborilmadi");

  const zGap = toZPL(layout, { media: { sensor: "ORALIQ" }, printer: PRINTER });
  const zCont = toZPL(layout, { media: { sensor: "UZLUKSIZ" }, printer: PRINTER });
  is(/\^MNY/.test(zGap), "ZPL: oraliqli media");
  is(/\^MNN/.test(zCont), "ZPL: uzluksiz media");
  is(/\^LL\d+/.test(zCont), "⚠ ZPL uzluksizda balandlik `^LL` da");
}

/* ══════════════════════════════════════════════════════════════════
   4. SILJISH VA ZICHLIK
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Siljish va zichlik ──");
{
  const shifted = toTSPL(layout, { media: MEDIA,
    printer: { density: 12, speed: 3, offsetXMm: 2, offsetYMm: -1 } });
  is(/REFERENCE 16,-8/.test(shifted), "⚠ siljish tuzatishi REFERENCE ga tushmadi");
  is(/DENSITY 12/.test(shifted), "zichlik yuborildi");

  /* ⚠ CHEGARADAN CHIQMASIN: 1..15 dan tashqari qiymat printerga
     yuborilsa u buyruqni umuman rad etishi mumkin. */
  is(/DENSITY 15/.test(toTSPL(layout, { media: MEDIA, printer: { density: 99 } })),
     "⚠ chegaradan katta zichlik qisilmadi");
}

/* ══════════════════════════════════════════════════════════════════
   5. TAXMIN QILINMAYDI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Bilinmagan til ──");
{
  /* ⚠ Noto'g'ri buyruq yuborilsa printer uni MATN sifatida bosib
     chiqaradi: rulon to'la tushunarsiz belgi. Shuning uchun
     bilinmagan til uchun bayt YASALMAYDI — drayver yo'li qoladi. */
  is(supportsBytes("TSPL") && supportsBytes("ZPL"), "TSPL va ZPL qo'llab-quvvatlanadi");
  is(!supportsBytes("EZPL"), "⚠ EZPL uchun taxmin qilingan kod paydo bo'ldi");
  is(!supportsBytes("EPL") && !supportsBytes("ESCPOS") && !supportsBytes("DRAYVER"),
     "qolganlari drayver yo'liga tushadi");
  eq(toBytes("EZPL", layout, {}), null, "bilinmagan tilda bayt yo'q");
  is(typeof toBytes("TSPL", layout, {}) === "string", "TSPL da bayt bor");
}

/* ══════════════════════════════════════════════════════════════════
   6. KALIBRLASH BUYRUG'I
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Kalibrlash ──");
{
  /* «Yorliq qiyshiq chiqyapti / uchta bo'sh yorliq ketyapti» —
     qo'llab-quvvatlashning №1 muammosi. */
  eq(calibrationCommand("TSPL"), "GAPDETECT\r\n", "TSPL: GAPDETECT");
  eq(calibrationCommand("ZPL"), "~JC\n", "ZPL: ~JC");
  eq(calibrationCommand("EZPL"), null, "⚠ bilinmagan tilga buyruq to'qildi");
}

/* ══════════════════════════════════════════════════════════════════
   7. HTML YO'LI BUZILMADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Eski yo'l ──");
{
  const { svg } = renderLabel(TPL, P, {});
  is(svg.startsWith("<svg"), "SVG hali ham chiqadi");
  is(svg.includes('width="58mm"'), "o'lchami millimetrda");
  const again = renderLabel(TPL, P, {});
  eq(svg, again.svg, "⚠ SVG determinizmi buzildi");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
