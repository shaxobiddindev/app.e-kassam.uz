/* ══════════════════════════════════════════════════════════════════════════
   QATOR NARXI (V97)

   ⚠ Bu sinovlar UCHTA HAQIQIY XATO ustiga yozilgan — ularning har biri
   `LinePriceModal.jsx` ichida, JSX bilan aralash turgan hisobda uzoq
   vaqt sezilmay yotgan edi:

     1. chegirma qayta ochilganda surilib ketardi;
     2. oraliq tor bo'lganda yaxlit narx tugmalari YO'QOLARDI;
     3. kasrli miqdorda chegirma tiyinli chiqardi.

   Va bittasi — yangi imkoniyat: optom narx.
   ══════════════════════════════════════════════════════════════════════════ */
import test from "node:test";
import assert from "node:assert/strict";
import {
  lineFloor, initialPrice, wholesaleOffer, quickPrices,
  priceVerdict, priceDiscount, lossDiscount, lineNetTotal, parsePrice,
  wholesalePlan, applyWholesale,
} from "../src/lib/ek-line-price.js";

/* ── 1. Chegirma surilishi ──────────────────────────────────────────── */

test("teginilmagan narx chegirmani SURMAYDI", () => {
  // Miqdor 3, chegirma 1000 → dona narxi 15000 − 333.33
  const item = { salePrice: 15000, qty: 3, discount: 1000, minPrice: 10200 };
  const shown = initialPrice(item);
  assert.equal(shown, 14667);
  // Kassir hech narsaga tegmasdan «Saqlash» — chegirma AYNAN o'sha
  assert.equal(priceDiscount(item, shown), 1000);
});

test("qayta-qayta ochilsa ham chegirma bir joyda turadi", () => {
  let item = { salePrice: 15000, qty: 3, discount: 1000, minPrice: 10200 };
  for (let i = 0; i < 20; i++) {
    item = { ...item, discount: priceDiscount(item, initialPrice(item)) };
  }
  assert.equal(item.discount, 1000);
});

test("narx O'ZGARTIRILSA chegirma yangidan hisoblanadi", () => {
  const item = { salePrice: 15000, qty: 3, discount: 1000, minPrice: 10200 };
  assert.equal(priceDiscount(item, 14000), 3000);
});

/* ── 2. Yaxlit narx tugmalari ───────────────────────────────────────── */

test("oraliq TOR bo'lganda ham tugmalar bor", () => {
  // Eski hisobda bu ro'yxat BO'SH qolardi
  const q = quickPrices({ salePrice: 22000, qty: 1, minPrice: 21500 });
  assert.ok(q.length > 0, "tor oraliqda tugmalar yo'qoldi");
  assert.equal(q.at(-1), 21500, "eng past narx oxirgi tugma bo'lishi kerak");
});

test("eng past narx HAR DOIM tugmalar ichida", () => {
  for (const [base, floor] of [[15000, 10200], [22000, 21500], [100000, 99900],
                               [1000, 999], [250000, 180000], [3000, 2900]]) {
    const q = quickPrices({ salePrice: base, qty: 1, minPrice: floor });
    assert.ok(q.includes(floor), `${base}/${floor} → ${JSON.stringify(q)}`);
  }
});

test("tugmalar chegaradan past va e'lon narxidan baland bo'lmaydi", () => {
  for (const [base, floor] of [[15000, 10200], [22000, 21500], [250000, 180000]]) {
    for (const v of quickPrices({ salePrice: base, qty: 1, minPrice: floor })) {
      assert.ok(v >= floor && v < base, `${v} oraliqdan chiqdi (${floor}…${base})`);
    }
  }
});

test("tugmalar kamayish tartibida va takrorlanmaydi", () => {
  const q = quickPrices({ salePrice: 15000, qty: 1, minPrice: 10200 });
  assert.deepEqual([...q].sort((a, b) => b - a), q);
  assert.equal(new Set(q).size, q.length);
});

test("chegara yo'q — tugma ham yo'q", () => {
  assert.deepEqual(quickPrices({ salePrice: 15000, qty: 1 }), []);
  assert.deepEqual(quickPrices({ salePrice: 15000, qty: 1, minPrice: 15000 }), []);
});

/* ── 3. Kasr chegirma ───────────────────────────────────────────────── */

