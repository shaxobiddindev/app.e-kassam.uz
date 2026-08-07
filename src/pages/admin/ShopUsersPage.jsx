import { useCallback, useEffect, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { shopApi } from "../../api";
import { Empty, FormGroup, Badge } from "../../components/ui";
import { BranchSelector, Modal } from "../../components";
import { useAuth } from "../../hooks/useAuth";
import { useConfirm } from "../../context/ConfirmProvider";
import { useBadge } from "../../context/BadgeProvider";
import { roleLabel } from "../../lib/ek-labels";
import Select from "../../components/ek/Select";
import { SkeletonList, Spinner } from "../../components/ek/Loading";
import { useLoading } from "../../lib/use-loading";

/* Rollar yagona lug'atdan (src/lib/ek-labels.js). `roleLabel` Spring'ning
   `ROLE_` prefiksini ham, katta-kichik harf farqini ham o'zi hal qiladi —
   shuning uchun bu yerda har bir variantni qo'lda sanab chiqish kerak emas. */
const ROLE_OPTIONS = ["SHOP_ADMIN", "STOREKEEPER", "CASHIER"];
const EMPTY_USER_FORM = { fullName: "", username: "", password: "", role: "CASHIER" };

export default function ShopUsersPage({ toast }) {
  const { user: currentUser }   = useAuth();
  const confirm                 = useConfirm();
  const { guard } = useBadge();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]         = useState(EMPTY_USER_FORM);
  const [saving, setSaving]     = useState(false);
  const [branchId, setBranchId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getUsers(branchId);
      // Backend allaqachon filtrlaydi, lekin ishonch uchun frontend-da ham o'zini o'chirib tashlaymiz
      const filtered = (res.data || []).filter(u => u.username !== currentUser?.username);
      setUsers(filtered);
    } catch (err) {
      toast.error(t("staff.loadFailed"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast, branchId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSave = async () => {
    if (!form.fullName || (!form.username && modalMode === "add") || (modalMode === "add" && !form.password)) {
      toast.error(t("products.requiredFields"));
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "add") {
        await guard(() => shopApi.createUser(form, branchId));
        toast.success(t("staff.added"));
      } else {
        await guard(() => shopApi.updateUser(editingId, {
          fullName: form.fullName,
          role:     form.role,
          password: form.password || undefined // Bo'sh bo'lsa parolni o'zgartirmaydi
        }, branchId));
        toast.success(t("staff.saved"));
      }
      setModalMode(null);
      setForm(EMPTY_USER_FORM);
      loadUsers();
    } catch (err) {
      toast.error(err.message || t("common.unknownError"));
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
      role:     u.roles?.[0]?.type || u.role || "CASHIER"
    });
    setModalMode("edit");
  };

  const handleDelete = async (userId) => {
    const ok = await confirm({
      title: t("staff.deleteTitle"),
      message: t("staff.deleteMsg"),
      type: "danger"
    });
    if (!ok) return;
    try {
      await guard(() => shopApi.deleteUser(userId, branchId));
      toast.success(t("staff.deleted"));
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleBlock = async (u) => {
    const isActivating = u.enabled === false;
    const ok = await confirm({
      title: isActivating ? t("adm.users.unblockTitle") : t("adm.users.blockTitle"),
      message: isActivating 
        ? `${u.fullName} ni tizimga kirishini tiklamoqchimisiz?`
        : `Chindan ham ${u.fullName} ni bloklamoqchimisiz? U tizimga kira olmaydi.`,
      type: isActivating ? "info" : "warning"
    });
    if (!ok) return;

    try {
      await guard(() => shopApi.toggleBlockUser(u.id, branchId));
      toast.success(t("staff.statusChanged"));
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("staff.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={loadUsers} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
           <button className="btn btn-primary" onClick={() => { setForm(EMPTY_USER_FORM); setModalMode("add"); }}>
            <i className="fa-solid fa-plus" /> {t("common.add")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {busy ? <SkeletonList rows={5} /> : (
            <table>
              <thead>
                <tr>
                  <th>{t("staff.col")}</th>
                  <th>{t("common.username")}</th>
                  <th>{t("common.role")}</th>
                  <th>{t("common.status")}</th>
                  <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
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
                      {(u.roles && u.roles.length > 0) ? (
                        u.roles.map((r) => (
                          <Badge key={r.id || r.name} color="blue">
                            {roleLabel(r)}
                          </Badge>
                        ))
                      ) : (
                        <Badge color="blue">
                          {roleLabel(u.role)}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge color={u.enabled !== false ? "green" : "red"}>
                        {u.enabled !== false ? t("common.active") : t("common.blocked")}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-icon btn-sm" title={t("common.edit")} onClick={() => handleEditClick(u)}>
                          <i className="fa-solid fa-pen-to-square text-blue" />
                        </button>
                        <button
                          className="btn btn-icon btn-sm"
                          title={u.enabled !== false ? t("adm.shops.block") : t("adm.shops.activate")}
                          onClick={() => handleToggleBlock(u)}
                        >
                          <i className={`fa-solid ${u.enabled !== false ? "fa-ban text-orange" : "fa-check text-green"}`} />
                        </button>
                        <button className="btn btn-icon btn-sm" title={t("common.delete")} onClick={() => handleDelete(u.id)}>
                          <i className="fa-solid fa-trash-can text-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}><Empty icon="fa-user-slash" text={t("staff.none")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalMode && (
        <Modal
          title={modalMode === "add" ? t("staff.new") : t("staff.edit")}
          onClose={() => setModalMode(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModalMode(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={`${t("common.fullName")} *`}>
            <input className="form-input" value={form.fullName} onChange={setField("fullName")} placeholder="Ali Valiyev" autoFocus />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label={`${t("common.username")} *`}>
              <input 
                className="form-input mono" 
                value={form.username} 
                onChange={setField("username")} 
                placeholder="ali" 
                disabled={modalMode === "edit"} 
              />
            </FormGroup>
            <FormGroup label={modalMode === "add" ? `${t("common.password")} *` : t("adm.users.passwordOptional")}>
              <input className="form-input" type="password" value={form.password} onChange={setField("password")} placeholder={modalMode === "add" ? "min 6 belgi" : t("staff.passwordChangeHint")} />
            </FormGroup>
          </div>
          <FormGroup label={`${t("common.role")} *`}>
            <Select
              block variant="field" ariaLabel={t("common.role")}
              value={form.role}
              onChange={(v) => setField("role")({ target: { value: v } })}
              options={ROLE_OPTIONS.map((r) => ({ value: r, label: roleLabel(r), icon: "fa-user-tag" }))}
            />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}

