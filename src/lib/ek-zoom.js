/* ══════════════════════════════════════════════════════════════════════════
   SAHIFA MASSHTABI — DESKTOP (2026-10-05)

   Egasi: «desktop ilovaga zoom qo'sh — Ctrl + va Ctrl + sichqoncha g'ildiragi».
   Kassa monitorlari har xil: 15" da tugmalar mayda, 24" da bo'sh joy ko'p.

   ⚠ NEGA O'ZIMIZ, WebView2 ning o'z masshtabi EMAS (`zoomHotkeysEnabled`).
   U ilova yopilganda unutiladi (kassir har tongda qayta kattalashtirardi),
   qadamni o'zi tanlaydi va ekranda hech narsa ko'rsatmaydi — tasodifan
   Ctrl + g'ildirak bosilsa, kassir nega hammasi kichrayganini bilmasdi.
   Bu yerda: aniq qadamlar, ekranda «110%» va qiymat qurilma sozlamasi
   (`DEVICE_KEYS` → `device.json`) sifatida saqlanadi.

   ⚠ CSS `zoom` EMAS — Rust `set_zoom` (WebView2 ZoomFactor). CSS `zoom`
   `position: fixed` modallar, `getBoundingClientRect` va kassa o'ng
   panelini sudrashni buzardi; WebView2 masshtabi esa brauzerdagi Ctrl +
   bilan bir xil ishlaydi — sahifa uchun shunchaki ekran kattaroq.

   Brauzerda (sayt) hech narsa qilmaydi: u yerda brauzerning o'z Ctrl + i bor.
   ══════════════════════════════════════════════════════════════════════════ */
import { isDesktop, invoke } from "./ek-desktop.js";
import { persistDevice } from "./ek-device-store.js";

export const ZOOM_KEY = "ek_zoom";

/** Qadamlar — brauzerdagiga yaqin; 100% doim ro'yxatda. */
export const STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

let current = 1;

/** Joriy masshtab (desktopdan tashqarida doim 1). */
export const zoomLevel = () => (isDesktop() ? current : 1);

/** Saqlangan qiymat; buzuq yoki chegaradan tashqari bo'lsa — 1. */
export function readZoom() {
  try {
    const v = Number(localStorage.getItem(ZOOM_KEY));
    if (Number.isFinite(v) && v >= STEPS[0] && v <= STEPS[STEPS.length - 1]) return v;
  } catch { /* yopiq xotira */ }
  return 1;
}

/** Joriydan keyingi qadam: `dir` = +1 kattaroq, −1 kichikroq. */
export function nextStep(z, dir) {
  if (dir > 0) return STEPS.find((s) => s > z + 0.001) ?? STEPS[STEPS.length - 1];
  return [...STEPS].reverse().find((s) => s < z - 0.001) ?? STEPS[0];
}

/** Masshtabni qo'yadi, saqlaydi va (so'ralsa) ekranda ko'rsatadi. */
export async function setZoom(z, { show = true } = {}) {
  if (!isDesktop()) return 1;
  const v = Math.round(Math.min(STEPS[STEPS.length - 1], Math.max(STEPS[0], z)) * 100) / 100;
  try { await invoke("set_zoom", { scale: v }); }
  catch { return current; }   // eski Rust qobig'i — buyruq yo'q, jim
  current = v;
  try {
    if (v === 1) localStorage.removeItem(ZOOM_KEY);
    else localStorage.setItem(ZOOM_KEY, String(v));
  } catch { /* yopiq xotira */ }
  persistDevice();
  if (show) badge(v);
  return v;
}

export const zoomIn = () => setZoom(nextStep(current, +1));
export const zoomOut = () => setZoom(nextStep(current, -1));
export const zoomReset = () => setZoom(1);

/* ── Ekrandagi «110%» belgisi ────────────────────────────────────────────
   Oddiy DOM — React daraxtiga bog'lanmagan: masshtab kirish sahifasida
   ham, kassa ichida ham bir xil ishlaydi. Animatsiyasiz (reduced-motion
   muammosi yo'q), 1.4 soniyadan keyin yo'qoladi. */
let el = null;
let hideTimer = null;

function badge(v) {
  if (typeof document === "undefined") return;
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed", "left:50%", "top:16px", "transform:translateX(-50%)",
      "z-index:var(--z-toast)", "padding:10px 16px", "border-radius:12px",
      "background:var(--bg-inverse)", "color:var(--fg-on-inverse)",
      "font-size:15px", "font-weight:600", "pointer-events:none",
      "display:flex", "align-items:center", "gap:10px",
      "box-shadow:var(--sh-lg)",
    ].join(";");
    document.body.appendChild(el);
  }
  const pct = Math.round(v * 100);
  el.innerHTML = `<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>`
    + `<span class="ek-num">${pct}%</span>`
    + (pct !== 100 ? `<span class="ek-num" style="opacity:.75;font-weight:500">Ctrl 0 → 100%</span>` : "");
  el.hidden = false;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (el) el.hidden = true; }, 1400);
}

/* ── Klaviatura va g'ildirak ─────────────────────────────────────────────── */

/** Tugma → yo'nalish (+1, −1, 0 = 100%) yoki `null`. Klaviatura tartibidan qat'i nazar. */
export function keyAction(e) {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null;
  const k = e.key, c = e.code;
  if (k === "+" || k === "=" || c === "Equal" || c === "NumpadAdd") return +1;
  if (k === "-" || k === "_" || c === "Minus" || c === "NumpadSubtract") return -1;
  if (k === "0" || c === "Digit0" || c === "Numpad0") return 0;
  return null;
}

let started = false;

/**
 * Saqlangan masshtabni qo'llaydi va Ctrl +/−/0, Ctrl + g'ildirakni ulaydi.
 * `restoreDevice()` dan KEYIN chaqiriladi — fayldan tiklangan qiymat ham ishlasin.
 */
export function initZoom() {
  if (!isDesktop() || started) return;
  started = true;

  const saved = readZoom();
  if (saved !== 1) setZoom(saved, { show: false });

  /* ⚠ CAPTURE bosqichida: kassa sahifasining o'z tugma ishlovchilari (ek-kassa-keys)
     Ctrl + «−» ni boshqa narsa deb tushunmasin va brauzerning o'z masshtabi
     ham ishga tushmasin. */
  window.addEventListener("keydown", (e) => {
    const a = keyAction(e);
    if (a === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat && a === 0) return;
    if (a > 0) zoomIn(); else if (a < 0) zoomOut(); else zoomReset();
  }, true);

  /* G'ildirak: sichqonchada bitta «tiq» ≈ 100 birlik, sensorli panel esa
     ko'p mayda qiymat yuboradi — yig'ib, 60 dan oshganda bir qadam.
     Ataylab `passive: false`: aks holda `preventDefault` ishlamaydi va
     WebView2 sahifani o'zi ham kattalashtirib yuborardi. */
  let acc = 0;
  let accTimer = null;
  window.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    acc += e.deltaY;
    clearTimeout(accTimer);
    accTimer = setTimeout(() => { acc = 0; }, 250);
    if (Math.abs(acc) < 60) return;
    const dir = acc < 0 ? +1 : -1;     // g'ildirak yuqoriga = kattaroq
    acc = 0;
    setZoom(nextStep(current, dir));
  }, { passive: false, capture: true });
}
