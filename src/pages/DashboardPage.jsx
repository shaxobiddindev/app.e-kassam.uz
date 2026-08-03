import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { reportApi, inventoryApi } from "../api";
import { BranchSelector } from "../components";
import { Empty } from "../components/ui";
import { money } from "../utils";
import Kpi from "../components/ek/Kpi";
import AttentionList from "../components/ek/AttentionList";
import { paymentEntry } from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   Egasi/admin bosh sahifasi — 07-ADMIN.md

   Ekran bitta savolga javob beradi: "bugun ishlar qanday?"
   1) KPI qatori — raqamlar sanaladi
   2) "E'tibor talab qiladi" — panelning yuragi
   3) To'lov turlari va top mahsulotlar
   ══════════════════════════════════════════════════════════════════════════ */

/* To'lov turi yorlig'i — yagona lug'atdan (src/lib/ek-labels.js).
   ⚠ Ilgari bu sahifa `PAYMENT_LABELS` ni `../utils` dan import qilardi, lekin
   u yerda bunday eksport YO'Q edi: qiymat `undefined` bo'lib, birinchi sotuv
   satrida sahifa yiqilardi. */
function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

/** Kartochka shaklidagi skeleton — yuklanish tugagach layout sakramaydi. */
function KpiSkeleton() {
  return (
    <div className="kpi-row">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="kpi" key={i}>
          <span className="ek-skeleton" style={{ height: 11, width: "55%" }} />
          <span className="ek-skeleton" style={{ height: 26, width: "75%" }} />
          <span className="ek-skeleton" style={{ height: 11, width: "35%" }} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage({ toast }) {
  const [data, setData]         = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [branchId, setBranchId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportApi.daily(branchId).then((r) => r.data).catch((err) => { toast.error(err.message); return null; }),
      inventoryApi.getLow().then((r) => r.data || []).catch(() => []),
    ])
      .then(([daily, low]) => { setData(daily); setLowStock(low); })
      .finally(() => setLoading(false));
  }, [branchId]);

  /* ── E'tibor talab qiladi ─────────────────────────────────────────────── */
  const outOfStock = lowStock.filter((i) => (i.quantity ?? 0) <= 0);
  const belowMin   = lowStock.filter((i) => (i.quantity ?? 0) > 0);

  const attention = [
    outOfStock.length && {
      id: "out", icon: "fa-box-open", tone: "danger",
      text: "Tugagan tovar", count: outOfStock.length,
      onClick: () => navigate("/inventory"),
    },
    belowMin.length && {
      id: "low", icon: "fa-triangle-exclamation", tone: "warning",
      text: "Minimal qoldiqdan past", count: belowMin.length,
      onClick: () => navigate("/inventory"),
    },
    !data?.totalSales && {
      id: "nosale", icon: "fa-cash-register", tone: "info",
      text: "Bugun hali sotuv bo'lmadi", onClick: () => navigate("/sale"),
    },
  ].filter(Boolean);

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12 }}>
        <h2 className="page-title">Bugun ishlar qanday?</h2>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      {/* ── KPI qatori ────────────────────────────────────────────────────
          Raqamlar 0 dan sanaladi, monoshriftda — kenglik sakramaydi. */}
      {loading ? <KpiSkeleton /> : (
        <div className="kpi-row">
          <Kpi label="Bugungi tushum"  value={data?.totalRevenue || 0} format={money} />
          <Kpi label="Sotuvlar soni"   value={data?.totalSales   || 0} />
          <Kpi label="Sof foyda"       value={data?.totalProfit  || 0} format={money} />
          <Kpi label="Tan narxi"       value={data?.totalCost    || 0} format={money} />
        </div>
      )}

      {/* ── E'tibor talab qiladi ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <AttentionList items={loading ? [] : attention} />
      </div>

      <div className="grid-2c">
        {/* To'lov turlari */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-credit-card text-blue" aria-hidden="true" />
              To'lov turlari
            </span>
          </div>
          <div className="card-body">
            {data?.paymentSummary?.length ? (
              data.paymentSummary.map((p, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "10px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    <PayLabel type={p.paymentType} />
                  </span>
                  <span className="ek-num" style={{ fontWeight: 700 }}>{money(p.amount)}</span>
                </div>
              ))
            ) : (
              <Empty text="Bugun hali to'lov qayd etilmagan" />
            )}
          </div>
        </div>

        {/* Top mahsulotlar — summalar o'ngga tekislangan, monoshriftda */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-trophy" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />
              Top mahsulotlar
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Mahsulot</th>
                  <th className="num">Soni</th>
                  <th className="num">Summa, so'm</th>
                </tr>
              </thead>
              <tbody>
                {data?.topProducts?.length ? (
                  data.topProducts.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td className="ek-num text-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.productName}</td>
                      <td className="num">{p.totalQuantity}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{money(p.totalRevenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4}><Empty text="Bugun hali sotuv bo'lmadi" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
