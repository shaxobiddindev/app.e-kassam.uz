/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN HISOBOTI — sof hisoblar (4-bosqich E6)

   DOM bilmaydi — node'da sinaladi (`test/restaurant-report.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/** Manbalar ulushi (%) — yig'indisi 100 bo'lishi uchun oxirgisi qoldiqdan. */
export function sourceShares(sources) {
  const list = (sources || []).filter((s) => Number(s.revenue) > 0);
  const total = list.reduce((a, s) => a + Number(s.revenue), 0);
  if (total <= 0) return [];
  let used = 0;
  return list.map((s, i) => {
    const share = i === list.length - 1 ? 100 - used : Math.round((Number(s.revenue) / total) * 100);
    used += share;
    return { ...s, share };
  });
}

/** Oldingi teng davrga nisbatan o'sish; oldingi 0 bo'lsa — `null` («∞%» emas). */
export function growth(now, prev) {
  const a = Number(now) || 0, b = Number(prev) || 0;
  if (b <= 0) return null;
  return Math.round(((a - b) / b) * 100);
}

/**
 * Bandlik jadvali: 7 qator (dushanba…yakshanba) × soatlar. Soat oralig'i —
 * ma'lumot bor birinchi va oxirgi soat, lekin kamida 10:00–23:00.
 */
export function heatGrid(cells, { min = 10, max = 23 } = {}) {
  const list = cells || [];
  const hrs = list.map((c) => c.hour);
  const lo = Math.min(min, ...(hrs.length ? hrs : [min]));
  const hi = Math.max(max, ...(hrs.length ? hrs : [max]));
  const hours = [];
  for (let h = lo; h <= hi; h++) hours.push(h);
  const at = new Map(list.map((c) => [`${c.dow}:${c.hour}`, c.occupancy]));
  const rows = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, cells: hours.map((h) => at.get(`${dow}:${h}`) ?? 0) }));
  return { hours, rows };
}

/** ABC guruhlari bo'yicha soni va tushumi — jadval tepasidagi qisqa xulosa. */
export function abcSummary(dishes) {
  const out = { A: { n: 0, revenue: 0 }, B: { n: 0, revenue: 0 }, C: { n: 0, revenue: 0 } };
  for (const d of dishes || []) {
    const g = out[d.group];
    if (!g) continue;
    g.n += 1;
    g.revenue += Number(d.revenue) || 0;
  }
  return out;
}
