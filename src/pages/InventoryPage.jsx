import { useEffect, useState, useCallback, useMemo } from "react";
import { t } from "../lib/ek-i18n";
import { inventoryApi } from "../api";
import { BranchSelector, Modal } from "../components";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { useAuth } from "../hooks/useAuth";
import { useBadge } from "../context/BadgeProvider";
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

const isBatchExpired = (b) => b.status === "EXPIRED" || b.expired;

/* Chiqit turkumlari — qoldiq KAMAYGANDA so'raladi.
   Ro'yxat serverdagi `WriteOffReason` bilan bir xil tartibda. */
const WRITE_OFF_REASONS = [
  { value: "BREAKAGE",        icon: "fa-hammer" },
  { value: "SPOILAGE",        icon: "fa-triangle-exclamation" },
  { value: "EXPIRY",          icon: "fa-hourglass-end" },
  { value: "THEFT",           icon: "fa-user-secret" },
  { value: "SUPPLIER_RETURN", icon: "fa-truck-arrow-right" },
  { value: "OWN_USE",         icon: "fa-store" },
  { value: "RECOUNT",         icon: "fa-calculator" },
  { value: "OTHER",           icon: "fa-ellipsis" },
];

/**
 * Partiyalarni MAHSULOT bo'yicha guruhlash.
 *
 * ⚠ Jadval mahsulotga BITTA qator ko'rsatadi. Backend har xil muddatli
 * kirimni alohida partiya qilib saqlaydi (FEFO uchun shart) va ilgari har
 * partiya alohida qator edi — ikkinchi kirimdan keyin omborchi "mahsulot
 * ikkita bo'lib qoldi" deb ko'rardi. Endi asosiy qatorda jami sotiladigan
 * qoldiq, partiyalar esa chevron bilan ochiladi.
 */
function groupByProduct(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.productId)) map.set(item.productId, []);
    map.get(item.productId).push(item);
  }
  return [...map.values()].map((batches) => {
    // FEFO tartibi: muddati yaqin birinchi, muddatsiz eng oxirida
    const sorted = [...batches].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    });
    const valid = sorted.filter((b) => !isBatchExpired(b));
    const sellable = valid.reduce((s, b) => s + (b.quantity || 0), 0);
    const minQ = Math.min(...sorted.map((b) => b.minQuantity ?? 5));
    // "Chirigan" — sotiladigan qoldiq yo'g'u, chirigan qoldiq BOR bo'lsa.
    // Shunchaki tugagan mahsulot chirigan emas.
    const expiredAll = sellable === 0 &&
      sorted.some((b) => isBatchExpired(b) && (b.quantity || 0) > 0);
    const nearest = valid.find((b) => b.expiryDate)?.expiryDate || null;
    const f = sorted[0];
    return {
      productId: f.productId,
      productName: f.productName,
      barcode: f.barcode,
      markingGroup: f.markingGroup,
      costPrice: f.costPrice,
      salePrice: f.salePrice,
      batches: sorted,
      sellable,
      minQ,
      nearest,
      expiredAll,
    };
  });
}

