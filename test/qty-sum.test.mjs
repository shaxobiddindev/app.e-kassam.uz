/* ══════════════════════════════════════════════════════════════════════════
   MIQDOR YOKI SUMMA (V104)

   Do'kon egasi: «pulini yozsa miqdorini o'zi qo'yib savatga qo'shsin».
   Bu yerda tekshiriladigan yagona narsa: PULDAN CHIQQAN MIQDOR chekda
   aytilgan puldan OSHMASIN va rejim almashtirish savatni o'zgartirmasin.

   Ishga tushirish:  node test/qty-sum.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { qtyFromSum, sumFromQty, switchMode, floorTo, MODE_QTY, MODE_SUM } =
  await import("../src/lib/ek-qty-sum.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

console.log("── Summadan miqdor ──");
eq(qtyFromSum(50000, 85000, 3), 0.588, "50 000 so'mga 85 000 so'mlik go'sht → 0.588 kg");
eq(qtyFromSum(13500, 13500, 3), 1, "narxga TENG summa → to'liq 1 birlik");
eq(qtyFromSum(27000, 13500, 3), 2, "ikki barobar summa → aynan 2 (yaxlitlash changisiz)");
eq(qtyFromSum(0, 13500, 3), 0, "0 so'm → 0 (xato emas, javob)");

console.log("\n── ⚠ CHEK AYTILGAN PULDAN OSHMAYDI ──");
/* Bu butun vazifaning sababi: mijoz «50 mingga» dedi — 50 000 uning
   chegarasi. Yaqiniga yaxlitlansa 0.588 emas 0.589 chiqib, chek
   50 065 so'm bo'lardi. */
for (const [sum, price] of [[50000, 85000], [10000, 13500], [7000, 3300], [99999, 1234]]) {
  const q = qtyFromSum(sum, price, 3);
  const charge = q * price;
  if (charge <= sum + 1e-9) ok(`${sum} / ${price} → ${q} = ${Math.round(charge)} so'm (oshmadi)`);
  else bad(`${sum} / ${price} → ${q} chekni ${Math.round(charge)} qildi`, charge);
}

console.log("\n── Bo'linmaydigan birlik (dona) ──");
eq(qtyFromSum(10000, 13500, 0), 0, "10 000 so'm 13 500 so'mlik donaga YETMAYDI → 0");
eq(qtyFromSum(27000, 13500, 0), 2, "27 000 so'm → 2 dona");
eq(qtyFromSum(30000, 13500, 0), 2, "30 000 so'm → 2 dona (2.2 emas)");

console.log("\n── Suzuvchi nuqta changi ──");
/* 0.117 ni JS 0.11699999999999999 deb saqlashi mumkin: yalang'och
   `floor` bir birlikni jimgina yeb qo'yardi. */
eq(qtyFromSum(11700, 100000, 3), 0.117, "11 700 / 100 000 → 0.117 (0.116 EMAS)");
eq(qtyFromSum(29, 100, 2), 0.29, "29 / 100 → 0.29");
eq(floorTo(0.1 + 0.2, 3), 0.3, "0.1 + 0.2 → 0.3");
eq(floorTo(2.999999999999999, 3), 3, "chang 3 ni 2.999 ga tushirmaydi");
eq(floorTo(2.9999, 3), 2.999, "chang EMAS, haqiqiy 2.9999 → 2.999 (yaxlitlanmaydi)");
eq(floorTo(12345.678, 3), 12345.678, "katta miqdor ham buzilmaydi");

console.log("\n── Miqdordan summa ──");
eq(sumFromQty(0.5, 13500), 6750, "0.5 kg × 13 500 → 6 750");
eq(sumFromQty(0.588, 85000), 49980, "0.588 kg × 85 000 → 49 980");
eq(sumFromQty(3, 1500), 4500, "butun miqdor — butun summa");

console.log("\n── ⚠ REJIM ALMASHISHI SAVATNI O'ZGARTIRMAYDI ──");
/* Kassir «miqdor» da 0.588 yozib, «summa» ga, keyin yana «miqdor» ga
   bossa, o'sha 0.588 qaytishi SHART. Aks holda ikki bosishdan keyin
   boshqa og'irlik sotilardi. */
for (const [q, price, dec] of [[0.588, 85000, 3], [0.5, 13500, 3], [1.75, 9900, 3],
                               [2, 13500, 0], [0.01, 1234567, 2], [12.5, 13501, 3]]) {
  const back = qtyFromSum(sumFromQty(q, price), price, dec);
  if (back === q) ok(`${q} → ${sumFromQty(q, price)} so'm → ${back} (o'zgarmadi)`);
  else bad(`${q} qaytganda ${back} bo'ldi`, back);
}

/* ⚠ YAGONA ISTISNO OCHIQ YOZILADI: narx bir qadamdan arzon bo'lsa
   (777 so'm/kg da bir gramm 0.777 so'm turadi) butun so'mda har
   qadamni ifodalab bo'lmaydi. Shunda ham surilish BIR QADAMdan
   oshmaydi — bir gramm. */
{
  const q = 12.345, price = 777, step = 0.001;
  const back = qtyFromSum(sumFromQty(q, price), price, 3);
  const drift = Math.abs(back - q);
  if (drift <= step + 1e-9) ok(`arzon tovar (777 so'm/kg): surilish ${drift.toFixed(3)} — bir qadamdan oshmadi`);
  else bad(`777 so'm/kg da ${q} → ${back}`, drift);
}

console.log("\n── Maydondagi matn ──");
eq(switchMode("0.5", MODE_SUM, 13500, 3), "6750", "0.5 kg → «6750»");
eq(switchMode("6750", MODE_QTY, 13500, 3), "0.5", "6 750 so'm → «0.5»");
eq(switchMode("", MODE_SUM, 13500, 3), "", "bo'sh maydon bo'sh qoladi");
eq(switchMode("0", MODE_SUM, 13500, 3), "", "«0» — o'giradigan narsa yo'q");
eq(switchMode("abc", MODE_SUM, 13500, 3), "", "raqam bo'lmasa bo'shatiladi");
eq(switchMode("100", MODE_QTY, 13500, 0), "", "donaga yetmagan pul → bo'sh (0 emas)");
eq(switchMode("0,5", MODE_SUM, 13500, 3), "6750", "vergul ham nuqta kabi qabul qilinadi");

console.log("\n── Narx yo'q yoki nol ──");
/* Narxsiz tovar kassaga o'tmaydi, lekin oyna savat qatorini ham
   ochadi va u yerda narx 0 bo'lib qolishi mumkin. Nolga bo'lish
   `Infinity` beradi — u miqdor sifatida savatga tushmasligi kerak. */
eq(qtyFromSum(10000, 0, 3), null, "narx 0 → null");
eq(qtyFromSum(10000, null, 3), null, "narx yo'q → null");
eq(sumFromQty(1, 0), null, "narx 0 da summa ham null");
eq(switchMode("0.5", MODE_SUM, 0, 3), "", "narxsiz rejim almashsa maydon bo'shaydi");

console.log("\n── Manfiy ──");
eq(qtyFromSum(-5000, 13500, 3), null, "manfiy summa qabul qilinmaydi");
eq(sumFromQty(-1, 13500), null, "manfiy miqdor qabul qilinmaydi");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
