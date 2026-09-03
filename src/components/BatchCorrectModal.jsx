import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { Modal } from ".";
import Select from "./ek/Select";
import { NumField } from "./ek/EkFields";
import { Spinner } from "./ek/Loading";
import { inventoryApi } from "../api";
import { useBadge } from "../context/BadgeProvider";
import { shortDate } from "../lib/ek-format";
import { quantity as fmtQty } from "../utils";
import { unitLabel, unitDecimals } from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   PARTIYA QOLDIG'INI TO'G'IRLASH — UMUMIY OYNA (V60)

   ⚠ NEGA AJRATILDI. Bu oyna ilgari `InventoryPage` ning ichida edi va
   partiyalar alohida SAHIFAGA chiqarilganda ikkinchi nusxasi kerak
   bo'lib qoldi. Ikki nusxa esa vaqt o'tishi bilan bir-biridan uzoqlashadi:
   biriga yangi turkum qo'shiladi, ikkinchisiga qo'shilmaydi va nima
   uchun ikki ekranda ikki xil ro'yxat chiqayotganini hech kim
   tushunmaydi.

   ⚠ CHIQIT TURKUMI faqat qoldiq KAMAYGANDA so'raladi. Sabab erkin matn
   bo'lganda «sindi», «sinib qoldi», «tushib ketdi» bitta hodisani uch xil
   nomlardi va «shu oy sinishga qancha ketdi» degan savolga javob yo'q
   edi. Server ham buni majburiy deb tekshiradi — bu yerdagisi qulaylik
   uchun: xatoni yuborishdan OLDIN ko'rsatgan yaxshi.
   ══════════════════════════════════════════════════════════════════════════ */

/* Ro'yxat serverdagi `WriteOffReason` bilan bir xil tartibda. */
const WRITE_OFF_REASONS = [
  { value: "BREAKAGE",        icon: "fa-hammer" },
  { value: "SPOILAGE",        icon: "fa-triangle-exclamation" },
  { value: "EXPIRY",          icon: "fa-hourglass-end" },
  { value: "THEFT",           icon: "fa-user-secret" },
  { value: "SUPPLIER_RETURN", icon: "fa-truck-arrow-right" },
  { value: "OWN_USE",         icon: "fa-store" },
  { value: "RECOUNT",         icon: "fa-calculator" },
  { value: "OTHER",           icon: "fa-ellipsis" },
];

/**
 * @param batch    to'g'irlanadigan partiya
 * @param onClose  oyna yopilganda
 * @param onSaved  saqlangandan keyin (ro'yxatni yangilash)
 */
export default function BatchCorrectModal({ batch, onClose, onSaved, toast }) {
  /* ⚠ BAJIK QOROVULI KOMPONENTNING O'ZIDA, propda EMAS. Ilgari u
     ixtiyoriy prop edi va berilmasa chaqiruv qorovulsiz o'tib ketardi —
     ya'ni qoldiqni rahbar tasdig'isiz o'zgartirish mumkin bo'lardi.
     `test/badge-guard.test.mjs` aynan shuni tutdi. Endi uni unutib
     bo'lmaydi: komponent o'zi oladi. */
  const { guard } = useBadge();
  const [qty, setQty] = useState(String(batch.quantity ?? ""));
  const [reason, setReason] = useState("");
  const [woReason, setWoReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isDecrease = qty !== "" && Number(qty) < Number(batch.quantity ?? 0);

  const submit = async () => {
    if (qty === "" || !reason.trim()) return;
    if (isDecrease && !woReason) {
      toast?.error(t("inv.needWriteOffReason"));
      return;
    }
    setSaving(true);
    try {
      await guard(() => inventoryApi.correctBatch(
        batch.inventoryId, Number(qty), reason.trim(), isDecrease ? woReason : null));
      toast?.success(t("inv.correctTitle"));
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
      title={`${t("inv.correctTitle")} — ${batch.productName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={submit}
                  disabled={saving || qty === "" || !reason.trim() || (isDecrease && !woReason)}>
            {saving ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {" "}{saving ? t("common.saving") : t("inv.correctAction")}
          </button>
        </>
      }
    >
      <div className="batch-correct__now">
        <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {t("inv.currentQty")}
          {batch.expiryDate ? ` · ${shortDate(batch.expiryDate)}` : ` · ${t("inv.noExpiry")}`}
        </span>
        <span className="mono fw-800" style={{ fontSize: 16 }}>
          {fmtQty(batch.quantity, unitDecimals(batch.unit))} {unitLabel(batch.unit)}
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">{`${t("inv.correctQty")} *`}</label>
        <NumField kind="qty" unit={batch.unit} className="form-input ek-num"
                  value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("inv.correctHint")}</div>
      </div>

      {isDecrease && (
        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">{`${t("inv.writeOffReason")} *`}</label>
          <Select value={woReason} onChange={setWoReason} block variant="field"
                  invalid={!woReason} placeholder={t("inv.writeOffReasonPh")}
                  ariaLabel={t("inv.writeOffReason")}
                  options={WRITE_OFF_REASONS.map((r) => ({
                    value: r.value, icon: r.icon, label: t(`enum.writeOff.${r.value}`),
                  }))} />
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t("inv.writeOffHint")}</div>
        </div>
      )}

      <div className="form-group" style={{ marginTop: 14 }}>
        <label className="form-label">{`${t("inv.reason")} *`}</label>
        <input className="form-input" type="text" maxLength={500}
               value={reason} onChange={(e) => setReason(e.target.value)}
               placeholder={t("inv.correctReasonPh")}
               onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
    </Modal>
  );
}
