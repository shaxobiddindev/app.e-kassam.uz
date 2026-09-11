/* ══════════════════════════════════════════════════════════════════════════
   YORLIG'I ESKIRGAN TOVARLAR (B0) — hisobot va qayta chop etish

   ⚠ ENG MUHIM QOIDA: QAYTA CHIQARILGAN YORLIQQA YANGI RAQAM BOSILADI.
   Butun hisobotning sababi shu — javondagi yorliqda ESKI raqam turibdi
   va u endi BOSHQA tovarni ochadi. Yorliq eski raqam bilan qayta
   chiqarilsa, ega ishni qilgandek bo'ladi, lekin javonda o'sha yolg'on
   qog'oz qoladi va kassir yana boshqa tovarni sotadi.

   Bu xatoni ko'z bilan ushlab bo'lmaydi: ikkala raqam ham ekranda
   turadi va qaysi biri yorliqqa ketgani faqat chop etilgach ma'lum
   bo'lardi.

   Ishga tushirish:  node test/code-conflict.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const { pendingItems } = await import("../src/lib/ek-label-print.js");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (Object.is(got, want)) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log(`  ❌ ${msg}\n      kutilgan: ${want}\n      keldi:    ${got}`); }
};

console.log("\n── Yorlig'i eskirgan tovarlar ──");
{
  /* ⚠ QOIDA O'ZGARMADI, UNING QO'RIQCHISI O'ZGARDI (F5).
     Ilgari to'qnashuv qatoridan yorliq elementi QO'LDA yasalardi va
     shu yerda «yangi raqam olindimi?» deb tekshirilardi. Endi
     panel faqat `productId` yuboradi, yorliqni esa renderer
     TOVARNING O'ZIDAN chizadi — ya'ni eski raqamni yorliqqa
     tushirish uchun oldin tovarning o'zidagi raqamni buzish kerak.

     Demak endi tekshiriladigan narsa boshqa: navbat qatori yorliq
     maydonlarini AYNAN o'sha qatordan olsin, hech qayerda ikkinchi
     nusxa yasamasin. */
  const job = { lines: [
    { id: 11, productId: 7, productName: "Guruch", code: "1180",
      salePrice: 21000, barcode: "20011805", quantity: 2, printedAt: null },
    { id: 12, productId: 8, productName: "Un", code: "425",
      salePrice: 9000, barcode: null, quantity: 1,
      printedAt: "2026-09-10T10:00:00Z" },
  ] };

  const items = pendingItems(job, null);

  /* ⚠ ASOSIY QO'RIQCHI: yorliqqa qatordagi JORIY raqam boradi. */
  eq(items[0].product.searchCode, "1180", "⚠ yorliqqa YANGI raqam bosiladi");
  eq(items[0].product.name, "Guruch", "nom yorliqqa o'tadi");
  eq(items[0].product.salePrice, 21000, "narx yorliqqa o'tadi");
  eq(items[0].product.barcode, "20011805", "barkod yorliqqa o'tadi");

  /* ⚠ CHIQARILGANI TASHLAB KETILADI — «qolganidan davom etish». */
  eq(items.length, 1, "⚠ chiqarilgan qator qayta chop etilyapti");
  eq(items[0].quantity, 2, "soni qatordan olinadi");

  /* ⚠ TIRIK TOVAR USTUN: katalogda tovar bo'lsa, yorliq o'shandan
     chiziladi — navbatdagi nusxa eskirgan bo'lishi mumkin. */
  const live = pendingItems(job, { 7: { id: 7, name: "Guruch", searchCode: "1180",
                                        salePrice: 22000 } });
  eq(live[0].product.salePrice, 22000,
     "⚠ navbatdagi eski narx bosilyapti — javonga yolg'on narx chiqardi");
}

console.log("\n── Ulanish: Sozlamalar bloki ──");
{
  const panel = readFileSync(new URL("../src/components/CodeConflictPanel.jsx",
                                     import.meta.url), "utf8");

  /* ⚠ BO'SH BO'LSA BLOK CHIZILMAYDI: to'qnashuvsiz do'konda bu
     sahifada bir piksel ham o'zgarmasligi kerak. */
  eq(/if \(!rows\.length\) return null;/.test(panel), true,
     "⚠ bo'sh ro'yxatda ham blok chizilyapti");

  /* ⚠ Hook'lar shartli `return` dan OLDIN: aks holda React yiqiladi. */
  eq(panel.indexOf("useEffect(") < panel.indexOf("if (!rows.length)"), true,
     "⚠ hook shartli return dan keyin chaqirilyapti");

  /* ⚠ `|| []` server obyekt qaytarsa uni O'TKAZIB YUBORADI. */
  eq(/\.data \|\| \[\]/.test(panel), false,
     "⚠ `|| []` yolg'on himoyasi qaytib kelgan");
  eq(/asArray\(/.test(panel), true, "ro'yxat `asArray` orqali olinmayapti");

  /* ⚠ Yorliq elementi FAQAT bitta joydan yasaladi. */
  eq(/shortCode:/.test(panel), false,
     "⚠ komponent yorliq kodini o'zi yasayapti — qoida ikki joyda bo'lib qoldi");

  /* ⚠ FAQAT ID YUBORILADI (F5): nom, narx va raqam yorliqqa
     tovarning o'zidan tushadi. */
  eq(/productIds=\{labels\}/.test(panel), true,
     "⚠ panel yorliq maydonlarini o'zi uzatyapti — ikkinchi nusxa qaytdi");
  eq(/salePrice:/.test(panel), false, "⚠ panel narxni yorliq uchun ko'chiryapti");

  const settings = readFileSync(new URL("../src/pages/SettingsPage.jsx",
                                        import.meta.url), "utf8");
  eq(/isOwner && <CodeConflictPanel/.test(settings), true,
     "⚠ blok egaga cheklanmagan");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
