import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { reportApi } from "../api";
import { money } from "../utils";
import { quantity, time } from "../lib/ek-format";
import { unitLabel } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { Kpi, Panel, num } from "../components/report/RptUi";
import { SkeletonCards } from "../components/ek/Loading";
import { Empty } from "../components/ui";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { todayIso, shiftDay } from "../lib/ek-day-report";
import { hourWindow, changeText } from "../lib/ek-restaurant-today";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «BUGUN» (4-bosqich E2, 2026-10-10)

   Restoran egasi yoki menejeri ochganda birinchi ko'radigan sahifa — do'kon
   bosh sahifasining o'rnida. O'lchovlar restoranniki: mehmon boshiga chek,
   band stollar va aylanma, oshxona kechikishi, ofitsiantlar.

   ⚠ YANGILANISH FAQAT TUGMA BILAN (egasi 2026-10-08).
   ⚠ YANGI CSS YO'Q (44/44): hisobot klasslari + oddiy uslub.
   ⚠ Rang yolg'iz signal emas: diqqat qatorlarida doim matn bor.
   ══════════════════════════════════════════════════════════════════════════ */
const ALERT = {
  LATE:  { to: "/kitchen",    bg: "var(--bg-danger-subtle)",  bd: "var(--border-danger)",   ink: "var(--fg-danger)" },
  BILL:  { to: "/restaurant", bg: "var(--bg-warning-subtle)", bd: "var(--border-warning)", ink: "var(--fg-warning)" },
  STOCK: { to: "/ingredients",  bg: "var(--bg-warning-subtle)", bd: "var(--border-warning)", ink: "var(--fg-warning)" },
  STOP:  { to: "/menu",       bg: "var(--bg-warning-subtle)", bd: "var(--border-warning)", ink: "var(--fg-warning)" },
  RESV:  { to: "/restaurant", bg: "var(--bg-sunken)",         bd: "var(--border-strong)",  ink: "var(--fg-primary)" },
};

