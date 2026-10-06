/**
 * ══════════════════════════════════════════════════════════════════════════
 * TAROZI YORLIG'I DIZAYNLARI — HAR DIZAYN HAR O'LCHAMDA (V146, 2026-10-04)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Egasi (do'kondagi tarozi stikerining surati bilan): «bu stikerlardan shablon
 * ol», qarori — tortib chiqarish, hamma o'lchamda.
 *
 * Suratdagi stiker: chapda nom, PLU, og'irlik, 1 kg narxi, «Jami to'lov:» va
 * katta summa «so'm» bilan; o'ngda TIK barkod (pastdan yuqoriga o'qiladi),
 * yonida chop etilgan vaqt. Shu — «Yon barkod» dizayni. Yana ikkitasi: barkod
 * pastda va katta summa — tik barkod sig'maydigan kichik rulonlar uchun ham.
 *
 * ⚠ KOD `scl_<dizayn>_<eni>x<bo'yi>`, turi STICKER: o'sha printer va rulon.
 * Oddiy stiker galereyasida ular chiqmaydi (`isScaleTpl`).
 *
 * ⚠ HAR SHABLON YOZISHDAN OLDIN TEKSHIRILADI (bittasi yiqilsa — hech narsa):
 * front `validateTemplate`, renderer og'irlikli haqiqiy tovarlar bilan,
 * barkod o'lchami, maydon yorliqdan chiqmasin, ustma-ust tushmasin.
 *
 * Kichik o'lchamda dizayn SODDALASHADI (`drop`): avval «Jami to'lov:» yozuvi,
 * keyin PLU, keyin 1 kg narxi ketadi. Og'irlik va jami summa — hech qachon.
 *
 *   node scripts/gen-scale-templates.mjs ../../e-kassam/src/main/resources/db/migration/V146__scale_label_designs.sql
 */
import fs from "node:fs";
import { validateTemplate } from "../src/lib/ek-label-validate.js";
import { renderLabel } from "../src/lib/ek-label-render.js";
import { eanMinMm } from "../src/lib/ek-label-barcode.js";
import { SCALE_DESIGN_ORDER } from "../src/lib/ek-sticker-auto.js";
import { weighedProduct } from "../src/lib/ek-weight-label.js";
import { SIZES, PT, r1, clamp, textH, sql } from "./gen-sticker-templates.mjs";

const DPI = 203;
const DOTS = 2;
const P = 1;                                       // chekka (mm)
/** EAN-13 tinch zonasi bilan (mm) — tik barkodda bu qutining BO'YI. */
const EAN_LEN = (95 + 9 + 7) * DOTS * 25.4 / DPI;

export const SCALE_NAMES = {
  side:      ["Tarozi — yon barkod",   "Весы — штрихкод сбоку", "Scale — side barcode"],
  bottom:    ["Tarozi — pastki barkod", "Весы — штрихкод снизу", "Scale — bottom barcode"],
  big_total: ["Tarozi — katta summa",   "Весы — крупная сумма",  "Scale — big total"],
};

/* ── Qatorlar ──────────────────────────────────────────────────────────
   `drop` — kattasi birinchi ketadi; 0 — hech qachon. `min` — kichraytirish chegarasi. */
const row = (key, size, o = {}) => ({ key, size, min: 5, drop: 0, weight: 700, align: "left", ...o });

