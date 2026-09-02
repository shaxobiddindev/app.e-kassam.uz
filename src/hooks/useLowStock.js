import { useState, useCallback, useEffect, useRef } from "react";
import { inventoryApi } from "../api";
import { useShopFeatures } from "./useShopFeatures";

/* Kam qoldiq ogohlantirishi — har 60 soniyada tekshiriladi.
   Sotuvdan keyin `refresh()` chaqirilsa darhol yangilanadi.

   ⚠ OMBOR MODULI YOPIQ BO'LSA UMUMAN SO'RAMAYDI (V49). Sartaroshxonada
   `/inventory/low-stock` server tomonidan to'siladi (403) va bu hook
   xatoni jimgina yutgani uchun ekranda hech narsa ko'rinmasdi —
   lekin so'rov HAR DAQIQADA, do'kon ochiq turgan butun kun davomida
   takrorlanaverardi. Brauzer konsoli va server logi ma'nosiz 403
   bilan to'lardi va haqiqiy nosozlikni o'sha shovqin ichidan topish
   qiyin bo'lardi. */
export function useLowStock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const { has: hasFeature, ready } = useShopFeatures();
  const enabled = hasFeature("INVENTORY");

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getLow();
      setItems(res.data || []);
    } catch (_) {
      // Xato bo'lsa jimgina o'tkazib yuboramiz
    } finally {
      setLoading(false);
    }
  }, []);

  /* Birinchi yuklash + har 60 soniyada avtomatik.

     ⚠ `ready` KUTILADI: modul ro'yxati kelmaguncha `hasFeature` hamma
     narsaga `true` qaytaradi (bu qasddan — menyu bo'sh ko'rinmasin).
     Shu sababli kutmasdan so'rov yuborilsa, ombori yo'q do'konda ham
     birinchi so'rov baribir ketib, 403 olardi. */
  useEffect(() => {
    if (!ready || !enabled) return;
    fetch();
    timerRef.current = setInterval(fetch, 60_000);
    return () => clearInterval(timerRef.current);
  }, [fetch, ready, enabled]);

  // Sotuvdan keyin chaqirish uchun
  const refresh = useCallback(() => {
    if (!enabled) return;
    clearInterval(timerRef.current);
    fetch();
    timerRef.current = setInterval(fetch, 60_000);
  }, [fetch, enabled]);

  return { lowStockItems: items, lowStockCount: items.length, refreshLowStock: refresh, loading };
}
