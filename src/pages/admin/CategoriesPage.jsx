import { useState, useEffect, useCallback } from "react";
import { productApi } from "../../api";
import { BranchSelector } from "../../components";
import Modal from "../../components/Modal";
import { Loader, Empty, FormGroup } from "../../components/ui";
import { useConfirm } from "../../context/ConfirmProvider";

const EMPTY_FORM = { name: "", description: "" };

export default function CategoriesPage({ toast }) {
  const confirm = useConfirm();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
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

  const openAdd = () => { setForm(EMPTY_FORM); setModal("add"); };
  const openEdit = (cat) => { setForm({ name: cat.name, description: cat.description || "" }); setModal({ type: "edit", cat }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Kategoriya nomini kiriting"); return; }
    setSaving(true);
    try {
      if (modal === "add") {
        await productApi.createCategory(form, branchId);
        toast.success("Kategoriya qo'shildi");
      } else {
        await productApi.updateCategory(modal.cat.id, form, branchId);
        toast.success("Kategoriya yangilandi");
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
      title: "Kategoriyani o'chirish",
      message: `"${cat.name}" mahsulot kategoriyasini o'chirishni tasdiqlaysizmi? Bu mahsulotlarga ta'sir qilishi mumkin.`,
      type: "danger"
    });
    if (!ok) return;

    try {
      await productApi.deleteCategory(cat.id, branchId);
      toast.success("O'chirildi");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Rang palleti
  const COLORS = ["#017dca","#22c55e","#f59e0b","#ef4444","#9333ea","#14b8a6","#f97316","#06b6d4"];
  const colorFor = (name = "") => COLORS[name.charCodeAt(0) % COLORS.length];

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">Kategoriyalar</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-tags text-blue" />
            Kategoriyalar ({categories.length})
          </span>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Qo'shish
          </button>
        </div>

        {loading ? <Loader /> : categories.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, padding: 16 }}>
            {categories.map((cat) => {
              const color = colorFor(cat.name);
              return (
                <div key={cat.id} style={{
                  border: "1.5px solid var(--border)", borderRadius: 12,
                  padding: 16, background: "white", transition: ".2s",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: color + "18", color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900,
                    }}>
                      {cat.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw-800" style={{ fontSize: 14 }}>{cat.name}</div>
                      {cat.description && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{cat.description}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(cat)}>
                      <i className="fa-solid fa-pen" /> Tahrirlash
                    </button>
                    <button className="btn-icon danger" onClick={() => handleDelete(cat)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="fa-tags" text="Kategoriya yo'q" />
        )}
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Yangi kategoriya" : "Kategoriyani tahrirlash"}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>Bekor</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "..." : "Saqlash"}
              </button>
            </>
          }
        >
          <FormGroup label="Nomi *">
            <input className="form-input" value={form.name} onChange={setField("name")} placeholder="Kategoriya nomi" autoFocus />
          </FormGroup>
          <FormGroup label="Tavsif">
            <input className="form-input" value={form.description} onChange={setField("description")} placeholder="Qisqacha tavsif (ixtiyoriy)" />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}
