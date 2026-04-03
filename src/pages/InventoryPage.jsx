import { useEffect, useState } from "react";
import { inventoryApi } from "../api";
import Modal from "../components/Modal";
import { Loader, Empty } from "../components/ui";

export default function InventoryPage({ toast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | inventoryItem
  const [qty, setQty]         = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving]   = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-warehouse text-blue" />
            Ombor holati
          </span>
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            <i className="fa-solid fa-rotate-right" /> Yangilash
          </button>
        </div>

        <div className="table-wrap">
          {loading ? (
            <Loader />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>Miqdor</th>
                  <th>Min. miqdor</th>
                  <th>Holat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => {
                    const isLow = item.quantity <= item.minQuantity;
                    return (
                      <tr key={item.id}>
                        <td className="fw-700">{item.productName}</td>
                        <td>
                          <span className="mono fw-800" style={{ fontSize: 15 }}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="text-muted">{item.minQuantity}</td>
                        <td>
                          {isLow ? (
                            <span className="badge badge-red">
                              <i className="fa-solid fa-triangle-exclamation" /> Kam
                            </span>
                          ) : (
                            <span className="badge badge-green">
                              <i className="fa-solid fa-check" /> Yetarli
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => openModal(item)}>
                            <i className="fa-solid fa-plus" /> Kirim
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <Empty icon="fa-boxes-stacked" text="Ombor bo'sh" />
                    </td>
                  </tr>
                )}
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
