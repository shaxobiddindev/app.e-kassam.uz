/* ══════════════════════════════════════════════════════════════════════════
   BARKODNI CHIZISH — EAN-13 va EAN-8 (V108)

   ═══ NEGA KERAK ════════════════════════════════════════════════════════

   Javon yorlig'i shu paytgacha FAQAT `.exe` da chiqarilardi: baytlar
   chek printeriga yuborilar, barkodni printerning O'ZI chizardi
   (`ESC/POS GS k`). Brauzerda va Androidda esa printer yo'q, ya'ni
   yorliq umuman chiqmasdi.

   Qog'ozga (A4 varaqqa) chiqarish uchun barkodni O'ZIMIZ chizishimiz
   kerak — brauzerda uni chizadigan hech narsa yo'q.

   ═══ NEGA KUTUBXONA EMAS ═══════════════════════════════════════════════

   `npm` dan barkod kutubxonasi olish mumkin edi. Olinmadi:

     · ilova UCH joyda quriladi (veb, Tauri `.exe`, Capacitor APK) va
       har yangi bog'liqlik uchalasida ham yangi xavf;
     · EAN standarti O'ZGARMAYDI — 1977 dan beri bir xil, ya'ni
       yangilanish kerak bo'lmaydigan yuz qatorlik kod;
     · nazorat raqami mantig'i loyihada ALLAQACHON bor
       (`ek-store-code.js`, serverda `BarcodeCheck`) va kutubxona
       o'zinikini olib kelib, ikkinchi haqiqat manbasi bo'lardi.

   ═══ ⚠ NOTO'G'RI BARKOD CHIZILMAYDI ════════════════════════════════════

   Nazorat raqami noto'g'ri bo'lsa, `null` qaytadi. Sabab: javonga
   yopishtirilgan, skaner O'QIY OLMAYDIGAN barkod — barkodsiz
   yorliqdan YOMONROQ. Kassir uni skanerlab ko'radi, ishlamaydi,
   qaytadan urinadi va oxirida qo'lda qidiradi. Yo'qligi darrov
   ko'rinadi, ishlamasligi esa har safar vaqt yeydi.

   ═══ O'LCHAM: MODUL ════════════════════════════════════════════════════

   Barkodning eng ingichka chizig'i — bitta «modul». EAN-13 da 95 ta,
   EAN-8 da 67 ta modul bor. Chizmaning kengligi shu sondan kelib
   chiqadi, ya'ni yorliq qanchalik kichik bo'lsa ham nisbat buzilmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/* Chap tomon, TOQ juftlik (L) — 0 oq, 1 qora. */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011",
           "0110001", "0101111", "0111011", "0110111", "0001011"];

/* Chap tomon, JUFT juftlik (G) — L ning teskarisi va aynalgani. */
const G = ["0100111", "0110011", "0011011", "0100001", "0011101",
           "0111001", "0000101", "0010001", "0001001", "0010111"];

/* O'ng tomon (R) — L ning inkori. */
const R = ["1110010", "1100110", "1101100", "1000010", "1011100",
           "1001110", "1010000", "1000100", "1001000", "1110100"];

/* ⚠ EAN-13 NING BIRINCHI RAQAMI CHIZILMAYDI. U chap tomondagi olti
   raqamning L/G tartibi bilan «yashiringan» holda kodlanadi — shuning
   uchun EAN-13 da 12 ta raqam chiziladi-yu, 13 tasi o'qiladi. */
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
                "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const GUARD_SIDE = "101";
const GUARD_MID  = "01010";

/**
 * GS1 «modulo 10» nazorat raqami — tanadan (oxirgi raqamsiz).
 *
 * ⚠ VAZN OXIRIDAN sanaladi. Boshidan sanash EAN-13 da to'g'ri natija
 * beradi-yu, EAN-8 da NOTO'G'RI beradi — serverdagi `StoreCode` da
 * aynan shu izoh turibdi va bu yerda ham amal qiladi.
 */
