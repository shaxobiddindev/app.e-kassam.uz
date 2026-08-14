import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import OnScreenKeyboard from "../components/OnScreenKeyboard";
import { isTextEntry } from "../lib/ek-keys";
import { isTouch, onTouchChange, apply as applyTouch } from "../lib/ek-touch";
import { isMobileApp } from "../lib/ek-desktop";

/* ══════════════════════════════════════════════════════════════════════════
   Klaviaturani ochish — BITTA joydan, butun ilova uchun

   ⚠ Har bir maydonni qo'lda ulash SHART EMAS. Bu yerda `focusin` hodisasi
   butun hujjat bo'ylab tinglanadi: kassir qaysi maydonga tegsa, klaviatura
   o'sha maydon uchun ochiladi. Sabab amaliy — ilovada 52 dan ortiq input
   bor va ularning har biriga proplar qo'shish, keyin yangi yozilganini
   unutish muqarrar edi. Endi yangi maydon avtomatik qo'llab-quvvatlanadi.

   Klaviatura FAQAT teginish rejimida ochiladi: klaviaturasi bor
   kompyuterda u ekranni bekorga egallagan bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/* `data-osk="off"` bo'lgan maydonlar uchun: klaviaturani QO'LDA ochish.
   Kassadagi barkod maydoni aynan shunday — u doim fokusda turadi va
   avtomatik ochilsa klaviatura ekrandan umuman ketmasdi. */
const KeyboardCtx = createContext({ open: () => {}, close: () => {}, isOpen: false });
export const useKeyboard = () => useContext(KeyboardCtx);

export function KeyboardProvider({ children }) {
  const [target, setTarget] = useState(null);

  useEffect(() => { applyTouch(); }, []);

  // Rejim Sozlamalardan o'zgartirilsa, ochiq klaviatura yopilsin.
  useEffect(() => onTouchChange((on) => { if (!on) setTarget(null); }), []);

  const close = useCallback(() => {
    setTarget(null);
    // Fokusni olib tashlaymiz: aks holda maydon fokusda qolib, keyingi
    // tegishda `focusin` qaytalanmaydi va klaviatura ochilmaydi.
    try { document.activeElement?.blur?.(); } catch (e) {}
  }, []);

  useEffect(() => {
    function onFocusIn(e) {
      /* ⚠ TELEFONDA (Capacitor) BU KLAVIATURA UMUMAN OCHILMAYDI.
         U klaviaturasiz MONOBLOK uchun yozilgan; telefonda esa Android
         o'z klaviaturasini chiqaradi va ikkalasi USTMA-UST tushib,
         yarim ekranni egallab qolardi (foydalanuvchi shikoyati). */
      if (isMobileApp()) return;
      if (!isTouch()) return;
      const el = e.target;
      if (!isTextEntry(el)) return;
      // Maydon o'zi so'ramasa ham bo'ladi: `data-osk="off"` bilan chiqarib
      // tashlanadi (masalan skaner o'qiydigan maydon — u yerda barmoq bilan
      // yozish kutilmaydi va klaviatura xalaqit berardi).
      if (el.getAttribute("data-osk") === "off") return;
      setTarget(el);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  /* Maydon DOM'dan olib tashlansa (modal yopildi) klaviatura ham ketsin —
     aks holda u yo'q maydonga yozishga urinib, ekranda osilib qolardi. */
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => {
      if (!target.isConnected) setTarget(null);
    }, 500);
    return () => clearInterval(id);
  }, [target]);

  /* Klaviatura ochiq ekan, sahifa tagida joy qoldiriladi (CSS shu sinfga
     qaraydi) — aks holda oxirgi qatorlar klaviatura ostida qolib ketardi
     va ularga umuman yetib bo'lmasdi. */
  useEffect(() => {
    document.body.classList.toggle("osk-open", Boolean(target));
    return () => document.body.classList.remove("osk-open");
  }, [target]);

  const open = useCallback((el) => {
    if (!el) return;
    try { el.focus(); } catch (e) {}
    // Telefonda fokus yetarli — Android klaviaturasi o'zi ochiladi,
    // ichki klaviatura esa chizilmaydi (yuqoridagi izohga qarang).
    if (isMobileApp()) return;
    setTarget(el);
  }, []);

  const api = useMemo(() => ({ open, close, isOpen: Boolean(target) }), [open, close, target]);

  return (
    <KeyboardCtx.Provider value={api}>
      {children}
      {target && <OnScreenKeyboard target={target} onClose={close} />}
    </KeyboardCtx.Provider>
  );
}
