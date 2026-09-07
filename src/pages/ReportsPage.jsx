import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { reportApi, shopApi } from "../api";
import { BranchSelector } from "../components";
import { Empty } from "../components/ui";
import { money, percent } from "../utils";
import { paymentEntry } from "../lib/ek-labels";
import { SkeletonCards } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import Select from "../components/ek/Select";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { LineChart, BarChart, Donut, HeatMap, shortNum } from "../components/ek/Charts";
import { PERIODS, periodRange, isoInstant, isoDay, lengthDays, growth } from "../lib/ek-period";
import { forecast, expectedTotal, targetProgress, MIN_POINTS } from "../lib/ek-forecast";
import { downloadXlsx } from "../lib/ek-xlsx";

/* ══════════════════════════════════════════════════════════════════════════
   HISOBOTLAR — biznes tahlili (V69)

   Do'kon egasi: «bu juda professional bo'lishi kerak, u loyihaning
   yuzi hisoblanadi».

   ═══ EKRAN NIMAGA JAVOB BERADI ════════════════════════════════════════

   Professional hisobot — ko'p grafik degani EMAS. U rahbarning
   savollariga darhol javob berishi kerak: qancha sotdik, qancha foyda
   qildik, nima ko'p sotildi, qaysi filial va kassir yaxshi ishlayapti,
   qayerda pul yo'qotyapmiz, nima qaytarilyapti, omborda nima tugayapti,
   kim chegirmani ko'p beryapti, savdo o'syaptimi.

   Shu sabab ekran BO'LIMLARGA bo'lingan va har bo'lim BITTA savolga
   javob beradi. Hammasini bitta uzun sahifaga yoysak, javob shovqin
   ichida yo'qolardi — aynan shu narsa eski hisobot sahifasida bo'lgan.

   ═══ MA'LUMOT BITTA SO'ROVDAN ═════════════════════════════════════════

   ⚠ Butun ekran BITTA javobdan chiziladi (`/reports/analytics`).
   Bo'limlar alohida so'rov qilsa, har biri davrdagi cheklarni qaytadan
   o'qirdi va ekranning turli burchaklari TURLI daqiqani ko'rsatishi
   mumkin edi — savdo bo'limida 12,4 mln, foyda bo'limida esa allaqachon
   12,5 mln. Bir ekranda ikkita haqiqat bo'lmasligi kerak.

   ⚠ Bo'lim almashganda YANGI SO'ROV KETMAYDI: ma'lumot allaqachon
   qo'lda. Faqat davr yoki filial o'zgarganda qayta so'raladi.
   ══════════════════════════════════════════════════════════════════════════ */

/* Bo'limlar — har biri bitta savol. */
const TABS = [
  { key: "home",     icon: "fa-gauge-high",        label: () => t("rpt2.tabHome") },
  { key: "sales",    icon: "fa-chart-line",        label: () => t("rpt2.tabSales") },
  { key: "profit",   icon: "fa-scale-balanced",    label: () => t("rpt2.tabProfit") },
  { key: "products", icon: "fa-boxes-stacked",     label: () => t("rpt2.tabProducts") },
  { key: "staff",    icon: "fa-user-tie",          label: () => t("rpt2.tabStaff") },
  { key: "money",    icon: "fa-money-bill-transfer", label: () => t("rpt2.tabMoney") },
  { key: "stock",    icon: "fa-warehouse",         label: () => t("rpt2.tabStock") },
  { key: "people",   icon: "fa-users",             label: () => t("rpt2.tabPeople") },
  { key: "time",     icon: "fa-clock",             label: () => t("rpt2.tabTime") },
  { key: "watch",    icon: "fa-shield-halved",     label: () => t("rpt2.tabWatch") },
];

const C = {
  sales:  "var(--ek-chart-1, #017dca)",
  profit: "var(--ek-chart-2, #22c55e)",
  cost:   "var(--ek-chart-3, #9333ea)",
  ret:    "var(--ek-chart-4, #ef4444)",
  warn:   "var(--ek-chart-5, #f59e0b)",
};
/* Halqa uchun aylanma palitra — to'lov turlari va kategoriyalar. */
const PALETTE = [C.sales, C.profit, C.warn, C.cost, C.ret, "#0ea5e9", "#14b8a6", "#f472b6"];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ══ O'SISH BELGISI ════════════════════════════════════════════════════
   ⚠ Oldingi davr nol bo'lsa foiz YOZILMAYDI («yangi» deyiladi):
   «+∞%» ham, «+0%» ham yolg'on bo'lardi (`ek-period.growth` izohi). */
