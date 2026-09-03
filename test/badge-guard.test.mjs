/* ══════════════════════════════════════════════════════════════════════════
   BAJIK QO'RIQLANGAN CHAQIRUVLAR — sinov

   ═══ NEGA BU SINOV BOR ══════════════════════════════════════════════════

   Foydalanuvchi shikoyati (2026-09): «mahsulotni tahrirlab saqlasam
   xato beryapti, xatoda bajik skanerlang degan narsa bor lekin bajik
   skaner soralmadi».

   Sabab: server narx o'zgarganda 428 (bajik kerak) qaytaradi, front esa
   uni ODDIY XATO deb ko'rsatardi — xabar bor, skanerlash oynasi yo'q.
   Kassir/do'kondor uchun bu KO'R KO'CHA: nima qilishni aytmaydigan xato.

   Xatoning o'zi bitta satrda edi (`guard` unutilgan), lekin TURI
   takrorlanadigan: server yangi amalni qo'riqlashi bilan yana o'sha
   holat qaytadi va uni yana faqat foydalanuvchi topadi.

   Shu sababdan ro'yxat SHU YERDA qayd etiladi: serverda
   `badgeGuard.require(...)` chaqiriladigan har bir amal front tomonda
   `guard(...)` bilan o'ralgan bo'lishi SHART.

   ⚠ Yangi qo'riqlangan amal qo'shsangiz — uni shu ro'yxatga ham qo'shing.

   Ishga tushirish:  node test/badge-guard.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, extra) => { fail++; console.log("  ❌ " + m); if (extra) console.log("     " + extra); };

/* Serverda qo'riqlanadigan amal → front tomondagi API chaqiruvi.
   Manba: `grep -rn "badgeGuard.require" api.e-kassam.uz/src/main/java` */
const GUARDED = [
  ["SALE_DISCOUNT (chegaradan oshgan chegirma)", "saleApi.create"],
  ["SALE_RETURN",                                "saleApi.returnSale"],
  ["INVENTORY_CORRECT",                          "inventoryApi.correctBatch"],
  ["INVENTORY_CORRECT (sanoq yopish)",           "inventoryApi.stockTake.close"],
  ["STAFF_MANAGE (qo'shish)",                    "shopApi.createUser"],
  ["STAFF_MANAGE (tahrir)",                      "shopApi.updateUser"],
  ["STAFF_MANAGE (o'chirish)",                   "shopApi.deleteUser"],
  ["STAFF_MANAGE (blok)",                        "shopApi.toggleBlockUser"],
  ["PRICE_CHANGE (mahsulot tahriri)",            "productApi.update"],
  ["PRICE_CHANGE (ommaviy)",                     "productApi.bulkPrice"],
  ["SHIFT_CLOSE_DIFF",                           "securityApi.closeShift"],
  ["CASH_WITHDRAW",                              "securityApi.addCash"],
];

/* Qo'riqlash TALAB QILINMAYDIGAN joylar — ataylab: oflayn navbat
   fon rejimida qayta yuboradi, u yerda hech kim bajik skanerlay
   olmaydi (server baribir rad etadi va chek navbatda qoladi). */
const EXEMPT = [
  ["src/pages/KassaPage.jsx", "queue.setSender"],
  /* Ommaviy narxning KO'RIB CHIQISH chaqiruvi (`dryRun: true`): server
     bajik so'rovidan OLDIN qaytadi (`PriceService.bulkPrice`), ya'ni
     428 kelmaydi. Haqiqiy qo'llash (`payload(false)`) esa o'ralgan. */
  ["src/pages/PricesPage.jsx", "payload(true)"],
];

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(p)) files.push(p);
  }
})("src");

console.log("\n═══ Qo'riqlangan chaqiruvlar `guard()` bilan o'ralganmi ═══\n");

for (const [action, call] of GUARDED) {
  const hits = [];
  for (const file of files) {
    if (file.endsWith("src/api/index.js")) continue;              // ta'rif joyi
    const src = readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      if (!line.includes(call + "(")) return;
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) return;  // izoh
      if (EXEMPT.some(([f, mark]) => file.endsWith(f) && line.includes(mark))) return;
      hits.push({ file, no: i + 1, line: line.trim() });
    });
  }

  if (hits.length === 0) {
    // Chaqiruv umuman yo'q — ro'yxat eskirgan yoki amal hali ulanmagan.
    ok(`${action}: ${call} — chaqirilmaydi (o'ralishi shart emas)`);
    continue;
  }
  const naked = hits.filter((h) => !h.line.includes("guard("));
  if (naked.length === 0) ok(`${action}: ${call} — ${hits.length} ta chaqiruv, hammasi guard() ichida`);
  else bad(`${action}: ${call} — guard() siz chaqirilgan`,
           naked.map((h) => `${h.file}:${h.no}  ${h.line}`).join("\n     "));
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} ta o'tdi, ${fail} ta yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
