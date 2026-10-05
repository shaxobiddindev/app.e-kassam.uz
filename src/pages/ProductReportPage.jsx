import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { reportApi, saleApi } from "../api";
import { Empty } from "../components/ui";
import { money, percent } from "../utils";
import { quantity, dateTime } from "../lib/ek-format";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { SkeletonCards, SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { BarChart, shortNum } from "../components/ek/Charts";
import { periodRange, isoInstant, isoDay } from "../lib/ek-period";
import { downloadXlsx } from "../lib/ek-xlsx";
import SaleDetailModal from "../components/SaleDetailModal";
import { C, num, Kpi, Panel, Lead, TopList, PeriodBar } from "../components/report/RptUi";
import ProductFinder from "../components/report/ProductFinder";

/* ══════════════════════════════════════════════════════════════════════════
   MAHSULOT HISOBOTI (2026-10-05)

   Egasi: «tizimda muhim ish — har bir mahsulot bo'yicha batafsil hisobot:
   kim qachon qancha sotgani, qancha qoldi, kuniga qancha sotilyapti,
   hullas hamma ma'lumot bo'lsin». Va: «oddiy user ham oson tushunsin».

   ═══ TARTIB — SAVOLLAR TARTIBIDA ═══════════════════════════════════════

   1. Bir gapda javob (`Lead`): qancha sotildi, kuniga qancha, qoldiq
      necha kunga yetadi. Ko'pchilik shu yerda to'xtaydi.
   2. To'rtta katta raqam + to'rtta kichik.
   3. Kunlar bo'yicha grafik, kim sotdi, qaysi soatda.
   4. Har bir sotuv qatori (bosilsa — chek), kirim-chiqim, narx tarixi.

   ⚠ Ma'lumot BITTA so'rovdan (`/reports/product/{id}`): «sotildi 12»
   va ro'yxatdagi qatorlar bir daqiqaning surati bo'lishi kerak.

   ⚠ Raqamlar umumiy hisobotdagi «Tovarlar» qatori bilan TENG — backend
   ikkalasini bir xil qoida bilan hisoblaydi (`ProductReportTest`).
   ══════════════════════════════════════════════════════════════════════════ */

/** Bir ekranda ko'rsatiladigan qatorlar — qolgani «Hammasini ko'rsatish» bilan. */
const PAGE = 20;

/* Harakat turlari — rang VA matn (rang yolg'iz signal bo'lmaydi). */
const MOV_BADGE = {
  IN: "badge-green", TRANSFER_IN: "badge-blue",
  SALE: "badge-red", EXPIRED: "badge-red", TRANSFER_OUT: "badge-blue",
  CORRECTION: "badge-yellow",
};

/**
 * `/reports/product` — qidiruv; `/reports/product/:id` — hisobot.
 *
 * ⚠ `key={id}`: boshqa tovarga o'tilganda (qidiruvdan) eski tovarning
 * «Hammasini ko'rsatish» holati va ochiq cheki yangi tovarga o'tib qolmasin.
 */
export default function ProductReportPage({ toast }) {
  const { id } = useParams();
  return id ? <ProductReport key={id} id={id} toast={toast} /> : <ProductPick />;
}

/** Menyudan kirilganda — faqat qidiruv: «qaysi tovarni ko'ramiz?». */
function ProductPick() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shop = params.get("shop");
  return (
    <div className="rpt prep">
      <Lead q={t("prep.pickQ")} a={t("prep.pickA")} />
      <Panel title={t("rpt2.productReport")} icon="fa-magnifying-glass-chart" wide>
        <div className="card-body">
          <ProductFinder shopId={shop} onPick={(x) => navigate(`/reports/product/${x.id}${shop ? `?shop=${shop}` : ""}`)} />
        </div>
      </Panel>
    </div>
  );
}

