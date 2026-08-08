/* ══════════════════════════════════════════════════════════════════════════
   Auto-update — faqat `.exe` da

   Ilova o'zini o'zi yangilaydi: GitHub relizidagi `latest.json` tekshiriladi,
   yangi versiya bo'lsa o'rnatuvchi yuklab olinadi va ishga tushiriladi, so'ng
   ilova qayta ochiladi.

   ⚠ IMZO. Paket minisign kaliti bilan imzolangan bo'lishi SHART, ochiq kalit
   `tauri.conf.json` ichida. Imzosi mos kelmagan fayl o'rnatilmaydi — ya'ni
   reliz manzili qo'lga olinsa ham kassaga begona `.exe` tushmaydi.

   ⚠ DINAMIK IMPORT. `@tauri-apps/plugin-*` paketlari ATAYLAB `import()` bilan
   yuklanadi: bitta build ham brauzerda, ham `.exe` da ishlaydi va brauzer
   versiyasi bu kodni HECH QACHON so'ramaydi (alohida bo'lakda qoladi).

   ⚠ HAR BIR XATO YUTILADI. Yangilanish — qo'shimcha qulaylik; internet
   yo'qligi yoki reliz topilmagani KASSANI TO'XTATMASLIGI kerak.
   ══════════════════════════════════════════════════════════════════════════ */

import { isDesktop } from "./ek-desktop";

/**
 * Yangi versiya bormi.
 *
 * @returns {Promise<object|null>} `Update` obyekti yoki `null`
 *   (brauzerda, yangilanish yo'q bo'lganda yoki tarmoq xatosida).
 */
export async function checkUpdate() {
  if (!isDesktop()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    return (await check()) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Yangilanishni yuklab olib o'rnatadi va ilovani qayta ishga tushiradi.
 *
 * `onProgress` 0..100 oralig'ida foiz oladi. Server `Content-Length`
 * bermasa `null` keladi — shunda ekranda foiz emas, cheksiz indikator
 * ko'rsatilishi kerak.
 *
 * ⚠ Qaytmaydi: `relaunch()` jarayonni almashtiradi. Xato bo'lsa TASHLAYDI —
 * bu yerda yutilmaydi, chunki foydalanuvchi tugmani ONGLI bosgan va
 * natijani bilishi kerak.
 */
export async function installUpdate(update, onProgress) {
  let total = 0;
  let got = 0;

  await update.downloadAndInstall((ev) => {
    if (ev.event === "Started") {
      total = ev.data?.contentLength || 0;
      got = 0;
    } else if (ev.event === "Progress") {
      got += ev.data?.chunkLength || 0;
    } else if (ev.event === "Finished") {
      got = total;
    }
    if (onProgress) {
      onProgress(total > 0 ? Math.min(100, Math.round((got * 100) / total)) : null);
    }
  });

  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/** Hozirgi ilova versiyasi (`1.1.0`). Brauzerda `null`. */
export async function appVersion() {
  if (!isDesktop()) return null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch (e) {
    return null;
  }
}
