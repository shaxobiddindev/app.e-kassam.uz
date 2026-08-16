/* ══════════════════════════════════════════════════════════════════════════
   QR kod — SVG chizuvchi

   ⚠ NEGA BU YERDA KUTUBXONA ISHLATILDI (Code128 da ishlatilmagan bo'lsa
   ham): QR — Reed-Solomon xato tuzatuvchi kodlash, versiya/niqob tanlash
   va format bitlarini talab qiladi; Code128 esa oddiy jadval. Qo'lda
   yozilgan QR jimgina buzilib, FAQAT skaner oldida ma'lum bo'lardi.
   `qrcode-generator` — bog'liqliksiz, o'n yildan beri o'zgarmagan paket.

   ⚠ CSP: bu npm paketi bundle ICHIGA kiradi, tashqi manbaga so'rov
   yubormaydi — ya'ni `.exe` (Tauri) va Android qobig'ida ham ishlaydi.
   ══════════════════════════════════════════════════════════════════════════ */
import qrcode from "qrcode-generator";

/**
 * Matndan QR SVG yasaydi.
 *
 * @param {string} text      kodlanadigan matn (odatda havola)
 * @param {object} [opts]
 * @param {number} [opts.size=240]     SVG o'lchami (px)
 * @param {number} [opts.margin=2]     chetdagi bo'sh modul soni (standart 4,
 *                                     lekin ekranda 2 yetarli va QR kattaroq
 *                                     ko'rinadi — skanerlash osonlashadi)
 * @param {string} [opts.fg="#000000"] modul rangi
 * @param {string} [opts.bg="#FFFFFF"] fon rangi
 * @returns {string} `<svg …>` matni
 */
export function qrSvg(text, opts = {}) {
  const { size = 240, margin = 2, fg = "#000000", bg = "#FFFFFF" } = opts;

  /* `0` — versiyani AVTOMATIK tanlash (matn uzunligiga qarab).
     `M` — 15% xato tuzatish: telefon ekranidan o'qishda barmoq izi va
     yorug'lik aksi bo'ladi, `L` (7%) esa bunga chidamaydi. `Q`/`H` esa
     kodni zichlashtirib, arzon kameralarga qiyinlashtiradi. */
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const total = count + margin * 2;

  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        // Har modul — alohida to'rtburchak. `shape-rendering: crispEdges`
        // modullar orasida oq chiziq paydo bo'lishiga yo'l qo'ymaydi.
        path += `M${c + margin} ${r + margin}h1v1h-1z`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" `
       + `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR">`
       + `<rect width="${total}" height="${total}" fill="${bg}"/>`
       + `<path d="${path}" fill="${fg}"/>`
       + `</svg>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   TOTP — do'kon QR kodining aylanuvchi qismi

   Server bilan BIR XIL algoritm (RFC 6238, HMAC-SHA1, 30 soniyalik qadam):
   backend `TotpService` shu kodni qayta hisoblab tekshiradi.

   ⚠ NEGA ILOVADA HISOBLANADI, SERVERDAN SO'RALMAYDI: do'konda internet
   uzilishi odatiy hol va butun tizim shunga qurilgan. Sir bir marta
   olinadi, keyin QR internetsiz ham yangilanaveradi.
   ══════════════════════════════════════════════════════════════════════════ */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 (RFC 4648, to'ldirishsiz) → baytlar. */
function base32Decode(secret) {
  const clean = String(secret || "").toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;               // notanish belgi — o'tkazib yuboriladi
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/**
 * Joriy TOTP kodini hisoblaydi (6 raqam).
 *
 * `crypto.subtle` asinxron — shuning uchun funksiya `Promise` qaytaradi.
 * Android WebView va Tauri'da ham mavjud (HTTPS/localhost kontekstida).
 */
export async function totpNow(secret, periodSeconds = 30, at = Date.now()) {
  const step = Math.floor(at / 1000 / periodSeconds);

  // 8 baytli katta-endian hisoblagich
  const counter = new Uint8Array(8);
  let rest = step;
  for (let i = 7; i >= 0; i--) {
    counter[i] = rest & 0xff;
    rest = Math.floor(rest / 256);
  }

  const key = await crypto.subtle.importKey(
    "raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));

  const offset = sig[sig.length - 1] & 0x0f;
  const binary = ((sig[offset] & 0x7f) << 24)
               | ((sig[offset + 1] & 0xff) << 16)
               | ((sig[offset + 2] & 0xff) << 8)
               | (sig[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

/** Joriy qadam tugashiga necha soniya qolgani — orqa hisob uchun. */
export function secondsLeft(periodSeconds = 30, at = Date.now()) {
  return periodSeconds - Math.floor(at / 1000) % periodSeconds;
}
