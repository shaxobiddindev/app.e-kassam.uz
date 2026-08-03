/* ==========================================================================
   "E'tibor talab qiladi" — 07-ADMIN.md: "bu blok panelning yuragi"

   Har bir satr bosiladi va tegishli joyga olib boradi.
   Bo'sh bo'lsa: "Hammasi joyida. Bugun aralashuv talab qiladigan narsa yo'q."

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

/**
 * @param items  [{ id, icon, tone: 'danger'|'warning'|'info', text, count, onClick }]
 *               `count === 0` bo'lgan satrlar chaqiruvchi tomonida filtrlanadi.
 */
export default function AttentionList({ items = [] }) {
  return (
    <div className="card">
      <div className="card-header c-head">
        <span className="card-title c-title">
          <i className="fa-solid fa-bell" aria-hidden="true" /> E'tibor talab qiladi
        </span>
        {items.length > 0 && (
          <span className="badge badge-red ek-num">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="attn__empty">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          Hammasi joyida. Bugun aralashuv talab qiladigan narsa yo'q.
        </div>
      ) : (
        <div>
          {items.map((it) => (
            <button key={it.id} type="button" className="attn__row" onClick={it.onClick}>
              <span className="attn__icon" data-tone={it.tone || "info"}>
                <i className={`fa-solid ${it.icon || "fa-circle-exclamation"}`} aria-hidden="true" />
              </span>
              <span>{it.text}</span>
              {it.count != null && <span className="attn__count">{it.count}</span>}
              <i className="fa-solid fa-chevron-right" style={{ color: "var(--fg-tertiary)", fontSize: 11 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