function checkDigit(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(i) - 48;
    sum += d * (((body.length - i) % 2 === 1) ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Faqat raqamdan iborat va nazorat raqami to'g'ri kelgan kodmi. */
export function eanValid(code) {
  const s = String(code || "").trim();
  if (s.length !== 8 && s.length !== 13) return false;
  if (!/^\d+$/.test(s)) return false;
  return checkDigit(s.slice(0, -1)) === (s.charCodeAt(s.length - 1) - 48);
}

/**
 * Kodni modul satriga aylantiradi: «101…101», har belgi bitta modul.
 * Yaroqsiz kodda `null`.
 */
export function eanModules(code) {
  const s = String(code || "").trim();
  if (!eanValid(s)) return null;

  if (s.length === 8) {
    let out = GUARD_SIDE;
    for (let i = 0; i < 4; i++) out += L[s.charCodeAt(i) - 48];
    out += GUARD_MID;
    for (let i = 4; i < 8; i++) out += R[s.charCodeAt(i) - 48];
    return out + GUARD_SIDE;
  }

  const parity = PARITY[s.charCodeAt(0) - 48];
  let out = GUARD_SIDE;
  for (let i = 1; i <= 6; i++) {
    const d = s.charCodeAt(i) - 48;
    out += parity[i - 1] === "L" ? L[d] : G[d];
  }
  out += GUARD_MID;
  for (let i = 7; i <= 12; i++) out += R[s.charCodeAt(i) - 48];
  return out + GUARD_SIDE;
}

/* Qorong'i chiziqlar guruhlarini topadi: [boshlanishi, kengligi]. */
function bars(modules) {
  const out = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let j = i;
      while (j < modules.length && modules[j] === "1") j++;
      out.push([i, j - i]);
      i = j;
    } else i++;
  }
  return out;
}

/**
 * Barkodni SVG qilib qaytaradi (`<svg …>…</svg>` satri).
 *
 * ⚠ SVG, RASM EMAS. Chop etishda brauzer uni qog'ozning O'Z
 * aniqligida chizadi: 203 dpi stikerda ham, 600 dpi lazerda ham
 * chiziqlar tiniq qoladi. PNG bo'lsa, kattalashtirilganda chetlari
 * yoyilib, skaner o'qiy olmay qolardi.
 *
 * @param {string} code    EAN-8 yoki EAN-13
 * @param {object} opts
 *        height  — chiziqlar balandligi (SVG birligida, standart 40)
 *        showText — ostida raqamlar yozilsinmi (standart: ha)
 * @returns {string|null} yaroqsiz kodda `null`
 */
export function eanSvg(code, { height = 40, showText = true } = {}) {
  const modules = eanModules(code);
  if (!modules) return null;

  const s = String(code).trim();
  const n = modules.length;                 // 67 yoki 95
  const textH = showText ? 9 : 0;
  /* ⚠ QO'RIQLOVCHI CHIZIQLAR UZUNROQ — bu bezak emas, STANDART talabi:
     skaner shu uzun chiziqlardan kodning chegarasini topadi. */
  const guardExtra = showText ? 5 : 0;
  const h = height + guardExtra + textH;

  /* Qo'riqlovchi modul o'rinlari — chetdagi ikkitasi va o'rtadagisi. */
  const mid = s.length === 8 ? 31 : 45;
  const isGuard = (x) => x < 3 || x >= n - 3 || (x >= mid && x < mid + 5);

  let rects = "";
  for (const [x, w] of bars(modules)) {
    const tall = isGuard(x);
    rects += `<rect x="${x}" y="0" width="${w}" `
           + `height="${height + (tall ? guardExtra : 0)}" fill="#000"/>`;
  }

  let text = "";
  if (showText) {
    /* ⚠ RAQAMLAR JOYLASHUVI STANDART BO'YICHA: EAN-13 da birinchi
       raqam chizmadan CHAPDA turadi (u chiziqlar bilan emas,
       juftlik bilan kodlangan), qolganlari esa o'z yarmi ostida. */
    const y = h - 1;
    const put = (str, cx, anchor = "middle") =>
      `<text x="${cx}" y="${y}" font-family="monospace" font-size="9" `
      + `text-anchor="${anchor}">${str}</text>`;
    if (s.length === 13) {
      text += put(s[0], -1, "end");
      text += put(s.slice(1, 7), 3 + 21);
      text += put(s.slice(7), mid + 5 + 21);
    } else {
      text += put(s.slice(0, 4), 3 + 14);
      text += put(s.slice(4), mid + 5 + 14);
    }
  }

  /* ⚠ `viewBox` CHAPDA -8: EAN-13 ning birinchi raqami chizmadan
     tashqarida yoziladi va usiz kesilib qolardi. */
  const x0 = (showText && s.length === 13) ? -8 : 0;
  return `<svg viewBox="${x0} 0 ${n - x0} ${h}" `
       + `preserveAspectRatio="xMidYMid meet" role="img" `
       + `aria-label="${s}">${rects}${text}</svg>`;
}
