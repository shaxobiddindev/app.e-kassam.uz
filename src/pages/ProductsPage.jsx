import { useState, useEffect, useCallback, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, mediaApi } from "../api";
import { BranchSelector, Modal } from "../components";
import CatalogWizard from "../components/CatalogWizard";
import { Empty, SearchBar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import { money, quantity as fmtQty } from "../utils";
import Select from "../components/ek/Select";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import {
  UNIT, PRODUCT_TYPE, MARKING_GROUP, options, unitLabel, unitDecimals,
} from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   Tovarlar.

   Mahsulotda endi 20 dan ortiq maydon bor (o'lchov, QQS, MXIK, markirovka,
   rasm, qadoq barkodlari). Ular bitta uzun ro'yxatda emas, TO'RT BO'LIMDA:
   Asosiy · Narx va soliq · Ombor · Ko'rinish. Kundalik ish (nom, narx,
   barkod) birinchi bo'limda tugaydi, qolganiga faqat kerak bo'lganda
   kiriladi.
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY_FORM = {
  name: "", barcode: "", sku: "", salePrice: "", costPrice: "", categoryId: "",
  type: "GOODS", unit: "DONA", minQuantity: "",
  mxikCode: "", packageCode: "", vatRate: "", priceIncludesVat: true,
  markingGroup: "", imageId: null, imageUrl: null, color: "", favorite: false,
  barcodes: [],
};

