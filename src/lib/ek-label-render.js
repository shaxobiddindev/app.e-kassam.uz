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
 * ⚠ BELGI BO'YICHA (2026-10-06), bitta o'rtacha son EMAS. Ilgari har
 * belgi 0,52 (qalinda 0,56) em deb olinardi: «Shampun Head&Shoulders…»
 * kabi bosh harf va «m», «w» ko'p nomda haqiqiy en 15–20% katta chiqib,
 * «Nom yirik» stikerida nom ikki chetidan kesilardi (egasi: «uzun nomlar
 * sig'mayapti»). Endi Arial/Helvetica jadvaliga yaqin guruhlar: tor
 * (i, l, t, bo'shliq), keng (m, w, Ш, Ж), bosh harf, raqam. Hali ham
 * BAHO va DETERMINISTIK — DOM kerak emas.
 */
const PT_TO_MM = 0.352778;
const NARROW_RE = /[iljtfI.,:;'!|ʻʼ`()[\] ]/;
const WIDE_RE = /[mwMWШЩЖЮФЫшщжюфы@%&]/;
const charEm = (c) => {
  if (NARROW_RE.test(c)) return 0.28;
  if (c === "r" || c === "-" || c === "\"") return 0.34;
  if (WIDE_RE.test(c)) return 0.86;
  if (c >= "0" && c <= "9") return 0.556;
  if (c !== c.toLowerCase()) return 0.68;
  return 0.54;
};
const textWidthMm = (text, sizePt, weight = 400) => {
  let em = 0;
  for (const c of String(text ?? "")) em += charEm(c);
  return em * sizePt * PT_TO_MM * (weight >= 800 ? 1.13 : weight >= 700 ? 1.08 : 1);
};

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
  /* ── Tarozi yorlig'i (2026-10-04) — `ek-weight-label.js` `weighedProduct` beradi ── */
  weight:     (p) => p.weightText,
  total:      (p) => p.total,
  plu:        (p) => p.pluText ?? p.plu,
  /* «15 000 so'm» — narx matn qatorida (yirik narx uslubisiz). */
  kgPrice:    (p) => (p.salePrice == null ? null : `${groupDigits(Math.round(Number(p.salePrice)))} so'm`),
  printedAt:  (p, ctx) => ctx.printedAt,
  /* Qotirilgan yozuv («Jami to'lov:», «so'm») — matni shablonda (`f.text`). */
  text:       (p, ctx, f) => f.text,
};

/* ⚠ BURILISH — FAQAT 270° (pastdan yuqoriga o'qiladi), egasining tarozi
   stikerida barkod va vaqt shunday turadi. Maydon qutisi (x, y, w, h)
   yorliqdagi JOY; ichidagi narsa eni `h`, bo'yi `w` bo'lgan qutiga
   chiziladi va burab qo'yiladi. Lokal o'q: u (pastdan yuqoriga), v (chapdan
   o'ngga) — ya'ni barkod raqamlari chiziqlarning O'NG tomonida. */
const ROT = 270;
const rotGroup = (it, inner) =>
  `<g transform="translate(${r(it.x)},${r(it.y + it.h)}) rotate(-90)">${inner}</g>`;

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
    const val = (VALUE[f.key] || (() => null))(product, ctx, f);
    const box = { key: f.key, x: Number(f.x), y: Number(f.y),
                  w: Number(f.w), h: Number(f.h) };

    if (f.key === "barcode") {
      const cfg = spec.barcode || {};
      const rot = Number(f.rot) === ROT;
      /* Burilganda chiziqlar balandligi — qutining ENI, uzunligi — bo'yi. */
      const m = val ? barcodeMetrics(val, {
        dpi: template.dpi, moduleDots: cfg.moduleDots ?? 2,
        quietLeftModules: cfg.quietLeftModules ?? 9,
        quietRightModules: cfg.quietRightModules ?? 7,
        heightMm: rot ? f.w : f.h, labelKind: template.kind, labelHeightMm: Number(template.heightMm),
      }) : null;
      if (rot) {
        const shift = f.align === "center" && m && m.widthMm < box.h ? (box.h - m.widthMm) / 2 : 0;
        items.push({ ...box, kind: "barcode", rot: ROT, shift, value: val, field: f,
                     cfg, metrics: m, dpi: template.dpi, showText: cfg.showText !== false });
        continue;
      }
      /* ⚠ MARKAZGA TEKISLASH (V142, `align: "center"`). Barkod tabiiy
         enida chiziladi va maydon chap chetidan boshlanardi: EAN-8 (do'kon
         kodi) EAN-13 ga mo'ljallangan joyda chapga taqalib, o'ngda bo'sh
         qolardi. Siljish JOYLASHUVDA hisoblanadi — SVG ham, TSPL/ZPL ham
         aynan shu `x` ni oladi. Eski shablonlarda `align` yo'q — ular
         o'zgarmaydi. */
      const shift = f.align === "center" && m && m.widthMm < box.w
        ? (box.w - m.widthMm) / 2 : 0;
      items.push({ ...box, x: box.x + shift, kind: "barcode", value: val, field: f,
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
                 align: f.align || "left", style: f.style || null,
                 ...(Number(f.rot) === ROT ? { rot: ROT } : {}) });
  }

  return { widthMm: W, heightMm: H, items, warnings };
}

export function renderLabel(template, product, ctx = {}) {
  const spec = typeof template.spec === "string"
    ? JSON.parse(template.spec) : (template.spec || {});
  const { widthMm: W, heightMm: H, items, warnings } = layoutLabel(template, product, ctx);
  const parts = [];

  /* ⚠ `ctx.omit` — BAYT YO'LI UCHUN. TSPL da matn rasm bo'lib boradi,
     barkod esa printerning O'Z buyrug'i bilan: rasmga aylangan barkod
     chiziqlari nuqta to'riga tushmay, birida 2, boshqasida 3 nuqta
     bo'lib chiqadi va skaner o'qimaydi. Shuning uchun rasm barkodsiz
     chiziladi — qolgan hamma narsa AYNAN shu renderer'dan. */
  const omit = ctx.omit || [];

  /* ⚠ CHIZISH JOYLASHUVDAN KEYIN: yuqoridagi ro'yxat qayerda
     ekanini aytadi, bu yer esa qanday ko'rinishini. */
  for (const it of items) {
    if (omit.includes(it.kind)) continue;
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
      /* `x` joylashuvdan (markazlash), en esa maydonniki — sig'ish tekshiruvi
         maydon bo'yicha. */
      if (it.rot === ROT) {
        const local = { ...it.field, x: it.shift, y: 0, w: it.h, h: it.w };
        parts.push(rotGroup(it, drawBarcode(local, it.value, template, spec, warnings)));
        continue;
      }
      parts.push(drawBarcode({ ...it.field, x: it.x }, it.value, template, spec, warnings));
      continue;
    }
    if (it.kind === "hole") {
      parts.push(`<circle cx="${r(it.x + it.w / 2)}" cy="${r(it.y + it.h / 2)}"`
        + ` r="${r(Math.min(it.w, it.h) / 2)}" fill="none" stroke="#000"`
        + ` stroke-width="0.2" stroke-dasharray="0.8 0.8"/>`);
      continue;
    }
    if (it.kind === "qr") { parts.push(qrPlaceholder(it.field || it, it.value)); continue; }
    if (it.rot === ROT) {
      parts.push(rotGroup(it, drawText({ ...it.field, x: 0, y: 0, w: it.h, h: it.w }, it.value, warnings)));
      continue;
    }
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
    labelHeightMm: Number(template.heightMm),
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

  /* ⚠ SIG'MAGAN NOM — AVVAL IKKI QATOR, KEYIN «…» (2026-10-06). Egasi:
     «uzun nomlar sig'mayapti». Ilgari `shrink` faqat shriftni kichraytirardi
     (4 pt gacha — qog'ozda nuqtalar) va shunda ham sig'masa matn chetdan
     chiqib kesilardi. Endi `fitLines`: maydon balandligi ko'targancha qator,
     shrift 5 pt dan past emas, sig'masa oxiri «…». */
  if (f.overflow === "shrink") {
    return drawLines(f, text, size, weight, anchor, tx, warnings);
  }

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

/** Qator balandligi (shrift o'lchamiga nisbatan) va eng kichik o'qiladigan shrift. */
const LINE_H = 1.12;
export const MIN_TEXT_PT = 5;

/** So'zlarni berilgan enga qatorlarga bo'ladi; juda uzun so'z harfma-harf bo'linadi. */
function wrapWords(text, sizePt, weight, w) {
  const lines = [];
  let cur = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidthMm(next, sizePt, weight) <= w) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = word;
    /* Bitta so'zning o'zi sig'masa («Head&Shoulders-Mentol») — bo'lib yuboriladi. */
    while (textWidthMm(cur, sizePt, weight) > w && cur.length > 1) {
      let k = cur.length - 1;
      while (k > 1 && textWidthMm(cur.slice(0, k), sizePt, weight) > w) k--;
      lines.push(cur.slice(0, k));
      cur = cur.slice(k);
    }
  }
  if (cur) lines.push(cur);
  /* ⚠ TENG BO'LISH: ochko'z usul «Shampun Head&Shoulders mentolli 400 / ml»
     kabi yolg'iz so'z qoldirardi. Ikki qatorda bo'linish nuqtasi ikkala
     qatorning eng uzuni eng qisqa bo'ladigan joyda olinadi. */
  if (lines.length === 2) {
    const words = String(text).split(/\s+/).filter(Boolean);
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      const wa = textWidthMm(a, sizePt, weight), wb = textWidthMm(b, sizePt, weight);
      if (wa > w || wb > w) continue;
      const m = Math.max(wa, wb);
      if (!best || m < best.m) best = { m, a, b };
    }
    if (best) return [best.a, best.b];
  }
  return lines;
}

