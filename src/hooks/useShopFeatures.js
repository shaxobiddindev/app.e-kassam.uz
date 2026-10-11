import { useEffect, useState } from "react";
import { shopApi } from "../api";
import { isOn as scaleOn, stop as scaleStop } from "../lib/ek-scale-live";

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

/**
 * Faqat restoranda bo'ladigan modullar (backenddagi `ShopFeature.isOptIn`).
 *
 * ⚠ ULAR UCHUN QOIDA TESKARI — noma'lum bo'lsa YOPIQ (2026-10-08). Egasi:
 * «restoranning ba'zi bo'limlari do'konlarda ko'rinyapti — aslo
 * aralashmasin». Javob kelguncha yoki so'rov yiqilganda «hammasi ochiq»
 * qoidasi do'kon kassasida zal va oshxonani ko'rsatib qo'yardi. Do'kon
 * uchun bu bo'limlar «ish yo'qolishi» emas — ular umuman uning ishi emas;
 * restoranda esa ular baribir serverga bog'liq (stol buyurtmasi serverda).
 */
export const RESTAURANT_FEATURES = ["MODIFIERS", "RECIPES", "KITCHEN", "TABLES"];

/** Modul holati — ilova ichida bitta nusxa. */
let cache = null;
let inflight = null;

/* ⚠ OXIRGI MA'LUM JAVOB XOTIRADA (2026-10-11) — «eskirgan, keyin yangi».

   Bosh sahifa shu javobni kutadi (restoranmi — do'konmi) va kutish uni
   ikki marta chizdirardi: avval `<Progress/>`, javob kelgach yana bir
   to'liq chizish va layout. Sekin protsessorda bu yuzlab millisekund.
   Endi oldingi ochilishdagi javob darhol `ready` beradi, so'rov esa
   baribir ketadi va javob farq qilsa menyu yangilanadi.

   ⚠ Faqat ANIQ javob saqlanadi (`features` massiv) — «noma'lum»
   yozilsa, keyingi ochilishda u bilimga aylanib qolardi.
   ⚠ Kalit `clearSession` va chiqishda o'chadi: keyingi xodim boshqa
   do'konniki bo'lishi mumkin (V49 dagi xuddi shu sabab). Chiqmasdan
   tugagan sessiyadan keyin esa kalit qolib ketadi — shuning uchun yozuv
   DO'KON KODI va LOGIN bilan bog'langan, mos kelmasa o'qilmaydi.
   ⚠ DANGASA o'qiladi (birinchi kerak bo'lganda), modul yuklanganda EMAS:
   auth'dan `?token=` bilan qaytilganda yangi sessiyani `App.jsx` o'z
   tanasida yozadi va bu fayl undan OLDIN bajariladi — erta o'qilsa,
   eski do'kon kodi bilan solishtirilardi. */
const STORE_KEY = "ek_features";

const owner = () => `${localStorage.getItem("ek_shopCode") || ""}|${localStorage.getItem("ek_username") || ""}`;

function readStored() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!d || !Array.isArray(d.features) || d.owner !== owner()) return null;
    return { features: new Set(d.features), directions: d.directions || [], unconfigured: !!d.unconfigured };
  } catch (_) { return null; }
}
let stale;
const getStale = () => (stale === undefined ? (stale = readStored()) : stale);

/** Chiqishda tozalanadi: keyingi xodim boshqa do'konga kirishi mumkin. */
export function resetShopFeatures() {
  cache = null;
  inflight = null;
  stale = null;
  try { localStorage.removeItem(STORE_KEY); } catch (_) { /* yopiq xotira */ }
}

/** Javob xotiradagi bilan bir xilmi — bir xil bo'lsa o'sha OBYEKT qaytadi
 *  va `setState` hech narsani qayta chizmaydi. */
