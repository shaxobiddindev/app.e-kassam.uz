// ─── Loader — OLIB TASHLANDI ─────────────────────────────────
// Butun sahifani qoplaydigan umumiy spinner endi ishlatilmaydi: u nima
// yuklanayotganini aytmaydi va kontent kelganda layout sakraydi.
// O'rniga components/ek/Loading dan shaklga mos a'zo tanlanadi:
//   jadval → <SkeletonTable>   ro'yxat → <SkeletonList>
//   kartochka → <SkeletonCards> tugma → <Spinner>

// ─── Empty state ─────────────────────────────────────────────
export function Empty({ icon = "fa-inbox", text = "Ma'lumot yo'q" }) {
  return (
    <div className="empty">
      <i className={`fa-solid ${icon}`} />
      <p>{text}</p>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────
export function Badge({ children, color = "blue" }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

// ─── Avatar ──────────────────────────────────────────────────
export function Avatar({ name = "", size = 34 }) {
  const letters = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {letters}
    </div>
  );
}

// ─── Form Group ──────────────────────────────────────────────
export function FormGroup({ label, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
export function StatCard({ label, value, icon, bg, color, change }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg, color }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {change && (
          <div className="stat-change">
            <i className="fa-solid fa-caret-up" /> {change}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search Bar ──────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Qidirish...", style, ...rest }) {
  return (
    <div className="search-bar" style={style}>
      <i className="fa-solid fa-magnifying-glass" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...rest}
      />
      {/* Tozalash — monoblokda `Ctrl+A`+`Delete` qilib bo'lmaydi.
          Bo'sh maydonda ko'rsatilmaydi: bosiladigan, lekin hech nima
          qilmaydigan tugma ishonchni yo'qotadi. */}
      {value ? <ClearButton onClear={() => onChange("")} /> : null}
    </div>
  );
}

/* ─── Tozalash tugmasi ────────────────────────────────────────
   Maydon ichidagi «×». Alohida komponent, chunki u har joyda BIR XIL
   o'lchamda va bir xil xatti-harakatda bo'lishi kerak.

   ⚠ `onPointerDown` da `preventDefault` — aks holda tugmaga tegilishi
   bilan maydon fokusni yo'qotadi, ekran klaviaturasi esa yopilib ketadi
   va kassir uni qaytadan ochishga majbur bo'lardi. */
export function ClearButton({ onClear, label = "Tozalash" }) {
  return (
    <button
      type="button"
      className="field-clear"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClear}
    >
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}

/* ─── Tozalanadigan maydon ────────────────────────────────────
   Oddiy `<input>` o'rniga: ichida «×» bor va u boshqaruvchi qiymat
   bilan ishlaydi. Qolgan proplar (`type`, `inputMode`, `placeholder`,
   `autoFocus`…) to'g'ridan-to'g'ri `<input>` ga uzatiladi — ya'ni
   mavjud maydonni ko'chirishda faqat teg nomi o'zgaradi. */
export function Field({ value, onChange, onClear, className = "", wrapStyle, ...rest }) {
  const has = value != null && value !== "";
  return (
    <div className="field" style={wrapStyle}>
      <input
        className={`form-input${has ? " has-clear" : ""} ${className}`.trim()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {has ? <ClearButton onClear={() => (onClear ? onClear() : onChange(""))} /> : null}
    </div>
  );
}
