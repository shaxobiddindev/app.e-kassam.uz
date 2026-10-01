import Overlay from "./ek/Overlay";
import { t } from "../lib/ek-i18n";

/**
 * ══ ORQA FONGA BOSISH OYNANI YOPMAYDI (V72) ═══════════════════════════
 *
 * Do'kon egasi: «barcha modal oynalarda bo'sh joyga tegganda yopilishni
 * olib tashlash kerak — bu behosdan tegishda foydali».
 *
 * Bu talab sensor ekranda ishlaydigan kassa uchun aynan to'g'ri:
 * barmoq oynaning chetiga tasodifan tegishi oddiy hol va o'shanda
 * yarim to'ldirilgan forma yo'qolib ketardi. Ilgari bu faqat
 * `dismissible={false}` bilan bitta oynada to'silgan edi (yangilanish
 * oynasi, 2026-08-17 dagi shikoyat) — endi qoida HAMMASI uchun.
 *
 * ⚠ CHIQISH YO'LI KAMAYMADI, ko'paydi: ✕ tugmasi, «Bekor qilish» va
 * ESC. ESC HAR OYNADA ishlaydi va FAQAT ENG USTIDAGISINI yopadi —
 * ketma-ket ochilgan oynalar bittada yopilib ketmasin (`Overlay` va
 * `modal-stack.js`).
 *
 * ⚠ OYNA `document.body` GA CHIZILADI va oxirgi ochilgani ustida
 * turadi — buning uchun `Overlay` javob beradi, izohi o'sha yerda.
 */
export default function Modal({ title, onClose, children, footer, maxWidth = 460, dismissible = true }) {
  return (
    <Overlay
      className="modal-overlay"
      /* ⚠ `onClick` YO'Q — orqa fonga bosish yopmaydi (yuqoridagi izoh). */
      onEscape={onClose}
    >
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          {/* ⚠ Yopib bo'lmaydigan oynada ✕ CHIZILMAYDI. Ilgari u
              turardi-yu, bosilganda hech narsa qilmasdi (`onClose`
              bo'sh funksiya edi) — ishlamaydigan tugma foydalanuvchini
              «osilib qoldimi?» deb o'ylatadi. */}
          {dismissible && (
            /* ⚠ Nomi bor (2026-10-01): ilgari ikonkadan boshqa narsa yo'q edi —
               ekran o'quvchi uni shunchaki «tugma» deb o'qirdi (axe:
               button-name, critical). Hamma oyna shu komponentdan. */
            <button className="btn-icon" onClick={onClose}
                    aria-label={t("common.close")} title={t("common.close")}>
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </Overlay>
  );
}
