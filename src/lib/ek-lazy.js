import { lazy } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   ESKIRGAN CHUNK — «Failed to fetch dynamically imported module»

   ⚠ DO'KON SHIKOYATI (2026-09-24): kassa, katalog va sozlamalar
   ekranlari ochilmadi. Konsolda:

       Failed to fetch dynamically imported module:
         https://app.e-kassam.uz/assets/KassaPage-B_D2KGzd.js

   Bu nom BIR OY OLDINGI buildga tegishli. Sabab shu ketma-ketlikda:

     1. kassa monobloki kunlab yopilmaydi — sahifa ochiq turadi;
     2. shu vaqtda yangi versiya chiqadi va Netlify eski `assets/`
        fayllarini o'chiradi (nomlarda kontent xeshi bor);
     3. kassir «Savdo» ga o'tadi — sahifadagi ESKI HTML endi serverda
        BO'LMAGAN chunk nomini so'raydi;
     4. service worker `cache-first` ishlaydi, lekin brauzer keshini
        tozalagan bo'lsa nusxa ham yo'q → 404 → `import()` yiqiladi.

   ⚠ `AppUpdater` bu yerda YORDAM BERMAYDI: u faqat desktopda ishlaydi
   va izohida «veb versiyani Netlify o'zi yangilaydi» deb yozilgan edi.
   Netlify yangi faylni BERADI, lekin ochiq turgan sahifa eski nomni
   so'rashda davom etadi — uni hech narsa xabardor qilmaydi.

   ⚠ NEGA ODDIY `catch` YETMAYDI: xato ushlansa ekran «Xatolik yuz berdi»
   bo'lib qoladi va kassir bir xil natijani qayta-qayta oladi. Yagona
   ishlaydigan yechim — SAHIFANI YANGILASH: yangi HTML yangi chunk
   nomlarini olib keladi. Savat `localStorage` da, ya'ni yangilash uni
   yo'qotmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Qaysi sahifa uchun allaqachon yangilanganmiz (tab doirasida). */
const RELOAD_KEY = "ek_chunk_reload";

/* Maxfiy rejimda `sessionStorage` istisno tashlashi mumkin — o'sha yerda
   ham ishlashi kerak, shuning uchun himoyalangan. */
const mark = (v) => { try { sessionStorage.setItem(RELOAD_KEY, v); } catch (_) {} };
const marked = () => { try { return sessionStorage.getItem(RELOAD_KEY); } catch (_) { return null; } };
const unmark = () => { try { sessionStorage.removeItem(RELOAD_KEY); } catch (_) {} };

/**
 * `lazy()`, lekin eskirgan chunkdan o'zini tiklaydi.
 *
 * ⚠ IKKI BOSQICH: avval bir marta QAYTA URINADI (tarmoqdagi bir martalik
 * uzilish bo'lishi mumkin va bunda sahifani yangilash ortiqcha), so'ng
 * sahifani yangilaydi.
 *
 * ⚠ BITTA SAHIFA UCHUN BITTA YANGILASH. Ikkinchi marta ham yiqilsa xato
 * OSHIRILADI va `RouteErrorBoundary` ni ko'rsatadi: cheksiz yangilanish
 * halqasi kassirni ishlay olmaydigan holatga solib qo'yardi va sababini
 * ham ko'rsatmasdi.
 */
export function lazySafe(load, name) {
  return lazy(async () => {
    try {
      const mod = await load();
      /* Muvaffaqiyatdan keyin bayroq tozalanadi: keyingi reliz yana
         eskirtirsa, yangilash yo'li ochiq qolishi kerak. */
      if (marked() === name) unmark();
      return mod;
    } catch (first) {
      try { return await load(); } catch (_) { /* ikkinchi urinish ham yiqildi */ }

      if (marked() !== name) {
        mark(name);
        /* ⚠ `location.reload()` — `href` ni qayta yozish EMAS: manzil
           o'zgarmasligi kerak, kassir qaysi ekranga o'tayotgan bo'lsa
           yangilangandan keyin o'sha yerda bo'ladi. */
        location.reload();
        /* Yangilash asinxron. Hal bo'lmaydigan promise Suspense ni
           joyida ushlab turadi — aks holda bir lahza xato ekrani
           miltillab o'tardi. */
        return new Promise(() => {});
      }
      throw first;
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   MARSHRUTLARNI BO'LISH (2026-08-27)

   ⚠ MUAMMO. Ilova BITTA yaxlit to'plam edi — 793 KB xom, 234 KB gzip.
   Kassir kassa ekranini ochish uchun hisobotlar, mijozlar, sozlamalar va
   superadmin sahifalarini ham yuklab olardi. Do'kondagi sekin internetda
   bu birinchi ochilishni cho'zib yuborardi.

   ⚠ ENDI HAR SAHIFA ALOHIDA CHUNK, LEKIN OFLAYN BUZILMAYDI. Bu ilova
   oflaynda ishlashi kerak (sotuv navbati IndexedDB da) va service worker
   `cache-first` strategiyasida ishlaydi:

       bir marta yuklangan chunk → keshda, oflaynda ochiladi
       hech qachon yuklanmagani → keshda YO'Q, oflaynda OCHILMAYDI

   Ya'ni yolg'iz bo'lish yangi teshik ochardi: kassir tarmoqsiz qolganda
   «Hisobotlar» ga o'tolmasdi. Shu sababli ilova bo'shashi bilan qolgan
   chunklar FONDA oldindan yuklanadi — birinchi ochilish yengil qoladi,
   tarmoq uzilganda esa hammasi allaqachon keshda bo'ladi.

   ⚠ IMPORT YO'LI BITTA JOYDA. Lazy chaqiruv ham, oldindan yuklash ham
   AYNAN shu funksiyalarni ishlatadi. Ikki joyda yozilganda Vite ularni
   ikkita alohida chunk deb hisoblashi va oldindan yuklash boshqa faylni
   tortishi mumkin edi — kesh to'lardi-yu, foyda bermasdi.
   ══════════════════════════════════════════════════════════════════════════ */