test("kasrli miqdorda ham chegirma BUTUN so'm", () => {
  for (const qty of [0.125, 0.333, 1.1, 2.75, 0.001]) {
    const d = priceDiscount({ salePrice: 15000, qty, minPrice: 10000 }, 14667);
    assert.equal(d, Math.round(d), `miqdor ${qty} → ${d}`);
  }
});

test("chegirma MIJOZ FOYDASIGA yaxlitlanadi — jami oshib ketmaydi", () => {
  for (const qty of [0.125, 0.333, 1.1, 2.75]) {
    const item = { salePrice: 15000, qty, minPrice: 10000 };
    assert.ok(lineNetTotal(item, 14667) <= 14667 * qty + 1e-9,
      `miqdor ${qty}: mijoz ekranda ko'rganidan ko'p to'laydi`);
  }
});

test("suzuvchi nuqta artefakti chegirmani oshirmaydi", () => {
  // (15000 − 14000) × 1.1 = 1100.0000000000002 → `ceil` 1101 berardi
  assert.equal(priceDiscount({ salePrice: 15000, qty: 1.1, minPrice: 10000 }, 14000), 1100);
});

/* ── 4. Optom narx ──────────────────────────────────────────────────── */

test("optom narx taklif qilinadi", () => {
  assert.equal(wholesaleOffer(
    { salePrice: 22000, qty: 1, wholesalePrice: 20000, minPrice: 20000 }), 20000);
});

test("optom narx e'lon narxidan past bo'lmasa — taklif yo'q", () => {
  assert.equal(wholesaleOffer({ salePrice: 22000, wholesalePrice: 22000, minPrice: 20000 }), null);
  assert.equal(wholesaleOffer({ salePrice: 22000, wholesalePrice: 25000, minPrice: 20000 }), null);
});

test("optom narx server chegarasidan past bo'lsa — taklif YO'Q", () => {
  // Serverning `minPrice` i 21000, optom 20000 → server rad etardi
  assert.equal(wholesaleOffer({ salePrice: 22000, wholesalePrice: 20000, minPrice: 21000 }), null);
});

test("optom narx yo'q — taklif ham yo'q", () => {
  assert.equal(wholesaleOffer({ salePrice: 22000, minPrice: 20000 }), null);
  assert.equal(wholesaleOffer({ salePrice: 22000, wholesalePrice: 0, minPrice: 20000 }), null);
  assert.equal(wholesaleOffer({ salePrice: 22000, wholesalePrice: null, minPrice: 20000 }), null);
});

test("taklif qilingan optom narx HAR DOIM qabul qilinadi", () => {
  const item = { salePrice: 22000, qty: 2, wholesalePrice: 20000, minPrice: 20000 };
  const w = wholesaleOffer(item);
  assert.equal(priceVerdict(item, w), "ok");
  assert.equal(priceDiscount(item, w), 4000);
});

/* ── 5. Chegaralar ──────────────────────────────────────────────────── */

test("narxni oshirib bo'lmaydi", () => {
  const item = { salePrice: 15000, qty: 1, minPrice: 10200 };
  assert.equal(priceVerdict(item, 16000), "high");
  assert.equal(priceDiscount(item, 16000), 0);
});

test("chegaradan past narx rad etiladi", () => {
  const item = { salePrice: 15000, qty: 1, minPrice: 10200 };
  assert.equal(priceVerdict(item, 10000), "low");
  assert.equal(priceDiscount(item, 10000), 0);
});

test("eng past narx YUQORIGA yaxlitlanadi — qoidadan saxiyroq emas", () => {
  assert.equal(lineFloor({ minPrice: 10200.01 }), 10201);
  assert.equal(lineFloor({}), null);
});

test("chegara noma'lum (eski server) — front to'smaydi", () => {
  const item = { salePrice: 15000, qty: 1 };
  assert.equal(priceVerdict(item, 100), "ok");
});

/* ── 6. Maydondan narxni o'qish ─────────────────────────────────────── */

test("nuqta narxni 10 baravar OSHIRMAYDI", () => {
  // Eski hisob `"14667.5"` ni `146675` deb o'qirdi
  assert.equal(parsePrice("14667.5"), 14667);
  assert.equal(parsePrice("14667.99"), 14667);
});

