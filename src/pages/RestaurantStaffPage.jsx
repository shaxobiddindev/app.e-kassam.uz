import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { reportApi } from "../api";
import { money } from "../utils";
import { time } from "../lib/ek-format";
import { roleLabel } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { Panel, num } from "../components/report/RptUi";
import { Empty } from "../components/ui";
import { SkeletonCards, SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { todayIso } from "../lib/ek-day-report";
import { topRole, GROUPS, needsPin, lastShiftKind, initials } from "../lib/ek-restaurant-staff";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «XODIMLAR» (4-bosqich E7, 2026-10-10)

   Kim hozir smenada va bugun nima qildi, kimning PIN i yo'q (terminalga kira
   olmaydi), har rol nima qila oladi va bugungi choy puli kimga qancha.

   ⚠ Xodim qo'shish, rol, parol va PIN berish — mavjud oynada (`/shop-users`):
   u yerda filial, chegirma chegarasi, bajik va jurnal bor. Bu sahifa
   ko'rsatadi va o'sha oynaga olib boradi.
   ⚠ «Taqsimotni chop etish» — oddiy hujjat (brauzerning chop etish oynasi);
   ismlar HTML'ga qochirilib yoziladi.
   ⚠ YANGI CSS YO'Q (44/44).
   ══════════════════════════════════════════════════════════════════════════ */
