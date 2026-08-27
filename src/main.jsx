import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { schedulePrefetch } from "./lib/ek-pages";
import App from "./App.jsx";
import { initTheme } from "./lib/ek-theme";
import { initLang } from "./lib/ek-i18n";
import { isDesktop } from "./lib/ek-desktop";
import { initStatusBar } from "./lib/ek-statusbar";

// Tema — index.html dagi inline skript birinchi bo'yoqni to'g'ri qiladi,
// bu yerda tizim sozlamasi o'zgarishini kuzatish yoqiladi.
initTheme();

// Android status-bar foni temaga ergashsin (ekran tepasidagi ko'k
// ajratuvchi chiziq shu bilan yo'qoladi). Telefondan boshqa joyda — jim.
initStatusBar();

// Til — URL dagi `?lang=` (ilovalararo yo'naltirishdan) localStorage ga
// ko'chiriladi va <html lang> qo'yiladi. Faqat INTERFEYSGA ta'sir qiladi.
initLang();

// PWA — planshetga o'rnatilganda brauzer paneli yo'qoladi, POS terminaliday ko'rinadi.
//
// ⚠ DESKTOP'DA RO'YXATDAN O'TKAZILMAYDI. `.exe` ichida service worker foydasiz
// (fayllar allaqachon lokal) va ZARARLI: u `assets/index-<hash>.js` ni
// cache-first bilan keshlaydi, yangi versiyada esa hash o'zgaradi. Tauri'ning
// o'z protokoliga SW ichidan qilingan `fetch` qaytmaydi, natijada yangi skript
// umuman yuklanmaydi va ilova QORA BO'SH OYNA bo'lib ochiladi. Aynan shu
// bo'lgan: keshda `index-CPDSY6t0.js` qolib, build `index-D04lIaqz.js` so'ragan.
// Eski o'rnatmalarni tozalash `index.html` dagi inline skriptda.
if ("serviceWorker" in navigator && import.meta.env.PROD && !isDesktop()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);

/* ⚠ OLDINDAN YUKLASH SHU YERDA, `App` ICHIDA EMAS.

   Avval u `App` dagi `useEffect` da edi va HECH QACHON ISHLAMASDI:
   komponentda shartli erta `return` lar bor (mijoz portali, mobil ilova)
   va oddiy oqimda effekt ularning ortida qolib ketardi. Brauzerda
   o'lchab ko'rilganda kassa ekrani chizilgandan 14 soniya keyin ham
   birorta chunk tortilmagan edi.

   Bu yerda esa hech qanday shart yo'q: ilova ishga tushdi — demak
   rejalashtirildi. Oflayn uchun kesh aynan shunga bog'liq. */
schedulePrefetch();
