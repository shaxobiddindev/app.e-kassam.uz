/* ══════════════════════════════════════════════════════════════════════════
   ESC/POS bayt qatlami — sinov.

   ⚠ NEGA REPODA: bu sinov birinchi marta vaqtinchalik papkada yozilgan
   edi. Aynan shu naqsh bir marta butun e2e to'plamini yo'qotgan
   (`docs/09-CHETLANISHLAR.md` §10p) — skriptlar sessiya bilan birga
   ketgan, hujjatlar esa mavjud bo'lmagan faylga havola qilardi.

   ⚠ NEGA FAQAT `ek-escpos.js`: unda brauzerga bog'liqlik yo'q, shuning
   uchun `node` da to'g'ridan-to'g'ri ishlaydi. `ek-hardware.js` esa
   `localStorage` va tarjimaga tayanadi — uni sinash uchun butun bir
   muhit kerak bo'lardi va foyda arzimasdi.

   Ishga tushirish:  node test/escpos.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { Receipt, WIDTH_80 } from "../src/lib/ek-escpos.js";

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, extra) => { fail++; console.log("  ❌ " + m); if (extra) console.log("     " + extra); };

const GS = 0x1d;
const find = (arr, sub) => {
  outer: for (let i = 0; i <= arr.length - sub.length; i++) {
    for (let j = 0; j < sub.length; j++) if (arr[i + j] !== sub[j]) continue outer;
    return i;
  }
  return -1;
};

console.log("═══ EAN-13 nazorat raqami ═══");
/* 4006381333931 — HAQIQIY EAN-13 (Faber-Castell), nazorat raqami 1.
   ⚠ O'ylab topilgan raqam ISHLATILMAYDI: birinchi urinishda aynan shunday
   qilingan va sinov yiqilgan — algoritm to'g'ri, ma'lumot xato edi. */
{
  const r = new Receipt(WIDTH_80);
  r.barcodeEan13("4006381333931")
    ? ok("to'g'ri EAN qabul qilindi")
    : bad("to'g'ri EAN rad etildi");
  find(r.build(), [GS, 0x6b, 67]) > -1
    ? ok("GS k 67 (EAN13) buyrug'i bor")
    : bad("EAN13 buyrug'i yo'q");
}
{
  const r = new Receipt(WIDTH_80);
  /* Noto'g'ri nazorat raqami JIM o'tib ketmasligi kerak: printer bunday
     kodni umuman chiqarmaydi va yorliq barkodsiz chiqadi — buni faqat
     javonda skaner qilganda bilinardi. */
  !r.barcodeEan13("4006381333932")
    ? ok("noto'g'ri nazorat raqami rad etildi")
    : bad("noto'g'ri EAN o'tib ketdi");
  find(r.build(), [GS, 0x6b, 67]) === -1
    ? ok("rad etilganda bayt ham yozilmadi")
    : bad("bayt yozilib qolgan");
}
{
  const r = new Receipt(WIDTH_80);
  !r.barcodeEan13("12345") ? ok("qisqa kod rad etildi") : bad("qisqa kod o'tdi");
  !r.barcodeEan13("") ? ok("bo'sh kod rad etildi") : bad("bo'sh kod o'tdi");
}

console.log("═══ Code 128 zaxirasi ═══");
{
  const r = new Receipt(WIDTH_80);
  r.barcode128("ABC-123", { hri: true });
  const at = find(r.build(), [GS, 0x6b, 73]);
  at > -1 ? ok("GS k 73 (Code128) buyrug'i bor") : bad("Code128 buyrug'i yo'q");
  const b = r.build();
  b[at + 4] === 0x7b && b[at + 5] === 0x42
    ? ok("`{B` varianti qo'yilgan (usiz harfli kod noto'g'ri kodlanadi)")
    : bad("variant yo'q");
}

console.log("═══ Yorliqdagi kesish chizig'i ═══");
{
  const r = new Receipt(WIDTH_80);
  r.line("- ".repeat(Math.floor(WIDTH_80 / 2)).trimEnd());
  r.build().every((x) => x < 0x80)
    ? ok("hamma bayt ASCII")
    : bad("ASCII bo'lmagan bayt bor");
  /* Qaychi belgisi NEGA ishlatilmagani shu yerda ko'rinib turadi. */
  const r2 = new Receipt(WIDTH_80);
  r2.line("✂".repeat(4));
  const q = r2.build().filter((x) => x === 0x3f).length;
  q === 4 ? ok("✂ ishlatilsa 4 ta `?` chiqardi — shuning uchun tirelar") : bad("kutilmagan: " + q);
}

console.log("═══ Narx ikki baravar shriftda ═══");
{
  const r = new Receipt(WIDTH_80);
  r.double().line("22 500 so'm").double(false);
  find(r.build(), [GS, 0x21, 0x11]) > -1 ? ok("double-size yoqildi") : bad("double yo'q");
  find(r.build(), [GS, 0x21, 0x00]) > -1 ? ok("double o'chirildi") : bad("double o'chirilmadi");
}

console.log("\n═══ NATIJA: " + pass + " o'tdi, " + fail + " yiqildi ═══");
process.exit(fail ? 1 : 0);
