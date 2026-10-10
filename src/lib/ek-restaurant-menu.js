/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN MENYUSI — sof hisoblar (4-bosqich E3)

   DOM bilmaydi — node'da sinaladi (`test/restaurant-menu.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Tannarx ulushi (food cost) bahosi. Restoranlarda odatiy mo'ljal: 30% gacha
 * yaxshi, 36% gacha me'yorda, undan yuqori — narxni yoki texkartani ko'rish
 * kerak. `null` — tannarx kiritilmagan (baho berilmaydi, «0% yaxshi» emas).
 */
export function costTone(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const p = Number(pct);
  if (p <= 30) return { word: "good", tone: "good" };
  if (p <= 36) return { word: "ok", tone: "warn" };
  return { word: "high", tone: "bad" };
}

/**
 * Ko'rinadigan taomlar: bo'lim, qidiruv va «faqat stop-list».
 * `section` — "all", bo'lim ID si yoki "none" (bo'limsiz).
 * Qidiruv harf katta-kichigiga va o'/o', g'/g' farqiga qaramaydi.
 */
export function visibleDishes(dishes, { section = "all", query = "", stopOnly = false } = {}) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[‘’ʻʼ`]/g, "'").trim();
  const q = norm(query);
  return (dishes || []).filter((d) =>
    (section === "all" || (section === "none" ? d.categoryId == null : String(d.categoryId) === String(section)))
    && (!stopOnly || d.stopListed)
    && (!q || norm(d.name).includes(q)));
}

/** Kartochkadagi bosh harf (rasm bo'lmasa): «Qozon kabob» → «Q». */
export function initialOf(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

/**
 * Sex bo'yicha kartochka foni — bir qarashda qaysi sexga tegishli ekani.
 * ⚠ Faqat tokenlar (CLAUDE.md #1); rang yolg'iz signal emas — sex nomi
 * kartochkada matn bilan ham yozilgan.
 */
const STATION_BG = ["var(--bg-brand-subtle)", "var(--bg-warning-subtle)", "var(--bg-success-subtle)", "var(--bg-sunken)"];
export function stationBg(station, stations) {
  if (!station) return "var(--bg-sunken)";
  const i = (stations || []).indexOf(station);
  return STATION_BG[(i < 0 ? 0 : i) % STATION_BG.length];
}
