/* ══════════════════════════════════════════════════════════════════════════
   Kiritish maydonlari — formatlash va qat'iy tekshirish sinovi.

   ⚠ NEGA MUHIM: bu funksiyalar `min="0"` o'rniga ishlaydi. Brauzerning
   `min` atributi kiritishni TO'SMAYDI — u faqat forma validatsiyasiga
   ta'sir qiladi, forma esa bu ilovada `onSubmit` bilan yuborilmaydi.
   Ya'ni manfiy narx yoki 13 raqamli telefon aynan shu yerda to'siladi.

   Ishga tushirish:  node test/input-format.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import {
  numberInput, displayNumber, phoneInput, isEmail, emailInput,
  isBarcodeChecksumValid, mxikInput, isMxik, codeInput, usernameInput,
  isUsername, nameInput, validate, required, positive, notNegative, between, minLen,
} from "../src/lib/ek-input.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));

const NNBSP = " ";   // ⚠ tor bo'shliq — oddiy probel EMAS (`ek-format.js` bilan bir xil)

console.log("\n═══ 1. Son: manfiy va axlat belgilar ═══");
eq(numberInput("-500", { decimals: 0 }).raw, "500", "minus tashlanadi: -500 → 500");
eq(numberInput("-0.5", { decimals: 2 }).raw, "0.5", "manfiy kasr ham musbatga aylanadi");
eq(numberInput("1e5", { decimals: 0 }).raw, "15", "«e» belgisi son emas — tashlanadi");
eq(numberInput("12abc34", { decimals: 0 }).raw, "1234", "harflar tashlanadi");
eq(numberInput("1 234 500", { decimals: 0 }).raw, "1234500", "razryad bo'shliqlari tozalanadi");
eq(numberInput("12,50", { decimals: 2 }).raw, "12.50", "vergul nuqtaga aylanadi");
eq(numberInput("1.2.3", { decimals: 2 }).raw, "1.23", "ikkinchi nuqta tashlanadi");
eq(numberInput("007", { decimals: 0 }).raw, "7", "old nollar kesiladi");
eq(numberInput("0", { decimals: 0 }).raw, "0", "yolg'iz nol qoladi");
eq(numberInput("", { decimals: 0 }).raw, "", "bo'sh qiymat bo'sh qoladi");
eq(numberInput(".", { decimals: 2 }).raw, "", "yolg'iz nuqta — qiymat emas");

console.log("\n═══ 2. Kasr xonalari va chegara ═══");
eq(numberInput("12.999", { decimals: 2 }).raw, "12.99", "pulda 2 xona");
eq(numberInput("1.2345", { decimals: 3 }).raw, "1.234", "miqdorda 3 xona");
eq(numberInput("12.5", { decimals: 0 }).raw, "125", "butun maydonda nuqta yo'q");
eq(numberInput("150", { decimals: 2, max: 100 }).raw, "100", "foiz 100 dan oshmaydi");
eq(numberInput("99.99", { decimals: 2, max: 100 }).raw, "99.99", "chegaradagi qiymat o'tadi");
eq(numberInput("12.", { decimals: 2 }).raw, "12.", "yozilayotgan «12.» rad etilmaydi");

console.log("\n═══ 3. Ko'rinish ═══");
eq(numberInput("1234500", { decimals: 0 }).display, `1${NNBSP}234${NNBSP}500`, "razryadlar ajratiladi");
eq(displayNumber("1234500.5", { decimals: 2 }), `1${NNBSP}234${NNBSP}500.5`, "saqlangan qiymat ham formatlanadi");
eq(displayNumber("", { decimals: 2 }), "", "bo'sh qiymat — bo'sh ko'rinish");
eq(displayNumber(null, { decimals: 0 }), "", "null — bo'sh ko'rinish");

console.log("\n═══ 4. Telefon (998 + 9 raqam) ═══");
eq(phoneInput("998901234567").raw, "+998901234567", "to'liq raqam");
eq(phoneInput("998901234567").display, "+998 (90) 123-45-67", "niqob");
eq(phoneInput("901234567").raw, "+998901234567", "kodsiz kiritilgan raqamga 998 qo'shiladi");
eq(phoneInput("+9989962806286").digits.length, 9, "13 raqamli axlat 9 taga kesiladi");
eq(phoneInput("+9989962806286").valid, true, "kesilgandan keyin to'g'ri bo'ladi");
eq(phoneInput("99890123").valid, false, "kam raqam — noto'g'ri");
eq(phoneInput("").raw, "", "bo'sh maydon +998 bilan to'lib qolmaydi");
eq(phoneInput("abc").raw, "", "harflardan raqam chiqmaydi");

console.log("\n═══ 5. Pochta ═══");
eq(emailInput("  Ekassam.UZ@Gmail.com "), "ekassam.uz@gmail.com", "bo'shliq va bosh harf tozalanadi");
eq(isEmail("ekassam.uz@gmail.com"), true, "to'g'ri manzil");
eq(isEmail("ekassam.uz@gmail"), false, "domen nuqtasiz — noto'g'ri");
eq(isEmail("@gmail.com"), false, "nomsiz manzil — noto'g'ri");
eq(isEmail("a b@gmail.com"), false, "bo'shliqli manzil — noto'g'ri");

console.log("\n═══ 6. Barkod va MXIK ═══");
eq(isBarcodeChecksumValid("4780001000013"), true, "EAN-13 nazorat raqami to'g'ri");
eq(isBarcodeChecksumValid("4780001000011"), false, "buzilgan nazorat raqami ushlanadi");
eq(isBarcodeChecksumValid("12345"), false, "5 raqamli barkod bo'lmaydi");
eq(mxikInput("00000000000000000123"), "00000000000000000", "MXIK 17 raqamgacha kesiladi");
eq(isMxik("00000000000000000"), true, "17 raqam — to'g'ri");
eq(isMxik("0000"), false, "qisqa MXIK — noto'g'ri");

console.log("\n═══ 7. Kod, foydalanuvchi nomi, ism ═══");
eq(codeInput("Filial 1!"), "filial1", "kodda faqat kichik lotin va raqam");
eq(usernameInput("Ali Valiyev"), "alivaliyev", "foydalanuvchi nomida bo'shliq yo'q");
eq(usernameInput("Али"), "", "kirill tashlanadi");
eq(isUsername("ali_2"), true, "to'g'ri foydalanuvchi nomi");
eq(isUsername("al"), false, "3 belgidan qisqa — noto'g'ri");
eq(nameInput("Ali 123 Valiyev"), "Ali  Valiyev".replace(/\s{2,}/g, " "), "ismda raqam bo'lmaydi");
eq(nameInput("O'ktam Zoirov"), "O'ktam Zoirov", "apostrof saqlanadi");

console.log("\n═══ 8. Saqlashdan oldingi tekshiruv ═══");
const errs = validate(
  { name: "", price: "-5", percent: "150", pass: "123" },
  {
    name:    [required("Nom kerak")],
    price:   [notNegative("Manfiy bo'lmasin"), positive("Noldan katta bo'lsin")],
    percent: [between(0, 100, "0–100 oralig'ida")],
    pass:    [minLen(6, "Kamida 6 belgi")],
  }
);
eq(errs.name, "Nom kerak", "bo'sh nom ushlanadi");
eq(errs.price, "Manfiy bo'lmasin", "manfiy narx ushlanadi");
eq(errs.percent, "0–100 oralig'ida", "chegaradan chiqqan foiz ushlanadi");
eq(errs.pass, "Kamida 6 belgi", "qisqa parol ushlanadi");
eq(Object.keys(validate({ a: "5" }, { a: [positive("x")] })).length, 0, "to'g'ri qiymatda xato yo'q");

console.log("\n═══ 9. Belgi-belgi yozish (haqiqiy foydalanuvchi kabi) ═══");
/* Maydon har bosishda qayta formatlanadi, shuning uchun ketma-ketlikni
   ham sinash kerak: "-1e5" yozgan odam nima ko'radi? */
function typeSeq(text, opts) {
  let raw = "";
  for (const ch of text) raw = numberInput(raw + ch, opts).raw;
  return raw;
}
eq(typeSeq("-1e5", { decimals: 2 }), "15", "«-1e5» -> 15 (minus va «e» tashlandi)");
eq(typeSeq("1234500", { decimals: 2 }), "1234500", "oddiy son buzilmaydi");
eq(typeSeq("12.50", { decimals: 2 }), "12.50", "kasr yozilaveradi");
eq(typeSeq("12,50", { decimals: 2 }), "12.50", "vergul bilan ham");
eq(typeSeq("0.5", { decimals: 3 }), "0.5", "noldan boshlanadigan kasr");
eq(typeSeq("150", { decimals: 2, max: 100 }), "100", "foiz chegarada to'xtaydi");
eq(typeSeq("-10", { decimals: 2, min: null }), "-10", "narx o'zgartirishda minus MUMKIN");
eq(typeSeq("abc", { decimals: 2 }), "", "faqat harf — bo'sh qiymat");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