const ROLE_TONE = {
  OWNER: { bg: "var(--bg-brand-subtle)", ink: "var(--fg-brand)" },
  SHOP_ADMIN: { bg: "var(--bg-brand-subtle)", ink: "var(--fg-brand)" },
  WAITER: { bg: "var(--bg-warning-subtle)", ink: "var(--fg-warning)" },
  COOK: { bg: "var(--bg-danger-subtle)", ink: "var(--fg-danger)" },
  CASHIER: { bg: "var(--bg-success-subtle)", ink: "var(--fg-success)" },
  STOREKEEPER: { bg: "var(--bg-sunken)", ink: "var(--fg-primary)" },
};
const tone = (r) => ROLE_TONE[r] || ROLE_TONE.STOREKEEPER;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default function RestaurantStaffPage({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [group, setGroup] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    reportApi.restaurantStaff()
      .then((r) => setD(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const staff = asArray(d?.staff).map((p) => ({ ...p, role: topRole(p.roles) }));
  const onShift = staff.filter((p) => p.onShift);
  const shown = staff.filter((p) => GROUPS[group](p.role));
  const tips = d?.tips || { cash: 0, card: 0, byWaiter: [] };
  const maxTip = Math.max(1, ...asArray(tips.byWaiter).map((x) => num(x.amount)));
  const today = todayIso();

  const lastText = (p) => {
    const k = lastShiftKind(p.lastShift, today);
    return k.kind === "date" ? k.date : t(`rst.last.${k.kind}`);
  };
  /* Bugungi ish — rolga qarab (rol `topRole` bilan normallangan). Ish bo'lsa
     roldan qat'i nazar ko'rsatiladi: ega ham stol ochishi mumkin. */
  const FIG = { WAITER: "tables", CASHIER: "checks", COOK: "kitchen" };
  const figure = (p) => {
    const k = p.tablesToday ? "tables" : p.checksToday ? "checks" : FIG[p.role];
    if (k === "tables") return t("rst.fig.tables", { n: p.tablesToday, sum: money(p.tablesRevenue) });
    if (k === "checks") return t("rst.fig.checks", { n: p.checksToday, sum: money(p.checksRevenue) });
    return k === "kitchen" ? t("rst.fig.kitchen") : "";
  };

  const printTips = () => {
    const rows = asArray(tips.byWaiter).map((x) =>
      `<tr><td>${esc(x.name || t("rst.tips.noWaiter"))}</td><td style="text-align:right">${esc(t("rst.tips.checks", { n: x.checks }))}</td><td style="text-align:right">${esc(money(x.amount))}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t("rst.tips.printTitle"))}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #ccc;text-align:left}</style></head>
      <body><h2>${esc(t("rst.tips.printTitle"))} — ${esc(today)}</h2>
      <p>${esc(t("rst.tips.cash"))}: <b>${esc(money(tips.cash))}</b> · ${esc(t("rst.tips.card"))}: <b>${esc(money(tips.card))}</b></p>
      <table>${rows}</table><p style="font-size:12px">${esc(t("rst.tips.note"))}</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) { toast?.error(t("common.error")); return; }
    w.document.write(html);
    w.document.close();
  };

  const sheets = () => [
    { name: t("rst.title"), rows: [
      [t("rst.c.name"), t("rst.c.role"), t("rst.c.pin"), t("rst.c.last"), t("rst.nowTitle")].map((v) => ({ v, bold: true })),
      ...staff.map((p) => [p.name, asArray(p.roles).map((r) => roleLabel(r)).join(", "),
        needsPin(p.role) ? t(p.pinSet ? "rst.pin.yes" : "rst.pin.no") : t("rst.pin.na"), lastText(p), p.onShift ? "✓" : ""]),
    ] },
    { name: t("rst.tips"), rows: [
      [t("rst.c.name"), t("rst.tips.checks", { n: "" }).trim(), t("rst.tips")].map((v) => ({ v, bold: true })),
      ...asArray(tips.byWaiter).map((x) => [x.name || t("rst.tips.noWaiter"), x.checks, num(x.amount)]),
    ] },
  ];

  const pill = (on) => ({ minHeight: 44, padding: "0 12px", borderRadius: 10, fontWeight: 700,
    ...(on ? { background: "var(--bg-brand)", color: "var(--fg-on-brand)", borderColor: "transparent" } : {}) });

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("rst.title")}</h2>
          {d && <span className="text-muted">{t("rst.onShiftN", { n: onShift.length })}</span>}
        </div>
        <div className="rpt-bar__tools">
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44 }} onClick={load}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
          <ExcelButton name="xodimlar" sheets={sheets} toast={toast} disabled={!d} />
          <Link to="/shop-users" className="btn btn-primary btn-sm" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            <i className="fa-solid fa-user-plus" aria-hidden="true" />&nbsp;{t("rst.add")}
          </Link>
        </div>
      </div>

      {busy || !d ? <SkeletonCards count={4} className="kpi-grid" /> : onShift.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}><i className="fa-solid fa-moon" aria-hidden="true" /> {t("rst.nobody")}</p>
      ) : (
        <section aria-label={t("rst.nowTitle")} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {onShift.map((p) => (
            <div key={p.id} className="card" style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 19, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                                                  fontWeight: 800, fontSize: 14, background: tone(p.role).bg, color: tone(p.role).ink }}>{initials(p.name)}</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: tone(p.role).ink }}>{p.role ? roleLabel(p.role) : "—"}</span>
                </span>
              </span>
              <span className="text-muted ek-num" style={{ fontSize: 13 }}>{p.since ? t("rst.since", { t: time(p.since) }) : ""}</span>
              <span className="ek-num fw-700" style={{ fontSize: 14 }}>{figure(p)}</span>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "999 1 560px", minWidth: 0 }}>
          <Panel title={t("rst.all")} icon="fa-user-group">
            <div className="card-body" role="tablist" aria-label={t("rst.c.role")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.keys(GROUPS).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={group === k} className="btn btn-outline btn-sm" style={pill(group === k)} onClick={() => setGroup(k)}>
                  {t(`rst.g.${k}`)} <span className="ek-num">{staff.filter((p) => GROUPS[k](p.role)).length}</span>
                </button>
              ))}
            </div>
            {busy || !d ? <SkeletonTable rows={6} cols={["wide", "text", "text", "wide", "text"]} /> : shown.length === 0 ? (
              <div className="card-body"><Empty icon="fa-user-group" text={t("rst.empty")} /></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t("rst.c.name")}</th><th>{t("rst.c.role")}</th><th>{t("rst.c.pin")}</th><th>{t("rst.c.can")}</th><th>{t("rst.c.last")}</th></tr></thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.id} style={{ opacity: p.enabled ? 1 : 0.6 }}>
                        <td className="fw-700">
                          {p.name}
                          {!p.enabled && <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}> · {t("rst.off")}</span>}
                        </td>
                        <td>
                          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {asArray(p.roles).map((r) => (
                              <span key={r} style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: tone(r).bg, color: tone(r).ink }}>{roleLabel(r)}</span>
                            ))}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: !needsPin(p.role) ? "var(--fg-secondary)" : p.pinSet ? "var(--fg-success)" : "var(--fg-danger)" }}>
                          {needsPin(p.role)
                            ? <><i className={`fa-solid ${p.pinSet ? "fa-check" : "fa-triangle-exclamation"}`} aria-hidden="true" /> {t(p.pinSet ? "rst.pin.yes" : "rst.pin.no")}</>
                            : t("rst.pin.na")}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--fg-secondary)" }}>{p.role ? t(`rst.can.${p.role}`) : "—"}</td>
                        <td className="ek-num" style={{ fontSize: 13 }}>{lastText(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div style={{ flex: "1 1 300px", maxWidth: 420, minWidth: 0 }}>
          <Panel title={t("rst.tips")} icon="fa-hand-holding-dollar">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {[["rst.tips.cash", tips.cash], ["rst.tips.card", tips.card]].map(([k, v]) => (
                  <div key={k} style={{ background: "var(--bg-sunken)", borderRadius: 12, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>{t(k)}</span>
                    <div className="ek-num fw-700" style={{ fontSize: 18 }}>{money(v)}</div>
                  </div>
                ))}
              </div>
              {asArray(tips.byWaiter).length === 0 ? <p className="text-muted" style={{ margin: 0 }}>{t("rst.tips.none")}</p>
                : asArray(tips.byWaiter).map((x) => (
                  <div key={x.login ?? "none"} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                      <b>{x.name || t("rst.tips.noWaiter")}</b>
                      <span className="ek-num">{money(x.amount)} <span className="text-muted">· {t("rst.tips.checks", { n: x.checks })}</span></span>
                    </span>
                    <span style={{ display: "block", height: 8, borderRadius: 4, background: "var(--bg-sunken)" }}>
                      <span style={{ display: "block", height: 8, borderRadius: 4, width: `${Math.round((num(x.amount) / maxTip) * 100)}%`, background: "var(--fg-success)" }} />
                    </span>
                  </div>
                ))}
              <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("rst.tips.note")}</p>
              <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 48, fontWeight: 700 }}
                      disabled={!asArray(tips.byWaiter).length} onClick={printTips}>
                <i className="fa-solid fa-print" aria-hidden="true" /> {t("rst.tips.print")}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
