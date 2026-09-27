/* ══════════════════════════════════════════════════════════════════════════
   «BREEZZ'DA PAUZA» — KIM BOSA OLADI (umumiy hujjat §17, §10.12)

   Tovar do'konda sotilaveradi, faqat Breezz mijozlariga ko'rinmaydi.
   Sotuv kanalini to'xtatish — egasi va do'kon adminining qarori: omborchi
   va kassir bosa olmaydi. Server ham shuni qo'yadi
   (`ProductController.breezzPause`), bu yerdagi ro'yxat esa tugmani
   ko'rsatish uchun — kassirga tugma ko'rsatib, keyin 403 berish faqat
   umid uyg'otardi.

   ⚠ Filial Breezz'ga ULANMAGAN bo'lsa tugma umuman yo'q: u yerda pauza
   hech narsani o'zgartirmaydi va faqat chalg'itardi.
   ══════════════════════════════════════════════════════════════════════════ */
import { roleSet } from "./ek-roles.js";

export const BREEZZ_PAUSE_ROLES = ["OWNER", "SHOP_ADMIN"];

/** Rol pauza qo'ya oladimi — filial holatini so'rashga arziydimi. */
export function canBreezzPauseRole(role) {
  const roles = roleSet(role);
  return BREEZZ_PAUSE_ROLES.some((r) => roles.has(r));
}

/** Tugma ko'rinadimi: rolda ruxsat bor VA filial ulangan. */
export function canBreezzPause(role, linked) {
  return Boolean(linked) && canBreezzPauseRole(role);
}
