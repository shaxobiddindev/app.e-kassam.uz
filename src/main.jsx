import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { schedulePrefetch, preloadBootPage } from "./lib/ek-pages";
import App from "./App.jsx";
import { initTheme } from "./lib/ek-theme";
import { initLang, loadLocale } from "./lib/ek-i18n";
import { prefetchShopFeatures } from "./hooks/useShopFeatures";
import { isDesktop } from "./lib/ek-desktop";
import { initStatusBar } from "./lib/ek-statusbar";
import { autoConnect as scaleAutoConnect } from "./lib/ek-scale-live";
import { restoreDevice } from "./lib/ek-device-store";
import { initZoom } from "./lib/ek-zoom";

// Tema — index.html dagi inline skript birinchi bo'yoqni to'g'ri qiladi,
// bu yerda tizim sozlamasi o'zgarishini kuzatish yoqiladi.
initTheme();

// Android status-bar foni temaga ergashsin (ekran tepasidagi ko'k
// ajratuvchi chiziq shu bilan yo'qoladi). Telefondan boshqa joyda — jim.
initStatusBar();

/* ⚠ TAROZI O'ZI ULANADI (V112). Do'kon: «har safar tarozini
   ulayverish yaxshi emas». Brauzer port ruxsatini eslab qoladi,
   demak «tanlash» bir marta, «ochish» esa har safar oynasiz
   bo'lishi mumkin — kassir smenani sozlamalar sahifasidan
   boshlamaydi.

   ⚠ Tarozisi YO'Q do'konda hech narsa qilinmaydi: modul do'kon
   o'zi yoqib qo'ygan bo'lsagina portni qidiradi.

   ⚠ AVVAL FAYLDAN TIKLASH (2026-10-05): desktop'da printer va tarozi sozlamasi
   ilova faylida ham saqlanadi (`ek-device-store.js`). WebView xotirasi
   yo'qolgan bo'lsa, tarozi «tanishtirilmagan» deb qolmasin — sozlama avval
   qaytariladi, keyin ulanadi. Brauzerda bu darhol tugaydi. */
restoreDevice().finally(() => {
  scaleAutoConnect();
  /* Desktop masshtabi (Ctrl +/−, Ctrl + g'ildirak) — saqlangani fayldan
     tiklangandan keyin qo'llanadi. Brauzerda hech narsa qilmaydi. */
  initZoom();
});

// Til — URL dagi `?lang=` (ilovalararo yo'naltirishdan) localStorage ga
// ko'chiriladi va <html lang> qo'yiladi. Faqat INTERFEYSGA ta'sir qiladi.
const lang = initLang();

/* ⚠ SHRIFTLAR SHU YERDAN SO'RALADI (2026-10-11). Brauzer shriftni faqat
   birinchi chizishda matn topilganda so'raydi — sharsharada ~2.4 s da,
   ya'ni ular birinchi layoutdan KEYIN kelib, sahifani yana ikki-uch marta
   qayta joylashtirardi (4× sekin protsessorda har biri 100–300 ms).
   Bu nuqtada esa JS allaqachon yuklangan va tarmoq BO'SH: shriftlar
   birinchi layoutga yetib keladi.

   ⚠ `<link rel=preload>` EMAS: HTML dan so'ralsa, ular kirish JS bilan
   bir vaqtda tarmoq uchun raqobatlashib, uni sekinlashtirardi.
   ⚠ `document.fonts.load` — fayl nomi emas, CSS dagi `@font-face` bo'yicha:
   `unicode-range` hisobga olinadi (ruscha bo'lsa kirill bo'lagi ham). */
try {
  const sample = lang === "ru" ? "Aя" : "A";
  for (const f of ["1em Inter", "600 1em Manrope", "1em 'JetBrains Mono'"]) document.fonts.load(f, sample).catch(() => {});
} catch (_) { /* eski brauzer — shrift odatdagidek keyin keladi */ }

