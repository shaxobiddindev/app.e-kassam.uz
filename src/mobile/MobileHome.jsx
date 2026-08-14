import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { reportApi, inventoryApi } from "../api";
import { BranchSelector } from "../components";
import { money } from "../utils";

/* Bosh ekran: BITTA savol — «bugun ishlar qanday?».
   Katta raqam (tushum) + uch kichik karta + «e'tibor talab qiladi». */
export default function MobileHome({ toast, branchId, setBranchId }) {
  const [data, setData]       = useState(null);
  const [signals, setSignals] = useState(null);
  const [low, setLow]         = useState([]);
  const [busy, setBusy]       = useState(true);

  const load = useCallback(() => {
    setBusy(true);
    Promise.all([
      reportApi.daily(branchId).then((r) => r.data).catch(() => null),
      reportApi.signals(branchId).then((r) => r.data).catch(() => null),
      inventoryApi.getLow().then((r) => r.data || []).catch(() => []),
    ]).then(([d, s, l]) => { setData(d); setSignals(s); setLow(l); })
      .finally(() => setBusy(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const sig = signals || {};
  const has = (row) => Number(row?.count) > 0;
  const attention = [
    has(sig.cashShortage) && { icon: "fa-sack-dollar", tone: "danger",
      text: t("dash.sigCashShort", { n: sig.cashShortage.count, d: sig.shiftWindowDays }),
      value: money(sig.cashShortage.amount) },
    has(sig.nonCashDiff) && { icon: "fa-credit-card", tone: "danger",
      text: t("dash.sigNonCashDiff", { n: sig.nonCashDiff.count }),
      value: money(sig.nonCashDiff.amount) },
    has(sig.stockShortage) && { icon: "fa-clipboard-list", tone: "danger",
      text: t("dash.sigStockShort", { n: sig.stockShortage.count, d: sig.stockWindowDays }),
      value: money(sig.stockShortage.amount) },
    sig.staleOpenShifts > 0 && { icon: "fa-clock", tone: "warning",
      text: t("dash.sigStaleShift"), value: sig.staleOpenShifts },
    low.filter((i) => (i.quantity ?? 0) <= 0).length > 0 && { icon: "fa-box-open", tone: "warning",
      text: t("m.outOfStock"), value: low.filter((i) => (i.quantity ?? 0) <= 0).length },
  ].filter(Boolean);

  const net = Number(data?.netProfit ?? 0);

  return (
    <div className="m-screen">
      <header className="m-head">
        <div>
          <div className="m-head__hi">{t("m.today")}</div>
          <h1 className="m-head__title">{t("m.homeTitle")}</h1>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </header>

      {/* Katta raqam — bugungi tushum. Egasining birinchi savoli shu. */}
      <div className={`m-hero ${busy ? "m-skel" : ""}`}>
        <div className="m-hero__label">{t("dash.revenue")}</div>
        <div className="m-hero__value ek-num">{busy ? " " : money(data?.totalRevenue || 0)}</div>
        <div className="m-hero__sub">
          <span><i className="fa-solid fa-receipt" aria-hidden="true" /> {data?.totalSales ?? 0} {t("m.salesShort")}</span>
          <span className={net < 0 ? "m-neg" : "m-pos"}>
            <i className={`fa-solid ${net < 0 ? "fa-arrow-trend-down" : "fa-arrow-trend-up"}`} aria-hidden="true" />
            {" "}{money(net)} {t("m.netShort")}
          </span>
        </div>
      </div>

      <div className="m-grid3">
        <div className="m-stat"><span>{t("rpt.grossProfit")}</span><b className="ek-num">{money(data?.totalProfit || 0)}</b></div>
        <div className="m-stat"><span>{t("rpt.expenses")}</span><b className="ek-num">{money(data?.totalExpenses || 0)}</b></div>
        <div className="m-stat"><span>{t("rpt.inventoryLoss")}</span><b className="ek-num">{money(data?.inventoryLoss || 0)}</b></div>
      </div>

      <section className="m-card">
        <div className="m-card__title">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />
          {t("m.attention")}
        </div>
        {attention.length === 0 ? (
          <div className="m-empty">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />
            {t("m.allGood")}
          </div>
        ) : (
          attention.map((a, i) => (
            <div key={i} className={`m-sig m-sig--${a.tone}`}>
              <i className={`fa-solid ${a.icon}`} aria-hidden="true" />
              <span className="m-sig__text">{a.text}</span>
              <b className="ek-num">{a.value}</b>
            </div>
          ))
        )}
      </section>

      <button type="button" className="m-refresh" onClick={load} disabled={busy}>
        <i className={`fa-solid fa-rotate ${busy ? "fa-spin" : ""}`} aria-hidden="true" /> {t("common.refresh")}
      </button>
    </div>
  );
}
