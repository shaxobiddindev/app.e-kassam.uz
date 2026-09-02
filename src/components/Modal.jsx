import { createPortal } from "react-dom";

/**
 * ⚠ `dismissible={false}` — ORQA FONGA bosish oynani YOPMAYDI.
 * Sabab (2026-08-17, foydalanuvchi shikoyati): yangilanish oynasi
 * ekranning boshqa yeriga tasodifan tegilganda yo'qolib ketardi va
 * qaytadan faqat ilova o'chirib-yoqilganda chiqardi. Muhim tanlov
 * so'ralayotgan oyna tasodifiy teginish bilan ketmasligi kerak; chiqish
 * yo'li baribir bor — ✕ va tugmalar.
 *
 * ⚠ OYNA `document.body` GA CHIZILADI (portal), sahifa ichiga EMAS.
 *
 * Sabab — haqiqiy xato (foydalanuvchi shikoyati: «modal katta bo'lsa
 * header tagiga kirib qolyapti»). Oyna sahifa daraxti ichida chizilganda
 * uning `z-index` i eng yaqin «stacking context» ICHIDA hisoblanadi.
 * `.page` esa kirish animatsiyasi tufayli aynan shunday quticha ochib
 * qo'yardi va tashqaridagi sarlavha paneli oynadan YUQORIDA chizilardi.
 *
 * Animatsiya tuzatildi (`ek-motion.css` §15), lekin oynaning to'g'ri
 * ishlashi kelajakdagi har qanday `transform`/`filter`/`opacity` ga
 * BOG'LIQ BO'LMASLIGI kerak: bugun tuzatilgan narsa ertaga boshqa
 * sahifada qaytadan buzilishi mumkin va buni yana faqat foydalanuvchi
 * topardi. Portal bu bog'liqlikni butunlay uzadi.
 */
export default function Modal({ title, onClose, children, footer, maxWidth = 460, dismissible = true }) {
  return createPortal(
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
    </div>,
    document.body
  );
}
