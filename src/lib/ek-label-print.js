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
import { renderSheet, renderLabel, layoutLabel } from "./ek-label-render.js";
import { mmToDots, supportsBytes, toTSPLRaster, toZPL } from "./ek-label-bytes.js";

/** Standart varaqlar (mm). */
export const PAGES = {
  A4: { widthMm: 210, heightMm: 297, label: "A4" },
  A5: { widthMm: 148, heightMm: 210, label: "A5" },
};

/* ══════════════════════════════════════════════════════════════════════
   QAYERGA CHIQADI — RULON YOKI VARAQ (2026-10-03)

   ⚠ ILGARI CHOP ETISH HAR DOIM A4 EDI. Sozlash sehrgari qog'oz va
   printerni serverga saqlardi (G2–G4), lekin «Chop etish» tugmasi
   ularni O'QIMASDI: `sheetFor(template, PAGES.A4)` qattiq yozilgan
   edi. Natija — do'konchi «Rulon 58×40 + Xprinter» ni tanlab qo'ygan,
   chop etish oynasi esa A4 varaq va standart (ofis yoki chek) printer
   bilan ochilardi. Yorliq printerini qo'lda tanlasa ham drayver A4
   sahifani olib, butun varaqni 58×40 ga kichraytirardi yoki bo'sh
   yorliqlarni ketma-ket chiqarib yuborardi.

   Endi qog'oz profili HAL QILADI:
     · VARAQ (A4/A5)      → `sheet`: to'r, faqat shu tanlansa;
     · RULON / FANFOLD    → bayt yo'li yoki drayver yo'li;
     · qog'oz tanlanmagan → drayver yo'li DIZAYN O'LCHAMIDA.
       ⚠ A4 GA QAYTILMAYDI: sozlanmagan do'konda ham stiker o'z
       o'lchamida chiqsin — A4 yopishqoq varaq kamdan-kam narsa.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * @param media    qog'oz profili yoki null
 * @param printer  printer profili yoki null
 * @param env      {desktop, queue} — ish stoli ilovasimi va Windows
 *                 navbati tanlanganmi
 * @returns {"sheet"|"bytes"|"driver"}
 */
export function outputMode(media, printer, env = {}) {
  if (media && String(media.mediaType) === "VARAQ") return "sheet";
  /* ⚠ BAYT YO'LI UCHUN UCHALASI SHART. Navbat tanlanmagan bo'lsa
     baytlar standart printerga ketardi va TSPL matni A4 ofis
     printeridan varaq-varaq bo'lib chiqardi (`printRawLabel` izohi). */
  if (env.desktop && env.queue && printer && supportsBytes(printer.lang)) return "bytes";
  return "driver";
}

/** VARAQ profilining sahifasi; o'lchami yo'q bo'lsa A4. */
export function pageOf(media) {
  const w = Number(media?.pageWidthMm), h = Number(media?.pageHeightMm);
  return w > 0 && h > 0 ? { widthMm: w, heightMm: h, label: media.name || "" } : PAGES.A4;
}

/**
 * Rulondagi bitta QATOR: `across` ta yorliq yonma-yon.
 *
 * ⚠ DIZAYN KATAKNING O'RTASIGA QO'YILADI. 40×30 dizayn 58×40 rulonda
 * chap-yuqori burchakka taqalib qolsa, yorliq qiyshiq yopishtirilgandek
 * ko'rinadi. Dizayn qog'ozdan katta bo'lsa siljish 0 — buni
 * `validateOutput` allaqachon to'sadi.
 *
 * ⚠ UZLUKSIZ LENTADA BALANDLIK QOG'OZ PROFILIDAN, u yo'q bo'lsa
 * dizayndan: printer yorliq qayerda tugashini o'zi bilmaydi.
 */