function rowsFor(design, narrow) {
  /* Tor ustunda prefikslar qisqaradi: «Og'irligi: 1.255 kg» 20 mm ga sig'maydi. */
  const W = narrow ? "" : "Og'irligi: ";
  const K = narrow ? "1 kg: " : "1 kg narxi: ";
  if (design === "big_total") {
    return [
      row("nameShort", 9, { drop: 4, align: "center" }),
      row("total", 20, { min: 9, style: "major-minor", weight: 900, align: "center", som: true }),
      row("weight", 7, { drop: 2, align: "center", weight: 600 }),
      row("kgPrice", 7, { drop: 3, align: "center", weight: 500, prefix: K }),
    ];
  }
  return [
    row("nameShort", 9, { drop: 5 }),
    row("plu", 7, { drop: 3, weight: 600, prefix: "PLU: " }),
    row("weight", 7, { drop: 1, weight: 600, prefix: W, min: 5 }),
    row("kgPrice", 7, { drop: 2, weight: 600, prefix: K }),
    row("text", 8, { drop: 4, text: "Jami to'lov:" }),
    row("total", 14, { min: 8, style: "major-minor", weight: 900, som: true }),
  ];
}

/** Qatorlarni balandlikka joylaydi: avval kichraytiradi, sig'masa — `drop` bo'yicha tashlaydi. */
function fit(rows, avail) {
  let active = rows.map((r) => ({ ...r }));
  for (;;) {
    const need = active.reduce((s, r) => s + textH(r.size), 0);
    if (need <= avail) break;
    /* Chegaragacha bir necha qadamda: bitta qadam (k) qo'shimcha zaxira tufayli
       yetmay qolib, og'irlik kabi kerakli qator bekorga tashlanardi. */
    let shrunk = active;
    for (let i = 0; i < 12; i++) {
      const total = shrunk.reduce((s, r) => s + textH(r.size), 0);
      if (total <= avail) break;
      const k = avail / total;
      shrunk = shrunk.map((r) => ({ ...r, size: Math.max(r.min, Math.floor(r.size * k * 10) / 10) }));
    }
    if (shrunk.reduce((s, r) => s + textH(r.size), 0) <= avail) { active = shrunk; break; }
    const victim = active.filter((r) => r.drop > 0).sort((a, b) => b.drop - a.drop)[0];
    if (!victim) { active = shrunk; break; }
    active = active.filter((r) => r !== victim);
  }
  return active;
}

/** Jami summa shriftini bo'sh joyga qarab kattalashtiradi (eni ham chegara). */
function growTotal(rows, avail, widthMm) {
  const t = rows.find((r) => r.key === "total");
  if (!t) return rows;
  const used = rows.reduce((s, r) => s + textH(r.size), 0);
  const free = avail - used;
  const byH = t.size + free / (PT * 1.25);
  const byW = widthMm / (7 * PT * 0.6);           // «188 250» — 7 belgi
  t.size = Math.floor(clamp(Math.min(byH, byW, 40), t.size, 40));
  return rows;
}

function textField(r, x, y, w) {
  const f = { key: r.key, x: r1(x), y: r1(y), w: r1(w), h: textH(r.size), visible: true,
    size: r1(r.size), weight: r.weight, align: r.align, lines: 1 };
  if (r.style) f.style = r.style;
  else f.overflow = "shrink";
  if (r.prefix) f.prefix = r.prefix;
  if (r.text) f.text = r.text;
  return f;
}

/** Ustun ichida qatorlar: oraliqlar teng taqsimlanadi. «so'm» jami yonida. */
function column(rows, x, y, w, h) {
  const fields = [];
  const used = rows.reduce((s, r) => s + textH(r.size), 0);
  const gap = rows.length > 1 ? Math.max(0, (h - used) / (rows.length - 1)) : 0;
  let cy = y;
  for (const r of rows) {
    if (r.som) {
      const somSize = clamp(Math.round(r.size * 0.45), 6, 12);
      const somW = r1(somSize * PT * 0.6 * 5 + 1);
      const centered = r.align === "center";
      const tw = w - somW - 0.4;
      fields.push(textField({ ...r, align: centered ? "right" : "left" }, x, cy, tw));
      fields.push(textField({ key: "text", size: somSize, weight: 700, align: "left", text: "so'm" },
        x + tw + 0.4, r1(cy + textH(r.size) - textH(somSize)), somW));
    } else {
      fields.push(textField(r, x, cy, w));
    }
    cy += textH(r.size) + gap;
  }
  return fields;
}

