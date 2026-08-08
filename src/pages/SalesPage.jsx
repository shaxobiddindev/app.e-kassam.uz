import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { saleApi } from "../api";
import { money } from "../utils";
import { BranchSelector, Modal } from "../components";
import { Empty, SearchBar, Badge } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useBadge } from "../context/BadgeProvider";
import { useAuth } from "../hooks/useAuth";
import { paymentEntry, saleStatus } from "../lib/ek-labels";
// ⚠ `Spinner` HAM shu yerdan. U chek chiqarish va bekor qilish tugmalarida
// FAQAT amal davomida chiziladi — shuning uchun import unutilgani sahifa
// ochilganda bilinmasdi, tugma bosilgan zahoti esa render'da
// `ReferenceError` bo'lib butun ilovani bo'sh oynaga aylantirardi.
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { printReceipt } from "../lib/ek-hardware";
import { topRole } from "../lib/ek-roles";

/* ── Chekni qayta chiqarish ────────────────────────────────────────────────
   Kassa ekranidagi Ctrl+P faqat OXIRGI chekni chiqaradi. Amalda esa mijoz
   yarim soatdan keyin qaytib kelib chek so'raydi — o'shanda uni tarixdan
   topib chiqarish kerak bo'ladi.

   Tarixdagi yozuv Kassa savatidan BOSHQA shaklda keladi
   (`productName`/`quantity`/`price`), shuning uchun chek quruvchi kutgan
   shaklga o'giriladi. */
function saleToReceipt(sale) {
  return {
    saleId: `A-${sale.id}`,
    cart: (sale.items || []).map((i) => ({
      name:      i.productName,
      qty:       i.quantity,
      salePrice: i.price,
    })),
    total:    sale.totalAmount,
    payType:  sale.paymentType,
    customer: sale.customerName ? { fullName: sale.customerName } : null,
    shopName: localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode") || "",
    cashier:  sale.cashierName || "",
  };
}

/* Sotuv holati — lug'atdan. `tone` Badge rang nomiga o'giriladi. */
const TONE_COLOR = { success: "green", danger: "red", warning: "yellow", info: "blue", neutral: "gray" };
const statusBadge = (v) => {
  const e = saleStatus(v);
  return { label: e.label, color: TONE_COLOR[e.tone] || "blue" };
};
/* To'lov turi yorlig'i — CLICK va PAYME ham qamrab olinadi.
   Ilgari bu yerda uchta qiymatli mahalliy jadval bor edi va Click/Payme
   sotuvlarida xom `CLICK` matni chiqardi. */
function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

