/**
 * ══════════════════════════════════════════════════════════════════════════
 * JAVON YORLIQLARI — HAR DIZAYN HAR O'LCHAMDA (V143, 2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Egasining talabi: «javon yorliqlarini ham hamma o'lchamda qil».
 *
 * Stikerdagi bilan bir xil usul (`gen-sticker-templates.mjs`): dizayn —
 * qoida, joylashuvni shu skript hisoblaydi, har shablonni tekshiradi va
 * SQL migratsiyaga yozadi.
 *
 * ⚠ JAVON YORLIG'I STIKERDAN BOSHQA NARSA. U javon chetida turadi va
 * 1–1,5 m dan o'qiladi: asosiy element — NARX, u qolgan joyning hammasini
 * egallaydi va shrifti joyga qarab hisoblanadi. Barkod CHIZILMAYDI (G1,
 * V134) — uning o'rnida kassada teriladigan qisqa kod (`*142`).
 *
 * ⚠ O'LCHAMLAR — IKKI MANBADAN: javon yorlig'ining odatiy o'lchamlari
 * (A4/A5 varaqqa: 70×37, 70×50, 100×60, 148×105) va stiker rulonlari
 * (V135) — ko'p do'kon narx yorlig'ini ham o'sha termal rulonda chiqaradi.
 *
 * Ishga tushirish (frontend papkasidan):
 *   node scripts/gen-shelf-templates.mjs ../../e-kassam/src/main/resources/db/migration/V143__shelf_designs.sql
 */
import fs from "node:fs";
import { validateTemplate } from "../src/lib/ek-label-validate.js";
import { renderLabel } from "../src/lib/ek-label-render.js";
import { SHELF_DESIGN_ORDER } from "../src/lib/ek-sticker-auto.js";
import { PT, r1, clamp, textH, sql } from "./gen-sticker-templates.mjs";

/* Varaq o'lchamlari (300 dpi, lazer) va rulon o'lchamlari (203 dpi, termal). */
const SHEET = [[70, 37], [70, 50], [100, 60], [148, 105]];
const ROLL = [[58, 40], [58, 30], [60, 40], [50, 30], [40, 30], [40, 25], [30, 20], [100, 50], [100, 150]];
export const SHELF_SIZES = [...SHEET, ...ROLL];
const isSheet = (w, h) => SHEET.some(([a, b]) => a === w && b === h);

/* V131 dagi javon shablonlari o'z katagini egallaydi. `shelf_qr` dizayn
   sifatida ko'paytirilmaydi: QR chizuvchi hali yo'q (bo'sh kvadrat). */
const TAKEN = new Set(["classic@70x37", "big_price@70x50", "promo@70x50", "weighed@70x50",
  "minimal@50x30", "detailed@100x60", "bilingual@100x60", "promo@148x105"]);
export const SHELF_LEGACY = {
  shelf_classic: "classic", shelf_big_price: "big_price", shelf_promo: "promo",
  shelf_weighed: "weighed", shelf_minimal: "minimal", shelf_detailed: "detailed",
  shelf_bilingual: "bilingual", shelf_a5: "promo",
};

/* ── Qatorlar ───────────────────────────────────────────────────────── */
const text = (key, size, o = {}) => ({ type: "text", key, size, weight: 700, align: "left",
  overflow: "shrink", ...o });
const code = (size, o = {}) => text("code", size, { weight: 800, prefix: "*", ...o });
const pair = (left, right, o = {}) => ({ type: "pair", left, right, ...o });
/** Narx — moslashuvchan qator: qolgan balandlikni oladi. */
const PRICE = (o = {}) => ({ type: "price", key: "price", align: "center", ...o });
/** Narx chapda (moslashuvchan) + kod o'ngda yuqorida. */
const SPLIT = (codeSize) => ({ type: "split", codeSize });

const f = (base, lo, hi) => (k) => Math.round(clamp(base * k, lo, hi));
const fs8 = f(8, 5, 18), fs9 = f(9, 6, 20), fs10 = f(10, 6, 24), fs11 = f(11, 6, 26),
  fs13 = f(13, 7, 30), fs22 = f(22, 9, 48);

