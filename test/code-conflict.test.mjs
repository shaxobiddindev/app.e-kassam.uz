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
const { conflictLabelItems } = await import("../src/lib/ek-code.js");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (Object.is(got, want)) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log(`  ❌ ${msg}\n      kutilgan: ${want}\n      keldi:    ${got}`); }
};

console.log("\n── Yorlig'i eskirgan tovarlar ──");
{
  const row = { productId: 7, name: "Guruch", oldCode: "425",
                newCode: "1180", salePrice: 21000, barcode: "20011805" };

  /* ⚠ ASOSIY QO'RIQCHI. */
  eq(conflictLabelItems([row])[0].shortCode, "1180",
     "⚠ yorliqqa YANGI raqam bosiladi");
  eq(conflictLabelItems([row])[0].shortCode === row.oldCode, false,
     "⚠ yorliqqa eski raqam tushyapti — yolg'on qog'oz qayta chop etilardi");

  /* Yorliq chizish uchun kerak bo'ladigan qolgan maydonlar. */
  eq(conflictLabelItems([row])[0].name, "Guruch", "nom yorliqqa o'tadi");
  eq(conflictLabelItems([row])[0].salePrice, 21000, "narx yorliqqa o'tadi");
  eq(conflictLabelItems([row])[0].barcode, "20011805", "barkod yorliqqa o'tadi");

  /* ⚠ MATN QAYTADI, SON EMAS: «0180» ning boshidagi noli yo'qolmasin. */
  eq(conflictLabelItems([{ newCode: 180 }])[0].shortCode, "180",
     "raqam matnga aylanadi");
  eq(conflictLabelItems([{ newCode: "0180" }])[0].shortCode, "0180",
     "⚠ boshidagi nol saqlanadi");

  /* Kodsiz tovar yorliqni buzmasin. */
  eq(conflictLabelItems([{ newCode: null }])[0].shortCode, null, "kodsizda null");
  eq(conflictLabelItems([{ newCode: "" }])[0].shortCode, null, "bo'sh kodda null");

  /* ⚠ SERVER OBYEKT QAYTARSA HAM YIQILMASIN. */
  eq(conflictLabelItems(null).length, 0, "null berilsa bo'sh ro'yxat");
  eq(conflictLabelItems({ a: 1 }).length, 0, "obyekt berilsa bo'sh ro'yxat");
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

  const settings = readFileSync(new URL("../src/pages/SettingsPage.jsx",
                                        import.meta.url), "utf8");
  eq(/isOwner && <CodeConflictPanel/.test(settings), true,
     "⚠ blok egaga cheklanmagan");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
