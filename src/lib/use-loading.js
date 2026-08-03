import { useEffect, useRef, useState } from "react";

/* ==========================================================================
   Yuklanish holatini KO'RSATISH qoidalari

   Bu fayl yuklanish tizimining eng muhim qismi — u nimani chizishni emas,
   QACHON chizishni hal qiladi.

   Ikkita muammo bor va ikkalasi ham foydalanuvchini bezovta qiladi:

   1. **Miltillash.** So'rov 80ms da qaytadi, lekin skeleton bir kadrga
      chizilib o'chadi. Ko'z buni "nosozlik" deb o'qiydi.
      → Yechim: `delay` (180ms) o'tmaguncha hech narsa ko'rsatilmaydi.

   2. **Sakrash.** Skeleton ko'rsatildi va 40ms dan keyin yo'qoldi.
      → Yechim: bir marta ko'rsatilgach `minVisible` (400ms) turadi.

   Natijada: tez javoblarda yuklanish holati UMUMAN ko'rinmaydi, sekin
   javoblarda esa u tinch va barqaror turadi.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

const DEFAULT_DELAY = 180;        // shundan tez javob — hech narsa ko'rsatilmaydi
const DEFAULT_MIN_VISIBLE = 400;  // ko'rsatilgach kamida shuncha turadi

/**
 * @param {boolean} loading  haqiqiy yuklanish holati
 * @returns {boolean}        EKRANDA ko'rsatiladigan holat
 *
 * @example
 *   const busy = useLoading(loading);
 *   return busy ? <SkeletonTable /> : <Table rows={rows} />;
 */
export function useLoading(loading, { delay = DEFAULT_DELAY, minVisible = DEFAULT_MIN_VISIBLE } = {}) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let showTimer, hideTimer;

    if (loading) {
      showTimer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (visible) {
      const shownFor = Date.now() - shownAt.current;
      const rest = Math.max(0, minVisible - shownFor);
      hideTimer = setTimeout(() => setVisible(false), rest);
    }

    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    // `visible` ataylab bog'liqlikda: yashirish taymeri faqat u yoqilgan
    // bo'lsa kerak bo'ladi.
  }, [loading, visible, delay, minVisible]);

  return visible;
}

/**
 * Bir nechta parallel so'rov uchun hisoblagich.
 * Har bir so'rov `start()` chaqiradi va tugaganda `stop()`.
 * Oxirgisi tugagunicha holat yoqiq qoladi.
 */
export function useLoadingCounter(options) {
  const [count, setCount] = useState(0);
  const busy = useLoading(count > 0, options);
  return {
    busy,
    start: () => setCount((n) => n + 1),
    stop: () => setCount((n) => Math.max(0, n - 1)),
    /** `track(promise)` — boshlash va tugatishni o'zi hal qiladi */
    track: async (promise) => {
      setCount((n) => n + 1);
      try { return await promise; }
      finally { setCount((n) => Math.max(0, n - 1)); }
    },
  };
}
