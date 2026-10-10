import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { reportApi } from "../api";
import { money } from "../utils";
import { quantity } from "../lib/ek-format";
import { asArray } from "../lib/ek-array";
import { Kpi, Panel, PeriodBar, num } from "../components/report/RptUi";
import { Empty } from "../components/ui";
import { SkeletonCards, SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { periodRange, isoDay } from "../lib/ek-period";
import { sourceShares, growth, heatGrid, abcSummary } from "../lib/ek-restaurant-report";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «HISOBOT» (4-bosqich E6, 2026-10-10)

   Do'kon hisobotining o'rnida restoranning savollari: tushum qayerdan keldi
   (zal, olib ketish, yetkazish), tushumdan tashqari pul (xizmat haqi, choy
   puli), nima yo'qotildi, qaysi taom pul topyapti (ABC + tannarx ulushi),
   ofitsiantlar va zal qachon to'la.

   ⚠ Do'konning batafsil hisobotlari (`/reports`) yo'qolmaydi — «Batafsil
   hisobotlar» havolasi bor.
   ⚠ YANGI CSS YO'Q (44/44): hisobot klasslari + oddiy uslub. Bandlik
   kataklarining to'qligi `color-mix` bilan — faqat tokendan.
   ⚠ Rang yolg'iz signal emas: har katakda bandlik raqami yozilgan.
   ══════════════════════════════════════════════════════════════════════════ */
const FC = (v) => v == null ? "var(--fg-secondary)" : v <= 30 ? "var(--fg-success)" : v <= 36 ? "var(--fg-warning)" : "var(--fg-danger)";
const GROUP = {
  A: { bg: "var(--bg-success-subtle)", ink: "var(--fg-success)" },
  B: { bg: "var(--bg-brand-subtle)", ink: "var(--fg-brand)" },
  C: { bg: "var(--bg-danger-subtle)", ink: "var(--fg-danger)" },
};
const SRC_BG = { HALL: "var(--bg-brand)", TAKEAWAY: "var(--fg-success)", DELIVERY: "var(--fg-warning)", TILL: "var(--fg-secondary)" };
const dec1 = (v) => String(v).replace(".", ",");

export default function RestaurantReportPage({ toast }) {
  const [period, setPeriod] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [tab, setTab] = useState("main");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const range = useMemo(() => periodRange(period, new Date(), custom), [period, custom]);
  const from = isoDay(range.from);
  const to = isoDay(new Date(range.to.getTime() - 1));

  const load = useCallback(() => {
    setLoading(true);
    reportApi.restaurantReport(from, to)
      .then((r) => setD(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [from, to, toast]);
  useEffect(() => { load(); }, [load]);

  const g = d ? growth(d.revenue, d.revenuePrev) : null;
  const shares = sourceShares(asArray(d?.sources));
  const dishes = asArray(d?.dishes);
  const abc = abcSummary(dishes);
  const grid = heatGrid(asArray(d?.heat));
  const L = d?.losses || {};

  const sheets = () => [
    { name: t("rrep.t.main"), rows: [
      [{ v: `${t("rrep.title")}: ${from} — ${to}`, bold: true }], [],
      [t("rrep.k.revenue"), num(d?.revenue)], [t("rrep.k.guests"), num(d?.guests)], [t("rrep.k.perGuest"), num(d?.perGuest)],
      [t("rrep.k.turnover"), num(d?.turnover)], [t("rrep.k.fc"), d?.foodCostPct ?? ""], [t("rrep.k.late"), d?.latePct ?? ""], [],
      ...shares.map((s) => [t(`rrep.src.${s.kind}`), num(s.revenue), `${s.share}%`]), [],
      [t("rrep.service"), num(d?.serviceCharge)], [t("rrep.tips"), num(d?.tips)], [],
      [t("rrep.l.waste"), num(L.waste)], [t("rrep.l.count"), num(L.countShortage)],
      [t("rrep.l.returns", { n: L.returnsCount ?? 0 }), num(L.returns)], [t("rrep.l.cancel"), num(L.cancelledTables)],
    ] },
    { name: "ABC", rows: [
      [t("rrep.c.dish"), t("rrep.c.qty"), t("rrep.c.revenue"), t("rrep.c.profit"), t("rrep.c.fc"), t("rrep.c.group")].map((v) => ({ v, bold: true })),
      ...dishes.map((x) => [x.name, num(x.qty), num(x.revenue), num(x.profit), x.costPct ?? "", x.group]),
    ] },
    { name: t("rrep.t.waiters"), rows: [
      [t("rrep.c.waiter"), t("rrep.c.shifts"), t("rrep.c.tables"), t("rrep.c.guests"), t("rrep.c.revenue"), t("rrep.c.perGuest"), t("rrep.c.time"), t("rrep.c.tips"), t("rrep.c.cancel")].map((v) => ({ v, bold: true })),
      ...asArray(d?.waiters).map((w) => [w.name, w.shifts, w.tables, w.guests, num(w.revenue), num(w.perGuest), w.avgMinutes ?? "", num(w.tips), w.cancelled]),
    ] },
    { name: t("rrep.tablesQ"), rows: [
      [t("rrep.c.table"), t("rrep.c.orders"), t("rrep.c.turns"), t("rrep.c.revenue"), t("rrep.c.avgGuests")].map((v) => ({ v, bold: true })),
      ...asArray(d?.tables).map((x) => [x.name, x.orders, num(x.turnsPerDay), num(x.revenue), num(x.avgGuests)]),
    ] },
  ];

  const tabBtn = (on) => ({ minHeight: 44, padding: "0 14px", borderRadius: 12, fontWeight: 700,
    ...(on ? { background: "var(--bg-brand)", color: "var(--fg-on-brand)", borderColor: "transparent" } : {}) });
  const row = (label, value, ink) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, minHeight: 32, alignItems: "center", fontSize: 14 }}>
      <span>{label}</span><span className="ek-num fw-700" style={{ color: ink }}>{value}</span>
    </div>
  );

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("rrep.title")}</h2>
          <span className="text-muted ek-num">{from} — {to}</span>
        </div>
        <div className="rpt-bar__tools">
          <PeriodBar period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
          <ExcelButton name={`restoran-hisobot-${from}`} sheets={sheets} toast={toast} disabled={!d} />
          <Link to="/reports" className="btn btn-outline btn-sm" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            <i className="fa-solid fa-chart-pie" aria-hidden="true" />&nbsp;{t("rrep.allReports")}
          </Link>
        </div>
      </div>

      {busy || !d ? <SkeletonCards count={6} className="kpi-grid" /> : (
        <div className="kpi-grid">
          <Kpi label={t("rrep.k.revenue")} value={money(d.revenue)} icon="fa-sack-dollar" tone="brand"
               sub={g == null ? t("rrep.k.noPrev") : t(g >= 0 ? "rrep.k.up" : "rrep.k.down", { p: Math.abs(g) })} />
          <Kpi label={t("rrep.k.guests")} value={quantity(d.guests, 0)} icon="fa-users" sub={t("rrep.k.perDay", { n: Math.round(num(d.guests) / Math.max(1, d.days)) })} />
          <Kpi label={t("rrep.k.perGuest")} value={money(d.perGuest)} icon="fa-user" sub={t("rrep.k.avgCheck", { sum: money(d.avgCheck) })} />
          <Kpi label={t("rrep.k.turnover")} value={t("rrep.k.turnVal", { n: dec1(num(d.turnover)) })} icon="fa-chair" sub={t("rrep.k.turnSub")} />
          <Kpi label={t("rrep.k.fc")} value={d.foodCostPct != null ? `${dec1(d.foodCostPct)}%` : "—"} icon="fa-scale-balanced"
               tone={d.foodCostPct == null ? undefined : d.foodCostPct <= 35 ? "good" : "warn"} sub={t("rrep.k.fcSub")} />
          <Kpi label={t("rrep.k.late")} value={d.latePct != null ? `${dec1(d.latePct)}%` : "—"} icon="fa-fire-burner"
               tone={d.latePct != null && d.latePct > 10 ? "bad" : undefined} sub={t("rrep.k.lateSub")} />
        </div>
      )}

      <div role="tablist" aria-label={t("rrep.title")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["main", "waiters", "hall"].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="btn btn-outline btn-sm" style={tabBtn(tab === k)} onClick={() => setTab(k)}>
            {t(`rrep.t.${k}`)}
          </button>
        ))}
      </div>

      {busy || !d ? <SkeletonTable rows={8} cols={["wide", "num", "num", "num", "num", "text"]} /> : tab === "main" ? (
        <div className="rpt-cols">
          <Panel title={t("rrep.sources")} icon="fa-shop">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shares.length === 0 ? <Empty icon="fa-shop" text={t("rrep.noData")} /> : shares.map((s) => (
                <div key={s.kind} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                    <b>{t(`rrep.src.${s.kind}`)}</b>
                    <span className="ek-num">{t("rrep.srcLine", { sum: money(s.revenue), p: s.share, n: s.receipts })}</span>
                  </span>
                  <span style={{ display: "block", height: 10, borderRadius: 5, background: "var(--bg-sunken)" }}>
                    <span style={{ display: "block", height: 10, width: `${s.share}%`, borderRadius: 5, background: SRC_BG[s.kind] }} />
                  </span>
                </div>
              ))}
              <h4 style={{ margin: "8px 0 0" }}>{t("rrep.outside")}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {[["rrep.service", d.serviceCharge, "rrep.serviceSub"], ["rrep.tips", d.tips, "rrep.tipsSub"]].map(([k, v, sub]) => (
                  <div key={k} style={{ background: "var(--bg-sunken)", borderRadius: 12, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>{t(k)}</span>
                    <span className="ek-num fw-700" style={{ fontSize: 18 }}>{money(v)}</span>
                    <span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>{t(sub)}</span>
                  </div>
                ))}
              </div>
              <h4 style={{ margin: "8px 0 0" }}>{t("rrep.losses")}</h4>
              <div>
                {row(t("rrep.l.waste"), money(L.waste), num(L.waste) > 0 ? "var(--fg-danger)" : undefined)}
                {row(t("rrep.l.count"), money(L.countShortage), num(L.countShortage) > 0 ? "var(--fg-danger)" : undefined)}
                {row(t("rrep.l.returns", { n: L.returnsCount ?? 0 }), money(L.returns))}
                {row(t("rrep.l.cancel"), t("rrep.l.cancelVal", { n: L.cancelledTables ?? 0 }))}
              </div>
            </div>
          </Panel>

          <Panel title={t("rrep.abc")} icon="fa-bowl-food" right={<span className="text-muted" style={{ fontSize: 12 }}>{t("rrep.abcHint")}</span>}>
            <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["A", "B", "C"].map((k) => (
                <span key={k} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: GROUP[k].bg, color: GROUP[k].ink }}>
                  {t("rrep.abcLine", { g: k, n: abc[k].n, sum: money(abc[k].revenue) })}
                </span>
              ))}
            </div>
            {dishes.length === 0 ? <div className="card-body"><Empty icon="fa-bowl-food" text={t("rrep.noData")} /></div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>{t("rrep.c.dish")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.qty")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.revenue")}</th>
                    <th style={{ textAlign: "right" }}>{t("rrep.c.profit")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.fc")}</th><th>{t("rrep.c.group")}</th>
                  </tr></thead>
                  <tbody>
                    {dishes.map((x) => (
                      <tr key={x.productId ?? x.name}>
                        <td className="fw-700">{x.name}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{quantity(x.qty)}</td>
                        <td className="ek-num fw-700" style={{ textAlign: "right" }}>{money(x.revenue)}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{money(x.profit)}</td>
                        <td className="ek-num fw-700" style={{ textAlign: "right", color: FC(x.costPct) }}>{x.costPct != null ? `${dec1(x.costPct)}%` : "—"}</td>
                        <td><span style={{ display: "inline-flex", minWidth: 26, justifyContent: "center", padding: "2px 8px", borderRadius: 8, fontWeight: 800, background: GROUP[x.group]?.bg, color: GROUP[x.group]?.ink }}>{x.group}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : tab === "waiters" ? (
        <Panel title={t("rrep.waitersQ")} icon="fa-user-tie">
          {asArray(d.waiters).length === 0 ? <div className="card-body"><Empty icon="fa-user-tie" text={t("rrep.noData")} /></div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>{t("rrep.c.waiter")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.shifts")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.tables")}</th>
                  <th style={{ textAlign: "right" }}>{t("rrep.c.guests")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.revenue")}</th>
                  <th style={{ textAlign: "right" }}>{t("rrep.c.perGuest")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.time")}</th>
                  <th style={{ textAlign: "right" }}>{t("rrep.c.tips")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.cancel")}</th>
                </tr></thead>
                <tbody>
                  {asArray(d.waiters).map((w) => (
                    <tr key={w.login || w.name}>
                      <td className="fw-700">{w.name}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{w.shifts}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{w.tables}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{w.guests}</td>
                      <td className="ek-num fw-700" style={{ textAlign: "right" }}>{money(w.revenue)}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{money(w.perGuest)}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{w.avgMinutes != null ? t("rrep.min", { n: w.avgMinutes }) : "—"}</td>
                      <td className="ek-num" style={{ textAlign: "right" }}>{num(w.tips) ? money(w.tips) : "—"}</td>
                      <td className="ek-num fw-700" style={{ textAlign: "right", color: w.cancelled >= 5 ? "var(--fg-danger)" : undefined }}>{w.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <div className="rpt-cols">
          <Panel title={t("rrep.heat")} icon="fa-table-cells">
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 11 }}>
                <thead><tr>
                  <th />
                  {grid.hours.map((h) => <th key={h} className="ek-num" style={{ fontWeight: 600, color: "var(--fg-secondary)", padding: "0 2px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {grid.rows.map((r) => (
                    <tr key={r.dow}>
                      <th style={{ fontWeight: 700, paddingRight: 6, textAlign: "left" }}>{t(`rrep.dow.${r.dow}`)}</th>
                      {r.cells.map((v, i) => (
                        <td key={i} className="ek-num" title={`${t(`rrep.dow.${r.dow}`)} ${grid.hours[i]}:00 — ${v}%`}
                            style={{ width: 34, height: 30, textAlign: "center", borderRadius: 6, fontWeight: 700,
                                     background: v ? `color-mix(in srgb, var(--bg-brand) ${10 + Math.round(v * 0.85)}%, transparent)` : "var(--bg-sunken)",
                                     color: v >= 55 ? "var(--fg-on-brand)" : "var(--fg-primary)" }}>
                          {v || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>{t("rrep.heatHint")}</p>
            </div>
          </Panel>
          <Panel title={t("rrep.tablesQ")} icon="fa-chair">
            {asArray(d.tables).length === 0 ? <div className="card-body"><Empty icon="fa-chair" text={t("rrep.noData")} /></div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>{t("rrep.c.table")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.orders")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.turns")}</th>
                    <th style={{ textAlign: "right" }}>{t("rrep.c.revenue")}</th><th style={{ textAlign: "right" }}>{t("rrep.c.avgGuests")}</th>
                  </tr></thead>
                  <tbody>
                    {asArray(d.tables).map((x) => (
                      <tr key={x.id}>
                        <td className="fw-700">{x.name}{x.seats ? <span className="text-muted" style={{ fontWeight: 400 }}> · {x.seats}</span> : null}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{x.orders}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{dec1(num(x.turnsPerDay))}</td>
                        <td className="ek-num fw-700" style={{ textAlign: "right" }}>{money(x.revenue)}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{x.avgGuests != null ? dec1(x.avgGuests) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
