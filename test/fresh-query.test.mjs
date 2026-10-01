/* ══════════════════════════════════════════════════════════════════════════
   Kassa qidiruvi: qo'shilgandan keyingi yozish — yangi so'rov (2026-10-01).

   ⚠ NEGA: do'kon shikoyati — «topilgan mahsulot qo'shilgandan keyin ikkinchi
   kiritish eskisining davomidan yozilyapti: 45 → 45 4545». Davomiga yozilgan
   har bosqich («454», «4545»…) BOSHQA tovarning kodiga to'g'ri kelib qolishi
   mumkin edi.

   Ishga tushirish:  node test/fresh-query.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { freshQuery } from "../src/lib/ek-fresh-query.js";

let pass = 0, fail = 0;
const eq = (a, e, m) => {
  if (a === e) { pass++; console.log("  ✅ " + m); }
  else { fail++; console.log(`  ❌ ${m} (kutilgan: ${JSON.stringify(e)})\n     olindi: ${JSON.stringify(a)}`); }
};

console.log("\n═══ 1. Oxiriga yozilgan — yangi so'rov ═══");
eq(freshQuery("45", "454545"), "4545", "do'kon misoli: «45» dan keyin «4545»");
eq(freshQuery("suv", "suvk"), "k", "matnli so'rov ham");
eq(freshQuery("*45", "*454545"), "*4545", "kod rejimi — `*` saqlanadi");
eq(freshQuery("*45", "*45*"), "*", "yangi `*` — o'zi kod rejimi");

console.log("\n═══ 2. Ataylab tahrir — tegilmaydi ═══");
eq(freshQuery("suv", "su"), "su", "o'chirish");
eq(freshQuery("suv", "sxuv"), "sxuv", "o'rtaga yozish");
eq(freshQuery("suv", "suv"), "suv", "o'zgarmagan qiymat");
eq(freshQuery("suv", ""), "", "butunlay tozalash");

console.log("\n═══ 3. Chekka holatlar ═══");
eq(freshQuery("", "a"), "a", "bo'sh so'rovdan keyin — oddiy yozish");
eq(freshQuery(null, "a"), "a", "so'rov yo'q");
eq(freshQuery("45", undefined), "", "qiymat yo'q");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