export function rollFor(template, media) {
  const tw = Number(template?.widthMm) || 0;
  const th = Number(template?.heightMm) || 0;
  if (!(tw > 0 && th > 0)) return null;
  const lw = Number(media?.labelWidthMm) || tw;
  const lh = Number(media?.labelHeightMm) || th;
  const across = Math.max(1, Math.round(Number(media?.across) || 1));
  const gapXMm = across > 1 ? Number(media?.gapXMm) || 0 : 0;
  return {
    labelWidthMm: lw, labelHeightMm: lh, across, gapXMm,
    rowWidthMm: lw * across + (across - 1) * gapXMm,
    rowHeightMm: lh,
    insetXMm: Math.max(0, (lw - tw) / 2),
    insetYMm: Math.max(0, (lh - th) / 2),
  };
}

/**
 * Yorliqlarni qatorlarga bo'ladi va KETMA-KET bir xil qatorlarni
 * bittaga yig'adi (`copies`).
 *
 * ⚠ YIG'ISH BAYT YO'LI UCHUN: bitta tovardan 50 ta yorliq — 50 marta
 * rasm yuborish emas, bitta rasm va `PRINT 50`. Aks holda 18 KB × 50
 * printer xotirasini to'ldirib, chop etish o'rtada to'xtardi.
 */
export function rollRows(items, across = 1) {
  const cells = [];
  for (const it of items || []) {
    const n = Math.max(1, Number(it.quantity) || 1);
    for (let i = 0; i < n; i++) cells.push(it);
  }
  const rows = [];
  for (let i = 0; i < cells.length; i += across) {
    const row = cells.slice(i, i + across);
    const key = row.map((c) => c.product?.id ?? c.lineId ?? "?").join("|");
    const last = rows[rows.length - 1];
    if (last && last.key === key) last.copies += 1;
    else rows.push({ key, cells: row, copies: 1 });
  }
  return rows;
}

const r3 = (n) => (Math.round(n * 1000) / 1000).toString();
const stripSvg = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

/** Bitta qatorning SVG si (mm da) va ogohlantirishlar. */
function rowSvg(template, row, roll, ctx, renderCtx = {}) {
  const parts = [];
  const warnings = [];
  row.cells.forEach((cell, i) => {
    const x = i * (roll.labelWidthMm + roll.gapXMm) + roll.insetXMm;
    const { svg, warnings: ws } = renderLabel(template, cell.product, { ...ctx, ...renderCtx });
    for (const w of ws) warnings.push({ ...w, productId: cell.product?.id });
    parts.push(`<g transform="translate(${r3(x)},${r3(roll.insetYMm)})">${stripSvg(svg)}</g>`);
  });
  const W = roll.rowWidthMm, H = roll.rowHeightMm;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(W)}mm" height="${r3(H)}mm"`
    + ` viewBox="0 0 ${r3(W)} ${r3(H)}"><rect x="0" y="0" width="${r3(W)}" height="${r3(H)}"`
    + ` fill="#fff"/>${parts.join("")}</svg>`;
  return { svg, warnings };
}

/**
 * DRAYVER YO'LI — brauzer chop etish oynasi, sahifa = YORLIQ.
 *
 * ⚠ HAR QATOR — ALOHIDA SAHIFA, `@page` esa aynan qator o'lchamida.
 * Yorliq printerining drayveri bitta sahifani bitta yorliq deb oladi:
 * sahifa A4 bo'lsa u butun varaqni kichraytirib bitta yorliqqa
 * tiqardi. Drayver yo'lida bundan boshqa nazorat yo'q — printer va
 * masshtabni chop etish oynasida odam tanlaydi.
 *
 * ⚠ SILJISH DRAYVER YO'LIDA HAM ISHLAYDI: «yozuv 2 mm pastga
 * surilgan» muammosi printerga bog'liq, yo'lga emas.
 */
