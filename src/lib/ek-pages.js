/* ⚠ `lazySafe` ALOHIDA MODULDA: sahifalar (`KassaPage`) ham uni
   ishlatadi va shu fayldan import qilsalar aylanma bog'lanish
   hosil bo'lardi (`ek-pages` → sahifa → `ek-pages`). */
import { lazySafe } from "./ek-lazy.js";

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
  Labels:       () => import("../pages/LabelsPage"),
  CustomReport: () => import("../pages/admin/CustomReportPage"),
  ShopUsers:    () => import("../pages/admin/ShopUsersPage"),
  Shops:        () => import("../pages/admin/ShopsPage"),
  Settings:     () => import("../pages/SettingsPage"),
  Security:     () => import("../pages/SecurityPage"),
  Audit:        () => import("../pages/AuditPage"),
};

/** `<P.Kassa toast={toast} />` — marshrutlarda shu ko'rinishda ishlatiladi. */
export const P = Object.fromEntries(
  Object.entries(LOADERS).map(([name, load]) => [name, lazySafe(load, name)])
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
