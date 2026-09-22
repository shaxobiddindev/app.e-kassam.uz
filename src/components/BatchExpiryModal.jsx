import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { Modal } from ".";
import { DateField } from "./ek/EkFields";
import { Spinner } from "./ek/Loading";
import { inventoryApi } from "../api";
import { useBadge } from "../context/BadgeProvider";
import { shortDate } from "../lib/ek-format";

/* ══════════════════════════════════════════════════════════════════════════
   PARTIYA MUDDATINI O'ZGARTIRISH

   ⚠ NEGA ALOHIDA OYNA, `BatchCorrectModal` GA QO'SHILMAGAN. Ikkalasi ham
   bitta partiyaga tegadi, lekin ular BOSHQA-BOSHQA hodisa:

     qoldiq  — javonda nima borligi haqidagi da'vo;
     muddat  — o'sha tovar qachongacha sotilishi mumkinligi.

   Bitta oynada bo'lsa, ikkalasi BITTA tasdiq va BITTA jurnal yozuvi
   ostiga tushardi. Keyin «kim muddatni uzaytirdi?» degan savolga javob
   berib bo'lmasdi: yozuvda «qoldiq 10 → 10, muddat 2026 → 2027» turardi
   va rahbar nimani tasdiqlaganini aniq bilmasdi.

   ⚠ BAJIK KOMPONENTNING O'ZIDA, propda EMAS — `BatchCorrectModal` dagi
   sabab bilan bir xil: ixtiyoriy prop berilmasa chaqiruv qorovulsiz
   o'tib ketardi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @param batch    muddati o'zgartiriladigan partiya
 * @param onClose  oyna yopilganda
 * @param onSaved  saqlangandan keyin (ro'yxatni yangilash)
 */
export default function BatchExpiryModal({ batch, onClose, onSaved, toast }) {
  const { guard } = useBadge();
  const [date, setDate] = useState(batch.expiryDate || "");
  /* Sana YOZILGAN-u tugallanmagan (`22-10-2`). Bo'sh maydondan farq
     qiladi: bo'shatish — QONUNIY amal (muddatsiz tovar), yarim yozilgani
     esa hech qachon. */
  const [bad, setBad] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const was = batch.expiryDate || null;
  const now = date || null;
  const changed = was !== now;

  /* ⚠ YO'NALISH EKRANDA AYTILADI. «2026-10-22 → 2027-10-22» ni ko'rgan
     odam bu uzaytirish ekanini o'zi hisoblab o'tirmasligi kerak — ayniqsa
     tasdiqlayotgan rahbar. Uzaytirish esa muddati o'tgan tovarni javonga
     qaytarishning yagona yo'li. */
  const direction = !changed ? null
    : now === null ? "cleared"
    : was === null ? "added"
    : now > was ? "extended"
    : "shortened";

  const submit = async () => {
    if (!changed || bad || !reason.trim()) return;
    setSaving(true);
    try {
      await guard(() => inventoryApi.changeBatchExpiry(batch.inventoryId, now, reason.trim()));
      toast?.success(t("batch.expiryChanged"));
      onSaved?.();
      onClose?.();
    } catch (err) {
      if (!err?.cancelled) toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${t("batch.expiryEdit")} — ${batch.productName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={submit}
                  disabled={saving || !changed || bad || !reason.trim()}>
            {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {" "}{saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <div className="batch-correct__now">
        <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {t("batch.expiryNow")}
        </span>
        <span className="mono fw-800" style={{ fontSize: 16 }}>
          {batch.expiryDate ? shortDate(batch.expiryDate) : t("batch.noExpiry")}
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">{t("batch.expiryNew")}</label>
        <DateField
          className="form-input ek-num"
          value={date}
          onChange={(e) => { setDate(e.target.value); setBad(!!e.incomplete); }}
          autoFocus
        />
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {t("batch.expiryClearHint")}
        </div>
      </div>

      {/* ⚠ OGOHLANTIRISH FAQAT XAVFLI YO'NALISHDA. Qisqartirish — ehtiyotkor
          amal (tovar javondan ertaroq chiqadi) va uni ham qizil qilish
          ogohlantirishning ma'nosini yo'qotardi: har safar chiqadigan
          ogohlantirish o'qilmay qoladi. */}
      {(direction === "extended" || direction === "cleared") && (
        <div className="ek-note ek-note--warning" style={{ marginTop: 14 }}>
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{t(direction === "cleared" ? "batch.expiryClearWarn" : "batch.expiryExtendWarn")}</span>
        </div>
      )}

      <div className="form-group" style={{ marginTop: 14 }}>
        <label className="form-label">{`${t("inv.reason")} *`}</label>
        <input className="form-input" type="text" value={reason} maxLength={200}
               onChange={(e) => setReason(e.target.value)}
               placeholder={t("batch.expiryReasonPh")} />
        {/* Sabab jurnalga tushadi: ikkita sananing o'zi nima bo'lganini
            izohlamaydi — xato tuzatildimi yoki muddat ataylab
            uzaytirildimi, faqat shu jumladan bilinadi. */}
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {t("batch.expiryReasonHint")}
        </div>
      </div>
    </Modal>
  );
}
