import { useCallback, useEffect, useState } from "react";
import { shopAdminApi } from "../../api";
import Modal from "../../components/Modal";
import { Loader, Empty, SearchBar, FormGroup, Badge } from "../../components/ui";
import { useConfirm } from "../../context/ConfirmProvider";

// ─── Status config ────────────────────────────────────────────
const STATUS_MAP = {
  ACTIVE:    { label: "Aktiv",      color: "green"  },
  BLOCKED:   { label: "Bloklangan", color: "red"    },
  SUSPENDED: { label: "To'xtatilgan", color: "yellow" },
  DELETED:   { label: "O'chirilgan", color: "red"   },
};

const EMPTY_SHOP_FORM = { name: "", code: "", phone: "", address: "" };
const EMPTY_UPDATE_FORM = { name: "", ownerName: "", phone: "", address: "", status: "ACTIVE" };

// ─── ShopsPage ────────────────────────────────────────────────
export default function ShopsPage({ toast }) {
  const confirm                   = useConfirm();
  const [shops, setShops]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null); // null | "add" | { type:"edit"|"users", shop }
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);

  // ── Yuklash ──────────────────────────────────────────────────
  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopAdminApi.getAll();
      setShops(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShops(); }, [loadShops]);

  // ── Modallar ─────────────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_SHOP_FORM); setModal("add"); };
  const openEdit = (shop) => {
    setForm({ name: shop.name, ownerName: shop.ownerName || "", phone: shop.phone || "", address: shop.address || "", status: shop.status });
    setModal({ type: "edit", shop });
  };
  const openUsers = (shop) => setModal({ type: "users", shop });
  const closeModal = () => setModal(null);

  // ── Saqlash ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === "add") {
        await shopAdminApi.create(form);
        toast.success("Do'kon yaratildi");
      } else {
        await shopAdminApi.update(modal.shop.id, form);
        toast.success("Do'kon yangilandi");
      }
      closeModal();
      loadShops();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── O'chirish ────────────────────────────────────────────────
  const handleDelete = async (shop) => {
    const ok = await confirm({
      title: "Do'konni o'chirish",
      message: `"${shop.name}" do'konini butunlay o'chirib tashlamoqchimisiz? Barcha ma'lumotlar o'chib ketadi!`,
      type: "danger"
    });
    if (!ok) return;
    try {
      await shopAdminApi.delete(shop.id);
      toast.success("Do'kon o'chirildi");
      loadShops();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const filtered = shops.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.includes(search) ||
    s.phone?.includes(search)
  );

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <SearchBar value={search} onChange={setSearch} placeholder="Nom, kod yoki telefon..." style={{ width: 300 }} />
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Yangi do'kon
          </button>
        </div>

        <div className="table-wrap">
          {loading ? <Loader /> : (
            <table>
              <thead>
                <tr>
                  <th>Do'kon</th>
                  <th>Kod</th>
                  <th>Egasi</th>
                  <th>Telefon</th>
                  <th>Status</th>
                  <th>Yaratilgan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((shop) => {
                  const st = STATUS_MAP[shop.status] || { label: shop.status, color: "blue" };
                  return (
                    <tr key={shop.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: "var(--blue-l)", color: "var(--blue)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 800, flexShrink: 0,
                          }}>
                            {shop.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="fw-700">{shop.name}</span>
                        </div>
                      </td>
                      <td><span className="mono badge badge-blue">{shop.code}</span></td>
                      <td className="text-muted">{shop.ownerName || "—"}</td>
                      <td className="mono" style={{ fontSize: 13 }}>{shop.phone || "—"}</td>
                      <td><Badge color={st.color}>{st.label}</Badge></td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString("uz-UZ") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn-icon" title="Foydalanuvchilar" onClick={() => openUsers(shop)}>
                            <i className="fa-solid fa-users" />
                          </button>
                          <button className="btn-icon" title="Tahrirlash" onClick={() => openEdit(shop)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button className="btn-icon danger" title="O'chirish" onClick={() => handleDelete(shop)}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7}><Empty icon="fa-store" text="Do'kon topilmadi" /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Yangi do'kon modal ── */}
      {modal === "add" && (
        <Modal
          title="Yangi do'kon yaratish"
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>Bekor</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "Yaratilmoqda..." : "Yaratish"}
              </button>
            </>
          }
        >
          <FormGroup label="Do'kon nomi *">
            <input className="form-input" value={form.name} onChange={setField("name")} placeholder="Masalan: Baraka Shop" autoFocus />
          </FormGroup>
          <FormGroup label="Kod * (kichik harf, raqam, _ -)">
            <input className="form-input mono" value={form.code} onChange={setField("code")} placeholder="baraka-shop" />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Telefon">
              <input className="form-input mono" value={form.phone} onChange={setField("phone")} placeholder="+998901234567" />
            </FormGroup>
            <FormGroup label="Manzil">
              <input className="form-input" value={form.address} onChange={setField("address")} placeholder="Shahar, ko'cha" />
            </FormGroup>
          </div>
        </Modal>
      )}

      {/* ── Tahrirlash modal ── */}
      {modal?.type === "edit" && (
        <Modal
          title={`Tahrirlash — ${modal.shop.name}`}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>Bekor</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </>
          }
        >
          <FormGroup label="Do'kon nomi">
            <input className="form-input" value={form.name} onChange={setField("name")} />
          </FormGroup>
          <FormGroup label="Egasi">
            <input className="form-input" value={form.ownerName} onChange={setField("ownerName")} />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Telefon">
              <input className="form-input mono" value={form.phone} onChange={setField("phone")} />
            </FormGroup>
            <FormGroup label="Manzil">
              <input className="form-input" value={form.address} onChange={setField("address")} />
            </FormGroup>
          </div>
          <FormGroup label="Status">
            <select className="form-input" value={form.status} onChange={setField("status")}>
              <option value="ACTIVE">✅ Aktiv</option>
              <option value="BLOCKED">🚫 Bloklangan</option>
              <option value="SUSPENDED">⏸ To'xtatilgan</option>
            </select>
          </FormGroup>
        </Modal>
      )}

      {/* ── Foydalanuvchilar modal ── */}
      {modal?.type === "users" && (
        <ShopUsersModal shop={modal.shop} onClose={closeModal} toast={toast} />
      )}
    </div>
  );
}

// ─── Do'kon foydalanuvchilari modali ─────────────────────────
const ROLE_OPTIONS = ["OWNER", "SHOP_ADMIN", "STOREKEEPER", "CASHIER"];
const ROLE_LABELS = { 
  OWNER: "Egasi", 
  SHOP_ADMIN: "Admin", 
  STOREKEEPER: "Omborchi", 
  CASHIER: "Kassir",
  ROLE_OWNER: "Egasi",
  ROLE_SHOP_ADMIN: "Admin",
  ROLE_STOREKEEPER: "Omborchi",
  ROLE_CASHIER: "Kassir"
};
const EMPTY_USER_FORM = { fullName: "", username: "", password: "", role: "CASHIER" };

function ShopUsersModal({ shop, onClose, toast }) {
  const confirm                 = useConfirm();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addMode, setAddMode]   = useState(false);
  const [form, setForm]         = useState(EMPTY_USER_FORM);
  const [saving, setSaving]     = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await shopAdminApi.getUsers(shop.id);
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await shopAdminApi.createUser(shop.id, form);
      toast.success("Foydalanuvchi qo'shildi");
      setAddMode(false);
      setForm(EMPTY_USER_FORM);
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async (u) => {
    const isActivating = u.enabled === false;
    const ok = await confirm({
      title: isActivating ? "Foydalanuvchini faollashtirish" : "Foydalanuvchini bloklash",
      message: isActivating 
        ? `${u.fullName} ni blokdan chiqarishni tasdiqlaysizmi?`
        : `Chindan ham ${u.fullName} ni bloklamoqchimisiz?`,
      type: isActivating ? "info" : "warning"
    });
    if (!ok) return;

    try {
      await shopAdminApi.toggleBlock(shop.id, u.id);
      toast.success("Holat o'zgartirildi");
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal
      title={`Foydalanuvchilar — ${shop.name}`}
      onClose={onClose}
      maxWidth={560}
      footer={
        !addMode ? (
          <button className="btn btn-primary btn-sm" onClick={() => setAddMode(true)}>
            <i className="fa-solid fa-plus" /> Foydalanuvchi qo'shish
          </button>
        ) : (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setAddMode(false)}>Bekor</button>
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
              <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-check"}`} />
              {saving ? "..." : "Qo'shish"}
            </button>
          </>
        )
      }
    >
      {/* Qo'shish formasi */}
      {addMode && (
        <div style={{ background: "var(--bg)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: "var(--blue)" }}>
            <i className="fa-solid fa-user-plus" style={{ marginRight: 6 }} />Yangi foydalanuvchi
          </div>
          <FormGroup label="Ism Familiya *">
            <input className="form-input" value={form.fullName} onChange={setField("fullName")} placeholder="Abdullayev Ali" autoFocus />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Username *">
              <input className="form-input mono" value={form.username} onChange={setField("username")} placeholder="ali_abdullayev" />
            </FormGroup>
            <FormGroup label="Parol *">
              <input className="form-input" type="password" value={form.password} onChange={setField("password")} placeholder="min 6 belgi" />
            </FormGroup>
          </div>
          <FormGroup label="Rol *">
            <select className="form-input" value={form.role} onChange={setField("role")}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
          </FormGroup>
        </div>
      )}

      {/* Foydalanuvchilar ro'yxati */}
      {loading ? <Loader /> : users.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => (
            <div key={u.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "white",
            }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                {u.fullName?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fw-700" style={{ fontSize: 14 }}>{u.fullName}</div>
                <div className="text-muted mono" style={{ fontSize: 12 }}>@{u.username}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(u.roles && u.roles.length > 0) ? u.roles.map((r) => (
                  <Badge key={r.id || r.name} color="blue">
                    {ROLE_LABELS[r.name] || r.name}
                  </Badge>
                )) : <Badge color="blue">{ROLE_LABELS[u.role] || u.role || "Xodim"}</Badge>}
                <Badge color={u.enabled ? "green" : "red"}>
                  {u.enabled ? "Aktiv" : "Bloklangan"}
                </Badge>
                <button
                  className={`btn btn-sm ${u.enabled ? "btn-danger" : "btn-green"}`}
                  onClick={() => handleToggleBlock(u)}
                  title={u.enabled ? "Bloklash" : "Blokdan chiqarish"}
                >
                  <i className={`fa-solid ${u.enabled ? "fa-ban" : "fa-check"}`} />
                  {u.enabled ? "Bloklash" : "Faollashtirish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="fa-users" text="Foydalanuvchi yo'q" />
      )}
    </Modal>
  );
}
