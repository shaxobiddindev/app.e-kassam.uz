import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/ek-i18n";
import { productApi } from "../api";
import { BranchSelector, Modal } from "../components";
import { Empty, SearchBar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import { money } from "../utils";
import Select from "../components/ek/Select";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

const EMPTY_FORM = {
  name: "", barcode: "", salePrice: "", costPrice: "", categoryId: "",
};

export default function ProductsPage({ toast }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null); // null | "add" | { type:"edit", product }
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [branchId, setBranchId]   = useState(null);

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

  // ── Modal ochish ───────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal("add");
  };

  const openEdit = (product) => {
    setForm({
      name:       product.name,
      barcode:    product.barcode || "",
      salePrice:  product.salePrice,
      costPrice:  product.costPrice,
      categoryId: product.categoryId || "",
    });
    setModal({ type: "edit", product });
  };

  const closeModal = () => setModal(null);

  // ── Saqlash ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.salePrice || !form.costPrice) {
      toast.error(t("products.requiredFields"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        salePrice:  Number(form.salePrice),
        costPrice:  Number(form.costPrice),
        categoryId: form.categoryId || null,
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
      type: "danger"
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
    (p.barcode || "").includes(search)
  );

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

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
            <button className="btn btn-primary" onClick={openAdd}>
              <i className="fa-solid fa-plus" /> Yangi mahsulot
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
           <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("products.search")}
            style={{ width: 320 }}
          />
        </div>

        <div className="table-wrap">
          {busy ? (
            /* Jadval shaklidagi skeleton — spinner emas: ustunlar soni va
               qator balandligi haqiqiy jadvalniki bilan bir xil, shuning uchun
               ma'lumot kelganda sahifa sakramaydi. */
            <SkeletonTable rows={8} cols={["wide", "text", "num", "num", "narrow"]} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("products.barcode")}</th>
                  <th>{t("products.category")}</th>
                  <th>{t("products.salePrice")}</th>
                  <th>{t("products.costPrice")}</th>
                  <th>{t("common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-700">{p.name}</td>
                      <td>
                        <span className="mono text-muted" style={{ fontSize: 12 }}>
                          {p.barcode || "—"}
                        </span>
                      </td>
                      <td>{p.categoryName || "—"}</td>
                      <td>
                        <span className="mono fw-700 text-blue">{money(p.salePrice)}</span>
                      </td>
                      <td>
                        <span className="mono text-muted">{money(p.costPrice)}</span>
                      </td>
                      <td>
                        <span className={`badge ${p.active ? "badge-green" : "badge-red"}`}>
                          {p.active ? t("common.active") : t("products.inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-icon" onClick={() => openEdit(p)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button className="btn-icon danger" onClick={() => handleDelete(p)}>
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

      {/* ── Modal ── */}
      {modal && (
        <Modal
          title={modal === "add" ? t("products.new") : t("products.edit")}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={`${t("common.name")} *`}>
            <input className="form-input" value={form.name} onChange={setField("name")} placeholder={t("products.name")} />
          </FormGroup>

          <FormGroup label={t("products.barcode")}>
            <input className="form-input mono" value={form.barcode} onChange={setField("barcode")} placeholder="1234567890" />
          </FormGroup>

          <div className="grid-2">
            <FormGroup label={`${t("products.salePrice")} *`}>
              <input className="form-input" type="number" min="0" value={form.salePrice} onChange={setField("salePrice")} placeholder="0" />
            </FormGroup>
            <FormGroup label={`${t("products.costPrice")} *`}>
              <input className="form-input" type="number" min="0" value={form.costPrice} onChange={setField("costPrice")} placeholder="0" />
            </FormGroup>
          </div>

          <FormGroup label={t("products.category")}>
            <Select
              block variant="field" ariaLabel={t("products.category")} placeholder={t("products.noCategory")}
              value={form.categoryId ? String(form.categoryId) : ""}
              onChange={(v) => setField("categoryId")({ target: { value: v } })}
              options={[
                { value: "", label: "Kategoriyasiz", icon: "fa-tag" },
                ...categories.map((c) => ({ value: String(c.id), label: c.name, icon: "fa-tags" })),
              ]}
            />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}
