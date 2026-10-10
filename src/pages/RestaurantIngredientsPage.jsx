import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import "../lib/ek-rest-words";
import { menuApi } from "../api";
import { money } from "../utils";
import { quantity } from "../lib/ek-format";
import { unitLabel } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { Kpi, Panel } from "../components/report/RptUi";
import { Empty, SearchBar } from "../components/ui";
import { SkeletonCards, SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import ExcelButton from "../components/ek/ExcelButton";
import { daysTone, visibleRows, orderText } from "../lib/ek-restaurant-ingredients";

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN — «MASALLIQLAR» (4-bosqich E4, 2026-10-10)

   Do'kon omborining o'rnida restoranning savoli: «qancha bor, qancha ketyapti,
   necha kunga yetadi va ertaga kimdan nima olish kerak». Sarf sotilgan
   taomlarning texkartasidan o'zi hisoblanadi — hech kim qo'lda yozmaydi.

   ⚠ Partiyalar, tuzatish va chiqit — do'kon omborida (`/inventory`) qoladi:
   o'sha oynalar (muddat, sabab, jurnal) allaqachon to'g'ri ishlaydi va
   ikkinchi nusxasi kerak emas. Bu sahifa ularga havola beradi.
   ⚠ «Telegramga» — matn NUSXALANADI va Telegram ulashish oynasi ochiladi.
   Desktopda tashqi havola ochilmasa ham nusxa qoladi. Hech narsa o'zi
   yuborilmaydi.
   ⚠ YANGI CSS YO'Q (44/44).
   ══════════════════════════════════════════════════════════════════════════ */
const TONE = {
  good: { ink: "var(--fg-success)", bg: "var(--bg-success-subtle)" },
  warn: { ink: "var(--fg-warning)", bg: "var(--bg-warning-subtle)" },
  bad:  { ink: "var(--fg-danger)",  bg: "var(--bg-danger-subtle)" },
};
const dec1 = (v) => String(v).replace(".", ",");

export default function RestaurantIngredientsPage({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    menuApi.ingredients()
      .then((r) => setD(r?.data || null))
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const rows = asArray(d?.rows);
  const shown = visibleRows(rows, { query, lowOnly });
  const orders = asArray(d?.orders);
  /* Dona — butun; kg/l — ortiqcha nollarsiz («3,2 kg», «3,200 kg» emas): oshpaz
     va yetkazuvchi shunday o'qiydi. */
  const qty = (n, unit) => quantity(n, unit === "DONA" ? 0 : undefined);
  const daysText = (r) => {
    const k = daysTone(r.daysLeft).kind;
    return t(`ingr.d.${k}`, { d: dec1(r.daysLeft) });
  };
  const usedPct = d && Number(d.revenueToday) > 0
    ? Math.round((Number(d.usedTodayValue) / Number(d.revenueToday)) * 100) : null;

  const fmt = { qty, money, unit: unitLabel, title: t("ingr.orderTitle"), total: t("ingr.total"), noSupplier: t("ingr.noSupplier") };
  const sendTelegram = async (o) => {
    const text = orderText(o, fmt);
    try { await navigator.clipboard.writeText(text); toast?.success(t("ingr.copied")); } catch { /* nusxa bo'lmadi — oyna baribir ochiladi */ }
    window.open(`https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const sheets = () => [
    { name: t("ingr.title"), rows: [
      [t("ingr.c.name"), t("ingr.c.left"), t("ingr.c.today"), t("ingr.c.avg"), t("ingr.c.days"), t("ingr.c.price"), t("ingr.c.supplier"), t("ingr.c.dishes")]
        .map((v) => ({ v, bold: true })),
      ...rows.map((r) => [r.name, `${qty(r.stock, r.unit)} ${unitLabel(r.unit)}`, Number(r.usedToday) || 0, Number(r.avgDaily) || 0,
        daysText(r), Number(r.cost) || 0, r.supplierName || "", asArray(r.dishes).join(", ")]),
    ] },
    { name: t("ingr.order"), rows: [
      [t("ingr.c.supplier"), t("ingr.c.name"), t("ingr.c.left"), t("ingr.total")].map((v) => ({ v, bold: true })),
      ...orders.flatMap((o) => asArray(o.lines).map((l) => [o.supplierName || t("ingr.noSupplier"), l.name,
        `${qty(l.qty, l.unit)} ${unitLabel(l.unit)}`, Number(l.sum) || 0])),
    ] },
  ];

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <h2 className="page-title" style={{ margin: 0 }}>{t("ingr.title")}</h2>
        <div className="rpt-bar__tools">
          <Link to="/inventory" className="btn btn-outline btn-sm" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            <i className="fa-solid fa-boxes-stacked" aria-hidden="true" />&nbsp;{t("ingr.batches")}
          </Link>
          <ExcelButton name="masalliqlar" sheets={sheets} toast={toast} disabled={!d} />
          <Link to="/supply" className="btn btn-primary btn-sm" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            <i className="fa-solid fa-plus" aria-hidden="true" />&nbsp;{t("ingr.receive")}
          </Link>
        </div>
      </div>

      {busy || !d ? <SkeletonCards count={5} className="kpi-grid" /> : (
        <div className="kpi-grid">
          <Kpi label={t("ingr.k.stock")} value={money(d.stockValue)} icon="fa-warehouse" sub={t("ingr.k.stockSub", { n: d.kinds })} />
          <Kpi label={t("ingr.k.used")} value={money(d.usedTodayValue)} icon="fa-fire-burner"
               sub={usedPct != null ? t("ingr.k.usedSub", { p: usedPct }) : ""} />
          <Kpi label={t("ingr.k.low")} value={t("ingr.k.lowVal", { n: d.lowCount })} icon="fa-hourglass-half"
               tone={d.lowCount > 0 ? "warn" : undefined} sub={t("ingr.k.lowSub")} />
          <Kpi label={t("ingr.k.waste")} value={money(d.wasteTodayValue)} icon="fa-trash-can" />
          <Kpi label={t("ingr.k.short")} value={t("ingr.k.shortVal", { n: d.shortageCount })} icon="fa-triangle-exclamation"
               tone={d.shortageCount > 0 ? "bad" : undefined} sub={t("ingr.k.shortSub")} />
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "999 1 560px", minWidth: 0 }}>
          <Panel title={t("ingr.table")} icon="fa-carrot" right={<span className="text-muted" style={{ fontSize: 12 }}>{t("ingr.tableHint")}</span>}>
            <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <SearchBar value={query} onChange={setQuery} placeholder={t("ingr.search")} style={{ minWidth: 220, flex: "1 1 220px" }} />
              <button type="button" className="btn btn-outline btn-sm" aria-pressed={lowOnly} onClick={() => setLowOnly((v) => !v)}
                      style={{ minHeight: 44, fontWeight: 700, ...(lowOnly ? { background: "var(--bg-warning-subtle)", color: "var(--fg-warning)", borderColor: "var(--border-warning)" } : {}) }}>
                <i className="fa-solid fa-hourglass-half" aria-hidden="true" /> {t("ingr.lowOnly")}
              </button>
            </div>
            {busy || !d ? <SkeletonTable rows={8} cols={["wide", "num", "num", "num", "text", "num", "wide"]} /> : rows.length === 0 ? (
              <div className="card-body"><Empty icon="fa-carrot" text={t("ingr.none")} /></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>{t("ingr.c.name")}</th><th style={{ textAlign: "right" }}>{t("ingr.c.left")}</th>
                    <th style={{ textAlign: "right" }}>{t("ingr.c.today")}</th><th style={{ textAlign: "right" }}>{t("ingr.c.avg")}</th>
                    <th>{t("ingr.c.days")}</th><th style={{ textAlign: "right" }}>{t("ingr.c.price")}</th><th>{t("ingr.c.dishes")}</th>
                  </tr></thead>
                  <tbody>
                    {shown.length === 0 && <tr><td colSpan={7}><Empty icon="fa-magnifying-glass" text={t("ingr.nothing")} /></td></tr>}
                    {shown.map((r) => {
                      const tone = TONE[daysTone(r.daysLeft).tone];
                      return (
                        <tr key={r.id}>
                          <td className="fw-700">
                            <Link to={`/inventory/${r.id}`} style={{ color: "inherit" }}>{r.name}</Link>
                            {r.supplierName && <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>{r.supplierName}</div>}
                          </td>
                          <td className="ek-num fw-700" style={{ textAlign: "right" }}>{qty(r.stock, r.unit)} {unitLabel(r.unit)}</td>
                          <td className="ek-num" style={{ textAlign: "right" }}>{Number(r.usedToday) ? `${qty(r.usedToday, r.unit)} ${unitLabel(r.unit)}` : "—"}</td>
                          <td className="ek-num" style={{ textAlign: "right", color: "var(--fg-secondary)" }}>{Number(r.avgDaily) ? `${qty(r.avgDaily, r.unit)} ${unitLabel(r.unit)}` : "—"}</td>
                          <td>
                            <span style={{ display: "inline-flex", padding: "3px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                           background: tone ? tone.bg : "var(--bg-sunken)", color: tone ? tone.ink : "var(--fg-secondary)" }}>
                              {daysText(r)}
                            </span>
                          </td>
                          <td className="ek-num" style={{ textAlign: "right" }}>{money(r.cost)}/{unitLabel(r.unit)}</td>
                          <td style={{ fontSize: 12, color: "var(--fg-secondary)" }}>
                            {asArray(r.dishes).join(", ") || "—"}
                            {r.stopDish && <b style={{ color: "var(--fg-warning)" }}> · {t("ingr.stopDish")}</b>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div style={{ flex: "1 1 300px", maxWidth: 420, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title={t("ingr.order")} icon="fa-truck">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="text-muted" style={{ fontSize: 13 }}>{t("ingr.orderHint")}</span>
              {d && orders.length === 0 && <p style={{ margin: 0, color: "var(--fg-success)", fontWeight: 600 }}><i className="fa-solid fa-check" aria-hidden="true" /> {t("ingr.orderNone")}</p>}
              {orders.map((o) => (
                <div key={o.supplierId ?? "none"} style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{o.supplierName || t("ingr.noSupplier")}</b>
                    <span className="ek-num fw-700">{money(o.sum)}</span>
                  </span>
                  {o.phone && <span className="ek-num text-muted" style={{ fontSize: 12 }}>{o.phone}</span>}
                  <span style={{ fontSize: 13, color: "var(--fg-secondary)" }}>
                    {asArray(o.lines).map((l) => `${l.name} ${qty(l.qty, l.unit)} ${unitLabel(l.unit)}`).join(" · ")}
                  </span>
                  <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44, fontWeight: 700 }} onClick={() => sendTelegram(o)}>
                    <i className="fa-brands fa-telegram" aria-hidden="true" /> {t("ingr.telegram")}
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          {asArray(d?.shortages).length > 0 && (
            <Panel title={t("ingr.shortTitle")} icon="fa-triangle-exclamation">
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="text-muted" style={{ fontSize: 13 }}>{t("ingr.shortHint")}</span>
                {asArray(d.shortages).map((s) => (
                  <div key={s.ingredientId} style={{ display: "flex", justifyContent: "space-between", gap: 8, minHeight: 32, alignItems: "center" }}>
                    <span className="fw-700">{s.name}</span>
                    <span className="ek-num" style={{ color: "var(--fg-danger)" }}>
                      {t("ingr.shortLine", { qty: `${qty(s.qty, s.unit)} ${unitLabel(s.unit)}`, n: s.times })}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
