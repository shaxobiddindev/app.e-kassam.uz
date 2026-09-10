/**
 * ══════════════════════════════════════════════════════════════════════════
 * KALIBRLASH VARAG'I (F7) — MAJBURIY, VA MANA NEGA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ KOD QOG'OZDA NIMA CHIQQANINI BILA OLMAYDI. Brauzerning chop
 * etish oynasida «Masshtab: 100%» yoki «Sahifaga moslash» degan
 * sozlama bor va u YOQILGAN bo'lsa, 50 mm yorliq qog'ozda 47 mm
 * bo'lib chiqadi. JavaScript bu sozlamani na o'qiy oladi, na
 * o'zgartira oladi — brauzer buni ataylab bermaydi.
 *
 * Ya'ni bu muammoni kod HAL QILA OLMAYDI. Qila oladigan yagona
 * narsa — uni KO'RINADIGAN qilish: chizg'ich bilan o'lchanadigan
 * chiziq chiqarish. Chiziq 100 mm chiqsa sozlama to'g'ri, 94 mm
 * chiqsa — yo'q.
 *
 * ⚠ IKKALA O'Q HAM O'LCHANADI. Printerlar gorizontal va vertikal
 * masshtabni har xil buzishi mumkin (ayniqsa lentali printerlarda
 * qog'oz tortish tezligi tufayli). Faqat eniga chiziq qo'yish
 * muammoning yarmini ko'rsatardi.
 *
 * ⚠ BARKOD UCH XIL MODUL KENGLIGIDA. «Skaner o'qiydimi?» degan
 * savolga faqat SKANER javob beradi: bir do'konda 2 nuqtali barkod
 * ishlaydi, boshqasida — eskiroq skaner tufayli 3 nuqta kerak.
 * Uchalasi bir varaqda chiqsa, do'konchi o'zining skaneri bilan
 * bir marta tekshirib, keyin shablonda o'shani tanlaydi.
 */
import { barcodeSvgMm, barcodeMetrics, dotMm } from "./ek-label-barcode.js";
import { PAGES } from "./ek-label-print.js";

const r = (n) => (Math.round(n * 1000) / 1000).toString();

/** Namunaviy kod — nazorat raqami TO'G'RI EAN-13. */
export const SAMPLE_EAN = "4780000000007";

/**
 * Sinaladigan modul kengliklari (printer NUQTASIDA).
 *
 * ⚠ NUQTADA, MILLIMETRDA EMAS. Printer faqat butun nuqta chiza
 * oladi: 203 dpi da bitta nuqta 0,125 mm. «0,3 mm modul» so'ralsa
 * printer uni 2 yoki 3 nuqtaga yaxlitlaydi va barkod kengligi
 * kutilganidan farq qiladi — bu esa aynan skaner o'qimaydigan
 * holatga olib keladi.
 */
export const MODULE_DOTS = [2, 3, 4];

/** Chizg'ich chizig'i: `mm` uzunlikda, har 10 mm da bo'linma. */
function ruler(x, y, mm, vertical = false) {
  const out = [];
  const long = 3, short = 1.6;
  out.push(vertical
    ? `<line x1="${r(x)}" y1="${r(y)}" x2="${r(x)}" y2="${r(y + mm)}"
         stroke="#000" stroke-width="0.25"/>`
    : `<line x1="${r(x)}" y1="${r(y)}" x2="${r(x + mm)}" y2="${r(y)}"
         stroke="#000" stroke-width="0.25"/>`);

  for (let i = 0; i <= mm; i += 5) {
    const len = i % 10 === 0 ? long : short;
    out.push(vertical
      ? `<line x1="${r(x)}" y1="${r(y + i)}" x2="${r(x + len)}" y2="${r(y + i)}"
           stroke="#000" stroke-width="0.2"/>`
      : `<line x1="${r(x + i)}" y1="${r(y)}" x2="${r(x + i)}" y2="${r(y - len)}"
           stroke="#000" stroke-width="0.2"/>`);
    if (i % 50 === 0 && i > 0) {
      out.push(vertical
        ? `<text x="${r(x + long + 1)}" y="${r(y + i + 1)}" font-size="3"
             font-family="sans-serif" fill="#000">${i}</text>`
        : `<text x="${r(x + i - 3)}" y="${r(y - long - 1)}" font-size="3"
             font-family="sans-serif" fill="#000">${i}</text>`);
    }
  }
  return out.join("");
}

