import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
import { useNavigate } from "react-router-dom";
import { reportApi, inventoryApi, loyaltyApi } from "../api";
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
  const [signals, setSignals]   = useState(null);
  const [loyalty, setLoyalty]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [branchId, setBranchId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportApi.daily(branchId).then((r) => r.data).catch((err) => { toast.error(err.message); return null; }),
      inventoryApi.getLow().then((r) => r.data || []).catch(() => []),
      /* ⚠ Signallar jimgina yiqiladi: ular blokni BOYITADI, lekin ularsiz
         ham sahifa to'liq ishlaydi. Xatoni toast qilish har bir yangilanishda
         egasiga tushunarsiz xabar chiqarardi. */
      reportApi.signals(branchId).then((r) => r.data).catch(() => null),
      /* Sodiqlik natijasi — joriy oy. U ham qo'shimcha: yiqilsa sahifa
         ishlayveradi. */
      loyaltyApi.summary().then((r) => r.data).catch(() => null),
    ])
      .then(([daily, low, sig, loy]) => {
        setData(daily); setLowStock(low); setSignals(sig); setLoyalty(loy);
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  /* ── E'tibor talab qiladi ───────────────────────────────────────────────
     Tartib ATAYLAB shunday: yuqorida pul yo'qolayotgan joylar (kamomad,
     naqdsiz chetlanish, sanoq), pastda esa ish rejasi (tugagan tovar,
     qarzlar). Egasi ro'yxatni yuqoridan o'qiydi va birinchi ko'radigani
     eng qimmatga tushadigani bo'lishi kerak.

     ⚠ Har bir satr faqat NOLDAN katta bo'lsa chiqadi — chegara ichidagi
     farqni server allaqachon filtrlagan (`SignalService`). */
  const outOfStock = lowStock.filter((i) => (i.quantity ?? 0) <= 0);
  const belowMin   = lowStock.filter((i) => (i.quantity ?? 0) > 0);

  const sig = signals || {};
  const has = (row) => Number(row?.count) > 0;

  const attention = [
    has(sig.cashShortage) && {
      id: "cash", icon: "fa-sack-dollar", tone: "danger",
      text: t("dash.sigCashShort", { n: sig.cashShortage.count, d: sig.shiftWindowDays }),
      count: money(sig.cashShortage.amount),
      onClick: () => navigate("/audit?action=SHIFT_CLOSE"),
    },
    has(sig.nonCashDiff) && {
      id: "noncash", icon: "fa-credit-card", tone: "danger",
      text: t("dash.sigNonCashDiff", { n: sig.nonCashDiff.count }),
      count: money(sig.nonCashDiff.amount),
      onClick: () => navigate("/audit?action=SHIFT_CLOSE"),
    },
    has(sig.stockShortage) && {
      id: "stock", icon: "fa-clipboard-list", tone: "danger",
      text: t("dash.sigStockShort", { n: sig.stockShortage.count, d: sig.stockWindowDays }),
      count: money(sig.stockShortage.amount),
      onClick: () => navigate("/stock-take"),
    },
    sig.staleOpenShifts > 0 && {
      id: "stale", icon: "fa-clock", tone: "warning",
      text: t("dash.sigStaleShift"), count: sig.staleOpenShifts,
      onClick: () => navigate("/security?tab=shifts"),
    },
    sig.overLimitDebtors > 0 && {
      id: "overlimit", icon: "fa-user-lock", tone: "danger",
      text: t("dash.sigOverLimit"), count: sig.overLimitDebtors,
      onClick: () => navigate("/customers"),
    },
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
    has(sig.supplierDebt) && {
      id: "supplier", icon: "fa-truck", tone: "warning",
      text: t("dash.sigSupplierDebt", { n: sig.supplierDebt.count }),
      count: money(sig.supplierDebt.amount),
      onClick: () => navigate("/supply"),
    },
    has(sig.customerDebt) && {
      id: "credit", icon: "fa-hand-holding-dollar", tone: "info",
      text: t("dash.sigCustomerDebt", { n: sig.customerDebt.count }),
      count: money(sig.customerDebt.amount),
      onClick: () => navigate("/customers"),
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
          {/* ⚠ Ombor yo'qotishi faqat NOLDAN katta bo'lsa chiqadi va sof
              foydadan OLDIN turadi: sof foyda nega kamayganini yonidagi
              raqamdan ko'rish kerak, aks holda egasi sababini qidirardi.
              Nol bo'lganda ko'rsatish esa qatorni ortiqcha uzaytirardi. */}
          {Number(data?.inventoryLoss) > 0 && (
            <Kpi label={t("rpt.inventoryLoss")} value={data.inventoryLoss} format={money} />
          )}
          <Kpi label={t("rpt.netProfit")}   value={data?.netProfit     || 0} format={money}
               danger={Number(data?.netProfit) < 0} />
        </div>
      )}

      {/* ── E'tibor talab qiladi ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <AttentionList items={loading ? [] : attention} />
      </div>

      {/* ── Sodiqlik ──────────────────────────────────────────────────────
          ⚠ ATAYLAB «E'tibor talab qiladi» dan TASHQARIDA. U blok
          muammolar uchun; sodiqlik esa muammo emas va u yerga tushsa,
          egasi berilgan chegirmani zarar deb o'qirdi.

          ⚠ Chegirma YOLG'IZ ko'rsatilmaydi. Yolg'iz raqam xarajatdek
          o'qiladi, holbuki bu — sarmoya: uning qaytimi o'ng tomonda
          turgan tushum. Egasi nisbatni o'zi ko'radi. */}
      {!loading && loyalty?.receipts > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-award" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />
              {t("dash.loyalty")}
            </span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {t("dash.loyaltyThisMonth")}
            </span>
          </div>
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>{t("dash.loyaltyGiven")}</div>
              <div className="ek-num" style={{ fontSize: 18, fontWeight: 800 }}>{money(loyalty.discountGiven)}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>{t("dash.loyaltyRevenue")}</div>
              <div className="ek-num" style={{ fontSize: 18, fontWeight: 800, color: "var(--fg-success)" }}>
                {money(loyalty.revenue)}
              </div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>{t("dash.loyaltyCustomers")}</div>
              <div className="ek-num" style={{ fontSize: 18, fontWeight: 800 }}>{loyalty.tieredCustomers}</div>
            </div>
          </div>
        </div>
      )}

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
