/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ HISOBOTI — QARZDORLIK BAYONNOMASI (V98)

   ⚠ NEGA SINOV KERAK. Bu MIJOZGA BERILADIGAN hujjat va tortishuvda
   dalil bo'ladi. Ekrandagi xatoni do'kon egasi ko'radi; qog'ozdagi
   xatoni esa mijoz uyiga olib ketadi va u keyin do'konning so'ziga
   qarshi turadi.

   Ishga tushirish:  node test/statement.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { buildStatement, statementRow } = await import("../src/lib/ek-statement.js");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log(`  ❌ ${msg}\n     kutildi: ${JSON.stringify(want)}\n     olindi:  ${JSON.stringify(got)}`); }
};

/* Do'kon egasining misoli — AYNAN o'sha raqamlar. Server ro'yxatni
   yangisidan eskisiga beradi. */
const OWNER = [
  { id: 3, type: "PAYMENT", amount: 500000, createdAt: "2026-09-05T10:00:00Z",
    balanceAfter: 750000, paymentMethod: "CASH" },
  { id: 2, type: "CHARGE", amount: 450000, saleId: 1058,
    createdAt: "2026-09-03T10:00:00Z", balanceAfter: 1250000 },
  { id: 1, type: "CHARGE", amount: 800000, saleId: 1042,
    createdAt: "2026-09-01T10:00:00Z", balanceAfter: 800000 },
];

console.log("\n── DO'KON EGASINING MISOLI ──");
{
  const st = buildStatement(OWNER);
  eq(st.charge, 1250000, "jami qarz 1 250 000");
  eq(st.payment, 500000, "to'lov 500 000");
  eq(st.closing, 750000, "qoldiq 750 000");
  eq(st.opening, 0, "boshlang'ich qoldiq nol — davr cheklanmagan");

  /* ⚠ ESKISIDAN YANGISIGA. Server teskari beradi (jurnal oynasi eng
     yangisini tepada ko'rsatadi), hisobot esa vaqt bo'yicha o'qiladi:
     qoldiq qatordan qatorga o'sib boradi. Tartib buzilsa, «Qoldiq»
     ustuni sakrab, hujjat ishonchsiz ko'rinardi. */
  eq(st.rows.map((r) => r.saleId), [1042, 1058, null], "tartib eskisidan yangisiga");
  eq(st.rows.map((r) => r.balance), [800000, 1250000, 750000], "qoldiq qatorma-qator");
  eq(st.rows.map((r) => [r.charge, r.payment]),
     [[800000, 0], [450000, 0], [0, 500000]],
     "qarz va to'lov ALOHIDA ustunda, ishorasiz");
}

console.log("\n── ⚠ QOLDIQ SERVERDAN, QAYTA HISOBLANMAYDI ──");
{
  /* Bazadagi `balanceAfter` — amal bajarilgan paytda MUZLATILGAN
     qiymat. Klientda qayta hisoblansa, hisobot bazadagi haqiqatni
     emas, klientning TAXMININI ko'rsatardi. */
  const odd = [{ id: 1, type: "CHARGE", amount: 100000,
                 createdAt: "2026-09-01T10:00:00Z", balanceAfter: 999999 }];
  eq(buildStatement(odd).rows[0].balance, 999999,
     "⚠ qator qoldig'i SERVERNIKI, summadan hisoblanmaydi");
  eq(buildStatement(odd).closing, 999999, "yakuniy qoldiq ham o'shandan");

  /* ⚠ ESKI SERVER `balanceAfter` YUBORMAYDI. O'shanda ustun BO'SH
     qolishi kerak: nol yozish «qarzi qolmadi» degan YOLG'ON xabar
     bo'lardi. */
  const noBal = [{ id: 1, type: "CHARGE", amount: 100000, createdAt: "2026-09-01T10:00:00Z" }];
  eq(buildStatement(noBal).rows[0].balance, null, "⚠ maydon yo'q — bo'sh, NOL emas");
  eq(buildStatement(noBal).closing, 100000, "yakuniy esa zaxira hisobdan chiqadi");
}

console.log("\n── DAVR VA BOSHLANG'ICH QOLDIQ ──");
{
  /* ⚠ Boshlang'ich qoldiq hisobotni YOPIQ qiladi:
     boshlang'ich + qarz − to'lov = yakuniy. Usiz o'quvchi «bu 800 000
     qayerdan chiqdi?» deb qolardi. */
  const st = buildStatement(OWNER, { from: "2026-09-03", to: "2026-09-05" });
  eq(st.opening, 800000, "davrdan oldingi oxirgi qoldiq — boshlang'ich");
  eq(st.charge, 450000, "davr ichidagi qarz");
  eq(st.payment, 500000, "davr ichidagi to'lov");
  eq(st.closing, 750000, "yakuniy qoldiq");
  eq(st.opening + st.charge - st.payment, st.closing, "⚠ hisobot YOPILADI");
  eq(st.rows.length, 2, "faqat davr ichidagi qatorlar");

  const only1 = buildStatement(OWNER, { from: "2026-09-01", to: "2026-09-01" });
  eq(only1.opening, 0, "birinchi kundan boshlansa boshlang'ich nol");
  eq(only1.rows.length, 1, "bitta qator");

  const none = buildStatement(OWNER, { from: "2026-10-01" });
  eq(none.rows.length, 0, "harakatsiz davr");
  eq(none.opening, 750000, "⚠ harakat bo'lmasa ham boshlang'ich ko'rinadi");
  eq(none.closing, 750000, "va yakuniy unga teng");
}

console.log("\n── TO'G'IRLASH IMZOSIGA QARAB ──");
{
  /* `ADJUSTMENT` summasi O'ZI imzoli: musbat — qarz oshdi (daftardan
     ko'chirilgan eski qarz), manfiy — kamaydi (kechirildi, qaytarish).
     Mijoz uchun muhimi «qarzim oshdimi yoki kamaydimi», ichki turi
     emas. */
  eq(statementRow({ type: "ADJUSTMENT", amount: 30000 }).charge, 30000,
     "musbat to'g'irlash — QARZ ustuniga");
  eq(statementRow({ type: "ADJUSTMENT", amount: -30000 }).payment, 30000,
     "manfiy to'g'irlash — TO'LOV ustuniga, ishorasiz");
  eq(statementRow({ type: "ADJUSTMENT", amount: -30000 }).charge, 0,
     "va qarz ustuni bo'sh qoladi");
}

console.log("\n── BUZUQ MA'LUMOT YIQITMAYDI ──");
{
  eq(buildStatement(null).rows.length, 0, "null jurnal");
  eq(buildStatement([]).closing, 0, "bo'sh jurnal");
  eq(statementRow({}).charge, 0, "bo'sh qator");
  eq(statementRow(null).payment, 0, "null qator");
  eq(buildStatement([{ id: 1, type: "CHARGE", amount: "salom",
                       createdAt: "2026-09-01T10:00:00Z" }]).charge, 0,
     "son bo'lmagan summa nolga aylanadi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} hisobot: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
