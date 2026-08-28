import { useState } from "react";
import Modal from "./Modal";
import { Field, FormGroup } from "./ui";
import { PhoneField, NumField } from "./ek/EkFields";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   QO'LDA QARZDOR KIRITISH (V48)

   ⚠ NEGA KERAK. Do'kon tizimga endi ko'chayotgan bo'lsa, daftarida
   o'nlab ochiq qarz turadi. Ilgari ularni kiritishning yagona yo'li
   soxta sotuv yasash edi: omborda bo'lmagan tovarni "sotib", tushumni
   ham, qoldiqni ham buzib. Bu yerda qarz to'g'ridan-to'g'ri jurnalga
   tushadi va sotuvlar tarixiga umuman tegmaydi.

   ⚠ SANA — ENG MUHIM MAYDON, shuning uchun u ko'zga tashlanadigan
   joyda va tayyor tugmalari bilan turadi. Qarz muddati aynan shundan
   yuradi (`CreditDueMode`): 3 oy oldingi qarzni "bugun" deb kiritish
   uni muddati hech qachon o'tmaydigan qarzga aylantirardi — ya'ni
   do'kon eslatmani ham, ro'yxatni ham yo'qotardi.

   ⚠ TASDIQ SO'ROVI ODATDA O'CHIQ. Daftar ko'chirilayotganda o'nlab
   mijozga bir vaqtda «qarzingizni tasdiqlang» degan xabar ketardi:
   pul ham, ishonch ham bekorga sarflanardi. Kerak bo'lsa — belgilanadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** `YYYY-MM-DD` — `<input type="date">` shu ko'rinishni kutadi. */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const daysAgo = (n) => iso(Date.now() - n * 864e5);

export default function ManualDebtModal({ onClose, onSave, saving = false }) {
  const today = iso(Date.now());
  const [form, setForm] = useState({
    fullName: "", phone: "", amount: "", date: today, reason: "", askConfirm: false,
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const amountNum = Number(form.amount) || 0;
  const ok = form.fullName.trim() && form.phone && amountNum > 0 && form.date <= today;

  const submit = () => {
    if (!ok || saving) return;
    onSave({
      fullName: form.fullName.trim(),
      phone: form.phone,
      amount: amountNum,
      /* ⚠ Sana KUN sifatida keladi, vaqt esa yo'q. Kunning BOSHI
         olinadi: kechqurun kiritilgan «bugungi» qarz ertaga
         hisoblanishni bir kunga kechiktirmasin. */
      takenAt: new Date(`${form.date}T00:00:00`).toISOString(),
      reason: form.reason.trim() || null,
      askConfirm: form.askConfirm,
    });
  };

  return (
    <Modal
      title={t("credit.manualTitle")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={!ok || saving}>
            {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {t("credit.manualHint")}
      </p>

      <FormGroup label={`${t("common.fullName")} *`}>
        <Field kind="name" className="form-input" value={form.fullName}
               onChange={set("fullName")} placeholder="Abdullayev Ali" autoFocus />
      </FormGroup>

      <FormGroup label={`${t("common.phone")} *`}>
        <PhoneField className="form-input mono ek-num" value={form.phone} onChange={set("phone")} />
      </FormGroup>

      <FormGroup label={`${t("credit.balance")} *`}>
        <NumField kind="money" className="form-input ek-num" value={form.amount}
                  onChange={set("amount")} placeholder="0" />
        {amountNum > 0 && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{money(amountNum)}</div>
        )}
      </FormGroup>

      <FormGroup label={`${t("credit.takenAt")} *`}>
        <input type="date" className="form-input ek-num" value={form.date}
               max={today} onChange={set("date")} />
        {/* Tayyor tugmalar — daftarda aniq sana yozilmagan bo'lsa,
            do'koncha «taxminan bir oy oldin» deb belgilaydi. */}
        <div className="debt-quick" style={{ marginTop: 6 }}>
          {[[0, t("credit.today")], [7, t("credit.weekAgo")], [30, t("credit.monthAgo")]].map(([n, label]) => (
            <button key={n} type="button" className="btn btn-outline btn-sm"
                    onClick={() => setForm((p) => ({ ...p, date: daysAgo(n) }))}>
              {label}
            </button>
          ))}
        </div>
      </FormGroup>

      <FormGroup label={t("credit.reason")}>
        <Field className="form-input" value={form.reason} onChange={set("reason")}
               placeholder={t("credit.manualReasonHint")} />
      </FormGroup>

      {/* ⚠ Bu belgi MIJOZGA xabar yuboradi — shuning uchun izohi bilan. */}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={form.askConfirm} style={{ marginTop: 3 }}
               onChange={(e) => setForm((p) => ({ ...p, askConfirm: e.target.checked }))} />
        <span>
          <span className="fw-700">{t("credit.askConfirm")}</span>
          <span className="text-muted" style={{ display: "block", fontSize: 12 }}>
            {t("credit.askConfirmHint")}
          </span>
        </span>
      </label>
    </Modal>
  );
}
