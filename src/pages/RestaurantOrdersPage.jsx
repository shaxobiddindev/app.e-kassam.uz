import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { reportApi } from "../api";
import { money } from "../utils";
import { quantity, time } from "../lib/ek-format";
import { paymentEntry } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { Empty } from "../components/ui";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { todayIso, shiftDay } from "../lib/ek-day-report";
import { STATUS_TONE, FILTERS, countBy, byCourse, durationMin } from "../lib/ek-restaurant-orders";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «BUYURTMALAR» (4-bosqich E5, 2026-10-10)

   Do'kon «Sotuvlar» ro'yxati o'rnida: kun bo'yicha hamma buyurtma — stol
   hisoblari (ochiq, hisob berilgan, to'langan, bekor) va stolsiz sotuvlar
   (olib ketish, yetkazish, kassa). O'ngda tanlanganning tafsiloti: kurslar,
   xizmat haqi, choy puli, to'lov va vaqt chizig'i.

   ⚠ Qaytarish va chek tuzatish — eski «Cheklar» sahifasida (`/sales`):
   u oynalar (sabab, fiskal qaytarish, jurnal) allaqachon to'g'ri ishlaydi.
   ⚠ Kassir bu sahifani ko'rmaydi (hisobot ma'lumoti) — u `/sales` ga boradi.
   ⚠ YANGI CSS YO'Q (44/44).
   ══════════════════════════════════════════════════════════════════════════ */
const TONE = {
  brand:   { bg: "var(--bg-brand-subtle)",   ink: "var(--fg-brand)" },
  warn:    { bg: "var(--bg-warning-subtle)", ink: "var(--fg-warning)" },
  good:    { bg: "var(--bg-success-subtle)", ink: "var(--fg-success)" },
  bad:     { bg: "var(--bg-danger-subtle)",  ink: "var(--fg-danger)" },
  away:    { bg: "var(--bg-sunken)",         ink: "var(--fg-primary)" },
  neutral: { bg: "var(--bg-sunken)",         ink: "var(--fg-secondary)" },
};
const Badge = ({ status }) => {
  const c = TONE[STATUS_TONE[status]] || TONE.neutral;
  return <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: c.bg, color: c.ink, whiteSpace: "nowrap" }}>{t(`ord.s.${status}`)}</span>;
};