test("bo'shliqli razryadlar to'g'ri o'qiladi", () => {
  assert.equal(parsePrice("14 667"), 14667);
  assert.equal(parsePrice("1 240 000"), 1240000);
});

test("bo'sh va noto'g'ri qiymat nol beradi", () => {
  for (const v of ["", null, undefined, "abc", "..", "1.2.3"]) {
    assert.equal(parsePrice(v), 0, `«${v}» → nol bo'lishi kerak`);
  }
});

test("kasrli narx savatga 10 baravar tushmaydi", () => {
  const item = { salePrice: 150000, qty: 1, minPrice: 100000 };
  const num = parsePrice("14667.5");
  // 146675 bo'lganida chegaradan o'tib ketardi — endi «juda past» deydi
  assert.equal(priceVerdict(item, num), "low");
});

/* ── 7. Savatga optom narx ──────────────────────────────────────────── */

const CART = () => [
  { id: 1, salePrice: 22000, qty: 2, wholesalePrice: 20000, minPrice: 20000, discount: 0 },
  { id: 2, salePrice: 15000, qty: 1, minPrice: 12000, discount: 0 },          // optom yo'q
  { id: 3, salePrice: 30000, qty: 3, wholesalePrice: 27000, minPrice: 27000, discount: 0 },
];

test("reja faqat mos qatorlarni oladi", () => {
  const p = wholesalePlan(CART());
  assert.deepEqual(p.rows.map((r) => r.index), [0, 2]);
  assert.deepEqual(p.rows.map((r) => r.discount), [4000, 9000]);
  assert.equal(p.canApply, true);
  assert.equal(p.isOn, false);
});

test("qo'yish va bekor qilish — aylanib qaytadi", () => {
  const on = applyWholesale(CART());
  assert.deepEqual(on.map((l) => l.discount), [4000, 0, 9000]);
  assert.equal(wholesalePlan(on).isOn, true);

  const off = applyWholesale(on);
  assert.deepEqual(off.map((l) => l.discount), [0, 0, 0]);
});

test("⚠ QO'LDAGI KATTA CHEGIRMA KAMAYTIRILMAYDI", () => {
  // 1-qatorga kassir 6000 bergan — optomniki 4000, ya'ni narxni
  // KO'TARIB yuborardi. Tegilmasligi kerak.
  const cart = CART();
  cart[0].discount = 6000;
  const out = applyWholesale(cart);
  assert.equal(out[0].discount, 6000, "qo'ldagi chegirma kamaydi");
  assert.equal(out[2].discount, 9000, "qolgan qator baribir optomga tushishi kerak");
});

test("bekor qilish FAQAT o'zi qo'yganini oladi", () => {
  const on = applyWholesale(CART());
  on[2] = { ...on[2], discount: 12000 };        // kassir keyin qo'lda oshirdi
  const off = applyWholesale(on);
  assert.equal(off[0].discount, 0, "optom qo'ygani nolga tushishi kerak");
  assert.equal(off[2].discount, 12000, "qo'lda o'zgartirilgan qator tegilmasligi kerak");
});

test("chegirma berilmaydigan tovarga optom narx qo'yilmaydi", () => {
  const item = { salePrice: 22000, qty: 1, wholesalePrice: 20000, minPrice: 20000,
                 discountAllowed: false };
  assert.equal(wholesaleOffer(item), null);
  assert.equal(wholesalePlan([item]).rows.length, 0);
});

test("mos tovar yo'q — reja bo'sh, tugma ko'rinmaydi", () => {
  const p = wholesalePlan([{ salePrice: 15000, qty: 1, minPrice: 12000, discount: 0 }]);
  assert.equal(p.rows.length, 0);
  assert.equal(p.canApply, false);
  assert.equal(p.isOn, false, "bo'sh rejada `isOn` HECH QACHON rost bo'lmasligi kerak");
});

test("bo'sh savat yiqitmaydi", () => {
  for (const v of [[], null, undefined]) {
    assert.equal(wholesalePlan(v).rows.length, 0);
    assert.deepEqual(applyWholesale(v), []);
  }
});