export function scaleLayout(design, W, H) {
  const need = eanMinMm("STICKER", H);
  const innerW = W - 2 * P, innerH = H - 2 * P;
  const fields = [];
  /* ── Yon barkod — tik barkod sig'sa ── */
  if (design === "side" && innerH + 0.001 >= EAN_LEN) {
    const bcW = r1(clamp(W * 0.24, need, 16));
    const bcX = r1(W - P - bcW);
    fields.push({ key: "barcode", x: bcX, y: P, w: bcW, h: r1(innerH), visible: true, rot: 270, align: "center" });
    /* Vaqt — barkod yonida, tik. Tor yorliqda (matn ustuni < 22 mm) tushadi. */
    const stampW = textH(5);
    const withStamp = bcX - stampW - 0.6 - P >= 22;
    let colRight = bcX - 0.8;
    if (withStamp) {
      const sx = r1(bcX - stampW - 0.4);
      fields.push({ key: "printedAt", x: sx, y: P, w: stampW, h: r1(innerH), visible: true,
        size: 5, weight: 500, align: "left", overflow: "shrink", lines: 1, rot: 270 });
      colRight = sx - 0.6;
    }
    const colW = colRight - P;
    let rows = fit(rowsFor("side", colW < 32), innerH);
    rows = growTotal(rows, innerH, colW * 0.7);
    fields.push(...column(rows, P, P, colW, innerH));
    return spec(fields);
  }
  /* ── Pastki barkod (va tik barkod sig'maydigan o'lchamda «yon barkod») ── */
  const bcH = r1(clamp(H * 0.3, need, 14));
  const bcY = r1(H - P - bcH);
  fields.push({ key: "barcode", x: P, y: bcY, w: r1(innerW), h: bcH, visible: true, align: "center" });
  const avail = bcY - 0.6 - P;
  let rows = fit(rowsFor(design === "big_total" ? "big_total" : "bottom", innerW < 36), avail);
  rows = growTotal(rows, avail, innerW * 0.75);
  fields.push(...column(rows, P, P, innerW, avail));
  return spec(fields);
}

function spec(fields) {
  return {
    lang: "uz", padding: P,
    border: { widthMm: 0, color: "#000000" },
    background: "#ffffff",
    barcode: { moduleDots: DOTS, heightMm: 12, quietLeftModules: 9, quietRightModules: 7, showText: true },
    fields,
  };
}

/* ── Tekshiruv — og'irlikli haqiqiy tovarlar ──────────────────────────── */
const SCALE = { prefixes: ["2"], pluDigits: 5, valueDigits: 6, valueDecimals: 3 };
const sample = (p, kg) => weighedProduct(p, kg, SCALE).product;
const SAMPLES = [
  sample({ id: 1, name: "Pista", nameShort: "Pista", salePrice: 150000, plu: "1", unit: "KG" }, 1.255),
  sample({ id: 2, name: "Mol go'shti", salePrice: 120000, plu: "12", unit: "KG" }, 2.345),
  sample({ id: 3, name: "Shakar", salePrice: 15000, plu: "3", unit: "KG" }, 0.255),
];
const LONG = sample({ id: 4, name: "Грецкий орех очищенный Узбекистан высший сорт", salePrice: 98000,
  plu: "44", unit: "KG" }, 0.875);
const CTX = { printedAt: "2026-10-04 13:25", shopName: "Chilonzor do'koni" };