export const SHELF_DESIGNS = {
  classic: {
    name: ["Klassik", "Классический", "Classic"],
    rows: (k) => [text("name", fs10(k), { drop: 2 }), SPLIT(fs11(k))],
  },
  big_price: {
    name: ["Katta narx", "Крупная цена", "Big price"],
    rows: (k) => [text("name", fs10(k), { drop: 2, align: "center" }), PRICE(),
      code(fs10(k), { drop: 1, align: "center" })],
  },
  promo: {
    name: ["Aksiya", "Акция", "Promotion"],
    rows: (k) => [text("name", fs10(k), { drop: 3, align: "center" }),
      text("oldPrice", fs13(k), { drop: 2, weight: 600, strike: true, align: "center" }),
      PRICE(), code(fs9(k), { drop: 1, align: "center" })],
  },
  weighed: {
    name: ["Tarozili", "Весовой", "Weighed"],
    rows: (k) => [text("name", fs10(k), { drop: 2, align: "center" }),
      PRICE({ key: "unitPrice", unitBase: "kg" }),
      text("price100g", fs9(k), { drop: 3, weight: 600, align: "center" }),
      code(fs9(k), { drop: 1, align: "center" })],
  },
  minimal: {
    name: ["Minimal", "Минимальный", "Minimal"],
    rows: (k) => [text("name", fs9(k), { drop: 1, align: "center" }), PRICE()],
  },
  detailed: {
    name: ["Batafsil", "Подробный", "Detailed"],
    rows: (k) => [text("name", fs11(k), { weight: 800, drop: 2 }),
      pair(text("brand", fs8(k), { weight: 600 }), text("country", fs8(k), { weight: 600, align: "right" }),
        { drop: 4 }),
      text("ingredients", fs8(k), { weight: 400, overflow: "clip", drop: 6 }),
      text("storage", fs8(k), { weight: 400, overflow: "clip", drop: 5 }),
      SPLIT(fs11(k))],
  },
  bilingual: {
    name: ["Ikki tilli", "Двуязычный", "Bilingual"],
    /* ⚠ NOMLAR USTMA-UST, YONMA-YON EMAS: renderer matn enini BAHOLAYDI va
       kirill qalin harfni kam baholaydi — 148×105 da yonma-yon ikki nom
       bir-biriga kirib ketdi. Ustma-ust har biri butun enni oladi. */
    rows: (k) => [text("name", fs10(k), { weight: 800, lang: "uz", align: "center", drop: 2 }),
      text("nameRu", fs10(k), { weight: 800, lang: "ru", align: "center", drop: 2.5 }),
      PRICE(), code(fs10(k), { drop: 1, align: "center" })],
  },
  code_big: {
    name: ["Kod yirik", "Крупный код", "Big code"],
    rows: (k) => [code(fs22(k), { weight: 900, align: "center" }), PRICE(),
      text("name", fs9(k), { drop: 1, align: "center" })],
  },
  shop: {
    name: ["Do'kon nomi bilan", "С названием магазина", "With shop name"],
    rows: (k) => [text("shopName", fs8(k), { weight: 800, drop: 3, align: "center" }),
      text("name", fs10(k), { drop: 2, align: "center" }), PRICE(),
      code(fs9(k), { drop: 1, align: "center" })],
  },
};

/* Narx «125 000» (7 belgi) + tiyin — eniga sig'sin; balandlik `validateTemplate`
   formulasi bo'yicha (1,2 × shrift). Validator chegarasi — 72 pt. */
const priceSize = (w, h) => Math.floor(clamp(Math.min(h / (PT * 1.2), w / (8 * 0.62 * PT)), 6, 72));
/** Narx qatori kamida shuncha bo'lsin — undan pastda u yorliqning asosiy elementi emas. */
const minPriceH = (H) => clamp(H * 0.3, 5, 40);
const rowH = (row) => (row.type === "text" ? textH(row.size)
  : row.type === "pair" ? textH(Math.max(row.left.size, row.right.size)) : 0);

