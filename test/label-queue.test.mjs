/* ══════════════════════════════════════════════════════════════════════════
   CHOP ETISH NAVBATI — VARAQQA JOYLASH (F5)

   ⚠ NEGA SINOV. Bu yerdagi xato QOG'OZDA ko'rinadi: yorliqlar
   varaqdan chiqib ketadi, oxirgi ustun keyingi sahifaga tushadi yoki
   yarim ishlatilgan yopishqoq varaq boshidan chop etilib, 12 ta
   katak behuda ketadi. Bularning hech biri ekranda bilinmaydi.

   ⚠ «QOLGANIDAN DAVOM ETISH» AYNAN SHU YERDA yashaydi: chop etish
   ro'yxati chiqarilgan qatorlarni tashlab ketadi. Bitta noto'g'ri
   filtr — va uzilgan navbat boshidan qayta chiqadi, ya'ni birinchi
   yarmi ikki marta.

   Ishga tushirish:  node test/label-queue.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { sheetFor, buildPrintDoc, pendingItems, PAGES } =
  await import("../src/lib/ek-label-print.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(Object.is(got, want), name, `olindi: ${got}, kutilgan: ${want}`);

const tpl = (w, h, fields) => ({
  widthMm: w, heightMm: h, dpi: 203,
  spec: JSON.stringify({ fields: fields ?? [
    { key: "name", x: 2, y: 2, w: w - 4, h: 5, size: 8, visible: true },
  ] }),
});
const prod = (over = {}) => ({
  id: 1, name: "Choy", salePrice: 12000, searchCode: "425",
  barcode: "4780000000005", ...over,
});

/* ══════════════════════════════════════════════════════════════════
   1. TO'R O'LCHAMI — CHEKKA HISOBGA OLINADI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Varaqqa nechta sig'adi ──");
{
  /* A4: 210 − 2×8 = 194 mm eni, 297 − 16 = 281 mm bo'yi.
     Ustun: (194 + 2) / (50 + 2) = 3,77 → 3.
     Qator: (281 + 2) / (30 + 2) = 8,84 → 8. */
  const s = sheetFor(tpl(50, 30), PAGES.A4);
  eq(s.cols, 3, "50 mm yorliq A4 ga 3 ustun");
  eq(s.rows, 8, "30 mm yorliq A4 ga 8 qator");
  eq(s.perPage, 24, "varaqda 24 katak");

  /* ⚠ ORALIQ HISOBGA OLINADI. 64 mm × 3 = 192 mm va 194 ga sig'adi,
     ya'ni sodda «194 / 64 = 3,03 → 3» uchta ustun berardi. Lekin
     ustunlar orasida 2 mm oraliq bor: 192 + 2×2 = 196 mm, ya'ni
     uchinchi ustun chekkadan chiqib ketardi va qog'ozda kesilardi. */
  const s2 = sheetFor(tpl(64, 30), PAGES.A4);
  eq(s2.cols, 2, "⚠ oraliq unutildi — uchinchi ustun qog'ozdan chiqadi");

  /* ⚠ SIG'MASA `null`: bo'sh varaq chiqarish o'rniga tugma
     bloklanadi va sababi aytiladi. */
  eq(sheetFor(tpl(220, 30), PAGES.A4), null, "⚠ varaqdan keng yorliq — null");
  eq(sheetFor(tpl(50, 320), PAGES.A4), null, "⚠ varaqdan uzun yorliq — null");
  eq(sheetFor({ widthMm: 0, heightMm: 0 }, PAGES.A4), null, "o'lchamsiz shablon — null");
}

/* ══════════════════════════════════════════════════════════════════
   2. UZILGAN NAVBAT — QOLGANIDAN
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Uzilgan navbat ──");
{
  const job = { lines: [
    { id: 1, productId: 1, productName: "A", quantity: 2, printedAt: "2026-09-10T09:00:00Z" },
    { id: 2, productId: 2, productName: "B", quantity: 3, printedAt: null },
    { id: 3, productId: 3, productName: "C", quantity: 1, printedAt: null },
  ] };
  const left = pendingItems(job, null);

  eq(left.length, 2, "⚠ chiqarilgan qator ro'yxatda qolyapti");
  eq(left.map((x) => x.lineId).join(","), "2,3", "qolgan qatorlar tartibda");
  eq(left.reduce((s, x) => s + x.quantity, 0), 4,
     "⚠ qolgan yorliqlar soni 4 (6 bo'lsa navbat boshidan qaytadi)");

  /* Hammasi chiqarilgan navbat — bo'sh ro'yxat, chiqarish tugmasi
     bloklanadi. */
  const done = { lines: job.lines.map((l) => ({ ...l, printedAt: "x" })) };
  eq(pendingItems(done, null).length, 0, "tugagan navbatda chiqariladigan qator yo'q");

  /* ⚠ SONI KAMIDA 1: bazada 0 bo'lishi mumkin emas, lekin eski
     javob yoki qo'lda yuborilgan so'rov nol berib qo'ysa, yorliq
     UMUMAN chiqmasdi va sababi ko'rinmasdi. */
  eq(pendingItems({ lines: [{ id: 9, productId: 9, quantity: 0, printedAt: null }] },
                  null)[0].quantity, 1, "nol soni 1 ga tortiladi");
}

