import Modal from "./Modal";
import { t } from "../lib/ek-i18n";

/* ══════════════════════════════════════════════════════════════════════════
   TASDIQLASH MODALI — butun tizimda YAGONA so'rov oynasi

   ⚠ `window.confirm` ISHLATILMAYDI. Brauzerning o'z oynasi ilova temasiga
   bo'ysunmaydi, telefon ilovasida esa «e-kassam.uz says…» degan begona
   sarlavha bilan chiqib, mijozni qo'rqitadi. Har qanday tasdiq — shu modal.

   ⚠ Ranglar TOKENLARDAN. Ilgari bu yerda `var(--red)`/`var(--orange)` va
   fon `${color}15` deb yasalardi: `--red` = MATN rangi va qorong'i temada
   yorug' qizil, ya'ni fon ham, matn ham yorug' bo'lib qolardi.

   ⚠ `confirmText`/`cancelText` — tugma yozuvlari. Ilgari ular qabul
   qilinmasdi va chaqiruvchilar bergan «Chiqish», «Qo'llash», «Yopish»
   yozuvlari JIMGINA yo'qolib, hamma joyda «Tasdiqlash» chiqardi.
   ══════════════════════════════════════════════════════════════════════════ */

const TYPE = {
  danger:  { icon: "fa-triangle-exclamation", fg: "var(--fg-danger)",  bg: "var(--bg-danger-subtle)",  btn: "btn-danger"  },
  warning: { icon: "fa-circle-exclamation",   fg: "var(--fg-warning)", bg: "var(--bg-warning-subtle)", btn: "btn-warning" },
  info:    { icon: "fa-circle-info",          fg: "var(--fg-brand)",   bg: "var(--bg-brand-subtle)",   btn: "btn-primary" },
};

export default function ConfirmModal({
  title,
  message,
  type = "info",
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) {
  const s = TYPE[type] || TYPE.info;

  return (
    <Modal
      title={title}
      onClose={onCancel}
      maxWidth={400}
      footer={
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", width: "100%" }}>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            {cancelText || t("common.cancel")}
          </button>
          <button className={`btn btn-sm ${s.btn}`} onClick={onConfirm} autoFocus>
            {confirmText || t("common.confirm")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 20, alignItems: "center", padding: "10px 0" }}>
        <div style={{
          fontSize: 26,
          color: s.fg,
          background: s.bg,
          width: 56,
          height: 56,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <i className={`fa-solid ${s.icon}`} aria-hidden="true" />
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-main)" }}>
          {message}
        </div>
      </div>
    </Modal>
  );
}