/**
 * Matnni maydonga joylaydi: {sizePt, lines, clipped}.
 *
 * Tartib: asl shriftdan 0,25 pt qadam bilan pastga; har o'lchamda maydon
 * balandligiga nechta qator sig'sa (ko'pi bilan 3), shuncha qatorga bo'lib
 * ko'riladi. Birinchi sig'gan o'lcham olinadi — ya'ni nom bir qatorga
 * biroz kichrayib sig'sa, ikki qatorga bo'linmaydi (yirikroq qoladi).
 * 5 pt da ham sig'masa — oxirgi qator «…» bilan kesiladi.
 */
export function fitLines(text, sizePt, weight, w, h) {
  const linesAt = (s) => Math.max(1, Math.min(3, Math.floor((h + 0.15) / (s * PT_TO_MM * LINE_H))));
  for (let s = sizePt; s >= MIN_TEXT_PT - 1e-9; s -= 0.25) {
    const lines = wrapWords(text, s, weight, w);
    if (lines.length <= linesAt(s)) return { sizePt: s, lines, clipped: false };
  }
  const s = MIN_TEXT_PT;
  const max = linesAt(s);
  const lines = wrapWords(text, s, weight, w).slice(0, max);
  let last = lines[max - 1] || "";
  while (last.length > 1 && textWidthMm(`${last}…`, s, weight) > w) last = last.slice(0, -1);
  lines[max - 1] = `${last.replace(/\s+$/, "")}…`;
  return { sizePt: s, lines, clipped: true };
}

