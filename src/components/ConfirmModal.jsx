import Modal from "./Modal";

export default function ConfirmModal({ title, message, type = "info", onConfirm, onCancel }) {
  const iconMap = {
    info:    { icon: "fa-circle-info",          color: "var(--blue)" },
    danger:  { icon: "fa-triangle-exclamation", color: "var(--red)"  },
    warning: { icon: "fa-circle-exclamation",    color: "var(--orange)" },
  };

  const { icon, color } = iconMap[type] || iconMap.info;

  return (
    <Modal
      title={title}
      onClose={onCancel}
      maxWidth={400}
      footer={
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", width: "100%" }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            Bekor qilish
          </button>
          <button 
            className={`btn btn-sm ${type === "danger" ? "btn-danger" : "btn-primary"}`} 
            onClick={onConfirm}
            autoFocus
          >
            Tasdiqlash
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "10px 0" }}>
        <div style={{ 
          fontSize: 32, 
          color,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-main)" }}>
          {message}
        </div>
      </div>
    </Modal>
  );
}
