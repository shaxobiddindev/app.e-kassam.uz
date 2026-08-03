/* ==========================================================================
   03-MOTION.md #2 — "Chek chop etish yuklovchisi"
   Umumiy spinner o'rniga mahsulotning o'z tili: chek printer tirqishidan
   pastga chiqadi, ichidagi satrlar navbat bilan paydo bo'ladi.
   400ms dan uzun har qanday amalda ishlatiladi.
   ========================================================================== */

export function PrintingLoader({ width = 96 }) {
  return (
    <div className="ek-printing" style={{ "--w": `${width}px` }} aria-hidden="true">
      <div className="ek-printing__slot" />
      <div className="ek-printing__paper">
        <div className="ek-printing__line" />
        <div className="ek-printing__line" />
        <div className="ek-printing__line" />
        <div className="ek-printing__line" />
      </div>
    </div>
  );
}

/** Yashil ✓ — chiziladi, chunki u tasdiq: hikoyaning yakuni. */
export function CheckDraw({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="none"
        stroke="var(--bg-success)" strokeWidth="2" opacity=".28" />
      <path className="ek-check-draw" d="M12 20.5l5.5 5.5L28 15"
        fill="none" stroke="var(--bg-success)" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Sotuv yakunlash ekrani.
 * phase: "printing" → chek chiqmoqda · "done" → ✓ chizildi
 */
export default function FinishOverlay({ phase, total, receiptNo, onClose }) {
  return (
    <div className="ek-finish ek-overlay" role="status" aria-live="polite">
      <div className="ek-finish__box ek-dialog">
        {phase === "printing" ? (
          <>
            <PrintingLoader />
            <div className="ek-finish__title">Chek tayyorlanmoqda</div>
            <div className="ek-finish__sub">Bir soniya…</div>
          </>
        ) : (
          <>
            <CheckDraw />
            <div className="ek-finish__title">Sotuv yakunlandi</div>
            <div className="ek-finish__amount">{total}</div>
            {receiptNo && <div className="ek-finish__sub">Chek №{receiptNo}</div>}
            {onClose && (
              <button className="btn btn-outline" onClick={onClose} autoFocus>
                Yopish <span className="kbd">Esc</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
