import { useEffect, useState } from "react";
import { shopApi } from "../api";

/* ══════════════════════════════════════════════════════════════════════════
   DO'KONDA QAYSI BO'LIMLAR BOR (V49)

   Menyu shu ro'yxatdan quriladi: ro'yxatda yo'q bo'lim UMUMAN chizilmaydi —
   o'chirilgan ko'rinishda ham emas. O'chirilgan tugma «pul to'lasang
   ochiladi» degan ma'no beradi, bu yerda esa gap boshqa: bunday ish bu
   do'konda yo'q.

   ⚠⚠ XATO BO'LSA — HAMMASI OCHIQ. So'rov yiqilsa (tarmoq uzildi, eski
   backend, server 500 berdi) menyu TO'LIQ ko'rsatiladi.

   Sabab: bu ro'yxat HIMOYA EMAS. Haqiqiy to'siq serverda
   (`ShopFeatureGuard` — yopiq modul 403 qaytaradi). Ya'ni ochiq
   qoldirishdan hech narsa ochilmaydi, yopib qo'yishdan esa haqiqiy zarar
   bor: internet bir soniyaga uzilgani uchun kassirning butun menyusi
   yo'qolib, u ishlay olmay qolardi.

   ⚠ BIR MARTA o'qiladi va keshlanadi. Modul holati kunda bir marta ham
   o'zgarmaydi (uni admin qo'yadi), har sahifada qayta so'rash esa bekorga
   trafik bo'lardi. Yangilash uchun ilovani qayta ochish kifoya — admin
   modul o'chirganda xodimga baribir aytiladi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Modul holati — ilova ichida bitta nusxa. */
let cache = null;
let inflight = null;

/** Chiqishda tozalanadi: keyingi xodim boshqa do'konga kirishi mumkin. */
export function resetShopFeatures() {
  cache = null;
  inflight = null;
}

function load() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = shopApi.getFeatures()
    .then((res) => {
      const d = res?.data;
      cache = {
        // `null` — «noma'lum», bo'sh massiv EMAS: ikkalasini ajratmasak
        // yiqilgan so'rov «hech qanday modul yo'q» bo'lib o'qilardi.
        features: Array.isArray(d?.features) ? new Set(d.features) : null,
        directions: d?.directions || [],
        unconfigured: !!d?.unconfigured,
      };
      return cache;
    })
    .catch(() => {
      // Yuqoridagi qoida: xato — hamma modul ochiq.
      cache = { features: null, directions: [], unconfigured: false };
      return cache;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

export function useShopFeatures() {
  const [state, setState] = useState(cache);

  useEffect(() => {
    let alive = true;
    load().then((v) => { if (alive) setState(v); });
    return () => { alive = false; };
  }, []);

  /**
   * Modul ochiqmi.
   *
   * ⚠ `feature` berilmagan bo'lsa — HAR DOIM ochiq. Menyudagi ko'p band
   * modulga bog'lanmagan (kassa, mahsulotlar, sozlamalar) va ular
   * ro'yxatga qo'shilmaydi.
   *
   * ⚠ Javob hali kelmaganda ham ochiq: kutish paytida menyuni bo'sh
   * ko'rsatish ilovani «buzilgan» qilib ko'rsatardi.
   */
  const has = (feature) => {
    if (!feature) return true;
    if (!state || !state.features) return true;
    return state.features.has(feature);
  };

  return { has, ready: !!state, directions: state?.directions || [], unconfigured: !!state?.unconfigured };
}
