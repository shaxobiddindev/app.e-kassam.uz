/**
 * ══════════════════════════════════════════════════════════════════════════
 * STIKER DIZAYNLARI — HAR DIZAYN HAR O'LCHAMDA (V142, 2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Egasining talabi: «shablonlarni juda ko'paytir va bu shablonlar mavjud
 * hamma o'lchamda bo'lishi kerak».
 *
 * 14 dizayn × 9 rulon o'lchami. Har birini qo'lda chizish 126 ta koordinata
 * jadvali va 126 ta xato imkoniyati bo'lardi — ular olti oyda bir-biridan
 * ajralib ketardi. Shuning uchun dizayn — QOIDA (qaysi qator, qanday
 * shrift, nimani qachon tashlab yuborish), joylashuvni esa shu skript
 * hisoblaydi va natijani SQL migratsiyaga yozadi.
 *
 * ⚠ HAR SHABLON CHIQARISHDAN OLDIN TEKSHIRILADI va bittasi yiqilsa skript
 * hech narsa yozmaydi:
 *   · front `validateTemplate` — xato ham, ogohlantirish ham bo'lmasin;
 *   · renderer haqiqiy tovarlar bilan (kirill nom, EAN-13, do'kon kodi
 *     EAN-8, uzun nom) — barkod sig'masligi yoki matn toshishi bo'lmasin;
 *   · server qoidalari (`LabelTemplateSeedTest`): barkod ≥ 12 mm, EAN-13
 *     uchun yetarli kenglik, tinch zona 9/7, maydon yorliqdan chiqmasin.
 *
 * ⚠ KICHIK O'LCHAMDA DIZAYN YO'QOLMAYDI, SODDALASHADI: har qatorning
 * «tashlab yuborish navbati» bor (`drop`). 30×20 ga nom, sana va narx
 * barkod bilan birga sig'maydi — avval sana, keyin nom ketadi, barkod va
 * narx qoladi. Ya'ni dizayn har o'lchamda BOR (talab), lekin kichigida
 * faqat sig'adigani.
 *
 * Ishga tushirish (frontend papkasidan):
 *   node scripts/gen-sticker-templates.mjs ../../e-kassam/src/main/resources/db/migration/V142__sticker_designs.sql
 */
import fs from "node:fs";
import { validateTemplate } from "../src/lib/ek-label-validate.js";
import { renderLabel } from "../src/lib/ek-label-render.js";
import { barcodeMetrics, eanMinMm } from "../src/lib/ek-label-barcode.js";
import { DESIGN_ORDER } from "../src/lib/ek-sticker-auto.js";

/* Rulon o'lchamlari — `label_media_profiles` (V135) dagi stiker rulonlari. */
export const SIZES = [[58, 40], [58, 30], [60, 40], [50, 30], [40, 30], [40, 25], [30, 20],
  [100, 50], [100, 150]];

/* V131 dagi eski stikerlar shu katakni egallaydi — yangisi yasalmaydi. */
const TAKEN = new Set(["standard@40x30", "barcode_price@30x20", "expiry@58x40",
  "barcode_only@40x30", "code_first@40x30"]);
/* ⚠ ESKI STIKERLAR HAM YANGI QOIDADA (V147, 2026-10-05). Ilgari ularning
   joylashuvi «ishlab turibdi» deb tegilmasdi — natijada 30×20 dagi «Barkod
   va narx» (eng ko'p ishlatiladigan kichik stiker) 11 pt narx bilan qolib,
   bo'sh joydan foydalanmasdi. Kod va nom o'zgarmaydi, faqat joylashuv. */
export const LEGACY_CELLS = {
  "standard@40x30": "sticker_standard", "barcode_price@30x20": "sticker_small",
  "expiry@58x40": "sticker_expiry", "barcode_only@40x30": "sticker_barcode_only",
  "code_first@40x30": "sticker_code_first",
};

export const PT = 0.352778;
const DPI = 203;
export const r1 = (n) => Math.round(n * 10) / 10;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Bir qator matn balandligi — `validateTemplate` dagi formula (1,2) + zaxira. */
export const textH = (size, lines = 1) => r1(lines * size * PT * 1.25 + 0.4);
/** EAN-13 tinch zonasi bilan (mm). */
const eanWidth = (dots) => (95 + 9 + 7) * dots * 25.4 / DPI;

/* ── Qatorlar ───────────────────────────────────────────────────────── */
const text = (key, size, o = {}) => ({ type: "text", key, size, weight: 700, align: "center",
  overflow: "shrink", ...o });
const price = (size, o = {}) => text("price", size, { weight: 900, style: "major-minor", ...o });
const pair = (left, right, size, o = {}) => ({ type: "pair", left, right, size, ...o });
const BARCODE = { type: "barcode" };

/**
 * DIZAYNLAR. `rows(k)` — k: o'lcham koeffitsiyenti (58×40 = 1).
 * `drop` — kattaroq son birinchi tashlanadi (0 — hech qachon).
 */