/** Burchak belgilari — qog'oz to'g'ri joylashganini ko'rsatadi. */
function corners(page, m) {
  const L = 8, W = page.widthMm, H = page.heightMm;
  const mark = (x, y, dx, dy) =>
    `<line x1="${r(x)}" y1="${r(y)}" x2="${r(x + dx * L)}" y2="${r(y)}"
       stroke="#000" stroke-width="0.3"/>`
    + `<line x1="${r(x)}" y1="${r(y)}" x2="${r(x)}" y2="${r(y + dy * L)}"
       stroke="#000" stroke-width="0.3"/>`;
  return mark(m, m, 1, 1) + mark(W - m, m, -1, 1)
       + mark(m, H - m, 1, -1) + mark(W - m, H - m, -1, -1);
}

/**
 * Kalibrlash varag'i.
 *
 * @param {{dpi?:number, page?:object, labels?:object}} opts
 * @returns {{html:string, css:string, rows:Array}} `rows` — sinovlar uchun
 */
export function calibrationDoc({ dpi = 203, page = PAGES.A4, labels = {} } = {}) {
  const M = 12;                 // chekka
  const parts = [corners(page, 6)];
  let y = M + 14;

  const title = labels.title || "Kalibrlash varag'i";
  const sub = labels.subtitle
    || "Chizg'ich bilan o'lchang. Uzunlik mos kelmasa, brauzerda masshtabni 100% qiling.";

  parts.push(`<text x="${r(M)}" y="${r(M + 4)}" font-size="5" font-weight="700"
    font-family="sans-serif" fill="#000">${esc(title)}</text>`);
  parts.push(`<text x="${r(M)}" y="${r(M + 10)}" font-size="3.2"
    font-family="sans-serif" fill="#000">${esc(sub)}</text>`);

  /* ── Gorizontal chizg'ichlar ─────────────────────────────────── */
  const rows = [];
  for (const mm of [100, 50]) {
    y += 12;
    parts.push(ruler(M, y, mm));
    parts.push(`<text x="${r(M + mm + 4)}" y="${r(y + 1)}" font-size="3.4"
      font-weight="700" font-family="sans-serif" fill="#000">${mm} mm</text>`);
    rows.push({ kind: "ruler", axis: "x", mm });
  }

  /* ── Vertikal chizg'ich ──────────────────────────────────────── */
  y += 10;
  const vTop = y;
  parts.push(ruler(M, vTop, 50, true));
  parts.push(`<text x="${r(M + 6)}" y="${r(vTop + 54)}" font-size="3.4"
    font-weight="700" font-family="sans-serif" fill="#000">50 mm ↕</text>`);
  rows.push({ kind: "ruler", axis: "y", mm: 50 });

  /* ── Barkodlar: uch modul kengligi ───────────────────────────── */
  let by = vTop + 62;
  for (const dots of MODULE_DOTS) {
    const opts = { dpi, moduleDots: dots, heightMm: 20, x: M, y: by, showText: true };
    const m = barcodeMetrics(SAMPLE_EAN, opts);
    const svg = barcodeSvgMm(SAMPLE_EAN, opts);
    if (!svg || !m) continue;

    parts.push(svg);
    parts.push(`<text x="${r(M + m.widthMm + 4)}" y="${r(by + 8)}" font-size="3.2"
      font-family="sans-serif" fill="#000">${dots} nuqta = ${
      r(Math.round(dots * dotMm(dpi) * 1000) / 1000)} mm</text>`);
    parts.push(`<text x="${r(M + m.widthMm + 4)}" y="${r(by + 12)}" font-size="3.2"
      font-family="sans-serif" fill="#000">eni ${m.widthMm.toFixed(1)} mm</text>`);
    rows.push({ kind: "barcode", dots, widthMm: m.widthMm, moduleMm: m.moduleMm });
    by += 26;
  }

  const hint = labels.hint
    || "Brauzerda: Masshtab — 100%, «Sahifaga moslash» O'CHIQ.";
  parts.push(`<text x="${r(M)}" y="${r(by + 6)}" font-size="3.4" font-weight="700"
    font-family="sans-serif" fill="#000">${esc(hint)}</text>`);
  parts.push(`<text x="${r(M)}" y="${r(by + 11)}" font-size="3.2"
    font-family="sans-serif" fill="#000">${esc(labels.dpi
      ? labels.dpi.replace("{dpi}", dpi) : `Printer zichligi: ${dpi} dpi`)}</text>`);

  const html = `<div class="lp-page"><svg xmlns="http://www.w3.org/2000/svg"`
    + ` width="${page.widthMm}mm" height="${page.heightMm}mm"`
    + ` viewBox="0 0 ${page.widthMm} ${page.heightMm}">${parts.join("")}</svg></div>`;

  const css = `
    @page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0 }
    html, body { margin: 0; padding: 0; background: #fff }
    .lp-page { width: ${page.widthMm}mm; height: ${page.heightMm}mm; overflow: hidden }
    svg { display: block }
  `;
  return { html, css, rows };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