export function shelfLayout(designKey, W, H) {
  const d = SHELF_DESIGNS[designKey];
  const k = clamp(Math.min(W / 70, H / 45) * (H > 100 ? 1.15 : 1), 0.55, 2.6);
  const pad = W <= 32 || H <= 22 ? 1.2 : W <= 45 ? 1.5 : 2;
  const iw = W - 2 * pad, ih = H - 2 * pad;
  const gap = 0.6;
  let rows = d.rows(k);
  /* ⚠ TOR YORLIQDA JUFT USTMA-UST: 30×20 da yarim en 13 mm va ikki tilli
     nom 4 pt gacha kichrayib, o'qib bo'lmasdi. Juft ikki qatorga ajraladi
     (o'ngdagisi birinchi tashlanadi) — joy bo'lmasa navbat bilan ketadi. */
  if ((iw - 1) / 2 < 30) {
    rows = rows.flatMap((x) => (x.type === "pair"
      ? [{ ...x.left, align: "center", drop: x.drop }, { ...x.right, align: "center", drop: (x.drop || 0) + 0.5 }]
      : [x]));
  }

  const fixed = (list) => list.reduce((s, x) => s + rowH(x), 0) + gap * (list.length - 1);
  while (ih - fixed(rows) < minPriceH(H)) {
    const victim = rows.filter((x) => x.drop).sort((a, b) => b.drop - a.drop)[0];
    if (!victim) break;
    rows = rows.filter((x) => x !== victim);
  }
  while (ih - fixed(rows) < minPriceH(H)) {
    const big = rows.filter((x) => x.type === "text" && x.size > 6).sort((a, b) => b.size - a.size)[0];
    if (!big) break;
    rows = rows.map((x) => (x === big ? { ...x, size: x.size - 1 } : x));
  }
  const room = r1(ih - fixed(rows));
  if (room < 5) throw new Error(`${designKey} ${W}x${H}: narxga ${room} mm qoldi`);

  const fields = [];
  let y = pad;
  for (const row of rows) {
    if (row.type === "price") {
      /* ⚠ NARX O'Z JOYIDA MARKAZDA: shrift eniga cheklansa (uzun narx), u
         joyning tepasiga yopishib, pastida bo'sh qolardi. Maydon narxning
         o'z balandligida va joy ichida o'rtada. */
      const size = priceSize(iw, room);
      const ph = Math.min(room, r1(size * PT * 1.2 + 0.2));
      const py = y + (room - ph) / 2;
      fields.push({ key: row.key, x: r1(pad), y: r1(py), w: r1(iw), h: ph, visible: true,
        size, weight: 900, align: row.align, style: "major-minor", lines: 1,
        ...(row.unitBase ? { unitBase: row.unitBase } : {}) });
      y += room + gap;
    } else if (row.type === "split") {
      const pw = r1(iw * 0.64), cw = r1(iw - pw - 1);
      const csize = Math.min(row.codeSize, Math.floor(room / (PT * 1.25)));
      const size = priceSize(pw, room);
      const ph = Math.min(room, r1(size * PT * 1.2 + 0.2));
      const py = y + (room - ph) / 2;
      fields.push({ key: "price", x: r1(pad), y: r1(py), w: pw, h: ph, visible: true,
        size, weight: 900, align: "left", style: "major-minor", lines: 1 });
      fields.push({ key: "code", x: r1(pad + pw + 1), y: r1(py), w: cw, h: textH(csize), visible: true,
        size: csize, weight: 800, align: "right", overflow: "shrink", prefix: "*", lines: 1 });
      y += room + gap;
    } else if (row.type === "pair") {
      const h = rowH(row), half = r1((iw - 1) / 2);
      fields.push(textField(row.left, pad, y, half, h));
      fields.push(textField(row.right, pad + half + 1, y, half, h));
      y += h + gap;
    } else {
      const h = rowH(row);
      fields.push(textField(row, pad, y, iw, h));
      y += h + gap;
    }
  }
  return {
    lang: "uz", padding: pad,
    border: { widthMm: 0.2, color: "#000000" },
    background: "#ffffff",
    /* ⚠ Barkod bo'limi QOLADI, maydoni esa yo'q: seed sinovi har tizim
       shablonida modul sozlamasini kutadi, do'kon nusxada barkod
       qo'shsa — to'g'ri modul bilan boshlansin. */
    barcode: { moduleDots: 2, heightMm: 12, quietLeftModules: 9, quietRightModules: 7,
      showText: true, orientation: "horizontal" },
    fields,
  };
}

function textField(row, x, y, w, h) {
  const out = { key: row.key, x: r1(x), y: r1(y), w: r1(w), h: r1(h), visible: true,
    size: row.size, weight: row.weight, align: row.align, overflow: row.overflow, lines: 1 };
  if (row.prefix) out.prefix = row.prefix;
  if (row.strike) out.strike = true;
  if (row.lang) out.lang = row.lang;
  return out;
}

/* ── Tekshiruv ──────────────────────────────────────────────────────── */
const SAMPLES = [
  { id: 1, name: "Сахар песок 1кг", nameRu: "Сахар песок 1кг", salePrice: 12500, oldPrice: 14900,
    searchCode: "101", brand: "Makfa", country: "Rossiya", ingredients: "Shakar", storage: "Quruq joyda" },
  { id: 2, name: "Parda tyul 3 metr", salePrice: 1250000, searchCode: "4421" },
];
const LONG = { id: 3, name: "Shampun Head&Shoulders Ментол против перхоти 400 мл", salePrice: 45900,
  searchCode: "99999" };