export const DESIGNS = {
  standard: {
    name: ["Standart", "Стандарт", "Standard"],
    rows: (k) => [text("nameShort", fs9(k), { drop: 2 }), BARCODE, price(fs15(k))],
  },
  big_price: {
    name: ["Narx yirik", "Крупная цена", "Big price"],
    /* `min: 13` — narx yirikligicha qoladi, sig'masa nom ketadi (dizaynning ma'nosi). */
    rows: (k) => [text("nameShort", fs8(k), { drop: 2, weight: 600 }), price(fs22(k), { min: 13 }), BARCODE],
  },
  price_top: {
    name: ["Narx tepada", "Цена сверху", "Price on top"],
    rows: (k) => [price(fs18(k)), text("nameShort", fs8(k), { drop: 2 }), BARCODE],
  },
  name_big: {
    name: ["Nom yirik", "Крупное название", "Big name"],
    rows: (k) => [text("nameShort", fs12(k), { weight: 800 }), BARCODE, price(fs11(k), { drop: 1 })],
  },
  barcode_price: {
    name: ["Barkod va narx", "Штрих-код и цена", "Barcode and price"],
    rows: (k) => [BARCODE, price(fs15(k))],
  },
  barcode_only: {
    name: ["Faqat barkod", "Только штрих-код", "Barcode only"],
    rows: () => [BARCODE],
  },
  code_first: {
    name: ["Kod yirik", "Крупный код", "Big code"],
    rows: (k) => [text("code", fs18(k), { weight: 900, prefix: "*", min: 12 }), BARCODE,
      price(fs10(k), { drop: 1 })],
  },
  side: {
    name: ["Yonma-yon", "Рядом", "Side by side"],
    side: true,
    rows: (k) => [text("nameShort", fs9(k), { drop: 2 }), BARCODE, price(fs15(k))],
    /* ⚠ YONMA-YON SIG'MASA (eni < ~51 mm) — «Standart» ning nusxasi emas:
       narx chapda, kod o'ngda bir qatorda. Ilgari bu o'lchamlarda ikki
       dizayn bir xil chiqardi (V144). */
    fallback: (k) => [pair(price(fs12(k), { align: "left" }),
      text("code", fs10(k), { weight: 900, align: "right", prefix: "*" }), fs12(k)),
      BARCODE, text("nameShort", fs8(k), { drop: 2 })],
  },
  framed: {
    name: ["Ramkali", "В рамке", "Framed"],
    border: 0.3,
    rows: (k) => [text("nameShort", fs9(k), { drop: 2 }), BARCODE, price(fs14(k))],
  },
  shop: {
    name: ["Do'kon nomi bilan", "С названием магазина", "With shop name"],
    /* ⚠ Do'kon nomi — dizaynning ma'nosi: joy yetmasa avval tovar nomi ketadi. */
    rows: (k) => [text("shopName", fs7(k), { weight: 800, drop: 1 }),
      text("nameShort", fs8(k), { weight: 600, drop: 3 }), BARCODE, price(fs14(k))],
  },
  bilingual: {
    name: ["Ikki tilli", "Двуязычный", "Bilingual"],
    /* ⚠ JOY YETMASA AVVAL NARX KETADI (V144): ikki tilli dizaynning ma'nosi —
       ikki nom; ilgari kichik stikerda ruscha nom ketib, «Standart» qolardi. */
    rows: (k) => [text("nameShort", fs8(k), { drop: 3 }), text("nameRu", fs8(k), { drop: 2, weight: 600 }),
      BARCODE, price(fs14(k), { drop: 4 })],
  },
  brand: {
    name: ["Brend va davlat", "Бренд и страна", "Brand and country"],
    rows: (k) => [pair(text("brand", fs7(k), { align: "left" }), text("country", fs7(k), { align: "right" }),
      fs7(k), { drop: 2 }), text("nameShort", fs8(k), { drop: 3 }), BARCODE, price(fs14(k))],
  },
  expiry: {
    name: ["Muddatli", "Со сроком", "With expiry"],
    rows: (k) => [text("nameShort", fs8(k), { drop: 3 }),
      pair(text("producedAt", fs7(k), { align: "left", weight: 600 }),
        text("expiry", fs7(k), { align: "right" }), fs7(k), { drop: 2 }),
      BARCODE, price(fs13(k))],
  },
  clothing: {
    name: ["Kiyim", "Одежда", "Clothing"],
    hole: true,
    rows: (k) => [text("nameShort", fs8(k), { drop: 3 }),
      pair(text("size", fs12(k), { weight: 900 }), text("color", fs8(k)), fs12(k), { drop: 2 }),
      BARCODE, price(fs14(k))],
  },
};

/* Shrift o'lchamlari koeffitsiyent bilan, chegaralangan. */
const fsN = (base, lo, hi) => (k) => Math.round(clamp(base * k, lo, hi));
const fs7 = fsN(7, 5, 14), fs8 = fsN(8, 6, 16), fs9 = fsN(9, 6, 18), fs10 = fsN(10, 7, 20);
const fs11 = fsN(11, 7, 22), fs12 = fsN(12, 8, 24), fs13 = fsN(13, 8, 26), fs14 = fsN(14, 8, 28);
const fs15 = fsN(15, 9, 30), fs18 = fsN(18, 10, 36), fs22 = fsN(22, 11, 44);

