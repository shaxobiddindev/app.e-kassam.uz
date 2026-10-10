/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN «BUGUN» — sof hisoblar (4-bosqich E2)

   Bu fayl DOM bilmaydi — node'da sinaladi (`test/restaurant-today.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Grafikda ko'rinadigan soatlar: savdo yoki bandlik bo'lgan birinchi va
 * oxirgi soat, lekin kamida 10:00–22:00 (restoranning odatdagi kuni).
 * ⚠ Tunda ishlaydigan joyda (02:00 gacha) oyna o'zi kengayadi.
 */
export function hourWindow(hours, { min = 10, max = 22 } = {}) {
  const busy = (hours || []).filter((h) => Number(h.revenue) > 0 || Number(h.occupancy) > 0).map((h) => h.hour);
  const lo = Math.min(min, ...(busy.length ? busy : [min]));
  const hi = Math.max(max, ...(busy.length ? busy : [max]));
  return (hours || []).filter((h) => h.hour >= lo && h.hour <= hi);
}

/**
 * O'tgan haftaning shu kuni (shu soatgacha) bilan solishtirish.
 * O'tgan hafta 0 bo'lsa — solishtirib bo'lmaydi (`null`), «∞%» emas.
 */
export function changeText(now, before) {
  const a = Number(now) || 0, b = Number(before) || 0;
  if (b <= 0) return null;
  const pct = Math.round(((a - b) / b) * 100);
  return { up: pct >= 0, pct: Math.abs(pct) };
}
