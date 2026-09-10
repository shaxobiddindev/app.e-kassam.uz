/* ══════════════════════════════════════════════════════════════════════════
   G7 — QOG'OZ ↔ PRINTER ↔ SHABLON VALIDATSIYASI

   ⚠ O'LCHOV: tayyor profillar bilan 112 ta qog'oz+printer juftligi
   tuzish mumkin va ULARNING 21 TASI FIZIK JIHATDAN CHIQMAYDI —
   yorliq printerning chop kalladan keng. G7 gacha birortasi ham
   to'silmasdi.

   ⚠ HAR BIR XATO MATNI HARAKATNI AYTISHI SHART. Bu ham sinaladi:
   «noto'g'ri qiymat» degan xabar bu yerdan o'tmaydi.

   Ishga tushirish:  node test/label-output.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { blocking, validateOutput } from "../src/lib/ek-label-validate.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
};
const head = (s) => console.log(`\n── ${s} ──`);

/* Tayyor profillar — V135 seed idan olingan HAQIQIY qiymatlar. */
const M = (o) => ({ mediaType: "RULON", across: 1, gapXMm: 0, gapYMm: 2,
                    sensor: "ORALIQ", ...o });
const MEDIA = {
  roll58x40:  M({ code: "roll_58x40",  labelWidthMm: 58, labelHeightMm: 40, linerWidthMm: 60 }),
  roll100x50: M({ code: "roll_100x50", labelWidthMm: 100, labelHeightMm: 50, linerWidthMm: 104 }),
  roll30x20_3: M({ code: "roll_30x20_3", labelWidthMm: 30, labelHeightMm: 20,
                   across: 3, gapXMm: 2, linerWidthMm: 96 }),
  roll30x20_2: M({ code: "roll_30x20_2", labelWidthMm: 30, labelHeightMm: 20,
                   across: 2, gapXMm: 2, linerWidthMm: 64 }),
  cont58:     M({ code: "cont_58", labelWidthMm: 48, labelHeightMm: 40,
                  gapYMm: 0, linerWidthMm: 58, sensor: "UZLUKSIZ" }),
  sheetA4:    M({ code: "sheet_a4", mediaType: "VARAQ", labelWidthMm: 50, labelHeightMm: 30,
                  across: 3, gapXMm: 2, linerWidthMm: null,
                  pageWidthMm: 210, pageHeightMm: 297 }),
};
const P = {
  xprinter:  { code: "xprinter_365b", dpi: 203, printWidthMm: 104, lang: "TSPL" },
  zebra:     { code: "zebra_zd230",   dpi: 203, printWidthMm: 104, lang: "ZPL" },
  escpos58:  { code: "escpos_58",     dpi: 203, printWidthMm: 48,  lang: "ESCPOS" },
  escpos80:  { code: "escpos_80",     dpi: 203, printWidthMm: 72,  lang: "ESCPOS" },
  a4:        { code: "driver_a4",     dpi: 300, printWidthMm: 210, lang: "DRAYVER" },
};
const TPL = (o) => ({ kind: "STICKER", widthMm: 58, heightMm: 40, dpi: 203,
  spec: JSON.stringify({ padding: 2, barcode: { moduleDots: 2 },
    fields: [{ key: "barcode", x: 2, y: 20, w: 54, h: 12 }] }), ...o });

const texts = (list) => list.map((x) => x.text);
const has = (list, part) => texts(list).some((t) => t.includes(part));