/* ══ NOM — IKKI QATORLIK JOY (2026-10-06) ═══════════════════════════════
   Egasi: «uzun nomlar sig'mayapti». Nom maydoni bir qatorlik edi va uzun
   nom 4 pt gacha kichrayardi (qog'ozda nuqtalar) yoki chetdan kesilardi.
   Endi nom maydoni IKKI qator sig'adigan balandlikda (asl shriftning 80% i,
   5 pt dan kichik emas); qisqa nom bitta qatorda, maydon o'rtasida turadi,
   uzuni rendererda ikki qatorga bo'linadi (`fitLines`). Narx va kod bundan
   keyin qolgan joyni oladi (`growKeyRows`). */
const NAME_KEYS = new Set(["nameShort", "name", "nameRu"]);
/* ⚠ Ikki qatorlik joy SIG'SAGINA: kichik stikerda (30×20) u boshqa qatorni
   (do'kon nomi, ruscha nom) siqib chiqarardi — `layout` ikkala variantni
   hisoblab, maydoni ko'pini oladi. */
let TWO_LINE = true;
const nameH = (size) => (TWO_LINE ? r1(2 * Math.max(5, size * 0.8) * PT * 1.12 + 0.2) : textH(size));
const isName = (row) => row.type !== "pair" && row.type !== "barcode" && NAME_KEYS.has(row.key);
const rowH = (row) => (row.type === "barcode" ? 0 : isName(row) ? nameH(row.size) : textH(row.size));

/**
 * Narx kengligi: «1 250 000» (9 belgi) qatorga sig'sin. Renderer narxning
 * kengligini tekshirmaydi (`drawPrice`), shuning uchun shu yerda.
 */
const fitPrice = (row, w) => {
  if (row.key !== "price") return row;
  const max = Math.floor(w / (9 * PT * 0.6));
  return { ...row, size: Math.min(row.size, max) };
};

/* ══ BO'SH JOY — NARX VA KODGA (2026-10-05) ════════════════════════════
   Egasi: «qog'oz o'lchamidan maksimal samarali foydalanish kerak, narx va
   *kod kattaroq ko'rinsin agar bo'sh joy bo'lsa».

   ⚠ ILGARI ORTIQCHA JOY QATORLAR ORASIGA BO'LINARDI: 58×40 da 9 pt nom,
   18 mm barkod va 15 pt narx o'rtasida 2–3 mm bo'shliqlar qolardi, narx
   esa kichikligicha turardi. Xaridor stikerdan birinchi navbatda narxni,
   kassir esa *kodni qidiradi — bo'sh joy aynan ularga berilishi kerak.

   Tartib: narx va kod navbatma-navbat 1 pt dan o'sadi, toki (1) barkodga
   `bhTarget` dan kam joy qolmaguncha, (2) eniga sig'guncha, (3) asl
   o'lchamining 1,8 baravarigacha. En: to'liq qatorda narx 9 belgiga
   («1 250 000» yoki «125 000 so'm»), yarim qatorda (`pair`) 7 belgiga,
   kod 5 belgiga («*1427»). Uzunrog'i rendererda o'zi kichrayadi
   (`overflow: shrink`, narxda — `drawPrice`), ya'ni toshmaydi.
   Barkod `bhTarget` gacha qisqarishi mumkin: H × 0,4, lekin kichik stikerda
   10 mm, kattasida 12 mm dan past emas — skaner uchun yetarli. */
const CODE_CHARS = 5;
const capFor = (row, w, narrow = false) => {
  const byWidth = row.key === "price" ? Math.floor(w / ((narrow ? 7 : 9) * PT * 0.6))
    : Math.floor(w / (CODE_CHARS * PT * 0.6));
  return Math.min(byWidth, Math.round((row.base ?? row.size) * 1.8));
};
const bumpOne = (row, w, narrow = false) => {
  const cap = capFor(row, w, narrow);
  return row.size + 1 > cap ? row : { ...row, base: row.base ?? row.size, size: row.size + 1 };
};
/** Qatorda shu kalitli matn bo'lsa — 1 pt kattaroq nusxasi, aks holda o'zi. */
const bumpRow = (row, key, w, half) => {
  if (row.type === "pair") {
    const left = row.left.key === key ? bumpOne(row.left, half, true) : row.left;
    const right = row.right.key === key ? bumpOne(row.right, half, true) : row.right;
    return left === row.left && right === row.right ? row
      : { ...row, left, right, size: Math.max(left.size, right.size) };
  }
  return row.key === key ? bumpOne(row, w) : row;
};
function growKeyRows(rows, ok, w, half) {
  let cur = rows;
  for (let guard = 0; guard < 100; guard++) {
    let moved = false;
    for (const key of ["price", "code"]) {
      const i = cur.findIndex((x) => bumpRow(x, key, w, half) !== x);
      if (i < 0) continue;
      const next = cur.map((x, j) => (j === i ? bumpRow(x, key, w, half) : x));
      if (!ok(next)) continue;
      cur = next;
      moved = true;
    }
    if (!moved) break;
  }
  return cur;
}

