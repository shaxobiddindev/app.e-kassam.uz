import { useRef } from "react";
import { clear as clearField } from "../../lib/ek-keys";
import {
  NumField, PhoneField, EmailField, BarcodeField,
  MxikField, CodeField, UsernameField, NameField,
} from "../ek/EkFields";

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
/**
 * `hint` — formulani tushuntiruvchi izoh. Yorliq yonidagi «i» belgisida
 * turadi, kartochka ichida MATN sifatida chiqmaydi.
 *
 * ⚠ Ilgari u oddiy abzas edi va bitta uzun izoh («Ombor yo'qotishi» —
 * to'rt qator) BUTUN qatorni ~250px ga cho'zib yuborardi: grid qator
 * balandligini eng baland kartochka belgilaydi, qolgan oltitasi esa
 * yarmi bo'sh turardi. Izoh kerak, lekin u ASOSIY raqamdan ko'proq joy
 * egallamasligi kerak.
 *
 * `valueColor` — faqat RAQAM rangi. ⚠ `color` ikonka uchun; raqamni ham
 * u bilan bo'yash barcha mavjud kartochkalarning ko'rinishini o'zgartirib
 * yuborardi.
 */
export function StatCard({ label, value, icon, bg, color, change, hint, valueColor }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg, color }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className="stat-card__body">
        <div className="stat-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
        <div className="stat-label">
          {label}
          {hint && (
            <span className="stat-hint" tabIndex={0} role="note" title={hint} aria-label={hint}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
            </span>
          )}
        </div>
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
   Oddiy `<input>` ning o'rnini bosadi: ichida «×» bor.

   ⚠ `onChange` IMZOSI O'ZGARMAYDI — u odatdagidek hodisa oladi
   (`e.target.value`). Aynan shu sababli mavjud maydonni ko'chirishda
   FAQAT teg nomi o'zgaradi va 40 dan ortiq joyni qayta yozishda
   xato qilish ehtimoli deyarli yo'q.

   «×» qiymatni maydonga TO'G'RIDAN-TO'G'RI yozadi (`ek-keys.setValue`)
   va `input` hodisasini yuboradi — shu sababli chaqiruvchi qanday
   `onChange` ishlatishidan (hodisa yoki qiymat) qat'i nazar ishlaydi. */
/* `kind` — maydonning VAZIFASI. Berilsa, kiritish o'sha turga qat'iy
   moslanadi (`components/ek/EkFields.jsx` + `lib/ek-input.js`):

     money | qty | percent | int   — son: manfiy YO'Q, razryad ajratiladi,
                                     kasr xonalari cheklangan, foiz ≤ 100
     phone                         — +998 (90) 123-45-67, aniq 12 raqam
     email | barcode | mxik        — mos tozalash
     code | username | name        — mos tozalash

   ⚠ Nega `type="number"` emas: `min="0"` KIRITISHNI TO'SMAYDI (u faqat
   forma validatsiyasiga ta'sir qiladi, forma esa bu yerda `onSubmit`
   bilan yuborilmaydi), brauzer "1e5" ni qabul qiladi, sichqoncha
   g'ildiragi qiymatni jimgina o'zgartiradi va razryadlarni ajratib
   bo'lmaydi. Batafsil: docs/09-CHETLANISHLAR.md §10i₂ */
const KIND_FIELDS = {
  money: NumField, qty: NumField, percent: NumField, int: NumField,
  phone: PhoneField, email: EmailField, barcode: BarcodeField,
  mxik: MxikField, code: CodeField, username: UsernameField, name: NameField,
};

export function Field({ className = "form-input", wrapStyle, onClear, kind, ...rest }) {
  const ref = useRef(null);
  const has = rest.value != null && rest.value !== "";
  const Typed = kind ? KIND_FIELDS[kind] : null;
  const cls = `${className}${has ? " has-clear" : ""}`;

  return (
    <div className="field" style={wrapStyle}>
      {Typed ? (
        <Typed
          {...(KIND_FIELDS[kind] === NumField ? { kind } : {})}
          className={cls}
          {...rest}
        />
      ) : (
        <input ref={ref} className={cls} {...rest} />
      )}
      {has ? (
        <ClearButton
          onClear={() => {
            if (onClear) onClear();
            /* Niqobli maydonda DOM ga to'g'ridan-to'g'ri yozib bo'lmaydi:
               qiymat formatlanib qaytadi. Shuning uchun bo'sh qiymat
               odatdagi `onChange` orqali yuboriladi. */
            else if (Typed) rest.onChange?.({ target: { value: "", name: rest.name } });
            else if (ref.current) clearField(ref.current);
          }}
        />
      ) : null}
    </div>
  );
}
