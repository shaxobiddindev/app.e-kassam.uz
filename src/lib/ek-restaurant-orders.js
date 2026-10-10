/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN BUYURTMALARI — sof hisoblar (4-bosqich E5)

   DOM bilmaydi — node'da sinaladi (`test/restaurant-orders.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/** Holat → rang ohangi. Rang yolg'iz emas: sahifada doim holat nomi ham bor. */
export const STATUS_TONE = {
  OPEN: "brand", BILL: "warn", PAID: "good", CANCELLED: "bad",
  TAKEAWAY: "away", DELIVERY: "away", TILL: "neutral",
};

/** Filtr guruhlari: «Ochiq» ichida hisob berilgani ham (u hali to'lanmagan). */
export const FILTERS = {
  all: () => true,
  open: (r) => r.status === "OPEN" || r.status === "BILL",
  paid: (r) => r.status === "PAID",
  away: (r) => r.kind === "AWAY",
  void: (r) => r.status === "CANCELLED",
};

export function countBy(rows) {
  return Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, (rows || []).filter(f).length]));
}

/**
 * Qatorlarni kurs bo'yicha guruhlaydi: 1, 2, 3 … va oxirida kurssizlar.
 * Hamma qator kurssiz bo'lsa — bitta guruh, sarlavhasiz (`course: undefined`).
 */
export function byCourse(lines) {
  const list = lines || [];
  if (list.every((l) => l.course == null)) return list.length ? [{ course: undefined, lines: list }] : [];
  const map = new Map();
  for (const l of list) {
    const k = l.course == null ? null : Number(l.course);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(l);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a == null ? 1 : b == null ? -1 : a - b))
    .map(([course, ls]) => ({ course, lines: ls }));
}

/** Ochilgandan to'langangacha necha daqiqa (vaqt chizig'idan). */
export function durationMin(timeline) {
  const t = (timeline || []).filter((e) => e.at);
  if (t.length < 2) return null;
  const first = Date.parse(t[0].at), last = Date.parse(t[t.length - 1].at);
  return Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, Math.round((last - first) / 60000)) : null;
}
