/* ==========================================================================
   e-Kassam — KIRITISH MAYDONLARI: formatlash va qat'iy tekshirish

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.

   ── Nega bu fayl bor ──────────────────────────────────────────────────────
   Ilgari har maydon `<input type="number" min="0">` edi. `min` esa faqat
   forma VALIDATSIYASIGA ta'sir qiladi — u KIRITISHNI to'smaydi. Ya'ni
   narx maydoniga qo'lda `-500` yozib, saqlash tugmasini bosib bo'lardi;
   telefon maydoniga esa `+9989962806286` (13 raqam) sig'ardi va backend
   ham uni qabul qilardi.

   Bu yerdagi funksiyalar ANIQ BITTA ishni qiladi: kiritilgan xom matnni
   maydon TURIGA mos yagona shaklga keltiradi. Ular sof (pure) — hech
   qanday DOM yoki React yo'q, shuning uchun `test/input-format.test.mjs`
   da to'g'ridan-to'g'ri sinaladi.

   ⚠ Qoida: maydon O'ZI to'sishi kerak, xato xabari EMAS. Foydalanuvchi
   noto'g'ri qiymat kiritib, keyin "nega saqlanmadi?" deb qidirmasin.
   ========================================================================== */

const NNBSP = " "; // tor bo'shliq — `ek-format.js` bilan bir xil ajratgich

/* ── Asosiy yordamchilar ─────────────────────────────────────────────── */

/** Faqat raqamlar: "+998 (90) 12" → "99890 12" emas, "9989012" */
export const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

/** Butun qismni razryadlarga ajratadi: "1234500" → "1 234 500" */
export const groupInt = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);

/** Nechta raqam bor — kursor o'rnini saqlash uchun kerak. */
export const countDigits = (s) => (String(s ?? "").match(/\d/g) || []).length;

/* ── Son (pul, miqdor, foiz, butun son) ──────────────────────────────── */

/**
 * Kiritilayotgan sonni tozalaydi.
 *
 * Qaytaradi `{ raw, display }`:
 *   raw     — formaga va API ga ketadigan qiymat ("1234.5"), guruhlanmagan
 *   display — ekranda ko'rinadigan ("1 234.5")
 *
 * ⚠ MANFIY SON UMUMAN KIRITILMAYDI: minus belgisi tashlanadi. Pul, miqdor
 * va foiz maydonlarining birortasida ham manfiy qiymat MA'NOGA EGA EMAS —
 * qaytarish, chiqit va kamomad alohida amallar bilan yoziladi, "-" bilan
 * emas. Manfiy qiymat kerak bo'ladigan yangi maydon paydo bo'lsa,
 * `allowNegative` qo'shing, bu yerni "yumshatib" qo'ymang.
 *
 * ⚠ Yozilayotgan paytdagi oraliq holat SAQLANADI: "12." (nuqta yozildi,
 * kasr hali yo'q) rad etilmaydi — aks holda nuqtani yozib bo'lmasdi.
 */
