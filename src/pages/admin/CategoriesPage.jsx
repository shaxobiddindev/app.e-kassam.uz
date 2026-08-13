import { useState, useEffect, useCallback } from "react";
import { t } from "../../lib/ek-i18n";
import { productApi } from "../../api";
import { BranchSelector } from "../../components";
import Modal from "../../components/Modal";
import { Empty, Field, FormGroup } from "../../components/ui";
import { useConfirm } from "../../context/ConfirmProvider";
import { SkeletonList, Spinner } from "../../components/ek/Loading";
import { useLoading } from "../../lib/use-loading";
import Select from "../../components/ek/Select";
import { UNIT, MARKING_GROUP, options, unitLabel } from "../../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   Kategoriyalar — endi DARAXT va STANDART QIYMATLAR manbai.

   Tizimning turli do'kon turlariga moslashuvi aynan shu yerda ishlaydi:
   «Sut mahsulotlari» ga bir marta «o'lchov KG, QQS 12%» deb qo'yilsa, o'sha
   kategoriyaga qo'shilgan HAR BIR yangi tovar shu qiymatlarni meros oladi.
   Aks holda do'kon egasi 500 ta tovarga bir xil maydonni qo'lda kiritishi
   kerak bo'lardi — va amalda hech kim kiritmasdi.

   ⚠ Ikkita eski xato yo'l-yo'lakay tuzatildi:
     · `description` maydoni formada bor edi, lekin backendda umuman yo'q —
       kiritilgan matn har safar jimgina yo'qolardi;
     · rang `#017dca` kabi qattiq qiymat bilan yozilgan va kartochka foni
       `white` edi — qorong'i rejimda oq plastinka qora fonda yonib turardi
       (CLAUDE.md #1).
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY_FORM = {
  name: "", parentId: "", color: "brand", icon: "",
  defaultUnit: "", defaultVatRate: "", defaultMxik: "", defaultMarkingGroup: "",
};

/* Rang — TOKEN NOMI, hex emas. Kartochka ham, kassa tabi ham shu nomni
   o'z temasidagi o'zgaruvchiga aylantiradi. */
const COLORS = [
  { key: "brand",     var: "var(--bg-brand)" },
  { key: "success",   var: "var(--fg-success)" },
  { key: "amber",     var: "var(--fg-warning)" },
  { key: "danger",    var: "var(--fg-danger)" },
  { key: "secondary", var: "var(--fg-secondary)" },
];
const colorVar = (key) => COLORS.find((c) => c.key === key)?.var || "var(--bg-brand)";

const ICONS = [
  "fa-tags", "fa-bread-slice", "fa-bottle-water", "fa-carrot", "fa-drumstick-bite",
  "fa-shirt", "fa-shoe-prints", "fa-pump-soap", "fa-pen", "fa-screwdriver-wrench",
  "fa-bolt", "fa-faucet", "fa-candy-cane", "fa-boxes-stacked", "fa-handshake",
];

export default function CategoriesPage({ toast }) {
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const busy = useLoading(loading);
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [branchId, setBranchId]     = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productApi.getCategories(branchId);
      setCategories(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = (parentId = "") => { setForm({ ...EMPTY_FORM, parentId: parentId || "" }); setModal("add"); };

  const openEdit = (cat) => {
    setForm({
      name: cat.name || "",
      parentId: cat.parentId ? String(cat.parentId) : "",
      color: cat.color || "brand",
      icon: cat.icon || "",
      defaultUnit: cat.defaultUnit || "",
      defaultVatRate: cat.defaultVatRate ?? "",
      defaultMxik: cat.defaultMxik || "",
      defaultMarkingGroup: cat.defaultMarkingGroup || "",
    });
    setModal({ type: "edit", cat });
  };

  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t("cat.needName")); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        parentId: form.parentId ? Number(form.parentId) : null,
        color: form.color || null,
        icon: form.icon || null,
        defaultUnit: form.defaultUnit || null,
        defaultVatRate: form.defaultVatRate === "" ? null : Number(form.defaultVatRate),
        defaultMxik: form.defaultMxik || null,
        defaultMarkingGroup: form.defaultMarkingGroup || null,
      };
      if (modal === "add") {
        await productApi.createCategory(body, branchId);
        toast.success(t("cat.added"));
      } else {
        await productApi.updateCategory(modal.cat.id, body, branchId);
        toast.success(t("cat.updated"));
      }
      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    const ok = await confirm({
      title: t("cat.deleteTitle"),
      message: `"${cat.name}" — ${t("common.delete")}?`,
      type: "danger",
    });
    if (!ok) return;
    try {
      await productApi.deleteCategory(cat.id, branchId);
      toast.success(t("common.deleted"));
      loadData();
    } catch (err) {
      // Backend endi ichida tovar yoki kichik bo'lim bo'lsa aniq sabab
      // qaytaradi (ilgari baza chet kaliti bilan tushunarsiz 500 berardi).
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setValue = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id) => categories.filter((c) => c.parentId === id);

  const Card = ({ cat, child }) => (
    <div className={`cat-card ${child ? "cat-card--child" : ""}`}>
      <div className="cat-card__head">
        <span className="cat-card__mark" style={{ background: colorVar(cat.color) }}>
          {cat.icon
            ? <i className={`fa-solid ${cat.icon}`} aria-hidden="true" />
            : (cat.name?.[0]?.toUpperCase() || "?")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fw-800" style={{ fontSize: 14 }}>{cat.name}</div>
          <div className="form-hint" style={{ marginTop: 2 }}>
            {t("categories.productCount", { n: cat.productCount })}
            {cat.defaultUnit && ` · ${unitLabel(cat.defaultUnit)}`}
            {cat.defaultVatRate != null && ` · ${t("products.vatShort")} ${cat.defaultVatRate}%`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(cat)}>
          <i className="fa-solid fa-pen" /> {t("common.edit")}
        </button>
        {!child && (
          <button className="btn btn-outline btn-sm" onClick={() => openAdd(cat.id)} title={t("categories.parent")}>
            <i className="fa-solid fa-plus" />
          </button>
        )}
        <button className="btn-icon danger" onClick={() => handleDelete(cat)} aria-label={t("common.delete")}>
          <i className="fa-solid fa-trash" />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("cat.title")}</h2>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-tags text-blue" />
            {t("cat.title")} (<span className="ek-num">{categories.length}</span>)
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
            <i className="fa-solid fa-plus" /> {t("common.add")}
          </button>
        </div>

        {busy ? <SkeletonList rows={6} avatar={false} /> : categories.length > 0 ? (
          <div className="cat-list">
            {roots.map((cat) => (
              <div key={cat.id} className="cat-branch">
                <Card cat={cat} />
                {childrenOf(cat.id).length > 0 && (
                  <div className="cat-children">
                    {childrenOf(cat.id).map((child) => <Card key={child.id} cat={child} child />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="fa-tags" text={t("cat.none")} />
        )}
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? t("cat.new") : t("cat.edit")}
          onClose={closeModal}
          maxWidth={520}
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
          <FormGroup label={`${t("common.name")} *`}>
            <Field className="form-input" value={form.name} onChange={setField("name")} placeholder={t("cat.name")} autoFocus />
          </FormGroup>

          <FormGroup label={t("categories.parent")}>
            <Select
              block variant="field" ariaLabel={t("categories.parent")}
              value={form.parentId} onChange={setValue("parentId")}
              options={[
                { value: "", label: t("categories.root"), icon: "fa-folder-open" },
                // Faqat ILDIZ kategoriyalar ota bo'la oladi: daraxt ikki
                // daraja bilan cheklangan (backend ham shuni tekshiradi).
                ...roots
                  .filter((c) => !(modal?.cat && c.id === modal.cat.id))
                  .map((c) => ({ value: String(c.id), label: c.name, icon: c.icon || "fa-folder" })),
              ]}
            />
          </FormGroup>

          <div className="grid-2">
            <FormGroup label={t("categories.color")}>
              <div style={{ display: "flex", gap: 8 }}>
                {COLORS.map((c) => (
                  <button key={c.key} type="button" aria-label={c.key}
                          aria-pressed={form.color === c.key}
                          onClick={() => setForm((f) => ({ ...f, color: c.key }))}
                          style={{
                            width: 34, height: 34, borderRadius: 9, cursor: "pointer",
                            background: c.var, border: form.color === c.key
                              ? "3px solid var(--fg-primary)" : "1px solid var(--border-subtle)",
                          }} />
                ))}
              </div>
            </FormGroup>

            <FormGroup label={t("categories.icon")}>
              <Select block variant="field" ariaLabel={t("categories.icon")}
                      value={form.icon} onChange={setValue("icon")}
                      options={[{ value: "", label: "—", icon: "fa-minus" },
                                ...ICONS.map((i) => ({ value: i, label: i.replace("fa-", ""), icon: i }))]} />
            </FormGroup>
          </div>

          {/* ═══ Standart qiymatlar ═══ */}
          <div className="form-section">
            <div className="form-section__title"><i className="fa-solid fa-wand-magic-sparkles" /> {t("categories.defaults")}</div>
            <div className="form-hint" style={{ marginTop: -6, marginBottom: 12 }}>{t("categories.defaultsHint")}</div>

            <div className="grid-2">
              <FormGroup label={t("products.unit")}>
                <Select block variant="field" ariaLabel={t("products.unit")}
                        value={form.defaultUnit} onChange={setValue("defaultUnit")}
                        options={[{ value: "", label: "—", icon: "fa-minus" },
                                  ...options(UNIT).map((o) => ({ ...o, icon: UNIT[o.value]?.icon }))]} />
              </FormGroup>
              <FormGroup label={t("products.vatRate")}>
                <Field className="form-input ek-num" kind="percent"
                       value={form.defaultVatRate} onChange={setField("defaultVatRate")} placeholder="12" />
              </FormGroup>
            </div>

            <FormGroup label={t("products.markingGroup")}>
              <Select block variant="field" ariaLabel={t("products.markingGroup")}
                      value={form.defaultMarkingGroup} onChange={setValue("defaultMarkingGroup")}
                      options={[{ value: "", label: t("products.markingNone"), icon: "fa-minus" },
                                ...options(MARKING_GROUP).map((o) => ({ ...o, icon: MARKING_GROUP[o.value]?.icon }))]} />
            </FormGroup>

            <FormGroup label={t("products.mxik")}>
              <Field className="form-input ek-num" kind="mxik" value={form.defaultMxik} onChange={setField("defaultMxik")}
                     placeholder="00000000000000000" maxLength={17} />
              <div className="form-hint">{t("products.mxikHint")}</div>
            </FormGroup>
          </div>
        </Modal>
      )}
    </div>
  );
}
