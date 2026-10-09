import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { reportApi, shopApi } from "../api";
import { BranchSelector } from "../components";
import { Empty } from "../components/ui";
import { money } from "../utils";
import { quantity, weekdayDate } from "../lib/ek-format";
import { paymentEntry, unitLabel } from "../lib/ek-labels";
import { SkeletonCards, SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { BarChart } from "../components/ek/Charts";
import { downloadXlsx } from "../lib/ek-xlsx";
import { C, PALETTE, num, Kpi, Panel, Lead, ShareList } from "../components/report/RptUi";
import { asArray } from "../lib/ek-array";
import { dayBounds, shiftDay, todayIso, rowFilter } from "../lib/ek-day-report";

/* ══════════════════════════════════════════════════════════════════════════
   KUNLIK HISOBOT (2026-10-09)

   Egasi: «do'konga mahsulotlarning kunlik hisobotini yuritish imkoni —
   juda sodda, murakkab atamalarsiz, lekin juda batafsil; do'kon egasi
   xohlagan hamma narsani ko'ra olsin».

   ⚠ SODDA TIL — har bo'lim SAVOL bilan boshlanadi («Bugun qancha
   sotildi?»), raqamlar oldidan oddiy gap. «Marja», «COGS» yo'q: «tan
   narxi», «foyda», «qoldi».

   ⚠ BATAFSIL — har tovar uchun butun kun: kun boshida qancha bor edi,
   qancha keldi, sotildi, qaytdi, buzildi, kun oxirida qancha qoldi.
   Tenglik doim saqlanadi (`DayReportService`, «Boshqa» ustuni).

   ⚠ YANGI CSS YO'Q (byudjet 44/44): hisobot bo'limining klasslari.
   ══════════════════════════════════════════════════════════════════════════ */
const SHOW = ["moved", "sold", "all"];

export default function DayReportPage({ toast }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso);
  const [branchId, setBranchId] = useState(null);
  const [show, setShow] = useState("moved");
  const [an, setAn] = useState(null);
  const [dp, setDp] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    shopApi.getProfile().then((r) => setShopName((r?.data ?? r)?.name || "")).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const { from, to } = dayBounds(date);
    Promise.all([
      reportApi.analytics(from, to, "hour", branchId),
      reportApi.dayProducts(date, branchId, show === "all"),
    ])
      .then(([a, d]) => { setAn(a?.data || null); setDp(d?.data || null); })
      .catch((e) => toast?.error(e.message))
      .finally(() => setLoading(false));
  }, [date, branchId, show === "all", toast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const k = an?.now || {};
  const isToday = date === todayIso();
  const dayWord = isToday ? t("day.today") : weekdayDate(`${date}T12:00:00`);
  const rows = useMemo(() => rowFilter(asArray(dp?.rows), show), [dp, show]);
  const hasTransfers = rows.some((r) => num(r.transferIn) || num(r.transferOut));

  const COLS = useMemo(() => [
    { key: "name",  label: t("day.col.name"),    type: "text",   get: (r) => r.name },
    { key: "cat",   label: t("day.col.cat"),     type: "text",   get: (r) => r.category },
    { key: "open",  label: t("day.col.open"),    type: "number", get: (r) => r.opening },
    { key: "in",    label: t("day.col.in"),      type: "number", get: (r) => r.received },
    { key: "sold",  label: t("day.col.sold"),    type: "number", get: (r) => r.sold },
    { key: "ret",   label: t("day.col.ret"),     type: "number", get: (r) => r.returned },
    { key: "off",   label: t("day.col.off"),     type: "number", get: (r) => r.writtenOff },
    { key: "other", label: t("day.col.other"),   type: "number", get: (r) => r.other },
    { key: "close", label: t("day.col.close"),   type: "number", get: (r) => r.closing },
    { key: "money", label: t("day.col.money"),   type: "number", get: (r) => num(r.soldMoney) - num(r.returnedMoney) },
    { key: "prof",  label: t("day.col.profit"),  type: "number", get: (r) => r.profit },
  ], []);
  const flt = useDataFilter(COLS, "day-products");
  const shown = flt.apply(rows);

  const openProduct = (id) => navigate(`/reports/product/${id}?${new URLSearchParams({ period: "custom", from: date, to: date })}`);

  const ran = rows.filter((r) => r.tracksStock && r.closing != null && num(r.closing) <= 0 && num(r.sold) > 0);
  const hours = asArray(an?.hourly).filter((h) => h.hour >= 6 || num(h.netSales) > 0);

  const exportXlsx = () => {
    const sum = [
      [{ v: shopName || t("day.title"), bold: true }], [t("day.date"), date], [],
      [t("day.k.sales"), num(k.netSales)], [t("day.k.profit"), num(k.grossProfit)],
      [t("day.k.receipts"), num(k.receipts)], [t("day.k.avg"), num(k.avgReceipt)],
      [t("day.k.cash"), num(k.cash)], [t("day.k.card"), num(k.card)], [t("day.k.online"), num(k.online)],
      [t("day.k.credit"), num(k.credit)], [t("day.k.discount"), num(k.discount)],
      [t("day.k.returns"), num(k.returns)], [t("day.k.expenses"), num(k.expenses)],
      [t("day.k.net"), num(k.netProfit)],
    ];
    downloadXlsx(`kunlik-hisobot-${date}`, [
      { name: t("day.sheet.summary"), rows: sum },
      { name: t("day.sheet.products"), rows: [
        COLS.map((c) => ({ v: c.label, bold: true })),
        ...shown.map((r) => COLS.map((c) => (c.type === "number" ? (c.get(r) == null ? "" : num(c.get(r))) : (c.get(r) || "")))),
      ] },
      { name: t("day.sheet.hours"), rows: [[t("day.hour"), t("day.k.sales"), t("day.k.receipts")],
        ...hours.map((h) => [`${h.hour}:00`, num(h.netSales), num(h.receipts)])] },
      { name: t("day.sheet.cashiers"), rows: [[t("day.who"), t("day.k.receipts"), t("day.k.sales"), t("day.k.returns")],
        ...asArray(an?.cashiers).map((c) => [c.name, num(c.receipts), num(c.netSales), num(c.returns)])] },
      { name: t("day.sheet.pay"), rows: [[t("day.how"), t("day.k.sales")],
        ...asArray(an?.payments).map((p) => [paymentEntry(p.type).label, num(p.amount)])] },
    ]);
  };

  const q = (v, u) => (v == null ? "—" : `${quantity(v)}${u ? " " + unitLabel(u) : ""}`);
  const zero = (v) => !num(v);

  return (
    <div className="rpt">
      <div className="rpt-bar">
        <div className="rpt-bar__tools" role="group" aria-label={t("day.date")} style={{ flexWrap: "nowrap" }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDate(shiftDay(date, -1))}
                  aria-label={t("day.prev")}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          <input type="date" className="form-input ek-num" value={date} max={todayIso()} style={{ width: 170 }}
                 aria-label={t("day.date")} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="btn btn-outline btn-sm" disabled={isToday}
                  onClick={() => setDate(shiftDay(date, 1))} aria-label={t("day.next")}>
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
          {!isToday && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDate(todayIso())}>
              {t("day.today")}
            </button>
          )}
        </div>
        <div className="rpt-bar__tools">
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
          <button className="btn btn-outline btn-sm" onClick={load} aria-label={t("common.refresh")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
          <button className="btn btn-outline btn-sm" disabled={!an || !dp}
                  onClick={() => { try { exportXlsx(); } catch (e) { toast?.error(e.message); } }}>
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true" /> {t("rpt2.print")}
          </button>
        </div>
      </div>

      <div className="rpt-print-head">
        <b>{shopName || t("day.title")}</b>
        <span>{t("day.title")} · {date}</span>
      </div>

      {busy || !an || !dp ? <SkeletonCards count={8} className="kpi-grid" /> : (
        <>
          {/* ══ 1. BIR QARASHDA — oddiy gaplar ══ */}
          <Lead q={t("day.q.sum", { day: dayWord })}
                a={[
                  num(k.receipts)
                    ? t("day.s.sales", { n: num(k.receipts), sum: money(k.netSales) })
                    : t("day.s.none"),
                  num(k.receipts) ? t("day.s.profit", { cost: money(k.cogs), profit: money(k.grossProfit) }) : "",
                  num(k.returnReceipts) ? t("day.s.returns", { n: num(k.returnReceipts), sum: money(k.returns) }) : "",
                  num(k.expenses) ? t("day.s.net", { exp: money(k.expenses), net: money(k.netProfit) }) : "",
                ].filter(Boolean).join(" ")} />

          <div className="kpi-grid">
            <Kpi label={t("day.k.sales")} value={money(k.netSales)} icon="fa-sack-dollar" tone="brand" />
            <Kpi label={t("day.k.profit")} value={money(k.grossProfit)} icon="fa-arrow-trend-up" tone="good"
                 sub={t("day.k.costSub", { cost: money(k.cogs) })} />
            <Kpi label={t("day.k.receipts")} value={num(k.receipts)} icon="fa-receipt"
                 sub={t("day.k.itemsSub", { n: quantity(k.itemsSold) })} />
            <Kpi label={t("day.k.avg")} value={money(k.avgReceipt)} icon="fa-scale-balanced"
                 sub={num(k.maxReceipt) ? t("day.k.maxSub", { max: money(k.maxReceipt) }) : ""} />
            <Kpi label={t("day.k.cash")} value={money(k.cash)} icon="fa-money-bill-wave" />
            <Kpi label={t("day.k.card")} value={money(k.card)} icon="fa-credit-card" />
            {!zero(k.online) && <Kpi label={t("day.k.online")} value={money(k.online)} icon="fa-mobile-screen" />}
            {!zero(k.credit) && <Kpi label={t("day.k.credit")} value={money(k.credit)} icon="fa-hand-holding-dollar" tone="warn" />}
            {!zero(k.discount) && <Kpi label={t("day.k.discount")} value={money(k.discount)} icon="fa-tags" />}
            {!zero(k.returns) && <Kpi label={t("day.k.returns")} value={money(k.returns)} icon="fa-rotate-left" tone="warn"
                                      sub={t("day.k.retSub", { n: num(k.returnReceipts) })} />}
            {num(k.cancelledReceipts) > 0 && <Kpi label={t("day.k.cancelled")} value={num(k.cancelledReceipts)} icon="fa-ban"
                                                  sub={money(k.cancelledAmount)} />}
            {!zero(k.expenses) && <Kpi label={t("day.k.expenses")} value={money(k.expenses)} icon="fa-file-invoice-dollar" />}
            {!zero(k.inventoryLoss) && <Kpi label={t("day.k.loss")} value={money(k.inventoryLoss)} icon="fa-trash-can" tone="warn" />}
            <Kpi label={t("day.k.net")} value={money(k.netProfit)} icon="fa-piggy-bank"
                 tone={num(k.netProfit) < 0 ? "bad" : "good"} hint={t("day.k.netHint")} />
            {num(k.customers) > 0 && <Kpi label={t("day.k.customers")} value={num(k.customers)} icon="fa-users"
                                          sub={num(k.newCustomers) ? t("day.k.newSub", { n: num(k.newCustomers) }) : ""} />}
          </div>

          {/* ══ 2. QACHON, KIM, QANDAY ══ */}
          <div className="rpt-cols">
            <Panel title={t("day.q.hours")} icon="fa-clock">
              <div className="card-body">
                <BarChart height={200} empty={t("rpt2.noData")} color={C.sales}
                          bars={hours.map((h) => ({ label: String(h.hour), value: num(h.netSales) }))} />
              </div>
            </Panel>
            <Panel title={t("day.q.pay")} icon="fa-wallet">
              <div className="card-body">
                <ShareList rows={asArray(an.payments).map((p, i) => ({
                  name: paymentEntry(p.type).label, value: p.amount, share: p.share, color: PALETTE[i % PALETTE.length],
                }))} />
              </div>
            </Panel>
          </div>

          <div className="rpt-cols">
            <Panel title={t("day.q.who")} icon="fa-user-tie">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>{t("day.who")}</th><th>{t("day.k.receipts")}</th><th>{t("day.k.sales")}</th>
                    <th>{t("day.k.returns")}</th><th>{t("day.k.discount")}</th>
                  </tr></thead>
                  <tbody>
                    {asArray(an.cashiers).length ? asArray(an.cashiers).map((c) => (
                      <tr key={c.userId || c.name}>
                        <td className="fw-700">{c.name}</td>
                        <td className="mono">{num(c.receipts)}</td>
                        <td className="mono fw-700 text-blue">{money(c.netSales)}</td>
                        <td className="mono">{zero(c.returns) ? "—" : money(c.returns)}</td>
                        <td className="mono">{zero(c.discount) ? "—" : money(c.discount)}</td>
                      </tr>
                    )) : <tr><td colSpan={5}><Empty icon="fa-user" text={t("rpt2.noData")} /></td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title={t("day.q.cat")} icon="fa-layer-group">
              <div className="card-body">
                <ShareList rows={asArray(an.categories).slice(0, 10).map((c, i) => ({
                  name: c.name || t("rpt2.noCategory"), value: c.netSales,
                  sub: t("day.profitShort", { p: money(c.profit) }), color: PALETTE[i % PALETTE.length],
                }))} />
              </div>
            </Panel>
          </div>

          {ran.length > 0 && (
            <Panel title={t("day.q.ran")} icon="fa-triangle-exclamation" wide>
              <div className="card-body">
                <p className="text-muted">{t("day.ranHint")}</p>
                <p className="fw-700">{ran.map((r) => r.name).join(" · ")}</p>
              </div>
            </Panel>
          )}

          {/* ══ 3. HAR BIR TOVAR ══ */}
          <Panel title={t("day.q.products")} icon="fa-boxes-stacked" wide
                 right={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div className="rpt-tabs" role="tablist" aria-label={t("day.q.products")}>
                            {SHOW.map((s) => (
                              <button key={s} type="button" role="tab" aria-selected={show === s}
                                      className={`rpt-tab${show === s ? " is-on" : ""}`} onClick={() => setShow(s)}>
                                {t(`day.show.${s}`)}
                              </button>
                            ))}
                          </div>
                          <DataFilter cols={COLS} flt={flt} />
                        </div>}>
            <div className="card-body">
              <p className="text-muted">{t("day.formula")}</p>
            </div>
            <div className="table-wrap">
              {busy ? <SkeletonTable rows={8} cols={["wide", "num", "num", "num", "num", "num"]} /> : (
                <table className="table">
                  <thead><tr>
                    <SortTh flt={flt} col="name">{t("day.col.name")}</SortTh>
                    <SortTh flt={flt} col="open">{t("day.col.open")}</SortTh>
                    <SortTh flt={flt} col="in">{t("day.col.in")}</SortTh>
                    {hasTransfers && <th>{t("day.col.tin")}</th>}
                    {hasTransfers && <th>{t("day.col.tout")}</th>}
                    <SortTh flt={flt} col="sold">{t("day.col.sold")}</SortTh>
                    <SortTh flt={flt} col="ret">{t("day.col.ret")}</SortTh>
                    <SortTh flt={flt} col="off">{t("day.col.off")}</SortTh>
                    <SortTh flt={flt} col="other">{t("day.col.other")}</SortTh>
                    <SortTh flt={flt} col="close">{t("day.col.close")}</SortTh>
                    <SortTh flt={flt} col="money">{t("day.col.money")}</SortTh>
                    <SortTh flt={flt} col="prof">{t("day.col.profit")}</SortTh>
                  </tr></thead>
                  <tbody>
                    {shown.length ? shown.map((r) => (
                      <tr key={r.productId} className="tr-link" tabIndex={0}
                          onClick={() => openProduct(r.productId)}
                          onKeyDown={(e) => { if (e.key === "Enter") openProduct(r.productId); }}>
                        <td className="fw-700">
                          {r.name}
                          <div className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>
                            {[r.category, r.barcode].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="mono">{q(r.opening)}</td>
                        <td className="mono">{zero(r.received) ? "—" : `+${q(r.received)}`}</td>
                        {hasTransfers && <td className="mono">{zero(r.transferIn) ? "—" : `+${q(r.transferIn)}`}</td>}
                        {hasTransfers && <td className="mono">{zero(r.transferOut) ? "—" : `−${q(r.transferOut)}`}</td>}
                        <td className="mono fw-700">{zero(r.sold) ? "—" : `−${q(r.sold)}`}</td>
                        <td className="mono">{zero(r.returned) ? "—" : `+${q(r.returned)}`}</td>
                        <td className={`mono${zero(r.writtenOff) ? "" : " text-danger"}`}>{zero(r.writtenOff) ? "—" : `−${q(r.writtenOff)}`}</td>
                        <td className="mono">{r.other == null || zero(r.other) ? "—" : `${num(r.other) > 0 ? "+" : ""}${q(r.other)}`}</td>
                        <td className={`mono fw-700${r.closing != null && num(r.closing) <= 0 ? " text-danger" : ""}`}>{q(r.closing, r.unit)}</td>
                        <td className="mono text-blue">{zero(r.soldMoney) && zero(r.returnedMoney) ? "—" : money(num(r.soldMoney) - num(r.returnedMoney))}</td>
                        <td className={`mono${num(r.profit) < 0 ? " text-danger" : ""}`}>{zero(r.profit) ? "—" : money(r.profit)}</td>
                      </tr>
                    )) : <tr><td colSpan={hasTransfers ? 12 : 10}><Empty icon="fa-box-open" text={t("day.empty")} /></td></tr>}
                  </tbody>
                  {shown.length > 0 && (
                    <tfoot><tr className="fw-700">
                      <td>{t("day.total", { n: shown.length })}</td>
                      <td colSpan={hasTransfers ? 9 : 7} />
                      <td className="mono text-blue">{money(shown.reduce((s, r) => s + num(r.soldMoney) - num(r.returnedMoney), 0))}</td>
                      <td className="mono">{money(shown.reduce((s, r) => s + num(r.profit), 0))}</td>
                    </tr></tfoot>
                  )}
                </table>
              )}
            </div>
            <div className="card-body">
              <p className="text-muted">
                {t("day.stockValue", { sum: money(dp.totals?.closingValue) })}
              </p>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
