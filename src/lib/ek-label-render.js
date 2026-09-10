/**
 * ══════════════════════════════════════════════════════════════════════════
 * YAGONA RENDERER — KO'RISH VA CHOP ETISH BIR XIL YO'LDAN O'TADI (F2)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ BU FAYLNING BUTUN MA'NOSI SHU. Ko'rish oynasi va chop etish
 * uchun ikkita alohida chizuvchi bo'lsa, ko'rish oynasi ERTAMI-KECHMI
 * YOLG'ON GAPIRADI: ikkalasi asta-sekin ajralib ketadi va do'konchi
 * buni 200 ta yorliq chiqargandan keyin biladi. Shu loyihaning
 * o'zida bunday ajralish ikki marta bo'lgan (`ek-input.js` va
 * `ek-format.js`).
 *
 * Shuning uchun: (shablon + tovar) → SVG. Ko'rish oynasi shu SVG ni
 * ekranda ko'rsatadi, chop etish shu SVG ni varaqqa joylaydi, PDF
 * ham shuni oladi. Farq faqat O'RASHDA, chizishda emas.
 *
 * ⚠ O'LCHAM MILLIMETRDA. SVG `width="70mm"` deb chiqadi va ichkarida
 * `viewBox="0 0 70 37"` — ya'ni bitta SVG birligi = 1 mm. Brauzer
 * uni qog'ozda AYNAN 70 mm qilib chizadi (agar «sahifaga moslash»
 * o'chirilgan bo'lsa — buni kod aniqlay olmaydi, 10-bo'limdagi
 * kalibrlash varag'i shuning uchun bor).
 *
 * ⚠ DETERMINISTIK: bir xil kirish → BAYT DARAJASIDA bir xil chiqish.
 * Sana, tasodifiy id, `Math.random` yo'q. Sinov shuni tekshiradi.
 */
import { barcodeMetrics, barcodeSvgMm } from "./ek-label-barcode.js";
import { groupDigits } from "./ek-format.js";
import { productCode } from "./ek-code.js";

