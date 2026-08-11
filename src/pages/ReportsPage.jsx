import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
import { reportApi, inventoryApi } from "../api";
import { BranchSelector } from "../components";
import { Empty, StatCard } from "../components/ui";
import { money } from "../utils";
import { paymentEntry } from "../lib/ek-labels";
import { SkeletonCards } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

const PERIODS = [
  { key: "daily",   label: t("rep.today") },
  { key: "weekly",  label: t("rep.week") },
  { key: "monthly", label: t("rep.month") },
];

/* ⚠ `totalProfit` endi YALPI foyda deb ataladi va yonida SOF foyda turadi.
   Ilgari u "Sof foyda" deb ko'rsatilardi, holbuki ijara/oylik/transport
   umuman ayirilmasdi — raqam haqiqiydan katta chiqib, zarar ko'rilayotgan
   oy foydali bo'lib ko'rinardi. */
const STATS_CONFIG = [
  { key: "totalRevenue",  label: t("rep.totalSales"),     icon: "fa-sack-dollar",     bg: "rgba(1,125,202,0.09)", color: "#017dca" },
  { key: "totalProfit",   label: t("rpt.grossProfit"),    icon: "fa-arrow-trend-up",  bg: "#ecfdf5",              color: "#22c55e" },
  { key: "totalExpenses", label: t("rpt.expenses"),       icon: "fa-money-bill-wave", bg: "#fef2f2",              color: "#ef4444" },
  /* ⚠ Ombor yo'qotishi SOF FOYDADAN OLDIN turadi: u ham ayiriladigan
     raqam va sof foyda nega kamayganini o'sha yerdan ko'rish kerak.
     Usiz egasi «foyda tushib ketibdi» deb, sababini qidirib yurardi. */
  { key: "inventoryLoss", label: t("rpt.inventoryLoss"),  icon: "fa-trash-can",       bg: "#fff7ed",              color: "#f97316", hint: t("rpt.inventoryLossHint") },
  { key: "netProfit",     label: t("rpt.netProfit"),      icon: "fa-wallet",          bg: "#eff6ff",              color: "#3b82f6", hint: t("rpt.netProfitHint") },
  { key: "totalSales",    label: t("dash.salesCount"),    icon: "fa-cart-shopping",   bg: "#fffbeb",              color: "#f59e0b" },
  { key: "totalCost",     label: t("dash.costPrice"),     icon: "fa-coins",           bg: "#fdf4ff",              color: "#9333ea" },
];

/* To'lov turi yorlig'i — CLICK va PAYME ham qamrab olinadi.
   Ilgari bu yerda uchta qiymatli mahalliy jadval bor edi va Click/Payme
   sotuvlarida xom `CLICK` matni chiqardi. */
function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

/** Naqdsiz turlar — bank yoki provayder bilan solishtiriladigan qism.
    ⚠ `CREDIT` bu yerda YO'Q: nasiya to'lov emas, qarz — solishtiradigan
    tashqi raqami yo'q (backenddagi `PaymentSplitter.NON_CASH` bilan bir xil). */
const NON_CASH = ["CARD", "CLICK", "PAYME"];

/* Davr chegaralari — BACKEND bilan AYNAN bir xil hisoblanadi
   (`ReportService`: MAHALLIY sutka boshi). Boshqacha hisoblansa, bitta
   sahifadagi ikkita kartochka har xil davrni ko'rsatib, farqning sababi
   topilmasdi.

   ⚠ Ilgari bu yerda ham, backendda ham sutka boshi UTC deb olinardi:
   `Date.UTC(yil, oy, kun)`. Mahalliy 00:00–05:00 oralig'ida bu KELAJAK
   lahzasini berardi va oraliq teskari bo'lib, hisobot bo'm-bo'sh
   chiqardi. Endi mahalliy sutka boshi — brauzer mintaqasi do'kon
   mintaqasi bilan bir xil. */
function periodRange(period) {
  const now = new Date();
  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().replace(/\.\d{3}/, "");
  if (period === "weekly") {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    return [startOfDay(d), now.toISOString().replace(/\.\d{3}/, "")];
  }
  if (period === "monthly") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return [startOfDay(d), now.toISOString().replace(/\.\d{3}/, "")];
  }
  return [startOfDay(now), now.toISOString().replace(/\.\d{3}/, "")];
}

/**
 * Davr chegaralari SANA sifatida (YYYY-MM-DD) — chiqit hisoboti uchun.
 *
 * ⚠ `periodRange` dan alohida: u ISO lahzalarni UTC da beradi, chiqit
 * hisoboti esa do'kon kalendari bilan ishlaydi. Ikkalasini aralashtirsak,
 * kechqurun ochilgan «bugun» hisoboti ertangi kunni ko'rsatib qo'yardi.
 */
