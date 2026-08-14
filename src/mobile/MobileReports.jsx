import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { reportApi } from "../api";
import { money } from "../utils";
import { paymentEntry } from "../lib/ek-labels";

/* Hisobot: kun / hafta / oy — KPI + to'lov turlari + top tovarlar. */
const PERIODS = ["daily", "weekly", "monthly"];

export default function MobileReports({ toast, branchId }) {
  const [period, setPeriod] = useState("daily");
  const [data, setData]     = useState(null);
  const [busy, setBusy]     = useState(true);

  const load = useCallback(() => {
    setBusy(true);
    reportApi[period](branchId)
      .then((r) => setData(r.data))
      .catch((e) => toast?.error(e.message))
      .finally(() => setBusy(false));
  }, [period, branchId, toast]);

  useEffect(() => { load(); }, [load]);

  const net = Number(data?.netProfit ?? 0);
  const rows = [
    [t("dash.revenue"),     money(data?.totalRevenue  || 0)],
    [t("dash.salesCount"),  String(data?.totalSales   ?? 0)],
    [t("rpt.grossProfit"),  money(data?.totalProfit   || 0)],
    [t("rpt.expenses"),     money(data?.totalExpenses || 0)],
    [t("rpt.inventoryLoss"),    money(data?.inventoryLoss || 0)],
  ];

  return (
    <div className="m-screen">
      <header className="m-head">
        <h1 className="m-head__title">{t("m.tab.reports")}</h1>
      </header>

      <div className="m-seg" role="tablist">
        {PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p}
                  className={period === p ? "active" : ""}
                  onClick={() => setPeriod(p)}>
            {t(`m.period.${p}`)}
          </button>
        ))}
      </div>

      <section className={`m-card ${busy ? "m-skel" : ""}`}>
        {rows.map(([label, value], i) => (
          <div key={i} className="m-row">
            <span>{label}</span>
            <b className="ek-num">{value}</b>
          </div>
        ))}
        <div className={`m-row m-row--net ${net < 0 ? "m-neg" : "m-pos"}`}>
          <span>{t("rpt.netProfit")}</span>
          <b className="ek-num">{money(net)}</b>
        </div>
      </section>

      <section className="m-card">
        <div className="m-card__title">
          <i className="fa-solid fa-wallet" aria-hidden="true" /> {t("dash.paymentTypes")}
        </div>
        {(data?.paymentSummary || []).length === 0 ? (
          <div className="m-empty">{t("dash.noPayments")}</div>
        ) : (
          data.paymentSummary.map((p, i) => {
            const e = paymentEntry(p.paymentType);
            return (
              <div key={i} className="m-row">
                <span><i className={`fa-solid ${e.icon || "fa-wallet"}`} style={{ color: e.color }} aria-hidden="true" /> {e.label}</span>
                <b className="ek-num">{money(p.amount)}</b>
              </div>
            );
          })
        )}
      </section>

      <section className="m-card">
        <div className="m-card__title">
          <i className="fa-solid fa-trophy" style={{ color: "var(--fg-warning)" }} aria-hidden="true" /> {t("dash.topProducts")}
        </div>
        {(data?.topProducts || []).length === 0 ? (
          <div className="m-empty">{t("dash.noSales")}</div>
        ) : (
          data.topProducts.slice(0, 5).map((p, i) => (
            <div key={i} className="m-row">
              <span className="m-row__trunc">{i + 1}. {p.productName}</span>
              <b className="ek-num">{money(p.totalRevenue)}</b>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
