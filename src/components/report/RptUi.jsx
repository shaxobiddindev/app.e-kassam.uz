import { t } from "../../lib/ek-i18n";
import { money } from "../../utils";
import { Empty } from "../ui";
import Select from "../ek/Select";
import { PERIODS, growth } from "../../lib/ek-period";

/* ══════════════════════════════════════════════════════════════════════════
   HISOBOT QISMLARI — umumiy hisobot va mahsulot hisoboti uchun (2026-10-05)

   ⚠ NEGA ALOHIDA FAYL. Bular avval `ReportsPage.jsx` ichida edi. Mahsulot
   hisoboti (`ProductReportPage`) xuddi shu KPI kartasi, panel va davr
   tanlagichini ishlatadi — nusxa olinsa, bir kun ikkalasi ikki xil
   ko'rinardi (bitta joyda o'sish belgisi tuzatiladi, ikkinchisida yo'q).
   ══════════════════════════════════════════════════════════════════════════ */

/* Grafik ranglari — `styles.css` dagi `--ek-chart-*` tokenlari (qorong'i
   rejimda yorqinroq). ⚠ Zaxira hex YO'Q: u token tizimini chetlab o'tardi. */
export const C = {
  sales:  "var(--ek-chart-1)",
  profit: "var(--ek-chart-2)",
  cost:   "var(--ek-chart-3)",
  ret:    "var(--ek-chart-4)",
  warn:   "var(--ek-chart-5)",
  sky:    "var(--ek-chart-6)",
  teal:   "var(--ek-chart-7)",
  pink:   "var(--ek-chart-8)",
};
/** Halqa uchun aylanma palitra — to'lov turlari va kategoriyalar. */
export const PALETTE = [C.sales, C.profit, C.warn, C.cost, C.ret, C.sky, C.teal, C.pink];

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ══ O'SISH BELGISI ════════════════════════════════════════════════════
   ⚠ Oldingi davr nol bo'lsa foiz YOZILMAYDI («yangi» deyiladi):
   «+∞%» ham, «+0%» ham yolg'on bo'lardi (`ek-period.growth` izohi). */
export function Delta({ now, prev, invert = false }) {
  const g = growth(now, prev);
  if (g === null) return <span className="kpi__delta is-new">{t("rpt2.new")}</span>;
  if (Math.abs(g) < 0.05) return <span className="kpi__delta is-flat">↔ 0%</span>;
  /* `invert` — xarajat va qaytarish uchun: ularning O'SISHI yomon. */
  const good = invert ? g < 0 : g > 0;
  return (
    <span className={`kpi__delta ${good ? "is-up" : "is-down"}`}>
      {g > 0 ? "↑" : "↓"} {Math.abs(g).toFixed(1)}%
    </span>
  );
}

/**
 * IZOH BELGISI — «i» harfi, ikonka shrifti EMAS.
 *
 * ⚠ Chop etishda va sekin internetda Font Awesome kelmaydi va o'rnida
 * BO'SH KATAKCHA qoladi — foydalanuvchi uni xato deb o'ylaydi (do'kon egasi
 * so'ragan: «bu ikoncha nimaniki?»).
 *
 * ⚠ `<button>`, `<i>` emas: klaviatura bilan ham yetib borish va teginish
 * bilan ochish kerak — sensor ekranda «ustiga borish» degan narsa yo'q.
 */
export function Hint({ text }) {
  if (!text) return null;
  return (
    <button type="button" className="kpi__hint" title={text} aria-label={text}
            onClick={(e) => e.currentTarget.focus()}>i</button>
  );
}

