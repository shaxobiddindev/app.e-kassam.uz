import { useCallback, useEffect, useState } from "react";
import { shopApi } from "../../api";
import { Loader, Empty, FormGroup, Badge, confirmDelete } from "../../components/ui";
import Modal from "../../components/Modal";
import { useAuth } from "../../hooks/useAuth";

const ROLE_OPTIONS = ["ADMIN", "STOREKEEPER", "CASHIER"];
const ROLE_LABELS = { ADMIN: "Admin", STOREKEEPER: "Omborchi", CASHIER: "Kassir", OWNER: "Egasi" };
const EMPTY_USER_FORM = { fullName: "", username: "", password: "", role: "CASHIER" };

export default function ShopUsersPage({ toast }) {
  const { user: currentUser }   = useAuth();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]         = useState(EMPTY_USER_FORM);
  const [saving, setSaving]     = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getUsers();
      // Backend allaqachon filtrlaydi, lekin ishonch uchun frontend-da ham o'zini o'chirib tashlaymiz
      const filtered = (res.data || []).filter(u => u.username !== currentUser?.username);
      setUsers(filtered);
    } catch (err) {
      toast.error("Xodimlar yuklanmadi");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSave = async () => {
    if (!form.fullName || (!form.username && modalMode === "add") || (modalMode === "add" && !form.password)) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "add") {
        await shopApi.createUser(form);
        toast.success("Xodim qo'shildi");
      } else {
        await shopApi.updateUser(editingId, {
          fullName: form.fullName,
          role:     form.role,
          password: form.password || undefined // Bo'sh bo'lsa parolni o'zgartirmaydi
        });
        toast.success("Ma'lumotlar saqlandi");
      }
      setModalMode(null);
      setForm(EMPTY_USER_FORM);
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (u) => {
    setEditingId(u.id);
    setForm({
      fullName: u.fullName,
      username: u.username,
      password: "", // Parol tahrirlanganda ixtiyoriy
      role:     u.roles?.[0]?.name || u.role || "CASHIER"
    });
    setModalMode("edit");
  };

  const handleDelete = async (userId) => {
    if (!await confirmDelete("Ushbu xodimni butunlay o'chirib tashlamoqchimisiz?")) return;
    try {
      await shopApi.deleteUser(userId);
      toast.success("Xodim o'chirildi");
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleBlock = async (userId) => {
    try {
      await shopApi.toggleBlockUser(userId);
      toast.success("Holat o'zgartirildi");
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-users-gear text-blue" />
            Xodimlar boshqaruvi
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY_USER_FORM); setModalMode("add"); }}>
            <i className="fa-solid fa-plus" /> Xodim qo'shish
          </button>
        </div>

        <div className="table-wrap">
          {loading ? <Loader /> : (
            <table>
              <thead>
                <tr>
                  <th>Xodim</th>
                  <th>Username</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {u.fullName?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="fw-700">{u.fullName}</span>
                      </div>
                    </td>
                    <td><span className="mono text-muted">@{u.username}</span></td>
                    <td>
                      {u.roles?.map((r) => (
                        <Badge key={r.id || r.name} color="blue">
                          {ROLE_LABELS[r.name] || r.name}
                        </Badge>
                      )) || <Badge color="blue">{ROLE_LABELS[u.role] || u.role}</Badge>}
                    </td>
                    <td>
                      <Badge color={u.enabled !== false ? "green" : "red"}>
                        {u.enabled !== false ? "Aktiv" : "Bloklangan"}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-icon btn-sm" title="Tahrirlash" onClick={() => handleEditClick(u)}>
                          <i className="fa-solid fa-pen-to-square text-blue" />
                        </button>
                        <button
                          className="btn btn-icon btn-sm"
                          title={u.enabled !== false ? "Bloklash" : "Faollashtirish"}
                          onClick={() => handleToggleBlock(u.id)}
                        >
                          <i className={`fa-solid ${u.enabled !== false ? "fa-ban text-orange" : "fa-check text-green"}`} />
                        </button>
                        <button className="btn btn-icon btn-sm" title="O'chirish" onClick={() => handleDelete(u.id)}>
                          <i className="fa-solid fa-trash-can text-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}><Empty icon="fa-user-slash" text="Xodimlar ro'yxati bo'sh" /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalMode && (
        <Modal
          title={modalMode === "add" ? "Yangi xodim qo'shish" : "Xodim ma'lumotlarini tahrirlash"}
          onClose={() => setModalMode(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModalMode(null)}>Bekor</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </>
          }
        >
          <FormGroup label="Ism Familiya *">
            <input className="form-input" value={form.fullName} onChange={setField("fullName")} placeholder="Ali Valiyev" autoFocus />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Username *">
              <input 
                className="form-input mono" 
                value={form.username} 
                onChange={setField("username")} 
                placeholder="ali" 
                disabled={modalMode === "edit"} 
              />
            </FormGroup>
            <FormGroup label={modalMode === "add" ? "Parol *" : "Yangi parol (ixtiyoriy)"}>
              <input className="form-input" type="password" value={form.password} onChange={setField("password")} placeholder={modalMode === "add" ? "min 6 belgi" : "o'zgartirish uchun kiriting"} />
            </FormGroup>
          </div>
          <FormGroup label="Rol *">
            <select className="form-input" value={form.role} onChange={setField("role")}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}