// PWA — planshetga o'rnatilganda brauzer paneli yo'qoladi, POS terminaliday ko'rinadi.
//
// ⚠ DESKTOP'DA RO'YXATDAN O'TKAZILMAYDI. `.exe` ichida service worker foydasiz
// (fayllar allaqachon lokal) va ZARARLI: u `assets/index-<hash>.js` ni
// cache-first bilan keshlaydi, yangi versiyada esa hash o'zgaradi. Tauri'ning
// o'z protokoliga SW ichidan qilingan `fetch` qaytmaydi, natijada yangi skript
// umuman yuklanmaydi va ilova QORA BO'SH OYNA bo'lib ochiladi. Aynan shu
// bo'lgan: keshda `index-CPDSY6t0.js` qolib, build `index-D04lIaqz.js` so'ragan.
// Eski o'rnatmalarni tozalash `index.html` dagi inline skriptda.
/* ⚠ `navigator.serviceWorker` NING O'ZI tekshiriladi, `"…" in navigator`
   EMAS (V93). Farq amalda chiqadi: XAVFSIZ BO'LMAGAN manbada (LAN
   ichidagi oddiy `http://192.168.…`) Chrome xossani prototipda
   QOLDIRADI, lekin `undefined` qaytaradi. `in` esa `true` deydi va
   keyingi qatordagi `.register` «Cannot read properties of undefined»
   bilan yiqilardi — ILOVA ISHGA TUSHISHIDA, ya'ni kassa umuman
   ochilmasdi.

   ⚠ Ovoz tekshiruvi topdi (`check-sfx.mjs` 7-band): u SW ni o'chirib
   ko'rgan va o'sha zahoti shu xato tushgan. */
if (navigator.serviceWorker && import.meta.env.PROD && !isDesktop()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

/* ⚠ LUG'AT RENDERDAN OLDIN (V48). Tillar alohida chunklarga
   bo'lingan va tanlangani kechiktirilib yuklanadi; `t()` esa sinxron
   qoladi (sabab `ek-i18n.js` da). Agar render kutmasa, ruscha yoki
   inglizcha ishlaydigan do'kon ekranni bir lahza O'ZBEKCHA ko'rib,
   keyin uning almashishini kuzatardi.

   ⚠ 2026-10-11 dan O'ZBEKCHA HAM kechiktirilgan (sabab `ek-i18n.js` da):
   kirish to'plami kichraydi, lug'at esa keshdan keladi. Xato bo'lsa ham
   chiziladi — kalit ko'rinadi, bo'sh ekran emas. */
const render = () =>
  createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);

/* Do'kon modullari so'rovi lug'at bilan PARALLEL (sabab `useShopFeatures.js`
   da). Faqat xodim sessiyasi bo'lsa — mijoz kabineti va kirish sahifasida
   bu so'rovning ma'nosi yo'q (401 qaytarardi). */
try {
  if (localStorage.getItem("ek_token") && localStorage.getItem("ek_type") === "user") prefetchShopFeatures();
} catch (_) { /* maxfiy rejim */ }

/* Ochilayotgan sahifa lug'atdan keyin, render'dan OLDIN bajariladi (sabab
   `ek-pages.js`, `preloadBootPage`). Bo'lak odatda kirish JS bilan birga
   allaqachon kelgan bo'ladi; kelmagan bo'lsa ko'pi bilan 1 soniya
   kutiladi — noto'g'ri taxmin yoki sekin tarmoq ekranni ushlab turmasin. */
const bootPage = () => Promise.race([preloadBootPage(), new Promise((r) => setTimeout(r, 1000))]);

loadLocale(lang).then(bootPage, bootPage).then(render, render);

/* ⚠ OLDINDAN YUKLASH SHU YERDA, `App` ICHIDA EMAS.

   Avval u `App` dagi `useEffect` da edi va HECH QACHON ISHLAMASDI:
   komponentda shartli erta `return` lar bor (mijoz portali, mobil ilova)
   va oddiy oqimda effekt ularning ortida qolib ketardi. Brauzerda
   o'lchab ko'rilganda kassa ekrani chizilgandan 14 soniya keyin ham
   birorta chunk tortilmagan edi.

   Bu yerda esa hech qanday shart yo'q: ilova ishga tushdi — demak
   rejalashtirildi. Oflayn uchun kesh aynan shunga bog'liq. */
schedulePrefetch();