/** Bitta dizaynni bitta o'lchamga joylaydi → spec (nom ikki qatorli, sig'masa — bir qatorli). */
export function layout(designKey, W, H) {
  TWO_LINE = true;
  const two = layoutOnce(designKey, W, H);
  TWO_LINE = false;
  const one = layoutOnce(designKey, W, H);
  TWO_LINE = true;
  return two.fields.length >= one.fields.length ? two : one;
}

function layoutOnce(designKey, W, H) {
  const d = DESIGNS[designKey];
  /* ⚠ BALAND YORLIQDA (100×150) KOEFFITSIYENT KATTAROQ: eni bo'yicha
     hisoblanganda shrift kichik qolib, yorliqning uchdan ikkisi bo'sh edi. */
  const k = clamp(Math.min(W / 58, H / 40) * (H > 100 ? 1.25 : 1), 0.7, 2.4);
  /* ⚠ KICHIK STIKER (bo'yi ≤ 25 mm): barkod 10 mm (`eanMinMm`), chekka va
     qatorlar orasi zichroq — aks holda 30×20 da 14 dizaynning hammasi
     «barkod + raqam» bo'lib qolardi (egasi, 2026-10-04). */
  const small = H <= 25;
  const bcMin = eanMinMm("STICKER", H);
  const pad = small ? 0.8 : W <= 32 || H <= 22 ? 1 : W <= 42 ? 1.5 : 2;
  const inner = d.border ? pad + 0.6 : pad;
  const fields = [];
  const iw = W - 2 * inner;
  const sideFits = d.side && W - 2 - eanWidth(2) - 1 - inner >= 18;
  const half = r1((iw - 1) / 2);
  let rows = (d.side && !sideFits && d.fallback ? d.fallback(k) : d.rows(k))
    .map((row) => (row.type === "pair" ? { ...row, left: fitPrice(row.left, half) } : fitPrice(row, iw)));

  /* Teshik (kiyim yorlig'i) — faqat baland yorliqda, yuqori markazda. */
  let top = inner;
  if (d.hole && H >= 40) {
    const hw = r1(clamp(W * 0.18, 6, 14)), hh = r1(clamp(H * 0.12, 5, 10));
    fields.push({ key: "punchHole", x: r1((W - hw) / 2), y: r1(inner), w: hw, h: hh,
      visible: true, shape: "hole" });
    top = inner + hh + 0.6;
  }

  /* ⚠ BARKOD ENI: tinch zona bilan EAN-13. 3 nuqtali modul skanerga
     osonroq, lekin 41,6 mm talab qiladi — sig'sagina. Barkod yon chekkaga
     1 mm gacha boradi: tinch zona barkodning o'z ichida. */
  const bcSlot = W - 2;
  const side = sideFits;
  const dots = (side ? (W >= 90 ? 3 : 2) : (bcSlot >= eanWidth(3) + 0.2 ? 3 : 2));

  if (side) {
    const bw = r1(eanWidth(dots) + 0.4);
    const bh = r1(clamp(H - 2 * inner, 12, 32));
    fields.push({ key: "barcode", x: 1, y: r1((H - bh) / 2), w: bw, h: bh, visible: true,
      align: "center" });
    const rx = r1(1 + bw + 1), rw = r1(W - rx - inner);
    const totalOf = (list) => list.reduce((s, x) => s + rowH(x), 0) + 0.8 * (list.length - 1);
    const texts = growKeyRows(rows.filter((x) => x.type !== "barcode").map((row) => fitPrice(row, rw)),
      (list) => totalOf(list) <= H - 2 * inner, rw, rw);
    const total = totalOf(texts);
    let y = Math.max(inner, (H - total) / 2);
    for (const row of texts) {
      const h = rowH(row);
      fields.push(textField(row, rx, y, rw, h));
      y += h + 0.8;
    }
    return spec(fields, dots, d.border, H);
  }

  /* ── Ustma-ust (stack) ──
     ⚠ AVVAL KICHRAYTIRISH, KEYIN TASHLASH (V144). Ilgari qator darhol
     tashlanardi va 30×20 da hamma dizayn «barkod + narx» bo'lib qolardi.
     Endi har qator o'z chegarasigacha (`min`, odatda 6 pt; narx 7 pt)
     kichrayadi; shunda ham sig'masa — bitta qator ketadi va qolganlari ASL
     o'lchamidan qayta hisoblanadi (aks holda bo'shagan joyda ham mayda
     qolardi). Kichik stikerda qator balandligi zichroq (1,2 × shrift). */
  const ih = H - top - inner;
  const gap = small ? 0.3 : 0.6;
  const sizeOfRow = (x) => (x.type === "pair" ? Math.max(x.left.size, x.right.size) : x.size);
  const tH = (size) => (small ? r1(size * PT * 1.2 + 0.15) : textH(size));
  const rH = (x) => (x.type === "barcode" ? 0 : isName(x) ? nameH(x.size) : tH(sizeOfRow(x)));
  const floorOf = (x) => x.min ?? (x.key === "price" ? 7 : 6);
  const fixed = (list) => list.reduce((s, x) => s + rH(x), 0) + gap * (list.length - 1);
  const shrink = (x) => (x.type === "pair"
    ? { ...x, left: { ...x.left, size: Math.max(floorOf(x.left), x.left.size - 1) },
      right: { ...x.right, size: Math.max(floorOf(x.right), x.right.size - 1) } }
    : { ...x, size: x.size - 1 });
  const canShrink = (x) => x.type !== "barcode" && (x.type === "pair"
    ? x.left.size > floorOf(x.left) || x.right.size > floorOf(x.right)
    : x.size > floorOf(x));
  let base = rows;
  for (;;) {
    let cur = base;
    while (ih - fixed(cur) < bcMin) {
      const big = cur.filter(canShrink).sort((a, b) => sizeOfRow(b) - sizeOfRow(a))[0];
      if (!big) break;
      cur = cur.map((x) => (x === big ? shrink(x) : x));
    }
    if (ih - fixed(cur) >= bcMin) { rows = cur; break; }
    const victim = base.filter((x) => x.drop).sort((a, b) => b.drop - a.drop)[0];
    if (!victim) { rows = cur; break; }
    base = base.filter((x) => x !== victim);
  }
  const bhTarget = r1(clamp(H * 0.4, bcMin, W >= 90 ? 40 : 18));
  rows = growKeyRows(rows, (list) => ih - fixed(list) >= bhTarget, iw, half);
  const room = ih - fixed(rows);
  if (room < bcMin) throw new Error(`${designKey} ${W}x${H}: barkodga ${r1(room)} mm qoldi`);
  /* Barkod eni modul bilan cheklangan (2–3 nuqta), balandligi esa yo'q:
     katta yorliqda baland barkod uzoqdan ham, qiyshiq ham o'qiladi. */
  const bh = r1(Math.min(room, clamp(H * 0.45, bcMin, W >= 90 ? 48 : 32)));
  /* Ortiqcha joy qatorlar orasiga teng bo'linadi — stiker «tepaga
     yopishib», pastda bo'sh qolmasin. */
  const spare = room - bh;
  const g = gap + (rows.length > 1 ? spare / (rows.length + 1) : spare / 2);
  let y = top + (rows.length > 1 ? g - gap : spare / 2);
  for (const row of rows) {
    if (row.type === "barcode") {
      fields.push({ key: "barcode", x: 1, y: r1(y), w: r1(bcSlot), h: bh, visible: true,
        align: "center" });
      y += bh + g;
      continue;
    }
    const h = rH(row);
    if (row.type === "pair") {
      fields.push(textField({ ...row.left, size: row.left.size }, inner, y, half, h));
      fields.push(textField({ ...row.right, size: row.right.size }, r1(inner + half + 1), y, half, h));
    } else {
      fields.push(textField(row, inner, y, iw, h));
    }
    y += h + g;
  }
  return spec(fields, dots, d.border, H);
}