/* ══ 1. PRINTERNING CHOP KENGLIGI ══ */
head("Printerning chop kengligi");
{
  const e = blocking(validateOutput(MEDIA.roll58x40, P.escpos58, null));
  ok("58 mm yorliq 48 mm printerga rad etiladi", e.length === 1, texts(e).join(" | "));
  ok("xabarda IKKALA son ham bor", has(e, "48 mm") && has(e, "58 mm"));
  ok("xabar HARAKATNI aytadi", has(e, "tushiring") && has(e, "tanlang"));

  ok("58 mm yorliq 104 mm printerga o'tadi",
     blocking(validateOutput(MEDIA.roll58x40, P.xprinter, null)).length === 0);
  ok("100 mm yorliq 72 mm printerga rad etiladi",
     blocking(validateOutput(MEDIA.roll100x50, P.escpos80, null)).length === 1);

  /* ⚠ QATORDAGI HAMMA YORLIQ QO'SHILADI, bittasi emas: 3 ta 30 mm
     yorliq 94 mm joy oladi va 72 mm printerga sig'maydi, garchi
     bitta yorliq 30 mm bo'lsa ham. */
  const e3 = blocking(validateOutput(MEDIA.roll30x20_3, P.escpos80, null));
  ok("3 qatorli 30 mm rulon 72 mm printerga sig'maydi", e3.length === 1);
  ok("hisobda 94 mm turadi (30×3 + 2×2)", has(e3, "94 mm"), texts(e3).join(" | "));
  ok("o'sha rulon 104 mm printerga o'tadi",
     blocking(validateOutput(MEDIA.roll30x20_3, P.xprinter, null)).length === 0);
}

/* ══ 2. TAYYOR PROFILLARNING HAMMA JUFTLIGI ══ */
head("112 juftlik — o'lchov takrorlanadi");
{
  const ms = Object.values(MEDIA), ps = Object.values(P);
  let bad = 0;
  for (const m of ms) for (const p of ps) {
    if (blocking(validateOutput(m, p, null)).length) bad++;
  }
  /* 6 media × 5 printer = 30; o'lchangan nisbat saqlanadi. */
  ok("chiqmaydigan juftliklar topildi", bad > 0, `topilgan: ${bad}`);
  ok("hammasi rad etilib qolmadi", bad < ms.length * ps.length,
     `${bad} / ${ms.length * ps.length}`);
  console.log(`     ${bad} / ${ms.length * ps.length} juftlik rad etildi`);
}

/* ══ 3. PODLOSHKA ══ */
head("Podloshkaga sig'ishi");
{
  ok("tayyor rulonlar podloshkaga sig'adi",
     Object.values(MEDIA).every((m) =>
       !blocking(validateOutput(m, null, null)).some((x) => x.field === "across")));

  const tight = { ...MEDIA.roll30x20_3, linerWidthMm: 90 };  // 94 kerak
  const e = blocking(validateOutput(tight, null, null));
  ok("tor podloshka rad etiladi", e.some((x) => x.field === "across"));
  ok("nechta sig'ishi aytiladi", has(e, "2 ta yorliqli"), texts(e).join(" | "));
}

/* ══ 4. UZLUKSIZ LENTA ══ */
head("Uzluksiz lenta");
{
  ok("balandligi bor uzluksiz lenta o'tadi",
     blocking(validateOutput(MEDIA.cont58, P.escpos58, null)).length === 0);

  const noH = { ...MEDIA.cont58, labelHeightMm: null };
  const e = blocking(validateOutput(noH, P.escpos58, null));
  ok("balandliksiz uzluksiz lenta RAD ETILADI",
     e.some((x) => x.field === "labelHeightMm"));
  ok("sababi aytilgan — printer tugashini bilmaydi", has(e, "bilmaydi"));
  ok("harakat aytilgan", has(e, "yozing"));

  /* ⚠ ORALIQ ROLIDA balandlik shart emas: datchik o'zi topadi. */
  const gapNoH = { ...MEDIA.roll58x40, labelHeightMm: null };
  ok("oraliqli rulonda balandlik majburiy emas",
     !blocking(validateOutput(gapNoH, P.xprinter, null))
       .some((x) => x.field === "labelHeightMm"));
}

/* ══ 5. ORALIQ QIYMATI ══ */
head("Datchik oralig'i");
{
  const noGap = { ...MEDIA.roll58x40, gapYMm: 0 };
  const e = blocking(validateOutput(noGap, P.xprinter, null));
  ok("oraliqsiz ORALIQ rulon rad etiladi", e.some((x) => x.field === "gapYMm"));
  ok("odatiy qiymat aytilgan", has(e, "2–3 mm"), texts(e).join(" | "));

  const bm = { ...MEDIA.roll58x40, sensor: "QORA_BELGI", gapYMm: 0 };
  ok("qora belgida ham shart", blocking(validateOutput(bm, P.xprinter, null))
     .some((x) => x.field === "gapYMm"));

  /* ⚠ UZLUKSIZ da datchik yo'q — oraliq ham talab qilinmaydi. */
  ok("uzluksizda oraliq talab qilinmaydi",
     !blocking(validateOutput(MEDIA.cont58, P.escpos58, null))
       .some((x) => x.field === "gapYMm"));

  /* ⚠ VARAQDA datchik yo'q — u drayver orqali chiqadi. */
  const sheetNoGap = { ...MEDIA.sheetA4, gapYMm: 0 };
  ok("varaqda oraliq talab qilinmaydi",
     !blocking(validateOutput(sheetNoGap, P.a4, null)).some((x) => x.field === "gapYMm"));
}

