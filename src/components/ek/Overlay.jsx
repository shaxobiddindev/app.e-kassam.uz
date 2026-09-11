import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { pushLayer, popLayer, isTopLayer, subscribeLayers } from "../../lib/modal-stack";

/**
 * HAR QANDAY oynaning tashqi qatlami.
 *
 * ⚠ HAMMA OYNA SHU KOMPONENT ORQALI CHIZILISHI SHART. Qo'lda yozilgan
 * `<div className="pay-modal-overlay">` sahifa daraxti ichida qoladi va
 * ikki xil yo'l bilan buziladi:
 *
 *   1. Sahifadagi har qanday `transform`/`filter`/`animation-fill-mode`
 *      yangi «stacking context» ochadi va oynaning `z-index` i O'SHA
 *      quticha ichida hisoblanadi — tashqaridagi sarlavha oynadan
 *      yuqorida chiziladi (2026-08 dagi haqiqiy xato).
 *   2. Boshqa oynadan ochilgan oyna DOM da undan OLDIN turib qolishi
 *      mumkin va orqasiga tushib ketadi (to'lov → yangi mijoz xatosi).
 *
 * Portal ikkala bog'liqlikni ham uzadi: tugun `body` oxiriga qo'yiladi,
 * demak keyin ochilgan oyna doim keyin chiziladi.
 *
 * Esc — FAQAT eng ustidagi oynani yopadi (`modal-stack.js` ga qarang).
 */
export default function Overlay({
  className = "",
  onEscape,
  children,
  ...rest
}) {
  const id = useId();

  useEffect(() => {
    pushLayer(id);
    return () => popLayer(id);
  }, [id]);

  const top = useSyncExternalStore(
    subscribeLayers,
    () => isTopLayer(id),
    () => true,          // server: bitta oyna deb hisoblanadi
  );

  useEffect(() => {
    if (!onEscape || !top) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    };
    /* `capture` — maydonlarning o'z Esc ishlovchisidan OLDIN ushlash
       uchun; `stopPropagation` esa pastdagi oynalarga yetib bormasligi
       uchun. */
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onEscape, top]);

  return createPortal(
    <div className={className} data-ek-top={top ? "" : undefined} {...rest}>
      {children}
    </div>,
    document.body,
  );
}

/** Oyna eng ustidamikan — Enter kabi boshqa tugmalar uchun. */
export function useIsTopLayer(id) {
  return useSyncExternalStore(subscribeLayers, () => isTopLayer(id), () => true);
}
