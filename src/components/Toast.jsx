/* Toast — 02-DESIGN-SYSTEM.md (a11y):
   oddiy xabar `aria-live="polite"`, xato `aria-live="assertive"`.
   Rang yolg'iz signal emas — har turda ikonka ham bor (CLAUDE.md #6). */

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

export default function Toast({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: "var(--z-toast)",
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 380, width: "calc(100vw - 40px)", pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const c = TONES[t.type] || TONES.info;
        return (
          <div
            key={t.id}
            className="ek-toast-in"
            role={t.type === "error" ? "alert" : "status"}
            aria-live={t.type === "error" ? "assertive" : "polite"}
            style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: "var(--r-lg)", padding: "13px 14px",
              display: "flex", alignItems: "flex-start", gap: 10,
              boxShadow: "var(--sh-lg)", pointerEvents: "auto",
            }}
          >
            <i
              className={`fa-solid ${ICONS[t.type] || ICONS.info}`}
              style={{ color: c.text, fontSize: 16, marginTop: 1, flexShrink: 0 }}
              aria-hidden="true"
            />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.text, lineHeight: 1.45 }}>
              {t.msg}
            </span>
            {onDismiss && (
              <button
                onClick={() => onDismiss(t.id)}
                aria-label="Yopish"
                style={{
                  border: "none", background: "none", cursor: "pointer",
                  color: c.text, opacity: .6, fontSize: 14, padding: 0,
                  flexShrink: 0, lineHeight: 1,
                }}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
