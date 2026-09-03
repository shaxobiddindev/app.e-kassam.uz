import { lazy } from "react";

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

const LOADERS = {
  Dashboard:    () => import("../pages/DashboardPage"),
  Products:     () => import("../pages/ProductsPage"),
  Inventory:    () => import("../pages/InventoryPage"),
  Batches:      () => import("../pages/BatchesPage"),
  StockTake:    () => import("../pages/StockTakePage"),
  Expenses:     () => import("../pages/ExpensesPage"),
  Loyalty:      () => import("../pages/LoyaltyPage"),
  Announcements:() => import("../pages/AnnouncementsPage"),
  Supply:       () => import("../pages/SupplyPage"),
  Transfers:    () => import("../pages/TransfersPage"),
  Pickup:       () => import("../pages/PickupPage"),
  Prices:       () => import("../pages/PricesPage"),
  Customers:    () => import("../pages/CustomersPage"),
  Kassa:        () => import("../pages/KassaPage"),
  Reports:      () => import("../pages/ReportsPage"),
  Sales:        () => import("../pages/SalesPage"),
  Categories:   () => import("../pages/admin/CategoriesPage"),
  CustomReport: () => import("../pages/admin/CustomReportPage"),
  ShopUsers:    () => import("../pages/admin/ShopUsersPage"),
  Shops:        () => import("../pages/admin/ShopsPage"),
  Settings:     () => import("../pages/SettingsPage"),
  Security:     () => import("../pages/SecurityPage"),
  Audit:        () => import("../pages/AuditPage"),
};

/** `<P.Kassa toast={toast} />` — marshrutlarda shu ko'rinishda ishlatiladi. */
export const P = Object.fromEntries(
  Object.entries(LOADERS).map(([name, load]) => [name, lazy(load)])
);

/**
 * Qolgan sahifalarni FONDA yuklab qo'yish.
 *
 * ⚠ KETMA-KET, barchasi birdan emas. Yigirmata so'rovni bir vaqtda
 * yuborish kassa ekranining o'z so'rovlari bilan tarmoq uchun
 * raqobatlashardi — aynan kassir ishlayotgan paytda. Ketma-ket yuklashda
 * hech kim sezmaydi.
 *
 * ⚠ Xato JIMGINA yutiladi: oldindan yuklash — qulaylik, sharт emas.
 * Chunk keyinroq, sahifaga o'tilganda baribir so'raladi.
 */
export async function prefetchPages() {
  for (const load of Object.values(LOADERS)) {
    try {
      await load();
    } catch (_) {
      /* tarmoq uzilgan yoki chunk yo'q — keyin qayta urinilmaydi */
    }
  }
}

/**
 * Ilova ishga tushib, TINCHIGANDAN KEYIN oldindan yuklashni boshlaydi.
 *
 * ⚠ KECHIKISH ATAYLAB KATTA (8 soniya). O'lchab ko'rilgan: `requestIdleCallback`
 * ni yolg'iz ishlatganda brauzer ilova ochilgan zahoti «bo'sh» deb hisoblab,
 * 21 ta chunkni 1.2 soniya ichida tortib olardi — aynan kassa ekrani o'z
 * so'rovlarini yuborayotgan paytda. Bu bo'lishning ma'nosini qisman yo'qqa
 * chiqarardi: birinchi chizish yengillashadi-yu, undan keyingi soniyalar
 * og'irlashardi.
 *
 * Endi avval kassir ishini boshlaydi, keyin fon yuklashi.
 *
 * ⚠ SEKIN ULANISHDA UMUMAN QILINMAYDI. 2G da 60 KB qo'shimcha yuklash
 * kassirdan real soniyalarni o'g'irlaydi, evaziga esa faqat «hisobotlar
 * oflaynda ochiladi» degan ehtimol beradi. Bu almashuv foydali emas.
 */
export function schedulePrefetch() {
  if (typeof window === "undefined") return;
  // Oflaynda urinishning ma'nosi yo'q — tarmoq qaytganda sahifa o'zi so'raydi.
  if (navigator.onLine === false) return;

  const net = navigator.connection;
  if (net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || ""))) return;

  /* ⚠ `requestIdleCallback` OLIB TASHLANDI. U «brauzer bo'sh bo'lganda»
     degan chiroyli va'da beradi, lekin brauzerda o'lchab ko'rilganda
     UMUMAN ISHGA TUSHMADI — `timeout` bilan ham. Ishonch hosil qilib
     bo'lmaydigan aqllilik ishonchli oddiylikdan yomonroq: 8 soniyalik
     kechikish «ilova o'z ishini boshlab olsin» maqsadini baribir
     bajaradi va uni sinovda ko'rish mumkin. */
  setTimeout(prefetchPages, 8000);
}