function check(tpl) {
  const errs = [];
  for (const e of validateTemplate(tpl)) errs.push(`validate ${e.level}: ${e.text}`);
  const spec = JSON.parse(tpl.spec);
  for (const p of SAMPLES) {
    for (const w of renderLabel(tpl, p, { shopName: "Chilonzor do'koni" }).warnings) {
      errs.push(`render(${p.id}) ${w.code}: ${w.text}`);
    }
  }
  for (const w of renderLabel(tpl, LONG, {}).warnings) {
    if (w.code !== "TEXT_TINY" && w.code !== "TEXT_CLIPPED") errs.push(`render(long) ${w.code}: ${w.text}`);
  }
  if (spec.fields.some((x) => x.key === "barcode")) errs.push("javonda barkod maydoni bo'lmasin (G1)");
  if (!spec.fields.some((x) => x.key === "price" || x.key === "unitPrice")) errs.push("narx yo'q");
  for (const x of spec.fields) {
    if (x.key === "code" && x.prefix !== "*") errs.push("kod `*` bilan bo'lishi kerak");
    if (x.size > 72) errs.push(`${x.key}: ${x.size} pt > 72`);
    if (x.x < 0 || x.y < 0 || x.x + x.w > tpl.widthMm + 0.001 || x.y + x.h > tpl.heightMm + 0.001) {
      errs.push(`${x.key} yorliqdan chiqdi (${x.x},${x.y},${x.w},${x.h})`);
    }
  }
  const v = spec.fields;
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      const a = v[i], b = v[j];
      if (a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05) {
        errs.push(`${a.key} va ${b.key} ustma-ust`);
      }
    }
  }
  return errs;
}

export function buildShelf() {
  for (const k of SHELF_DESIGN_ORDER) if (!SHELF_DESIGNS[k]) throw new Error(`SHELF_DESIGN_ORDER da ortiqcha: ${k}`);
  for (const k of Object.keys(SHELF_DESIGNS)) if (!SHELF_DESIGN_ORDER.includes(k)) throw new Error(`SHELF_DESIGN_ORDER da yo'q: ${k}`);
  const out = [], bad = [];
  for (const key of SHELF_DESIGN_ORDER) {
    for (const [W, H] of SHELF_SIZES) {
      if (TAKEN.has(`${key}@${W}x${H}`)) continue;
      const sheet = isSheet(W, H);
      const tpl = { code: `shf_${key}_${W}x${H}`, kind: "SHELF", widthMm: W, heightMm: H,
        dpi: sheet ? 300 : 203, thermal: !sheet, name: SHELF_DESIGNS[key].name,
        spec: JSON.stringify(shelfLayout(key, W, H)) };
      const errs = check(tpl);
      if (errs.length) bad.push(`${tpl.code}:\n    ${errs.join("\n    ")}`);
      out.push(tpl);
    }
  }
  return { out, bad };
}

if (process.argv[1] && process.argv[1].endsWith("gen-shelf-templates.mjs")) {
  const { out, bad } = buildShelf();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const values = out.map((t) => `    (${sql(t.code)}, ${sql(t.name[0])}, ${sql(t.name[1])}, ${sql(t.name[2])}, `
    + `${t.widthMm}, ${t.heightMm}, ${t.dpi}, ${t.thermal}, ${sql(t.spec)})`).join(",\n");
  const body = `-- ══════════════════════════════════════════════════════════════════════════
-- JAVON YORLIQLARI — HAR DIZAYN HAR O'LCHAMDA (2026-10-03)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Egasining talabi: «javon yorliqlarini ham hamma o'lchamda qil».
--
-- ${SHELF_DESIGN_ORDER.length} dizayn × ${SHELF_SIZES.length} o'lcham: varaq o'lchamlari (70×37, 70×50, 100×60,
-- 148×105 — 300 dpi, lazer) va stiker rulonlari (V135 — 203 dpi, termal).
-- V131 dagi javon shablonlari o'z katagini egallaydi: jami ${out.length} ta yangi.
--
-- ⚠ BARKOD CHIZILMAYDI (G1, V134): javon yorlig'ida barkod o'rniga kassada
-- teriladigan qisqa kod \`*142\`. Narx — qolgan joyning hammasi.
--
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI. Uni frontend repodagi
--   scripts/gen-shelf-templates.mjs
-- hisoblaydi va yozishdan oldin har shablonni tekshiradi. Joylashuv o'zgarsa —
-- skript o'zgaradi va YANGI migratsiya yoziladi (Flyway checksum).
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO label_templates
    (code, kind, name, name_ru, name_en, width_mm, height_mm, dpi, thermal, spec,
     is_system, created_at)
SELECT v.code, 'SHELF', v.name, v.name_ru, v.name_en,
       v.width_mm, v.height_mm, v.dpi, v.thermal, v.spec::jsonb, true, now()
  FROM (VALUES
${values}
  ) AS v(code, name, name_ru, name_en, width_mm, height_mm, dpi, thermal, spec)
ON CONFLICT (code) WHERE is_system DO NOTHING;
`;
  const target = process.argv[2];
  if (target) { fs.writeFileSync(target, body); console.log(`✅ ${out.length} ta shablon → ${target}`); }
  else process.stdout.write(body);
}
