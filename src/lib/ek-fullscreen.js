/* ══════════════════════════════════════════════════════════════════════════
   HAQIQIY TO'LIQ EKRAN — brauzerda ham, `.exe` ichida ham bir xil

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   «To'liq ekran» tugmasi ilgari FAQAT ilovaning o'z yon menyusi va
   sarlavhasini yashirardi. Ekranning tepasida brauzerning manzil
   qatori, pastida esa Windows'ning vazifalar paneli qolaverardi —
   rejim «to'liq ekran» deb atalgan-u, aslida to'liq emas edi. Kassir
   uni yoqib, so'ng yana qo'lda F11 ni bosardi.

   Desktop (`.exe`) da esa F11 UMUMAN ishlamasdi: WebView2 bu tugmani
   o'zi tutmaydi va oynani hech narsa to'liq ekranga o'tkazmasdi. Ya'ni
   kassa monobloki tepasida Windows sarlavhasi doim turardi.

   ═══ IKKI YO'L, BITTA NATIJA ══════════════════════════════════════════

     brauzer  →  Fullscreen API (`requestFullscreen`)
     Tauri    →  Rust tomonidagi `set_fullscreen` buyrug'i

   ⚠ Tauri ichida Fullscreen API ISHLATILMAYDI. WebView2 da u veb-sahifani
   faqat OYNA ICHIDA yoyadi: oynaning ramkasi, sarlavhasi va vazifalar
   paneli joyida qolaveradi. Oynaning o'zini faqat Rust tomoni to'liq
   ekranga o'tkaza oladi (`Window::set_fullscreen`).

   ⚠ Rust buyrug'iga `capabilities/default.json` da ruxsat KERAK EMAS:
   ruxsatlar plagin (`core:…`, `updater:…`) buyruqlarini to'sadi,
   ilovaning O'Z buyruqlari esa `generate_handler!` ga qo'shilgani bilan
   ochiladi.
   ══════════════════════════════════════════════════════════════════════════ */

import { isDesktop, invoke } from "./ek-desktop.js";

/**
 * To'liq ekranni BIZ yoqqanmizmi.
 *
 * ⚠ Bu bayroqsiz bo'lmaydi: foydalanuvchi ilovani ochishdan OLDIN
 * brauzerning o'z F11 ini bosgan bo'lishi mumkin. U holda ekran to'liq,
 * lekin `document.fullscreenElement` BO'SH — Fullscreen API bu haqda
 * hech narsa bilmaydi. Biz yoqmagan to'liq ekrandan CHIQARMAYMIZ, aks
 * holda ilova foydalanuvchining tanlovini o'zicha bekor qilardi.
 */
let owned = false;

/** Fullscreen API — eski Safari prefiksi bilan. */
const fsElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;

export async function enterFullscreen() {
  owned = true;
  if (isDesktop()) { await invoke("set_fullscreen", { on: true }); return; }

  const el = document.documentElement;
  const go = el.requestFullscreen || el.webkitRequestFullscreen;
  /* Qo'llab-quvvatlanmasa — ilovaning o'z qatlamlari baribir yashiriladi,
     shuning uchun jimgina qaytamiz. Lekin `owned` ni tushiramiz: biz hech
     narsa yoqmadik, demak chiqaradigan narsamiz ham yo'q. */
  if (!go) { owned = false; return; }
  try {
    await go.call(el);
  } catch (e) {
    /* Foydalanuvchi harakatisiz chaqirilsa brauzer rad etadi. Xato emas —
       tugma yoki F11 orqali qayta urinib ko'rish mumkin. */
    owned = false;
  }
}

export async function exitFullscreen() {
  if (!owned) return;
  owned = false;
  if (isDesktop()) { await invoke("set_fullscreen", { on: false }); return; }

  const off = document.exitFullscreen || document.webkitExitFullscreen;
  if (off && fsElement()) {
    try { await off.call(document); } catch (e) { /* allaqachon chiqilgan */ }
  }
}

export const setFullscreen = (on) => (on ? enterFullscreen() : exitFullscreen());

/**
 * Brauzer to'liq ekrandan O'ZI chiqarganda xabar beradi (Esc, brauzerning
 * o'z tugmasi). Ilovadagi holat ekranda ko'rinayotgan narsa bilan mos
 * qolishi uchun: aks holda Esc bosilgandan keyin yon menyu yashiringancha
 * qolardi va kassir undan chiqolmasdi.
 *
 * ⚠ Tauri'da bunday hodisa YO'Q va kerak ham emas: u yerda to'liq ekrandan
 * faqat bizning F11 yoki chiqish tugmamiz orqali chiqiladi, Esc esa oynaga
 * ta'sir qilmaydi.
 *
 * @returns obunani bekor qiluvchi funksiya
 */
export function onFullscreenLeft(cb) {
  const h = () => {
    if (owned && !fsElement()) { owned = false; cb(); }
  };
  document.addEventListener("fullscreenchange", h);
  document.addEventListener("webkitfullscreenchange", h);
  return () => {
    document.removeEventListener("fullscreenchange", h);
    document.removeEventListener("webkitfullscreenchange", h);
  };
}
