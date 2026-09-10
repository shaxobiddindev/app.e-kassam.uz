/**
 * ══════════════════════════════════════════════════════════════════════════
 * VARAQQA JOYLASH VA CHOP ETISH (F5)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CHIZISH BU YERDA YO'Q. Yorliqni faqat `ek-label-render.js`
 * chizadi — ko'rish oynasi ham, chop etish ham, PDF ham o'sha
 * yagona yo'ldan o'tadi. Bu fayl JOYLASHTIRADI: varaqni tanlaydi,
 * kataklarni hisoblaydi, chop etish hujjatini o'raydi.
 *
 * ⚠ TO'R O'LCHAMI HISOBLANADI, SO'RALMAYDI. Ilgari «katta / kichik»
 * degan ikkita tayyor o'lcham bor edi va shablon o'lchami ularga
 * to'g'ri kelmasa yorliq qiyshayardi. Endi varaqqa nechta ustun va
 * qator sig'ishini yorliqning O'ZI belgilaydi: do'konchi hech nima
 * hisoblamaydi, noto'g'ri hisoblash ham mumkin emas.
 *
 * ⚠ `@page` O'LCHAMI AYNAN. `size: A4` va `margin: 0` yozilmasa,
 * brauzer o'z chekkasini qo'shadi va 50 mm yorliq qog'ozda 47 mm
 * bo'lib chiqadi — ya'ni yopishqoq varaqning kataklariga tushmaydi.
 */
import { renderSheet } from "./ek-label-render.js";

/** Standart varaqlar (mm). */
export const PAGES = {
  A4: { widthMm: 210, heightMm: 297, label: "A4" },
  A5: { widthMm: 148, heightMm: 210, label: "A5" },
};

/**
 * Varaqqa nechta yorliq sig'adi.
 *
 * ⚠ CHEKKA VA ORALIQ QO'SHILADI, KEYIN BO'LINADI. «210 / 50 = 4,2 →
 * 4 ta» degan sodda hisob chekkani unutadi va oxirgi ustun qog'ozdan
 * chiqib ketadi. Formula: (varaq − 2×chekka + oraliq) / (yorliq + oraliq).
 */
export function sheetFor(template, page = PAGES.A4, opts = {}) {
  const { marginMm = 8, gapXMm = 2, gapYMm = 2 } = opts;
  const w = Number(template?.widthMm) || 0;
  const h = Number(template?.heightMm) || 0;
  if (!(w > 0 && h > 0)) return null;

  const usableW = page.widthMm - 2 * marginMm;
  const usableH = page.heightMm - 2 * marginMm;
  const cols = Math.max(0, Math.floor((usableW + gapXMm) / (w + gapXMm)));
  const rows = Math.max(0, Math.floor((usableH + gapYMm) / (h + gapYMm)));

  /* ⚠ SIG'MASA `null`: nol katakli varaq chizish o'rniga tugma
     bloklanadi va SABABI aytiladi (bo'sh qog'oz chiqarish eng
     bema'ni natija). */
  if (cols < 1 || rows < 1) return null;

  return {
    cols, rows, perPage: cols * rows,
    marginTopMm: marginMm, marginLeftMm: marginMm,
    gapXMm, gapYMm, page,
  };
}

/**
 * Chop etiladigan hujjat.
 *
 * @param items [{product, quantity}] — TARTIB SAQLANADI
 * @returns {{html, css, pages, warnings, cellCount}}
 */
export function buildPrintDoc(template, items, opts = {}) {
  const { startPosition = 1, ctx = {}, page = PAGES.A4, marginMm = 8,
          gapXMm = 2, gapYMm = 2 } = opts;
  const sheet = sheetFor(template, page, { marginMm, gapXMm, gapYMm });
  if (!sheet) return null;

  const { pages, warnings, cellCount } = renderSheet(template, items, {
    ...sheet, startPosition,
  });

  const svgs = pages.map((body) =>
    `<div class="lp-page"><svg xmlns="http://www.w3.org/2000/svg"`
    + ` width="${page.widthMm}mm" height="${page.heightMm}mm"`
    + ` viewBox="0 0 ${page.widthMm} ${page.heightMm}">${body}</svg></div>`
  ).join("");

  const css = `
    @page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0 }
    html, body { margin: 0; padding: 0; background: #fff }
    .lp-page { width: ${page.widthMm}mm; height: ${page.heightMm}mm;
               page-break-after: always; overflow: hidden }
    .lp-page:last-child { page-break-after: auto }
    svg { display: block }
  `;
  return { html: svgs, css, pages: pages.length, warnings, cellCount };
}

/**
 * Navbat qatorlaridan chop etish ro'yxati.
 *
 * ⚠ CHIQARILGANLARI TASHLAB KETILADI. «Qolganidan davom etish»
 * aynan shu bir qatorda yashaydi: chop etish uzilganda navbat
 * boshidan emas, TO'XTAGAN JOYIDAN davom etadi.
 */
export function pendingItems(job, productsById) {
  return (job?.lines || [])
    .filter((l) => !l.printedAt)
    .map((l) => ({
      lineId: l.id,
      quantity: Math.max(1, Number(l.quantity) || 1),
      product: productsById?.[l.productId] || {
        id: l.productId, name: l.productName,
        salePrice: l.salePrice, barcode: l.barcode, searchCode: l.code,
      },
    }));
}
