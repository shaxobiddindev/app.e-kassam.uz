import { useState, useEffect } from "react";
import { customerApi } from "../api";
import { BranchSelector } from "../components";
import { maskPhone, cleanPhone, money } from "../config";
import Modal from "../components/Modal";
import { Loader, Empty, SearchBar, Avatar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";

const EMPTY_FORM = { fullName: "", phone: "998" };

export default function CustomersPage({ toast }) {
  const confirm = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null); // null | "add" | { type:"edit", customer }
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [branchId, setBranchId]   = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getAll(branchId);
      setCustomers(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [branchId]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal("add");
  };

  const openEdit = (customer) => {
    setForm({ fullName: customer.fullName, phone: customer.phone });
    setModal({ type: "edit", customer });
  };

  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.fullName || !form.phone) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        await customerApi.create(form);
        toast.success("Mijoz qo'shildi");
      } else {
        await customerApi.update(modal.customer.id, form);
        toast.success("Mijoz yangilandi");
      }
      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    const ok = await confirm({
      title: "Mijozni o'chirish",
      message: `"${customer.fullName}" mijozini tizimdan o'chirib tashlamoqchimisiz?`,
      type: "danger"
    });
    if (!ok) return;
    try {
      await customerApi.delete(customer.id);
      toast.success("Mijoz o'chirildi");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const filtered = customers.filter((c) =>
    c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">Mijozlar</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>
      <div className="card">
        <div className="card-header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Ism yoki telefon..."
            style={{ width: 280 }}
          />
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Mijoz qo'shish
          </button>
        </div>

        <div className="table-wrap">
          {loading ? (
            <Loader />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th>Telefon</th>
                  <th>Jami xarid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={c.fullName} size={30} />
                          <span className="fw-700">{c.fullName}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 13 }}>{maskPhone(c.phone)}</td>
                      <td>
                        <span className="mono fw-700 text-blue">{money(c.totalSpent)}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-icon" onClick={() => openEdit(c)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button className="btn-icon danger" onClick={() => handleDelete(c)}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <Empty icon="fa-users" text="Mijoz topilmadi" />
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
          title={modal === "add" ? "Yangi mijoz" : "Mijozni tahrirlash"}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>
                Bekor
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </>
          }
        >
          <FormGroup label="Ism Familiya *">
            <input
              className="form-input"
              value={form.fullName}
              onChange={setField("fullName")}
              placeholder="Abdullayev Ali"
              autoFocus
            />
          </FormGroup>
          <FormGroup label="Telefon *">
            <input
              className="form-input mono"
              value={maskPhone(form.phone)}
              onChange={(e) => setForm(prev => ({ ...prev, phone: cleanPhone(e.target.value) }))}
              placeholder="+998 (__) ___-__-__"
            />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}
