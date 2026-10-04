/* ══════════════════════════════════════════════════════════════════════════
   DAFTARDAN KO'CHIRISH — matnni ajratish (2026-10-04)

   ⚠ NEGA SINOV. Do'koncha Excel'dan 80 qatorni qo'yadi va ekranda
   faqat natijani ko'radi. Summa telefon ustuniga tushsa yoki «150.000»
   150 so'm bo'lib o'qilsa — u buni sezmasligi mumkin va qarz noto'g'ri
   yoziladi. Xato pulda, shuning uchun har ko'rinish shu yerda.

   Ishga tushirish:  node test/debt-import.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const {
  parseAmount, parseDate, parsePhone, parsePaste, rowErrors, toPayload, isBlank, normName, showDay,
} = await import("../src/lib/ek-debt-import.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(JSON.stringify(got) === JSON.stringify(want), name, `olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`);

const NOW = new Date(2026, 9, 4, 15, 0);   // 2026-10-04

console.log("\n── Summa ──");
eq(parseAmount("150000"), 150000, "150000");
eq(parseAmount("150 000"), 150000, "150 000 (bo'shliq)");
eq(parseAmount("150 000"), 150000, "150 000 (Excel'ning bo'linmas bo'shlig'i)");
eq(parseAmount("150.000"), 150000, "⚠ 150.000 — yuz ellik ming, 150 emas");
eq(parseAmount("150,000"), 150000, "150,000");
eq(parseAmount("1.500.000"), 1500000, "1.500.000");
eq(parseAmount("1 500 000,00"), 1500000, "1 500 000,00 (kasr bilan)");
eq(parseAmount("150000.50"), 150001, "150000.50 → butun so'm");
eq(parseAmount("150 000 so'm"), 150000, "so'm yozilgan");
eq(parseAmount("150 ming"), 150000, "150 ming");
eq(parseAmount("150k"), 150000, "150k");
eq(parseAmount("1,5 mln"), 1500000, "1,5 mln");
eq(parseAmount("2 млн"), 2000000, "2 млн");
eq(parseAmount("-500"), null, "manfiy — yo'q");
eq(parseAmount("0"), null, "nol — yo'q");
eq(parseAmount("Ali"), null, "matn — yo'q");
eq(parseAmount(""), null, "bo'sh — yo'q");
eq(parseAmount("15.10.2026"), null, "sana summa emas");

console.log("\n── Sana ──");
eq(parseDate("04.10.2026"), "2026-10-04", "04.10.2026");
eq(parseDate("4/9/26"), "2026-09-04", "4/9/26");
eq(parseDate("2026-08-01"), "2026-08-01", "2026-08-01");
eq(parseDate("31.02.2026"), null, "31-fevral — yo'q");
eq(parseDate("15.10"), null, "yilsiz sana faqat sana ustunida");
eq(parseDate("15.09", { loose: true, now: NOW }), "2026-09-15", "15.09 → shu yil");
eq(parseDate("20.12", { loose: true, now: NOW }), "2025-12-20", "⚠ 20.12 kelajakda → o'tgan yil");
eq(showDay("2026-10-04"), "04.10.2026", "ko'rinishi kk.oo.yyyy");

console.log("\n── Telefon ──");
eq(parsePhone("+998 90 123-45-67"), "+998901234567", "+998 90 123-45-67");
eq(parsePhone("(90) 123 45 67"), "+998901234567", "(90) 123 45 67");
eq(parsePhone("901234567"), "+998901234567", "901234567");
eq(parsePhone("998901234567"), "+998901234567", "998901234567");
eq(parsePhone("150000"), null, "summa telefon emas");
eq(parsePhone("1 500 000"), null, "1 500 000 telefon emas");

console.log("\n── Excel: sarlavha bilan ──");
{
  const r = parsePaste("Ism\tTelefon\tSumma\tSana\n"
    + "Ali aka\t+998 90 123 45 67\t150 000\t12.09.2026\n"
    + "Vali\t\t50.000\t\n", { now: NOW });
  is(r.header, "sarlavha topildi");
  eq(r.rows.length, 2, "ikki qator (sarlavha tashlandi)");
  eq(r.rows[0], { name: "Ali aka", phone: "+998901234567", amount: "150000", date: "12.09.2026", note: "" }, "1-qator to'liq");
  eq(r.rows[1].amount, "50000", "50.000 → 50000");
  eq(r.rows[1].phone, "", "telefonsiz");
}
{
  const r = parsePaste("Summa\tFIO\tIzoh\n200000\tKarim\tun, shakar", { now: NOW });
  eq(r.rows[0], { name: "Karim", phone: "", amount: "200000", date: "", note: "un, shakar" }, "boshqa tartibdagi sarlavha");
}
{
  const r = parsePaste("Ismoil aka\t120000\nKamol\t5000", { now: NOW });
  is(!r.header, "⚠ «Ismoil aka» sarlavha emas");
  eq(r.rows.length, 2, "birinchi qarzdor yo'qolmadi");
}

console.log("\n── Excel: sarlavhasiz, mazmun bo'yicha ──");
{
  const r = parsePaste("12.09.2026\tAli\t90 123 45 67\t150 000\n"
    + "01.08.2026\tVali\t93 765 43 21\t75 000\n"
    + "15.07.2026\tSoli\t\t1 200 000", { now: NOW });
  eq(r.rows[0], { name: "Ali", phone: "+998901234567", amount: "150000", date: "12.09.2026", note: "" }, "sana | ism | tel | summa");
  eq(r.rows[2].phone, "", "telefoni yo'q qator");
  eq(r.rows[2].amount, "1200000", "1 200 000");
}
{
  const r = parsePaste("150000\tAli\n75000\tVali", { now: NOW });
  eq([r.rows[0].name, r.rows[0].amount], ["Ali", "150000"], "summa | ism");
}
{
  const r = parsePaste('Ali\t"un\nshakar"\t5000', { now: NOW });
  eq(r.rows[0].note, "un\nshakar", "katak ichida yangi qator (Excel qo'shtirnoqlari)");
}
{
  const r = parsePaste("Ali\t+998 12\t5000\nVali\t90 111 22 33\t7000", { now: NOW });
  eq(r.rows[0].phone, "+998 12", "⚠ buzuq telefon tashlanmaydi — qator xato bo'lib ko'rinadi");
}

console.log("\n── Bitta ustunli matn (telefon yozuvlari) ──");
{
  const r = parsePaste("Ali aka - 150 000\nVali 90 123 45 67 75000\nSoli 12.09.2026 200 ming un 2 kg\n\n", { now: NOW });
  eq(r.rows.length, 3, "uch qator, bo'shi tashlandi");
  eq([r.rows[0].name, r.rows[0].amount], ["Ali aka", "150000"], "Ali aka - 150 000");
  eq([r.rows[1].name, r.rows[1].phone, r.rows[1].amount], ["Vali", "+998901234567", "75000"], "telefon ajratildi");
  eq([r.rows[2].name, r.rows[2].date, r.rows[2].amount, r.rows[2].note], ["Soli", "12.09.2026", "200000", "un 2 kg"],
     "⚠ sana, «200 ming», izoh; 2 kg — summa emas");
}
{
  const r = parsePaste("Karim 150 000 2", { now: NOW });
  eq(r.rows[0].amount, "150000", "⚠ «150 000 2» — 1 500 002 emas");
}

console.log("\n── Qator tekshiruvi ──");
eq(rowErrors({ name: "Ali", phone: "", amount: "5000", date: "" }, { now: NOW }), {}, "ism + summa — yetarli (telefon shart emas)");
eq(rowErrors({ name: "", phone: "", amount: "5000" }, { now: NOW }).name, "dimp.errName", "ismsiz — xato");
eq(rowErrors({ name: "Ali", phone: "+998 12", amount: "5000" }, { now: NOW }).phone, "dimp.errPhone", "chala telefon — xato");
eq(rowErrors({ name: "Ali", amount: "" }, { now: NOW }).amount, "dimp.errAmount", "summasiz — xato");
eq(rowErrors({ name: "Ali", amount: "5000", date: "05.10.2026" }, { now: NOW }).date, "dimp.errFuture", "ertangi sana — xato");
eq(rowErrors({ name: "Ali", amount: "5000", date: "32.13" }, { now: NOW }).date, "dimp.errDate", "buzuq sana — xato");
is(isBlank({ name: " ", phone: "", amount: "", note: "" }), "bo'sh qator e'tiborga olinmaydi");
eq(normName("  ali   AKA "), "ali aka", "ism kaliti");

console.log("\n── So'rov ──");
{
  const p = toPayload({ name: " Ali  aka ", phone: "", amount: "150 000", date: "", note: " " }, "2026-07-04", { now: NOW });
  eq([p.fullName, p.phone, p.amount, p.reason], ["Ali aka", null, 150000, null], "telefonsiz qator");
  eq(new Date(p.takenAt).getDate(), 4, "sanasizga umumiy sana");
  eq(new Date(p.takenAt).getMonth(), 6, "…iyul");
  const q = toPayload({ name: "Vali", phone: "(90) 123-45-67", amount: "5000", date: "12.09.2026", note: "un" }, "2026-07-04", { now: NOW });
  eq(q.phone, "+998901234567", "telefon to'liq ko'rinishda");
  eq([new Date(q.takenAt).getDate(), new Date(q.takenAt).getHours()], [12, 0], "o'z sanasi, kun boshi");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
