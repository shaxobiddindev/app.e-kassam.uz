import { useEffect, useState, useCallback } from "react";
import { inventoryApi } from "../api";
import { BranchSelector, Modal } from "../components";
import { Loader, Empty, SearchBar } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { money } from "../utils";

export default function InventoryPage({ toast }) {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null); // null | inventoryItem
  const [qty, setQty]         = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving]   = useState(false);
  const [branchId, setBranchId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getAll(branchId);
      setItems(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = items.filter((item) =>
    item.productName?.toLowerCase().includes(search.toLowerCase()) ||
    (item.barcode || "").includes(search)
  );

  const openModal = (item) => {
    setModal(item);
    setQty("");
    setExpiryDate("");
  };

  const handleAddStock = async () => {
    if (!qty || Number(qty) <= 0) {
      toast.error("Miqdorni kiriting");
      return;
    }
    if (!expiryDate) {
      toast.error("Yaroqlilik muddatini kiritish majburiy");
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.addStock(modal.productId, Number(qty), expiryDate);
      toast.success(`${qty} dona kirim qilindi`);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">Ombor</h2>
          <p className="page-subtitle">Mahsulotlar qoldig'i va monitoringi</p>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Nom yoki barkod bo'yicha qidirish..."
            style={{ width: 320 }}
          />
        </div>

        <div className="table-wrap">
          {loading ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <Empty text="Omborda mahsulot topilmadi" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>Barkod</th>
                  <th>Qoldiq</th>
                  <th>Tan narxi</th>
                  <th>Sotuv narxi</th>
                  <th>Yaroqlilik muddati</th>
                  {!branchId && <th className="text-end">Amallar</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <div className="fw-700">{item.productName}</div>
                    </td>
                    <td><code className="mono">{item.barcode || "-"}</code></td>
                    <td>
                      <span className={`badge ${item.quantity <= 5 ? "badge-red" : "badge-green"}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td>{money(item.costPrice)}</td>
                    <td>{money(item.salePrice)}</td>
                    <td>{item.expiryDate || "-"}</td>
                    {!branchId && (
                      <td className="text-end">
                        <button className="btn btn-primary btn-sm" onClick={() => openModal(item)}>
                          <i className="fa-solid fa-plus" /> Kirim
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Kirim Modal ── */}
      {modal && (
        <Modal
          title={`Kirim — ${modal.productName}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>
                Bekor
              </button>
              <button
                className="btn btn-green btn-sm"
                onClick={handleAddStock}
                disabled={saving || !qty}
              >
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "Saqlanmoqda..." : "Kirim qilish"}
              </button>
            </>
          }
        >
          {/* Hozirgi miqdor */}
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
              Hozirgi miqdor
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {modal.quantity} dona
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Kirim miqdori *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="masalan: 50"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Yaroqlilik muddati *</label>
            <input
              className="form-input"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