export function Kpi({ label, value, now, prev, icon, tone, invert, hint, sub }) {
  return (
    <div className={`kpi${tone ? ` kpi--${tone}` : ""}`}>
      <div className="kpi__top">
        <span className="kpi__label">
          {label}
          <Hint text={hint} />
        </span>
        {icon && <i className={`fa-solid ${icon} kpi__icon`} aria-hidden="true" />}
      </div>
      <div className="kpi__value ek-num">{value}</div>
      <div className="kpi__foot">
        {prev !== undefined && <Delta now={now} prev={prev} invert={invert} />}
        {sub && <span className="kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Karta — sarlavha + ixtiyoriy o'ng burchak. */
export function Panel({ title, icon, right, children, wide, id }) {
  return (
    <div className={`card${wide ? " rpt-wide" : ""}`} id={id}>
      <div className="card-header">
        <span className="card-title">
          {icon && <i className={`fa-solid ${icon} text-blue`} aria-hidden="true" />} {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * Bo'lim sarlavhasi — oddiy SAVOL bilan (2026-10-05).
 *
 * ⚠ NEGA SAVOL. Egasi: «oddiy user ham oson tushunadigan darajada sodda».
 * «Yalpi foyda», «marja» kabi so'zlar oddiy do'konchiga hech narsa demaydi;
 * «Qancha foyda qoldi?» esa darhol tushunarli. Atamalar joyida qoladi —
 * faqat har bo'lim nimaga javob berishini sarlavha aytadi.
 */
export function Lead({ q, a }) {
  return (
    <div className="rpt-lead">
      <h2 className="rpt-lead__q">{q}</h2>
      {a && <p className="rpt-lead__a">{a}</p>}
    </div>
  );
}

/** Rangli ro'yxat — nom, summa, ulush. */
export function ShareList({ rows = [], fmt = money }) {
  const total = rows.reduce((s, r) => s + Math.abs(num(r.value)), 0);
  if (!rows.length) return <Empty icon="fa-list" text={t("rpt2.noData")} />;
  return (
    <div className="shl">
      {rows.map((r, i) => {
        const share = r.share != null ? num(r.share)
          : total > 0 ? (Math.abs(num(r.value)) / total) * 100 : 0;
        return (
          <div key={i} className="shl__row">
            <span className="shl__dot" style={{ background: r.color }} />
            <span className="shl__name">{r.name}</span>
            {r.sub && <span className="shl__sub">{r.sub}</span>}
            <span className="shl__val mono">{fmt(r.value)}</span>
            <span className="shl__pct mono">{share.toFixed(1)}%</span>
            <span className="shl__bar"><i style={{ width: `${Math.min(100, share)}%`, background: r.color }} /></span>
          </div>
        );
      })}
    </div>
  );
}

export function TopList({ title, icon, rows = [], right }) {
  return (
    <Panel title={title} icon={icon} right={right}>
      <div className="card-body">
        {rows.length ? (
          <div className="topl">
            {rows.map((r, i) => {
              const inner = (
                <>
                  <span className={`rank${i < 3 ? "" : " rank--dim"}`}>{i + 1}</span>
                  <span className="topl__name">{r.name}</span>
                  <span className="topl__sub">{r.sub}</span>
                  <span className="topl__val mono">{r.value}</span>
                </>
              );
              /* Bosiladigan qator — mahsulot hisobotiga o'tadi. */
              return r.onClick ? (
                <button key={i} type="button" className="topl__row topl__row--link" onClick={r.onClick}>
                  {inner}
                </button>
              ) : <div key={i} className="topl__row">{inner}</div>;
            })}
          </div>
        ) : <Empty icon="fa-trophy" text={t("rpt2.noData")} />}
      </div>
    </Panel>
  );
}

/* ══ CSV ═══════════════════════════════════════════════════════════════
   ⚠ Nuqtali VERGUL bilan: Excel'ning ruscha/o'zbekcha sozlamasida vergul
   KASR belgisi va oddiy CSV bitta ustunga yopishib qolardi. `﻿` — BOM,
   usiz kirill harflar Excel'da krakozyabra bo'lardi. */
export function downloadCsv(name, headers, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ══ DAVR TANLAGICHI (2026-10-05) ══════════════════════════════════════
   ⚠ NEGA TO'RTTA TUGMA + RO'YXAT. Ilgari o'nta segment bir qatorda edi va
   telefonda ikki-uch qatorga sinardi; oddiy foydalanuvchi esa «choragi»,
   «o'tgan yil» ni kamdan-kam ochadi. Eng ko'p kerakli to'rttasi ko'z
   oldida, qolganlari — «Boshqa davr» ro'yxatida. Birorta davr yo'qolmadi. */
const MAIN = ["today", "week", "month", "year"];

export function PeriodBar({ period, setPeriod, custom, setCustom }) {
  const more = PERIODS.filter((x) => !MAIN.includes(x));
  return (
    <>
      <div className="rpt-bar__periods" role="tablist" aria-label={t("rpt2.period")}>
        {MAIN.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={period === x}
                  className={`rpt-seg${period === x ? " is-on" : ""}`}
                  onClick={() => setPeriod(x)}>
            {t(`rpt2.p.${x}`)}
          </button>
        ))}
      </div>
      {/* `rpt-more`: yozuv o'qiladigan rangda — bu PLASEHOLDER emas, tugma
          nomi («Boshqa davr»). Odatiy plaseholder rangi oq fonda 2.6:1 edi. */}
      <Select className="rpt-more" value={MAIN.includes(period) ? "" : period} onChange={(v) => v && setPeriod(v)}
              ariaLabel={t("rpt2.morePeriods")} placeholder={t("rpt2.morePeriods")}
              options={more.map((x) => ({
                value: x, label: t(`rpt2.p.${x}`),
                icon: x === "custom" ? "fa-calendar-days" : "fa-calendar",
              }))} />
      {period === "custom" && (
        <div className="rpt-custom">
          <label>{t("common.from")}
            <input type="date" className="form-input" value={custom.from}
                   onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </label>
          <label>{t("common.to")}
            <input type="date" className="form-input" value={custom.to}
                   onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </label>
        </div>
      )}
    </>
  );
}
