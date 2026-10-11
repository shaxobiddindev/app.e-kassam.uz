/* Ilova ochilganda qaysi sahifa chiziladi — ERTA YUKLASH uchun (2026-10-11).

   Bitta ro'yxat ikki joyda o'qiladi va shuning uchun alohida faylda,
   bog'liqliksiz:
     · `scripts/vite-early-preload.mjs` (Node, build paytida) — HTML ga
       bo'lak nomlarini yozadi va ular kirish JS bilan parallel yuklanadi;
     · `ek-pages.js` (`bootPage`) — o'sha sahifa moduli render'dan oldin
       bajariladi va birinchi chizishning o'zida chiqadi.
   Ikki nusxa bo'lsa, biri yangilanib ikkinchisi eskirardi — xato emas,
   faqat jimgina sekinlashish, uni esa hech kim payqamaydi. */

/** Shartsiz bitta sahifa chiziladigan yo'llar. Restoran/do'konga qarab
 *  boshqa joyga yo'naltiradiganlari (`/menu`, `/staff`…) ataylab yo'q. */
export const PAGE_ROUTES = {
  "/sale": "Kassa",
  "/restaurant": "RestaurantFloor",
  "/kitchen": "Kitchen",
  "/products": "Products",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/sales": "Sales",
  "/reports": "Reports",
  "/reports/day": "DayReport",
  "/settings": "Settings",
};

/** Bosh sahifa (`/`) rolga va yo'nalishga qarab chizadigan sahifalar —
 *  qaysi biri bo'lgani `ek_home_page` da eslab qolinadi (`HomeRoute`). */
export const HOME_PAGES = ["Dashboard", "RestaurantToday", "Kassa", "RestaurantFloor", "Kitchen"];

export const HOME_KEY = "ek_home_page";
