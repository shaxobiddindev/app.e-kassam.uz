import { useState } from "react";
import Modal from "./Modal";
import { FormGroup } from "./ui";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { Spinner } from "./ek/Loading";
import { dateTime } from "../lib/ek-format";

/* ══════════════════════════════════════════════════════════════════════════
   TO'LOVNI BEKOR QILISH (V102)

   Do'kon egasining qoidasi: «sotuv, qaytarish, qarz, to'lov yoki
   moliyaviy harakat hech qachon jismonan o'chirilmasin — xato bo'lsa
   RETURN / VOID / REVERSAL orqali tuzatilsin».

   ⚠ NEGA ALOHIDA OYNA, ODDIY TASDIQ EMAS. `ConfirmModal` «ha/yo'q»
   so'raydi, bu yerda esa SABAB kerak va u majburiy: jurnalga sababsiz
   tushgan bekor qilish tekshiruvda «nega?» degan savolni javobsiz
   qoldirardi — jurnalning butun ma'nosi esa o'sha savolga javob berish.

   ⚠ OQIBAT OLDINDAN YOZILADI. Kassir «bekor qilish» so'zidan uni
   shunchaki ekrandan olib tashlashni tushunishi mumkin. Aslida uch
   narsa bir vaqtda bo'ladi: qarz qaytadan ochiladi, naqd qismi
   kassadan chiqadi, keshbek olib qo'yiladi. Uchalasi ham tugma
   bosilishidan OLDIN ko'rinib turishi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

export default function ReversePaymentModal({ entry, customer, onClose, onSubmit, busy = false }) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length > 0 && !busy;

  const submit = () => { if (ok) onSubmit(reason.trim()); };

  return (
    <Modal
      title={t("credit.reverseTitle")}
      onClose={onClose}
      maxWidth={440}
      footer={
        <>
          {/* ⚠ «Yopish», «Bekor» EMAS. Ikkala tugmada ham «bekor»
              turgan oynada kassir qaysi biri qaysi ekanini bir
              qarashda ajrata olmasdi. */}
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
          <button className="btn btn-danger btn-sm" onClick={submit} disabled={!ok}>
            {busy ? <Spinner small /> : <i className="fa-solid fa-rotate-left" />}
            {" "}{t("credit.reverseDo")}
          </button>
        </>
      }
    >
      {/* Qaysi to'lov — summasi, sanasi, kim qabul qilgani. */}
      <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="fw-700">{customer?.fullName}</span>
        <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>
          {money(entry?.amount)}
        </span>
      </div>
      <div className="text-muted mono" style={{ fontSize: 12, marginBottom: 12 }}>
        {dateTime(entry?.createdAt)}
        {entry?.userName ? ` · ${entry.userName}` : ""}
        {entry?.paymentMethod ? ` · ${t(`enum.payment.${entry.paymentMethod}`)}` : ""}
      </div>

      {/* ⚠ OQIBAT — TUGMADAN OLDIN. Ogohlantirish rangi tokendan:
          qattiq `--red` qorong'i temada fon bilan birga yorug' bo'lib
          o'qilmay qolardi. */}
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        background: "var(--bg-warning-subtle)", color: "var(--fg-warning)",
        border: "1px solid var(--border-warning)", borderRadius: 10,
        padding: "10px 12px", fontSize: 12.5, fontWeight: 700, marginBottom: 14,
      }}>
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" style={{ marginTop: 2 }} />
        <span>{t("credit.reverseHint")}</span>
      </div>

      <FormGroup label={t("credit.reverseReason")}>
        {/* ⚠ Ko'p qatorli maydon: «kassir boshqa mijozga yozib
            yuborgan, mijoz qaytarib berdi» kabi izohni bir qatorga
            sig'dirib bo'lmaydi va kassir uni qisqartirib yozardi. */}
        <textarea
          className="form-input"
          rows={3}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("credit.reverseReasonPh")}
          aria-label={t("credit.reverseReason")}
        />
      </FormGroup>
    </Modal>
  );
}
