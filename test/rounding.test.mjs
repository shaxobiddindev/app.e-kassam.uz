/* ══════════════════════════════════════════════════════════════════════════
   TIYIN CHEKKA TUSHMAYDI (V80)

   ═══ NIMA BO'LGAN EDI ══════════════════════════════════════════════════

   Do'kon 6.667 kg kartoshkani (7 500 so'm/kg) UMUMAN SOTA OLMADI:

       6.667 × 7 500 = 50 002.5 so'm

   Kassa pulni butun so'mda ko'rsatadi va butun so'mda yuboradi, server
   esa yarim so'mni talab qilardi. Chek ikki tomondan ham yopilmasdi:
   50 003 «ortiqcha to'lov», 50 002 «kam to'lov», 50 002.50 esa kassada
   umuman yo'q pul.

   ⚠ QOIDA: qator jamisi butun so'mga PASTGA yaxlitlanadi — yarim so'm
   MIJOZDA qoladi. Bu do'kon egasining qarori: farq ≤1 so'm, bahs esa
   umuman tug'ilmaydi. Va u yashirilmaydi — chekda alohida qator bo'lib
   chiqadi.

   Ishga tushirish:  node test/rounding.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { lineGross, lineNet, spreadDiscount, optimizeDiscount, budgetOffers }
  = await import("../src/lib/ek-discount.js");
const { moneyFine } = await import("../src/lib/ek-format.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

console.log("── 1. ⚠ Do'kon cheki: 6.667 kg × 7 500 ──");
{
  const line = { salePrice: 7500, qty: 6.667 };
  eq(lineGross(line), 50002.5, "aniq hisob — 50 002.5");
  eq(lineNet(line), 50002, "⚠ mijoz 50 002 to'laydi, ortiq emas");
  eq(Number.isInteger(lineNet(line)), true, "chekka BUTUN so'm tushadi");
}

console.log("\n── 2. Yaxlitlash hech qachon mijozga QARSHI ishlamaydi ──");
{
  const cases = [
    { salePrice: 7500, qty: 6.667 },
    { salePrice: 12300, qty: 1.234 },
    { salePrice: 999, qty: 0.333 },
    { salePrice: 1, qty: 0.001 },
  ];
  const worse = cases.filter((l) => lineNet(l) > lineGross(l));
  worse.length === 0
    ? ok("hech bir holatda to'lov aniq hisobdan oshmadi")
    : bad("to'lov oshib ketdi", JSON.stringify(worse));
}

console.log("\n── 3. Donalab sotuvda yaxlitlash UMUMAN yo'q ──");
{
  eq(lineNet({ salePrice: 7500, qty: 3 }), 22500, "3 × 7 500 = 22 500");
  eq(lineGross({ salePrice: 7500, qty: 3 }) - lineNet({ salePrice: 7500, qty: 3 }), 0,
     "berib yuboriladigan hech narsa yo'q");
}

console.log("\n── 4. ⚠ Chegirma ulushi ham BUTUN so'm ──");
{
  /* Ilgari ulush 333.33 bo'lib chiqar va o'sha tiyin qator jamisiga
     o'tib, chek jamisini yana kasr qilib qo'yardi — tiyin bir eshikdan
     chiqarilib, ikkinchisidan kirib kelardi. */
  const three = [{ salePrice: 100, qty: 1 }, { salePrice: 100, qty: 1 }, { salePrice: 100, qty: 1 }];
  const sh = spreadDiscount(three, 100);
  eq(sh.every((v) => Number.isInteger(v)), true, "har ulush butun");
  eq(sh.reduce((s, v) => s + v, 0), 100, "yig'indi chegirmaga teng");
}

console.log("\n── 5. Savat jamisi har doim butun ──");
{
  let bads = [];
  for (let i = 0; i < 500; i++) {
    const price = 100 + Math.floor(Math.random() * 99900);
    const qty = Math.round(Math.random() * 20000 + 1) / 1000;
    const total = lineNet({ salePrice: price, qty });
    if (!Number.isInteger(total)) bads.push(`${qty} × ${price} → ${total}`);
  }
  bads.length === 0
    ? ok("tasodifiy 500 ta qatorda tiyin qolmadi")
    : bad("tiyin qoldi", bads.slice(0, 3).join(" | "));
}

console.log("\n── 6. Chekda tiyin KO'RSATILADI (yashirilmaydi) ──");
{
  /* ⚠ Razryad ajratgichi — TOR BO'SHLIQ (U+202F), oddiy probel emas
     (`ek-format.js`). Oddiy probel bilan yozilgan kutilma jimgina
     yiqilar va sababi ko'rinmasdi. */
  const NNBSP = "\u202F";
  eq(moneyFine(50002.5), `50${NNBSP}002.50`, "aniq qator jamisi tiyini bilan");
  eq(moneyFine(0.5), "0.50", "yaxlitlash qatori");
  eq(moneyFine(50002), `50${NNBSP}002`, "butun sonda hech narsa o'zgarmaydi");
  eq(moneyFine(50002.0001), `50${NNBSP}002`, "suzuvchi nuqta changi tiyin emas");
  eq(moneyFine(-0.5), "-0.50", "manfiy qiymat ham to'g'ri");
}

console.log("\n\u2500\u2500 7. \u26a0 Optimizator ham BUTUN so'm beradi \u2500\u2500");
{
  /* ⚠ NEGA JIDDIY. Optimizator qaytargan chegirma savatga yoziladi va
     serverga yuboriladi. Kasr chiqsa (333.33), server uni mijoz
     foydasiga 334 ga ko'taradi va chek «kam to'landi» bilan rad
     etiladi — tortiladigan tovarda tuzatilgan nosozlik boshqa
     eshikdan qaytardi. */
  const lines = [
    { salePrice: 7500, qty: 6.667, costPrice: 5000, minPrice: 6000 },
    { salePrice: 12300, qty: 1.234, costPrice: 9000, minPrice: 10000 },
    { salePrice: 4300, qty: 3, costPrice: 3000, minPrice: 3500 },
  ];

  const bads = [];
  for (const budget of [500, 1000, 5000, 12345, 30000]) {
    for (const offer of optimizeDiscount(lines, budget) || []) {
      const frac = (offer.add || []).filter((v) => !Number.isInteger(Number(v)));
      if (frac.length) bads.push(`byudjet ${budget}: ${frac.join(",")}`);
      if (!Number.isInteger(Number(offer.discount))) {
        bads.push(`byudjet ${budget}: jami ${offer.discount}`);
      }
    }
  }
  for (const budget of [500, 5000, 30000]) {
    for (const offer of budgetOffers(lines, 0, budget) || []) {
      const frac = (offer.add || []).filter((v) => !Number.isInteger(Number(v)));
      if (frac.length) bads.push(`byudjet taklifi ${budget}: ${frac.join(",")}`);
    }
  }
  bads.length === 0
    ? ok("hamma byudjetda ulushlar ham, jami ham butun")
    : bad("\u26a0 kasr chegirma qaytdi — server uni rad etardi", bads.slice(0, 3).join(" | "));
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