function check(tpl) {
  const errs = [];
  for (const e of validateTemplate(tpl)) errs.push(`validate ${e.level}: ${e.text}`);
  const s = JSON.parse(tpl.spec);
  for (const p of SAMPLES) {
    for (const w of renderLabel(tpl, p, CTX).warnings) errs.push(`render(${p.id}) ${w.code}: ${w.text}`);
  }
  for (const w of renderLabel(tpl, LONG, CTX).warnings) {
    if (w.code !== "TEXT_TINY" && w.code !== "TEXT_CLIPPED") errs.push(`render(long) ${w.code}: ${w.text}`);
  }
  for (const f of s.fields) {
    if (f.x < 0 || f.y < 0 || f.x + f.w > tpl.widthMm + 0.001 || f.y + f.h > tpl.heightMm + 0.001) {
      errs.push(`${f.key} yorliqdan chiqdi (${f.x},${f.y},${f.w},${f.h})`);
    }
  }
  for (let i = 0; i < s.fields.length; i++) {
    for (let j = i + 1; j < s.fields.length; j++) {
      const a = s.fields[i], b = s.fields[j];
      if (a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05) {
        errs.push(`${a.key} va ${b.key} ustma-ust`);
      }
    }
  }
  const keys = s.fields.map((f) => f.key);
  for (const k of ["barcode", "weight", "total"]) if (!keys.includes(k)) errs.push(`${k} yo'q`);
  return errs;
}

export function buildScale() {
  const out = [];
  const bad = [];
  for (const key of SCALE_DESIGN_ORDER) {
    for (const [W, H] of SIZES) {
      const tpl = { code: `scl_${key}_${W}x${H}`, kind: "STICKER", widthMm: W, heightMm: H,
        dpi: DPI, thermal: true, name: SCALE_NAMES[key], spec: JSON.stringify(scaleLayout(key, W, H)) };
      const errs = check(tpl);
      if (errs.length) bad.push(`${tpl.code}:\n    ${errs.join("\n    ")}`);
      out.push(tpl);
    }
  }
  return { out, bad };
}

if (process.argv[1] && process.argv[1].endsWith("gen-scale-templates.mjs")) {
  const { out, bad } = buildScale();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const values = out.map((t) => `    (${sql(t.code)}, ${sql(t.name[0])}, ${sql(t.name[1])}, ${sql(t.name[2])}, `
    + `${t.widthMm}, ${t.heightMm}, ${sql(t.spec)})`).join(",\n");
  const body = `-- ══════════════════════════════════════════════════════════════════════════
-- TAROZI YORLIG'I DIZAYNLARI — HAR DIZAYN HAR O'LCHAMDA (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Egasi (do'kondagi tarozi stikerining surati bilan): «bu stikerlardan
-- shablon ol» — tortib chiqarish, hamma o'lchamda.
--
-- ${SCALE_DESIGN_ORDER.length} dizayn × ${SIZES.length} rulon o'lchami = ${out.length} ta tizim shabloni.
-- Kod \`scl_<dizayn>_<eni>x<bo'yi>\`, turi STICKER (o'sha printer va rulon);
-- maydonlar: og'irlik, jami summa, PLU, 1 kg narxi, vaqt, og'irlikli barkod.
-- «Yon barkod» — barkod tik (270°), suratdagidek.
--
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI. Uni frontend repodagi
--   scripts/gen-scale-templates.mjs
-- hisoblaydi va yozishdan oldin har shablonni tekshiradi. O'zgartirish
-- kerak bo'lsa — skript o'zgaradi va YANGI migratsiya yoziladi.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO label_templates
    (code, kind, name, name_ru, name_en, width_mm, height_mm, dpi, thermal, spec,
     is_system, created_at)
SELECT v.code, 'STICKER', v.name, v.name_ru, v.name_en,
       v.width_mm, v.height_mm, 203, true, v.spec::jsonb, true, now()
  FROM (VALUES
${values}
  ) AS v(code, name, name_ru, name_en, width_mm, height_mm, spec)
ON CONFLICT (code) WHERE is_system DO NOTHING;
`;
  const target = process.argv[2];
  if (target) {
    fs.writeFileSync(target, body);
    console.log(`✅ ${out.length} ta shablon → ${target}`);
  } else {
    process.stdout.write(body);
  }
}