export function buildRollDoc(template, items, media, opts = {}) {
  const { ctx = {}, printer = null } = opts;
  const roll = rollFor(template, media);
  if (!roll) return null;

  const ox = Number(printer?.offsetXMm) || 0;
  const oy = Number(printer?.offsetYMm) || 0;
  const W = roll.rowWidthMm, H = roll.rowHeightMm;
  const pages = [];
  const warnings = [];
  let cellCount = 0;

  for (const row of rollRows(items, roll.across)) {
    const { svg, warnings: ws } = rowSvg(template, row, roll, ctx);
    warnings.push(...ws);
    const shifted = ox || oy
      ? svg.replace(/(<rect[^>]*\/>)/, `$1<g transform="translate(${r3(ox)},${r3(oy)})">`)
           .replace(/<\/svg>$/, "</g></svg>")
      : svg;
    for (let c = 0; c < row.copies; c++) {
      pages.push(`<div class="lp-page">${shifted}</div>`);
      cellCount += row.cells.length;
    }
  }

  const css = `
    @page { size: ${r3(W)}mm ${r3(H)}mm; margin: 0 }
    html, body { margin: 0; padding: 0; background: #fff }
    .lp-page { width: ${r3(W)}mm; height: ${r3(H)}mm;
               page-break-after: always; break-after: page; overflow: hidden }
    .lp-page:last-child { page-break-after: auto; break-after: auto }
    svg { display: block }
  `;
  return {
    html: pages.join(""), css, pages: pages.length, warnings, cellCount,
    page: { widthMm: W, heightMm: H },
  };
}

/**
 * BAYT YO'LI — TSPL yoki ZPL, oyna ochilmaydi.
 *
 * ⚠ RASTERLOVCHI PARAMETR (`raster`): u DOM talab qiladi, bu modul
 * esa Node'da sinaladi. Haqiqiy chaqiruvchi `ek-label-raster.js` ni
 * beradi, sinov — soxtasini.
 *
 * ⚠ ZPL DA RASM YO'Q: Zebra'ning `^A0` shrifti masshtablanadi va
 * `^CI28` bilan UTF-8 ni biladi, ya'ni TSPL dagi ikki muammo u yerda
 * yo'q. Qatorning joylashuvi esa AYNAN o'sha `layoutLabel` dan.
 *
 * @returns {Promise<Uint8Array>}
 */
export async function buildRollBytes(template, items, media, printer, opts = {}) {
  const { ctx = {}, raster } = opts;
  const roll = rollFor(template, media);
  if (!roll) throw new Error("Yorliq o'lchami noma'lum");
  const lang = String(printer?.lang || "").toUpperCase();
  const dpi = Number(printer?.dpi) || 203;
  const enc = new TextEncoder();
  const chunks = [];

  for (const row of rollRows(items, roll.across)) {
    /* Qatordagi har yorliqning elementlari — qator koordinatasiga
       siljitilgan. Bayt yo'li ham, rasm ham shu bitta hisobdan. */
    const moved = [];
    row.cells.forEach((cell, i) => {
      const dx = i * (roll.labelWidthMm + roll.gapXMm) + roll.insetXMm;
      const dy = roll.insetYMm;
      for (const it of layoutLabel(template, cell.product, ctx).items) {
        moved.push({ ...it, x: it.x + dx, y: it.y + dy });
      }
    });

    if (lang === "ZPL") {
      const text = toZPL({ widthMm: roll.rowWidthMm, heightMm: roll.rowHeightMm, items: moved },
        { dpi, media, printer, copies: row.copies });
      chunks.push(enc.encode(text.replace("^XA\n", "^XA\n^CI28\n")));
      continue;
    }
    if (lang !== "TSPL") throw new Error(`${lang || "?"} tili uchun bayt yo'li yo'q`);
    if (typeof raster !== "function") throw new Error("Rasterlovchi berilmadi");

    const { svg } = rowSvg(template, row, roll, ctx, { omit: ["barcode"] });
    const bitmap = await raster(svg, mmToDots(roll.rowWidthMm, dpi), mmToDots(roll.rowHeightMm, dpi));
    chunks.push(toTSPLRaster({
      widthMm: roll.rowWidthMm, heightMm: roll.rowHeightMm, bitmap,
      barcodes: moved.filter((it) => it.kind === "barcode"),
      dpi, media, printer, copies: row.copies,
    }));
  }

  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

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
