import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
import { reportApi } from "../api";
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

const STATS_CONFIG = [
  { key: "totalRevenue", label: t("rep.totalSales"),    icon: "fa-sack-dollar",    bg: "rgba(1,125,202,0.09)", color: "#017dca" },
  { key: "totalProfit",  label: t("dash.netProfit"),     icon: "fa-arrow-trend-up", bg: "#ecfdf5",              color: "#22c55e" },
  { key: "totalSales",   label: t("dash.salesCount"), icon: "fa-cart-shopping",  bg: "#fffbeb",              color: "#f59e0b" },
  { key: "totalCost",    label: t("dash.costPrice"),      icon: "fa-coins",          bg: "#fdf4ff",              color: "#9333ea" },
];

/* To'lov turi yorlig'i — CLICK va PAYME ham qamrab olinadi.
   Ilgari bu yerda uchta qiymatli mahalliy jadval bor edi va Click/Payme
   sotuvlarida xom `CLICK` matni chiqardi. */
function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

export default function ReportsPage({ toast }) {
  const [period, setPeriod]   = useState("daily");
  const [data, setData]       = useState(null);
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
        </>
      ) : null}
    </div>
  );
}
