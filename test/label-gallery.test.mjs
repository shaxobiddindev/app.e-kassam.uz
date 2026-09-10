/* ══════════════════════════════════════════════════════════════════════════
   DIZAYN GALEREYASI (G5)

   ⚠ QABUL MEZONI: «galereyadagi rasm HAQIQIY renderer chizgani —
   sinov: renderer buzilsa galereya ham buziladi». Aynan shu yerda
   tekshiriladi: galereya komponenti `renderLabel` ni chaqiradimi,
   yoki biror joyda ikonka/tayyor rasm ishlatyaptimi.

   Ishga tushirish:  node test/label-gallery.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const { fitOf, hasInk } = await import("../src/lib/ek-label-fit.js");

let pass = 0, fail = 0;
const is = (c, n, extra = "") => {
  if (c) { pass++; console.log("  ✅ " + n); }
  else { fail++; console.log(`  ❌ ${n}${extra ? "\n     " + extra : ""}`); }
};
const eq = (g, w, n) => is(Object.is(g, w), n, `olindi: ${g}, kutilgan: ${w}`);

const src = readFileSync(new URL("../src/components/ek/LabelGallery.jsx",
                                 import.meta.url), "utf8");

/* ══════════════════════════════════════════════════════════════════
   1. RASM — RENDERERDAN, BOSHQA JOYDAN EMAS
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Rasm manbayi ──");
{
  is(/renderLabel\(/.test(src), "⚠ galereya rendererni chaqirmayapti");

  /* ⚠ TAQIQ: ikonka, tayyor rasm, skrinshot. Agar kartochkada
     `<img>` yoki ikonka sinfi paydo bo'lsa, galereya haqiqatni
     ko'rsatishni to'xtatadi va renderer buzilsa ham chiroyli
     ko'rinaveradi. */
  is(!/<img\s/.test(src), "⚠ kartochkada tayyor rasm ishlatilgan");
  is(!/fa-solid fa-tag|placeholder|namuna/i.test(src.split("lbl-card__art")[1] || ""),
     "⚠ rasm o'rnida ikonka turibdi");

  /* Haqiqiy tovar ma'lumoti bilan chizilishi kerak. */
  is(/renderLabel\(tpl, product/.test(src),
     "⚠ rasm namunaviy emas, HAQIQIY tovar bilan chizilishi kerak");
}

/* ══════════════════════════════════════════════════════════════════
   2. MOS KELMASLIK — YASHIRILMAYDI, AYTILADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Qog'ozga moslik ──");
{
  const tpl = (w, h) => ({ widthMm: w, heightMm: h });
  const media = (w, h) => ({ labelWidthMm: w, labelHeightMm: h });

  eq(fitOf(tpl(40, 30), media(58, 40)), null, "kichik dizayn katta qog'ozga sig'adi");
  eq(fitOf(tpl(58, 40), media(58, 40)), null, "aynan mos kelgani ogohlantirmaydi");
  eq(fitOf(tpl(40, 30), null), null, "qog'oz tanlanmagan bo'lsa ogohlantirish yo'q");

  /* ⚠ NATIJADA IKKALA O'LCHAM HAM BOR: «mos emas» degan xabar
     do'konchini taxmin qilishga majbur qilardi — nimasi mos emas,
     qaysi biri katta? */
  const bad = fitOf(tpl(58, 40), media(30, 20));
  is(bad && bad.tw === "58" && bad.mw === "30",
     "⚠ natijada ikkala o'lcham ham bo'lishi kerak", JSON.stringify(bad));

  /* Faqat bo'yi oshgan holat ham ushlanadi. */
  is(fitOf(tpl(30, 50), media(30, 20)) !== null, "⚠ bo'yi oshgani ham aytilsin");

  /* ⚠ MATN BU YERDA YO'Q: tarjima UI qatlamida qoladi. */
  is(!/lbl\.fitMismatch/.test(readFileSync(
       new URL("../src/lib/ek-label-fit.js", import.meta.url), "utf8")),
     "⚠ kutubxonaga tarjima kaliti kirib qolgan");

  /* ⚠ BALANDLIGI NOMA'LUM (uzluksiz) media: eni bo'yicha
     taqqoslanadi, bo'yi bo'yicha emas — aks holda har bir dizayn
     «mos emas» bo'lib chiqardi. */
  eq(fitOf(tpl(40, 200), { labelWidthMm: 58, labelHeightMm: null }), null,
     "⚠ balandligi yo'q mediada bo'y bo'yicha ogohlantirilmasin");
}

/* ══════════════════════════════════════════════════════════════════
   3. BO'SH KARTOCHKA SABABINI AYTADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Bo'sh kartochka ──");
{
  /* ⚠ Fon va ramka har doim chiziladi — ular «bo'sh emas» degan
     yolg'on javob berardi. */
  is(!hasInk('<svg><rect x="0" y="0" width="40" height="30" fill="#ffffff"/></svg>'),
     "⚠ faqat fon — bo'sh deb hisoblanishi kerak");
  is(!hasInk('<svg><rect fill="#ffffff"/><rect fill="none" stroke="#000"/></svg>'),
     "⚠ fon va ramka ham bo'sh");
  is(hasInk('<svg><text x="1" y="2">Choy</text></svg>'), "matn — bor");
  is(hasInk('<svg><rect fill="#000"/></svg>'), "qora shakl — bor");
  is(!hasInk(""), "bo'sh satr");
}

/* ══════════════════════════════════════════════════════════════════
   4. TANLANGANI RANG BILAN EMAS
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Tanlangan dizayn ──");
{
  /* ⚠ RANG YOLG'IZ SIGNAL EMAS (dizayn tizimi qoidasi): belgi va
     MATN ham bo'lishi kerak. */
  is(/lbl\.chosen/.test(src), "⚠ tanlangan dizaynda MATN yo'q — faqat rang qolgan");
  is(/aria-pressed/.test(src), "⚠ tanlanganlik yordamchi texnologiyaga aytilmagan");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
