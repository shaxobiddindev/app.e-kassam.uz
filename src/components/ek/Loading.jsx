/* ==========================================================================
   e-Kassam — yuklanish komponentlari

   Tanlash qoidasi (03-MOTION.md #2, #3):

     Shakli MA'LUM kontent          → <SkeletonTable> / <SkeletonCards> / …
     Ekranda kontent bor, yangilanmoqda → <Progress />
     Mahsulotga xos uzun amal       → <Printing />
     Ilova birinchi ko'tarilishi    → <BootLoader />
     Tugma ichida                   → <Spinner /> yoki data-loading

   Umumiy spinner bilan butun sahifani qoplash TAQIQLANADI.

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

/* ── Asos ─────────────────────────────────────────────────────────────────
   Barcha skeletonlar shu bitta elementdan quriladi. `w`/`h` berilmasa
   CSS dagi standart qiymat ishlaydi. */
export function Sk({ w, h, variant = "text", className = "", style }) {
  return (
    <span
      className={`ek-sk ek-sk--${variant} ${className}`}
      style={{ width: w, height: h, ...style }}
      aria-hidden="true"
    />
  );
}

/** Yuklanish maydonini ekran o'quvchiga tushuntiradi. */
function Region({ label = "Yuklanmoqda", children, className = "", style }) {
  return (
    <div className={className} style={style} role="status" aria-busy="true" aria-live="polite">
      <span className="ek-loading-label">{label}</span>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   JADVAL — qator balandligi haqiqiy jadvalniki bilan bir xil (44px)
   ══════════════════════════════════════════════════════════════════════════ */
/**
 * @param cols  ustunlar tavsifi: "wide" | "num" | "narrow" | "text"
 *              Haqiqiy jadvalning ustun tartibini takrorlang — shundagina
 *              ma'lumot kelganda sahifa sakramaydi.
 */
export function SkeletonTable({ rows = 6, cols = ["wide", "text", "num"], label = "Jadval yuklanmoqda" }) {
  return (
    <Region label={label} className="ek-sk-table ek-sk-group">
      {Array.from({ length: rows }, (_, r) => (
        <div className="ek-sk-tr" key={r}>
          {cols.map((c, i) => (
            <div key={i} className={c === "num" ? "is-num" : c === "narrow" ? "is-narrow" : c === "wide" ? "is-wide" : ""}>
              <Sk w={c === "wide" ? "78%" : c === "narrow" ? "60%" : "52%"} />
            </div>
          ))}
        </div>
      ))}
    </Region>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   KARTOCHKALAR — KPI qatori va shunga o'xshash panellar
   ══════════════════════════════════════════════════════════════════════════ */
export function SkeletonCards({ count = 4, className = "kpi-row", label = "Ko'rsatkichlar yuklanmoqda" }) {
  return (
    <Region label={label} className={`${className} ek-sk-group`}>
      {Array.from({ length: count }, (_, i) => (
        <div className="ek-sk-card" key={i}>
          <Sk w="52%" variant="line" />
          <Sk w="74%" variant="num" />
          <Sk w="34%" variant="line" />
        </div>
      ))}
    </Region>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RO'YXAT — avatar + ikki qator matn (mijozlar, xodimlar)
   ══════════════════════════════════════════════════════════════════════════ */
export function SkeletonList({ rows = 5, avatar = true, label = "Ro'yxat yuklanmoqda" }) {
  return (
    <Region label={label} className="ek-sk-group">
      {Array.from({ length: rows }, (_, i) => (
        <div className="ek-sk-row" key={i}>
          {avatar && <Sk w={34} h={34} variant="circle" />}
          <div className="ek-sk-row__body">
            <Sk w="44%" variant="title" />
            <Sk w="28%" variant="line" />
          </div>
          <Sk w={62} variant="pill" />
        </div>
      ))}
    </Region>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   KASSIR KATAKCHALARI — mahsulot to'ri
   ══════════════════════════════════════════════════════════════════════════ */
export function SkeletonTiles({ count = 12, label = "Mahsulotlar yuklanmoqda" }) {
  return (
    <Region label={label} className="ek-sk-tiles ek-sk-group">
      {Array.from({ length: count }, (_, i) => (
        <div className="ek-sk-tile" key={i}>
          <Sk w="82%" variant="text" />
          <Sk w="54%" variant="line" />
          <Sk w="62%" variant="title" style={{ marginTop: "auto" }} />
        </div>
      ))}
    </Region>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMA — modal ichidagi maydonlar
   ══════════════════════════════════════════════════════════════════════════ */
export function SkeletonForm({ fields = 4, label = "Forma yuklanmoqda" }) {
  return (
    <Region label={label} className="ek-sk-form ek-sk-group">
      {Array.from({ length: fields }, (_, i) => (
        <div className="ek-sk-field" key={i}>
          <Sk w="32%" variant="line" />
          <Sk h={44} variant="block" />
        </div>
      ))}
    </Region>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROGRESS — ekranda kontent bor, u yangilanmoqda
   Layoutni surmaydi, hech narsani qoplamaydi.
   ══════════════════════════════════════════════════════════════════════════ */
export function Progress({ inset = false, label = "Yangilanmoqda" }) {
  return (
    <div className={`ek-progress ${inset ? "ek-progress--inset" : ""}`} role="status" aria-live="polite">
      <span className="ek-loading-label">{label}</span>
      <span className="ek-progress__bar" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHEK CHOP ETISH — 400ms dan uzun mahsulot amali
   ══════════════════════════════════════════════════════════════════════════ */
export function Printing({ width = 96 }) {
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
      <circle cx="20" cy="20" r="19" fill="none" stroke="var(--bg-success)" strokeWidth="2" opacity=".28" />
      <path className="ek-check-draw" d="M12 20.5l5.5 5.5L28 15"
        fill="none" stroke="var(--bg-success)" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BREND BELGISI — ilova birinchi ko'tarilishi
   ══════════════════════════════════════════════════════════════════════════ */
export function BootLoader({ text = "Yuklanmoqda" }) {
  return (
    <div className="ek-boot" role="status" aria-live="polite">
      <svg className="ek-boot__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <g className="paper">
          <path d="M9 13.2a4.6 4.6 0 0 1 4.6-4.6h14.8a4.6 4.6 0 0 1 4.6 4.6v21.4L30 39l-3-4.4L24 39l-3-4.4L18 39l-3-4.4L12 39l-3-4.4Z"
                fill="var(--bg-brand)" />
          <path d="M13.6 13.2h14a1.35 1.35 0 0 1 0 2.7h-14a1.35 1.35 0 0 1 0-2.7Z" fill="#fff" />
          <path d="M13.6 18.1h9a1.35 1.35 0 0 1 0 2.7h-9a1.35 1.35 0 0 1 0-2.7Z" fill="#fff" />
        </g>
        <path className="check" d="M14.1 28.9l3.4 3.4L28 21.8"
              stroke="var(--ek-green-400)" strokeWidth="3.3"
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div className="ek-boot__text">{text}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   INLINE SPINNER — faqat tugma yoki matn ichida
   ══════════════════════════════════════════════════════════════════════════ */
export function Spinner({ small = false }) {
  return <span className={`ek-spinner ${small ? "ek-spinner--sm" : ""}`} aria-hidden="true" />;
}

/* ══════════════════════════════════════════════════════════════════════════
   SOTUV YAKUNLASH — chek chiqmoqda → ✓ chizildi
   06-APP-KASSIR.md: yakunlashda `.ek-printing` → yashil ✓ → toast.
   ══════════════════════════════════════════════════════════════════════════ */
export function FinishOverlay({ phase, total, receiptNo, onClose }) {
  return (
    <div className="ek-finish ek-overlay" role="status" aria-live="polite">
      <div className="ek-finish__box ek-dialog">
        {phase === "printing" ? (
          <>
            <Printing />
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

export default FinishOverlay;
