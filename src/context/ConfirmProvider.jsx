import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import ConfirmModal from "../components/ConfirmModal";

/* ══════════════════════════════════════════════════════════════════════════
   TASDIQLASH — bitta joydan, va'da (Promise) qaytaradi

     const ok = await confirm({ title, message, type, confirmText, cancelText });

   ⚠ Javob `resolve` REF da saqlanadi, holatda EMAS: ilgari u holatda edi va
   `handleClose` eski holatga yopilib qolib, ketma-ket ikkita so'rovda
   birinchisining va'dasi HECH QACHON hal bo'lmasdi (chaqiruvchi `await` da
   muzlab qolardi).

   ⚠ Oyna yopilganda va'da ALBATTA hal bo'ladi (`false`) — orqa fonga bosish,
   ✕ va Escape ham shu yo'ldan o'tadi.
   ══════════════════════════════════════════════════════════════════════════ */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    /* Ochiq so'rov ustiga yangisi kelsa, eskisi bekor qilingan hisoblanadi —
       aks holda uni kutayotgan kod abadiy osilib qolardi. */
    resolveRef.current?.(false);
    resolveRef.current = resolve;
    setState({ type: "info", ...opts });
  }), []);

  const close = useCallback((result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  /* Escape — «bekor qilish». Klaviaturali kassa ekranida oyna sichqonchasiz
     ham yopilishi kerak. */
  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmModal
          title={state.title}
          message={state.message}
          type={state.type}
          confirmText={state.confirmText}
          cancelText={state.cancelText}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