test("⚠ SAVAT TUGMASI VA QATOR OYNASI BIR XIL NARXNI BERADI", () => {
  // Ikkisi ajralib ketsa, bitta bosish bilan qo'yilgan narx qatorni
  // ochib qaraganda boshqacha ko'rinardi.
  for (const l of CART()) {
    const w = wholesaleOffer(l);
    if (w == null) continue;
    const fromCart = wholesalePlan([l]).rows[0].discount;
    const fromModal = priceDiscount(l, w);
    assert.equal(fromCart, fromModal, `${l.id}: savat ${fromCart} ≠ oyna ${fromModal}`);
  }
});

/* ── 5. ZARARGA SOTISH — chegaradan past narx ───────────────────────────

   ⚠ BU SINOVLAR HAQIQIY XATO USTIGA YOZILGAN (2026-09-09).

   «Zararga sotish» tugmasi qo'shilganda u `priceDiscount` ni
   ishlatardi. O'sha funksiya esa verdikt «ok» bo'lmasa NOL qaytaradi —
   ya'ni chegaradan past narx yozilganda chegirma NOL bo'lib, tovar
   TO'LIQ NARXDA savatga tushardi.

   Kassir «zararga sotdim» deb o'ylardi, mijoz esa e'lon narxini
   to'lardi. Ekranda bir son, chekda boshqa son — bu fayldagi eng
   qimmat xatolar turkumi. */

test("zararga sotish: chegaradan past narx HAQIQIY chegirma beradi", () => {
  const item = { salePrice: 13990, qty: 1, minPrice: 13222 };
  /* Chegaradan past — oddiy yo'l ATAYLAB nol beradi. */
  assert.equal(priceDiscount(item, 5000), 0);
  /* Zarar yo'li esa haqiqiy farqni beradi. */
  assert.equal(lossDiscount(item, 5000), 13990 - 5000);
});

test("zararga sotish: miqdor hisobga olinadi", () => {
  const item = { salePrice: 10000, qty: 3, minPrice: 9000 };
  assert.equal(lossDiscount(item, 8000), (10000 - 8000) * 3);
});

test("⚠ zarar yo'li narxni OSHIRISHGA ochilmaydi", () => {
  const item = { salePrice: 10000, qty: 1, minPrice: 9000 };
  assert.equal(priceVerdict(item, 12000), "high");
  assert.equal(lossDiscount(item, 12000), 0);
});

test("⚠ zarar yo'li chegara ICHIDAGI narxga ham ochilmaydi", () => {
  /* Bu yerda oddiy `priceDiscount` ishlaydi — ikki yo'l bir-birini
     takrorlamasligi kerak, aks holda bir xil narx ikki xil chegirma
     berishi mumkin edi. */
  const item = { salePrice: 10000, qty: 1, minPrice: 9000 };
  assert.equal(priceVerdict(item, 9500), "ok");
  assert.equal(lossDiscount(item, 9500), 0);
  assert.equal(priceDiscount(item, 9500), 500);
});

test("zararga sotishda ham chegirma BUTUN so'm", () => {
  /* Tarozili tovar: 0.125 kg. V80 dan beri pul butun so'mda. */
  const item = { salePrice: 13990, qty: 0.125, minPrice: 13222 };
  const d = lossDiscount(item, 5000);
  assert.equal(d, Math.ceil(d), `chegirma kasr chiqdi: ${d}`);
});

/* ── 6. ⚠ SIMLASH — oyna TO'G'RI funksiyani chaqiradimi ────────────────

   Yuqoridagi sinovlar hisobni qo'riqlaydi, lekin ASL XATO hisobda emas,
   ULANISHDA edi: tugma `priceDiscount` ni chaqirardi va u nol berardi.
   Kutubxona to'g'ri bo'lsa ham, noto'g'ri chaqiruv bilan tovar to'liq
   narxda sotilardi. Shuning uchun chaqiruvning O'ZI tekshiriladi. */
test("⚠ zarar tugmasi `lossDiscount` ni chaqiradi", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/components/LinePriceModal.jsx", import.meta.url), "utf8");

  const i = src.indexOf("line-loss");
  assert.ok(i > 0, "zararga sotish tugmasi topilmadi");

  /* Tugmadan keyingi ilk `onApply(` chaqiruvi — aynan shu tugmaniki. */
  const call = src.slice(i, src.indexOf("</button>", i));
  assert.match(call, /onApply\(\s*lossDiscount\(/,
    "zarar tugmasi `lossDiscount` dan boshqa narsani yuboryapti — "
    + "chegirma nol bo'lib, tovar to'liq narxda sotilardi");
});
