import { useState } from "react";
import { t } from "../../lib/ek-i18n";
import { reportApi } from "../../api";
import { money } from "../../utils";
import { Empty, StatCard } from "../../components/ui";
import { BranchSelector } from "../../components";
import { paymentEntry } from "../../lib/ek-labels";
import { SkeletonCards, Spinner } from "../../components/ek/Loading";
import { useLoading } from "../../lib/use-loading";
import { DateField } from "../../components/ek/EkFields";

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

export default function CustomReportPage({ toast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom]     = useState(today);
  const [to, setTo]         = useState(today);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [searched, setSearched] = useState(false);
  const [branchId, setBranchId] = useState(null);

  const handleSearch = async () => {
    if (!from || !to) { toast.error(t("rep.needDates")); return; }
    if (new Date(from) > new Date(to)) { toast.error(t("rep.badRange")); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await reportApi.custom(
        new Date(from).toISOString(),
        new Date(to + "T23:59:59").toISOString(),
        branchId
      );
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Filter panel */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-calendar-days text-blue" />
            {t("nav.customReport")}
          </span>
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
        </div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t("rep.dateFrom")}</label>
              <DateField className="form-input ek-num" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t("rep.dateTo")}</label>
              <DateField className="form-input ek-num" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? <Spinner /> : <i className="fa-solid fa-search" />}
              {loading ? t("common.loading") : t("rep.run")}
            </button>
            {data && (
              <button className="btn btn-outline btn-sm" onClick={() => { setData(null); setSearched(false); }}>
                <i className="fa-solid fa-times" /> {t("common.reset")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Natijalar */}
      {busy ? <SkeletonCards count={4} className="stats-grid" /> : searched && data ? (
        <>
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
            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fa-solid fa-credit-card text-blue" />{t("dash.paymentTypes")}</span>
              </div>
              <div className="card-body">
                {data.paymentSummary?.length ? data.paymentSummary.map((p, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span className="fw-700" style={{ fontSize: 13 }}><PayLabel type={p.paymentType} /></span>
                    <span className="mono fw-700">{money(p.amount)}</span>
                  </div>
                )) : <Empty text={t("rep.noData")} />}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fa-solid fa-trophy" style={{ color: "var(--yellow)" }} />{t("dash.topProducts")}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>{t("products.col")}</th><th>{t("common.count")}</th><th>{t("common.sum")}</th></tr></thead>
                  <tbody>
                    {data.topProducts?.length ? data.topProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="text-muted fw-800">{i + 1}</td>
                        <td className="fw-700">{p.productName}</td>
                        <td><span className="badge badge-blue">{p.totalQuantity}</span></td>
                        <td className="mono fw-700">{money(p.totalRevenue)}</td>
                      </tr>
                    )) : <tr><td colSpan={4}><Empty text={t("rep.noData")} /></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : searched && !loading ? (
        <div className="card"><div className="card-body"><Empty icon="fa-chart-bar" text={t("rep.noPeriodData")} /></div></div>
      ) : null}
    </div>
  );
}
