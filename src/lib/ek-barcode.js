/* ══════════════════════════════════════════════════════════════════════════
   Code 128B kodlagichi — chek raqami uchun

   NEGA CODE 128, QR EMAS: do'konlardagi skanerlar deyarli hammasi bir
   o'lchovli lazerli va QR ni UMUMAN o'qimaydi. Code 128 esa har qanday
   skanerda ishlaydi — ya'ni kassa yangi apparat sotib olmasligi kerak.

   NEGA B varianti: chek raqamida harf ham bor (`S-000123`). C varianti
   faqat raqam bilan ishlaydi, A esa kichik harflarni qo'llab-quvvatlamaydi.

   ⚠ Tashqi kutubxona ATAYLAB ishlatilmadi: `.exe` da CSP tashqi manbalarni
   to'sadi va bitta jadval uchun bog'liqlik olib kelish oqlanmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Code 128 naqshlari: har biri 6 ta kenglik (chiziq, oraliq, chiziq, …).
 * Indeks — belgi qiymati. 103=Start A, 104=Start B, 105=Start C, 106=Stop.
 */
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_B = 104;
const STOP    = 106;

/**
 * Matnni chiziq kengliklari ketma-ketligiga aylantiradi.
 *
 * Qaytadi: `[{ bar: true|false, width: 1..4 }]` — chizishga tayyor.
 * Qo'llab-quvvatlanmaydigan belgi bo'lsa `null` (chaqiruvchi barkodsiz
 * davom etadi — chek baribir chiqishi kerak).
 */
export function code128(text) {
  const s = String(text ?? "");
  if (!s) return null;

  const values = [];
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    // Code 128B: ASCII 32..127
    if (code < 32 || code > 127) return null;
    values.push(code - 32);
  }

  /* Nazorat belgisi: start + Σ(qiymat × o'rni), 103 ga bo'lgandagi qoldiq.
     O'rin 1 dan boshlanadi — bu standartning talabi va eng ko'p xato
     qilinadigan joy. */
  let sum = START_B;
  values.forEach((v, i) => { sum += v * (i + 1); });
  const check = sum % 103;

  const seq = [START_B, ...values, check, STOP];

  const bars = [];
  for (const v of seq) {
    const pattern = PATTERNS[v];
    for (let i = 0; i < pattern.length; i++) {
      bars.push({ bar: i % 2 === 0, width: Number(pattern[i]) });
    }
  }
  return bars;
}

/**
 * Chop etishga tayyor SVG.
 *
 * ⚠ SVG, canvas EMAS: chop etishda canvas ekran zichligida rastrga
 * aylanadi va chiziqlar xiralashadi — skaner esa aniq chetni talab
 * qiladi. SVG printerning o'z zichligida chiziladi.
 *
 * `unit` — bitta modulning kengligi (mm). 0.3 mm chek printerlari uchun
 * ishonchli qiymat: undan kichigi 203 dpi boshda yoyilib ketadi.
 */
export function code128Svg(text, { height = 12, unit = 0.3, quiet = 3 } = {}) {
  const bars = code128(text);
  if (!bars) return "";

  const total = bars.reduce((n, b) => n + b.width, 0);
  const width = total * unit + quiet * 2;

  let x = quiet;
  let rects = "";
  for (const b of bars) {
    const w = b.width * unit;
    if (b.bar) {
      rects += `<rect x="${round(x)}" y="0" width="${round(w)}" height="${height}" fill="#000"/>`;
    }
    x += w;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}mm" height="${height}mm" `
       + `viewBox="0 0 ${round(width)} ${height}" shape-rendering="crispEdges">${rects}</svg>`;
}

const round = (n) => Math.round(n * 1000) / 1000;

/** Chek raqami → skanerlanadigan kod. */
export const saleCode = (saleId) => `S-${String(saleId).padStart(6, "0")}`;

/** Skanerlangan kod chek raqamimi va qaysi sotuvniki. */
export function parseSaleCode(code) {
  const m = /^S-(\d{1,12})$/.exec(String(code || "").trim().toUpperCase());
  return m ? Number(m[1]) : null;
}