/* ══════════════════════════════════════════════════════════════════
   3. BOSHLANISH O'RNI — YARIM VARAQ
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Boshlanish o'rni ──");
{
  const items = [{ product: prod(), quantity: 1 }];

  const first = buildPrintDoc(tpl(50, 30), items, { startPosition: 1 });
  eq(first.cellCount, 1, "birinchi katakdan boshlanadi");
  eq(first.pages, 1, "bitta varaq");

  /* ⚠ 24 ta katakli varaqda 24-o'rindan boshlansa, oldingi 23 tasi
     BO'SH qoladi va yorliq oxirgi katakka tushadi — yarim
     ishlatilgan yopishqoq varaq tashlab yuborilmasin. */
  const late = buildPrintDoc(tpl(50, 30), items, { startPosition: 24 });
  eq(late.cellCount, 24, "⚠ oldingi kataklar bo'sh qoldirilmadi");
  eq(late.pages, 1, "24-katak hali birinchi varaqda");

  const over = buildPrintDoc(tpl(50, 30), items, { startPosition: 25 });
  eq(over.pages, 2, "25-o'rin ikkinchi varaqqa o'tadi");
}

/* ══════════════════════════════════════════════════════════════════
   4. CHOP ETISH HUJJATI
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Chop etish hujjati ──");
{
  const doc = buildPrintDoc(tpl(50, 30), [{ product: prod(), quantity: 3 }], {});

  /* ⚠ `@page` O'LCHAMI VA NOL CHEKKA. Bo'lmasa brauzer o'z chekkasini
     qo'shadi va 50 mm yorliq qog'ozda 47 mm bo'lib chiqadi — ya'ni
     yopishqoq varaqning kataklariga tushmaydi. */
  is(/@page\s*\{\s*size:\s*210mm 297mm;\s*margin:\s*0\s*\}/.test(doc.css),
     "⚠ `@page` o'lchami yoki nol chekkasi yo'q");
  is(doc.html.includes('width="210mm"'), "varaq kengligi millimetrda");
  eq(doc.cellCount, 3, "uch nusxa uch katak");

  /* ⚠ DETERMINISTIK: bir xil kirish → BAYT DARAJASIDA bir xil
     chiqish. Sana yoki tasodifiy id kirib qolsa, chop etish
     ko'rishdan farq qila boshlardi. */
  const again = buildPrintDoc(tpl(50, 30), [{ product: prod(), quantity: 3 }], {});
  eq(doc.html, again.html, "⚠ bir xil kirishda chiqish har xil");

  /* ⚠ SIG'MAYDIGAN SHABLONDA HUJJAT YO'Q — tugma bloklanadi. */
  eq(buildPrintDoc(tpl(220, 30), [{ product: prod(), quantity: 1 }], {}), null,
     "⚠ sig'maydigan shablonda ham hujjat yasalyapti");
}

/* ══════════════════════════════════════════════════════════════════
   5. OGOHLANTIRISHLAR CHOP ETISHDAN OLDIN
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Ogohlantirishlar ──");
{
  /* Barkodsiz tovar: yorliqda barkod maydoni bor, tovarda kod yo'q. */
  const withBarcode = tpl(50, 30, [
    { key: "barcode", x: 2, y: 10, w: 46, h: 12, visible: true },
  ]);
  const doc = buildPrintDoc(withBarcode, [{ product: prod({ barcode: null }), quantity: 1 }], {});
  is(doc.warnings.some((w) => w.code === "NO_BARCODE"),
     "⚠ barkodsiz tovar jimgina chiqyapti");

  /* ⚠ JOYIGA SIG'MAGAN BARKOD CHIZILMAYDI. Yarim chizilgan barkod
     skanerda BOSHQA tovarga aylanishi mumkin. */
  const narrow = tpl(50, 30, [
    { key: "barcode", x: 2, y: 10, w: 10, h: 12, visible: true },
  ]);
  const doc2 = buildPrintDoc(narrow, [{ product: prod(), quantity: 1 }], {});
  is(doc2.warnings.some((w) => w.code === "BARCODE_WIDE"),
     "⚠ sig'magan barkod ogohlantirishsiz");
  is(!doc2.html.includes("</svg></svg>"), "chizilmagan barkod bo'sh qoldiriladi");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