export default function SalesPage({ toast }) {
  const confirm                   = useConfirm();
  // ⚠ `guard` — bekor qilishda server 428 qaytarsa bajik modalini ochadi.
  // U olinmasa `handleCancel` da `ReferenceError` bo'lardi: `useBadge`
  // import qilingan-u, CHAQIRILMAGAN edi — aynan yuqoridagi `Spinner`
  // bilan bir xil tuzoq, faqat bu safar bekor qilish tugmasida.
  const { guard }                 = useBadge();
  const { user }                  = useAuth();
  /* ⚠ ENG YUQORI rol bo'yicha, "CASHIER bormi" bo'yicha EMAS.
     Xodimda bir nechta rol bo'lishi mumkin va sessiyada ular vergul bilan
     saqlanadi. Ilgari bu yerda `roleSet(...).has("CASHIER")` turardi va
     EGASI ham "kassir" deb hisoblanardi: eski hisoblarda `getRoles()`
     qo'shimchali edi (OWNER → hamma rol, shu jumladan CASHIER), shuning
     uchun egaga faqat BUGUNGI sotuvlar ko'rinardi va tarix "yo'q" bo'lib
     qolardi. Endi:
       OWNER + CASHIER      → OWNER      → hamma sotuv
       SHOP_ADMIN + CASHIER → SHOP_ADMIN → hamma sotuv
       faqat CASHIER        → CASHIER    → bugungi (ataylab shunday) */
  const isCashier                 = topRole(user?.role) === "CASHIER";
  const [printing, setPrinting]   = useState(null);
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]       = useState("");
  // Holat bo'yicha saralash. Standart — BARCHASI: tarix to'liq ko'rinishi
  // kerak, filtrni foydalanuvchi o'zi tanlaydi.
  const [status, setStatus]       = useState("ALL");
  const [detail, setDetail]       = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [branchId, setBranchId]   = useState(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saleApi.getAll(branchId);
      // Teskari tartib: yangi sotuvlar yuqorida
      const sorted = (res.data || []).sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
      });
      setSales(sorted);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadSales(); }, [loadSales]);

  // CASHIER uchun faqat bugungi sotuvlar
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  /**
   * Tarixdagi sotuvning chekini qayta chiqaradi.
   *
   * ⚠ BEKOR QILINGAN sotuv uchun chek CHIQARILMAYDI. Chek — xarid dalili;
   * bekor qilingan sotuvga haqiqiy ko'rinishdagi chek berish mijoz qo'lida
   * yaroqli hujjat qoldirardi.
   */
  const handleReprint = async (sale) => {
    if (sale.status === "CANCELLED") return;
    setPrinting(sale.id);
    try {
      await printReceipt(saleToReceipt(sale));
      toast.success(t("kassa.reprint"));
    } catch (err) {
      toast.error(`${t("hw.printFailed")}: ${err.message}`);
    } finally {
      setPrinting(null);
    }
  };

  const handleCancel = async (sale) => {
    const ok = await confirm({
      title: t("sales.cancelTitle"),
      message: `#${sale.id} raqamli sotuvni bekor qilishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`,
      type: "danger"
    });
    if (!ok) return;
    setCancelling(sale.id);
    try {
      // Server 428 qaytarsa `guard` bajik modalini ochadi va tasdiqdan
      // keyin bekor qilishni o'zi qayta yuboradi.
      await guard(() => saleApi.cancel(sale.id));
      toast.success(t("sales.cancelled"));
      loadSales();
      setDetail(null);
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
    } finally {
      setCancelling(null);
    }
  };

  // Holat filtri qidiruvdan OLDIN qo'llanadi, shunda chiplardagi sonlar
  // qidiruvga bog'liq bo'lmay, "shu do'konda nechta bekor qilingan sotuv
  // bor" degan savolga javob beradi.
  const byPeriod = sales.filter((s) => {
    // CASHIER bo'lsa faqat bugungi
    if (isCashier && s.createdAt) {
      const saleDate = new Date(s.createdAt);
      if (saleDate < todayStart) return false;
    }
    return true;
  });
  const counts = {
    ALL:       byPeriod.length,
    PAID:      byPeriod.filter((s) => s.status === "PAID").length,
    CANCELLED: byPeriod.filter((s) => s.status === "CANCELLED").length,
  };

  const filtered = byPeriod
    .filter((s) => {
      if (status !== "ALL" && s.status !== status) return false;
      // Qidiruv
      if (!search) return true;
      const q = search.toLowerCase();
      return String(s.id).includes(q) ||
        s.cashierName?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q);
    });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("sales.title")}</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t("sales.search")} style={{ width: 280 }} />
            {isCashier && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", background: "var(--blue-l)", padding: "5px 12px", borderRadius: 20 }}>
                <i className="fa-solid fa-calendar-day" style={{ marginRight: 5 }} />
                Bugungi sotuvlar ({counts.ALL})
              </span>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadSales}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
        </div>

        {/* Holat filtri. Bekor qilingan sotuvlar endi ro'yxatda turadi —
            ularni ajratib ko'rish uchun shu qator kerak. Chipdagi son
            qidiruvga bog'liq emas: u davr bo'yicha JAMI holatni ko'rsatadi. */}
        <div className="card-header" style={{ paddingTop: 0 }}>
          <div className="cat-tabs" role="tablist" aria-label={t("common.status")}>
            {[
              { key: "ALL",       label: t("common.all") },
              { key: "PAID",      label: saleStatus("PAID").label },
              { key: "CANCELLED", label: saleStatus("CANCELLED").label },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={status === f.key}
                className={`cat-tab ${status === f.key ? "active" : ""}`}
                onClick={() => setStatus(f.key)}
              >
                {f.label} <span className="mono">({counts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          {busy ? <SkeletonTable rows={8} cols={["narrow", "text", "text", "num", "text", "text", "text"]} /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("sales.colCashier")}</th>
                  <th>{t("cust.col")}</th>
                  <th>{t("common.sum")}</th>
                  <th>{t("sales.colPayment")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.date")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((sale) => {
                  const st = statusBadge(sale.status);
                  return (
                    <tr key={sale.id}>
                      <td className="mono fw-800 text-muted">#{sale.id}</td>
                      <td className="fw-700">{sale.cashierName || "—"}</td>
                      <td>{sale.customerName || <span className="text-muted">—</span>}</td>
                      <td><span className="mono fw-700 text-blue">{money(sale.totalAmount)}</span></td>
                      <td><span style={{ fontSize: 13 }}><PayLabel type={sale.paymentType} /></span></td>
                      <td><Badge color={st.color}>{st.label}</Badge></td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleString("uz-UZ") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn-icon" title={t("sales.details")} onClick={() => setDetail(sale)}>
                            <i className="fa-solid fa-eye" />
                          </button>
                          {/* Chek — bekor qilinmagan sotuvlar uchun. Mijoz
                              keyinroq qaytib kelib chek so'raganda kerak. */}
                          {sale.status !== "CANCELLED" && (
                            <button
                              className="btn-icon"
                              title={t("kassa.reprint")}
                              onClick={() => handleReprint(sale)}
                              disabled={printing === sale.id}
                            >
                              {printing === sale.id ? <Spinner small /> : <i className="fa-solid fa-print" />}
                            </button>
                          )}
                          {sale.status !== "CANCELLED" && (
                            <button
                              className="btn-icon danger"
                              title={t("common.cancel")}
                              onClick={() => handleCancel(sale)}
                              disabled={cancelling === sale.id}
                            >
                              {cancelling === sale.id ? <Spinner small /> : <i className="fa-solid fa-ban" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8}><Empty icon="fa-receipt" text={t("sales.notFound")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detail && (
        <Modal
          title={`Sotuv #${detail.id}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              {detail.status !== "CANCELLED" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleReprint(detail)}
                  disabled={printing === detail.id}
                >
                  {printing === detail.id ? <Spinner small /> : <i className="fa-solid fa-print" />}
                  {t("kassa.reprint")}
                </button>
              )}
              {detail.status !== "CANCELLED" && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleCancel(detail)}
                  disabled={cancelling === detail.id}
                >
                  {cancelling === detail.id ? <Spinner small /> : <i className="fa-solid fa-ban" />}
                  {t("common.cancel")}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </>
          }
        >
          {/* Asosiy info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: t("sales.colCashier"),    value: detail.cashierName || "—" },
              { label: t("cust.col"),     value: detail.customerName || "—" },
              { label: t("sales.colPayment"),    value: <PayLabel type={detail.paymentType} /> },
              { label: t("common.status"),    value: <Badge color={statusBadge(detail.status).color}>{statusBadge(detail.status).label}</Badge> },
              { label: t("common.date"),      value: detail.createdAt ? new Date(detail.createdAt).toLocaleString("uz-UZ") : "—" },
              { label: t("common.total"),      value: <span className="mono fw-700 text-blue">{money(detail.totalAmount)}</span> },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--bg)", borderRadius: 8, padding: "9px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Mahsulotlar */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
            Mahsulotlar ({detail.items?.length || 0})
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("products.col")}</th><th>{t("common.count")}</th><th>{t("sales.colPrice")}</th><th>{t("common.total")}</th></tr>
              </thead>
              <tbody>
                {(detail.items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="fw-700">{item.productName}</td>
                    <td><Badge color="blue">{item.quantity}</Badge></td>
                    <td className="mono">{money(item.price)}</td>
                    <td className="mono fw-700 text-blue">{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