export function numberInput(input, { decimals = 0, max = null, min = 0 } = {}) {
  let s = String(input ?? "").replace(",", ".");

  /* Minus FAQAT `min` manfiy (yoki cheklanmagan) maydonlarda mumkin.
     Yagona shunday joy — ommaviy narx o'zgartirish: "-10%" mavsumiy
     chegirma. Qolgan hamma joyda manfiy son ma'noga ega emas. */
  const signed = min === null || min < 0;
  const neg = signed && /^\s*-/.test(s);
  s = s.replace(/[^\d.]/g, "");

  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {                              // ikkinchi nuqta tashlanadi
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (decimals === 0) s = s.replace(/\./g, "");

  let [int = "", frac = ""] = s.split(".");
  const hasDot = decimals > 0 && s.includes(".");

  int = int.replace(/^0+(?=\d)/, "");                 // "007" → "7", lekin "0" qoladi
  if (frac.length > decimals) frac = frac.slice(0, decimals);

  const sign = neg ? "-" : "";
  let raw = sign + int + (hasDot ? "." + frac : "");
  if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
    return { raw: neg && s === "" ? "-" : "", display: neg && s === "" ? "-" : "" };
  }

  // Chegara: yozib bo'lgandan keyin emas, YOZAYOTGANDA ushlaydi
  const num = Number(raw);
  if (max != null && Number.isFinite(num) && num > max) {
    raw = trimTo(max, decimals);
    [int, frac] = raw.replace("-", "").split(".");
    return { raw, display: (raw.startsWith("-") ? "-" : "") + groupInt(int) + (frac ? "." + frac : "") };
  }
  if (min != null && Number.isFinite(num) && num < min) {
    raw = trimTo(min, decimals);
    [int, frac] = raw.replace("-", "").split(".");
    return { raw, display: (raw.startsWith("-") ? "-" : "") + groupInt(int) + (frac ? "." + frac : "") };
  }

  return { raw, display: sign + groupInt(int || "0") + (hasDot ? "." + frac : "") };
}

const trimTo = (n, decimals) =>
  decimals > 0 ? String(Number(n.toFixed(decimals))) : String(Math.trunc(n));

/** Formadagi xom qiymatni ko'rinishga aylantiradi (qayta chizishda). */
export function displayNumber(raw, { decimals = 0 } = {}) {
  if (raw === null || raw === undefined || raw === "") return "";
  const s = String(raw).replace(",", ".");
  if (s === "-") return "-";
  const sign = s.startsWith("-") ? "-" : "";
  const [int = "", frac] = s.replace("-", "").split(".");
  const cleanInt = onlyDigits(int) || (s.replace("-", "").startsWith(".") ? "0" : "");
  if (cleanInt === "" && !frac) return "";
  const f = frac === undefined ? null : String(frac).slice(0, decimals);
  return sign + groupInt(cleanInt || "0") + (f !== null ? "." + f : "");
}

/* ── Telefon (O'zbekiston) ───────────────────────────────────────────── */

/**
 * O'zbekiston raqami: 998 + 9 ta raqam, JAMI 12 TA.
 *
 * ⚠ Ilgari maydon 13 raqamni ham qabul qilardi (`+9989962806286`) —
 * backend qoidasi ham bo'sh edi (`^\+?[0-9]{9,13}$`). Bunday raqamga
 * na SMS ketadi, na qo'ng'iroq: mijoz bazasi jimgina buziladi.
 */
export function phoneInput(input) {
  let d = onlyDigits(input);
  if (d.startsWith("998")) d = d.slice(3);
  else if (d.startsWith("8") && d.length > 9) d = d.slice(1);
  d = d.slice(0, 9);                                  // operator kodi + 7 raqam

  let display = "+998";
  if (d.length > 0) display += " (" + d.slice(0, 2);
  if (d.length >= 2) display += ")";
  if (d.length > 2) display += " " + d.slice(2, 5);
  if (d.length > 5) display += "-" + d.slice(5, 7);
  if (d.length > 7) display += "-" + d.slice(7, 9);

  return {
    raw: d.length ? "+998" + d : "",
    display: d.length ? display : "",
    digits: d,
    valid: d.length === 9,
  };
}

export const isPhone = (s) => phoneInput(s).valid;

/* ── Pochta ──────────────────────────────────────────────────────────── */

/** Bo'shliq va bosh harf — eng ko'p uchraydigan ikki xato. */
export const emailInput = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase().slice(0, 254);

/**
 * ⚠ To'liq RFC 5322 ATAYLAB tekshirilmaydi: uning ifodasi bir sahifa
 * bo'ladi va baribir haqiqiy manzilni kafolatlamaydi. Bu yerda faqat
 * ochiq-oydin xatolar ushlanadi; yagona haqiqiy tekshiruv — xat yuborish.
 */
