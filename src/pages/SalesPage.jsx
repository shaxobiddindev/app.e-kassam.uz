import { useCallback, useEffect, useState } from "react";
import { saleApi } from "../api";
import { money } from "../utils";
import { BranchSelector, Modal } from "../components";
import { Loader, Empty, SearchBar, Badge } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";

const STATUS_MAP = {
  CREATED:   { label: "Yangi",       color: "blue"   },
  PAID:      { label: "To'langan",   color: "green"  },
  CANCELLED: { label: "Bekor",       color: "red"    },
};
const PAYMENT_LABELS = { 
  CASH: <><i className="fa-solid fa-money-bill-1" /> Naqd</>, 
  CARD: <><i className="fa-solid fa-credit-card" /> Karta</>, 
  MIXED: <><i className="fa-solid fa-shuffle" /> Aralash</> 
};

export default function SalesPage({ toast }) {
  const confirm                   = useConfirm();
  const { user }                  = useAuth();
  const isCashier                 = user?.role === "CASHIER";
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
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

  const handleCancel = async (sale) => {
    const ok = await confirm({
      title: "Sotuvni bekor qilish",
      message: `#${sale.id} raqamli sotuvni bekor qilishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`,
      type: "danger"
    });
    if (!ok) return;
    setCancelling(sale.id);
    try {
      await saleApi.cancel(sale.id);
      toast.success("Sotuv bekor qilindi");
      loadSales();
      setDetail(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const filtered = sales
    .filter((s) => {
      // CASHIER bo'lsa faqat bugungi
      if (isCashier && s.createdAt) {
        const saleDate = new Date(s.createdAt);
        if (saleDate < todayStart) return false;
      }
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
          <h2 className="page-title">Sotuvlar tarixi</h2>
          <p className="page-subtitle">Barcha amalga oshirilgan savdolar</p>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="ID, kassir yoki mijoz..." style={{ width: 280 }} />
            {isCashier && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", background: "var(--blue-l)", padding: "5px 12px", borderRadius: 20 }}>
                <i className="fa-solid fa-calendar-day" style={{ marginRight: 5 }} />
                Bugungi sotuvlar ({filtered.length})
              </span>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadSales}>
            <i className="fa-solid fa-rotate-right" /> Yangilash
          </button>
        </div>

        <div className="table-wrap">
          {loading ? <Loader /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kassir</th>
                  <th>Mijoz</th>
                  <th>Summa</th>
                  <th>To'lov</th>
                  <th>Status</th>
                  <th>Sana</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((sale) => {
                  const st = STATUS_MAP[sale.status] || { label: sale.status, color: "blue" };
                  return (
                    <tr key={sale.id}>
                      <td className="mono fw-800 text-muted">#{sale.id}</td>
                      <td className="fw-700">{sale.cashierName || "—"}</td>
                      <td>{sale.customerName || <span className="text-muted">—</span>}</td>
                      <td><span className="mono fw-700 text-blue">{money(sale.totalAmount)}</span></td>
                      <td><span style={{ fontSize: 13 }}>{PAYMENT_LABELS[sale.paymentType] || sale.paymentType}</span></td>
                      <td><Badge color={st.color}>{st.label}</Badge></td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleString("uz-UZ") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn-icon" title="Batafsil" onClick={() => setDetail(sale)}>
                            <i className="fa-solid fa-eye" />
                          </button>
                          {sale.status !== "CANCELLED" && (
                            <button
                              className="btn-icon danger"
                              title="Bekor qilish"
                              onClick={() => handleCancel(sale)}
                              disabled={cancelling === sale.id}
                            >
                              <i className={`fa-solid ${cancelling === sale.id ? "fa-spinner fa-spin" : "fa-ban"}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8}><Empty icon="fa-receipt" text="Sotuv topilmadi" /></td></tr>
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
                  className="btn btn-danger btn-sm"
                  onClick={() => handleCancel(detail)}
                  disabled={cancelling === detail.id}
                >
                  <i className={`fa-solid ${cancelling === detail.id ? "fa-spinner fa-spin" : "fa-ban"}`} />
                  Bekor qilish
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>Yopish</button>
            </>
          }
        >
          {/* Asosiy info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Kassir",    value: detail.cashierName || "—" },
              { label: "Mijoz",     value: detail.customerName || "—" },
              { label: "To'lov",    value: PAYMENT_LABELS[detail.paymentType] || detail.paymentType },
              { label: "Status",    value: <Badge color={STATUS_MAP[detail.status]?.color || "blue"}>{STATUS_MAP[detail.status]?.label || detail.status}</Badge> },
              { label: "Sana",      value: detail.createdAt ? new Date(detail.createdAt).toLocaleString("uz-UZ") : "—" },
              { label: "Jami",      value: <span className="mono fw-700 text-blue">{money(detail.totalAmount)}</span> },
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
                <tr><th>Mahsulot</th><th>Soni</th><th>Narxi</th><th>Jami</th></tr>
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
