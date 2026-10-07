import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { shopApi } from "../api";
import { Field, FormGroup } from "./ui";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   XIZMAT HAQI — Sozlamalar (R5, V152, docs/22-RESTORAN.md)

   Egasining qarori: fiskal chekda ALOHIDA QATOR. Shuning uchun foiz bilan
   birga xizmatning MXIK kodi va QQS stavkasi so'raladi; kodsiz foizni
   server qabul qilmaydi (MXIKsiz qator fiskal chekni buzardi).

   ⚠ Faqat EGA (server ham shunday — `SecurityConfig`): bu chek summasini
   oshiradi va kassir o'zi yoqib-o'chira olmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */
export default function ServiceChargeSettings({ toast }) {
  const [form, setForm] = useState({ percent: "", mxik: "", vatRate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    shopApi.getProfile().then((r) => {
      if (!alive) return;
      const d = r?.data || {};
      setForm({
        percent: d.serviceChargePercent == null ? "" : String(Number(d.serviceChargePercent)),
        mxik: d.serviceChargeMxik || "",
        vatRate: d.serviceChargeVatRate == null ? "" : String(Number(d.serviceChargeVatRate)),
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await shopApi.setServiceCharge({
        percent: form.percent === "" ? null : Number(form.percent),
        mxik: form.mxik.trim() || null,
        vatRate: form.vatRate === "" ? null : Number(form.vatRate),
      });
      toast?.success?.(t("common.saved"));
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-bell-concierge" aria-hidden="true" /> {t("svc.title")}
        </span>
      </div>
      <p className="set-card__hint">{t("svc.hint")}</p>
      <div className="svc-grid">
        <FormGroup label={t("svc.percent")}>
          <Field kind="percent" className="form-input ek-num" placeholder="0" value={form.percent} onChange={set("percent")} />
          <div className="form-hint">{t("svc.off")}</div>
        </FormGroup>
        <FormGroup label={t("svc.mxik")}>
          <Field kind="mxik" className="form-input ek-num" maxLength={17} placeholder="00000000000000000"
                 value={form.mxik} onChange={set("mxik")} />
          <div className="form-hint">{t("svc.mxikHint")}</div>
        </FormGroup>
        <FormGroup label={t("svc.vat")}>
          <Field kind="percent" className="form-input ek-num" placeholder="12" value={form.vatRate} onChange={set("vatRate")} />
        </FormGroup>
      </div>
      <div className="svc-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />} {t("common.save")}
        </button>
      </div>
    </div>
  );
}
