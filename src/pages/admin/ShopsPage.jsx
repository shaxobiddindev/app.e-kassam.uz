import { useCallback, useEffect, useState } from "react";
import { shopApi } from "../../api";
import { maskPhone, cleanPhone } from "../../config";
import { Loader, Empty, FormGroup, Badge } from "../../components/ui";
import { Modal } from "../../components";

const EMPTY_BRANCH_FORM = { name: "", code: "", phone: "", address: "" };

export default function ShopsPage({ toast }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
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

  const handleCreate = async () => {
    if (!form.name || !form.code) {
      toast.error("Nomi va kodini kiritish majburiy");
      return;
    }
    setSaving(true);
    try {
      await shopApi.createBranch(form);
      toast.success("Yangi filial muvaffaqiyatli qo'shildi");
      setShowAdd(false);
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
          <p className="page-subtitle">Do'koningiz filiallarni boshqarish</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="fa-solid fa-plus" /> Yangi filial qo'shish
        </button>
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
                        {b.status === "ACTIVE" ? "Aktiv" : b.status}
                      </Badge>
                    </td>
                    <td className="text-muted" style={{ fontSize: 12 }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString("uz-UZ") : "—"}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>
                      <Empty icon="fa-store-slash" text="Hozircha filiallar mavjud emas" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && (
        <Modal
          title="Yangi filial qo'shish"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAdd(false)}>Bekor qilish</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
                {saving ? "Saqlanmoqda..." : "Yaratish"}
              </button>
            </>
          }
        >
          <div className="grid-2">
            <FormGroup label="Filial nomi *">
              <input className="form-input" value={form.name} onChange={setField("name")} placeholder="Masalan: Filial №1" />
            </FormGroup>
            <FormGroup label="Shop kodi *">
              <input className="form-input mono" value={form.code} onChange={setField("code")} placeholder="branch-1" />
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
        </Modal>
      )}
    </div>
  );
}