export const isEmail = (s) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(String(s ?? "").trim());

/* ── Barkod ──────────────────────────────────────────────────────────── */

export const barcodeInput = (s) => onlyDigits(s).slice(0, 14);

/**
 * EAN-8 / UPC-A / EAN-13 / ITF-14 nazorat raqami.
 * Noto'g'ri barkod — omborda topilmaydigan tovar degani, shuning uchun
 * u KIRITISHDA emas, saqlashda ogohlantiradi (do'kon ichki kodlari ham
 * bo'ladi, ular nazorat raqamiga bo'ysunmaydi).
 */
export function isBarcodeChecksumValid(s) {
  const d = onlyDigits(s);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const body = d.slice(0, -1).split("").map(Number);
  const check = Number(d.slice(-1));
  let sum = 0;
  for (let i = body.length - 1, mul = 3; i >= 0; i--, mul = mul === 3 ? 1 : 3) {
    sum += body[i] * mul;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/** Artikul (SKU): katta lotin, raqam va `-._`. Do'kon ichki kodi. */
export const skuInput = (s) =>
  String(s ?? "").toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 64);

/** Faqat raqam (qadoq kodi, port va h.k.). */
export const digitsInput = (s, max = 32) => onlyDigits(s).slice(0, max);

/* ── Ikki bosqichli kirish kodi ──────────────────────────────────────── */

/**
 * Maydon IKKI xil kodni qabul qiladi (§10z):
 *   • TOTP — 6 ta raqam;
 *   • tiklash kodi — "ABCD-EFGH" (katta harf + raqam, O/0 va I/1 yo'q).
 * Shuning uchun faqat raqamga cheklab bo'lmaydi. Bo'shliq tashlanadi va
 * harflar KATTA qilinadi: foydalanuvchi kodni qo'lda ko'chirganda
 * ko'pincha kichik harfda yozadi va server uni rad etardi.
 */
export const otpInput = (s) =>
  String(s ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9);

/* ── MXIK va boshqa kodlar ───────────────────────────────────────────── */

export const mxikInput = (s) => onlyDigits(s).slice(0, 17);
export const isMxik = (s) => /^\d{17}$/.test(String(s ?? ""));

/** Do'kon/filial kodi: kichik lotin, raqam, `-` va `_`. */
export const codeInput = (s) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);

/** Foydalanuvchi nomi: kichik lotin, raqam, `_`. Kirill ham tashlanadi. */
export const usernameInput = (s) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);

export const isUsername = (s) => /^[a-z0-9_]{3,32}$/.test(String(s ?? ""));

/** Ism-familiya: raqam va maxsus belgilar kerak emas. */
export const nameInput = (s) =>
  String(s ?? "").replace(/[^\p{L}\p{M}'’\- .]/gu, "").replace(/\s{2,}/g, " ").slice(0, 120);

/* ── Umumiy tekshiruvlar (saqlashdan oldin) ──────────────────────────── */

/**
 * `rules` — { maydon: [tekshiruv, ...] }. Har tekshiruv xato MATNINI yoki
 * `null` qaytaradi. Natija — { maydon: "xato" } yoki bo'sh obyekt.
 */
export function validate(values, rules) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const err = check(values[field], values);
      if (err) { errors[field] = err; break; }
    }
  }
  return errors;
}

export const required = (msg) => (v) =>
  v === null || v === undefined || String(v).trim() === "" ? msg : null;

export const positive = (msg) => (v) =>
  v === "" || v === null || v === undefined ? null : (Number(v) > 0 ? null : msg);

export const notNegative = (msg) => (v) =>
  v === "" || v === null || v === undefined ? null : (Number(v) >= 0 ? null : msg);

export const between = (lo, hi, msg) => (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? null : msg;
};

export const minLen = (n, msg) => (v) => (String(v ?? "").length >= n ? null : msg);
