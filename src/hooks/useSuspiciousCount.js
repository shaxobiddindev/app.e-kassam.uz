import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { securityApi } from "../api";
import { roleSet } from "../lib/ek-roles";

/* ══════════════════════════════════════════════════════════════════════════
   Tasdiqlanmagan SHUBHALI amallar soni

   Ilgari bu mantiq `Layout.jsx` ichida yashiringan edi va faqat yon menyuga
   xizmat qilardi. Endi u alohida: bir xil son IKKI joyda kerak —

     yon menyu «Xavfsizlik»  → qaysi BO'LIM e'tibor talab qilishini aytadi
     Xavfsizlik → «Jurnal»   → o'sha bo'lim ICHIDA qaysi tab ekanini aytadi

   Ikkinchisisiz egasi menyudagi qizil raqamni ko'rib sahifaga kiradi, so'ng
   uchta tab orasidan qay birida ekanini qidirishga majbur bo'lardi.

   ⚠ Faqat egasi va do'kon administratori uchun: kassirga bu son ko'rinmaydi
   (u o'zi haqidagi shubha bo'lishi ham mumkin).
   ══════════════════════════════════════════════════════════════════════════ */
export function useSuspiciousCount(user) {
  const [count, setCount] = useState(0);
  const canSee = roleSet(user?.role).has("OWNER") || roleSet(user?.role).has("SHOP_ADMIN");
  const location = useLocation();

  const refresh = useCallback(() => {
    if (!canSee) return Promise.resolve();
    return securityApi.suspiciousCount()
      .then((r) => setCount(Number(r.data) || 0))
      .catch(() => {});
  }, [canSee]);

  useEffect(() => {
    if (!canSee) return;
    let alive = true;
    const load = () =>
      securityApi.suspiciousCount()
        .then((r) => { if (alive) setCount(Number(r.data) || 0); })
        .catch(() => {});
    load();
    const id = setInterval(load, 120000);
    return () => { alive = false; clearInterval(id); };
    // location.pathname: «Ko'rdim» bosilgach boshqa sahifaga o'tishda
    // hisob yangilansin.
  }, [canSee, location.pathname]);

  return { count: canSee ? count : 0, refresh };
}
