/* ══════════════════════════════════════════════════════════════════════════
   Sodiqlik darajalari — mijozning umumiy xaridiga qarab avtomatik chegirma.

   ⚠ Tizimdagi qolgan hamma modul pulni QO'RIQLAYDI (kamomad, naqdsiz farq,
   sanoq, qarz, chiqit). Bu — birinchi modul, u pulni OLIB KELISHI kerak.

   ⚠ Darajani kassir TANLAMAYDI: chegirma mijozning o'z tarixidan kelib
   chiqadi va serverda hisoblanadi. Shu sahifa esa jadvalning o'zini
   sozlaydi va u faqat rahbarga ochiq — chegirma jadvali pulga tegadi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { loyaltyApi } from "../api";
import { Modal } from "../components";
import { Empty } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { money } from "../utils";

const EMPTY_FORM = { name: "", minSpent: "", discountPercent: "" };

export default function LoyaltyPage({ toast }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [form, setForm] = useState(null);   // null | {id?, ...}
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTiers((await loyaltyApi.tiers()).data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      minSpent: Number(form.minSpent),
      discountPercent: Number(form.discountPercent),
    };
    if (!payload.name || !(payload.minSpent >= 0) || !(payload.discountPercent > 0)) {
      toast?.error(t("loyalty.invalid"));
      return;
    }
    setSaving(true);
    try {
      if (form.id) await loyaltyApi.updateTier(form.id, payload);
      else await loyaltyApi.createTier(payload);
      toast?.success(t("loyalty.saved"));
      setForm(null);
      load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tier) => {
    /* ⚠ "O'chirish" — yozuvni yo'q qilish EMAS: eski cheklarda daraja nomi
       muzlatilgan holda qoladi va jadvaldan butunlay yo'qolsa, "bu chegirma
       qayerdan chiqdi" degan savol javobsiz qolardi. */
    if (!(await confirm({
      title: t("loyalty.deactivateTitle"),
      message: t("loyalty.deactivateMsg", { name: tier.name }),
    }))) return;
    try {
      await loyaltyApi.removeTier(tier.id);
      toast?.success(t("loyalty.saved"));
      load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="page-title">{t("loyalty.title")}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...EMPTY_FORM })}>
          <i className="fa-solid fa-plus" /> {t("loyalty.add")}
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>{t("loyalty.hint")}</p>

      <div className="card">
        <div className="table-wrap">
          {busy ? <SkeletonTable rows={4} cols={["text", "narrow", "narrow", "narrow"]} /> : (
            <table>
              <thead>
                <tr>
                  <th>{t("loyalty.name")}</th>
                  <th className="num">{t("loyalty.minSpent")}</th>
                  <th className="num">{t("loyalty.percent")}</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {tiers.length ? tiers.map((tier) => (
                  <tr key={tier.id} style={tier.active ? undefined : { opacity: 0.5 }}>
                    <td className="fw-700">
                      <i className="fa-solid fa-award" style={{ color: "var(--fg-warning)", marginRight: 6 }} />
                      {tier.name}
                      {!tier.active && (
                        <span className="badge badge-gray" style={{ marginLeft: 8 }}>{t("loyalty.inactive")}</span>
                      )}
                    </td>
                    <td className="num mono">{money(tier.minSpent)}</td>
                    <td className="num mono fw-700">{tier.discountPercent}%</td>
                    <td className="num">
                      <button className="btn btn-outline btn-sm" onClick={() => setForm({
                        id: tier.id, name: tier.name,
                        minSpent: String(tier.minSpent), discountPercent: String(tier.discountPercent),
                      })}>
                        <i className="fa-solid fa-pen" />
                      </button>
                      {tier.active && (
                        <button className="btn btn-outline btn-sm" style={{ marginLeft: 6 }} onClick={() => remove(tier)}>
                          <i className="fa-solid fa-ban" />
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}><Empty icon="fa-award" text={t("loyalty.empty")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && (
        <Modal
          title={form.id ? t("loyalty.edit") : t("loyalty.add")}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">{`${t("loyalty.name")} *`}</label>
            <input className="form-input" maxLength={60} autoFocus
                   value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder={t("loyalty.namePh")} />
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{`${t("loyalty.minSpent")} *`}</label>
            <input className="form-input" type="number" min="0"
                   value={form.minSpent} onChange={(e) => setForm({ ...form, minSpent: e.target.value })} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("loyalty.minSpentHint")}</div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{`${t("loyalty.percent")} *`}</label>
            <input className="form-input" type="number" min="0" max="50" step="0.5"
                   value={form.discountPercent}
                   onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            {/* ⚠ Yuqori chegara 50: 100% chegirma — sovg'a, chegirma emas,
                va uni jadvaldan qo'yish egasi uchun ochiladigan teshik. */}
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("loyalty.percentHint")}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
