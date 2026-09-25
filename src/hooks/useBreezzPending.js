import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { breezzApi } from "../api";
import { roleSet } from "../lib/ek-roles";

/* ══════════════════════════════════════════════════════════════════════════
   Kutayotgan Breezz ulash so'rovlari soni (V140) — menyudagi belgi

   ⚠ NEGA KERAK. So'rovni Breezz admini yuboradi, egasi esa «Breezz»
   oynasini o'zi ochmaguncha bilmaydi — 7 kundan keyin so'rov jimgina
   muddati o'tgan bo'ladi. Push va Telegram ham ketadi (server), lekin
   ular o'chiq bo'lishi mumkin; menyudagi son esa har doim ko'rinadi.

   ⚠ Faqat EGASI: tasdiqlashni faqat u qila oladi (umumiy hujjat §10.6.2).
   Boshqa rolga so'rov umuman yuborilmaydi — server baribir 403 berardi.
   ══════════════════════════════════════════════════════════════════════════ */
export function useBreezzPending(user) {
  const [count, setCount] = useState(0);
  const isOwner = roleSet(user?.role).has("OWNER");
  const location = useLocation();

  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    const load = () =>
      breezzApi.pendingCount()
        .then((r) => { if (alive) setCount(Number(r.data) || 0); })
        .catch(() => {});
    load();
    const id = setInterval(load, 120000);
    return () => { alive = false; clearInterval(id); };
    // location.pathname: tasdiqlab boshqa sahifaga o'tilganda son yangilansin.
  }, [isOwner, location.pathname]);

  return isOwner ? count : 0;
}
