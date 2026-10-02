import { useEffect, useState } from "react";
import { breezzApi } from "../api";
import { canBreezzPause, canBreezzPauseRole } from "../lib/ek-breezz";
import { BREEZZ_UI } from "../config";

/* ══════════════════════════════════════════════════════════════════════════
   «Filial Breezz'ga ulanganmi?» — «Breezz'da pauza» tugmasi uchun (§17.4)

   ⚠ Faqat OWNER va SHOP_ADMIN so'raydi: boshqa rolga tugma baribir
   ko'rinmaydi, server esa 403 berardi.

   ⚠ Xato bo'lsa — `false`, tugma yashirin. Bu `useShopFeatures` ning
   teskarisi va ataylab: u yerda menyuni yashirish kassirning ishini
   to'xtatardi, bu yerda esa pauza shoshilinch amal emas — sahifani qayta
   ochish kifoya, server esa ruxsatni baribir o'zi tekshiradi.

   Har sahifa ochilganda bir marta so'raladi: ulanishni egasi boshqa
   oynada tasdiqlashi yoki uzishi mumkin, eskirgan kesh esa tugmani
   noto'g'ri ko'rsatardi.
   ══════════════════════════════════════════════════════════════════════════ */
export function useBreezzLinked(user) {
  // ⏸ Bo'lim yashirin (`BREEZZ_UI`) — so'rov yo'q, tugma ham yo'q.
  const allowed = BREEZZ_UI && canBreezzPauseRole(user?.role);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    breezzApi.status()
      .then((r) => { if (alive) setLinked(Boolean(r?.data?.linked)); })
      .catch(() => { if (alive) setLinked(false); });
    return () => { alive = false; };
  }, [allowed]);

  return canBreezzPause(user?.role, linked);
}
