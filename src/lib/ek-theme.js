/* ==========================================================================
   e-Kassam — tema boshqaruvi (02-DESIGN-SYSTEM.md → "Qorong'i rejim")

   UCH holat, ikkitasi emas:
     "system"  — saqlanmaydi, OS sozlamasiga ergashadi (boshlang'ich)
     "light"   — foydalanuvchi tanlagan
     "dark"    — foydalanuvchi tanlagan

   Shuning uchun boshqaruv elementi tugma emas, `<select>`: uchta holatni
   ikki holatli tugma bilan ifodalab bo'lmaydi va "Qorong'i rejim" yozuvi
   yon menyuda juda uzun edi.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

const KEY = "ek_theme";
const root = document.documentElement;
const mq = () => window.matchMedia?.("(prefers-color-scheme: dark)");

/**
 * Uchta variant — qiymat va ikonka. YORLIQ BU YERDA YO'Q: u tilga bog'liq
 * (`theme.system` / `theme.light` / `theme.dark` kalitlari) va `ThemeSelect`
 * uni `useT` orqali oladi. Ilgari yorliq shu massivda edi va modul bir marta
 * yuklangani uchun til almashtirilganda o'zbekchaligicha qolardi.
 */
export const THEME_VALUES = [
  { value: "system", icon: "fa-circle-half-stroke" },
  { value: "light",  icon: "fa-sun" },
  { value: "dark",   icon: "fa-moon" },
];

function systemTheme() {
  return mq()?.matches ? "dark" : "light";
}

/** Foydalanuvchi TANLAGAN rejim: "system" | "light" | "dark". */
export function getMode() {
  const saved = localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

/** Ekranda AMALDA qo'llangan tema: "light" | "dark". */
export function getTheme() {
  const mode = getMode();
  return mode === "system" ? systemTheme() : mode;
}

function paint(effective) {
  root.setAttribute("data-theme", effective);
  // Mobil brauzer manzil paneli rangi
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "dark" ? "#08111D" : "#FFFFFF");
}

/**
 * Rejimni o'rnatadi va saqlaydi.
 * "system" tanlansa saqlangan qiymat O'CHIRILADI — shundan keyin sahifa
 * OS sozlamasi o'zgarishiga o'zi ergashadi.
 */
export function setMode(mode) {
  if (mode === "light" || mode === "dark") localStorage.setItem(KEY, mode);
  else localStorage.removeItem(KEY);
  const eff = mode === "system" ? systemTheme() : mode;
  paint(eff);
  return mode;
}

/** Ilova ko'tarilishida bir marta. */
export function initTheme() {
  paint(getTheme());
  mq()?.addEventListener?.("change", () => {
    if (getMode() === "system") paint(systemTheme());
  });
}

/* ── Eski nom (kodda hali uchraydi) ────────────────────────────────────── */
export function toggleTheme() {
  return setMode(getTheme() === "dark" ? "light" : "dark");
}
export const applyTheme = (t) => setMode(t);
