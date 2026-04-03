import { useCallback, useEffect, useState } from "react";
import { shopApi } from "../../api";
import { Loader, Empty, FormGroup, Badge, confirmDelete } from "../../components/ui";
import Modal from "../../components/Modal";

// Ro'yxatdan faqat do'konga kerakli rollar (Superadmin emas)
const ROLE_OPTIONS = ["ADMIN", "STOREKEEPER", "CASHIER"];
const ROLE_LABELS = { ADMIN: "Admin", STOREKEEPER: "Omborchi", CASHIER: "Kassir" };
const EMPTY_USER_FORM = { fullName: "", username: "", password: "", role: "CASHIER" };

export default function ShopUsersPage({ toast }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addMode, setAddMode]   = useState(false);
  const [form, setForm]         = useState(EMPTY_USER_FORM);
  const [saving, setSaving]     = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      toast.error("Xodimlar yuklanmadi. (API keyinroq ishlashi mumkin)");
      console.error(err);
      // Agar backend yuq bo'lsa bo'sh ro'yxat
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdd = async () => {
    if (!form.fullName || !form.username || !form.password) {
      toast.error("Majburiy maydonlarni to'ldiring");
      return;
    }
    setSaving(true);
    try {
      await shopApi.createUser(form);
      toast.success("Xodim qo'shildi");
      setAddMode(false);
      setForm(EMPTY_USER_FORM);
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Xatolik: Xodim qo'shish ishlamayapti");
    } finally {
      setSaving(false);
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
            Xodimlar
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setAddMode(true)}>
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
                  <th></th>
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
                      <button
                        className={`btn btn-sm ${u.enabled !== false ? "btn-danger" : "btn-green"}`}
                        onClick={() => handleToggleBlock(u.id)}
                      >
                        <i className={`fa-solid ${u.enabled !== false ? "fa-ban" : "fa-check"}`} />
                        {u.enabled !== false ? "Bloklash" : "Faollashtirish"}
                      </button>
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

      {addMode && (
        <Modal
          title="Yangi xodim qo'shish"
          onClose={() => setAddMode(false)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setAddMode(false)}>Bekor</button>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
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
              <input className="form-input mono" value={form.username} onChange={setField("username")} placeholder="ali" />
            </FormGroup>
            <FormGroup label="Parol *">
              <input className="form-input" type="password" value={form.password} onChange={setField("password")} placeholder="min 6 belgi" />
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
