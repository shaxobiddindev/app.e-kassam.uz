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
  /* ⚠ `decimals === 0` DA NUQTA HECH QACHON CHIQMAYDI. Ilgari xom
     qiymat «7249.99» bo'lsa (server 2 kasr bilan yuborgan ball)
     kasr kesilar-u NUQTA qolardi va maydonda «7 249.» degan chala
     raqam turardi — do'kon egasi aynan shuni ko'rsatdi. Butun son
     maydonida nuqtaning o'rni yo'q, «yozilayotgan» holat ham yo'q. */
  const f = frac === undefined || decimals === 0 ? null : String(frac).slice(0, decimals);
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
  /* ⚠⚠ `+998` PREFIKSI ANIQ OLIB TASHLANADI (foydalanuvchi shikoyati:
     «telefon raqamni o'zgartirmoqchi bo'lsa xato ishlayapti»).

     Niqob o'z natijasini (`raw` = `+998` + raqamlar) qayta o'qiydi.
     Ilgari kod FAQAT raqamlar soni 9 dan oshganda kesilardi — bu esa
     raqam TO'LIQ bo'lganda to'g'ri ishlab, qisqarganda buzilardi:
     abonent raqami 6 xonaga tushganda `+998901234` da atigi 9 ta raqam
     qoladi, «998» kesilmaydi va u ABONENT raqamiga aylanib ketadi
     («(99) 890-12-34»). Ya'ni odam raqamni o'chira boshlasa, u
     qisqarish o'rniga O'ZGARIB ketardi. */
  let str = String(input ?? "").trim();
  if (str.startsWith("+998")) str = str.slice(4);

  let d = onlyDigits(str);
  /* ⚠ Kod (`+998`) MAYDONNING O'ZIDA EMAS — u yonidagi o'zgarmas
     yorliqda (`PhoneField`). Shuning uchun bu yerda kod faqat odam uni
     O'ZI yozgan yoki to'liq raqamni joylashtirgan holda uchraydi, ya'ni
     raqamlar soni 9 tadan oshganda. Ilgari kod HAR DOIM kesilardi va
     maydonda `+998` turgani uchun odam to'liq raqam yozsa (998901234567)
     kod ikkinchi marta ABONENT raqami bo'lib tushardi: jimgina
     «(99) 890-12-34» saqlanardi. */
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  if (d.length > 9 && d.startsWith("8"))   d = d.slice(1);
  d = d.slice(0, 9);                                  // operator kodi + 7 raqam

  let display = "";
  if (d.length > 0) display = "(" + d.slice(0, 2);
  if (d.length >= 2) display += ")";
  if (d.length > 2) display += " " + d.slice(2, 5);
  if (d.length > 5) display += "-" + d.slice(5, 7);
  if (d.length > 7) display += "-" + d.slice(7, 9);

  return {
    raw: d.length ? "+998" + d : "",
    display,
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

/* ── Sana ────────────────────────────────────────────────────────────── */

/**
 * `YYYY-MM-DD` — mahsulotning hamma joyidagi sana ko'rinishi.
 *
 * ⚠ `<input type="date">` ATAYLAB ISHLATILMAYDI: uning ko'rinishi
 * BRAUZER tiliga bog'liq. Ingliz tilidagi Chrome'da u `08/13/2026` deb
 * chiqadi, hisobot jadvalida esa `2026-08-13` turadi — bitta ekranda
 * ikki xil sana formati. Kalendar tugmasi `showPicker()` orqali
 * saqlanadi (qo'llab-quvvatlanmasa, qo'lda yozish baribir ishlaydi).
 */
export function dateInput(v) {
  const d = onlyDigits(v).slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += "-" + d.slice(4, 6);
  if (d.length > 6) out += "-" + d.slice(6, 8);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   SANA: KO'RSATISH FORMATI ≠ SAQLASH FORMATI

   Odam sanani `31-01-2026` deb o'qiydi, server esa `2026-01-31` kutadi
   (`LocalDate`). Ilgari maydonda ISO turardi va omborchi «2026-01-31» ni
   ko'rib, qaysi raqam kun ekanini bir zum o'ylab qolardi.

   ⚠ SAQLANADIGAN QIYMAT O'ZGARMADI. Faqat ko'rinish o'zgardi — API ham,
   `isDate` tekshiruvi ham, brauzer kalendari ham avvalgidek ISO bilan
   ishlaydi. Aks holda to'rtta sahifadagi har bir chaqiruvni qayta yozish
   kerak bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Yozilayotgan matnni `DD-MM-YYYY` qolipiga soladi. */
export function dateDisplayInput(v) {
  const d = onlyDigits(v).slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "-" + d.slice(2, 4);
  if (d.length > 4) out += "-" + d.slice(4, 8);
  return out;
}

/**
 * Sana HAQIQIYmi (ISO ko'rinishida).
 *
 * ⚠ `new Date` ning o'zi yetmaydi: u `2026-02-30` ni 2-martga «tuzatib»
 * yuboradi. Shuning uchun natija qaytadan solishtiriladi.
 */
/**
 * Kiritilayotgan sanadagi xato — DARHOL, oxirigacha yozilishini kutmasdan.
 *
 * ⚠ NEGA QISMLAB TEKSHIRILADI. «32» ni yozgan odam yil raqamini ham
 * yozib bo'lgunicha kutib turishi shart emas — xato o'sha ikki raqamda
 * allaqachon ma'lum. Sakkizta raqam to'lguncha jim turish esa aynan
 * shu kutishni yaratardi.
 *
 * ⚠ YARIM YOZILGANI XATO EMAS. «3», «30-0» — hali tugallanmagan, xolos.
 * Har bosishda qizil ko'rsatish yozishning o'ziga xalaqit berardi.
 */
export function dateInputError(display) {
  const d = onlyDigits(display);
  if (d.length >= 2) {
    const day = Number(d.slice(0, 2));
    if (day < 1 || day > 31) return true;
  }
  if (d.length >= 4) {
    const mon = Number(d.slice(2, 4));
    if (mon < 1 || mon > 12) return true;
  }
  // Sakkizta raqam to'lgach — kalendar bo'yicha (30-fevral kabi hollar).
  if (d.length === 8) return !displayDateToIso(display);
  return false;
}

export const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""))) return false;
  const [y, m, day] = String(s).split("-").map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
};

/** `2026-01-31` → `31-01-2026`. To'liq bo'lmasa — bo'sh satr. */
export function isoToDisplayDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * `31-01-2026` → `2026-01-31`. To'liq YOKI HAQIQIY bo'lmasa — bo'sh satr.
 *
 * ⚠ Bo'sh satr ATAYLAB: yarim yozilgan sana serverga yuborilmasligi
 * kerak. «31-01» dan yil chiqmaydi va uni taxmin qilish xato bo'lardi.
 *
 * ⚠ MAVJUD BO'LMAGAN SANA HAM BO'SH QAYTARADI. `32-09-2026` yoki
 * `30-02-2026` — raqamlari to'g'ri joyda turibdi-yu, bunday kun yo'q.
 * Ilgari u ISO ga aylantirilib yuqoriga uzatilardi va xato faqat
 * serverdan qaytardi — omborchi «Saqlash» ni bosgandan keyin.
 * Endi qiymat CHIQMAYDI, maydon esa darhol ogohlantiradi.
 */
export function displayDateToIso(display) {
  const d = onlyDigits(display);
  if (d.length !== 8) return "";
  const iso = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  return isDate(iso) ? iso : "";
}

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
