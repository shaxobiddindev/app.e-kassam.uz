/* ══════════════════════════════════════════════════════════════════════════
   Desktop rejimi — bitta joyda aniqlanadi

   Bir xil kod ikki joyda ishlaydi:
     · brauzerda  (app.e-kassam.uz)  — kirish `auth.e-kassam.uz` da
     · Tauri ichida (.exe)           — kirish ILOVA ICHIDA, apparatlar bor

   ⚠ Tekshiruv `import.meta.env` ga EMAS, ish vaqtidagi `window` ga tayanadi.
   Sabab: bitta build ikkala muhitda ham ishlaydi va desktop build'ni alohida
   yig'ish shart emas — noto'g'ri bayroq bilan yig'ilgan build brauzerda
   apparat tugmalarini ko'rsatib, bosilganda esa jimgina yiqilardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Tauri ichidamizmi. Tauri v2 `window.__TAURI_INTERNALS__` ni qo'yadi. */
export const isDesktop = () =>
  typeof window !== "undefined" &&
  (window.__TAURI_INTERNALS__ != null || window.__TAURI__ != null);

/** Android ilova (Capacitor) ichidamizmi. */
export const isMobileApp = () =>
  typeof window !== "undefined" &&
  ((window.Capacitor != null &&
    (typeof window.Capacitor.isNativePlatform !== "function"
      || window.Capacitor.isNativePlatform()))
   /* Faqat ishlab chiqish uchun: mobil UI'ni brauzerda ko'rish —
      konsolda `localStorage.ek_forceMobile="1"` deb yozib yangilang.
      Oddiy foydalanuvchi bu yo'lga tushmaydi. */
   || localStorage.getItem("ek_forceMobile") === "1");

/**
 * NATIV QOBIQ (Tauri `.exe` YOKI Android APK) ichidamizmi.
 *
 * ⚠ Farqni bilish MUHIM: kirish/chiqish oqimi ikkala qobiqda ham ILOVA
 * ICHIDA bo'ladi (`auth.e-kassam.uz` ga yo'naltirish qobiq oynasini bo'sh
 * sahifaga aylantiradi). Apparat (printer, port) esa FAQAT Tauri'da bor —
 * u joylar `isDesktop()` ligicha qoladi.
 */
export const isNativeShell = () => isDesktop() || isMobileApp();

/**
 * Rust tomonidagi buyruqni chaqiradi.
 *
 * Brauzerda `null` qaytaradi — TASHLAMAYDI. Chaqiruvchi joylar `isDesktop()`
 * bilan allaqachon tekshiradi, bu esa oxirgi to'siq: bitta unutilgan tekshiruv
 * butun ekranni yiqitmasin.
 */
export async function invoke(cmd, args = {}) {
  if (!isDesktop()) return null;
  const core = window.__TAURI__?.core;
  if (!core?.invoke) return null;
  return core.invoke(cmd, args);
}

/** Ilova versiyasi — Sozlamalar ekranida va xato hisobotlarida ko'rsatiladi. */
export const desktopVersion = () =>
  (typeof window !== "undefined" && window.__EK_DESKTOP_VERSION__) || null;
