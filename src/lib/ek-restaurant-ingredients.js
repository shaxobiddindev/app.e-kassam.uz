/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN MASALLIQLARI — sof hisoblar (4-bosqich E4)

   DOM bilmaydi — node'da sinaladi (`test/restaurant-ingredients.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * «Necha kunga yetadi» bahosi. Serverning `LOW_DAYS` (2) bilan bir xil:
 * 1 kundan kam — bugun tugaydi, 2 kundan kam — buyurtma berish vaqti.
 * `null` — sarf yo'q (oxirgi haftada ishlatilmagan), «∞ kun» emas.
 */
export function daysTone(days) {
  if (days == null || !Number.isFinite(Number(days))) return { kind: "idle", tone: null };
  const d = Number(days);
  if (d < 1) return { kind: "today", tone: "bad" };
  if (d < 2) return { kind: "order", tone: "warn" };
  return { kind: "ok", tone: "good" };
}

/** Qidiruv va «faqat kam qolganlar». */
export function visibleRows(rows, { query = "", lowOnly = false } = {}) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[‘’ʻʼ`]/g, "'").trim();
  const q = norm(query);
  return (rows || []).filter((r) =>
    (!q || norm(r.name).includes(q))
    && (!lowOnly || ["today", "order"].includes(daysTone(r.daysLeft).kind)
        || (Number(r.minQuantity) > 0 && Number(r.stock) <= Number(r.minQuantity))));
}

/**
 * Yetkazuvchiga yuboriladigan matn — Telegram yoki SMS. Oddiy matn:
 * yetkazuvchi uni telefonida o'qiydi, jadval emas.
 *
 * @param order  serverdagi `Order`
 * @param fmt    { qty(n, unit), money(n), unit(u), title, total, noSupplier }
 */
export function orderText(order, fmt) {
  const head = order.supplierName || fmt.noSupplier;
  const lines = (order.lines || []).map((l) => `• ${l.name} — ${fmt.qty(l.qty, l.unit)} ${fmt.unit(l.unit)}`);
  return [`${fmt.title}: ${head}`, ...lines, `${fmt.total}: ${fmt.money(order.sum)}`].join("\n");
}