function textField(row, x, y, w, h) {
  const f = { key: row.key, x: r1(x), y: r1(y), w: r1(w), h: r1(h), visible: true,
    size: row.size, weight: row.weight, align: row.align, overflow: row.overflow, lines: 1 };
  if (row.style) f.style = row.style;
  if (row.prefix) f.prefix = row.prefix;
  if (row.key === "price") delete f.overflow;
  return f;
}

function spec(fields, dots, border) {
  return {
    lang: "uz", padding: 1,
    border: { widthMm: border || 0, color: "#000000" },
    background: "#ffffff",
    barcode: { moduleDots: dots, heightMm: 12, quietLeftModules: 9, quietRightModules: 7,
      showText: true, orientation: "horizontal" },
    fields,
  };
}

/* ── Tekshiruv ──────────────────────────────────────────────────────── */
const SAMPLES = [
  { id: 1, name: "Сахар песок 1кг", nameShort: "Сахар песок 1кг", nameRu: "Сахар песок 1кг",
    salePrice: 12500, barcode: "4780000000007", searchCode: "101", brand: "Makfa", country: "Rossiya",
    expiryDate: "01.12.2026", producedAt: "01.09.2026", sizeLabel: "XL", colorName: "Qora" },
  { id: 2, name: "Parda tyul 3 metr", salePrice: 1250000, barcode: "20001421", searchCode: "142" },
];
/* Uzun nom — faqat «o'qib bo'lmaydigan darajada kichraydi» ogohlantirishiga
   ruxsat: bu nomning o'zi aybdor, dizayn emas. */
const LONG = { id: 3, name: "Shampun Head&Shoulders Ментол против перхоти 400 мл", salePrice: 45900,
  barcode: "4780000000007", searchCode: "99999" };