function periodDates(period) {
  const now = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "weekly") {
    const from = new Date(now); from.setDate(now.getDate() - 6);
    return [iso(from), iso(now)];
  }
  if (period === "monthly") {
    return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
  }
  return [iso(now), iso(now)];
}

export default function ReportsPage({ toast }) {
  const [period, setPeriod]   = useState("daily");
  const [data, setData]       = useState(null);
  const [cashiers, setCashiers] = useState(null);
  const [writeOffs, setWriteOffs] = useState(null);
  const [loading, setLoading] = useState(false);
  // Tez javobda skeleton umuman chizilmaydi; chizilsa kamida 400ms turadi.
  const busy = useLoading(loading);
  const [branchId, setBranchId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const fetcher = { daily: reportApi.daily, weekly: reportApi.weekly, monthly: reportApi.monthly };
    fetcher[period](branchId)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));

    /* Kassirlar taqqoslashi ALOHIDA so'rov: u yiqilsa ham asosiy hisobot
       chiziladi. Xatosi ham ko'rsatilmaydi — bu qo'shimcha panel, uning
       yo'qligi sahifani ishlatishga xalaqit bermaydi. */
    const [from, to] = periodRange(period);
    reportApi.byCashier(from, to, branchId)
      .then((res) => setCashiers(res.data))
      .catch(() => setCashiers(null));

    /* Chiqit ham qo'shimcha panel — u yiqilsa asosiy hisobot chiziladi. */
    const [dFrom, dTo] = periodDates(period);
    inventoryApi.writeOffs(dFrom, dTo)
      .then((res) => setWriteOffs(res.data))
      .catch(() => setWriteOffs(null));
  }, [period, branchId]);

  return (
    <div>
      {/* Period tabs and Branch selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`btn btn-sm ${period === p.key ? "btn-primary" : "btn-outline"}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      {busy ? (
        /* Hisobot KPI kartochkalari shaklida — kelayotgan kontent shu shaklda */
        <SkeletonCards count={4} className="stats-grid" />
      ) : data ? (
        <>
          {/* Stat kartochkalar */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            {STATS_CONFIG.map((cfg) => (
              <StatCard
                key={cfg.key}
                label={cfg.label}
                value={cfg.key === "totalSales" ? (data[cfg.key] || 0) : money(data[cfg.key])}
                icon={cfg.icon}
                bg={cfg.bg}
                color={cfg.color}
                /* Sof foyda MANFIY bo'lishi mumkin va aynan shunda ko'zga
                   tashlanishi kerak — oy zarar bilan ketayotgani eng muhim
                   xabar. */
                valueColor={cfg.key === "netProfit" && Number(data.netProfit) < 0 ? "var(--fg-danger)" : undefined}
                hint={cfg.hint}
              />
            ))}
          </div>

          <div className="grid-2c">
            {/* To'lov turlari */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fa-solid fa-credit-card text-blue" />
                  {t("dash.paymentTypes")}
                </span>
              </div>
              <div className="card-body">
                {data.paymentSummary?.length ? (
                  data.paymentSummary.map((p, i, arr) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span className="fw-700" style={{ fontSize: 13 }}>
                        <PayLabel type={p.paymentType} />
                      </span>
                      <span className="mono fw-700">{money(p.amount)}</span>
                    </div>
                  ))
                ) : (
                  <Empty text={t("rep.noData")} />
                )}
              </div>
            </div>

            {/* Top mahsulotlar */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fa-solid fa-trophy" style={{ color: "var(--yellow)" }} />
                  {t("rep.top10")}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("products.col")}</th>
                      <th>{t("common.count")}</th>
                      <th>{t("common.sum")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts?.length ? (
                      data.topProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="text-muted fw-800">{i + 1}</td>
                          <td className="fw-700">{p.productName}</td>
                          <td><span className="badge badge-blue">{p.totalQuantity}</span></td>
                          <td className="mono fw-700">{money(p.totalRevenue)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>
                          <Empty text={t("rep.noData")} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Naqdsiz jamlama ───────────────────────────────────────────
              Bu kartochka bitta ish uchun: egasi shu raqamlarni bank
              ilovasi va Click/Payme kabineti bilan solishtiradi. To'lov
              turini kassir QO'LDA tanlaydi, ya'ni naqdni "karta" deb yozib
              pulni olib qolish mumkin — mos kelmaslik aynan shuni ochadi. */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-building-columns text-blue" />
                {t("rpt.nonCashTotals")}
              </span>
            </div>
            <div className="card-body">
              <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
                {t("rpt.nonCashCompareHint")}
              </p>
              {(() => {
                const rows = (data.paymentSummary || []).filter((p) => NON_CASH.includes(p.paymentType));
                if (!rows.length) return <Empty text={t("rep.noData")} />;
                const total = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
                return (
                  <>
                    {rows.map((p) => (
                      <div key={p.paymentType} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                        <span className="fw-700" style={{ fontSize: 13 }}><PayLabel type={p.paymentType} /></span>
                        <span className="mono fw-700">{money(p.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                      <span className="fw-800">{t("common.total")}</span>
                      <span className="mono fw-800">{money(total)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── Kassirlar taqqoslash ─────────────────────────────────────
              Terminal integratsiyasi yo'q ekan, ikkinchi nazorat — NAQSH:
              bir xil smenalarda ishlagan kassirlarning naqdsiz ulushi
              bir-biriga yaqin bo'lishi kerak. */}
          {cashiers?.rows?.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-header">
                <span className="card-title">
                  <i className="fa-solid fa-users-between-lines text-blue" />
                  {t("rpt.byCashier")}
                </span>
                <span className="text-muted mono" style={{ fontSize: 13 }}>
                  {t("rpt.shopAverage")}: {cashiers.shopNonCashShare}%
                </span>
              </div>
              <div className="card-body" style={{ paddingBottom: 0 }}>
                <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
                  {t("rpt.cashierHint")}
                </p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("sales.colCashier")}</th>
                      <th>{t("dash.salesCount")}</th>
                      <th>{t("common.sum")}</th>
                      <th>{t("rpt.nonCashShare")}</th>
                      <th>{t("rpt.deviation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashiers.rows.map((r) => {
                      // 10 foizdan katta chetlanish ajratiladi. Bu AYBLOV
                      // emas — kassir kunning kartali qismida ishlagan
                      // bo'lishi ham mumkin; qolganini egasi hal qiladi.
                      const far = Math.abs(Number(r.deviation)) >= 10;
                      return (
                        <tr key={r.userId}>
                          <td className="fw-700">{r.fullName}</td>
                          <td className="mono">{r.salesCount}</td>
                          <td className="mono fw-700">{money(r.total)}</td>
                          <td className="mono">{r.nonCashShare}%</td>
                          <td className="mono fw-700"
                              style={far ? { color: "var(--fg-danger)" } : undefined}>
                            {Number(r.deviation) > 0 ? "+" : ""}{r.deviation}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Chiqit ───────────────────────────────────────────────────
              «Shu oy sinishga qancha ketdi» — ilgari bu savolga javob
              yo'q edi: sabab erkin matn bo'lgani uchun yig'ib bo'lmasdi.

              ⚠ Sanoq kamomadi bu yerda YO'Q va bu ataylab: bu jadval
              BILIB TURIB chiqarilgan tovar, sanoq kamomadi esa hech kim
              sezmagan holda yo'qolgani. Ularni qo'shish ikkala savolni
              ham yo'q qilardi. */}
          {writeOffs?.rows?.length > 0 && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-header">
                <span className="card-title">
                  <i className="fa-solid fa-trash-can" style={{ color: "var(--fg-warning)" }} />
                  {t("rpt.writeOffs")}
                </span>
                <span className="mono fw-800" style={{ fontSize: 15, color: "var(--fg-danger)" }}>
                  {money(writeOffs.lossTotal)}
                </span>
              </div>
              <div className="card-body" style={{ paddingBottom: 0 }}>
                <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
                  {t("rpt.writeOffsHint")}
                </p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("inv.writeOffReason")}</th>
                      <th className="num">{t("common.count")}</th>
                      <th className="num">{t("rpt.atCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writeOffs.rows.map((r) => (
                      <tr key={r.reason}>
                        <td className="fw-700">
                          {t(`enum.writeOff.${r.reason}`)}
                          {/* Hisob tuzatishi yo'qotish EMAS — jamiga
                              kirmagani shu yerda ham aytiladi. */}
                          {r.reason === "RECOUNT" && (
                            <span className="text-muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                              {t("rpt.notALoss")}
                            </span>
                          )}
                        </td>
                        <td className="num mono">{r.quantity}</td>
                        <td className="num mono fw-700">{money(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {writeOffs.topProducts?.length > 0 && (
                <div className="card-body" style={{ paddingTop: 14 }}>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 700 }}>
                    {t("rpt.writeOffTop")}
                  </div>
                  {writeOffs.topProducts.slice(0, 5).map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", gap: 12,
                      padding: "6px 0", fontSize: 13,
                    }}>
                      <span>{p.productName}</span>
                      <span className="mono fw-700">{money(p.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
