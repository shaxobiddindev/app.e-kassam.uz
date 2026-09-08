/* ══════════════════════════════════════════════════════════════════════════
   QARZ MUDDATI — SANA HISOBI (V87)

   ⚠ NEGA SINOV BOR. To'rtta kichkina funksiya, lekin ular kassaning
   eng jimgina xatosini bermasligi kerak: BIR KUNGA SURILGAN MUDDAT.
   Uni na kassir, na do'kon egasi darhol sezadi — u mijoz bilan
   tortishuv paytida chiqadi.

   Ikkita xavf ataylab qulflangan:

     1. VAQT MINTAQASI. `toISOString()` UTC beradi va Toshkentda
        (UTC+5) soat 19:00 dan keyin ERTANGI kunni qaytaradi. Kassa
        aynan kechqurun ishlaydi.
     2. KALENDAR. `+ n * 864e5` yozgi vaqtga o'tishda bir soatga
        adashadi va oy/yil chegarasida kunni surib yuboradi.

   Ishga tushirish:  node test/due.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const due = await import("../src/lib/ek-due.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + `\n     olindi: ${got}`); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

/** Mahalliy vaqt bo'yicha aniq lahza — sinov o'zi ham mintaqadan qat'i nazar. */
const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi);

console.log("── iso(): mahalliy sana ──");
eq(due.iso(at(2026, 10, 20)), "2026-10-20", "oddiy kun");
eq(due.iso(at(2026, 1, 5)), "2026-01-05", "bir xonali oy va kun to'ldiriladi");
/* ⚠ ASOSIY BAND: kechki 23:30. UTC+5 da `toISOString()` ERTANGI kunni
   berardi — aynan shu xatoni qulflaymiz. */
eq(due.iso(at(2026, 10, 20, 23, 30)), "2026-10-20",
   "kechki 23:30 — kun O'ZGARMAYDI (UTC ga o'tib ketmaydi)");
eq(due.iso(at(2026, 10, 20, 0, 1)), "2026-10-20", "tundan keyin ham o'sha kun");

console.log("\n── today() ──");
eq(due.today(at(2026, 3, 1, 22)), "2026-03-01", "kechki soatda ham bugun");

console.log("\n── plus(): kalendar amali ──");
eq(due.plus(7, at(2026, 10, 20)), "2026-10-27", "+7 kun");
eq(due.plus(30, at(2026, 10, 20)), "2026-11-19", "+30 kun — oy oshadi");
eq(due.plus(1, at(2026, 12, 31)), "2027-01-01", "yil chegarasi");
eq(due.plus(1, at(2028, 2, 28)), "2028-02-29", "kabisa yili — 29-fevral bor");
eq(due.plus(1, at(2026, 2, 28)), "2026-03-01", "oddiy yilda 29-fevral yo'q");
/* ⚠ Kechki soat + kun qo'shish: eng ko'p uchraydigan kassa holati. */
eq(due.plus(30, at(2026, 10, 20, 23, 45)), "2026-11-19",
   "kechqurun ham aynan +30 kun (bir kun oshib ketmaydi)");

console.log("\n── plus(): sozlama bo'sh bo'lsa — muddatsiz ──");
eq(due.plus(0), "", "0 kun — muddat yo'q, bo'sh satr");
eq(due.plus(null), "", "null — bo'sh");
eq(due.plus(undefined), "", "undefined — bo'sh");
eq(due.plus(-5), "", "manfiy kun — bo'sh (o'tmishga muddat qo'yilmaydi)");
eq(due.plus("14", at(2026, 10, 20)), "2026-11-03", "satr ham son sifatida o'qiladi");

console.log("\n── daysLeft() ──");
eq(due.daysLeft("2026-10-27", at(2026, 10, 20)), 7, "yetti kun qoldi");
eq(due.daysLeft("2026-10-20", at(2026, 10, 20)), 0, "bugun — nol");
/* ⚠ Kunning ISTALGAN soatida nol bo'lishi kerak: aks holda ekranda
   «bugun» yozuvi soatga qarab «−1 kun» ga aylanardi. */
eq(due.daysLeft("2026-10-20", at(2026, 10, 20, 23, 59)), 0,
   "bugun kechqurun ham NOL — soatga bog'liq emas");
eq(due.daysLeft("2026-10-20", at(2026, 10, 20, 0, 1)), 0, "bugun ertalab ham nol");
eq(due.daysLeft("2026-10-19", at(2026, 10, 20)), -1, "kecha — manfiy");
eq(due.daysLeft("", at(2026, 10, 20)), null, "bo'sh — javob yo'q");
eq(due.daysLeft("hech nima"), null, "buzuq qiymat — null");