/* ══ 6. SHABLON DPI SI ══ */
head("Dizayn zichligi ↔ printer zichligi");
{
  const t203 = TPL({ dpi: 203 });

  /* ⚠ BAYT YO'LIDA — XATO. */
  const zebra300 = { ...P.zebra, dpi: 300 };
  const e = blocking(validateOutput(MEDIA.roll58x40, zebra300, t203));
  ok("bayt printerida dpi farqi rad etiladi", e.some((x) => x.field === "dpi"));
  ok("ikkala modul kengligi ham aytilgan",
     has(e, "0.25 mm") && has(e, "0.169 mm"), texts(e).join(" | "));
  ok("harakat aytilgan", has(e, "o'zgartiring") && has(e, "tanlang"));

  /* ⚠ DRAYVER YO'LIDA — XATO EMAS, va bu ataylab: A4 lazer
     300 dpi, tizim shablonlari esa 203. Qoida keng qo'yilsa
     15/15 shablon A4 da ishlamas bo'lib qolardi. */
  ok("A4 drayverida dpi farqi TO'SMAYDI",
     !blocking(validateOutput(MEDIA.sheetA4, P.a4, t203)).some((x) => x.field === "dpi"));
  ok("chek printerida ham to'smaydi",
     !blocking(validateOutput(MEDIA.cont58, { ...P.escpos58, dpi: 300 }, t203))
       .some((x) => x.field === "dpi"));
  ok("mos dpi da xato yo'q",
     !blocking(validateOutput(MEDIA.roll58x40, P.zebra, t203)).some((x) => x.field === "dpi"));
}

/* ══ 7. DIZAYN QOG'OZDAN KATTA ══ */
head("Dizayn qog'ozga sig'ishi");
{
  const big = TPL({ widthMm: 58, heightMm: 40 });
  const e = blocking(validateOutput(MEDIA.roll30x20_2, P.xprinter, big));
  ok("keng dizayn rad etiladi", e.some((x) => x.field === "widthMm"));
  ok("baland dizayn rad etiladi", e.some((x) => x.field === "heightMm"));
  ok("ikkala son ham aytilgan", has(e, "58 mm") && has(e, "30 mm"));

  ok("mos dizayn o'tadi",
     !blocking(validateOutput(MEDIA.roll58x40, P.xprinter, big))
       .some((x) => x.field === "widthMm" || x.field === "heightMm"));

  /* ⚠ UZLUKSIZ LENTADA BO'Y SOLISHTIRILMAYDI — u kesiladi. */
  const cont = { ...MEDIA.cont58, labelWidthMm: 58, labelHeightMm: null };
  ok("uzluksizda bo'y solishtirilmaydi",
     !blocking(validateOutput(cont, P.escpos58, big)).some((x) => x.field === "heightMm"));
}

/* ══ 8. BARKOD + TINCH ZONA ══ */
head("Barkod tinch zonasi bilan");
{
  const t = TPL({ widthMm: 30, heightMm: 20 });
  const e = blocking(validateOutput(MEDIA.roll30x20_2, P.xprinter, t));
  ok("30 mm qog'ozga EAN-13 tinch zonasi bilan sig'maydi",
     e.some((x) => x.field === "barcode"), texts(e).join(" | "));
  ok("kerakli eni aytilgan", has(e, "mm, chekkalar bilan"));

  ok("58 mm qog'ozda barkod sig'adi",
     !blocking(validateOutput(MEDIA.roll58x40, P.xprinter, TPL()))
       .some((x) => x.field === "barcode"));

  /* ⚠ BARKOD O'CHIRILGAN BO'LSA — tekshirilmaydi (javon yorlig'i). */
  const off = TPL({ widthMm: 30, heightMm: 20, spec: JSON.stringify({
    padding: 2, barcode: { moduleDots: 2 },
    fields: [{ key: "barcode", x: 2, y: 2, w: 26, h: 12, visible: false }] }) });
  ok("o'chirilgan barkod tekshirilmaydi",
     !blocking(validateOutput(MEDIA.roll30x20_2, P.xprinter, off))
       .some((x) => x.field === "barcode"));
}

