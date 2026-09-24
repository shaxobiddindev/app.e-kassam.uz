/* ══════════════════════════════════════════════════════════════════════════
   NARX × MIQDOR — SUZUVCHI NUQTASIZ

   ═══ JONLI XATO (2026-09-24) ══════════════════════════════════════════

   Server bitta chekni 24 marta rad etdi: «Aralash to'lov summasi chek
   summasiga teng emas: 593645 ≠ 593646». Kassir uni yopa olmadi.
   Chekda uchta tortiladigan tovar edi:

       64 000 × 2.734 = 174 976
       53 000 × 2.8   = 148 400
      135 000 × 2.002 = 270 270      ← JavaScript'da 270269.99999999994
                        ───────
                        593 646

   Qoida ikki tomonda ham BIR XIL edi (V80): qator jamisi butun so'mga
   PASTGA yaxlitlanadi, yarim so'm mijozda qoladi. Server buni `BigDecimal`
   da aniq bajaradi (`Money.charge` → 270 270). Kassa esa ko'paytmani
   suzuvchi nuqtada olib, keyin `Math.floor` qilardi → 270 269. Ya'ni
   qoida to'g'ri, lekin ikkilik kasr bir so'mni «yeb» qo'yardi.

   ⚠ XATO FAQAT BUTUN CHIQISHI KERAK BO'LGAN KO'PAYTMADA sezilardi:
   kasr qismi bor qatorda (6.667 kg × 7 500 = 50 002.5) ikkala tomon
   baribir pastga qirqadi va natija bir xil. Shuning uchun u tasodifiy
   va kamdan-kam ko'rinardi.

   ═══ YECHIM ═══════════════════════════════════════════════════════════

   Narx ham, miqdor ham avval BUTUN songa o'tkaziladi (narx × 10⁴,
   miqdor × 10⁶ — domen talabidan ikki baravar zaxira bilan: narx 2
   kasr, miqdor `roundQty` bo'yicha 3 kasr), ko'paytma `BigInt` da olinadi
   va faqat oxirida bo'linadi. Hech qaysi bosqichda ikkilik kasr yo'q.

   ⚠ `Math.round(v × 10ᵏ)` XAVFSIZ: narx 10¹¹ so'mgacha va miqdor 10⁹
   gacha bo'lsa, ko'paytirishdagi xato 0.5 dan ancha kichik — ya'ni
   yaxlitlash doim aniq butun songa tushadi.

   ⚠ BU MODULDAN TASHQARIDA `narx * miqdor` YOZILMAYDI. `test/rounding.test.mjs`
   manba kodni shunga tekshiradi — ekran, chek, mijoz displeyi va server
   BIR raqamni ko'rsatishi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

const PRICE_SCALE = 1e4;
const QTY_SCALE = 1e6;
const DIV = 10_000n * 1_000_000n;   // 10¹⁰

/** Butun songa o'tkazilgan ko'paytma (10¹⁰ birlikda). */
function scaled(price, qty) {
  const p = BigInt(Math.round((Number(price) || 0) * PRICE_SCALE));
  const q = BigInt(Math.round((Number(qty) || 0) * QTY_SCALE));
  return p * q;
}

/**
 * `BigInt` bo'linmasi PASTGA (manfiy son uchun ham).
 *
 * ⚠ `BigInt` ning `/` amali NOLGA qarab qirqadi: −7n / 2n = −3n, pastga
 * yaxlitlash esa −4 bo'lishi kerak. Savdoda miqdor manfiy bo'lmaydi, lekin
 * qaytarish va tuzatish chekida bo'ladi — va o'sha yerda bir so'm farq
 * xuddi shu xatoni boshqa joyda takrorlardi.
 */
function floorDiv(n, d) {
  const q = n / d;
  return (n % d !== 0n) && ((n < 0n) !== (d < 0n)) ? q - 1n : q;
}

/**
 * Mijoz TO'LAYDIGAN summa: narx × miqdor, butun so'mga PASTGA.
 * Serverdagi `Money.charge` bilan bir xil natija beradi.
 */
export function charge(price, qty) {
  return Number(floorDiv(scaled(price, qty), DIV));
}

/**
 * Narx × miqdorning ANIQ qiymati — kasri bilan, lekin shovqinsiz.
 * Chekda va ekranda qator summasi sifatida ko'rsatiladi (yaxlitlash
 * alohida qatorda chiqadi).
 */
export function gross(price, qty) {
  const n = scaled(price, qty);
  const whole = floorDiv(n, DIV);
  return Number(whole) + Number(n - whole * DIV) / 1e10;
}

/**
 * Yaxlitlashda mijozga qoldirilgan qism: `gross − charge`, doim 0 ≤ x < 1.
 * Chekdagi «Yaxlitlash» qatori shundan yig'iladi.
 */
export function roundingOf(price, qty) {
  const n = scaled(price, qty);
  return Number(n - floorDiv(n, DIV) * DIV) / 1e10;
}