/** ⚠ Uch xona — bayt darajasidagi taqqoslash uchun barqaror. */
const r = (n) => (Math.round(n * 1000) / 1000).toString();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Matn kengligini BAHOLAYDI (mm).
 *
 * ⚠ BU O'LCHOV EMAS, BAHO — va shunday bo'lishi SHART. Haqiqiy
 * o'lchov DOM ni talab qiladi; DOM esa chop etish yo'lida ham,
 * sinovda ham yo'q. Agar ko'rish oynasi DOM bilan o'lchab, chop
 * etish baho bilan ishlasa — ikkalasi boshqa javob berardi va
 * yuqoridagi butun qoida buzilardi.
 *
 * 0,52 — sans-serif shriftlar uchun o'rtacha belgi kengligi
 * (shrift o'lchamiga nisbatan). Aniq emas, lekin BIR XIL.
 */
const PT_TO_MM = 0.352778;
const textWidthMm = (text, sizePt, weight = 400) =>
  String(text ?? "").length * sizePt * PT_TO_MM * (weight >= 700 ? 0.56 : 0.52);

/* ── Maydon qiymatlari ────────────────────────────────────────────────
   ⚠ Bitta joyda: yangi maydon qo'shish uchun shu jadvalga bitta qator
   qo'shiladi, renderer tanasiga tegilmaydi. */
const VALUE = {
  name:       (p) => p.name,
  nameShort:  (p) => p.nameShort || p.name,
  nameRu:     (p) => p.nameRu || p.name,
  price:      (p) => p.salePrice,
  oldPrice:   (p) => p.oldPrice,
  unitPrice:  (p) => p.salePrice,
  price100g:  (p) => (p.salePrice == null ? null : Number(p.salePrice) / 10),
  code:       (p) => productCode(p),
  barcode:    (p) => p.barcode,
  brand:      (p) => p.brand,
  country:    (p) => p.country,
  expiry:     (p) => p.expiryDate,
  producedAt: (p) => p.producedAt,
  size:       (p) => p.sizeLabel,
  color:      (p) => p.colorName,
  ingredients:(p) => p.ingredients,
  storage:    (p) => p.storageCondition,
  shopName:   (p, ctx) => ctx.shopName,
  discountBadge: () => null,
  qr:         (p, ctx) => ctx.qrUrl,
  punchHole:  () => null,
};

/**
 * Yorliqni chizadi.
 *
 * @param template {kind, widthMm, heightMm, dpi, thermal, spec}
 * @param product  tovar
 * @param ctx      {shopName, qrUrl, labels}
 * @returns {{svg: string, warnings: Array<{field, code, text}>}}
 */
/**
 * ══════════════════════════════════════════════════════════════════
 * JOYLASHUV — YAGONA HISOBLAGICH (G3)
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠ SVG VA PRINTER TILI BITTA MANBADAN CHIQADI. Brauzer yo'li
 * (HTML) va bayt yo'li (TSPL/ZPL) uchun ikkita alohida joylashuv
 * yozilsa, ular ALBATTA ayri tushadi: bugun bir xil, olti oydan
 * keyin biri 2 mm chapda. Va buni faqat ikkala yo'ldan ham chiqarib
 * ko'rgan odam biladi — ya'ni hech kim.
 *
 * Shuning uchun bu funksiya millimetrdagi ELEMENTLAR RO'YXATINI
 * qaytaradi, chizishni esa qilmaydi. `renderLabel` undan SVG
 * yasaydi, `ek-label-bytes.js` esa TSPL yoki ZPL.
 *
 * @returns {{widthMm, heightMm, items: Array, warnings: Array}}
 */
export function layoutLabel(template, product, ctx = {}) {
  const spec = typeof template.spec === "string"
    ? JSON.parse(template.spec) : (template.spec || {});
  const W = Number(template.widthMm);
  const H = Number(template.heightMm);
  const warnings = [];
  const items = [];

  const bg = spec.background || "#ffffff";
  items.push({ kind: "background", x: 0, y: 0, w: W, h: H, fill: bg });

  const bw = spec.border?.widthMm || 0;
  if (bw > 0) {
    items.push({ kind: "border", x: bw / 2, y: bw / 2, w: W - bw, h: H - bw,
                 stroke: spec.border.color || "#000", strokeWidthMm: bw });
  }

  for (const f of spec.fields || []) {
    if (f.visible === false) continue;
    const val = (VALUE[f.key] || (() => null))(product, ctx);
    const box = { key: f.key, x: Number(f.x), y: Number(f.y),
                  w: Number(f.w), h: Number(f.h) };

    if (f.key === "barcode") {
      const cfg = spec.barcode || {};
      const m = val ? barcodeMetrics(val, {
        dpi: template.dpi, moduleDots: cfg.moduleDots ?? 2,
        quietLeftModules: cfg.quietLeftModules ?? 9,
        quietRightModules: cfg.quietRightModules ?? 7,
        heightMm: f.h, labelKind: template.kind,
      }) : null;
      items.push({ ...box, kind: "barcode", value: val, field: f,
                   cfg, metrics: m, dpi: template.dpi,
                   showText: cfg.showText !== false });
      continue;
    }
    if (f.key === "punchHole") { items.push({ ...box, kind: "hole" }); continue; }
    if (f.key === "qr") { items.push({ ...box, kind: "qr", value: val }); continue; }

    if (val == null || val === "") continue;
    items.push({ ...box, kind: "text", value: val, field: f,
                 text: f.prefix ? f.prefix + String(val) : String(val),
                 sizePt: Number(f.size || 8), weight: Number(f.weight || 400),
                 align: f.align || "left", style: f.style || null });
  }

  return { widthMm: W, heightMm: H, items, warnings };
}

export function renderLabel(template, product, ctx = {}) {
  const spec = typeof template.spec === "string"
    ? JSON.parse(template.spec) : (template.spec || {});
  const { widthMm: W, heightMm: H, items, warnings } = layoutLabel(template, product, ctx);
  const parts = [];

  /* ⚠ CHIZISH JOYLASHUVDAN KEYIN: yuqoridagi ro'yxat qayerda
     ekanini aytadi, bu yer esa qanday ko'rinishini. */
  for (const it of items) {
    if (it.kind === "background") {
      parts.push(`<rect x="0" y="0" width="${r(it.w)}" height="${r(it.h)}" fill="${it.fill}"/>`);
      continue;
    }
    if (it.kind === "border") {
      parts.push(`<rect x="${r(it.x)}" y="${r(it.y)}" width="${r(it.w)}"`
        + ` height="${r(it.h)}" fill="none" stroke="${it.stroke}"`
        + ` stroke-width="${r(it.strokeWidthMm)}"/>`);
      continue;
    }
    if (it.kind === "barcode") {
      parts.push(drawBarcode(it.field, it.value, template, spec, warnings));
      continue;
    }
    if (it.kind === "hole") {
      parts.push(`<circle cx="${r(it.x + it.w / 2)}" cy="${r(it.y + it.h / 2)}"`
        + ` r="${r(Math.min(it.w, it.h) / 2)}" fill="none" stroke="#000"`
        + ` stroke-width="0.2" stroke-dasharray="0.8 0.8"/>`);
      continue;
    }
    if (it.kind === "qr") { parts.push(qrPlaceholder(it.field || it, it.value)); continue; }
    parts.push(drawText(it.field, it.value, warnings));
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r(W)}mm"`
    + ` height="${r(H)}mm" viewBox="0 0 ${r(W)} ${r(H)}">${parts.join("")}</svg>`;
  return { svg, warnings };
}

/* ── Barkod ──────────────────────────────────────────────────────────── */
function drawBarcode(f, value, template, spec, warnings) {
  const cfg = spec.barcode || {};
  if (!value) {
    warnings.push({ field: f.key, code: "NO_BARCODE", text: "tovarda barkod yo'q" });
    return "";
  }
  const opts = {
    dpi: template.dpi, moduleDots: cfg.moduleDots ?? 2,
    quietLeftModules: cfg.quietLeftModules ?? 9,
    quietRightModules: cfg.quietRightModules ?? 7,
    heightMm: f.h, showText: cfg.showText !== false, x: f.x, y: f.y,
    /* ⚠ TUR UZATILADI: minimal balandlik javon yorlig'i va ombor
       kartoni uchun bir xil emas — birinchisi qo'ldagi skaner bilan
       5–10 sm dan o'qiladi. */
    labelKind: template.kind,
  };
  const m = barcodeMetrics(value, opts);
  if (!m) {
    /* ⚠ JIMGINA CHIZILMAYDI. Nazorat raqami buzuq EAN skanerda
       BOSHQA tovarga aylanadi — bo'sh joy qoldirish undan xavfsizroq,
       lekin ogohlantirishsiz emas. */
    warnings.push({ field: f.key, code: "BAD_BARCODE",
      text: `«${value}» barkod sifatida chizib bo'lmadi` });
    return "";
  }
  if (m.widthMm > f.w + 0.001) {
    warnings.push({ field: f.key, code: "BARCODE_WIDE",
      text: `barkod ${m.widthMm.toFixed(1)} mm, joy ${Number(f.w).toFixed(1)} mm — `
          + `${(m.widthMm - f.w).toFixed(1)} mm toshdi` });
    return "";
  }
  if (!m.ok) {
    warnings.push({ field: f.key, code: "BARCODE_SHORT",
      text: `barkod balandligi ${Number(f.h).toFixed(1)} mm — `
          + `${m.minHeightMm} mm dan kam, skaner o'qimasligi mumkin` });
  }
  return barcodeSvgMm(value, opts) || "";
}

/* ── Matn va narx ────────────────────────────────────────────────────── */
function drawText(f, value, warnings) {
  const size = Number(f.size || 8);
  const weight = Number(f.weight || 400);
  const anchor = f.align === "center" ? "middle" : f.align === "right" ? "end" : "start";
  const tx = f.align === "center" ? f.x + f.w / 2 : f.align === "right" ? f.x + f.w : f.x;

  if (f.style === "major-minor") return drawPrice(f, value, size, weight, anchor, tx);

  const text = f.prefix ? f.prefix + String(value) : String(value);
  const wMm = textWidthMm(text, size, weight);
  let out = "";
  let shown = text;
  let useSize = size;

  if (wMm > f.w + 0.001) {
    if (f.overflow === "clip") {
      const keep = Math.max(1, Math.floor(text.length * (f.w / wMm)) - 1);
      shown = text.slice(0, keep) + "…";
      warnings.push({ field: f.key, code: "TEXT_CLIPPED", text: "matn kesildi" });
    } else if (f.overflow === "shrink") {
      useSize = Math.max(4, size * (f.w / wMm));
      if (useSize < 5) {
        warnings.push({ field: f.key, code: "TEXT_TINY",
          text: `shrift ${useSize.toFixed(1)} pt gacha kichraydi — o'qib bo'lmaydi` });
      }
    } else {
      warnings.push({ field: f.key, code: "TEXT_OVERFLOW",
        text: `matn maydondan ${(wMm - f.w).toFixed(1)} mm toshdi` });
    }
  }

  const baseline = f.y + Math.min(f.h, useSize * PT_TO_MM * 1.05);
  out += `<text x="${r(tx)}" y="${r(baseline)}" text-anchor="${anchor}"`
    + ` font-family="sans-serif" font-size="${r(useSize * PT_TO_MM)}"`
    + ` font-weight="${weight}"${f.strike ? ' text-decoration="line-through"' : ""}`
    + ` fill="#000">${esc(shown)}</text>`;
  return out;
}

/**
 * Narx: butun qismi YIRIK, tiyin qismi kichik va YUQORIDA.
 *
 * ⚠ Bu klassik ценник uslubi va u BEZAK EMAS: ko'z butun qismni
 * bir qarashda oladi, tiyin esa o'qishga xalaqit bermaydi. Uzoqdan
 * qaraganda farq ayniqsa sezilarli.
 */
function drawPrice(f, value, size, weight, anchor, tx) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const major = groupDigits(Math.trunc(Math.abs(n)));
  const minorNum = Math.round((Math.abs(n) - Math.trunc(Math.abs(n))) * 100);
  const minor = minorNum > 0 ? String(minorNum).padStart(2, "0") : null;
  const sign = n < 0 ? "-" : "";

  const majorMm = size * PT_TO_MM;
  const baseline = f.y + Math.min(f.h, majorMm * 1.0);
  let out = `<text x="${r(tx)}" y="${r(baseline)}" text-anchor="${anchor}"`
    + ` font-family="sans-serif" font-size="${r(majorMm)}" font-weight="${weight}"`
    + ` fill="#000">${esc(sign + major)}`;
  if (minor) {
    /* `baseline-shift` o'rniga `dy` — u hamma brauzerda bir xil. */
    out += `<tspan font-size="${r(majorMm * 0.45)}" dy="${r(-majorMm * 0.42)}">`
        + `${esc(minor)}</tspan>`;
  }
  return out + "</text>";
}