export default function RestaurantOrdersPage({ toast }) {
  const [date, setDate] = useState(todayIso);
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);       // { kind, id }
  const [detail, setDetail] = useState(null);
  const [dLoading, setDLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    reportApi.restaurantOrders(date)
      .then((r) => setD(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [date, toast]);
  useEffect(() => { load(); }, [load]);

  const rows = asArray(d?.rows);
  const shown = rows.filter(FILTERS[filter]);
  const counts = countBy(rows);
  const cur = sel || (shown[0] ? { kind: shown[0].kind, id: shown[0].id } : null);

  useEffect(() => {
    setDetail(null);
    if (!cur) return undefined;
    let alive = true;
    setDLoading(true);
    (cur.kind === "TABLE" ? reportApi.restaurantOrderTable(cur.id) : reportApi.restaurantOrderSale(cur.id))
      .then((r) => { if (alive) setDetail(r?.data || null); })
      .catch((e) => toast?.error(e.message))
      .finally(() => { if (alive) setDLoading(false); });
    return () => { alive = false; };
  }, [cur?.kind, cur?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const where = (r) => r.kind === "AWAY" ? t(`ord.s.${r.status}`) : [r.hall, r.table].filter(Boolean).join(" · ");
  const no = (r) => r.kind === "AWAY" ? t("ord.receiptNo", { n: r.id }) : `#${r.id}`;
  const isToday = date === todayIso();

  const eventText = (e) => {
    if (e.kind === "PAID") return t("ord.e.PAID", { sum: money(e.amount) });
    if (e.kind === "KITCHEN") return t("ord.e.KITCHEN", { text: e.text || "—", n: quantity(e.amount) });
    if (e.kind === "VOID") return `${t("ord.e.VOID", { text: e.text || "—", n: quantity(e.amount), note: e.note || t("ord.noReason") })}${e.by ? ` · ${e.by}` : ""}`;
    return t(`ord.e.${e.kind}`, { text: e.text || "—" });
  };

  const sheets = () => [{ name: t("ord.title"), rows: [
    [t("ord.c.no"), t("ord.c.at"), t("ord.c.where"), t("ord.c.waiter"), t("ord.c.guests"), t("ord.c.sum"), t("ord.c.status")]
      .map((v) => ({ v, bold: true })),
    ...rows.map((r) => [no(r), time(r.openedAt), where(r), r.waiter || "", r.guests ?? "", Number(r.total) || 0, t(`ord.s.${r.status}`)]),
  ] }];

  const pill = (on) => ({ minHeight: 44, padding: "0 14px", borderRadius: 12, fontWeight: 700,
    ...(on ? { background: "var(--bg-brand)", color: "var(--fg-on-brand)", borderColor: "transparent" } : {}) });
  const took = detail ? durationMin(detail.timeline) : null;

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("ord.title")}</h2>
          <span className="text-muted">{t("ord.dayCount", { day: isToday ? t("ord.today") : date, n: rows.length })}</span>
        </div>
        <div className="rpt-bar__tools">
          {[["today", todayIso()], ["yday", shiftDay(todayIso(), -1)]].map(([k, v]) => (
            <button key={k} type="button" className="btn btn-outline btn-sm" aria-pressed={date === v} style={pill(date === v)}
                    onClick={() => { setSel(null); setDate(v); }}>
              {t(k === "today" ? "ord.today" : "ord.yesterday")}
            </button>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44 }} onClick={load}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
          <ExcelButton name={`buyurtmalar-${date}`} sheets={sheets} toast={toast} disabled={!d} />
          <Link to="/sales" className="btn btn-outline btn-sm" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            <i className="fa-solid fa-receipt" aria-hidden="true" />&nbsp;{t("ord.receipts")}
          </Link>
        </div>
      </div>

      <div role="tablist" aria-label={t("ord.c.status")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.keys(FILTERS).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className="btn btn-outline btn-sm" style={pill(filter === k)}
                  onClick={() => { setFilter(k); setSel(null); }}>
            {t(`ord.f.${k}`)} <span className="ek-num">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "999 1 560px", minWidth: 0 }}>
          {busy || !d ? <SkeletonTable rows={10} cols={["num", "num", "wide", "text", "num", "num", "text"]} /> : rows.length === 0 ? (
            <div className="card-body"><Empty icon="fa-receipt" text={t("ord.empty")} /></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>{t("ord.c.no")}</th><th>{t("ord.c.at")}</th><th>{t("ord.c.where")}</th><th>{t("ord.c.waiter")}</th>
                  <th style={{ textAlign: "right" }}>{t("ord.c.guests")}</th><th style={{ textAlign: "right" }}>{t("ord.c.sum")}</th><th>{t("ord.c.status")}</th>
                </tr></thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={7}><Empty icon="fa-filter" text={t("ord.nothing")} /></td></tr>}
                  {shown.map((r) => {
                    const on = cur && cur.kind === r.kind && cur.id === r.id;
                    return (
                      <tr key={`${r.kind}-${r.id}`} onClick={() => setSel({ kind: r.kind, id: r.id })}
                          style={{ cursor: "pointer", background: on ? "var(--bg-brand-subtle)" : undefined }}>
                        <td>
                          <button type="button" aria-pressed={on} onClick={(e) => { e.stopPropagation(); setSel({ kind: r.kind, id: r.id }); }}
                                  className="ek-num" style={{ minHeight: 44, minWidth: 44, padding: "0 4px", background: "none", border: 0, color: "var(--fg-brand)", fontWeight: 700, cursor: "pointer", font: "inherit" }}>
                            {no(r)}
                          </button>
                        </td>
                        <td className="ek-num">{time(r.openedAt)}</td>
                        <td className="fw-700">{where(r)}</td>
                        <td>{r.waiter || "—"}</td>
                        <td className="ek-num" style={{ textAlign: "right" }}>{r.guests ?? "—"}</td>
                        <td className="ek-num fw-700" style={{ textAlign: "right" }}>{money(r.total)}</td>
                        <td><Badge status={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside aria-label={t("ord.detail")} className="card"
               style={{ flex: "1 1 340px", maxWidth: 440, minWidth: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 12 }}>
          {!cur ? <p className="text-muted" style={{ margin: 0 }}>{t("ord.pick")}</p> : dLoading || !detail ? <Spinner /> : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 20 }}>{detail.kind === "AWAY" ? t(`ord.s.${detail.status}`) : [detail.hall, detail.table].filter(Boolean).join(" · ")}</h3>
                <span className="ek-num text-muted">{detail.kind === "AWAY" ? t("ord.receiptNo", { n: detail.id }) : `#${detail.id}`}</span>
                <span style={{ marginLeft: "auto" }}><Badge status={detail.status} /></span>
              </div>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {[detail.waiter, detail.guests ? t("ord.guestsN", { n: detail.guests }) : null].filter(Boolean).join(" · ")}
              </span>
              {detail.note && <span style={{ fontSize: 13 }}><b>{t("ord.note")}:</b> {detail.note}</span>}

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {byCourse(asArray(detail.lines)).map((g) => (
                  <div key={String(g.course)} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {g.course !== undefined && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", textTransform: "uppercase", marginTop: 4 }}>
                        {g.course == null ? t("ord.noCourse") : t("ord.course", { n: g.course })}
                      </span>
                    )}
                    {g.lines.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                        <span style={{ minWidth: 0 }}>
                          <span className="ek-num">{quantity(l.qty)}</span> × {l.name}
                          {l.seat ? <span className="text-muted"> ({t("ord.seat", { n: l.seat })})</span> : null}
                          {l.mods ? <span className="text-muted"> · {l.mods}</span> : null}
                          {l.note ? <span className="text-muted"> · {l.note}</span> : null}
                          {detail.status !== "PAID" && l.sentQty != null && Number(l.sentQty) < Number(l.qty)
                            ? <span style={{ color: "var(--fg-warning)", fontSize: 12 }}> · {t("ord.notSent")}</span> : null}
                        </span>
                        <span className="ek-num" style={{ whiteSpace: "nowrap" }}>{money(l.sum)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
                {detail.saleIds?.length ? (
                  <>
                    <span style={{ display: "flex", justifyContent: "space-between" }}><span>{t("ord.subtotal")}</span><span className="ek-num">{money(detail.subtotal)}</span></span>
                    {Number(detail.serviceCharge) > 0 && <span style={{ display: "flex", justifyContent: "space-between" }}><span>{t("ord.service")}</span><span className="ek-num">{money(detail.serviceCharge)}</span></span>}
                    <span style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16 }}><span>{t("ord.total")}</span><span className="ek-num">{money(detail.total)}</span></span>
                    {Number(detail.tip) > 0 && <span style={{ display: "flex", justifyContent: "space-between", color: "var(--fg-secondary)" }}><span>{t("ord.tip")}</span><span className="ek-num">{money(detail.tip)}</span></span>}
                    {asArray(detail.payments).map((p) => (
                      <span key={p.type} style={{ display: "flex", justifyContent: "space-between", color: "var(--fg-secondary)", fontSize: 13 }}>
                        <span>{paymentEntry(p.type)?.label || p.type}</span><span className="ek-num">{money(p.amount)}</span>
                      </span>
                    ))}
                  </>
                ) : (
                  <span style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                    <span>{t("ord.openTotal")}</span><span className="ek-num">{money(detail.subtotal)}</span>
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)" }}>
                  {t("ord.timeline")}{took != null ? ` · ${t("ord.took", { n: took })}` : ""}
                </span>
                {asArray(detail.timeline).map((e, i) => (
                  <span key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, flex: "none", alignSelf: "center",
                                                      background: e.kind === "PAID" ? "var(--fg-success)" : e.kind === "CANCELLED" || e.kind === "VOID" ? "var(--fg-danger)" : "var(--bg-brand)" }} />
                    <span className="ek-num" style={{ width: 44, flex: "none", color: "var(--fg-secondary)" }}>{time(e.at)}</span>
                    <span>{eventText(e)}</span>
                  </span>
                ))}
              </div>

              {detail.tableId && (detail.status === "OPEN" || detail.status === "BILL") && (
                <Link to={`/restaurant/table/${detail.tableId}`} className="btn btn-primary btn-sm"
                      style={{ minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  <i className="fa-solid fa-utensils" aria-hidden="true" />&nbsp;{t("ord.openTable")}
                </Link>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
