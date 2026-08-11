import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
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
      text: t("dash.attOutOfStock"), count: outOfStock.length,
      onClick: () => navigate("/inventory"),
    },
    belowMin.length && {
      id: "low", icon: "fa-triangle-exclamation", tone: "warning",
      text: t("dash.attLowStock"), count: belowMin.length,
      onClick: () => navigate("/inventory"),
    },
    !data?.totalSales && {
      id: "nosale", icon: "fa-cash-register", tone: "info",
      text: t("dash.noSales"), onClick: () => navigate("/sale"),
    },
  ].filter(Boolean);

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12 }}>
        <h2 className="page-title">{t("dash.title")}</h2>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      {/* ── KPI qatori ────────────────────────────────────────────────────
          Raqamlar 0 dan sanaladi, monoshriftda — kenglik sakramaydi. */}
      {/* ⚠ `totalProfit` — YALPI foyda (tushum − tovar tannarxi). Ilgari u
          shu yerda "Sof foyda" deb turardi, holbuki ijara/oylik/transport
          undan ayirilmagan: bosh sahifa foydani haqiqiydan katta
          ko'rsatardi. Endi ikkalasi ham chiziladi va sof foyda manfiy
          bo'lsa qizil — oy zarar bilan ketayotgani eng muhim xabar. */}
      {loading ? <KpiSkeleton /> : (
        <div className="kpi-row">
          <Kpi label={t("dash.revenue")}    value={data?.totalRevenue  || 0} format={money} />
          <Kpi label={t("dash.salesCount")} value={data?.totalSales    || 0} />
          <Kpi label={t("rpt.grossProfit")} value={data?.totalProfit   || 0} format={money} />
          <Kpi label={t("rpt.expenses")}    value={data?.totalExpenses || 0} format={money} />
          <Kpi label={t("rpt.netProfit")}   value={data?.netProfit     || 0} format={money}
               danger={Number(data?.netProfit) < 0} />
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
              {t("dash.paymentTypes")}
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
              <Empty text={t("dash.noPayments")} />
            )}
          </div>
        </div>

        {/* Top mahsulotlar — summalar o'ngga tekislangan, monoshriftda */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-trophy" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />
              {t("dash.topProducts")}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{t("products.col")}</th>
                  <th className="num">{t("common.count")}</th>
                  <th className="num">{t("common.sum")}</th>
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
                  <tr><td colSpan={4}><Empty text={t("dash.noSales")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