console.log("\n── parse(): yaroqsiz sana QABUL QILINMAYDI ──");
eq(due.parse("2026-02-31"), null, "31-fevral yo'q — `Date` sirg'alib ketmasin");
eq(due.parse("2026-13-01"), null, "13-oy yo'q");
eq(due.parse("2026-00-10"), null, "0-oy yo'q");
eq(due.parse("26-10-20"), null, "qisqa yil qabul qilinmaydi");
eq(due.parse("2026/10/20"), null, "boshqa ajratgich qabul qilinmaydi");
eq(due.parse(null), null, "null");
eq(due.iso(due.parse("2026-10-20")), "2026-10-20", "to'g'ri sana o'qiladi");
/* ⚠ `new Date("2026-10-20")` UTC deb o'qiladi va UTC+5 da mahalliy
   05:00 chiqadi — kun chegarasida yana bir kunlik siljish. Bizniki
   MAHALLIY tun yarmi bo'lishi kerak. */
eq(due.parse("2026-10-20").getHours(), 0, "mahalliy tun yarmi (UTC emas)");
eq(due.parse("2026-10-20").getDate(), 20, "kun aynan o'sha");

/* ── ⚠ O'TMISHDAGI QARZ MUDDATI (V99) ────────────────────────────────
   Do'kon egasining xabari: «qarz berishda bugundan eski muddat ham
   kiritish mumkin bo'lyapti».

   ⚠ SABAB. Maydonda `min={today()}` turardi, lekin
   `<input type="date">` da `min` KALENDARNI cheklaydi, QO'LDA
   TERISHNI emas: brauzer maydonni `:invalid` deb belgilaydi-yu,
   qiymatni baribir beradi. Ya'ni kassir «20.08.2025» deb terib
   qo'ysa, qarz TUG'ILGAN ZAHOTI muddati o'tgan bo'lib yozilardi. */
console.log("\n── isPast(): o'tmishdagi muddat ──");
eq(due.isPast("2026-09-07", at(2026, 9, 8)), true, "kechagi sana — o'tmish");
eq(due.isPast("2025-01-01", at(2026, 9, 8)), true, "o'tgan yil — o'tmish");
eq(due.isPast("2026-09-08", at(2026, 9, 8)), false, "BUGUN — o'tmish emas");
eq(due.isPast("2026-09-09", at(2026, 9, 8)), false, "ertaga — o'tmish emas");

/* Muddatsiz qarz qonuniy («qachon bo'lsa ham») — u xato emas. */
for (const v of ["", null, undefined, "abc", "2026-13-40"]) {
  eq(due.isPast(v, at(2026, 9, 8)), false, `«${v}» — muddatsiz, xato emas`);
}

/* ⚠ Kun chegarasida soatga bog'liq emas — `daysLeft` bilan bir xil
   sabab: aks holda «muddati o'tgan» yozuvi soatga qarab paydo
   bo'lib turardi. */
eq(due.isPast("2026-09-08", at(2026, 9, 8, 0, 1)), false, "tundan keyin ham bugun");
eq(due.isPast("2026-09-08", at(2026, 9, 8, 23, 59)), false, "kechqurun ham bugun");
eq(due.isPast("2026-09-07", at(2026, 9, 8, 0, 1)), true, "tunda ham kechagisi o'tmish");

/* ── ULANISH QO'RIQCHISI ──────────────────────────────────────────────
   ⚠ YUQORIDAGI SINOVLAR `isPast` NI SINAYDI, ULANISHNI EMAS.

   Bu farq shu sessiyada uch marta qimmatga tushdi: qoida to'g'ri
   yozilgan, lekin chaqirilmagan — va hamma sinov yashil turgan.
   Shuning uchun bu yerda KASSA SAHIFASINING O'ZI o'qiladi: sotish
   tugmasi haqiqatan o'tmishdagi muddatda to'siladimi. */
console.log("\n── Sotish tugmasi o'tmishdagi muddatda to'siladi ──");
{
  const src = await (await import("node:fs/promises")).readFile("src/pages/KassaPage.jsx", "utf8");
  const m = /const canSubmit =[^;]*;/.exec(src);
  eq(!!m, true, "`canSubmit` topildi");
  eq(m ? /duePast/.test(m[0]) : false, true,
     "⚠ `canSubmit` o'tmishdagi muddatni HISOBGA OLMAYDI — tugma ochiq qolardi");
  eq(/const duePast\s*=[^;]*isPast\(/.test(src), true,
     "`duePast` `isPast` orqali hisoblanmayapti");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} due: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
