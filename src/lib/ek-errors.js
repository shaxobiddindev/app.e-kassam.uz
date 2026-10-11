/* ══════════════════════════════════════════════════════════════════════════
   XATO KUZATUVI — ilova yiqilsa, bizga yetib boradi (2026-10-11, V163)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   Ilgari `ErrorBoundary` xatoni faqat ekranga va konsolga chiqarardi.
   Kassirning monoblokida konsol yo'q (`.exe`), ya'ni nima yiqilgani bizga
   faqat kassir qo'ng'iroq qilsa ma'lum bo'lardi — ko'pincha esa u «qayta
   yuklash» ni bosib, indamay ishlashda davom etardi.

   ═══ QANDAY ═══════════════════════════════════════════════════════════

   O'Z serverimizga (`POST /client-errors`), tashqi xizmatga emas: akkaunt,
   to'lov va do'kon ma'lumotini chet elga chiqarish kerak emas. Ko'rish —
   bosh admin panelidagi «Xatolar» sahifasi.

   ⚠ TOKENSIZ. Xato kirish sahifasida, sessiya tugaganda, token yangilanish
   paytida ham bo'ladi — aynan o'shanda token yo'q yoki yaroqsiz. Do'kon
   kodi va login esa tanada (faqat tashxis uchun, server ularga ishonmaydi).

   ⚠ Nima yuborilmasligi (shovqin) va sessiya chegarasi — `ek-errors-core.js`.

   ⚠ OFLAYN NAVBAT. Yuborib bo'lmasa — `localStorage` ga (ko'pi bilan 10 ta),
   internet qaytganda yoki keyingi ochilishda yuboriladi. Kassa ko'pincha
   aynan internetsiz paytda yiqiladi.
   ══════════════════════════════════════════════════════════════════════════ */

import { API_BASE, getDeviceId } from "../config";
import { isDesktop, isMobileApp } from "./ek-desktop";
import { isNoise, classify, createGate, queuePush, queueTake, pathOnly } from "./ek-errors-core";

const allow = createGate();
let installed = false;

/* `vite.config.js` dagi `define`. */
// eslint-disable-next-line no-undef
const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

const platform = () => (isDesktop() ? "desktop" : isMobileApp() ? "android" : "web");

function session() {
  try {
    return {
      shopCode: localStorage.getItem("ek_shopCode") || undefined,
      username: localStorage.getItem("ek_username") || undefined,
    };
  } catch (_) { return {}; }
}

/**
 * Xatoni yuborish. Hech qachon o'zi xato tashlamaydi — kuzatuv kassani
 * yiqitmasligi kerak.
 * @param {"render"|"error"|"rejection"} kind
 */
export function reportError(err, { kind = "error", componentStack } = {}) {
  try {
    const message = String(err?.message ?? err ?? "").slice(0, 500);
    const stack = typeof err?.stack === "string" ? err.stack : "";
    if (isNoise(err, message, stack)) return;
    if (!allow(kind + "|" + message + "|" + stack.split("\n")[1])) return;

    send({
      app: "app",
      platform: platform(),
      version: VERSION,
      kind: classify(kind, message),
      message,
      stack: stack.slice(0, 8000),
      componentStack: componentStack ? String(componentStack).slice(0, 4000) : undefined,
      path: pathOnly(location.pathname),
      deviceId: getDeviceId(),
      ...session(),
    });
  } catch (_) { /* kuzatuvning o'zi yiqilmasin */ }
}

function send(payload) {
  if (navigator.onLine === false) return queuePush(localStorage, payload);
  /* `keepalive` — sahifa yopilayotgan yoki qayta yuklanayotgan bo'lsa ham
     yetib boradi («Qayta yuklash» tugmasi aynan xatodan keyin bosiladi). */
  fetch(`${API_BASE}/client-errors`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(
    (r) => { if (r.status >= 500) queuePush(localStorage, payload); },
    () => queuePush(localStorage, payload),
  );
}

function flush() {
  if (navigator.onLine === false) return;
  for (const p of queueTake(localStorage)) send(p);
}

/** Ilova ishga tushishida bir marta (`main.jsx`). */
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    /* Rasm/skript yuklanmagani ham `error` beradi (nishon — element) —
       bular kod xatosi emas. */
    if (e.target && e.target !== window) return;
    reportError(e.error || { message: e.message, stack: "" }, { kind: "error" });
  });
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { kind: "rejection" }));
  window.addEventListener("online", flush);

  /* Oldingi ochilishda yuborilmay qolganlari — ilova tinchigach. */
  setTimeout(flush, 10_000);
}
