import { useCallback, useEffect, useState } from "react";
import { shopApi } from "../../api";
import { maskPhone, cleanPhone } from "../../config";
import { Loader, Empty, FormGroup, Badge } from "../../components/ui";
import { Modal } from "../../components";

const EMPTY_BRANCH_FORM = { name: "", code: "", phone: "998", address: "" };

export default function ShopsPage({ toast }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | "add" | { type:"edit", branch }
  const [form, setForm]         = useState(EMPTY_BRANCH_FORM);
  const [saving, setSaving]     = useState(false);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getBranches();
      setBranches(res.data || []);
    } catch (err) {
      toast.error("Filiallar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const openAdd = () => {
    setForm(EMPTY_BRANCH_FORM);
    setModal("add");
  };

  const openEdit = (branch) => {
    setForm({ 
      name: branch.name, 
      code: branch.code, 
      phone: branch.phone || "", 
      address: branch.address || "",
      status: branch.status 
    });
    setModal({ type: "edit", branch });
  };

  const handleSave = async () => {
    if (!form.name || (!form.code && modal === "add")) {
      toast.error("Majburiy maydonlarni kiritish zarur");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        await shopApi.createBranch(form);
        toast.success("Yangi filial muvaffaqiyatli qo'shildi");
      } else {
        await shopApi.updateBranch(modal.branch.id, form);
        toast.success("Filial ma'lumotlari yangilandi");
      }
      setModal(null);
      setForm(EMPTY_BRANCH_FORM);
      loadBranches();
    } catch (err) {
      toast.error(err.message || "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const setField = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">Filiallar</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={loadBranches} title="Ma'lumotlarni yangilash">
            <i className="fa-solid fa-rotate-right" /> Yangilash
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Yangi filial qo'shish
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <Loader /> : (
            <table className="table">
              <thead>
                <tr>
                  <th>Filial nomi</th>
                  <th>Shop Code</th>
                  <th>Telefon</th>
                  <th>Manzil</th>
                  <th>Status</th>
                  <th>Sana</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {branches.length > 0 ? branches.map((b) => (
                  <tr key={b.id}>
                    <td><span className="fw-700">{b.name}</span></td>
                    <td><Badge color="blue">{b.code}</Badge></td>
                    <td>{maskPhone(b.phone) || "—"}</td>
                    <td>{b.address || "—"}</td>
                    <td>
                      <Badge color={b.status === "ACTIVE" ? "green" : "red"}>
                        {b.status === "ACTIVE" ? "Aktiv" : b.status === "INACTIVE" ? "Noaktiv" : b.status}
                      </Badge>
                    </td>
                    <td className="text-muted" style={{ fontSize: 12 }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString("uz-UZ") : "—"}
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(b)} title="Tahrirlash">
                        <i className="fa-solid fa-pen" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="fa-store-slash" text="Hozircha filiallar mavjud emas" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Yangi filial qo'shish" : "Filialni tahrirlash"}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Bekor qilish</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </>
          }
        >
          <div className="grid-2">
            <FormGroup label="Filial nomi *">
              <input className="form-input" value={form.name} onChange={setField("name")} placeholder="Masalan: Filial №1" />
            </FormGroup>
            <FormGroup label="Shop kodi *">
              <input className="form-input mono" value={form.code} onChange={setField("code")} placeholder="branch-1" disabled={modal?.type === "edit"} />
              <small className="text-muted">Faqat kichik lotin harflari va raqamlar</small>
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label="Telefon raqami">
              <input 
                className="form-input mono" 
                value={maskPhone(form.phone)} 
                onChange={(e) => setForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))} 
                placeholder="+998 (__) ___-__-__" 
              />
            </FormGroup>
            <FormGroup label="Manzil">
              <input className="form-input" value={form.address} onChange={setField("address")} placeholder="Toshkent sh., Chilonzor" />
            </FormGroup>
          </div>
          {modal?.type === "edit" && (
            <FormGroup label="Status">
              <select className="form-input" value={form.status} onChange={setField("status")}>
                <option value="ACTIVE">Aktiv</option>
                <option value="INACTIVE">Noaktiv</option>
              </select>
            </FormGroup>
          )}
        </Modal>
      )}
    </div>
  );
}
