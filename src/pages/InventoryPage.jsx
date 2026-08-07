import { useEffect, useState, useCallback } from "react";
import { t } from "../lib/ek-i18n";
import { inventoryApi } from "../api";
import { BranchSelector, Modal } from "../components";
import { Empty, SearchBar } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { money } from "../utils";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

/* Jurnal turlari — rang bilan: kirim yashil, chiqim qizil, to'g'irlash sariq.
   Omborchi ro'yxatga qarab o'qimasdan ham manzarani ko'rsin. */
const MOV_BADGE = {
  IN:         "badge-green",
  SALE:       "badge-red",
  EXPIRED:    "badge-red",
  CORRECTION: "badge-yellow",
};

export default function InventoryPage({ toast }) {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null); // null | inventoryItem  (kirim)
  const [correct, setCorrect] = useState(null); // null | inventoryItem  (to'g'irlash)
  const [qty, setQty]         = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [branchId, setBranchId] = useState(null);

  // Kirim-chiqim jurnali — alohida ko'rinish (jadval o'rnida)
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(false);

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

  const loadMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const res = await inventoryApi.getMovements();
      setMovements(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMovLoading(false);
    }
  }, []);

  useEffect(() => { if (showHistory) loadMovements(); }, [showHistory, loadMovements]);

  const filtered = items.filter((item) =>
    item.productName?.toLowerCase().includes(search.toLowerCase()) ||
    (item.barcode || "").includes(search)
  );

  const openModal = (item) => {
    setModal(item);
    setQty("");
    setExpiryDate("");
    setReason("");
  };

  const openCorrect = (item) => {
    setCorrect(item);
    setQty(String(item.quantity ?? ""));
    setReason("");
  };

  // Mahsulot bir marta muddat bilan kiritilgan bo'lsa — MUDDATLI: keyingi
  // kirimlarda muddat majburiy (backend ham xuddi shuni tekshiradi). Sut
  // kabi tovarda muddat unutilsa, o'sha partiya nazoratsiz qolardi.
  const productHasExpiry = (item) =>
    items.some((i) => i.productId === item.productId && i.expiryDate);

  const handleAddStock = async () => {
    if (!qty || Number(qty) <= 0) {
      toast.error(t("inv.needQty"));
      return;
    }
    if (!expiryDate && productHasExpiry(modal)) {
      toast.error(t("inv.needExpiry"));
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.addStock(modal.productId, Number(qty), expiryDate || null, reason);
      toast.success(`${qty} dona kirim qilindi`);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCorrect = async () => {
    if (qty === "" || Number(qty) < 0) {
      toast.error(t("inv.needQty"));
      return;
    }
    // To'g'irlashda sabab MAJBURIY: jurnal "nima sababdan" degan savolga
    // javob berishi kerak — sababsiz to'g'irlash nazoratni yo'qqa chiqaradi.
    if (!reason.trim()) {
      toast.error(t("inv.correctNeedReason"));
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.correctBatch(correct.inventoryId, Number(qty), reason.trim());
      toast.success(t("inv.correctTitle"));
      setCorrect(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtWhen = (iso) => {
    try { return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }); }
    catch (_) { return iso; }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("inv.title")}</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("products.search")}
            style={{ width: 320 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`btn btn-sm ${showHistory ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <i className="fa-solid fa-clock-rotate-left" /> {t("inv.history")}
            </button>
            <button className="btn btn-outline btn-sm" onClick={showHistory ? loadMovements : loadData} title={t("products.refreshTitle")}>
              <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          {showHistory ? (
            /* ── Kirim-chiqim jurnali ── */
            movLoading ? (
              <SkeletonTable rows={8} cols={["text", "wide", "num", "text", "text"]} />
            ) : movements.length === 0 ? (
              <Empty text={t("inv.histEmpty")} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("inv.histWhen")}</th>
                    <th>{t("products.col")}</th>
                    <th>{t("inv.histType")}</th>
                    <th>{t("inv.histDelta")}</th>
                    <th>{t("inv.expiry")}</th>
                    <th>{t("inv.histWho")}</th>
                    <th>{t("inv.reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtWhen(m.createdAt)}</td>
                      <td><div className="fw-700">{m.productName}</div></td>
                      <td>
                        <span className={`badge ${MOV_BADGE[m.type] || "badge-green"}`}>
                          {t(`mov.${m.type}`)}
                        </span>
                      </td>
                      <td className="mono fw-700" style={{ color: m.delta < 0 ? "var(--red, #dc2626)" : "var(--green, #16a34a)" }}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td>{m.expiryDate || "-"}</td>
                      <td>{m.performedBy}</td>
                      <td className="text-muted" style={{ maxWidth: 260 }}>{m.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : busy ? (
            <SkeletonTable rows={8} cols={["wide", "num", "num", "text"]} />
          ) : filtered.length === 0 ? (
            <Empty text={t("inv.notFound")} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("products.barcode")}</th>
                  <th>{t("inv.stock")}</th>
                  <th>{t("products.costPrice")}</th>
                  <th>{t("products.salePrice")}</th>
                  <th>{t("inv.expiry")}</th>
                  <th>{t("common.status")}</th>
                  {!branchId && <th className="text-end">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.inventoryId}
                    style={
                      item.status === "EXPIRED" || item.expired
                        ? { opacity: 0.6, background: "rgba(239,68,68,0.05)" }
                        : undefined
                    }
                  >
                    <td>
                      <div className="fw-700">{item.productName}</div>
                    </td>
                    <td><code className="mono">{item.barcode || "-"}</code></td>
                    <td>
                      <span className={`badge ${item.quantity <= item.minQuantity ? "badge-red" : "badge-green"}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td>{money(item.costPrice)}</td>
                    <td>{money(item.salePrice)}</td>
                    <td>{item.expiryDate || t("inv.noExpiry")}</td>
                    <td>
                      <span
                        className={`badge ${
                          item.status === "EXPIRED" || item.expired
                            ? "badge-red"
                            : "badge-green"
                        }`}
                      >
                        {item.status === "EXPIRED" || item.expired
                          ? t("enum.inventory.EXPIRED")
                          : t("enum.shopStatus.ACTIVE")}
                      </span>
                    </td>
                    {!branchId && (
                      <td className="text-end">
                        <button className="btn btn-primary btn-sm" onClick={() => openModal(item)}>
                          <i className="fa-solid fa-plus" /> {t("inv.receive")}
                        </button>{" "}
                        <button className="btn btn-outline btn-sm" onClick={() => openCorrect(item)} title={t("inv.correctHint")}>
                          <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
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
          title={`${t("inv.receive")} — ${modal.productName}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-green btn-sm"
                onClick={handleAddStock}
                disabled={saving || !qty}
              >
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("inv.receiveAction")}
              </button>
            </>
          }
        >
          {/* Muddati o'tgan ogohlantirish */}
          {(modal.status === "EXPIRED" || modal.expired) && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 13,
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              ⚠️ {t("inv.expiredWarn")}
            </div>
          )}

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
              {t("inv.currentQty")}
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {modal.quantity} dona
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">{`${t("inv.receiveQty")} *`}</label>
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

          {/* Muddat: mahsulot ilgari muddat bilan kiritilgan bo'lsa MAJBURIY
              (yulduzcha + hint yo'q), aks holda ixtiyoriy — muddatsiz
              tovarlar (idish, kanstovar) uchun bo'sh qoldiriladi. */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">
              {t("inv.expiry")}{productHasExpiry(modal) ? " *" : ""}
            </label>
            <input
              className="form-input"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            {!productHasExpiry(modal) && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("inv.expiryOptional")}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("inv.reason")}</label>
            <input
              className="form-input"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("inv.reasonPh")}
              onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
            />
          </div>
        </Modal>
      )}

      {/* ── To'g'irlash Modal ── */}
      {correct && (
        <Modal
          title={`${t("inv.correctTitle")} — ${correct.productName}`}
          onClose={() => setCorrect(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCorrect(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCorrect}
                disabled={saving || qty === "" || !reason.trim()}
              >
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("inv.correctAction")}
              </button>
            </>
          }
        >
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
              {t("inv.currentQty")}
              {correct.expiryDate ? ` · ${correct.expiryDate}` : ` · ${t("inv.noExpiry")}`}
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {correct.quantity} dona
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">{`${t("inv.correctQty")} *`}</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {t("inv.correctHint")}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{`${t("inv.reason")} *`}</label>
            <input
              className="form-input"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("inv.correctReasonPh")}
              onKeyDown={(e) => e.key === "Enter" && handleCorrect()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
