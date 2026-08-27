import { useState, useCallback, useEffect, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   Toast — xabarlar navbati.

   ⚠ MUAMMO (2026-08-27): kassir «+» ni bir necha marta bossa, har bosishga
   AYNAN BIR XIL xato chiqardi va kartochkalar ekran bo'ylab pastga
   cho'zilardi — oltita «omborda faqat 38 dona bor». Xabar bitta bo'lsa
   ham ekran to'lardi va orqadagi tugmalar berkilib qolardi.

   Uchta qoida bilan hal qilindi:

     1. TAKRORLANMAYDI. Ekranda turgan xabar aynan qaytarilsa, yangi
        kartochka yaratilmaydi — hisoblagichi oshadi (×3) va umri qaytadan
        boshlanadi. Kassir necha marta bosganini shu sondan ko'radi.

     2. CHEGARA BOR. Bir vaqtda ko'pi bilan uchta TURLI xabar turadi.
        To'rtinchisi kelsa eng eskisi ketadi — u allaqachon o'qilgan.

     3. UMR BITTA JOYDA SANALADI. Ilgari har xabar o'z `setTimeout` iga ega
        edi; takrorlanganda uni qayta qo'yish uchun taymerlarni alohida
        yuritish kerak bo'lardi. Endi kartochkada tug'ilgan vaqti turadi va
        bitta tozalagich ularni yig'ishtiradi — takrorlanganda shunchaki
        vaqti yangilanadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Bir vaqtda ko'rinadigan TURLI xabarlar soni. */
const MAX_VISIBLE = 3;

/** Kartochka qancha turadi. */
const TTL_MS = 4000;

/** Tozalagich qadami — 4 soniyalik umr uchun yetarlicha aniq. */
const SWEEP_MS = 250;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  /* `Date.now()` id sifatida yaramaydi: ketma-ket ikki chaqiruv bir xil
     millisekundga tushib, React kalitlari to'qnashishi mumkin. */
  const seq = useRef(0);

  const showToast = useCallback((msg, type = "success") => {
    setToasts((prev) => {
      const now = Date.now();
      const at = prev.findIndex((x) => x.msg === msg && x.type === type);

      // 1-qoida: shu xabar turibdi — hisoblagich oshadi, umri yangilanadi.
      if (at !== -1) {
        const next = [...prev];
        next[at] = { ...next[at], count: next[at].count + 1, bornAt: now };
        return next;
      }

      const next = [...prev, { id: ++seq.current, msg, type, count: 1, bornAt: now }];
      // 2-qoida: eng eskisi siqib chiqariladi.
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }, []);

  // 3-qoida: yagona tozalagich. Navbat bo'sh bo'lsa umuman ishlamaydi.
  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => {
        const alive = prev.filter((x) => now - x.bornAt < TTL_MS);
        // Bir xil massiv qaytsa React qayta chizmaydi.
        return alive.length === prev.length ? prev : alive;
      });
    }, SWEEP_MS);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  /* ⚠ `useMemo` SHART. Ilgari bu oddiy obyekt edi va HAR CHIZISHDA
     yangisi yaratilardi. Uni `useEffect` bog'liqligiga qo'ygan har qanday
     kod cheksiz halqaga tushardi: effekt ishlaydi → holat o'zgaradi →
     qayta chiziladi → `toast` boshqa obyekt → effekt yana ishlaydi.

     Aynan shu bo'ldi: savatni tiklash xabari to'xtovsiz chiqaverdi
     (2026-08-27). Halqani chaqiruvchi tomonda emas, MANBADA yopdik —
     aks holda keyingi odam ham xuddi shu tuzoqqa tushardi. */
  const toast = useMemo(() => ({
    success: (msg) => showToast(msg, "success"),
    error:   (msg) => showToast(msg, "error"),
    info:    (msg) => showToast(msg, "info"),
    warning: (msg) => showToast(msg, "warning"),
  }), [showToast]);

  return { toasts, toast, dismiss };
}
