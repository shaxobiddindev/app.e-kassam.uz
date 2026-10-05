/* ══════════════════════════════════════════════════════════════════════════
   QURILMA SOZLAMALARI — DESKTOP FAYLIDA HAM (2026-10-05)

   Egasi: «tarozini avto sozlaydigan va ma'lumotni esdan chiqarmaydigan qil,
   xuddi stikernikidek».

   ⚠ NEGA. Printer, tarozi va ekran sozlamalari `localStorage` da. `clearSession`
   (`ek-session.js`) ularni sessiya tozalanganda saqlaydi, lekin WebView
   ma'lumotining o'zi yo'qolishi mumkin (profil buzildi, qayta o'rnatildi,
   Windows tozalash dasturi). Shunda printer ham, tarozi ham «unutilardi».
   Desktop ilovada nusxa ilovaning O'Z papkasida (`device.json`, Rust:
   `device_store_*`) turadi va ishga tushganda YO'Q kalitlar shundan tiklanadi.

   ⚠ Faqat `DEVICE_KEYS` — token, do'kon yoki savat bu faylga TUSHMAYDI.
   Brauzerda (sayt) hech narsa qilmaydi: u yerda fayl yo'q.
   ══════════════════════════════════════════════════════════════════════════ */
import { isDesktop, invoke } from "./ek-desktop.js";
import { DEVICE_KEYS } from "./ek-session.js";

/** Ishga tushganda: `localStorage` da yo'q kalitlarni fayldan tiklaydi. Nechtasi tiklandi. */
export async function restoreDevice() {
  if (!isDesktop()) return 0;
  let restored = 0;
  try {
    const raw = await invoke("device_store_get");
    const data = raw ? JSON.parse(raw) : {};
    for (const k of DEVICE_KEYS) {
      if (typeof data[k] !== "string") continue;
      try {
        if (localStorage.getItem(k) == null) { localStorage.setItem(k, data[k]); restored++; }
      } catch { /* yopiq xotira */ }
    }
  } catch { /* fayl yo'q yoki buzuq — birinchi ishga tushish */ }
  persistDevice();
  return restored;
}

let timer = null;

/**
 * Joriy qurilma sozlamalarini faylga yozadi (300 ms kechikish bilan — ketma-ket
 * o'zgarishlar bitta yozuv bo'lsin). Sozlama saqlanadigan har joydan chaqiriladi.
 */
export function persistDevice() {
  if (!isDesktop()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const snap = {};
      for (const k of DEVICE_KEYS) {
        const v = localStorage.getItem(k);
        if (v != null) snap[k] = v;
      }
      invoke("device_store_set", { json: JSON.stringify(snap) }).catch(() => {});
    } catch { /* yopiq xotira */ }
  }, 300);
}
