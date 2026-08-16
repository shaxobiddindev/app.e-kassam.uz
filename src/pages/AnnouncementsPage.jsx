/* ══════════════════════════════════════════════════════════════════════════
   AKSIYA VA YANGILIKLAR (V39) — do'konning mijozlarga ketadigan gapi

   Ilgari do'kon mijozlariga hech narsa ayta olmasdi: chegirma, yangi tovar,
   ish vaqti o'zgarishi — hammasi og'zaki qolardi.

   ⚠ YUBORISH — ALOHIDA VA BIR MARTALIK amal. Saqlashning o'zi push qilsa,
   xatoni tuzatish uchun qilingan har tahrir mijozning telefonini qayta
   chiriltirardi. Shuning uchun «Mijozlarga yuborish» alohida tugma, tasdiq
   so'raydi va bir marta bosilgach o'chib qoladi (server ham shuni qo'yadi).

   ⚠ Sana MAYDONLARI kun aniqligida: tugash sanasi kunning OXIRIGA
   o'rnatiladi, aks holda «31-avgustgacha» degan aksiya 31-avgust ertalab
   yo'qolib, mijozga do'kon aldagandek ko'rinardi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { announceApi } from "../api";
import { Modal } from "../components";
import { Empty } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { dateTime, date as fmtDate } from "../lib/ek-format";

const EMPTY_FORM = { title: "", body: "", startsAt: "", endsAt: "", active: true };

/** `Instant` → `<input type="date">` qiymati (mahalliy kun). */
const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Kun → `Instant`. `end` bo'lsa kunning OXIRI (izohga qarang). */
const fromDateInput = (v, end = false) => {
  if (!v) return null;
  const d = new Date(v + (end ? "T23:59:59" : "T00:00:00"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function AnnouncementsPage({ toast }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [form, setForm]     = useState(null);   // null | {id?, ...}
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await announceApi.list();
      setItems(res.data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const payload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt, true),
      active: form.active,
    };
    if (!payload.title) { toast?.error(t("ann.field.title")); return; }

    setSaving(true);
    try {
      if (form.id) await announceApi.update(form.id, payload);
      else await announceApi.create(payload);
      toast?.success(t("common.saved"));
      setForm(null);
      load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    const ok = await confirm({
      title: t("ann.deleteConfirmTitle"),
      message: t("ann.deleteConfirm"),
      type: "danger",
      confirmText: t("common.delete"),
    });
    if (!ok) return;
    try {
      await announceApi.remove(a.id);
      toast?.success(t("common.deleted"));
      load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const push = async (a) => {
    const ok = await confirm({
      title: t("ann.pushConfirmTitle"),
      message: t("ann.pushConfirm"),
      type: "warning",
      confirmText: t("ann.push"),
    });
    if (!ok) return;
    try {
      await announceApi.push(a.id);
      toast?.success(t("common.saved"));
      load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between",
                                            alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 className="page-title">{t("ann.title")}</h2>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 640 }}>
            {t("ann.hint")}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY_FORM })}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> {t("ann.add")}
        </button>
      </div>

      {busy && <SkeletonTable rows={3} />}

      {!busy && items.length === 0 && <Empty text={t("ann.empty")} icon="fa-bullhorn" />}

      {!busy && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("ann.field.title")}</th>
                <th>{t("ann.field.starts")}</th>
                <th>{t("ann.field.ends")}</th>
                <th>{t("common.status")}</th>
                <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.title}</b>
                    {a.body && (
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 2,
                                                           maxWidth: 420, whiteSpace: "pre-wrap" }}>
                        {a.body}
                      </div>
                    )}
                  </td>
                  <td>{a.startsAt ? fmtDate(a.startsAt) : "—"}</td>
                  <td>{a.endsAt ? fmtDate(a.endsAt) : "—"}</td>
                  <td>
                    {/* «Faol» va «ko'rinmoqda» BOSHQA narsa: faol e'lonning
                        muddati o'tgan bo'lishi mumkin. Rahbar buni ro'yxatdan
                        darhol ko'rishi kerak. */}
                    <span className={`badge ${a.visibleNow ? "badge-green" : "badge-yellow"}`}>
                      {a.visibleNow ? t("ann.status.visible") : t("ann.status.hidden")}
                    </span>
                    {a.pushSentAt && (
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 3 }}>
                        <i className="fa-solid fa-paper-plane" aria-hidden="true" />{" "}
                        {t("ann.pushSent")}: {dateTime(a.pushSentAt)}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {/* Yuborish faqat BIR MARTA — sababi fayl boshida */}
                    <button className="btn btn-outline btn-sm" disabled={!!a.pushSentAt || !a.visibleNow}
                            onClick={() => push(a)} title={t("ann.push")}>
                      <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                    </button>{" "}
                    <button className="btn btn-outline btn-sm" onClick={() => setForm({
                      id: a.id, title: a.title, body: a.body || "",
                      startsAt: toDateInput(a.startsAt), endsAt: toDateInput(a.endsAt),
                      active: a.active,
                    })} title={t("common.edit")}>
                      <i className="fa-solid fa-pen" aria-hidden="true" />
                    </button>{" "}
                    <button className="btn btn-outline btn-sm" onClick={() => remove(a)}
                            title={t("common.delete")}>
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? t("ann.edit") : t("ann.add")}
          onClose={() => setForm(null)}
          maxWidth={520}
          footer={
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {t("common.save")}
              </button>
            </div>
          }
        >
          <div className="form-group">
            <label className="form-label">{`${t("ann.field.title")} *`}</label>
            <input className="form-input" maxLength={120} autoFocus value={form.title}
                   onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("ann.field.body")}</label>
            <textarea className="form-input" rows={4} maxLength={2000} value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t("ann.field.starts")}</label>
              <input type="date" className="form-input" value={form.startsAt}
                     onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t("ann.field.ends")}</label>
              <input type="date" className="form-input" value={form.endsAt}
                     onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input type="checkbox" checked={form.active}
                   onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span>{t("ann.field.active")}</span>
          </label>
        </Modal>
      )}
    </div>
  );
}
