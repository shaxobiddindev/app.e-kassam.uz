import { useState, useEffect } from "react";
import { reportApi } from "../api";
import { BranchSelector } from "../components";
import { Loader, StatCard, Empty } from "../components/ui";
import { money } from "../utils";

const STATS_CONFIG = [
  { key: "totalRevenue", label: "Bugungi savdo",  icon: "fa-sack-dollar",    bg: "rgba(1,125,202,0.09)", color: "#017dca" },
  { key: "totalProfit",  label: "Sof foyda",      icon: "fa-arrow-trend-up", bg: "#ecfdf5",              color: "#22c55e" },
  { key: "totalSales",   label: "Sotuvlar soni",  icon: "fa-cart-shopping",  bg: "#fffbeb",              color: "#f59e0b" },
  { key: "totalCost",    label: "Tan narxi",       icon: "fa-coins",          bg: "#fdf4ff",              color: "#9333ea" },
];

const PAYMENT_LABELS = { 
  CASH: <><i className="fa-solid fa-money-bill-1" /> Naqd</>, 
  CARD: <><i className="fa-solid fa-credit-card" /> Karta</>, 
  MIXED: <><i className="fa-solid fa-shuffle" /> Aralash</> 
};

export default function DashboardPage({ toast }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState(null);

  useEffect(() => {
    setLoading(true);
    reportApi.daily(branchId)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <Loader />;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Bugungi savdo holati</p>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      {/* Stat kartochkalar */}
      <div className="stats-grid">
        {STATS_CONFIG.map((cfg) => (
          <StatCard
            key={cfg.key}
            label={cfg.label}
            value={cfg.key === "totalSales" ? (data?.[cfg.key] || 0) : money(data?.[cfg.key])}
            icon={cfg.icon}
            bg={cfg.bg}
            color={cfg.color}
            change="Bugun"
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
            {data?.paymentSummary?.length ? (
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
              Top mahsulotlar
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
                {data?.topProducts?.length ? (
                  data.topProducts.slice(0, 5).map((p, i) => (
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
    </div>
  );
}
