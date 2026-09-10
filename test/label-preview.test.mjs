/* ══════════════════════════════════════════════════════════════════════════
   F3 — KO'RISH OYNASI VA EKRAN KALIBRLASH

   ⚠ ULANISH QO'RIQCHISI. Bu yerdagi xavf hisobda emas: ko'rish oynasi
   O'ZI chiza boshlasa, u chop etishdan ajralib ketadi va aynan shu
   narsa butun tizimning asosiy qoidasini buzadi. Buni hisob sinovi
   ushlay olmaydi — faqat ulanishni tekshirish ushlaydi.

   Ishga tushirish:  node test/label-preview.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); }
                       else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Ekran kalibrlash ──");
{
  /* ⚠ `localStorage` yo'q muhitda ham yiqilmasin: shaxsiy rejim,
     bloklangan xotira yoki sinov muhiti. */
  globalThis.localStorage = undefined;
  const c = await import("../src/lib/ek-screen-calibration.js");

  ok(Math.abs(c.DEFAULT_PX_PER_MM - 96 / 25.4) < 1e-9,
     "kalibrlanmagan ekran uchun 96 dpi taxmini");
  ok(c.CARD_WIDTH_MM === 85.6, "⚠ ISO/IEC 7810 ID-1 — bank kartasi 85,6 mm");
  ok(c.pxPerMm() === c.DEFAULT_PX_PER_MM, "⚠ xotirasiz muhitda standartga tushadi");
  ok(c.isCalibrated() === false, "xotirasiz muhitda «kalibrlanmagan»");

  /* Yozib bo'lmasa ham yiqilmaydi. */
  ok(c.saveFromCardWidth(400) === false, "xotira yo'q — saqlash `false`, xato emas");

  /* Mantiqsiz qiymatlar rad etiladi (0 px/mm — yorliq umuman
     ko'rinmay qolardi). */
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const c2 = await import("../src/lib/ek-screen-calibration.js?v=2");
  ok(c2.saveFromCardWidth(0) === false, "⚠ nol kenglik rad etiladi");
  ok(c2.saveFromCardWidth(999999) === false, "⚠ mantiqsiz katta qiymat rad etiladi");
  ok(c2.saveFromCardWidth(400) === true, "haqiqiy qiymat saqlanadi");
  ok(Math.abs(c2.pxPerMm() - 400 / 85.6) < 1e-9, "⚠ px/mm kartadan hisoblanadi");
  ok(c2.isCalibrated() === true, "saqlangandan keyin «kalibrlangan»");
  store["ek.screen.pxPerMm"] = "buzuq";
  ok(c2.pxPerMm() === c2.DEFAULT_PX_PER_MM, "⚠ buzuq qiymat standartga tushadi");
}

console.log("\n── Ko'rish oynasi: ikkinchi chizuvchi yo'q ──");
{
  const p = src("components/ek/LabelPreview.jsx");

  ok(/from "\.\.\/\.\.\/lib\/ek-label-render"/.test(p),
     "⚠ umumiy renderer import qilinadi");
  ok(/renderLabel\(/.test(p), "`renderLabel` chaqiriladi");

  /* ⚠ ENG MUHIM BAND: komponent o'zi SVG YASAMASIN. */
  ok(!/<rect|<svg |<text |barcodeSvgMm|eanSvg|code128/.test(
       p.replace(/\/\*[\s\S]*?\*\//g, "")),
     "⚠ komponentda o'z chizuvchisi YO'Q (rect/text/barcode yasamaydi)");

  /* Tashqi o'lcham o'zgaradi, `viewBox` emas — aks holda chizilgan
     narsa ko'rish va chop etishda boshqacha bo'lardi. */
  ok(/viewBox/.test(p) === false || /kept/.test(p),
     "o'lcham faqat tashqaridan beriladi");
  ok(/replace\(\/\\swidth="\[\^"\]\*"\/, ""\)/.test(p),
     "⚠ faqat `width`/`height` almashtiriladi, ichki `viewBox` tegilmaydi");

  ok(/isCalibrated\(\)/.test(p), "kalibrlanganlik holati o'qiladi");
  ok(/notCalibrated/.test(p), "⚠ kalibrlanmaganligi ekranda aytiladi");

  /* ⚠ Rang yolg'iz signal emas. */
  ok(/fa-triangle-exclamation/.test(p) && /w\.text/.test(p),
     "⚠ ogohlantirishda belgi ham, matn ham bor");
}

console.log("\n── Sahifa: haqiqiy tovar, eng uzun nom ──");
{
  const p = src("pages/LabelsPage.jsx");
  ok(/labelApi\.templates/.test(p), "shablonlar serverdan olinadi");
  ok(/showLongest/.test(p) && /length > String\(best/.test(p),
     "⚠ «eng uzun nomli tovar» tugmasi bor — sig'maslik aynan shunda chiqadi");
  /* ⚠ IZOHLAR OLIB TASHLANADI. Birinchi tahrirda bu shart butun
     faylni tekshirardi va sahifaning O'Z izohidagi «Lorem ipsum»
     so'ziga urilib yiqilardi — ya'ni sinov qoidani emas, qoida
     haqidagi gapni tekshirayotgan edi. */
  const code = p.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/Lorem|lorem|Namuna tovar/.test(code), "⚠ soxta ma'lumot yo'q");
  ok(/\[0\]\?\.id/.test(code), "standart — ro'yxatdagi birinchi tovar");
}

console.log("\n── Bosma yuza ilova temasidan ajratilgan ──");
{
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const i = css.indexOf(".lbl-preview__paper");
  ok(i > 0, "yorliq yuzasi uchun alohida uslub bor");
  ok(/background: #fff/.test(css.slice(i, i + 200)),
     "⚠ yorliq foni ATAYLAB oq — tema tokeni emas (qog'oz oq bo'ladi)");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