const same = (a, b) => !!a && !!b && a.unconfigured === b.unconfigured
  && JSON.stringify(a.directions) === JSON.stringify(b.directions)
  && !!a.features && !!b.features && a.features.size === b.features.size
  && [...a.features].every((f) => b.features.has(f));

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
      if (same(cache, getStale())) cache = getStale();
      else if (cache.features) {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({
            owner: owner(), features: [...cache.features], directions: cache.directions, unconfigured: cache.unconfigured,
          }));
        } catch (_) { /* to'la xotira — keyingi safar shunchaki kutiladi */ }
      }

      /* ⚠ «TAROZI» MODULI O'CHIRILSA — PORT HAM YOPILADI (V113).

         Tarozi ilova ochilganda O'ZI ulanadi va uni boshqaradigan
         panel sozlamalarda shu modul bilan chiziladi. Modul
         o'chirilgach panel yo'qoladi, port esa ochiqligicha
         qolardi: kassada og'irlik ko'rinaverar, uni to'xtatadigan
         tugma esa hech qayerda yo'q edi.

         ⚠ FAQAT javob ANIQ bo'lganda. `features === null` — «noma'lum»
         (tarmoq uzildi, eski backend) va bu faylning bosh qoidasi
         bo'yicha o'shanda hech narsa yopilmaydi. */
      if (cache.features && !cache.features.has("SCALE") && scaleOn()) scaleStop();

      return cache;
    })
    .catch(() => {
      /* Yuqoridagi qoida: xato — hamma modul ochiq. Lekin oxirgi ANIQ
         javob bo'lsa, o'sha qoladi: u «noma'lum» emas, do'konning haqiqiy
         sozlamasi — bir soniyalik uzilish menyuni o'zgartirmasin. */
      cache = getStale() || { features: null, directions: [], unconfigured: false };
      return cache;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

/**
 * So'rovni React chizishidan OLDIN yuborish (`main.jsx`, 2026-10-11).
 *
 * ⚠ NEGA. Bosh sahifa shu javobni kutadi (`HomeRoute`: restoranmi yoki
 * do'kon — noto'g'ri panel bir lahza chizilmasin). Ilgari so'rov faqat
 * birinchi `useEffect` da ketardi, ya'ni lug'at yuklanib, daraxt chizilib
 * bo'lgach — o'lchovda ~2.7 soniyada. Endi u lug'at bilan parallel ketadi;
 * javob keshga tushadi va hook uni tayyor oladi.
 */
export function prefetchShopFeatures() {
  load();
}

export function useShopFeatures() {
  const [state, setState] = useState(() => cache || getStale());
  const [fresh, setFresh] = useState(() => !!cache);

  useEffect(() => {
    let alive = true;
    load().then((v) => { if (alive) { setState(v); setFresh(true); } });
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
    if (!state || !state.features) return !RESTAURANT_FEATURES.includes(feature);
    return state.features.has(feature);
  };

  const directions = state?.directions || [];
  /* Restoranmi — rollar va «Menejer» nomi shundan. Yo'nalish bo'yicha,
     modul bo'yicha emas: admin restoranda stolni o'chirib qo'ysa ham u
     restoranligicha qoladi. */
  const isRestaurant = directions.includes("RESTAURANT");

  /* ⚠ IKKI XIL «TAYYOR» (2026-10-11).
     `ready` — SHU SESSIYADAGI javob keldi. Qaytarib bo'lmaydigan har qanday
     qaror shunga tayanadi: marshrutdan yo'naltirish (`FeatureRoute` va
     boshqalar), bir martalik yuklash (`[ready]` effektlari). Eskirgan
     keshga tayansa, admin modulni o'zgartirgandan keyingi birinchi
     ochilishda xodim noto'g'ri sahifaga yo'naltirilib, u yerda qolardi —
     yangi javob kelganda kech bo'ladi. `check-mod` aynan shuni ushladi.
     `known` — eskirgan javob ham hisob: faqat QAYTA CHIZILADIGAN qaror
     uchun (bosh sahifadagi panel tanlovi), javob kelsa o'zi tuzaladi. */
  return { has, ready: fresh, known: !!state, directions, isRestaurant, unconfigured: !!state?.unconfigured };
}
