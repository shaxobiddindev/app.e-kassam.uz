/**
 * ⚠ `dismissible={false}` — ORQA FONGA bosish oynani YOPMAYDI.
 * Sabab (2026-08-17, foydalanuvchi shikoyati): yangilanish oynasi
 * ekranning boshqa yeriga tasodifan tegilganda yo'qolib ketardi va
 * qaytadan faqat ilova o'chirib-yoqilganda chiqardi. Muhim tanlov
 * so'ralayotgan oyna tasodifiy teginish bilan ketmasligi kerak; chiqish
 * yo'li baribir bor — ✕ va tugmalar.
 */
export default function Modal({ title, onClose, children, footer, maxWidth = 460, dismissible = true }) {
  return (
    <div className="modal-overlay" onClick={dismissible ? onClose : undefined}>
      <div
        className="modal-box"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn-icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
