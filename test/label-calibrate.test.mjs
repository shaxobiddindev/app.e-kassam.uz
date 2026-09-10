/* ══════════════════════════════════════════════════════════════════════════
   KALIBRLASH VARAG'I (F7)

   ⚠ BU SINOV QOG'OZNI TEKSHIRA OLMAYDI va shuni bilib turishi kerak.
   Varaqning butun ma'nosi — brauzerdagi masshtab sozlamasini
   ANIQLASH; o'sha sozlamani esa kod na o'qiy oladi, na sinay oladi.
   Shuning uchun bu yerda tekshiriladigan narsa aniq: varaqning
   O'ZI to'g'ri chizilganmi. Agar «100 mm» deb yozilgan chiziq
   aslida 96 mm bo'lsa, varaq muammoni ko'rsatish o'rniga YANGI
   muammo yasardi — do'konchi ishlab turgan sozlamani buzardi.

   Ishga tushirish:  node test/label-calibrate.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { calibrationDoc, MODULE_DOTS, SAMPLE_EAN } =
  await import("../src/lib/ek-label-calibrate.js");
const { dotMm, barcodeKind } = await import("../src/lib/ek-label-barcode.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(Object.is(got, want), name, `olindi: ${got}, kutilgan: ${want}`);
const near = (got, want, tol, name) =>
  is(Math.abs(got - want) <= tol, name, `olindi: ${got}, kutilgan: ${want}±${tol}`);

const doc = calibrationDoc({});

/* ══════════════════════════════════════════════════════════════════
   1. NAMUNAVIY KOD HAQIQIY EAN BO'LISHI SHART
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Namunaviy barkod ──");
{
  /* ⚠ Nazorat raqami buzuq bo'lsa kod Code 128 ga tushardi va varaq
     EAN-13 ni umuman sinamasdi — ya'ni «skanerim EAN o'qiydimi?»
     degan savol javobsiz qolardi. */
  eq(barcodeKind(SAMPLE_EAN), "EAN13",
     "⚠ namunaviy kod EAN-13 emas — nazorat raqami buzuq");
}

/* ══════════════════════════════════════════════════════════════════
   2. CHIZG'ICHLAR — IKKALA O'QDA
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Chizg'ichlar ──");
{
  const rulers = doc.rows.filter((r) => r.kind === "ruler");
  is(rulers.some((r) => r.axis === "x" && r.mm === 100), "eniga 100 mm chizig'i bor");
  is(rulers.some((r) => r.axis === "x" && r.mm === 50), "eniga 50 mm chizig'i bor");

  /* ⚠ VERTIKAL ham kerak: printer eniga va bo'yiga masshtabni HAR XIL
     buzishi mumkin (lentali printerlarda qog'oz tortish tezligi
     tufayli). Faqat eniga chiziq muammoning yarmini ko'rsatardi. */
  is(rulers.some((r) => r.axis === "y" && r.mm === 50),
     "⚠ bo'yiga chizg'ich yo'q — vertikal masshtab tekshirilmay qoladi");

  /* Chizilgan uzunlik yozilgan songa TENG bo'lishi kerak. */
  const line = doc.html.match(/<line x1="12" y1="([\d.]+)" x2="([\d.]+)"/);
  is(!!line, "chizg'ich chizig'i chizilgan");
  if (line) near(Number(line[2]) - 12, 100, 0.001,
                 "⚠ «100 mm» deb yozilgan chiziq boshqa uzunlikda chizilgan");
}

/* ══════════════════════════════════════════════════════════════════
   3. BARKODLAR — UCH MODUL KENGLIGIDA
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Modul kengliklari ──");
{
  const bars = doc.rows.filter((r) => r.kind === "barcode");
  eq(bars.length, MODULE_DOTS.length, "har modul kengligiga bitta barkod");

  for (const b of bars) {
    /* ⚠ MODUL BUTUN NUQTAGA TUSHADI. Printer yarim nuqta chiza
       olmaydi: 0,3 mm so'ralsa u 2 yoki 3 nuqtaga yaxlitlanadi va
       barkod kutilganidan boshqa kenglikda chiqadi — aynan skaner
       o'qimaydigan holat. */
    near(b.moduleMm, b.dots * dotMm(203), 1e-9,
         `${b.dots} nuqta = ${(b.dots * dotMm(203)).toFixed(4)} mm`);
  }

  /* EAN-13: 95 modul + 16 tinch zona = 111 modul. */
  const two = bars.find((b) => b.dots === 2);
  near(two.widthMm, 111 * 2 * dotMm(203), 0.001,
       "⚠ 2 nuqtali EAN-13 kengligi 27,8 mm bo'lishi kerak");

  /* ⚠ 4 nuqtali barkod 55 mm — 50 mm yorliqqa SIG'MAYDI va bu
     varaqning aytadigan gaplaridan biri: skaner 2 nuqtani o'qimasa,
     yorliqni ham kattalashtirish kerak bo'ladi. */
  const four = bars.find((b) => b.dots === 4);
  is(four.widthMm > 50,
     "⚠ 4 nuqtali barkod 50 mm dan tor chiqdi — hisob buzilgan");
}

/* ══════════════════════════════════════════════════════════════════
   4. VARAQNING O'ZI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Varaq ──");
{
  /* ⚠ `@page` va NOL CHEKKA bo'lmasa brauzer o'z chekkasini
     qo'shadi — ya'ni varaqning o'zi ham miqyoslanib, o'lchov
     ma'nosini yo'qotardi. */
  is(/@page\s*\{\s*size:\s*210mm 297mm;\s*margin:\s*0\s*\}/.test(doc.css),
     "⚠ `@page` o'lchami yoki nol chekkasi yo'q");
  is(doc.html.includes('width="210mm"'), "varaq kengligi millimetrda");

  /* Burchak belgilari — to'rtta burchakda. */
  const marks = (doc.html.match(/stroke-width="0\.3"/g) || []).length;
  eq(marks, 8, "to'rt burchakda ikkitadan chiziq");

  /* ⚠ MATN ALMASHTIRILADI: varaq do'konchining tilida chiqishi
     kerak, aks holda yo'riqnoma o'qilmaydi. */
  const uz = calibrationDoc({ labels: { title: "SINOV-SARLAVHA" } });
  is(uz.html.includes("SINOV-SARLAVHA"), "⚠ sarlavha almashtirilmadi");

  /* Boshqa dpi — boshqa modul kengligi. */
  const d300 = calibrationDoc({ dpi: 300 });
  const b300 = d300.rows.find((r) => r.kind === "barcode" && r.dots === 2);
  near(b300.moduleMm, 2 * dotMm(300), 1e-9, "300 dpi da modul boshqacha");
  is(b300.widthMm < 20, "300 dpi da EAN-13 ancha tor (≈18,8 mm)");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
