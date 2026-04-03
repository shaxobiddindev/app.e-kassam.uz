// ─── Loader ──────────────────────────────────────────────────
export function Loader() {
  return (
    <div className="loader">
      <div className="spinner" />
    </div>
  );
}

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
export function SearchBar({ value, onChange, placeholder = "Qidirish...", style }) {
  return (
    <div className="search-bar" style={style}>
      <i className="fa-solid fa-magnifying-glass" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
