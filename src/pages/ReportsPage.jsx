import { useState, useEffect } from "react";
import { reportApi } from "../api";
import { BranchSelector } from "../components";
import { Loader, Empty, StatCard } from "../components/ui";
import { money } from "../utils";

const PERIODS = [
  { key: "daily",   label: "Bugun" },
  { key: "weekly",  label: "Hafta" },
  { key: "monthly", label: "Oy" },
];

const STATS_CONFIG = [
  { key: "totalRevenue", label: "Jami savdo",    icon: "fa-sack-dollar",    bg: "rgba(1,125,202,0.09)", color: "#017dca" },
  { key: "totalProfit",  label: "Sof foyda",     icon: "fa-arrow-trend-up", bg: "#ecfdf5",              color: "#22c55e" },
  { key: "totalSales",   label: "Sotuvlar soni", icon: "fa-cart-shopping",  bg: "#fffbeb",              color: "#f59e0b" },
  { key: "totalCost",    label: "Tan narxi",      icon: "fa-coins",          bg: "#fdf4ff",              color: "#9333ea" },
];

const PAYMENT_LABELS = { 
  CASH: <><i className="fa-solid fa-money-bill-1" /> Naqd</>, 
  CARD: <><i className="fa-solid fa-credit-card" /> Karta</>, 
  MIXED: <><i className="fa-solid fa-shuffle" /> Aralash</> 
};

export default function ReportsPage({ toast }) {
  const [period, setPeriod]   = useState("daily");
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
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

      {loading ? (
        <Loader />
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
                  To'lov turlari
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
                        {PAYMENT_LABELS[p.paymentType] || p.paymentType}
                      </span>
                      <span className="mono fw-700">{money(p.amount)}</span>
                    </div>
                  ))
                ) : (
                  <Empty text="Ma'lumot yo'q" />
                )}
              </div>
            </div>

            {/* Top mahsulotlar */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <i className="fa-solid fa-trophy" style={{ color: "var(--yellow)" }} />
                  Top 10 mahsulot
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mahsulot</th>
                      <th>Soni</th>
                      <th>Summa</th>
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
                          <Empty text="Ma'lumot yo'q" />
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