function check(tpl) {
  const errs = [];
  for (const e of validateTemplate(tpl)) errs.push(`validate ${e.level}: ${e.text}`);
  const spec = JSON.parse(tpl.spec);
  for (const p of SAMPLES) {
    for (const w of renderLabel(tpl, p, { shopName: "Chilonzor do'koni" }).warnings) {
      errs.push(`render(${p.id}) ${w.code}: ${w.text}`);
    }
  }
  /* Juda uzun nom (50 belgi) — «…» bilan qisqarishiga ruxsat (2026-10-06):
     u chetdan chiqmaydi, toza kesiladi. Oddiy nomlar (SAMPLES) esa kesilmasligi shart. */
  for (const w of renderLabel(tpl, LONG, {}).warnings) {
    if (w.code !== "TEXT_TINY" && w.code !== "TEXT_CLIPPED") errs.push(`render(long) ${w.code}: ${w.text}`);
  }
  const bc = spec.fields.find((f) => f.key === "barcode");
  if (!bc) errs.push("barkod yo'q");
  else {
    const need = eanMinMm("STICKER", tpl.heightMm);
    if (bc.h + 0.001 < need) errs.push(`barkod ${bc.h} mm < ${need}`);
    if (bc.w + 0.001 < eanWidth(spec.barcode.moduleDots)) errs.push(`barkod eni ${bc.w} mm yetmaydi`);
    const m = barcodeMetrics("4780000000007", { dpi: DPI, moduleDots: spec.barcode.moduleDots,
      quietLeftModules: 9, quietRightModules: 7, heightMm: bc.h, labelKind: "STICKER",
      labelHeightMm: tpl.heightMm });
    if (!m?.ok) errs.push("barkod metrikasi ok emas");
  }
  for (const f of spec.fields) {
    if (f.x < 0 || f.y < 0 || f.x + f.w > tpl.widthMm + 0.001 || f.y + f.h > tpl.heightMm + 0.001) {
      errs.push(`${f.key} yorliqdan chiqdi (${f.x},${f.y},${f.w},${f.h})`);
    }
  }
  /* Ustma-ust tushish: yonma-yon turgan ikki maydon bir-birini qoplamasin. */
  const vis = spec.fields;
  for (let i = 0; i < vis.length; i++) {
    for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05) {
        errs.push(`${a.key} va ${b.key} ustma-ust`);
      }
    }
  }
  return errs;
}

export function build() {
  const keys = Object.keys(DESIGNS);
  if (keys.join() !== [...DESIGN_ORDER].sort().join() && new Set(keys).size !== DESIGN_ORDER.length) {
    throw new Error("DESIGNS va DESIGN_ORDER mos emas");
  }
  for (const k of DESIGN_ORDER) if (!DESIGNS[k]) throw new Error(`DESIGN_ORDER da ortiqcha: ${k}`);
  for (const k of keys) if (!DESIGN_ORDER.includes(k)) throw new Error(`DESIGN_ORDER da yo'q: ${k}`);

  const out = [];
  const bad = [];
  const legacy = [];
  for (const key of DESIGN_ORDER) {
    for (const [W, H] of SIZES) {
      if (TAKEN.has(`${key}@${W}x${H}`)) {
        const code = LEGACY_CELLS[`${key}@${W}x${H}`];
        const tpl = { code, kind: "STICKER", widthMm: W, heightMm: H, dpi: DPI, thermal: true,
          name: DESIGNS[key].name, spec: JSON.stringify(layout(key, W, H)) };
        const errs = check(tpl);
        if (errs.length) bad.push(`${code}:\n    ${errs.join("\n    ")}`);
        legacy.push(tpl);
        continue;
      }
      const s = layout(key, W, H);
      const tpl = { code: `stk_${key}_${W}x${H}`, kind: "STICKER", widthMm: W, heightMm: H,
        dpi: DPI, thermal: true, name: DESIGNS[key].name, spec: JSON.stringify(s) };
      const errs = check(tpl);
      if (errs.length) bad.push(`${tpl.code}:\n    ${errs.join("\n    ")}`);
      out.push(tpl);
    }
  }
  return { out, bad, legacy };
}

export const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

