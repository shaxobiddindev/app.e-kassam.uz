/* Toast — 02-DESIGN-SYSTEM.md (a11y):
   oddiy xabar `aria-live="polite"`, xato `aria-live="assertive"`.
   Rang yolg'iz signal emas — har turda ikonka ham bor (CLAUDE.md #6).

   ⚠ JOYLASHUV VA TAXLASH (2026-08-27). Ilgari kartochkalar pastki o'ng
   burchakda USTUN bo'lib terilardi. Ketma-ket bir nechta xato chiqqanda
   ustun ekran bo'ylab cho'zilib, ish maydonini yopib qo'yardi.

   Endi ular ekranning YUQORI O'RTASIDA va DASTA bo'lib turadi: eng
   yangisi to'liq ko'rinadi, oldingilari uning ortidan bir oz pastdan
   mo'ralaydi. Nechta xabar bo'lishidan qat'i nazar dasta BIR XIL joy
   egallaydi — ustun hech qachon cho'zilmaydi. Oldingi kartochka o'chgani
   sari ortidagisi oldinga suriladi, ya'ni hammasi navbat bilan o'qiladi.

   ⚠ Chuqurlik siljishi ALOHIDA o'ramda (`.ek-toast-slot`). `.ek-toast-drop`
   animatsiyasi `transform` ni `both` bilan egallaydi va tugagach
   `transform: none` ni ushlab qoladi — bitta elementda ikkalasi birga
   ishlamaydi. */

import { useRef, useState } from "react";
import { t } from "../lib/ek-i18n";

const ICONS = {
  success: "fa-circle-check",
  error:   "fa-circle-xmark",
  info:    "fa-circle-info",
  warning: "fa-triangle-exclamation",
};

const TONES = {
  success: { bg: "var(--bg-success-subtle)", border: "var(--border-success)", text: "var(--fg-success)" },
  error:   { bg: "var(--bg-danger-subtle)",  border: "var(--border-danger)",  text: "var(--fg-danger)"  },
  info:    { bg: "var(--bg-brand-subtle)",   border: "var(--border-brand)",   text: "var(--fg-brand)"   },
  warning: { bg: "var(--bg-warning-subtle)", border: "var(--border-warning)", text: "var(--fg-warning)" },
};

/** Shu masofadan ko'proq tepaga surilsa — yopiladi. */
const SWIPE_CLOSE_PX = 44;

export default function Toast({ toasts, onDismiss }) {
  /* Surish holati — faqat OLDINGI kartochka uchun. Ortdagilarni surib
     bo'lmaydi: ular berkilgan, tasodifiy tegib yopib yuborish mumkin. */
  const [dragY, setDragY] = useState(0);
  const from = useRef(null);

  if (!toasts || toasts.length === 0) return null;

  /* Eng yangisi dastaning OLDIDA. Navbatda u oxirida turadi, shuning
     uchun teskari o'qiladi: `depth === 0` — oldingi kartochka. */
  const stack = [...toasts].reverse();

  const onPointerDown = (e) => {
    // Faqat asosiy tugma/barmoq; X tugmasi o'z ishini qilsin.
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest(".ek-toast-x")) return;
    from.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (from.current === null) return;
    // Faqat TEPAGA suriladi: pastga tortish kartochkani qimirlatmaydi.
    setDragY(Math.min(0, e.clientY - from.current));
  };

  const endDrag = (id) => () => {
    if (from.current === null) return;
    from.current = null;
    if (dragY <= -SWIPE_CLOSE_PX && onDismiss) onDismiss(id);
    setDragY(0);
  };

  return (
    <div className="ek-toast-stack">
      {stack.map((item, depth) => {
        const c = TONES[item.type] || TONES.info;
        return (
          <div
            key={item.id}
            className={`ek-toast-slot ${depth === 0 ? "ek-toast-slot--lead" : "ek-toast-slot--back"}`}
            style={{ "--depth": depth, zIndex: stack.length - depth }}
            /* Ortdagilar ekran o'quvchisida takrorlanmasin — ular
               paydo bo'lganida allaqachon e'lon qilingan. */
            aria-hidden={depth > 0 ? "true" : undefined}
          >
            <div
              className={`ek-toast-card ek-toast-drop${depth === 0 ? " ek-toast-card--grab" : ""}`}
              role={item.type === "error" ? "alert" : "status"}
              aria-live={item.type === "error" ? "assertive" : "polite"}
              style={{
                background: c.bg,
                borderColor: c.border,
                /* ⚠ Surilayotganda animatsiya O'CHIRILADI. `.ek-toast-drop`
                   `both` bilan tugaydi va `transform: none` ni ushlab
                   qoladi — o'chirilmasa barmoq ostidagi siljish
                   umuman ko'rinmasdi. */
                ...(depth === 0 && dragY
                  ? { transform: `translateY(${dragY}px)`, animation: "none", opacity: 1 + dragY / 220 }
                  : null),
              }}
              onPointerDown={depth === 0 ? onPointerDown : undefined}
              onPointerMove={depth === 0 ? onPointerMove : undefined}
              onPointerUp={depth === 0 ? endDrag(item.id) : undefined}
              onPointerCancel={depth === 0 ? endDrag(item.id) : undefined}
            >
              <i
                className={`fa-solid ${ICONS[item.type] || ICONS.info}`}
                style={{ color: c.text }}
                aria-hidden="true"
              />
              <span className="ek-toast-msg" style={{ color: c.text }}>
                {item.msg}
              </span>

              {/* Takrorlangan xabar yangi kartochka emas — shu yerdagi son.
                  Kassir necha marta bosganini shundan biladi. */}
              {item.count > 1 && (
                <span className="ek-toast-count" style={{ color: c.text, borderColor: c.border }}>
                  ×{item.count}
                </span>
              )}

              {onDismiss && (
                <button
                  className="ek-toast-x"
                  onClick={() => onDismiss(item.id)}
                  aria-label={t("common.close")}
                  style={{ color: c.text }}
                  tabIndex={depth > 0 ? -1 : undefined}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