export default function ProductsPage({ toast }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]         = useState("");
  const [modal, setModal]           = useState(null); // null | "add" | { type:"edit", product }
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [branchId, setBranchId]     = useState(null);
  const [wizard, setWizard]         = useState(false);
  const [fiscal, setFiscal]         = useState(null);
  const fileRef = useRef(null);

  const isHeadUser = user?.role === "OWNER" || user?.role === "SHOP_ADMIN" || user?.role === "ADMIN";

  // ── Yuklash ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productApi.getAll(branchId),
        productApi.getCategories(),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Fiskal tayyorlik — alohida so'rov: u jadvalni kutib turmasin va
     xatosi asosiy ro'yxatni yiqitmasin. */
  useEffect(() => {
    if (branchId) return;
    productApi.fiscalReadiness().then((r) => setFiscal(r.data)).catch(() => {});
  }, [branchId, products.length]);

  // ── Modal ochish ───────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setModal("add"); };

  const openEdit = (p) => {
    setForm({
      name: p.name || "",
      barcode: p.barcode || "",
      sku: p.sku || "",
      salePrice: p.salePrice ?? "",
      costPrice: p.costPrice ?? "",
      // ⚠ `categoryId` javobda ILGARI YO'Q EDI va bu yerda doim `undefined`
      // bo'lardi: tahrirlash oynasi kategoriyani har safar bo'sh ko'rsatib,
      // saqlanganda uni jimgina yo'qotardi.
      categoryId: p.categoryId ?? "",
      type: p.type || "GOODS",
      unit: p.unit || "DONA",
      minQuantity: p.minQuantity ?? "",
      mxikCode: p.mxikCode || "",
      packageCode: p.packageCode || "",
      vatRate: p.vatRate ?? "",
      priceIncludesVat: p.priceIncludesVat !== false,
      markingGroup: p.markingGroup || "",
      imageId: p.imageId ?? null,
      imageUrl: p.thumbUrl || null,
      color: p.color || "",
      favorite: !!p.favorite,
      barcodes: p.barcodes || [],
    });
    setModal({ type: "edit", product: p });
  };

  const closeModal = () => setModal(null);

  // ── Rasm ───────────────────────────────────────────────────
  const pickImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await mediaApi.upload(file);
      setForm((f) => ({ ...f, imageId: res.data.id, imageUrl: res.data.thumbUrl }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ⚠ Rasmni olib tashlash uchun `imageId: 0` yuboriladi, `null` emas:
     `null` backendda "tegilmasin" degani (barcha maydonlar ixtiyoriy). */
  const clearImage = () => setForm((f) => ({ ...f, imageId: 0, imageUrl: null }));

  // ── Qadoq barkodlari ───────────────────────────────────────
  const addPackBarcode = () =>
    setForm((f) => ({ ...f, barcodes: [...f.barcodes, { barcode: "", packQty: "", label: "" }] }));

  const setPackBarcode = (idx, field, value) =>
    setForm((f) => ({
      ...f,
      barcodes: f.barcodes.map((b, i) => (i === idx ? { ...b, [field]: value } : b)),
    }));

  const removePackBarcode = (idx) =>
    setForm((f) => ({ ...f, barcodes: f.barcodes.filter((_, i) => i !== idx) }));

  // ── Saqlash ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name) { toast.error(t("products.requiredFields")); return; }
    setSaving(true);
    try {
      const num = (v) => (v === "" || v == null ? null : Number(v));
      const body = {
        name: form.name,
        barcode: form.barcode || null,
        sku: form.sku || null,
        salePrice: num(form.salePrice),
        costPrice: num(form.costPrice),
        categoryId: form.categoryId || null,
        type: form.type,
        unit: form.unit,
        minQuantity: num(form.minQuantity),
        mxikCode: form.mxikCode || null,
        packageCode: form.packageCode || null,
        vatRate: num(form.vatRate),
        priceIncludesVat: form.priceIncludesVat,
        markingGroup: form.markingGroup || null,
        imageId: form.imageId,
        color: form.color || null,
        favorite: form.favorite,
        barcodes: form.barcodes
          .filter((b) => b.barcode)
          .map((b) => ({ ...b, packQty: num(b.packQty) || 1 })),
      };
      if (modal === "add") {
        await productApi.create(body);
        toast.success(t("products.added"));
      } else {
        await productApi.update(modal.product.id, body);
        toast.success(t("products.updated"));
      }
      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── O'chirish ──────────────────────────────────────────────
  const handleDelete = async (product) => {
    const ok = await confirm({
      title: t("products.deleteTitle"),
      message: `"${product.name}" mahsulotini o'chirishni tasdiqlaysizmi?`,
      type: "danger",
    });
    if (!ok) return;
    try {
      await productApi.delete(product.id);
      toast.success(t("common.deleted"));
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Filter ─────────────────────────────────────────────────
  const filtered = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || "").includes(search) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setValue = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const divisible = unitDecimals(form.unit) > 0;
  const isService = form.type === "SERVICE";

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">{t("products.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={loadData} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
          {!branchId && isHeadUser && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setWizard(true)}>
                <i className="fa-solid fa-wand-magic-sparkles" /> {t("products.fromCatalog")}
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <i className="fa-solid fa-plus" /> {t("products.new")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Fiskal tayyorlik ────────────────────────────────────
          Fiskal chekda har satr uchun MXIK va QQS majburiy. 800 ta tovarni
          ulanish kunida to'ldirishga urinish — bir haftalik ish; ro'yxat
          hoziroq ko'rinib tursa, egasi uni asta-sekin to'ldiradi. */}
      {fiscal && fiscal.totalProducts > 0 && (
        <div className={`ek-note ${fiscal.incompleteProducts ? "ek-note--warn" : ""}`} style={{ marginBottom: 14 }}>
          <i className={`fa-solid ${fiscal.incompleteProducts ? "fa-triangle-exclamation" : "fa-circle-check"}`} />
          <div>
            <div>
              {fiscal.incompleteProducts
                ? t("products.fiscalIncomplete", { n: fiscal.incompleteProducts })
                : t("products.fiscalReady")}
            </div>
            {!!fiscal.incompleteProducts && <div className="form-hint">{t("products.fiscalHint")}</div>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder={t("products.search")} style={{ width: 320 }} />
        </div>

        <div className="table-wrap">
          {busy ? (
            <SkeletonTable rows={8} cols={["wide", "text", "num", "num", "narrow"]} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("products.barcode")}</th>
                  <th>{t("products.category")}</th>
                  <th>{t("products.salePrice")}</th>
                  <th>{t("inv.currentQty")}</th>
                  <th>{t("common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-700">
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          {p.thumbUrl && (
                            <img src={mediaApi.url(p.thumbUrl)} alt="" width={30} height={30} loading="lazy"
                                 style={{ borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />
                          )}
                          <span>
                            {p.name}
                            {p.markingGroup && (
                              <i className="fa-solid fa-barcode" title={t("products.markingGroup")}
                                 style={{ marginLeft: 6, color: "var(--fg-warning)" }} />
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="ek-num text-muted" style={{ fontSize: 12 }}>
                          {p.barcode || p.sku || "—"}
                        </span>
                      </td>
                      <td>{p.categoryName || "—"}</td>
                      <td>
                        {p.salePrice == null
                          ? <span className="badge badge-amber">{t("products.noPrice")}</span>
                          : <span className="ek-num fw-700 text-blue">{money(p.salePrice)}</span>}
                      </td>
                      <td>
                        {p.stockQuantity == null
                          ? <span className="text-muted">—</span>
                          : <span className="ek-num">
                              {fmtQty(p.stockQuantity, p.unitDecimals)} {unitLabel(p.unit)}
                            </span>}
                      </td>
                      <td>
                        <span className={`badge ${p.active ? "badge-green" : "badge-red"}`}>
                          {p.active ? t("common.active") : t("products.inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-icon" onClick={() => openEdit(p)} aria-label={t("common.edit")}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button className="btn-icon danger" onClick={() => handleDelete(p)} aria-label={t("common.delete")}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="fa-box-open" text={t("products.notFound")} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Tayyor katalog ustasi ── */}
      {wizard && (
        <CatalogWizard
          toast={toast}
          onClose={() => setWizard(false)}
          onDone={() => { setWizard(false); loadData(); }}
        />
      )}

      {/* ── Mahsulot formasi ── */}
      {modal && (
        <Modal
          title={modal === "add" ? t("products.new") : t("products.edit")}
          onClose={closeModal}
          maxWidth={620}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          {/* ═══ Asosiy ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-circle-info" /> {t("products.section.main")}</div>

            <FormGroup label={`${t("common.name")} *`}>
              <input className="form-input" value={form.name} onChange={setField("name")} placeholder={t("products.name")} />
            </FormGroup>

            <div className="grid-2">
              <FormGroup label={t("products.type")}>
                <Select block variant="field" ariaLabel={t("products.type")}
                        value={form.type} onChange={setValue("type")}
                        options={options(PRODUCT_TYPE).map((o) => ({ ...o, icon: PRODUCT_TYPE[o.value]?.icon }))} />
              </FormGroup>

              <FormGroup label={t("products.unit")}>
                <Select block variant="field" ariaLabel={t("products.unit")}
                        value={form.unit} onChange={setValue("unit")}
                        options={options(UNIT).map((o) => ({ ...o, icon: UNIT[o.value]?.icon }))} />
              </FormGroup>
            </div>

            {divisible && (
              <div className="form-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                <i className="fa-solid fa-scale-balanced" /> {t("kassa.enterQuantity")} — {unitLabel(form.unit)}
              </div>
            )}

            <div className="grid-2">
              <FormGroup label={t("products.barcode")}>
                <input className="form-input ek-num" value={form.barcode} onChange={setField("barcode")} placeholder="4780001111111" />
              </FormGroup>
              <FormGroup label={t("products.sku")}>
                <input className="form-input ek-num" value={form.sku} onChange={setField("sku")} placeholder="ART-001" />
              </FormGroup>
            </div>

            <FormGroup label={t("products.category")}>
              <Select
                block variant="field" ariaLabel={t("products.category")} placeholder={t("products.noCategory")}
                value={form.categoryId ? String(form.categoryId) : ""}
                onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                options={[
                  { value: "", label: t("products.noCategory"), icon: "fa-tag" },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: c.icon || "fa-tags" })),
                ]}
              />
            </FormGroup>
          </div>

          {/* ═══ Narx va soliq ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-receipt" /> {t("products.section.price")}</div>

            <div className="grid-2">
              <FormGroup label={t("products.salePrice")}>
                <input className="form-input ek-num" type="number" min="0" value={form.salePrice} onChange={setField("salePrice")} placeholder="0" />
              </FormGroup>
              <FormGroup label={t("products.costPrice")}>
                <input className="form-input ek-num" type="number" min="0" value={form.costPrice} onChange={setField("costPrice")} placeholder="0" />
              </FormGroup>
            </div>

            <div className="grid-2">
              <FormGroup label={t("products.vatRate")}>
                <input className="form-input ek-num" type="number" min="0" max="100" value={form.vatRate} onChange={setField("vatRate")} placeholder="12" />
              </FormGroup>
              <FormGroup label={t("products.packageCode")}>
                <input className="form-input ek-num" value={form.packageCode} onChange={setField("packageCode")} placeholder="1234567" />
              </FormGroup>
            </div>

            <FormGroup label={t("products.mxik")}>
              <input className="form-input ek-num" value={form.mxikCode} onChange={setField("mxikCode")} placeholder="00000000000000000" maxLength={17} />
              <div className="form-hint">
                {t("products.mxikHint")}{" "}
                <a href="https://tasnif.soliq.uz/classifier" target="_blank" rel="noreferrer">tasnif.soliq.uz</a>
              </div>
            </FormGroup>

            <label className="cat-chip" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={form.priceIncludesVat}
                     onChange={(e) => setForm((f) => ({ ...f, priceIncludesVat: e.target.checked }))} />
              {t("products.priceIncludesVat")}
            </label>

            <FormGroup label={t("products.markingGroup")}>
              <Select block variant="field" ariaLabel={t("products.markingGroup")}
                      value={form.markingGroup} onChange={setValue("markingGroup")}
                      options={[
                        { value: "", label: t("products.markingNone"), icon: "fa-minus" },
                        ...options(MARKING_GROUP).map((o) => ({ ...o, icon: MARKING_GROUP[o.value]?.icon })),
                      ]} />
            </FormGroup>
          </div>

          {/* ═══ Ombor ═══ (xizmatga ko'rsatilmaydi — unga qoldiq yuritilmaydi) */}
          {!isService && (
            <div className="form-section">
              <div className="form-section__title"><i className="fa-solid fa-boxes-stacked" /> {t("products.section.stock")}</div>

              <FormGroup label={t("products.minQuantity")}>
                <input className="form-input ek-num" type="number" min="0" step="any"
                       value={form.minQuantity} onChange={setField("minQuantity")} placeholder="5" />
              </FormGroup>

              <div className="form-label">{t("products.packBarcodes")}</div>
              <div className="form-hint" style={{ marginBottom: 8 }}>
                {t("products.packQty")} — {t("products.packLabel")}
              </div>
              {form.barcodes.map((b, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="form-input ek-num" style={{ flex: 2 }} placeholder="4780001111128"
                         value={b.barcode} onChange={(e) => setPackBarcode(idx, "barcode", e.target.value)} />
                  <input className="form-input ek-num" style={{ flex: 1 }} type="number" min="0" step="any" placeholder="12"
                         value={b.packQty} onChange={(e) => setPackBarcode(idx, "packQty", e.target.value)} />
                  <input className="form-input" style={{ flex: 1 }} placeholder={t("products.packLabel")}
                         value={b.label || ""} onChange={(e) => setPackBarcode(idx, "label", e.target.value)} />
                  <button className="btn-icon danger" onClick={() => removePackBarcode(idx)} aria-label={t("common.delete")}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={addPackBarcode}>
                <i className="fa-solid fa-plus" /> {t("products.packBarcodeAdd")}
              </button>
            </div>
          )}

          {/* ═══ Ko'rinish ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-image" /> {t("products.section.look")}</div>

            <div className="img-picker">
              <div className="img-picker__box">
                {form.imageUrl
                  ? <img src={mediaApi.url(form.imageUrl)} alt="" />
                  : <i className="fa-solid fa-image" />}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                       onChange={(e) => pickImage(e.target.files?.[0])} />
                <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Spinner /> : <i className="fa-solid fa-upload" />} {t("products.imageUpload")}
                </button>
                {form.imageUrl && (
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={clearImage}>
                    <i className="fa-solid fa-xmark" /> {t("products.imageRemove")}
                  </button>
                )}
                <div className="form-hint">{t("products.imageHint")}</div>
              </div>
            </div>

            <label className="cat-chip" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={form.favorite}
                     onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))} />
              <i className="fa-solid fa-star" /> {t("products.favorite")}
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
