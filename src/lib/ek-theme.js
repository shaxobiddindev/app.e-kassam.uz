/* ==========================================================================
   e-Kassam — tema boshqaruvi (02-DESIGN-SYSTEM.md → "Qorong'i rejim")

   Tanlov saqlanadi (localStorage.ek_theme), boshlang'ich qiymat — tizim sozlamasi.
   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

const KEY = "ek_theme";           // "light" | "dark" | yo'q → tizim
const root = document.documentElement;

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Saqlangan tanlov yoki tizim sozlamasi. */
export function getTheme() {
  const saved = localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" ? saved : systemTheme();
}

/** Temani qo'llash. `persist=false` — tizim o'zgarishiga ergashish uchun. */
export function applyTheme(theme, persist = true) {
  root.setAttribute("data-theme", theme);
  if (persist) localStorage.setItem(KEY, theme);
  // Mobil brauzer manzil paneli rangi
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#08111D" : "#FFFFFF");
  return theme;
}

export function toggleTheme() {
  return applyTheme(getTheme() === "dark" ? "light" : "dark");
}

/**
 * Ilova ko'tarilishida chaqiriladi. Foydalanuvchi hech narsa tanlamagan bo'lsa
 * tizim sozlamasi o'zgarganda avtomatik ergashadi.
 */
export function initTheme() {
  applyTheme(getTheme(), false);
  window.matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener?.("change", (e) => {
      if (!localStorage.getItem(KEY)) applyTheme(e.matches ? "dark" : "light", false);
    });
}