function drawLines(f, text, size, weight, anchor, tx, warnings) {
  const { sizePt, lines, clipped } = fitLines(text, size, weight, Number(f.w), Number(f.h));
  if (clipped) warnings.push({ field: f.key, code: "TEXT_CLIPPED", text: "matn kesildi" });
  const em = sizePt * PT_TO_MM;
  const lh = em * LINE_H;
  /* Qatorlar bloki maydon o'rtasida (bo'yiga): bitta qator bo'lsa ham
     nom ikki qatorlik joyning yuqorisiga yopishib qolmaydi. */
  const top = f.y + Math.max(0, (Number(f.h) - lh * lines.length) / 2);
  const first = top + Math.min(lh, em * 1.0);
  const spans = lines.map((ln, i) =>
    `<tspan x="${r(tx)}"${i ? ` dy="${r(lh)}"` : ""}>${esc(ln)}</tspan>`).join("");
  return `<text x="${r(tx)}" y="${r(first)}" text-anchor="${anchor}"`
    + ` font-family="sans-serif" font-size="${r(em)}" font-weight="${weight}"`
    + `${f.strike ? ' text-decoration="line-through"' : ""} fill="#000">${spans}</text>`;
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

  /* ⚠ NARX HAM MAYDONGA SIG'SIN (2026-10-05). Oddiy matnda `overflow: shrink`
     bor edi, narxda esa yo'q: shablon «1 250 000» ga hisoblangan, lekin
     10 mln li narx yoki qo'lda kattalashtirilgan shrift maydondan chiqib,
     qo'shni stikerga yoki chetga tushardi. Endi sig'maganda kichrayadi. */
  const fullW = textWidthMm(sign + major, size, weight)
    + (minor ? textWidthMm(minor, size * 0.45, weight) : 0);
  if (Number(f.w) > 0 && fullW > Number(f.w)) size = Math.max(4, size * (Number(f.w) / fullW));
  const majorMm = size * PT_TO_MM;
  const baseline = f.y + Math.min(f.h, majorMm * 1.0);
  /* ⚠ «SO'M» — FAQAT SIG'SA (2026-10-05). Egasi: «narx yonidan so'm qo'shilsin,
     narxligi bilinishi uchun». Stikerda narx barkod raqamlari va *kod bilan
     yonma-yon turadi va yalang'och «12 500» ularning qaysi biri narx ekanini
     aytmaydi. Lekin «1 250 000» tor stikerga zo'rg'a sig'adi — u yerda «so'm»
     qo'shilsa narx maydondan toshardi; shuning uchun eni baholanadi va
     sig'magandagina tashlanadi (narx «so'm» dan muhimroq).
     ⚠ Faqat `price` maydoni: tarozi yorlig'ida «so'm» alohida maydon
     (`gen-scale-templates.mjs`), u yerda ikki marta chiqardi. */
  /* Kichik narxda «so'm» nisbatan kattaroq: 30×20 dagi 11 pt narxning 0,42 si
     ~1,6 mm — termoprinterda o'qilmaydi. ~2,4 mm dan kichik bo'lmasin (narxning yarmigacha). */
  const somMm = Math.max(majorMm * 0.42, Math.min(majorMm * 0.6, 2.4));
  const minorW = minor ? textWidthMm(minor, size * 0.45, weight) : 0;
  const som = f.key === "price" && f.currency !== false
    && textWidthMm(sign + major, size, weight) + minorW
       + textWidthMm(" so'm", somMm / PT_TO_MM, 700) <= Number(f.w) + 0.001;
  let out = `<text x="${r(tx)}" y="${r(baseline)}" text-anchor="${anchor}"`
    + ` font-family="sans-serif" font-size="${r(majorMm)}" font-weight="${weight}"`
    + ` fill="#000">${esc(sign + major)}`;
  if (minor) {
    /* `baseline-shift` o'rniga `dy` — u hamma brauzerda bir xil. */
    out += `<tspan font-size="${r(majorMm * 0.45)}" dy="${r(-majorMm * 0.42)}">`
        + `${esc(minor)}</tspan>`;
  }
  if (som) {
    /* Asosiy qatorda (tiyindan keyin pastga qaytib), kichik va yarim qalin:
       ko'z avval raqamni oladi, «so'm» faqat uning nima ekanini aytadi. */
    out += `<tspan font-size="${r(somMm)}" font-weight="700"${minor ? ` dy="${r(majorMm * 0.42)}"` : ""}>`
        + ` so'm</tspan>`;
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
