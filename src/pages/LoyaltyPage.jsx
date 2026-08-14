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
import { loyaltyApi, shopApi } from "../api";
import { Modal } from "../components";
import { Empty } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { money } from "../utils";
import { NumField } from "../components/ek/EkFields";

const EMPTY_FORM = { name: "", minSpent: "", discountPercent: "", cashbackPercent: "" };

export default function LoyaltyPage({ toast }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [form, setForm] = useState(null);   // null | {id?, ...}
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  /* Do'kon sozlamasi — chekning necha foizi ball bilan yopiladi.
     Matn maydonida saqlanadi: yozayotganda har harfda so'rov ketmasin,
     `onBlur` da bir marta yuboriladi. */
  const [maxPercent, setMaxPercent] = useState("");
  const [savedMax, setSavedMax] = useState("");
  /* Ball muddati (V30), kunlarda. "0" — muddatsiz. */
  const [expiryDays, setExpiryDays] = useState("0");
  const [savedExpiry, setSavedExpiry] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tierRes, profile] = await Promise.all([
        loyaltyApi.tiers(),
        shopApi.getProfile().catch(() => null),
      ]);
      setTiers(tierRes.data || []);
      if (profile?.data?.bonusMaxPercent != null) {
        const v = String(Number(profile.data.bonusMaxPercent));
        setMaxPercent(v);
        setSavedMax(v);
      }
      const ed = String(profile?.data?.bonusExpiryDays ?? 0);
      setExpiryDays(ed);
      setSavedExpiry(ed);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const saveMaxPercent = async () => {
    // O'zgarmagan bo'lsa so'rov yubormaymiz — `onBlur` har fokus yo'qolganda
    // ishlaydi va usiz bir xil qiymat qayta-qayta saqlanardi.
    if (maxPercent === savedMax) return;
    const v = Number(maxPercent);
    if (!(v >= 0 && v <= 100)) { toast?.error(t("loyalty.invalid")); setMaxPercent(savedMax); return; }
    try {
      await shopApi.setBonusMaxPercent(v);
      setSavedMax(String(v));
      toast?.success(t("loyalty.saved"));
    } catch (err) {
      toast?.error(err.message);
      setMaxPercent(savedMax);
    }
  };

  /* ── Ball muddati (V30) ──────────────────────────────────────────────
     JIMGINA KUYDIRISH YO'Q: saqlashdan oldin server «qancha kuyadi»
     deb hisoblab beradi (preview) va egasi shu raqamni KO'RIB tasdiqlaydi.
     Tasdiqlagach — darhol qo'llash ham taklif qilinadi (kunlik 03:40 ni
     kutmasdan), rad etsa keyingi tunda o'zi kuyadi. */
  const saveExpiryDays = async () => {
    if (expiryDays === savedExpiry) return;
    const v = Number(expiryDays);
    if (!Number.isInteger(v) || v < 0 || (v > 0 && v < 30) || v > 3650) {
      toast?.error(t("loyalty.expiryInvalid"));
      setExpiryDays(savedExpiry);
      return;
    }
    try {
      if (v > 0) {
        const p = await loyaltyApi.expiryPreview(v);
        const burn = Number(p?.data?.amount || 0);
        const ok = await confirm({
          title: t("loyalty.expiryTitle"),
          message: burn > 0
            ? t("loyalty.expiryConfirmBurn", { days: v, amount: money(burn) })
            : t("loyalty.expiryConfirmNone", { days: v }),
          type: burn > 0 ? "danger" : "info",
        });
        if (!ok) { setExpiryDays(savedExpiry); return; }
        await shopApi.setBonusExpiryDays(v);
        setSavedExpiry(String(v));
        if (burn > 0) {
          const runNow = await confirm({
            title: t("loyalty.expiryRunTitle"),
            message: t("loyalty.expiryRunMsg", { amount: money(burn) }),
            type: "danger",
          });
          if (runNow) await loyaltyApi.expiryRun();
        }
      } else {
        await shopApi.setBonusExpiryDays(0);
        setSavedExpiry("0");
      }
      toast?.success(t("loyalty.saved"));
    } catch (err) {
      toast?.error(err.message);
      setExpiryDays(savedExpiry);
    }
  };

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      minSpent: Number(form.minSpent),
      discountPercent: Number(form.discountPercent) || 0,
      cashbackPercent: Number(form.cashbackPercent) || 0,
    };
    /* ⚠ Ikkalasidan KAMIDA BITTASI bo'lishi kerak. Ikkalasi ham nol bo'lgan
       daraja mijozga hech narsa bermaydi va faqat jadvalni chalkashtiradi. */
    if (!payload.name || !(payload.minSpent >= 0)
        || (!(payload.discountPercent > 0) && !(payload.cashbackPercent > 0))) {
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

      {/* ── Ball chegarasi ──────────────────────────────────────────────
          ⚠ Bu do'kon sozlamasi, daraja emas: chekning eng ko'pi shuncha
          foizi ball bilan yopiladi. Usiz butun chekni ball bilan yopib
          bo'lardi va kassaga bir tiyin tushmasdi. */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t("loyalty.maxPercent")}</span>
          <NumField kind="percent"
            className="form-input ek-num"
            style={{ width: 100 }}
            value={maxPercent}
            onChange={(e) => setMaxPercent(e.target.value)}
            onBlur={saveMaxPercent}
          />
          <span className="text-muted" style={{ fontSize: 12, flex: 1, minWidth: 220 }}>
            {t("loyalty.maxPercentHint")}
          </span>
        </div>
      </div>

      {/* ── Ball muddati (V30) ──────────────────────────────────────────
          Standart 0 (muddatsiz) — hech narsa o'zgarmaydi. Yoqishda server
          «qancha kuyadi» ni ko'rsatadi va ega tasdiqlaydi. */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t("loyalty.expiryDays")}</span>
          <NumField kind="int"
            className="form-input ek-num"
            style={{ width: 100 }}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            onBlur={saveExpiryDays}
          />
          <span className="text-muted" style={{ fontSize: 12, flex: 1, minWidth: 220 }}>
            {t("loyalty.expiryHint")}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {busy ? <SkeletonTable rows={4} cols={["text", "narrow", "narrow", "narrow"]} /> : (
            <table>
              <thead>
                <tr>
                  <th>{t("loyalty.name")}</th>
                  <th className="num">{t("loyalty.minSpent")}</th>
                  <th className="num">{t("loyalty.percent")}</th>
                  <th className="num">{t("loyalty.cashback")}</th>
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
                    <td className="num mono fw-700" style={Number(tier.cashbackPercent) > 0 ? { color: "var(--fg-warning)" } : undefined}>
                      {tier.cashbackPercent}%
                    </td>
                    <td className="num">
                      <button className="btn btn-outline btn-sm" onClick={() => setForm({
                        id: tier.id, name: tier.name,
                        minSpent: String(tier.minSpent), discountPercent: String(tier.discountPercent),
                        cashbackPercent: String(tier.cashbackPercent ?? 0),
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
                  <tr><td colSpan={5}><Empty icon="fa-award" text={t("loyalty.empty")} /></td></tr>
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
            <NumField kind="money" className="form-input ek-num"
                   value={form.minSpent} onChange={(e) => setForm({ ...form, minSpent: e.target.value })} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("loyalty.minSpentHint")}</div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{`${t("loyalty.percent")} *`}</label>
            <NumField kind="percent" max={50} className="form-input ek-num"
                   value={form.discountPercent}
                   onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            {/* ⚠ Yuqori chegara 50: 100% chegirma — sovg'a, chegirma emas,
                va uni jadvaldan qo'yish egasi uchun ochiladigan teshik. */}
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("loyalty.percentHint")}</div>
          </div>

          {/* ⚠ Keshbek chegarasi chegirmanikidan PAST (20%): ball keyingi
              xaridda pul o'rniga ishlatiladi, ya'ni kechiktirilgan chegirma.
              50% keshbek amalda «ikkinchi mahsulot tekin» degani. */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("loyalty.cashback")}</label>
            <NumField kind="percent" max={20} className="form-input ek-num"
                   value={form.cashbackPercent}
                   onChange={(e) => setForm({ ...form, cashbackPercent: e.target.value })} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("loyalty.cashbackHint")}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
