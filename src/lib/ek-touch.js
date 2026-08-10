/* ══════════════════════════════════════════════════════════════════════════
   Teginish rejimi — monoblok uchun

   Kassa ko'pincha sensorli monoblokda ishlaydi: klaviatura ham, sichqoncha
   ham yo'q. Shunday qurilmada ilova o'zi klaviatura chiqarishi va nishonlarni
   kattalashtirishi kerak.

   ⚠ AVTOMATIK ANIQLASH YETARLI EMAS. Ko'p monobloklar Windows'ga oddiy
   "sichqoncha" bo'lib ko'rinadi (`pointer: coarse` bermaydi), ba'zilarida
   esa teginish ham, sichqoncha ham bor. Shu sababli uch holat bor:

     "auto"  — qurilmadan taxmin qilinadi (standart)
     "on"    — majburan yoqilgan  (monoblok noto'g'ri aniqlanganda)
     "off"   — majburan o'chirilgan (klaviaturasi bor kompyuter)

   Tanlov QURILMAGA tegishli, hisobga emas — shuning uchun `localStorage` da,
   serverda emas: bitta kassir ham monoblokda, ham noutbukda ishlashi mumkin.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY = "ek_touchMode";

/** Qurilma teginishli ko'rinyaptimi. */
function detect() {
  if (typeof window === "undefined") return false;
  // `pointer: coarse` — asosiy ko'rsatkich (barmoq). `maxTouchPoints` esa
  // sensorli ekranli, lekin sichqonchasi ham bor qurilmalarni ushlaydi.
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touch  = (navigator.maxTouchPoints || 0) > 0;
  return Boolean(coarse || touch);
}

export function getTouchMode() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : "auto";
  } catch (e) {
    return "auto";
  }
}

export function setTouchMode(mode) {
  try {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch (e) { /* private rejim — shunchaki eslab qolinmaydi */ }
  apply();
  listeners.forEach((fn) => fn(isTouch()));
}

/** Hozir teginish rejimidamizmi. */
export function isTouch() {
  const mode = getTouchMode();
  if (mode === "on") return true;
  if (mode === "off") return false;
  return detect();
}

/* `<html data-touch="1">` — CSS shu bo'yicha nishonlarni kattalashtiradi.
   ⚠ Sinf EMAS, atribut: `data-theme` bilan bir xil uslub va CSS'da
   `:root[data-touch="1"]` deb yozilgani `@media (pointer: coarse)` dan
   ustun turadi — majburan yoqilganda ham ishlaydi. */
export function apply() {
  if (typeof document === "undefined") return;
  const on = isTouch();
  document.documentElement.setAttribute("data-touch", on ? "1" : "0");
}

const listeners = new Set();
/** Rejim o'zgarishiga obuna (React komponentlari uchun). */
export function onTouchChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
