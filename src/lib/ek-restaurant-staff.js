/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN XODIMLARI — sof hisoblar (4-bosqich E7)

   DOM bilmaydi — node'da sinaladi (`test/restaurant-staff.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/* Bir nechta rol bo'lsa — kattasi ko'rsatiladi (ega kassir ham bo'lishi mumkin). */
const ORDER = ["OWNER", "SHOP_ADMIN", "CASHIER", "WAITER", "COOK", "STOREKEEPER"];

export function topRole(roles) {
  const list = (roles || []).map((r) => String(r).replace(/^ROLE_/, ""));
  return ORDER.find((r) => list.includes(r)) || list[0] || null;
}

/** Filtr guruhlari: «Menejerlar» — ega va do'kon admini. */
export const GROUPS = {
  all: () => true,
  WAITER: (r) => r === "WAITER",
  COOK: (r) => r === "COOK",
  CASHIER: (r) => r === "CASHIER",
  MANAGER: (r) => r === "OWNER" || r === "SHOP_ADMIN",
  STOREKEEPER: (r) => r === "STOREKEEPER",
};

/**
 * PIN kimga kerak: terminalda ishlaydiganlarga (ofitsiant, oshpaz, kassir).
 * Rahbar parol bilan kiradi — unda PIN yo'qligi kamchilik emas.
 */
export function needsPin(role) {
  return role === "WAITER" || role === "COOK" || role === "CASHIER";
}

/**
 * «Oxirgi smena»: bugun / kecha / sana. `todayIso` — «YYYY-MM-DD»
 * (Toshkent bo'yicha bugun, chaqiruvchi beradi — sinovda soxtalashtiriladi).
 */
export function lastShiftKind(iso, todayIso) {
  if (!iso) return { kind: "never" };
  const day = localDay(iso);
  if (day === todayIso) return { kind: "today" };
  const y = new Date(`${todayIso}T00:00:00`);
  y.setDate(y.getDate() - 1);
  const yIso = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (day === yIso) return { kind: "yesterday" };
  return { kind: "date", date: `${day.slice(8, 10)}.${day.slice(5, 7)}` };
}

function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ism bosh harflari (avatar): «Dilnoza Karimova» → «DK», «Bekzod» → «BE». */
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}
