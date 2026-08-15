/* ══════════════════════════════════════════════════════════════════════════
   Status-bar rangi — EKRANNING O'Z FONIGA ergashadi (Android)

   Muammo: status-bar ortida qattiq brend ko'ki turardi va u ilova foni
   bilan mos kelmay, ekran tepasida xunuk AJRATUVCHI chiziq bo'lib
   ko'rinardi (foydalanuvchi shikoyati, 2026-08-15).

   ⚠ RANG QATTIQ KODLANMAYDI. Birinchi urinishda bu yerda `#FFFFFF` /
   `#08111D` turardi (meta theme-color'dan ko'chirilgan) — lekin ilovada
   tepa fon EKRANGA QARAB uch xil bo'ladi:
     · nazorat paneli `.m-app`  → `--bg-sunken`  (#EDF0F5 / #0A1523)
     · to'liq panel `.topbar`   → `--bg-surface` (#FFFFFF / #0F1B2B)
     · kirish/intro             → `--bg-canvas`  (#F6F8FB / #08111D)
   Ya'ni bitta qiymat hamma ekranga mos kelmaydi va ozgina bo'lsa-da
   chegara qaytadi. Shuning uchun rang EKRANDAN O'LCHAB olinadi:
   tepa nuqtadagi element topiladi va uning haqiqiy (shaffof bo'lmagan)
   foni nativ tomonga uzatiladi.

   ⚠ NEGA O'Z PLAGINI (`ThemeBar`), @capacitor/status-bar EMAS:
   uning `setBackgroundColor` metodi Android 16 da JIM O'TADI (no-op) —
   u eskirgan `Window.setStatusBarColor` ga tayanadi, Android 16 da esa
   status-bar shaffof va ortida nativ content view foni ko'rinadi.
   `ThemeBar` aynan o'sha fonni o'zgartiradi (ThemeBarPlugin.java).

   ⚠ Bu fayl ILOVA-LOKAL (sync-tokens'dan kelmaydi): `ek-theme.js` esa
   MANBA fayl — unga tegilmaydi, keyingi sinxronizatsiyada ustidan
   yoziladi. Shuning uchun o'zgarishlar DOM'dan kuzatiladi.
   ══════════════════════════════════════════════════════════════════════════ */
import { isMobileApp } from "./ek-desktop";

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** `rgb(a)` → `#RRGGBB`. Shaffof yoki tanib bo'lmasa `null`. */
function toHex(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css || "");
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  if (p.length > 3 && p[3] < 0.9) return null;      // deyarli shaffof — ota-onaga
  return `#${hex2(p[0])}${hex2(p[1])}${hex2(p[2])}`;
}

/** Ekranning ENG TEPASIDAGI haqiqiy fon rangi. */
function topColor() {
  const x = Math.round(window.innerWidth / 2);
  let el = document.elementFromPoint(x, 2);
  while (el && el !== document.documentElement) {
    const c = toHex(getComputedStyle(el).backgroundColor);
    if (c) return c;                                 // shaffof bo'lmagan birinchi fon
    el = el.parentElement;
  }
  // Zaxira: hujjat foni, so'ng token
  return toHex(getComputedStyle(document.body).backgroundColor)
      || toHex(getComputedStyle(document.documentElement).backgroundColor)
      || (document.documentElement.getAttribute("data-theme") === "dark" ? "#08111D" : "#F6F8FB");
}

/** Fon to'qmi — shunda status-bar belgilari oq bo'lishi kerak. */
function isDark(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Idrok etiladigan yorqinlik (ITU-R BT.601)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

let last = null;   // oxirgi yuborilgan rang — bir xilini qayta yubormaymiz

function paintBar() {
  const p = window.Capacitor?.Plugins?.ThemeBar;
  if (!p?.apply) return;                             // eski APK / brauzer — jim
  const color = topColor();
  if (color === last) return;
  last = color;
  try {
    p.apply({ color, dark: isDark(color) });
  } catch (e) { /* nativ tomon javob bermadi — ilova ishlayveradi */ }
}

/** Ilova ko'tarilishida bir marta chaqiriladi (main.jsx). */
export function initStatusBar() {
  if (!isMobileApp()) return;

  /* Bir kadr kutamiz: chaqiruv paytida React hali hech narsa chizmagan
     bo'lsa `elementFromPoint` bo'sh sahifani o'lchab qolardi. */
  requestAnimationFrame(paintBar);

  // 1) Tema almashishi — `ek-theme.js` `data-theme` atributini qo'yadi.
  new MutationObserver(paintBar).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  /* 2) Ekran almashishi (tab, sahifa, modal): tepadagi element boshqa
     fonli bo'lishi mumkin. DOM juda tez-tez o'zgaradi, shuning uchun
     debounce + yuqoridagi `last` keshi — nativ tomonga faqat rang
     HAQIQATAN o'zgarganda murojaat qilinadi. */
  let t = null;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(paintBar, 200);
  }).observe(document.body, { childList: true, subtree: true });
}
