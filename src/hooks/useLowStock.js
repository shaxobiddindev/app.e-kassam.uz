import { useState, useCallback, useEffect, useRef } from "react";
import { inventoryApi } from "../api";

// Har 60 soniyada avtomatik tekshiradi
// Sotuvdan keyin refresh() chaqirilsa darhol yangilanadi
export function useLowStock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

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

  // Birinchi yuklash
  useEffect(() => {
    fetch();
  }, [fetch]);

  return { lowStockItems: items, lowStockCount: items.length, refreshLowStock: fetch, loading };
}