/**
 * QR o'rni.
 *
 * ⚠ HOZIRCHA FAQAT O'RIN. QR chizuvchi bu bosqichda yo'q; bo'sh
 * kvadrat qoldirish «QR bor» deb yolg'on gapirardi, shuning uchun
 * o'rin ochiq belgilanadi va F7 da to'ldiriladi.
 */
function qrPlaceholder(f, url) {
  if (!url) return "";
  return `<rect x="${r(f.x)}" y="${r(f.y)}" width="${r(f.w)}" height="${r(f.h)}"`
    + ` fill="none" stroke="#000" stroke-width="0.2" stroke-dasharray="1 1"/>`;
}

/**
 * Varaqqa joylash — CHOP ETISH yo'li.
 *
 * ⚠ AYNAN O'SHA `renderLabel` chaqiriladi. Bu funksiya faqat
 * JOYLASHTIRADI: nusxalar, boshlanish pozitsiyasi, varaq bo'linishi.
 * Chizish mantig'i bu yerda YO'Q va bo'lmasligi kerak.
 */
export function renderSheet(template, items, sheet, ctx = {}) {
  const { cols = 2, rows = 7, marginTopMm = 10, marginLeftMm = 8,
          gapXMm = 2, gapYMm = 0, startPosition = 1 } = sheet || {};
  const perPage = cols * rows;
  const cells = [];

  /* Boshlanish pozitsiyasi: birinchi N katak ATAYLAB bo'sh qoladi —
     yarim ishlatilgan yopishqoq varaq tashlab yuborilmasin. */
  for (let i = 1; i < startPosition; i++) cells.push(null);
  for (const it of items) {
    for (let c = 0; c < (it.quantity || 1); c++) cells.push(it);
  }

  const pages = [];
  const allWarnings = [];
  for (let p = 0; p * perPage < cells.length; p++) {
    const parts = [];
    for (let i = 0; i < perPage; i++) {
      const cell = cells[p * perPage + i];
      if (!cell) continue;
      const col = i % cols, row = Math.floor(i / cols);
      const x = marginLeftMm + col * (Number(template.widthMm) + gapXMm);
      const y = marginTopMm + row * (Number(template.heightMm) + gapYMm);
      const { svg, warnings } = renderLabel(template, cell.product, ctx);
      for (const w of warnings) allWarnings.push({ ...w, productId: cell.product?.id });
      parts.push(`<g transform="translate(${r(x)},${r(y)})">${strip(svg)}</g>`);
    }
    pages.push(parts.join(""));
  }
  return { pages, warnings: allWarnings, cellCount: cells.length };
}

/** SVG ni ichki `<g>` ga joylash uchun tashqi qobiqni olib tashlaydi. */
const strip = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
