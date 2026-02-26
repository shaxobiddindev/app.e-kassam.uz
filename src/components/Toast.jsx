const ICONS = {
  success: "fa-circle-check",
  error:   "fa-circle-xmark",
  info:    "fa-circle-info",
  warning: "fa-triangle-exclamation",
};

const COLORS = {
  success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "#22c55e" },
  error:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "#ef4444" },
  info:    { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "#3b82f6" },
  warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", icon: "#f59e0b" },
};

export default function Toast({ toasts, onDismiss }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      maxWidth: 380, width: "calc(100vw - 40px)",
    }}>
      {toasts.map((t) => {
        const c = COLORS[t.type] || COLORS.info;
        return (
          <div key={t.id} style={{
            background: c.bg, border: `1.5px solid ${c.border}`,
            borderRadius: 12, padding: "13px 14px",
            display: "flex", alignItems: "flex-start", gap: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,.12)",
            animation: "slideInRight .25s ease",
          }}>
            <i className={`fa-solid ${ICONS[t.type] || ICONS.info}`}
              style={{ color: c.icon, fontSize: 16, marginTop: 1, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: c.text, lineHeight: 1.4 }}>
              {t.msg}
            </span>
            {onDismiss && (
              <button onClick={() => onDismiss(t.id)} style={{
                border: "none", background: "none", cursor: "pointer",
                color: c.text, opacity: .6, fontSize: 14, padding: 0,
                flexShrink: 0, lineHeight: 1,
              }}>
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        );
      })}
      <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}
