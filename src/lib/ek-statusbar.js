/* ══════════════════════════════════════════════════════════════════════════
   Status-bar rangi — ILOVA TEMASIGA ergashadi (Android)

   Muammo: status-bar ortida qattiq brend ko'ki turardi va u ilova foni
   bilan mos kelmay, ekran tepasida xunuk AJRATUVCHI chiziq bo'lib
   ko'rinardi (foydalanuvchi shikoyati, 2026-08-15).

   Yechim: status-bar foni har doim ilovaning JORIY fon rangi bo'lsin —
   yorug' temada oq (qora belgilar), qorong'ida to'q siyoh (oq belgilar).
   Shunda chegara umuman ko'rinmaydi: status-bar sahifaning davomi bo'ladi.

   ⚠ NEGA O'Z PLAGINI (`ThemeBar`), @capacitor/status-bar EMAS:
   uning `setBackgroundColor` metodi Android 16 da JIM O'TADI (no-op) —
   u eskirgan `Window.setStatusBarColor` ga tayanadi, Android 16 da esa
   status-bar shaffof va ortida nativ content view foni ko'rinadi.
   `ThemeBar` aynan o'sha fonni o'zgartiradi, ya'ni hamma versiyada
   ishlaydi (android/.../ThemeBarPlugin.java).

   ⚠ Bu fayl ILOVA-LOKAL (sync-tokens'dan kelmaydi): `ek-theme.js` esa
   MANBA fayl, uni tahrirlash mumkin emas — keyingi sinxronizatsiyada
   ustidan yoziladi. Shu sababli tema o'zgarishini `data-theme` atributini
   kuzatib ushlaymiz (MutationObserver): `paint()` o'sha atributni qo'yadi,
   ya'ni HAMMA yo'l — qo'lda tanlash ham, OS o'zgarishi ham — shu yerdan
   o'tadi.
   ══════════════════════════════════════════════════════════════════════════ */
import { isMobileApp } from "./ek-desktop";

/* ⚠ `ekassam-tokens.css` dagi `--bg-canvas` va Android'dagi
   `res/values/ek_colors.xml` (+ `values-night/`) bilan BIR XIL bo'lishi
   shart: nomuvofiqlik aynan o'sha ko'rinadigan chiziqni qaytaradi. */
const BG = { light: "#FFFFFF", dark: "#08111D" };

function plugin() {
  return typeof window !== "undefined" ? window.Capacitor?.Plugins?.ThemeBar : null;
}

function paintBar() {
  const p = plugin();
  if (!p?.apply) return;                       // eski APK / brauzer — jim
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  try {
    p.apply({ color: dark ? BG.dark : BG.light, dark });
  } catch (e) { /* nativ tomon javob bermadi — ilova ishlayveradi */ }
}

/** Ilova ko'tarilishida bir marta chaqiriladi (main.jsx). */
export function initStatusBar() {
  if (!isMobileApp()) return;
  paintBar();
  // Tema o'zgarishi = `data-theme` atributining o'zgarishi (ek-theme paint()).
  new MutationObserver(paintBar).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