export default function InventoryPage({ toast }) {
  const { user } = useAuth();
  const { guard } = useBadge();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null); // null | {productId,...}  (kirim)
  const [correct, setCorrect] = useState(null); // null | batch            (to'g'irlash)
  const [qty, setQty]         = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason]   = useState("");
  /* Chiqit turkumi — faqat to'g'irlashda va faqat qoldiq kamayganda. */
  const [woReason, setWoReason] = useState("");
  /* Markirovkali tovar kirimida skanerlangan yorliqlar. Miqdor shu
     ro'yxatdan kelib chiqadi — qo'lda yozilmaydi. */
  const [markCodes, setMarkCodes] = useState([]);
  const [markScan, setMarkScan]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [branchId, setBranchId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set()); // productId'lar

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

  const groups = useMemo(() => groupByProduct(items), [items]);

  const filtered = groups.filter((g) =>
    g.productName?.toLowerCase().includes(search.toLowerCase()) ||
    (g.barcode || "").includes(search)
  );

  const toggleExpand = (productId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const openModal = (group) => {
    setModal(group);
    setQty("");
    setExpiryDate("");
    setReason("");
    setMarkCodes([]);
  };

  const openCorrect = (batch) => {
    setCorrect(batch);
    setQty(String(batch.quantity ?? ""));
    setReason("");
    setWoReason("");
  };

  // Mahsulot bir marta muddat bilan kiritilgan bo'lsa — MUDDATLI: keyingi
  // kirimlarda muddat majburiy (backend ham xuddi shuni tekshiradi). Sut
  // kabi tovarda muddat unutilsa, o'sha partiya nazoratsiz qolardi.
  const productHasExpiry = (g) =>
    items.some((i) => i.productId === g.productId && i.expiryDate);

  const handleAddStock = async () => {
    const marked = !!modal.markingGroup;

    // Markirovkali tovarda miqdor yorliqlar sonidan keladi: "50" deb yozib
    // 48 ta yorliq skanerlansa, ikki dona kodsiz qolardi va ular kassada
    // umuman sotilmasdi.
    if (marked && markCodes.length === 0) {
      toast.error(t("marking.required"));
      return;
    }
    if (!marked && (!qty || Number(qty) <= 0)) {
      toast.error(t("inv.needQty"));
      return;
    }
    if (!expiryDate && productHasExpiry(modal)) {
      toast.error(t("inv.needExpiry"));
      return;
    }
    setSaving(true);
    try {
      const amount = marked ? markCodes.length : Number(qty);
      const res = await inventoryApi.addStock(
        modal.productId, amount, expiryDate || null, reason, marked ? markCodes : null);
      toast.success(res?.message || `${amount} dona kirim qilindi`);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Qoldiq KAMAYAYAPTIMI — turkum faqat shunda so'raladi. Topilgan tovar
     (qoldiq oshishi) yo'qotish emas va undan turkum so'rash omborchini
     ma'nosiz tanlovga majburlardi. */
  const isDecrease = correct != null && qty !== ""
    && Number(qty) < Number(correct.quantity ?? 0);

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
    /* Qoldiq kamaysa TURKUM ham majburiy — server bilan bir xil qoida.
       Bu yerda ham tekshiriladi, chunki xatoni yuborishdan oldin
       ko'rsatish tugmani bosib, kutib, so'ng xato olishdan yaxshiroq. */
    if (isDecrease && !woReason) {
      toast.error(t("inv.needWriteOffReason"));
      return;
    }
    setSaving(true);
    try {
      await guard(() => inventoryApi.correctBatch(
        correct.inventoryId, Number(qty), reason.trim(), isDecrease ? woReason : null));
      toast.success(t("inv.correctTitle"));
      setCorrect(null);
      loadData();
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtWhen = (iso) => {
    try { return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }); }
    catch (_) { return iso; }
  };

  const statusBadge = (expired) => (
    <span className={`badge ${expired ? "badge-red" : "badge-green"}`}>
      {expired ? t("enum.inventory.EXPIRED") : t("enum.shopStatus.ACTIVE")}
    </span>
  );

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
                      {/* Turkum izohning O'RNIGA emas, oldida: turkum
                          «nima bo'ldi», izoh «aynan qanday bo'ldi». */}
                      <td className="text-muted" style={{ maxWidth: 260 }}>
                        {m.writeOffReason && (
                          <span className="badge badge-yellow" style={{ marginRight: 6 }}>
                            {t(`enum.writeOff.${m.writeOffReason}`)}
                          </span>
                        )}
                        {m.reason || (m.writeOffReason ? "" : "-")}
                      </td>
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
                {filtered.map((g) => {
                  const multi = g.batches.length > 1;
                  const isOpen = expanded.has(g.productId);
                  const single = g.batches[0];
                  return [
                    /* ── Asosiy qator: mahsulot bo'yicha JAMI ── */
                    <tr
                      key={`p-${g.productId}`}
                      style={{
                        ...(g.expiredAll ? { opacity: 0.6, background: "rgba(239,68,68,0.05)" } : null),
                        ...(multi ? { cursor: "pointer" } : null),
                      }}
                      onClick={multi ? () => toggleExpand(g.productId) : undefined}
                    >
                      <td>
                        <div className="fw-700" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {multi && (
                            <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"}`}
                               style={{ fontSize: 11, opacity: 0.55, width: 12 }} aria-hidden="true" />
                          )}
                          {g.productName}
                        </div>
                      </td>
                      <td><code className="mono">{g.barcode || "-"}</code></td>
                      <td>
                        <span className={`badge ${g.sellable <= g.minQ ? "badge-red" : "badge-green"}`}>
                          {g.sellable}
                        </span>
                      </td>
                      <td>{money(g.costPrice)}</td>
                      <td>{money(g.salePrice)}</td>
                      <td>
                        {multi
                          ? <span className="text-muted">{t("inv.batchCount", { n: g.batches.length })}{g.nearest ? ` · ${g.nearest}` : ""}</span>
                          : (single.expiryDate || t("inv.noExpiry"))}
                      </td>
                      <td>{statusBadge(g.expiredAll)}</td>
                      {!branchId && (
                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-primary btn-sm" onClick={() => openModal(g)}>
                            <i className="fa-solid fa-plus" /> {t("inv.receive")}
                          </button>{" "}
                          {/* Bitta partiyada to'g'irlash shu yerda; ko'p
                              partiyada QAYSI birini — ochib tanlanadi. */}
                          {!multi && (
                            <button className="btn btn-outline btn-sm" onClick={() => openCorrect(single)} title={t("inv.correctHint")}>
                              <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>,
                    /* ── Partiya qatorlari (ochilganda) ── */
                    ...(multi && isOpen
                      ? g.batches.map((b) => (
                          <tr key={`b-${b.inventoryId}`}
                              style={{ background: "var(--bg)", ...(isBatchExpired(b) ? { opacity: 0.6 } : null) }}>
                            <td colSpan={2}>
                              <div className="text-muted" style={{ paddingLeft: 26, fontSize: 12.5 }}>
                                <i className="fa-solid fa-layer-group" style={{ marginRight: 6, fontSize: 11 }} aria-hidden="true" />
                                {b.expiryDate || t("inv.noExpiry")}
                              </div>
                            </td>
                            <td><span className="mono fw-700">{b.quantity}</span></td>
                            <td colSpan={2}></td>
                            <td>{b.expiryDate || t("inv.noExpiry")}</td>
                            <td>{statusBadge(isBatchExpired(b))}</td>
                            {!branchId && (
                              <td className="text-end">
                                <button className="btn btn-outline btn-sm" onClick={() => openCorrect(b)} title={t("inv.correctHint")}>
                                  <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      : []),
                  ];
                })}
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
                /* Markirovkali tovarda miqdor maydoni umuman yo'q — shart
                   yorliqlar soniga qaraydi, aks holda tugma doim o'chiq
                   qolardi. */
                disabled={saving || (modal.markingGroup ? markCodes.length === 0 : !qty)}
              >
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("inv.receiveAction")}
              </button>
            </>
          }
        >
          {/* Muddati o'tgan ogohlantirish */}
          {modal.expiredAll && (
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

          {/* Hozirgi sotiladigan qoldiq (jami) */}
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
              {modal.sellable} dona
            </span>
          </div>

          {/* ── Markirovkali tovar: miqdor YORLIQLARDAN ────────────────
              Bu yerda miqdor maydoni umuman ko'rsatilmaydi. Aks holda
              omborchi "50" deb yozib, 48 ta yorliq skanerlashi mumkin edi —
              ikki dona kodsiz qolib, kassada umuman sotilmasdi. */}
          {modal.markingGroup ? (
            <div className="form-group">
              <label className="form-label">{`${t("marking.receiveTitle")} *`}</label>
              <div className="ek-note ek-note--warn" style={{ marginBottom: 10 }}>
                <i className="fa-solid fa-barcode" aria-hidden="true" />
                <div>{t("marking.required")}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setMarkScan(true)}>
                <i className="fa-solid fa-qrcode" /> {t("marking.scanTitle")}
              </button>
              {markCodes.length > 0 && (
                <div className="form-hint" style={{ marginTop: 8 }}>
                  <i className="fa-solid fa-circle-check" style={{ color: "var(--fg-success)" }} />{" "}
                  {t("marking.received", { n: markCodes.length })}
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">{`${t("inv.receiveQty")} *`}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="masalan: 50"
                autoFocus
              />
            </div>
          )}

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

      {/* ── Markirovka yorliqlarini skanerlash ── */}
      {markScan && modal && (
        <MarkingScanModal
          product={{ id: modal.productId, name: modal.productName, markingGroup: modal.markingGroup }}
          mode="receive"
          onDone={(codes) => { setMarkCodes(codes); setMarkScan(false); }}
          onClose={() => setMarkScan(false)}
        />
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
                disabled={saving || qty === "" || !reason.trim() || (isDecrease && !woReason)}
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

          {/* ⚠ Turkum faqat KAMAYISHDA. Ilgari sabab faqat erkin matn edi
              va «sindi», «sinib qoldi», «tushib ketdi» bitta hodisani uch
              xil nomlardi — «shu oy sinishga qancha ketdi» degan savolga
              javob yo'q edi. */}
          {isDecrease && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">{`${t("inv.writeOffReason")} *`}</label>
              <Select
                value={woReason}
                onChange={setWoReason}
                block
                variant="field"
                invalid={!woReason}
                placeholder={t("inv.writeOffReasonPh")}
                ariaLabel={t("inv.writeOffReason")}
                options={WRITE_OFF_REASONS.map((r) => ({
                  value: r.value, icon: r.icon, label: t(`enum.writeOff.${r.value}`),
                }))}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("inv.writeOffHint")}
              </div>
            </div>
          )}

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
