/* ══════════════════════════════════════════════════════════════════════════
   Mijoz tanlash ro'yxati — ism, telefon bo'lagi va Telegram username (V139).

   ⚠ NEGA: kassadagi va qarz oynasidagi mijoz tanlagichi ilgari faqat
   yorliq va izohni MATN sifatida qidirardi. Natijada:

     · «@zebo_market» umuman TOPILMASDI — username bandda yo'q edi;
     · telefon bo'laklari faqat «hammasi bor» darajasida (500) topilardi:
       raqamlari boshqa tartibda joylashgan begona telefon ham xuddi shu
       darajada turardi va ro'yxatda to'g'ri mijozdan OLDIN chiqa olardi.

   Egasining talabi (2026-09-25): mijoz ism, telefon va Telegram username
   bilan topilsin.

   Ishga tushirish:  node test/customer-option.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { rankItems } from "../src/lib/ek-search.js";
import { customerOption, OPTION_SEARCH } from "../src/lib/ek-customer-option.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));
const yes = (v, m) => (v ? ok(m) : bad(m, v));

/* ⚠ Username ISMGA O'XSHAMAYDI: aks holda sinov ism orqali o'tib ketar va
   username yo'li ishlamasa ham yashil turardi. */
const customers = [
  { id: 1, fullName: "Ali Valiyev",  phone: "+998901234567", telegramUsername: "zebo_market" },
  { id: 2, fullName: "Vali Aliyev",  phone: "+998935554433", telegramUsername: null },
  { id: 3, fullName: "Karim Toshev", phone: "+998971112233" },
];
const opts = customers.map(customerOption);
const find = (q) => rankItems(opts, q, OPTION_SEARCH).map((o) => o.value);

console.log("\n═══ 1. Band shakli ═══");
eq(opts[0].value, "1", "qiymat — satr (Select qiymatni satr sifatida solishtiradi)");
eq(opts[0].label, "Ali Valiyev", "yorliq — ism");
eq(opts[0].hint, "+998901234567", "izoh — telefon, o'z ustunida");
eq(JSON.stringify(opts[0].keywords), '["@zebo_market"]', "username kalit so'z sifatida, @ bilan");
eq(opts[1].keywords.length, 0, "username yo'q — kalit so'z ham yo'q");
eq(customerOption({ id: 4, fullName: "Telefonsiz", phone: null }).digits.length, 0,
  "telefonsiz mijoz yiqitmaydi");

console.log("\n═══ 2. Telefon — bo'laklab ham ═══");
eq(find("90 123 45")[0], "1", "«90 123 45» — bo'sh joyli bo'lak");
eq(find("901234567")[0], "1", "to'liq 9 raqam");
eq(find("+998 93 555")[0], "2", "+998 bilan boshlangan bo'lak");
eq(find("4433")[0], "2", "oxirgi to'rt raqam");
eq(find("90 123 45").length, 1, "boshqa raqamli mijoz chiqmaydi");

/* ⚠ Asosiy farq shu yerda. Ikkinchi telefonda «90», «123», «45» bor, lekin
   TARQOQ (…904512399). Eski matn qidiruvi ikkalasini bir xil (500) baholardi
   va ro'yxatda birinchi turgani — ya'ni begonasi — tepada chiqardi. */
const mixed = [
  { id: 5, fullName: "Begona", phone: "+998904512399" },
  { id: 1, fullName: "Ali Valiyev", phone: "+998901234567" },
].map(customerOption);
eq(rankItems(mixed, "90 123 45", OPTION_SEARCH).map((o) => o.value).join(), "1,5",
  "ketma-ket raqam tarqoq raqamdan yuqorida");

console.log("\n═══ 3. Telegram username ═══");
eq(find("@zebo_market")[0], "1", "@username");
eq(find("zebo_market")[0], "1", "@ belgisisiz");
eq(find("@zebo").join(), "1", "username boshi — faqat egasi");

console.log("\n═══ 4. Ism ═══");
eq(find("karim")[0], "3", "ism");
eq(find("Toshev")[0], "3", "familiya");

console.log("\n═══ 5. Oddiy ro'yxat buzilmaydi ═══");
/* ⚠ OPTION_SEARCH HAMMA Select uchun: rollar, filiallar, to'lov turlari.
   `digits` va `keywords` bo'lmagan band ham avvalgidek topilishi shart. */
const plain = [
  { value: "CASHIER", label: "Kassir" },
  { value: "ADMIN", label: "Do'kon admini", hint: "Boshqaruv" },
];
eq(rankItems(plain, "kass", OPTION_SEARCH)[0]?.value, "CASHIER", "yorliq bo'yicha");
eq(rankItems(plain, "boshq", OPTION_SEARCH)[0]?.value, "ADMIN", "izoh bo'yicha");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