function ProductReport({ id, toast }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shopId = params.get("shop") || null;

  /* Davr hisobotdan keladi (URL), bo'lmasa — oxirgi tanlangan. */
  const [period, setPeriod] = useState(() =>
    params.get("period") || localStorage.getItem("ek_rpt_period") || "month");
  const [custom, setCustom] = useState(() => {
    const now = new Date();
    return {
      from: params.get("from") || isoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: params.get("to") || isoDay(now),
    };
  });
  const range = useMemo(() => periodRange(period, new Date(), custom), [period, custom]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const busy = useLoading(loading);
  const [metric, setMetric] = useState("qty");
  const [allLines, setAllLines] = useState(false);
  const [allMoves, setAllMoves] = useState(false);
  const [sale, setSale] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    reportApi.product(id, isoInstant(range.from), isoInstant(range.to), undefined, shopId)
      .then((r) => { setData(r.data); setFailed(false); })
      .catch((e) => { setFailed(true); toast?.error(e.message); })
      .finally(() => setLoading(false));
  }, [id, range.from, range.to, shopId]);
  useEffect(() => { load(); }, [load]);

  const info = data?.product || {};
  const k = data?.now || {};
  const pv = data?.prev || {};
  const st = data?.stock || {};
  const dec = unitDecimals(info.unit);
  const unit = unitLabel(info.unit);
  const q = (v) => `${quantity(v, dec)} ${unit}`;
  /* Sur'at (kuniga) — kamida bitta kasr xonasi: «dona» da 1.5 «2 dona»
     bo'lib yaxlitlanardi va kuniga ikki barobar ko'p sotilgandek ko'rinardi. */
  const qr = (v) => `${quantity(v, Math.max(1, dec))} ${unit}`;
  const periodLabel = t(`rpt2.p.${period}`);

  /* Chek — ro'yxatdagi qatorni bosganda serverdan to'liq olinadi
     (qatorda faqat shu tovar bor, chekda esa hamma tovarlar). */
  const openSale = (saleId) => {
    saleApi.getById(saleId)
      .then((r) => setSale(r?.data ?? r))
      .catch((e) => toast?.error(e.message));
  };

  const back = () => {
    const qs = new URLSearchParams({ tab: "products" });
    navigate(`/reports?${qs}`);
  };

  if (!busy && failed && !data) {
    return (
      <div className="rpt">
        <button type="button" className="btn btn-ghost" onClick={back}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("prep.back")}
        </button>
        <Empty icon="fa-box-open" text={t("prep.notFound")} />
      </div>
    );
  }

  return (
    <div className="rpt prep">
      {/* ── Sarlavha: tovar kim? ─────────────────────────────────────── */}
      <div className="prep-head">
        <button type="button" className="btn btn-ghost prep-head__back" onClick={back}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("prep.back")}
        </button>
        <div className="prep-head__main">
          <h1 className="prep-head__name">{info.name || "…"}</h1>
          <div className="prep-head__meta">
            {info.category && <span className="badge badge-blue">{info.category}</span>}
            {info.archived && <span className="badge badge-yellow">{t("prep.archived")}</span>}
            {info.barcode && <span className="prep-chip"><i className="fa-solid fa-barcode" aria-hidden="true" /> <span className="ek-num">{info.barcode}</span></span>}
            {info.plu && <span className="prep-chip">PLU <span className="ek-num">{info.plu}</span></span>}
            {info.salePrice != null && (
              <span className="prep-chip">{t("prep.col.salePrice")}: <b className="ek-num">{money(info.salePrice)}</b></span>
            )}
            {info.costPrice != null && (
              <span className="prep-chip">{t("prep.col.cost")}: <b className="ek-num">{money(info.costPrice)}</b></span>
            )}
          </div>
        </div>
        {info.id && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/inventory/${info.id}`)}>
            <i className="fa-solid fa-layer-group" aria-hidden="true" /> {t("prep.batches")}
          </button>
        )}
      </div>

      <div className="rpt-bar">
        <PeriodBar period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
        <div className="rpt-bar__tools">
          <button className="btn btn-outline btn-sm" onClick={load}
                  title={t("common.refresh")} aria-label={t("common.refresh")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          </button>
          <button className="btn btn-outline btn-sm" disabled={!data}
                  onClick={() => { try { exportProduct(data, range, periodLabel); }
                                   catch (e) { toast?.error(e.message); } }}>
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true" /> {t("rpt2.print")}
          </button>
        </div>
      </div>

      <div className="rpt-print-head">
        <b>{info.name}</b>
        <span>{t("rpt2.productReport")} · {periodLabel}</span>
        <span>{isoDay(range.from)} — {isoDay(new Date(range.to.getTime() - 1))}</span>
      </div>

      {busy || !data ? <SkeletonCards count={4} className="kpi-grid" /> : (
        <>
          <Lead q={num(k.soldQty) > 0
                    ? t("prep.leadSold", { p: periodLabel, q: q(k.soldQty), r: qr(k.perDay) })
                    : t("prep.leadNone", { p: periodLabel })}
                a={[
                  num(st.qty) <= 0 ? t("prep.leadOut")
                    : st.daysLeft == null ? t("prep.leadStockIdle", { q: q(st.qty) })
                    : t("prep.leadStock", { q: q(st.qty), n: st.daysLeft }),
                  st.lastSoldAt ? t("prep.lastSold", { v: dateTime(st.lastSoldAt) }) : "",
                ].filter(Boolean).join(" ")} />

          {/* ── To'rtta asosiy raqam ─────────────────────────────────── */}
          <div className="kpi-grid">
            <Kpi label={t("prep.sold")} value={q(k.soldQty)} now={k.soldQty} prev={pv.soldQty}
                 icon="fa-box" tone="brand" />
            <Kpi label={t("rpt2.netSales")} value={money(k.netSales)} now={k.netSales} prev={pv.netSales}
                 icon="fa-sack-dollar" hint={t("rpt2.netSalesHint")} />
            <Kpi label={t("rpt2.grossProfit")} value={money(k.profit)} now={k.profit} prev={pv.profit}
                 icon="fa-arrow-trend-up" tone={num(k.profit) < 0 ? "bad" : "good"}
                 sub={`${t("rpt2.margin")}: ${percent(k.margin)}`} hint={t("rpt2.grossProfitHint")} />
            {/* ⚠ Qoldiq — rang VA matn bilan: tugagan («Tugagan»), oz qolgan
                (sariq + «≈ 3 kunga yetadi»). Rang yolg'iz signal bo'lmaydi. */}
            <Kpi label={t("prep.stock")} value={q(st.qty)} icon="fa-warehouse"
                 tone={num(st.qty) <= 0 ? "bad" : st.daysLeft != null && st.daysLeft <= 7 ? "warn" : undefined}
                 sub={num(st.qty) <= 0 ? t("prep.outOfStock")
                   : st.daysLeft == null ? t("prep.notSelling")
                   : t("prep.daysLeft", { n: st.daysLeft })} />
          </div>
          <div className="kpi-grid">
            <Kpi label={t("prep.perDay")} value={qr(k.perDay)} icon="fa-calendar-day"
                 sub={t("prep.rate14", { v: qr(st.rate14) })} hint={t("prep.perDayHint")} />
            <Kpi label={t("prep.avgPrice")} value={money(k.avgPrice)} icon="fa-tag"
                 sub={info.salePrice != null ? t("prep.priceNow", { v: money(info.salePrice) }) : undefined} />
            <Kpi label={t("rpt2.receipts")} value={k.receipts ?? 0} now={k.receipts} prev={pv.receipts}
                 icon="fa-receipt" sub={t("prep.customers", { n: k.customers ?? 0 })} />
            <Kpi label={t("prep.returned")} value={q(k.returnedQty)} now={k.returnedQty} prev={pv.returnedQty}
                 icon="fa-rotate-left" invert tone={num(k.returnedQty) > 0 ? "warn" : undefined}
                 sub={num(k.returnedAmount) > 0 ? money(k.returnedAmount) : undefined} />
          </div>

          {/* ── Kunlar bo'yicha ──────────────────────────────────────── */}
          <Panel title={t("prep.daily")} icon="fa-chart-column" wide
                 right={<div className="rpt-bar__periods" role="tablist" aria-label={t("prep.daily")}>
                          {["qty", "sum"].map((m) => (
                            <button key={m} type="button" role="tab" aria-selected={metric === m}
                                    className={`rpt-seg${metric === m ? " is-on" : ""}`}
                                    onClick={() => setMetric(m)}>
                              {t(m === "qty" ? "prep.byQty" : "prep.bySum")}
                            </button>
                          ))}
                        </div>}>
            <div className="card-body">
              <BarChart height={220} empty={t("prep.noSales")} color={metric === "qty" ? C.sales : C.profit}
                        fmt={metric === "qty" ? (v) => quantity(v, dec) : shortNum}
                        bars={(data.series || []).map((x) => ({
                          label: x.label, value: num(metric === "qty" ? x.qty : x.net),
                        }))} />
            </div>
          </Panel>

          <div className="rpt-cols">
            <TopList title={t("prep.whoSold")} icon="fa-user-tie"
                     rows={(data.cashiers || []).map((c) => ({
                       name: c.name || "—", value: q(c.qty),
                       sub: `${money(c.net)} · ${t("rpt2.nReceipts", { n: c.receipts })}`,
                     }))} />
            <Panel title={t("prep.whenSold")} icon="fa-clock">
              <div className="card-body">
                <BarChart height={200} empty={t("prep.noSales")} color={C.cost}
                          fmt={(v) => quantity(v, dec)} bars={hourBars(data.hourly)} />
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* ── Har bir sotuv ──────────────────────────────────────────────── */}
      {busy || !data ? <SkeletonTable rows={6} cols={["text", "text", "wide", "num", "num"]} /> : (
        <>
          <Panel title={t("prep.lines")} icon="fa-list" wide
                 right={<span className="text-muted" style={{ fontSize: 12.5 }}>{t("prep.linesHint")}</span>}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>{t("prep.col.time")}</th><th>{t("prep.col.type")}</th>
                  <th>{t("prep.col.cashier")}</th><th>{t("prep.col.customer")}</th>
                  <th>{t("prep.col.qty")}</th><th>{t("prep.col.price")}</th>
                  <th>{t("prep.col.discount")}</th><th>{t("prep.col.sum")}</th>
                </tr></thead>
                <tbody>
                  {(data.lines || []).length ? (allLines ? data.lines : data.lines.slice(0, PAGE)).map((l, i) => {
                    const tp = lineType(l);
                    return (
                      <tr key={`${l.saleId}-${i}`} className="tr-link" tabIndex={0}
                          onClick={() => openSale(l.saleId)}
                          onKeyDown={(e) => { if (e.key === "Enter") openSale(l.saleId); }}>
                        <td className="mono">{dateTime(l.at)}</td>
                        <td><span className={`badge ${tp.badge}`}>{tp.label}</span></td>
                        <td>{l.cashier || "—"}</td>
                        <td>{l.customer || "—"}</td>
                        <td className={`mono fw-700${l.sign < 0 ? " text-danger" : ""}`}>
                          {l.sign < 0 ? "−" : ""}{q(l.qty)}
                        </td>
                        <td className="mono">{money(l.price)}</td>
                        <td className="mono">{num(l.discount) ? money(l.discount) : "—"}</td>
                        <td className={`mono fw-700${l.sign === 0 ? " text-muted" : l.sign < 0 ? " text-danger" : " text-blue"}`}>
                          {l.sign < 0 ? "−" : ""}{money(l.net)}
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={8}><Empty icon="fa-receipt" text={t("prep.noSales")} /></td></tr>}
                </tbody>
              </table>
            </div>
            <ListFoot shown={allLines ? data.lines.length : Math.min(PAGE, (data.lines || []).length)}
                      loaded={(data.lines || []).length} total={data.linesTotal}
                      onAll={() => setAllLines(true)} />
          </Panel>

          {/* ── Kirim-chiqim ─────────────────────────────────────────── */}
          <Panel title={t("prep.moves")} icon="fa-right-left" wide>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>{t("prep.col.time")}</th><th>{t("prep.col.type")}</th>
                  <th>{t("prep.col.qty")}</th><th>{t("prep.col.who")}</th><th>{t("prep.col.reason")}</th>
                </tr></thead>
                <tbody>
                  {(data.moves || []).length ? (allMoves ? data.moves : data.moves.slice(0, PAGE)).map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{dateTime(m.at)}</td>
                      <td><span className={`badge ${MOV_BADGE[m.type] || "badge-green"}`}>{t(`mov.${m.type}`)}</span></td>
                      <td className={`mono fw-700 ${num(m.delta) < 0 ? "text-danger" : "text-success"}`}>
                        {num(m.delta) > 0 ? "+" : num(m.delta) < 0 ? "−" : ""}{quantity(Math.abs(num(m.delta)), dec)} {unit}
                      </td>
                      <td>{m.by || "—"}</td>
                      <td className="text-muted">
                        {m.writeOffReason && <span className="badge badge-yellow">{t(`enum.writeOff.${m.writeOffReason}`)}</span>}{" "}
                        {m.reason || (m.writeOffReason ? "" : "—")}
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5}><Empty icon="fa-right-left" text={t("prep.noMoves")} /></td></tr>}
                </tbody>
              </table>
            </div>
            <ListFoot shown={allMoves ? data.moves.length : Math.min(PAGE, (data.moves || []).length)}
                      loaded={(data.moves || []).length} total={data.movesTotal}
                      onAll={() => setAllMoves(true)} />
          </Panel>

          <div className="rpt-cols">
            {/* ── Qo'shimcha ───────────────────────────────────────────── */}
            <Panel title={t("prep.more")} icon="fa-circle-info">
              <div className="card-body">
                <dl className="prep-dl">
                  <dt>{t("prep.lastIn")}</dt><dd className="ek-num">{st.lastInAt ? dateTime(st.lastInAt) : t("prep.never")}</dd>
                  <dt>{t("prep.lastSoldAt")}</dt><dd className="ek-num">{st.lastSoldAt ? dateTime(st.lastSoldAt) : t("prep.never")}</dd>
                  <dt>{t("prep.nearestExpiry")}</dt><dd className="ek-num">{st.nearestExpiry || "—"}</dd>
                  <dt>{t("prep.batchCount")}</dt><dd className="ek-num">{st.batches ?? 0}</dd>
                  <dt>{t("prep.stockValue")}</dt><dd className="ek-num">{money(st.value)}</dd>
                  <dt>{t("prep.minQty")}</dt><dd className="ek-num">{q(info.minQuantity)}</dd>
                  <dt>{t("prep.discount")}</dt><dd className="ek-num">{money(k.discount)}</dd>
                  <dt>{t("prep.activeDays")}</dt><dd className="ek-num">{k.activeDays ?? 0}</dd>
                  <dt>{t("rpt2.cogs")}</dt><dd className="ek-num">{money(k.cogs)}</dd>
                </dl>
              </div>
            </Panel>

            {/* ── Narx tarixi ──────────────────────────────────────────── */}
            <Panel title={t("prep.prices")} icon="fa-tags">
              {(data.prices || []).length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>
                      <th>{t("prep.col.time")}</th><th>{t("prep.col.salePrice")}</th>
                      <th>{t("prep.col.cost")}</th><th>{t("prep.col.who")}</th>
                    </tr></thead>
                    <tbody>
                      {data.prices.map((x, i) => (
                        <tr key={i} title={x.reason || undefined}>
                          <td className="mono">{dateTime(x.at)}</td>
                          <td className="mono">{priceChange(x.oldSale, x.newSale)}</td>
                          <td className="mono">{priceChange(x.oldCost, x.newCost)}</td>
                          <td>{x.by || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="card-body"><Empty icon="fa-tags" text={t("prep.noPrices")} /></div>}
            </Panel>
          </div>
        </>
      )}

      {sale && <SaleDetailModal sale={sale} onClose={() => setSale(null)} />}
    </div>
  );
}

/* ── Yordamchilar ─────────────────────────────────────────────────────── */

/** Chek qatorining turi — matn VA rang. Bekor qilingan hisobga kirmaydi. */
function lineType(l) {
  if (l.sign === 0) return { label: t("prep.cancelled"), badge: "badge-red" };
  if (l.type === "RETURN") return { label: t("prep.type.RETURN"), badge: "badge-yellow" };
  const key = `prep.type.${l.type || "SALE"}`;
  const label = t(key);
  return { label: label === key ? t("prep.type.SALE") : label, badge: "badge-green" };
}

/** Narx o'zgarishi: «12 000 → 13 500»; o'zgarmagan bo'lsa — bitta raqam. */
function priceChange(a, b) {
  if (b == null) return "—";
  if (a == null || num(a) === num(b)) return money(b);
  return `${money(a)} → ${money(b)}`;
}

/**
 * Soatlar — faqat savdo bo'lgan oraliq (kamida 8:00–20:00).
 * Kechasi bo'sh 0–6 soatlar grafikni siqib, kunduzgi farqni ko'rinmas qilardi.
 */
function hourBars(hourly = []) {
  const v = Array.from({ length: 24 }, (_, h) => num(hourly[h]));
  let a = v.findIndex((x) => x > 0);
  let b = 23 - [...v].reverse().findIndex((x) => x > 0);
  if (a < 0) return [];
  a = Math.min(a, 8); b = Math.max(b, 20);
  return v.slice(a, b + 1).map((x, i) => ({ label: String(a + i).padStart(2, "0"), value: x }));
}

/** Ro'yxat ostidagi qator: «Hammasini ko'rsatish» va server chegarasi haqida. */
function ListFoot({ shown, loaded, total, onAll }) {
  if (!loaded) return null;
  return (
    <div className="prep-foot">
      {shown < loaded && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onAll}>
          {t("prep.showAll", { n: loaded })}
        </button>
      )}
      {total > loaded && <span className="text-muted">{t("prep.capped", { n: loaded })}</span>}
    </div>
  );
}

/* ══ EXCEL — har bo'lim o'z varag'ida, raqamlar SON sifatida ══════════════ */
function exportProduct(d, range, periodLabel) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const head = (...cols) => cols.map((v) => ({ v, bold: true }));
  const k = d.now || {};
  const s = d.stock || {};
  const p = d.product || {};
  const sheets = [
    {
      name: t("rpt2.tabHome"),
      rows: [
        [{ v: p.name, bold: true }],
        [`${periodLabel}: ${isoDay(range.from)} — ${isoDay(new Date(range.to.getTime() - 1))}`],
        [],
        head(t("rpt2.metric"), t("common.sum")),
        [t("prep.sold"), n(k.soldQty)],
        [t("rpt2.netSales"), n(k.netSales)],
        [t("rpt2.cogs"), n(k.cogs)],
        [t("rpt2.grossProfit"), n(k.profit)],
        [t("rpt2.margin"), n(k.margin)],
        [t("prep.returned"), n(k.returnedQty)],
        [t("prep.discount"), n(k.discount)],
        [t("rpt2.receipts"), n(k.receipts)],
        [t("prep.avgPrice"), n(k.avgPrice)],
        [t("prep.perDay"), n(k.perDay)],
        [],
        [t("prep.stock"), n(s.qty)],
        [t("prep.stockValue"), n(s.value)],
        [t("prep.rate14Label"), n(s.rate14)],
        [t("prep.daysLeftLabel"), s.daysLeft == null ? "" : n(s.daysLeft)],
      ],
    },
    {
      name: t("prep.daily"),
      rows: [head(t("common.date"), t("prep.byQty"), t("prep.bySum")),
        ...(d.series || []).map((x) => [x.label, n(x.qty), n(x.net)])],
    },
    {
      name: t("prep.whoSold"),
      rows: [head(t("prep.col.cashier"), t("prep.byQty"), t("prep.bySum"), t("rpt2.receipts")),
        ...(d.cashiers || []).map((c) => [c.name || "", n(c.qty), n(c.net), n(c.receipts)])],
    },
    {
      name: t("prep.lines"),
      rows: [head(t("prep.col.time"), t("prep.col.type"), t("prep.col.cashier"), t("prep.col.customer"),
                  t("prep.col.qty"), t("prep.col.price"), t("prep.col.discount"), t("prep.col.sum")),
        ...(d.lines || []).map((l) => [dateTime(l.at), lineType(l).label, l.cashier || "", l.customer || "",
          n(l.qty) * (l.sign < 0 ? -1 : 1), n(l.price), n(l.discount), n(l.net) * (l.sign < 0 ? -1 : 1)])],
    },
    {
      name: t("prep.moves"),
      rows: [head(t("prep.col.time"), t("prep.col.type"), t("prep.col.qty"), t("prep.col.who"), t("prep.col.reason")),
        ...(d.moves || []).map((m) => [dateTime(m.at), t(`mov.${m.type}`), n(m.delta), m.by || "",
          [m.writeOffReason ? t(`enum.writeOff.${m.writeOffReason}`) : "", m.reason || ""].filter(Boolean).join(" · ")])],
    },
  ];
  if ((d.prices || []).length) {
    sheets.push({
      name: t("prep.prices"),
      rows: [head(t("prep.col.time"), t("prep.col.salePrice"), "", t("prep.col.cost"), "", t("prep.col.who")),
        ...d.prices.map((x) => [dateTime(x.at), n(x.oldSale), n(x.newSale), n(x.oldCost), n(x.newCost), x.by || ""])],
    });
  }
  const safe = String(p.name || "tovar").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);
  downloadXlsx(`tovar-${safe}-${isoDay(range.from)}`, sheets);
}