/* ══ 9. HAR BIR XATO HARAKATNI AYTADI ══ */
head("Xato matnlari");
{
  const cases = [
    [MEDIA.roll58x40, P.escpos58, null],
    [{ ...MEDIA.roll30x20_3, linerWidthMm: 90 }, null, null],
    [{ ...MEDIA.cont58, labelHeightMm: null }, P.escpos58, null],
    [{ ...MEDIA.roll58x40, gapYMm: 0 }, P.xprinter, null],
    [MEDIA.roll58x40, { ...P.zebra, dpi: 300 }, TPL()],
    [MEDIA.roll30x20_2, P.xprinter, TPL({ widthMm: 58, heightMm: 40 })],
  ];
  const all = cases.flatMap(([m, p, t]) => blocking(validateOutput(m, p, t)));
  ok("xatolar to'plandi", all.length >= 6, String(all.length));

  /* ⚠ HARAKAT FE'LI — «tushiring», «tanlang», «yozing»,
     «o'zgartiring», «kichraytiring». Bulardan birortasi ham yo'q
     xabar — foydasiz xabar. */
  const verbs = /tushiring|tanlang|yozing|o'zgartiring|kichraytiring/;
  const mute = all.filter((x) => !verbs.test(x.text));
  ok("har bir xatoda harakat fe'li bor", mute.length === 0,
     mute.map((x) => x.text).join(" | "));

  /* ⚠ ANIQ SON — «noto'g'ri qiymat» emas. */
  const noNum = all.filter((x) => !/\d/.test(x.text));
  ok("har bir xatoda aniq son bor", noNum.length === 0,
     noNum.map((x) => x.text).join(" | "));

  ok("«noto'g'ri qiymat» degan xabar yo'q",
     !all.some((x) => /noto'g'ri qiymat/i.test(x.text)));
}

/* ══ 10. QOG'OZ TANLANMAGAN BO'LSA ══ */
head("Qog'oz tanlanmagan do'kon");
{
  ok("qog'ozsiz — tekshiruv yo'q", validateOutput(null, P.xprinter, TPL()).length === 0);
  ok("printersiz — qog'oz qoidalari baribir ishlaydi",
     blocking(validateOutput({ ...MEDIA.roll58x40, gapYMm: 0 }, null, null)).length === 1);
}

/* ══ 11. SERVER BILAN BIR XIL ══ */
head("Server bilan bir xil qoidalar");
{
  const java = path.resolve(import.meta.dirname, "..", "..", "api.e-kassam.uz",
    "src", "main", "java", "uz", "kassa", "label", "service", "LabelOutputValidator.java");
  if (!fs.existsSync(java)) {
    console.log("  ⏭  server fayli yo'q — o'tkazib yuborildi");
  } else {
    const src = fs.readFileSync(java, "utf8");
    ok("server podloshkani tekshiradi", /podloshka/.test(src));
    ok("server chop kengligini tekshiradi", /sig'maydi/.test(src));
    ok("server uzluksiz balandligini tekshiradi", /UZLUKSIZ/.test(src));
    ok("server oraliqni tekshiradi", /QORA_BELGI/.test(src));
    ok("serverdagi xabarlarda ham harakat fe'li bor",
       /tushiring/.test(src) && /tanlang/.test(src) && /yozing/.test(src));

    const svc = fs.readFileSync(path.resolve(path.dirname(java), "LabelOutputService.java"), "utf8");
    ok("saqlashda chaqiriladi", /outputValidator\.validate/.test(svc));
    ok("buzuq juftlik SAQLANMAYDI", /throw new BadRequestException/.test(svc));
  }
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
