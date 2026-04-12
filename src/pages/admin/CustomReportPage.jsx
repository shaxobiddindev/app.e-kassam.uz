import { useState } from "react";
import { reportApi } from "../../api";
import { money } from "../../utils";
import { Loader, Empty, StatCard } from "../../components/ui";
import { BranchSelector } from "../../components";

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

export default function CustomReportPage({ toast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom]     = useState(today);
  const [to, setTo]         = useState(today);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [branchId, setBranchId] = useState(null);

  const handleSearch = async () => {
    if (!from || !to) { toast.error("Sanalarni kiriting"); return; }
    if (new Date(from) > new Date(to)) { toast.error("Boshlanish sanasi oxirgidan katta bo'lmasligi kerak"); return; }
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
            Maxsus hisobot
          </span>
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
        </div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Boshlanish sanasi</label>
              <input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tugash sanasi</label>
              <input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-search"}`} />
              {loading ? "Yuklanmoqda..." : "Hisobot olish"}
            </button>
            {data && (
              <button className="btn btn-outline btn-sm" onClick={() => { setData(null); setSearched(false); }}>
                <i className="fa-solid fa-times" /> Tozalash
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Natijalar */}
      {loading ? <Loader /> : searched && data ? (
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
                <span className="card-title"><i className="fa-solid fa-credit-card text-blue" />To'lov turlari</span>
              </div>
              <div className="card-body">
                {data.paymentSummary?.length ? data.paymentSummary.map((p, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span className="fw-700" style={{ fontSize: 13 }}>{PAYMENT_LABELS[p.paymentType] || p.paymentType}</span>
                    <span className="mono fw-700">{money(p.amount)}</span>
                  </div>
                )) : <Empty text="Ma'lumot yo'q" />}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fa-solid fa-trophy" style={{ color: "var(--yellow)" }} />Top mahsulotlar</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Mahsulot</th><th>Soni</th><th>Summa</th></tr></thead>
                  <tbody>
                    {data.topProducts?.length ? data.topProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="text-muted fw-800">{i + 1}</td>
                        <td className="fw-700">{p.productName}</td>
                        <td><span className="badge badge-blue">{p.totalQuantity}</span></td>
                        <td className="mono fw-700">{money(p.totalRevenue)}</td>
                      </tr>
                    )) : <tr><td colSpan={4}><Empty text="Ma'lumot yo'q" /></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : searched && !loading ? (
        <div className="card"><div className="card-body"><Empty icon="fa-chart-bar" text="Bu davr uchun ma'lumot topilmadi" /></div></div>
      ) : null}
    </div>
  );
}