function Delta({ now, prev, invert = false }) {
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
 * ⚠ HAQIQIY HOLAT (do'kon egasi so'radi: «bu ikoncha nimaniki?»).
 * Chop etishda va sekin internetda Font Awesome (tashqi CDN) kelmaydi
 * va uning o'rnida BO'SH KATAKCHA qoladi — foydalanuvchi esa uni
 * xato deb o'ylaydi. Bu belgi MA'NO tashiydi (ustiga borsa hisob
 * qoidasi chiqadi), shuning uchun u shriftga bog'liq bo'lmasligi
 * kerak. Kodda bunday qoida allaqachon bor: `styles.css` dagi
 * «Belgi — oddiy BELGI, Font Awesome emas» izohiga qarang.
 *
 * ⚠ `<button>`, `<i>` emas: klaviatura bilan ham yetib borish va
 * teginish bilan ochish kerak — sensor ekranda «ustiga borish» degan
 * narsaning o'zi yo'q.
 */
function Hint({ text }) {
  if (!text) return null;
  return (
    <button type="button" className="kpi__hint" title={text} aria-label={text}
            onClick={(e) => e.currentTarget.focus()}>i</button>
  );
}

function Kpi({ label, value, now, prev, icon, tone, invert, hint, sub }) {
  return (
    <div className={`kpi${tone ? ` kpi--${tone}` : ""}`}>
      <div className="kpi__top">
        <span className="kpi__label">
          {label}
          <Hint text={hint} />
        </span>
        {icon && <i className={`fa-solid ${icon} kpi__icon`} aria-hidden="true" />}
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__foot">
        {prev !== undefined && <Delta now={now} prev={prev} invert={invert} />}
        {sub && <span className="kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Karta — sarlavha + ixtiyoriy o'ng burchak. */
function Panel({ title, icon, right, children, wide }) {
  return (
    <div className={`card${wide ? " rpt-wide" : ""}`}>
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

/* ══ CSV ═══════════════════════════════════════════════════════════════
   ⚠ Nuqtali VERGUL bilan ajratiladi, vergul bilan emas: Excel'ning
   ruscha/o'zbekcha sozlamasida vergul KASR belgisi va oddiy CSV bitta
   ustunga yopishib qolardi. `﻿` — BOM, usiz kirill harflar
   Excel'da krakozyabra bo'lardi. */
function downloadCsv(name, headers, rows) {
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

/* ══ EXCEL — BUTUN HISOBOT ═════════════════════════════════════════════

   ⚠ HAR BO'LIM O'Z VARAG'IDA. Hammasini bitta varaqqa yopishtirish
   Excelda ustunlarni bir-biriga to'g'ri kelmaydigan qilardi: tovarlar
   sakkiz ustun, to'lovlar uchta. Alohida varaqda esa har jadval o'z
   sarlavhasi bilan turadi va uni saralash ham, jamlash ham ishlaydi.

   ⚠ SON SIFATIDA yoziladi (`Number`), formatlangan matn sifatida
   emas: «12 000 so'm» degan katakni Excel jamlay olmaydi va
   foydalanuvchi «nega yig'indi chiqmayapti?» deb qolardi. Formatlash
   Excelning o'z ishi.
   ══════════════════════════════════════════════════════════════════════ */
function exportXlsx(d, range, periodLabel) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const head = (...cols) => cols.map((v) => ({ v, bold: true }));
  const k = d.now || {};
  const sheets = [];

  sheets.push({
    name: t("rpt2.tabHome"),
    rows: [
      [{ v: `${periodLabel}: ${isoDay(range.from)} — ${isoDay(new Date(range.to.getTime() - 1))}`, bold: true }],
      [],
      head(t("rpt2.metric"), t("common.sum")),
      [t("rpt2.grossSales"),    n(k.grossSales)],
      [t("rpt2.discount"),      n(k.discount)],
      [t("rpt2.returns"),       n(k.returns)],
      [t("rpt2.netSales"),      n(k.netSales)],
      [t("rpt2.cogs"),          n(k.cogs)],
      [t("rpt2.grossProfit"),   n(k.grossProfit)],
      [t("rpt2.margin"),        n(k.margin)],
      [t("rpt2.expenses"),      n(k.expenses)],
      [t("rpt2.inventoryLoss"), n(k.inventoryLoss)],
      [t("rpt2.netProfit"),     n(k.netProfit)],
      [],
      [t("rpt2.receipts"),      n(k.receipts)],
      [t("rpt2.avgReceipt"),    n(k.avgReceipt)],
      [t("rpt2.maxReceipt"),    n(k.maxReceipt)],
      [t("rpt2.minReceipt"),    n(k.minReceipt)],
      [t("rpt2.cancelled"),     n(k.cancelledReceipts)],
      [t("rpt2.itemsSold"),     n(k.itemsSold)],
      [t("rpt2.customers"),     n(k.customers)],
      [t("rpt2.customersNew"),  n(k.newCustomers)],
      [t("rpt2.credit"),        n(k.credit)],
    ],
  });

  sheets.push({
    name: t("rpt2.tabSales"),
    rows: [
      head(t("common.date"), t("rpt2.netSales"), t("rpt2.cogs"), t("rpt2.grossProfit"),
           t("rpt2.returns"), t("rpt2.receipts")),
      ...(d.series || []).map((x) => [x.label, n(x.netSales), n(x.cogs),
                                      n(x.grossProfit), n(x.returns), n(x.receipts)]),
    ],
  });

  sheets.push({
    name: t("rpt2.tabProducts"),
    rows: [
      head(t("products.col"), t("products.category"), t("rpt2.sold"), t("rpt2.netSales"),
           t("rpt2.profit"), t("rpt2.margin"), t("rpt2.returned"), t("rpt2.turnover"),
           t("rpt2.stockQty"), t("rpt2.stockValue")),
      ...(d.products || []).map((x) => [x.name, x.categoryName || "", n(x.quantity),
        n(x.netSales), n(x.profit), n(x.margin), n(x.returnedQty), n(x.turnover),
        n(x.stockQty), n(x.stockValue)]),
    ],
  });

  sheets.push({
    name: t("rpt2.byCategory"),
    rows: [
      head(t("rpt2.byCategory"), t("rpt2.sold"), t("rpt2.netSales"), t("rpt2.profit"), t("rpt2.margin")),
      ...(d.categories || []).map((x) => [x.name || t("rpt2.noCategory"),
        n(x.quantity), n(x.netSales), n(x.profit), n(x.margin)]),
    ],
  });

  sheets.push({
    name: t("rpt2.tabStaff"),
    rows: [
      head(t("staff.name"), t("rpt2.receipts"), t("rpt2.netSales"), t("rpt2.avgReceipt"),
           t("rpt2.discount"), t("rpt2.returns"), t("rpt2.cancelled"), t("rpt2.nonCash")),
      ...(d.cashiers || []).map((x) => [x.name, n(x.receipts), n(x.netSales), n(x.avgReceipt),
        n(x.discount), n(x.returns), n(x.cancelled), n(x.nonCashShare)]),
    ],
  });

  if ((d.branches || []).length) {
    sheets.push({
      name: t("rpt2.branches"),
      rows: [
        head(t("rpt2.branch"), t("rpt2.receipts"), t("rpt2.netSales"),
             t("rpt2.grossProfit"), t("rpt2.margin"), t("rpt2.customers")),
        ...d.branches.map((x) => [x.name, n(x.receipts), n(x.netSales),
          n(x.profit), n(x.margin), n(x.customers)]),
      ],
    });
  }

  sheets.push({
    name: t("rpt2.tabMoney"),
    rows: [
      head(t("rpt2.payMix"), t("common.sum"), "%"),
      ...(d.payments || []).map((x) => [paymentEntry(x.type).label, n(x.amount), n(x.share)]),
      [],
      head(t("rpt2.expenses"), t("common.sum"), "%"),
      ...(d.expenses || []).map((x) => [x.name || t("rpt2.noCategory"), n(x.amount), n(x.share)]),
      [],
      head(t("rpt2.debtAging"), t("common.sum")),
      [t("rpt2.age0"),  n(d.debt?.bucket0to7)],
      [t("rpt2.age8"),  n(d.debt?.bucket8to30)],
      [t("rpt2.age31"), n(d.debt?.bucket31plus)],
      [t("rpt2.debtTotal"), n(d.debt?.total)],
    ],
  });

  sheets.push({
    name: t("rpt2.tabStock"),
    rows: [
      head(t("rpt2.metric"), t("common.sum")),
      [t("rpt2.stockValue"),   n(d.stock?.totalValue)],
      [t("rpt2.stockQty"),     n(d.stock?.totalQuantity)],
      [t("rpt2.outOfStock"),   n(d.stock?.outOfStock)],
      [t("rpt2.lowStock"),     n(d.stock?.lowStock)],
      [t("rpt2.expiringSoon"), n(d.stock?.expiringSoon)],
      [t("rpt2.expired"),      n(d.stock?.expired)],
      [],
      head(t("rpt2.slowMoving"), t("rpt2.stockQty"), t("rpt2.stockValue"), t("rpt2.sold")),
      ...(d.stock?.slowMoving || []).map((x) => [x.name, n(x.stockQty), n(x.stockValue), n(x.soldQty)]),
    ],
  });

  sheets.push({
    name: t("rpt2.tabTime"),
    rows: [
      head(t("rpt2.hourly"), t("rpt2.netSales"), t("rpt2.receipts")),
      ...(d.hourly || []).map((x) => [`${String(x.hour).padStart(2, "0")}:00`,
        n(x.netSales), n(x.receipts)]),
    ],
  });

  if ((d.basket || []).length) {
    sheets.push({
      name: t("rpt2.basket"),
      rows: [
        head(t("rpt2.basketA"), t("rpt2.basketB"), t("rpt2.together"), t("rpt2.confidence")),
        ...d.basket.map((x) => [x.nameA, x.nameB, n(x.together), n(x.confidence)]),
      ],
    });
  }

  if ((d.anomalies || []).length) {
    sheets.push({
      name: t("rpt2.tabWatch"),
      rows: [
        head(t("audit.action"), t("staff.name"), t("common.sum"), t("rpt2.avgIs", { v: "" })),
        ...d.anomalies.map((x) => [t(`rpt2.an.${x.kind}`), x.subjectName || "",
          n(x.value), n(x.baseline)]),
      ],
    });
  }

  downloadXlsx(`hisobot-${isoDay(range.from)}`, sheets);
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function ReportsPage({ toast }) {
  const [period, setPeriod] = useState(() => localStorage.getItem("ek_rpt_period") || "month");
  const [custom, setCustom] = useState(() => {
    const now = new Date();
    return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
  });
  const [bucket, setBucket] = useState("");
  const [branchId, setBranchId] = useState(null);
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  /* Oylik reja — do'kon sozlamasidan. ⚠ ALOHIDA so'rov va u yiqilsa
     ekran baribir chiziladi: reja qo'shimcha, uning yo'qligi
     hisobotni ishlatishga xalaqit bermaydi. */
  const [target, setTarget] = useState(null);
  /* Do'kon nomi — QOG'OZDAGI sarlavha uchun. Ekranda u yon panelda
     turadi, chop etilgan varaqda esa yon panel yo'q. */
  const [shopName, setShopName] = useState("");
  useEffect(() => {
    shopApi.getProfile()
      .then((r) => {
        const p = r?.data ?? r;
        setTarget(p?.monthlySalesTarget ?? null);
        setShopName(p?.name || "");
      })
      .catch(() => setTarget(null));
  }, []);

  const range = useMemo(() => periodRange(period, new Date(), custom), [period, custom]);
  const days = lengthDays(range);

  const load = useCallback(() => {
    setLoading(true);
    reportApi.analytics(isoInstant(range.from), isoInstant(range.to), bucket || undefined, branchId)
      .then((r) => setData(r.data))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [range.from, range.to, bucket, branchId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { localStorage.setItem("ek_rpt_period", period); }, [period]);

  const k = data?.now;
  const p = data?.prev;

  /* ── Dinamika nuqtalari ──────────────────────────────────────────── */
  const points = useMemo(() => (data?.series || []).map((s) => ({
    label: s.label,
    /* ⚠ Sana ham saqlanadi: prognoz hafta kuni koeffitsiyentini
       shundan oladi va usiz shanba bilan dushanbani ajrata olmasdi. */
    at: s.at,
    sales: num(s.netSales),
    cost: num(s.cogs),
    profit: num(s.grossProfit),
    returns: num(s.returns),
  })), [data]);

  const periodLabel = t(`rpt2.p.${period}`);

  return (
    <div className="rpt">
      {/* ── Boshqaruv qatori ───────────────────────────────────────────
          ⚠ Davr, qadam, filial va eksport BITTA qatorda: bularning
          hammasi «nimani ko'rsataman» degan bitta savolga tegishli va
          ularni sahifaning turli joylariga sochish foydalanuvchini
          har safar qidirishga majburlardi. */}
      <div className="rpt-bar">
        <div className="rpt-bar__periods" role="tablist" aria-label={t("rpt2.period")}>
          {PERIODS.filter((x) => x !== "custom").map((x) => (
            <button key={x} type="button" role="tab" aria-selected={period === x}
                    className={`rpt-seg${period === x ? " is-on" : ""}`}
                    onClick={() => setPeriod(x)}>
              {t(`rpt2.p.${x}`)}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={period === "custom"}
                  className={`rpt-seg${period === "custom" ? " is-on" : ""}`}
                  onClick={() => setPeriod("custom")}>
            <i className="fa-solid fa-calendar-days" aria-hidden="true" /> {t("rpt2.p.custom")}
          </button>
        </div>

        <div className="rpt-bar__tools">
          <Select value={bucket} onChange={setBucket} ariaLabel={t("rpt2.step")}
                  options={[
                    { value: "",      label: t("rpt2.stepAuto"), icon: "fa-wand-magic-sparkles" },
                    { value: "day",   label: t("rpt2.stepDay"),   icon: "fa-calendar-day" },
                    { value: "week",  label: t("rpt2.stepWeek"),  icon: "fa-calendar-week" },
                    { value: "month", label: t("rpt2.stepMonth"), icon: "fa-calendar" },
                  ]} />
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
          <button className="btn btn-outline btn-sm" onClick={load} title={t("common.refresh")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          </button>
          {/* ⚠ Chop etish BRAUZERNIKI: PDF kutubxonasi ilovaga 200 KB
              qo'shardi, brauzer esa «PDF ga saqlash» ni o'zi taklif
              qiladi va sahifa uslubini aynan saqlaydi (`@media print`). */}
          {/* ⚠ Excel — BUTUN hisobot, har bo'lim o'z varag'ida. Faqat
              ochiq bo'limni chiqarish «yana bir bosim» degan ish
              bo'lardi: rahbar odatda hammasini bir faylda oladi. */}
          <button className="btn btn-outline btn-sm" disabled={!data}
                  onClick={() => { try { exportXlsx(data, range, periodLabel); }
                                   catch (e) { toast?.error(e.message); } }}>
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true" /> {t("rpt2.print")}
          </button>
        </div>
      </div>

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

      {/* ══ QOG'OZDAGI SARLAVHA (V73) ═══════════════════════════════════
          ⚠ FAQAT CHOP ETISHDA ko'rinadi. Ekranda do'kon nomi yon
          panelda turadi, qog'ozda esa u YO'Q — va sarlavhasiz varaq
          «qaysi do'konning qaysi davri?» degan savolni javobsiz
          qoldiradi. Bir necha filialli do'konda bu ayniqsa muhim:
          bosilgan ikkita hisobotni ajratib bo'lmasdi. */}
      <div className="rpt-print-head">
        <b>{shopName || t("rpt2.title")}</b>
        <span>{t("rpt2.title")} · {periodLabel}</span>
        <span>{isoDay(range.from)} — {isoDay(new Date(range.to.getTime() - 1))}</span>
      </div>

      <div className="rpt-range">
        <i className="fa-solid fa-calendar-check" aria-hidden="true" />
        <b>{periodLabel}</b>
        <span>{isoDay(range.from)} — {isoDay(new Date(range.to.getTime() - 1))}</span>
        <span className="text-muted">· {t("rpt2.days", { n: days })}</span>
      </div>

      {/* ── Bo'limlar ─────────────────────────────────────────────────── */}
      <div className="rpt-tabs" role="tablist" aria-label={t("rpt2.sections")}>
        {TABS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key}
                  className={`rpt-tab${tab === x.key ? " is-on" : ""}`}
                  onClick={() => setTab(x.key)}>
            <i className={`fa-solid ${x.icon}`} aria-hidden="true" /> {x.label()}
          </button>
        ))}
      </div>

      {busy ? <SkeletonCards count={4} className="kpi-grid" />
        : !data ? <Empty icon="fa-chart-pie" text={t("rpt2.noData")} />
        : (
          <>
            {tab === "home"     && <Home     d={data} k={k} p={p} points={points} days={days}
                                     target={target} range={range} period={period} />}
            {tab === "sales"    && <Sales    d={data} k={k} p={p} points={points} />}
            {tab === "profit"   && <Profit   d={data} k={k} p={p} />}
            {tab === "products" && <Products d={data} />}
            {tab === "staff"    && <Staff    d={data} />}
            {tab === "money"    && <Money    d={data} k={k} p={p} />}
            {tab === "stock"    && <Stock    d={data} />}
            {tab === "people"   && <People   d={data} k={k} p={p} />}
            {tab === "time"     && <Time     d={data} />}
            {tab === "watch"    && <Watch    d={data} k={k} />}
          </>
        )}
    </div>
  );
}

/* ══ 1. BOSH SAHIFA ════════════════════════════════════════════════════ */

function Home({ d, k, p, points, days, target, range, period }) {
  /* Kunlik o'rtacha — davrlarni taqqoslash uchun yagona adolatli
     o'lchov: 5 kunlik va 30 kunlik davrning jami summasini yonma-yon
     qo'yish hech narsa aytmaydi. */
  const perDay = num(k.netSales) / Math.max(1, days);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.netSales")} value={money(k.netSales)}
             now={k.netSales} prev={p.netSales} icon="fa-sack-dollar" tone="brand"
             sub={t("rpt2.perDay", { v: shortNum(perDay) })} />
        <Kpi label={t("rpt2.grossProfit")} value={money(k.grossProfit)}
             now={k.grossProfit} prev={p.grossProfit} icon="fa-arrow-trend-up" tone="good"
             sub={`${t("rpt2.margin")}: ${percent(k.margin)}`} />
        <Kpi label={t("rpt2.netProfit")} value={money(k.netProfit)}
             now={k.netProfit} prev={p.netProfit} icon="fa-wallet"
             tone={num(k.netProfit) < 0 ? "bad" : "good"}
             hint={t("rpt2.netProfitHint")} />
        <Kpi label={t("rpt2.receipts")} value={k.receipts}
             now={k.receipts} prev={p.receipts} icon="fa-receipt"
             sub={`${t("rpt2.avgReceipt")}: ${money(k.avgReceipt)}`} />
        <Kpi label={t("rpt2.customers")} value={k.customers}
             now={k.customers} prev={p.customers} icon="fa-users"
             sub={t("rpt2.newN", { n: k.newCustomers })} />
        <Kpi label={t("rpt2.returns")} value={money(k.returns)}
             now={k.returns} prev={p.returns} icon="fa-rotate-left" invert
             tone={num(k.returns) > 0 ? "warn" : undefined}
             sub={t("rpt2.nReceipts", { n: k.returnReceipts })} />
        <Kpi label={t("rpt2.expenses")} value={money(k.expenses)}
             now={k.expenses} prev={p.expenses} icon="fa-money-bill-wave" invert />
        <Kpi label={t("rpt2.credit")} value={money(k.credit)}
             now={k.credit} prev={p.credit} icon="fa-hand-holding-dollar" invert
             hint={t("rpt2.creditHint")} />
      </div>

      <Panel title={t("rpt2.dynamics")} icon="fa-chart-line" wide>
        <div className="card-body">
          <LineChart points={points} height={260} empty={t("rpt2.noData")}
                     lines={[
                       { key: "sales",  name: t("rpt2.netSales"),    color: C.sales,  area: true },
                       { key: "profit", name: t("rpt2.grossProfit"), color: C.profit },
                       { key: "cost",   name: t("rpt2.cogs"),        color: C.cost },
                     ]} />
        </div>
      </Panel>

      <TargetAndForecast points={points} k={k} target={target} range={range} period={period} />

      <Insights d={d} k={k} p={p} />

      <div className="rpt-cols">
        <PayMix d={d} />
        <TopList title={t("rpt2.topProducts")} icon="fa-trophy"
                 rows={(d.products || []).slice(0, 8).map((x) => ({
                   name: x.name, value: money(x.netSales),
                   sub: `${shortNum(x.quantity)} · ${percent(x.margin)}`,
                 }))} />
      </div>
    </>
  );
}

/* ══ REJA VA PROGNOZ (V70) ═════════════════════════════════════════════

   Do'kon egasi ikkita narsani so'radi: «reja 2.0 mlrd, haqiqat 1.62
   mlrd, bajarilish 81%» va «oy tugashiga 8 kun qoldi, tizim 2.08 mlrd
   bo'lishini taxmin qilsin».

   ⚠ BO'LIM FAQAT KERAK BO'LGANDA CHIZILADI. Reja qo'yilmagan bo'lsa
   yoki davr TUGAGAN bo'lsa (kecha, o'tgan oy) — u umuman ko'rinmaydi:
   tugagan oyning «prognozi» ma'nosiz va ekranda bekorga joy egallardi.

   ⚠ Reja OYLIK, shuning uchun bajarilish faqat OY davrida
   ko'rsatiladi. «Bugun» yoki «shu yil» ni oylik reja bilan
   solishtirish yolg'on javob berardi: kunlik savdo rejaning 3% ini
   bajaradi va bu «yomon» bo'lib ko'rinardi.
   ══════════════════════════════════════════════════════════════════════ */
function TargetAndForecast({ points, k, target, range, period }) {
  /* Davr oxirigacha qolgan kunlar. Manfiy bo'lsa davr tugagan. */
  const daysLeft = useMemo(() => {
    const end = new Date(range.to.getTime() - 1);
    const today = new Date();
    return Math.max(0, Math.ceil((end - today) / 86400000));
  }, [range.to]);

  /* Prognoz uchun KUNLIK qator kerak — hafta yoki oy qadamida
     «kelasi kun» degan tushunchaning o'zi yo'q. */
  const daily = useMemo(
    () => points.filter((x) => x.at).map((x) => ({ at: x.at, value: x.sales })),
    [points]);

  const prog = targetProgress(target, k.netSales, daysLeft);
  const showTarget = prog && period === "month";
  const expected = daysLeft > 0 ? expectedTotal(k.netSales, daily, daysLeft) : null;
  const next = daysLeft > 0 ? null : forecast(daily, 7);

  if (!showTarget && expected == null && !next) return null;

  return (
    <div className="rpt-cols">
      {showTarget && (
        <Panel title={t("rpt2.target")} icon="fa-bullseye">
          <div className="card-body">
            <div className="tgt">
              <div className="tgt__row">
                <span>{t("rpt2.targetPlan")}</span>
                <b className="mono">{money(target)}</b>
              </div>
              <div className="tgt__row">
                <span>{t("rpt2.targetDone")}</span>
                <b className="mono text-blue">{money(k.netSales)}</b>
              </div>
              {/* ⚠ Chiziq 100% dan OSHMAYDI, lekin foiz oshadi: to'lgan
                  chiziq «tugadi» degan aniq ishora va uni cho'zish
                  qutidan chiqib ketardi. */}
              <div className="tgt__bar">
                <i style={{ width: `${Math.min(100, prog.percent)}%`,
                            background: prog.percent >= 100 ? "var(--fg-success)" : "var(--bg-brand)" }} />
              </div>
              <div className="tgt__foot">
                <b className={prog.percent >= 100 ? "text-success" : ""}>{prog.percent.toFixed(0)}%</b>
                {prog.left > 0
                  ? <span>{t("rpt2.targetLeft", { v: money(prog.left) })}</span>
                  : <span className="text-success">{t("rpt2.targetDoneAll")}</span>}
              </div>
              {prog.perDayNeeded != null && prog.left > 0 && (
                <div className="tgt__hint">
                  {t("rpt2.targetPerDay", { n: daysLeft, v: money(prog.perDayNeeded) })}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {(expected != null || next) && (
        <Panel title={t("rpt2.forecast")} icon="fa-wand-magic-sparkles"
               right={<Hint text={t("rpt2.forecastHint")} />}>
          <div className="card-body">
            {expected != null && (
              <div className="tgt__row tgt__row--big">
                <span>{t("rpt2.expectedTotal", { n: daysLeft })}</span>
                <b className="mono">{money(expected)}</b>
              </div>
            )}
            {/* Davr tugagan bo'lsa — kelasi hafta taxmini. */}
            {next && (
              <BarChart height={170} empty={t("rpt2.noData")} color={C.sales}
                        bars={next.map((x) => ({
                          label: `${String(x.at.getDate()).padStart(2, "0")}.${String(x.at.getMonth() + 1).padStart(2, "0")}`,
                          value: x.value,
                        }))} />
            )}
            {expected == null && !next && (
              <div className="text-muted" style={{ fontSize: 13 }}>
                {t("rpt2.forecastNeedData", { n: MIN_POINTS })}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ══ AI-XULOSA ═════════════════════════════════════════════════════════
   ⚠ Bu «sun'iy aql» emas, ARIFMETIKA — va shunday atalishi ham kerak
   emas edi: har xulosa ekrandagi raqamlardan chiqadi va uni qo'lda
   tekshirsa bo'ladi. Sabab oddiy: rahbar grafikni o'zi tahlil qilishga
   majbur bo'lmasligi kerak, lekin xulosa tushuntirib bo'lmaydigan
   qora quti bo'lsa, unga bir marta ishonch yo'qolgach qaytmaydi.

   ⚠ Faqat SEZILARLI o'zgarish yoziladi (10% dan katta). Har kichik
   tebranishga izoh yozilsa, ro'yxat uzayib, muhimi ichida yo'qolardi. */
function Insights({ d, k, p }) {
  const list = useMemo(() => {
    const out = [];
    const g = (a, b) => growth(a, b);

    const gs = g(k.netSales, p.netSales);
    if (gs !== null && Math.abs(gs) >= 10) {
      out.push({ tone: gs > 0 ? "good" : "bad", icon: gs > 0 ? "fa-arrow-trend-up" : "fa-arrow-trend-down",
                 text: t(gs > 0 ? "rpt2.insSalesUp" : "rpt2.insSalesDown", { v: Math.abs(gs).toFixed(1) }) });
    }
    const gm = num(k.margin) - num(p.margin);
    if (Math.abs(gm) >= 2) {
      out.push({ tone: gm > 0 ? "good" : "warn", icon: "fa-percent",
                 text: t(gm > 0 ? "rpt2.insMarginUp" : "rpt2.insMarginDown", { v: Math.abs(gm).toFixed(1) }) });
    }
    /* Eng katta ulushli kategoriya — o'sishning manbasi. */
    const cat = (d.categories || [])[0];
    if (cat && num(k.netSales) > 0) {
      const share = (num(cat.netSales) / num(k.netSales)) * 100;
      if (share >= 20) {
        out.push({ tone: "info", icon: "fa-layer-group",
                   text: t("rpt2.insCategory", { name: cat.name || t("rpt2.noCategory"), v: share.toFixed(0) }) });
      }
    }
    if (num(k.netProfit) < 0) {
      out.push({ tone: "bad", icon: "fa-triangle-exclamation", text: t("rpt2.insLoss") });
    }
    const retRate = num(k.netSales) > 0 ? (num(k.returns) / num(k.netSales)) * 100 : 0;
    if (retRate >= 5) {
      out.push({ tone: "warn", icon: "fa-rotate-left", text: t("rpt2.insReturns", { v: retRate.toFixed(1) }) });
    }
    const st = d.stock || {};
    if (num(st.outOfStock) > 0 || num(st.lowStock) > 0) {
      out.push({ tone: "warn", icon: "fa-boxes-stacked",
                 text: t("rpt2.insStock", { out: st.outOfStock || 0, low: st.lowStock || 0 }) });
    }
    if ((d.anomalies || []).length) {
      out.push({ tone: "bad", icon: "fa-shield-halved", text: t("rpt2.insAnomaly", { n: d.anomalies.length }) });
    }
    return out;
  }, [d, k, p]);

  if (!list.length) return null;
  return (
    <Panel title={t("rpt2.insights")} icon="fa-lightbulb" wide>
      <div className="card-body ins">
        {list.map((x, i) => (
          <div key={i} className={`ins__row ins--${x.tone}`}>
            <i className={`fa-solid ${x.icon}`} aria-hidden="true" />
            <span>{x.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ══ 2. SAVDO ══════════════════════════════════════════════════════════ */

function Sales({ d, k, p, points }) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.grossSales")} value={money(k.grossSales)} now={k.grossSales} prev={p.grossSales} icon="fa-cash-register" />
        <Kpi label={t("rpt2.discount")} value={money(k.discount)} now={k.discount} prev={p.discount} icon="fa-tags" invert />
        <Kpi label={t("rpt2.returns")} value={money(k.returns)} now={k.returns} prev={p.returns} icon="fa-rotate-left" invert />
        <Kpi label={t("rpt2.netSales")} value={money(k.netSales)} now={k.netSales} prev={p.netSales} icon="fa-sack-dollar" tone="brand" />
        <Kpi label={t("rpt2.itemsSold")} value={shortNum(k.itemsSold)} now={k.itemsSold} prev={p.itemsSold} icon="fa-box" />
        <Kpi label={t("rpt2.maxReceipt")} value={money(k.maxReceipt)} icon="fa-arrow-up-wide-short" />
        <Kpi label={t("rpt2.minReceipt")} value={money(k.minReceipt)} icon="fa-arrow-down-wide-short" />
        <Kpi label={t("rpt2.cancelled")} value={k.cancelledReceipts} now={k.cancelledReceipts} prev={p.cancelledReceipts}
             icon="fa-circle-xmark" invert tone={num(k.cancelledReceipts) > 0 ? "warn" : undefined}
             sub={money(k.cancelledAmount)} />
      </div>

      <Panel title={t("rpt2.dynamics")} icon="fa-chart-line" wide>
        <div className="card-body">
          <LineChart points={points} height={280} empty={t("rpt2.noData")}
                     lines={[
                       { key: "sales",   name: t("rpt2.netSales"), color: C.sales, area: true },
                       { key: "returns", name: t("rpt2.returns"),  color: C.ret },
                     ]} />
        </div>
      </Panel>

      {(d.branches || []).length > 0 && (
        <Panel title={t("rpt2.branches")} icon="fa-store" wide>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t("rpt2.branch")}</th><th>{t("rpt2.receipts")}</th>
                <th>{t("rpt2.netSales")}</th><th>{t("rpt2.grossProfit")}</th>
                <th>{t("rpt2.margin")}</th><th>{t("rpt2.customers")}</th>
              </tr></thead>
              <tbody>
                {d.branches.map((b, i) => (
                  <tr key={b.shopId}>
                    <td className="fw-700">
                      {/* Uchtalik — birinchi uch o'rin ko'zga tashlanadi. */}
                      {i < 3 && <span className="rank">{i + 1}</span>} {b.name}
                    </td>
                    <td className="mono">{b.receipts}</td>
                    <td className="mono fw-700 text-blue">{money(b.netSales)}</td>
                    <td className="mono">{money(b.profit)}</td>
                    <td className="mono">{percent(b.margin)}</td>
                    <td className="mono">{b.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

/* ══ 3. FOYDA (P&L) ════════════════════════════════════════════════════ */

/**
 * Foyda va zarar hisoboti — zinapoya.
 *
 * ⚠ «Savdo 100 mln» degan bitta raqam yetarli emas: rahbar pul QAYERDA
 * qolganini ko'rishi kerak. Shuning uchun har qator yuqoridagidan
 * qanday chiqqani ko'rinib turadi va ayiriladigan qatorlar chekkaga
 * suriladi.
 */
function Profit({ d, k, p }) {
  const rows = [
    { label: t("rpt2.grossSales"),  value: k.grossSales,  strong: true },
    { label: t("rpt2.discount"),    value: -num(k.discount), minus: true },
    { label: t("rpt2.returns"),     value: -num(k.returns),  minus: true },
    { label: t("rpt2.netSales"),    value: k.netSales,    sum: true },
    { label: t("rpt2.cogs"),        value: -num(k.cogs),  minus: true },
    { label: t("rpt2.grossProfit"), value: k.grossProfit, sum: true,
      extra: percent(k.margin) },
    { label: t("rpt2.expenses"),      value: -num(k.expenses),      minus: true },
    { label: t("rpt2.inventoryLoss"), value: -num(k.inventoryLoss), minus: true,
      hint: t("rpt2.inventoryLossHint") },
    { label: t("rpt2.netProfit"),   value: k.netProfit,   total: true },
  ];

  /* ⚠ YAXLITLASH — FOYDA ZANJIRIDAN TASHQARIDA (V80). U tushumga
     allaqachon kirmagan (chek jamisining o'zi yaxlitlangan), shuning
     uchun ro'yxatga qo'shilsa foyda ikki marta kamayardi.

     Lekin u KO'RINISHI kerak: son kutilmaganda o'sib ketsa, demak
     biror joyda xato bor — narx kasr qo'yilgan, tarozi noto'g'ri
     o'qiyapti yoki chegirma formulasi buzilgan. Ko'rinmaydigan
     yaxlitlash — o'g'irlikning eng sekin turi.

     Nolda umuman chizilmaydi: donalab sotadigan do'konda bu qator
     hech qachon kerak bo'lmaydi. */
  const rounding = num(k.roundingGiven);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.grossProfit")} value={money(k.grossProfit)} now={k.grossProfit} prev={p.grossProfit} icon="fa-arrow-trend-up" tone="good" />
        <Kpi label={t("rpt2.margin")} value={percent(k.margin)} now={k.margin} prev={p.margin} icon="fa-percent" />
        <Kpi label={t("rpt2.netProfit")} value={money(k.netProfit)} now={k.netProfit} prev={p.netProfit}
             icon="fa-wallet" tone={num(k.netProfit) < 0 ? "bad" : "good"} />
        <Kpi label={t("rpt2.lossSales")} value={money(k.lossAmount)} icon="fa-arrow-trend-down"
             tone={num(k.lossAmount) > 0 ? "bad" : undefined}
             sub={t("rpt2.nReceipts", { n: k.lossSales })} hint={t("rpt2.lossHint")} />
      </div>

      <Panel title={t("rpt2.pnl")} icon="fa-scale-balanced" wide
             right={<button className="btn btn-outline btn-sm"
                            onClick={() => downloadCsv("pnl",
                              [t("rpt2.metric"), t("common.sum")],
                              rows.map((r) => [r.label, Math.round(num(r.value))]))}>
                      <i className="fa-solid fa-file-csv" aria-hidden="true" /> CSV
                    </button>}>
        <div className="card-body">
          <table className="pnl">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`${r.minus ? "pnl--minus" : ""}${r.sum ? " pnl--sum" : ""}${r.total ? " pnl--total" : ""}`}>
                  <td>
                    {r.label}
                    <Hint text={r.hint} />
                  </td>
                  <td className="mono">{r.extra}</td>
                  <td className={`mono ${num(r.value) < 0 ? "text-danger" : ""}`}>{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rounding > 0 && (
            <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 10 }}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
              {t("rpt2.rounding")}: <b className="ek-num">{money(rounding)}</b>
              {" — "}{t("rpt2.roundingHint")}
            </div>
          )}
        </div>
      </Panel>

      <div className="rpt-cols">
        <Panel title={t("rpt2.expenses")} icon="fa-money-bill-wave">
          <div className="card-body">
            {(d.expenses || []).length
              ? <ShareList rows={(d.expenses || []).map((e, i) => ({
                  name: e.name || t("rpt2.noCategory"), value: e.amount,
                  share: e.share, color: PALETTE[i % PALETTE.length],
                }))} />
              : <Empty icon="fa-receipt" text={t("rpt2.noExpenses")} />}
          </div>
        </Panel>
        <Panel title={t("rpt2.byCategory")} icon="fa-layer-group">
          <div className="card-body">
            {(d.categories || []).length
              ? <ShareList rows={(d.categories || []).slice(0, 8).map((c, i) => ({
                  name: c.name || t("rpt2.noCategory"), value: c.netSales,
                  share: null, sub: percent(c.margin), color: PALETTE[i % PALETTE.length],
                }))} />
              : <Empty icon="fa-layer-group" text={t("rpt2.noData")} />}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ══ 4. TOVARLAR ═══════════════════════════════════════════════════════ */

function Products({ d }) {
  /* ⚠ Ustun filtri SHU YERDA ham: «marjasi 10% dan past tovarlar» yoki
     «eng ko'p qaytarilgani» — bularning har biri boshqa savol va
     ularni qattiq tugmalar bilan qoplab bo'lmaydi. */
  const COLS = useMemo(() => [
    { key: "name",  label: t("products.col"),      type: "text",   get: (x) => x.name },
    { key: "cat",   label: t("products.category"), type: "text",   get: (x) => x.categoryName },
    { key: "qty",   label: t("rpt2.sold"),         type: "number", get: (x) => x.quantity },
    { key: "sales", label: t("rpt2.netSales"),     type: "number", get: (x) => x.netSales },
    { key: "prof",  label: t("rpt2.profit"),       type: "number", get: (x) => x.profit },
    { key: "marg",  label: t("rpt2.margin"),       type: "number", get: (x) => x.margin },
    { key: "ret",   label: t("rpt2.returned"),     type: "number", get: (x) => x.returnedQty },
    { key: "turn",  label: t("rpt2.turnover"),     type: "number", get: (x) => x.turnover },
  ], []);
  const flt = useDataFilter(COLS, "rpt-products");
  const rows = flt.apply(d.products || []);

  return (
    <>
      <div className="rpt-cols">
        <Panel title={t("rpt2.byCategory")} icon="fa-layer-group">
          <div className="card-body donut-row">
            <Donut size={190} empty={t("rpt2.noData")}
                   slices={(d.categories || []).slice(0, 8).map((c, i) => ({
                     label: c.name || t("rpt2.noCategory"),
                     value: num(c.netSales), color: PALETTE[i % PALETTE.length],
                   }))}
                   center={<><b>{(d.categories || []).length}</b><span>{t("rpt2.categories")}</span></>} />
            <ShareList rows={(d.categories || []).slice(0, 8).map((c, i) => ({
              name: c.name || t("rpt2.noCategory"), value: c.netSales,
              sub: percent(c.margin), color: PALETTE[i % PALETTE.length],
            }))} />
          </div>
        </Panel>
        <Panel title={t("rpt2.topByProfit")} icon="fa-trophy">
          <div className="card-body">
            <BarChart height={200} empty={t("rpt2.noData")} color={C.profit}
                      bars={[...(d.products || [])]
                        .sort((a, b) => num(b.profit) - num(a.profit))
                        .slice(0, 7)
                        .map((x) => ({ label: x.name.slice(0, 10), value: num(x.profit) }))} />
          </div>
        </Panel>
      </div>

      {/* ══ SAVAT TAHLILI (V70) ══════════════════════════════════════
          Do'kon egasi: «Coca-Cola sotilganda odamlar ko'pincha Chips
          ham oladi». ⚠ Juftlik YO'NALTIRILGAN o'qiladi: «A olganlarning
          X% i B ni ham oldi». Non olganlarning 5% i ikra oladi, ikra
          olganlarning 90% i non oladi — ikkalasi ham to'g'ri va
          ikkinchisi qimmatli javob. */}
      {(d.basket || []).length > 0 && (
        <Panel title={t("rpt2.basket")} icon="fa-cart-plus" wide
               right={<span className="text-muted" style={{ fontSize: 12 }}>{t("rpt2.basketHint")}</span>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t("rpt2.basketA")}</th><th /><th>{t("rpt2.basketB")}</th>
                <th>{t("rpt2.together")}</th><th>{t("rpt2.confidence")}</th>
              </tr></thead>
              <tbody>
                {d.basket.slice(0, 20).map((b, i) => (
                  <tr key={i}>
                    <td className="fw-700">{b.nameA}</td>
                    <td className="text-muted" style={{ width: 24, textAlign: "center" }}>
                      <i className="fa-solid fa-arrow-right-long" aria-hidden="true" />
                    </td>
                    <td className="fw-700">{b.nameB}</td>
                    <td className="mono">{b.together}</td>
                    <td className="mono fw-700 text-blue">{percent(b.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title={t("rpt2.allProducts")} icon="fa-boxes-stacked" wide
             right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <DataFilter cols={COLS} flt={flt} />
                      <button className="btn btn-outline btn-sm"
                              onClick={() => downloadCsv("tovarlar",
                                COLS.map((c) => c.label),
                                rows.map((r) => COLS.map((c) => c.get(r))))}>
                        <i className="fa-solid fa-file-csv" aria-hidden="true" /> CSV
                      </button>
                    </div>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <SortTh flt={flt} col="name">{t("products.col")}</SortTh>
              <SortTh flt={flt} col="cat">{t("products.category")}</SortTh>
              <SortTh flt={flt} col="qty">{t("rpt2.sold")}</SortTh>
              <SortTh flt={flt} col="sales">{t("rpt2.netSales")}</SortTh>
              <SortTh flt={flt} col="prof">{t("rpt2.profit")}</SortTh>
              <SortTh flt={flt} col="marg">{t("rpt2.margin")}</SortTh>
              <SortTh flt={flt} col="ret">{t("rpt2.returned")}</SortTh>
              <SortTh flt={flt} col="turn">{t("rpt2.turnover")}</SortTh>
            </tr></thead>
            <tbody>
              {rows.length ? rows.map((x) => (
                <tr key={x.productId}>
                  <td className="fw-700">{x.name}</td>
                  <td className="text-muted">{x.categoryName || "—"}</td>
                  <td className="mono">{shortNum(x.quantity)}</td>
                  <td className="mono fw-700 text-blue">{money(x.netSales)}</td>
                  <td className={`mono ${num(x.profit) < 0 ? "text-danger" : ""}`}>{money(x.profit)}</td>
                  <td className="mono">{percent(x.margin)}</td>
                  <td className="mono">{num(x.returnedQty) ? shortNum(x.returnedQty) : "—"}</td>
                  <td className="mono">{num(x.turnover) ? num(x.turnover).toFixed(1) : "—"}</td>
                </tr>
              )) : <tr><td colSpan={8}><Empty icon="fa-box-open" text={t("rpt2.noData")} /></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ══ 5. KASSIRLAR ══════════════════════════════════════════════════════ */

function Staff({ d }) {
  const rows = d.cashiers || [];
  return (
    <>
      <Panel title={t("rpt2.byCashier")} icon="fa-user-tie" wide
             right={<button className="btn btn-outline btn-sm"
                            onClick={() => downloadCsv("kassirlar",
                              [t("staff.name"), t("rpt2.receipts"), t("rpt2.netSales"),
                               t("rpt2.discount"), t("rpt2.returns"), t("rpt2.cancelled"),
                               t("rpt2.avgReceipt"), t("rpt2.nonCash")],
                              rows.map((c) => [c.name, c.receipts, Math.round(num(c.netSales)),
                                Math.round(num(c.discount)), Math.round(num(c.returns)),
                                c.cancelled, Math.round(num(c.avgReceipt)), num(c.nonCashShare)]))}>
                      <i className="fa-solid fa-file-csv" aria-hidden="true" /> CSV
                    </button>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{t("staff.name")}</th><th>{t("rpt2.receipts")}</th><th>{t("rpt2.netSales")}</th>
              <th>{t("rpt2.avgReceipt")}</th><th>{t("rpt2.discount")}</th>
              <th>{t("rpt2.returns")}</th><th>{t("rpt2.cancelled")}</th><th>{t("rpt2.nonCash")}</th>
            </tr></thead>
            <tbody>
              {rows.length ? rows.map((c, i) => (
                <tr key={c.userId}>
                  <td className="fw-700">{i < 3 && <span className="rank">{i + 1}</span>} {c.name}</td>
                  <td className="mono">{c.receipts}</td>
                  <td className="mono fw-700 text-blue">{money(c.netSales)}</td>
                  <td className="mono">{money(c.avgReceipt)}</td>
                  <td className="mono">{money(c.discount)}</td>
                  <td className="mono">{num(c.returns) ? money(c.returns) : "—"}</td>
                  {/* Bekor qilish — nazorat ustuni, shuning uchun nol
                      ham ANIQ ko'rsatiladi: tire «hisoblanmagan» degan
                      shubha qoldirardi. */}
                  <td className={`mono ${num(c.cancelled) > 0 ? "text-danger fw-700" : "text-muted"}`}>{c.cancelled}</td>
                  <td className="mono">{percent(c.nonCashShare)}</td>
                </tr>
              )) : <tr><td colSpan={8}><Empty icon="fa-user-tie" text={t("rpt2.noData")} /></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="rpt-cols">
        <Panel title={t("rpt2.salesByCashier")} icon="fa-chart-simple">
          <div className="card-body">
            <BarChart height={200} empty={t("rpt2.noData")}
                      bars={rows.slice(0, 8).map((c) => ({ label: (c.name || "").slice(0, 10), value: num(c.netSales) }))} />
          </div>
        </Panel>
        <Panel title={t("rpt2.discountByCashier")} icon="fa-tags">
          <div className="card-body">
            <BarChart height={200} color={C.warn} empty={t("rpt2.noData")}
                      bars={rows.slice(0, 8).map((c) => ({ label: (c.name || "").slice(0, 10), value: num(c.discount) }))} />
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ══ 6. PUL ════════════════════════════════════════════════════════════ */

function Money({ d, k, p }) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("enum.payment.CASH")} value={money(k.cash)} now={k.cash} prev={p.cash} icon="fa-money-bill-1" />
        <Kpi label={t("enum.payment.CARD")} value={money(k.card)} now={k.card} prev={p.card} icon="fa-credit-card" />
        <Kpi label={t("rpt2.online")} value={money(k.online)} now={k.online} prev={p.online} icon="fa-mobile-screen" />
        <Kpi label={t("enum.payment.SAVINGS")} value={money(k.savings)} now={k.savings} prev={p.savings} icon="fa-sack-dollar" />
      </div>

      <div className="rpt-cols">
        <PayMix d={d} />
        <Panel title={t("rpt2.debt")} icon="fa-hand-holding-dollar">
          <div className="card-body">
            <div className="dbt">
              <div className="dbt__total">
                <span>{t("rpt2.debtTotal")}</span>
                <b className="mono">{money(d.debt?.total)}</b>
                <small>{t("rpt2.nDebtors", { n: d.debt?.debtors || 0 })}</small>
              </div>
              {/* ⚠ Qarz YOSHI bo'yicha bo'linadi: bugungi 300 ming va
                  yarim yillik 300 ming butunlay boshqa gap va boshqa
                  qaror talab qiladi. */}
              <ShareList rows={[
                { name: t("rpt2.age0"),  value: d.debt?.bucket0to7,   color: C.profit },
                { name: t("rpt2.age8"),  value: d.debt?.bucket8to30,  color: C.warn },
                { name: t("rpt2.age31"), value: d.debt?.bucket31plus, color: C.ret },
              ]} />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function PayMix({ d }) {
  const rows = (d.payments || []).map((x, i) => {
    const e = paymentEntry(x.type);
    return { name: e.label, value: x.amount, share: x.share,
             color: e.color || PALETTE[i % PALETTE.length], icon: e.icon };
  });
  return (
    <Panel title={t("rpt2.payMix")} icon="fa-credit-card">
      <div className="card-body donut-row">
        <Donut size={180} empty={t("rpt2.noData")}
               slices={rows.map((r) => ({ label: r.name, value: num(r.value), color: r.color }))}
               center={<><b>{shortNum(rows.reduce((s, r) => s + num(r.value), 0))}</b>
                         <span>{t("common.sum")}</span></>} />
        <ShareList rows={rows} />
      </div>
    </Panel>
  );
}

/** Rangli ro'yxat — nom, summa, ulush. */
function ShareList({ rows = [] }) {
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
            <span className="shl__val mono">{money(r.value)}</span>
            <span className="shl__pct mono">{share.toFixed(1)}%</span>
            <span className="shl__bar"><i style={{ width: `${Math.min(100, share)}%`, background: r.color }} /></span>
          </div>
        );
      })}
    </div>
  );
}

function TopList({ title, icon, rows = [] }) {
  return (
    <Panel title={title} icon={icon}>
      <div className="card-body">
        {rows.length ? (
          <div className="topl">
            {rows.map((r, i) => (
              <div key={i} className="topl__row">
                <span className={`rank${i < 3 ? "" : " rank--dim"}`}>{i + 1}</span>
                <span className="topl__name">{r.name}</span>
                <span className="topl__sub">{r.sub}</span>
                <span className="topl__val mono">{r.value}</span>
              </div>
            ))}
          </div>
        ) : <Empty icon="fa-trophy" text={t("rpt2.noData")} />}
      </div>
    </Panel>
  );
}

/* ══ 7. OMBOR ══════════════════════════════════════════════════════════ */

function Stock({ d }) {
  const s = d.stock || {};
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.stockValue")} value={money(s.totalValue)} icon="fa-warehouse" tone="brand" />
        <Kpi label={t("rpt2.stockQty")} value={shortNum(s.totalQuantity)} icon="fa-cubes" />
        <Kpi label={t("rpt2.outOfStock")} value={s.outOfStock || 0} icon="fa-ban"
             tone={num(s.outOfStock) > 0 ? "bad" : undefined} />
        <Kpi label={t("rpt2.lowStock")} value={s.lowStock || 0} icon="fa-arrow-trend-down"
             tone={num(s.lowStock) > 0 ? "warn" : undefined} />
        <Kpi label={t("rpt2.expiringSoon")} value={s.expiringSoon || 0} icon="fa-clock"
             tone={num(s.expiringSoon) > 0 ? "warn" : undefined} />
        <Kpi label={t("rpt2.expired")} value={s.expired || 0} icon="fa-hourglass-end"
             tone={num(s.expired) > 0 ? "bad" : undefined} />
      </div>

      <Panel title={t("rpt2.slowMoving")} icon="fa-snowflake" wide
             right={<span className="text-muted" style={{ fontSize: 12 }}>{t("rpt2.slowHint")}</span>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{t("products.col")}</th><th>{t("rpt2.stockQty")}</th>
              <th>{t("rpt2.stockValue")}</th><th>{t("rpt2.sold")}</th>
            </tr></thead>
            <tbody>
              {(s.slowMoving || []).length ? s.slowMoving.map((x) => (
                <tr key={x.productId}>
                  <td className="fw-700">{x.name}</td>
                  <td className="mono">{shortNum(x.stockQty)}</td>
                  <td className="mono fw-700">{money(x.stockValue)}</td>
                  <td className="mono text-muted">{shortNum(x.soldQty)}</td>
                </tr>
              )) : <tr><td colSpan={4}><Empty icon="fa-check" text={t("rpt2.noSlow")} /></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={t("rpt2.turnoverTop")} icon="fa-rotate" wide>
        <div className="card-body">
          <BarChart height={200} empty={t("rpt2.noData")} color={C.cost}
                    bars={[...(d.products || [])]
                      .filter((x) => num(x.turnover) > 0)
                      .sort((a, b) => num(b.turnover) - num(a.turnover))
                      .slice(0, 8)
                      .map((x) => ({ label: x.name.slice(0, 10), value: num(x.turnover) }))}
                    fmt={(v) => `${num(v).toFixed(1)}×`} />
        </div>
      </Panel>
    </>
  );
}

/* ══ 8. MIJOZLAR ═══════════════════════════════════════════════════════ */

const RFM = [
  { key: "VIP",       color: C.profit },
  { key: "LOYAL",     color: C.sales },
  { key: "POTENTIAL", color: "#0ea5e9" },
  { key: "AT_RISK",   color: C.warn },
  { key: "LOST",      color: C.ret },
];

function People({ d, k, p }) {
  const c = d.customers || {};
  const seg = c.segments || {};
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.customersAll")} value={c.total || 0} icon="fa-users" />
        <Kpi label={t("rpt2.customersActive")} value={c.active || 0} now={k.customers} prev={p.customers} icon="fa-user-check" />
        <Kpi label={t("rpt2.customersNew")} value={c.newInPeriod || 0} now={k.newCustomers} prev={p.newCustomers} icon="fa-user-plus" />
        <Kpi label={t("rpt2.debtors")} value={c.debtors || 0} icon="fa-hand-holding-dollar"
             tone={num(c.debtors) > 0 ? "warn" : undefined} sub={money(d.debt?.total)} />
      </div>

      <div className="rpt-cols">
        <Panel title={t("rpt2.rfm")} icon="fa-chart-pie"
               right={<Hint text={t("rpt2.rfmHint")} />}>
          <div className="card-body donut-row">
            <Donut size={180} empty={t("rpt2.noData")}
                   slices={RFM.map((r) => ({ label: t(`rpt2.rfm.${r.key}`), value: seg[r.key] || 0, color: r.color }))}
                   center={<><b>{c.total || 0}</b><span>{t("rpt2.customersAll")}</span></>} />
            <div className="shl">
              {RFM.map((r) => (
                <div key={r.key} className="shl__row">
                  <span className="shl__dot" style={{ background: r.color }} />
                  <span className="shl__name">{t(`rpt2.rfm.${r.key}`)}</span>
                  <span className="shl__val mono">{seg[r.key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t("rpt2.debtAging")} icon="fa-hourglass-half">
          <div className="card-body">
            <ShareList rows={[
              { name: t("rpt2.age0"),  value: d.debt?.bucket0to7,   color: C.profit },
              { name: t("rpt2.age8"),  value: d.debt?.bucket8to30,  color: C.warn },
              { name: t("rpt2.age31"), value: d.debt?.bucket31plus, color: C.ret },
            ]} />
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ══ 9. VAQT ═══════════════════════════════════════════════════════════ */

function Time({ d }) {
  const hourly = d.hourly || [];
  const peak = useMemo(() => {
    let best = null;
    for (const h of hourly) if (!best || num(h.netSales) > num(best.netSales)) best = h;
    return best;
  }, [hourly]);
  const dows = [t("dow.mon"), t("dow.tue"), t("dow.wed"), t("dow.thu"),
                t("dow.fri"), t("dow.sat"), t("dow.sun")];

  return (
    <>
      <Panel title={t("rpt2.hourly")} icon="fa-clock" wide
             right={peak && num(peak.netSales) > 0 && (
               <span className="badge badge-blue">
                 {t("rpt2.peakHour", { h: String(peak.hour).padStart(2, "0") })}
               </span>
             )}>
        <div className="card-body">
          <BarChart height={220} empty={t("rpt2.noData")}
                    bars={hourly.map((h) => ({
                      label: String(h.hour).padStart(2, "0"),
                      value: num(h.netSales),
                      /* Tirband soat ajratiladi — u qaror uchun kerak:
                         kassirni qaysi soatga qo'yish. */
                      color: peak && h.hour === peak.hour ? C.profit : undefined,
                    }))} />
        </div>
      </Panel>

      <Panel title={t("rpt2.heat")} icon="fa-table-cells" wide
             right={<span className="text-muted" style={{ fontSize: 12 }}>{t("rpt2.heatHint")}</span>}>
        <div className="card-body">
          <HeatMap dows={dows} empty={t("rpt2.noData")}
                   cells={(d.heat || []).map((x) => ({ dow: x.dow, hour: x.hour, value: num(x.netSales) }))} />
        </div>
      </Panel>
    </>
  );
}

/* ══ 10. NAZORAT ═══════════════════════════════════════════════════════ */

/**
 * Anomaliyalar.
 *
 * ⚠ Bu AYBLOV EMAS, SAVOL. Shuning uchun har qatorda o'lchangan qiymat
 * ham, do'kon o'rtachasi ham turadi — rahbar farqni o'zi ko'rib qaror
 * qiladi. Sababsiz «firibgarlik» yozuvi bir marta noto'g'ri chiqsa,
 * butun bo'limga ishonch yo'qolardi.
 */
function Watch({ d, k }) {
  const list = d.anomalies || [];
  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t("rpt2.cancelled")} value={k.cancelledReceipts} icon="fa-circle-xmark"
             tone={num(k.cancelledReceipts) > 0 ? "warn" : undefined} sub={money(k.cancelledAmount)} />
        <Kpi label={t("rpt2.returns")} value={money(k.returns)} icon="fa-rotate-left"
             sub={t("rpt2.nReceipts", { n: k.returnReceipts })} />
        <Kpi label={t("rpt2.discount")} value={money(k.discount)} icon="fa-tags" />
        <Kpi label={t("rpt2.lossSales")} value={money(k.lossAmount)} icon="fa-arrow-trend-down"
             tone={num(k.lossAmount) > 0 ? "bad" : undefined}
             sub={t("rpt2.nReceipts", { n: k.lossSales })} />
      </div>

      <Panel title={t("rpt2.anomalies")} icon="fa-shield-halved" wide
             right={<span className="text-muted" style={{ fontSize: 12 }}>{t("rpt2.anomalyHint")}</span>}>
        <div className="card-body">
          {list.length ? (
            <div className="anom">
              {list.map((a, i) => (
                <div key={i} className={`anom__row anom--${a.severity}`}>
                  <i className={`fa-solid ${a.kind === "OFF_HOURS" ? "fa-moon"
                                : a.kind === "HIGH_RETURNS" ? "fa-rotate-left"
                                : a.kind === "HIGH_DISCOUNT" ? "fa-tags" : "fa-circle-xmark"}`}
                     aria-hidden="true" />
                  <div>
                    <b>{t(`rpt2.an.${a.kind}`)}</b>
                    {a.subjectName && <span className="anom__who">{a.subjectName}</span>}
                  </div>
                  <span className="mono anom__v">
                    {a.kind === "OFF_HOURS"
                      ? t("rpt2.nReceipts", { n: Math.round(num(a.value)) })
                      : <>{num(a.value).toFixed(1)}%
                          <small> · {t("rpt2.avgIs", { v: num(a.baseline).toFixed(1) })}</small></>}
                  </span>
                </div>
              ))}
            </div>
          ) : <Empty icon="fa-shield-halved" text={t("rpt2.noAnomalies")} />}
        </div>
      </Panel>
    </>
  );
}