if (process.argv[1] && process.argv[1].endsWith("gen-sticker-templates.mjs") && !String(process.argv[2] || "").startsWith("--")) {
  const { out, bad } = build();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const target = process.argv[2];
  const values = out.map((t) => `    (${sql(t.code)}, ${sql(t.name[0])}, ${sql(t.name[1])}, ${sql(t.name[2])}, `
    + `${t.widthMm}, ${t.heightMm}, ${sql(t.spec)})`).join(",\n");
  const body = `-- ══════════════════════════════════════════════════════════════════════════
-- STIKER DIZAYNLARI — HAR DIZAYN HAR O'LCHAMDA (2026-10-03)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Egasining talabi: «shablonlarni juda ko'paytir va bu shablonlar mavjud
-- hamma o'lchamda bo'lishi kerak».
--
-- ${DESIGN_ORDER.length} dizayn × ${SIZES.length} rulon o'lchami (V135 dagi stiker rulonlari).
-- V131 dagi beshta stiker o'z katagini egallaydi va yangisi yasalmaydi:
-- jami ${out.length} ta yangi tizim shabloni.
--
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI. Uni frontend repodagi
--   scripts/gen-sticker-templates.mjs
-- hisoblaydi va yozishdan oldin har shablonni tekshiradi (front validatsiya,
-- renderer haqiqiy tovarlar bilan, barkod ≥ 12 mm, EAN-13 eni). Joylashuvni
-- o'zgartirish kerak bo'lsa — skript o'zgaradi va YANGI migratsiya yoziladi.
--
-- ⚠ \`ON CONFLICT DO NOTHING\`: qayta yurgizilsa nusxa yaratmaydi. Tizim
-- shabloni tahrirlanmaydi — do'kon «nusxa olib tahrirlash» bilan o'ziniki qiladi.
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

-- ── Eski stikerlar — dizayn nomi bilan ────────────────────────────────────
-- ⚠ O'lcham nomdan olinadi: endi har dizayn har o'lchamda bor va o'lcham
-- kartochkada alohida ko'rsatiladi. «Standart 40×30» yonida «Standart»
-- (58×40) turganda ikkalasi ikki xil narsa deb o'qilardi.
-- Joylashuvi (spec) TEGILMAYDI — ular ishlab turibdi va chop etilgan.
${Object.entries({ sticker_standard: "standard", sticker_small: "barcode_price", sticker_expiry: "expiry",
    sticker_barcode_only: "barcode_only", sticker_code_first: "code_first", sticker_clothing: "clothing" })
    .map(([code, d]) => `UPDATE label_templates SET name = ${sql(DESIGNS[d].name[0])}, name_ru = ${sql(DESIGNS[d].name[1])}, `
      + `name_en = ${sql(DESIGNS[d].name[2])}, updated_at = now()\n WHERE is_system AND code = ${sql(code)};`).join("\n")}
`;
  if (target) {
    fs.writeFileSync(target, body);
    console.log(`✅ ${out.length} ta shablon → ${target}`);
  } else {
    process.stdout.write(body);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   V144 — O'ZGARGAN JOYLASHUVLAR (2026-10-04)

   ⚠ V142 SERVERDA QO'LLANGAN va qayta yozilmaydi (Flyway checksum). Joylashuv
   qoidasi o'zgarganda (kichik stikerda barkod 10 mm, «avval kichraytir»)
   generator V142 dagi spec bilan solishtiradi va FAQAT farq qilganlarini
   UPDATE qiladi. Kod va nomlar o'zgarmaydi.

   node scripts/gen-sticker-templates.mjs --update <V142.sql> <V144.sql>
   ══════════════════════════════════════════════════════════════════════ */
export function specsIn(sqlText) {
  const map = new Map();
  for (const m of sqlText.matchAll(/\('(stk_[a-z_]+_\d+x\d+)',[^\n]*?'(\{[^\n]*\})'\)/g)) {
    map.set(m[1], m[2].replace(/''/g, "'"));
  }
  /* `sticker_*` — V131 dagi eski stikerlar (V147 dan beri ular ham generatordan). */
  for (const m of sqlText.matchAll(/SET spec = '(\{[^\n]*\})'::jsonb[^\n]*\n\s*WHERE is_system AND code = '((?:stk_[a-z_]+_\d+x\d+)|(?:sticker_[a-z_]+))'/g)) {
    map.set(m[2], m[1].replace(/''/g, "'"));
  }
  return map;
}

/* ══════════════════════════════════════════════════════════════════════
   KEYINGI MIGRATSIYA — UMUMIY (2026-10-06)

   ⚠ Har qoida o'zgarishi uchun yangi `--vNNN` rejimi yozish o'rniga: oldingi
   migratsiyalarni ketma-ket o'qiydi (oxirgisi ustun) va FAQAT farq qilgan
   shablonlarni (yangi va eski V131) UPDATE qiladi. Sarlavha — `--note` matni.

   node scripts/gen-sticker-templates.mjs --next <chiqish.sql> "<sarlavha>" <V142.sql> <V144.sql> <V147.sql> …
   ══════════════════════════════════════════════════════════════════════ */
if (process.argv[2] === "--next") {
  const { out, bad, legacy } = build();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const [, , , target, note, ...bases] = process.argv;
  const old = new Map();
  for (const f of bases) for (const [k, v] of specsIn(fs.readFileSync(f, "utf8"))) old.set(k, v);
  const changed = [...out, ...legacy].filter((t) => old.get(t.code) !== t.spec);
  const body = `-- ══════════════════════════════════════════════════════════════════════════
${String(note).split("\n").map((l) => `-- ${l}`.trimEnd()).join("\n")}
--
-- ${changed.length} ta shablonning joylashuvi yangilanadi. Kod va nomlar o'zgarmaydi.
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI: frontend repodagi
--   scripts/gen-sticker-templates.mjs --next
-- ══════════════════════════════════════════════════════════════════════════

${changed.map((t) => `UPDATE label_templates SET spec = ${sql(t.spec)}::jsonb, version = version + 1, updated_at = now()\n WHERE is_system AND code = ${sql(t.code)};`).join("\n")}
`;
  fs.writeFileSync(target, body);
  console.log(`✅ ${changed.length} ta o'zgargan shablon → ${target}`);
}

if (process.argv[2] === "--update") {
  const { out, bad } = build();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const old = specsIn(fs.readFileSync(process.argv[3], "utf8"));
  const changed = out.filter((t) => old.get(t.code) !== t.spec);
  const body = `-- ══════════════════════════════════════════════════════════════════════════
-- STIKER DIZAYNLARI — KICHIK O'LCHAMDA HAM HAR XIL (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Egasi 30×20 da tekshirdi: «bularning birortasi yo'q, asosan faqat shtrix
-- kod va raqami». Sabab: barkod har doim ≥ 12 mm edi va 20 mm stikerda
-- generator nom, sana, do'kon nomi kabi qatorlarni TASHLAB yuborardi —
-- 14 dizaynning deyarli hammasi «barkod + narx» bo'lib qolardi.
--
-- O'zgargan qoida (frontend: scripts/gen-sticker-templates.mjs):
--   · bo'yi ≤ 25 mm stikerda barkod ≥ 10 mm (chiziqlar ~7,4 mm + raqamlar);
--   · avval shrift kichrayadi (6 pt / narx 7 pt gacha), keyin qator ketadi;
--   · har dizaynning asosiy elementi (do'kon nomi, brend, sana, o'lcham)
--     eng oxirida ketadi; «Yonma-yon» sig'magan joyda o'z ko'rinishiga ega.
--
-- ${changed.length} ta shablonning joylashuvi yangilanadi. Kod va nomlar o'zgarmaydi.
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI.
-- ══════════════════════════════════════════════════════════════════════════

${changed.map((t) => `UPDATE label_templates SET spec = ${sql(t.spec)}::jsonb, version = version + 1, updated_at = now()\n WHERE is_system AND code = ${sql(t.code)};`).join("\n")}
`;
  fs.writeFileSync(process.argv[4], body);
  console.log(`✅ ${changed.length} ta o'zgargan shablon → ${process.argv[4]}`);
}

/* ══════════════════════════════════════════════════════════════════════
   V147 — NARX VA KOD KATTAROQ, 30×20 BIR QATORLI RULON (2026-10-05)

   node scripts/gen-sticker-templates.mjs --v147 <V142.sql> <V144.sql> <V147.sql>
   ══════════════════════════════════════════════════════════════════════ */
if (process.argv[2] === "--v147") {
  const { out, bad, legacy } = build();
  if (bad.length) {
    console.error(`❌ ${bad.length} ta shablon tekshiruvdan o'tmadi:\n  ${bad.join("\n  ")}`);
    process.exit(1);
  }
  const old = specsIn(fs.readFileSync(process.argv[3], "utf8"));
  for (const [k, v] of specsIn(fs.readFileSync(process.argv[4], "utf8"))) old.set(k, v);
  const changed = out.filter((t) => old.get(t.code) !== t.spec);
  const upd = (t) => `UPDATE label_templates SET spec = ${sql(t.spec)}::jsonb, version = version + 1, updated_at = now()\n WHERE is_system AND code = ${sql(t.code)};`;
  const body = `-- ══════════════════════════════════════════════════════════════════════════
-- STIKER: NARX VA KOD KATTAROQ, 30×20 BIR QATORLI RULON (2026-10-05)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Egasi: «4 ta kiritilsa 2 ta stiker chiqyapti», «ba'zi yozuvlar tagidan
-- kesilgan», «qog'ozdan maksimal foydalanish kerak, narx va *kod kattaroq
-- ko'rinsin, narx yonida so'm bo'lsin».
--
-- 1. ⚠ 30×20 BIR QATORLI RULON YO'Q EDI. V135 da 30×20 faqat «2 qatorda» va
--    «3 qatorda» bor edi, sozlashdagi katta «30 × 20» tugmasi esa jimgina
--    «2 qatorda» ni tanlardi. Bir ustunli rulonda har qator 62 mm chizilib,
--    o'ng stiker qog'ozdan tashqariga tushardi: 4 ta → 2 ta. Endi bir qatorli
--    profil bor va «2 qatorda» tanlagan do'konlar bir qatorliga o'tkaziladi —
--    haqiqatan ikki qatorli rulon ishlatayotgan do'kon sozlashda «Bir qatorda:
--    2» ni bir marta tanlaydi (bunda stiker yo'qolmaydi, faqat o'ng ustun bo'sh
--    qoladi — teskarisidan ancha yengil).
-- 2. Shablonlar: bo'sh joy endi narx va *kodga beriladi (generatorda
--    \`growKeyRows\`). ${changed.length} ta yangi va ${legacy.length} ta eski (V131) stiker.
--    «so'm» narx yonida — rendererda, sig'sagina.
--
-- ⚠ BU FAYL QO'LDA TAHRIRLANMAYDI: frontend repodagi
--   scripts/gen-sticker-templates.mjs --v147
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO label_media_profiles
    (code, name, name_ru, name_en, media_type, label_width_mm, label_height_mm,
     across, gap_x_mm, gap_y_mm, liner_width_mm, page_width_mm, page_height_mm,
     sensor, is_system, created_at)
VALUES
    ('roll_30x20', 'Rulon 30×20', 'Рулон 30×20', 'Roll 30×20',
     'RULON', 30, 20, 1, 0, 2, 32, NULL, NULL, 'ORALIQ', true, now())
ON CONFLICT (code) WHERE is_system DO NOTHING;

UPDATE label_output_settings
   SET media_profile_id = (SELECT id FROM label_media_profiles WHERE is_system AND code = 'roll_30x20'),
       updated_at = now()
 WHERE media_profile_id = (SELECT id FROM label_media_profiles WHERE is_system AND code = 'roll_30x20_2');

${changed.map(upd).join("\n")}

-- ── Eski (V131) stikerlar — kod va nom o'zgarmaydi ──────────────────────────
${legacy.map(upd).join("\n")}
`;
  fs.writeFileSync(process.argv[5], body);
  console.log(`✅ ${changed.length} + ${legacy.length} ta shablon → ${process.argv[5]}`);
}
