/* ══════════════════════════════════════════════════════════════════════════
   OSHXONA CHEKI (R4, 2026-10-08, docs/22-RESTORAN.md)

   Sotuv tugagach taomlar toifaning BO'LIMI bo'yicha guruhlanadi («Oshxona»,
   «Bar») va har bo'lim o'z printeriga chiqadi. Printer — qurilma sozlamasi
   (`ek_hw.stations`), bo'lim nomi — toifada (serverda, V151).

   ⚠ KASSA QURILMASIDA, server emas: internet uzilganda ham oshxona
   buyurtmani olishi shart (5-qoida) — sotuv oflayn navbatga tushadi,
   oshxona cheki esa darhol chiqadi.

   ⚠ SOF MANTIQ, DOM YO'Q — Node'da sinaladi (`test/kitchen.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */
import { Receipt, WIDTH_80, WIDTH_58 } from "./ek-escpos.js";

/** Taklif qilinadigan nomlar — bo'sh do'konda ham bir bosishda tanlansin. */
export const DEFAULT_STATIONS = ["Oshxona", "Bar"];

/** Bo'lim nomlari: taklif + toifalarda allaqachon yozilganlari (takrorsiz). */
export function stationOptions(categories) {
  const out = [...DEFAULT_STATIONS];
  for (const c of categories || []) {
    const s = String(c?.station || "").trim();
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/**
 * Toifa ID → bo'lim. Bola toifada bo'sh bo'lsa OTA toifaniki: «Ichimliklar →
 * Sovuq ichimliklar» da bo'limni faqat otaga yozish kifoya.
 */
export function stationMap(categories) {
  const byId = new Map((categories || []).map((c) => [String(c.id), c]));
  const map = new Map();
  for (const c of categories || []) {
    let st = String(c?.station || "").trim();
    if (!st && c?.parentId != null) st = String(byId.get(String(c.parentId))?.station || "").trim();
    if (st) map.set(String(c.id), st);
  }
  return map;
}

/**
 * Savat → bo'limlar bo'yicha chek ro'yxati. Bo'limi yo'q qator (ichimlik
 * shishada, non) oshxonaga BORMAYDI — u peshtaxtadan beriladi.
 *
 * @return [{ station, lines: [{ name, qty, unit, unitDecimals, mods: [nom] }] }]
 */
export function kitchenTickets(cart, map) {
  const groups = new Map();
  for (const l of cart || []) {
    const st = map?.get(String(l?.categoryId));
    if (!st) continue;
    if (!groups.has(st)) groups.set(st, []);
    groups.get(st).push({
      name: String(l.name || ""),
      qty: Number(l.qty) || 0,
      unit: l.unit || null,
      unitDecimals: Number(l.unitDecimals) || 0,
      mods: (l.modifiers || []).map((m) => String(m.name || "")).filter(Boolean),
    });
  }
  return [...groups].map(([station, lines]) => ({ station, lines }));
}

/** So'zlar bo'yicha bo'lish — ikki baravar shriftda qator yarim kenglikda. */
export function wrapTo(text, max) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const piece = w.length > max ? w.slice(0, max) : w;
    if (!cur) cur = piece;
    else if ((cur + " " + piece).length <= max) cur += " " + piece;
    else { lines.push(cur); cur = piece; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

const qtyText = (l) => {
  const d = Math.max(0, Math.min(3, l.unitDecimals || 0));
  return d ? Number(l.qty).toFixed(d).replace(".", ",") : String(Math.round(l.qty));
};

/**
 * Bitta bo'limning cheki — ESC/POS baytlari.
 *
 * ⚠ TAOM NOMI IKKI BARAVAR: oshpaz chekni plitadan bir qadam narida o'qiydi.
 * Narx YO'Q — oshxonaga kerak emas va kassa ekranidan boshqa joyda pul
 * ko'rinishi ortiqcha.
 *
 * @param p.orderNo  «A-901» yoki oflayn «OFF-0012»
 * @param p.at       Date
 */
export function buildTicket({ station, lines, orderNo = "", at = new Date(), cashier = "", width = 80, note = "" }) {
  const cols = width === 58 ? WIDTH_58 : WIDTH_80;
  const half = Math.floor(cols / 2);
  const r = new Receipt(cols);
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");

  r.center().bold(true).double(true);
  for (const ln of wrapTo(String(station).toUpperCase(), half)) r.line(ln);
  r.double(false);
  if (orderNo) r.line(`#${orderNo}`);
  r.bold(false).line(`${hh}:${mm}${cashier ? ` · ${cashier}` : ""}`);
  if (note) r.line(note);
  r.left().rule();
  for (const l of lines) {
    r.bold(true).double(true);
    const head = `${qtyText(l)} x ${l.name}`;
    for (const ln of wrapTo(head, half)) r.line(ln);
    r.double(false);
    for (const m of l.mods) r.line(`   + ${m}`);
    r.bold(false);
  }
  r.rule();
  r.cut();
  return r.build();
}
