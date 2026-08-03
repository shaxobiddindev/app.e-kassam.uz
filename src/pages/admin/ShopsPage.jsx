import { useCallback, useEffect, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { shopApi } from "../../api";
import { maskPhone, cleanPhone } from "../../config";
import { Empty, FormGroup, Badge } from "../../components/ui";
import { Modal } from "../../components";
import { SHOP_STATUS, options } from "../../lib/ek-labels";
import Select from "../../components/ek/Select";
import { SkeletonList } from "../../components/ek/Loading";
import { useLoading } from "../../lib/use-loading";

const EMPTY_BRANCH_FORM = { name: "", code: "", phone: "998", address: "" };

export default function ShopsPage({ toast }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [modal, setModal]       = useState(null); // null | "add" | { type:"edit", branch }
  const [form, setForm]         = useState(EMPTY_BRANCH_FORM);
  const [saving, setSaving]     = useState(false);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getBranches();
      setBranches(res.data || []);
    } catch (err) {
      toast.error(t("branch.loadFailed"));
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
      toast.error(t("branch.required"));
      return;
    }
    setSaving(true);
    try {
      if (modal === "add") {
        await shopApi.createBranch(form);
        toast.success(t("branch.added"));
      } else {
        await shopApi.updateBranch(modal.branch.id, form);
        toast.success(t("branch.updated"));
      }
      setModal(null);
      setForm(EMPTY_BRANCH_FORM);
      loadBranches();
    } catch (err) {
      toast.error(err.message || t("common.unknownError"));
    } finally {
      setSaving(false);
    }
  };

  const setField = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("branch.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={loadBranches} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> {t("branch.new")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {busy ? <SkeletonList rows={5} /> : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("branch.name")}</th>
                  <th>{t("branch.code")}</th>
                  <th>{t("common.phone")}</th>
                  <th>{t("common.address")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.date")}</th>
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
                        {b.status === "ACTIVE" ? t("common.active") : b.status === "INACTIVE" ? t("branch.inactive") : b.status}
                      </Badge>
                    </td>
                    <td className="text-muted" style={{ fontSize: 12 }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString("uz-UZ") : "—"}
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(b)} title={t("common.edit")}>
                        <i className="fa-solid fa-pen" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="fa-store-slash" text={t("branch.none")} />
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
          title={modal === "add" ? t("branch.new") : t("branch.edit")}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <div className="grid-2">
            <FormGroup label={`${t("branch.name")} *`}>
              <input className="form-input" value={form.name} onChange={setField("name")} placeholder={t("branch.namePlaceholder")} />
            </FormGroup>
            <FormGroup label={`${t("branch.code")} *`}>
              <input className="form-input mono" value={form.code} onChange={setField("code")} placeholder="branch-1" disabled={modal?.type === "edit"} />
              <small className="text-muted">{t("branch.codeHint")}</small>
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label={t("common.phone")}>
              <input 
                className="form-input mono" 
                value={maskPhone(form.phone)} 
                onChange={(e) => setForm(p => ({ ...p, phone: cleanPhone(e.target.value) }))} 
                placeholder="+998 (__) ___-__-__" 
              />
            </FormGroup>
            <FormGroup label={t("common.address")}>
              <input className="form-input" value={form.address} onChange={setField("address")} placeholder="Toshkent sh., Chilonzor" />
            </FormGroup>
          </div>
          {modal?.type === "edit" && (
            <FormGroup label={t("common.status")}>
              {/* ShopStatus enum'idagi BARCHA qiymatlar (ilgari faqat ikkitasi
                  bor edi va BLOCKED/SUSPENDED xom ko'rinardi) */}
              <Select
                block variant="field" ariaLabel={t("adm.shops.statusLabel")}
                value={form.status}
                onChange={(v) => setField("status")({ target: { value: v } })}
                options={["ACTIVE", "BLOCKED", "SUSPENDED", "INACTIVE"].map((k) => ({
                  value: k, label: SHOP_STATUS[k].label, icon: SHOP_STATUS[k].icon,
                }))}
              />
            </FormGroup>
          )}
        </Modal>
      )}
    </div>
  );
}