export default function RestaurantTodayPage({ toast }) {
  const [date, setDate] = useState(todayIso);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);

  const load = useCallback(() => {
    setLoading(true);
    reportApi.restaurantToday(date)
      .then((r) => setD(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [date, toast]);
  useEffect(() => { load(); }, [load]);

  const isToday = date === todayIso();
  const hours = d ? hourWindow(asArray(d.hours)) : [];
  const maxRev = Math.max(1, ...hours.map((h) => num(h.revenue)));
  const alerts = asArray(d?.alerts);
  const change = d ? changeText(d.revenue, d.revenueLastWeek) : null;

  const alertText = (a) => {
    if (a.kind === "LATE") return { title: t("rtd.a.late", { table: a.title }), text: a.text || "", when: t("tbl.minutes", { n: a.minutes }) };
    if (a.kind === "BILL") return { title: t("rtd.a.bill", { table: a.title }), text: t("rtd.a.billText", { sum: money(a.text) }), when: t("tbl.minutes", { n: a.minutes }) };
    if (a.kind === "STOP") return { title: t("rtd.a.stop", { name: a.title }), text: a.text ? t("rtd.a.stopBy", { who: a.text }) : "", when: a.at ? time(a.at) : "" };
    if (a.kind === "STOCK") return { title: t("rtd.a.stock", { name: a.title }), text: t("rtd.a.stockText"), when: `${quantity(a.text)} ${unitLabel(a.unit)}` };
    return { title: t("rtd.a.resv", { table: a.title }), text: [a.text, a.guests ? t("rtd.guestsN", { n: a.guests }) : ""].filter(Boolean).join(" · "), when: time(a.at) };
  };

  const sheets = () => [
    { name: t("rtd.title"), rows: [
      [{ v: t("rtd.title"), bold: true }, date], [],
      [t("rtd.k.revenue"), num(d?.revenue)], [t("rtd.k.guests"), num(d?.guests)], [t("rtd.k.perGuest"), num(d?.perGuest)],
      [t("rtd.k.avgCheck"), num(d?.avgCheck)], [t("rtd.k.tables"), `${num(d?.tablesBusy)} / ${num(d?.tablesTotal)}`],
      [t("rtd.k.turnover"), num(d?.turnover)], [t("rtd.tips"), num(d?.tips)], [t("rtd.service"), num(d?.serviceCharge)],
    ] },
    { name: t("rtd.hours"), rows: [[{ v: t("day.hour"), bold: true }, { v: t("rtd.k.revenue"), bold: true }, { v: t("rtd.occupancy"), bold: true }],
      ...hours.map((h) => [`${h.hour}:00`, num(h.revenue), num(h.occupancy)])] },
    { name: t("rtd.dishes"), rows: [[{ v: t("rtd.dish"), bold: true }, { v: t("rtd.qty"), bold: true }, { v: t("rtd.k.revenue"), bold: true }],
      ...asArray(d?.dishes).map((x) => [x.name, num(x.qty), num(x.revenue)])] },
    { name: t("rtd.waiters"), rows: [[t("rtd.waiter"), t("rtd.tablesCol"), t("rtd.k.guests"), t("rtd.k.revenue"), t("rtd.k.avgCheck"), t("rtd.tips")].map((v) => ({ v, bold: true })),
      ...asArray(d?.waiters).map((w) => [w.name, num(w.tables), num(w.guests), num(w.revenue), num(w.avgCheck), num(w.tips)])] },
  ];

  const pill = (on) => ({ minHeight: 44, padding: "0 16px", borderRadius: 12, fontWeight: 700,
    ...(on ? { background: "var(--bg-brand)", color: "var(--fg-on-brand)", border: 0 } : {}) });

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t(isToday ? "rtd.title" : "rtd.titleDay")}</h2>
          <span className="text-muted ek-num">{date}</span>
        </div>
        <div className="rpt-bar__tools">
          {[["today", todayIso()], ["yday", shiftDay(todayIso(), -1)]].map(([k, v]) => (
            <button key={k} type="button" className="btn btn-outline btn-sm" aria-pressed={date === v}
                    style={pill(date === v)} onClick={() => setDate(v)}>
              {t(k === "today" ? "day.today" : "rtd.yesterday")}
            </button>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={load}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
          <ExcelButton name={`restoran-bugun-${date}`} sheets={sheets} toast={toast} disabled={!d} />
        </div>
      </div>

      {busy || !d ? <SkeletonCards count={5} className="kpi-grid" /> : (
        <>
          <div className="kpi-grid">
            <Kpi label={t("rtd.k.revenue")} value={money(d.revenue)} icon="fa-sack-dollar" tone="brand"
                 sub={change ? t(change.up ? "rtd.up" : "rtd.down", { p: change.pct }) : t("rtd.noCompare")} />
            <Kpi label={t("rtd.k.guests")} value={quantity(d.guests, 0)} icon="fa-users" sub={t("rtd.checksN", { n: num(d.receipts) })} />
            <Kpi label={t("rtd.k.perGuest")} value={money(d.perGuest)} icon="fa-user" sub={t("rtd.avgCheck", { sum: money(d.avgCheck) })} />
            <Kpi label={t("rtd.k.tables")} value={isToday ? `${num(d.tablesBusy)} / ${num(d.tablesTotal)}` : num(d.tablesClosed)} icon="fa-chair"
                 sub={t("rtd.turnover", { n: String(num(d.turnover)).replace(".", ",") })} />
            <Kpi label={t("rtd.k.kitchen")} value={isToday ? t("rtd.ordersN", { n: num(d.kitchenOpen) }) : "—"} icon="fa-fire-burner"
                 tone={num(d.kitchenLate) > 0 ? "bad" : undefined}
                 sub={num(d.kitchenLate) > 0 ? t("rtd.lateN", { n: num(d.kitchenLate) })
                   : d.cookMinutes != null ? t("rtd.cookMin", { n: d.cookMinutes }) : ""} />
          </div>

          <div className="rpt-cols">
            <Panel title={t("rtd.hours")} icon="fa-clock">
              <div className="card-body">
                {hours.length === 0 ? <Empty icon="fa-clock" text={t("rpt2.noData")} /> : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 200, borderBottom: "1px solid var(--border-subtle)" }}>
                      {hours.map((h) => (
                        <div key={h.hour} title={`${h.hour}:00 — ${money(h.revenue)} · ${h.occupancy}%`}
                             style={{ flex: "1 1 0", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                          <span className="ek-num" style={{ fontSize: 10, fontWeight: h.occupancy >= 90 ? 700 : 500, color: h.occupancy >= 90 ? "var(--fg-warning)" : "var(--fg-secondary)" }}>
                            {h.occupancy ? `${h.occupancy}%` : ""}
                          </span>
                          <div style={{ width: "100%", maxWidth: 34, height: `calc(${(num(h.revenue) / maxRev) * 80}% + 2px)`, borderRadius: "6px 6px 0 0", background: "var(--bg-brand)" }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      {hours.map((h) => <span key={h.hour} className="ek-num" style={{ flex: "1 1 0", textAlign: "center", fontSize: 11, color: "var(--fg-secondary)" }}>{h.hour}</span>)}
                    </div>
                    <p className="text-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>{t("rtd.hoursHint")}</p>
                  </>
                )}
              </div>
            </Panel>

            <Panel title={t("rtd.attention")} icon="fa-bell">
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.length === 0 ? (
                  <p className="text-muted" style={{ margin: 0 }}><i className="fa-solid fa-check" aria-hidden="true" /> {t("rtd.allGood")}</p>
                ) : alerts.map((a, i) => {
                  const s = ALERT[a.kind] || ALERT.RESV;
                  const x = alertText(a);
                  return (
                    <Link key={i} to={s.to} style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 48, padding: "8px 12px", borderRadius: 12, textDecoration: "none", background: s.bg, border: `1.5px solid ${s.bd}`, color: s.ink }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <b>{x.title}</b><span className="ek-num" style={{ fontSize: 12 }}>{x.when}</span>
                      </span>
                      {x.text && <span style={{ fontSize: 13 }}>{x.text}</span>}
                    </Link>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="rpt-cols">
            <Panel title={t("rtd.dishes")} icon="fa-bowl-food" right={<Link to="/restaurant-report" className="btn btn-outline btn-sm">{t("rtd.all")}</Link>}>
              <div className="card-body">
                {asArray(d.dishes).length === 0 ? <Empty icon="fa-bowl-food" text={t("rpt2.noData")} /> : asArray(d.dishes).map((x, i) => (
                  <div key={x.productId || i} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32 }}>
                    <span className="ek-num text-muted" style={{ width: 22 }}>{i + 1}</span>
                    <span className="fw-700" style={{ flex: "1 1 0" }}>{x.name}</span>
                    <span className="ek-num text-muted">{quantity(x.qty)}</span>
                    <span className="ek-num fw-700" style={{ width: 120, textAlign: "right" }}>{money(x.revenue)}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={t("rtd.waiters")} icon="fa-user-tie">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>{t("rtd.waiter")}</th><th>{t("rtd.tablesCol")}</th><th>{t("rtd.k.guests")}</th>
                    <th>{t("rtd.k.revenue")}</th><th>{t("rtd.k.avgCheck")}</th><th>{t("rtd.tips")}</th>
                  </tr></thead>
                  <tbody>
                    {asArray(d.waiters).length ? asArray(d.waiters).map((w) => (
                      <tr key={w.login || w.name}>
                        <td className="fw-700">{w.name}</td>
                        <td className="mono">{num(w.tables)}</td>
                        <td className="mono">{num(w.guests)}</td>
                        <td className="mono fw-700 text-blue">{money(w.revenue)}</td>
                        <td className="mono">{money(w.avgCheck)}</td>
                        <td className="mono">{num(w.tips) ? money(w.tips) : "—"}</td>
                      </tr>
                    )) : <tr><td colSpan={6}><Empty icon="fa-user-tie" text={t("rpt2.noData")} /></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="card-body text-muted" style={{ fontSize: 13 }}>
                {t("rtd.extra", { tips: money(d.tips), svc: money(d.serviceCharge) })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
