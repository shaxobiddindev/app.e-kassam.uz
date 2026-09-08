/* ══════════════════════════════════════════════════════════════════════════
   O'Z PIN INI QO'YISH (V99)

   ⚠ FAQAT O'ZINIKI. Rahbar boshqa xodimga PIN qo'yib bera olsa, o'sha
   xodim nomidan sotuv qilish yo'li ochilardi — cheklarda esa xodimning
   ismi turardi. Serverda ham shu qoida (`StaffPinService.set`); rahbar
   qila oladigan yagona narsa — unutilgan PIN ni O'CHIRISH.

   ⚠ IKKI MARTA SO'RALADI. Bir marta terilgan PIN da xato ketsa, xodim
   uni faqat KEYINGI SMENADA — kassada, mijoz oldida — bilib qolardi,
   va o'sha payt tuzatishning yo'li yo'q edi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Modal } from "../components";
import PinPad from "./ek/PinPad";
import { authApi } from "../api";
import { t } from "../lib/ek-i18n";

function storedLength() {
  const n = Number(localStorage.getItem("ek_pinLength"));
  return n === 6 ? 6 : 4;
}

export default function PinSetModal({ onClose, onSaved, toast }) {
  const length = storedLength();
  const [first, setFirst] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stage2 = first.length === length;
  const value = stage2 ? again : first;

  const save = async (pin) => {
    setBusy(true);
    setError("");
    try {
      const res = await authApi.pinSet(pin);
      toast?.success(res?.message || t("pin.saved"));
      onSaved?.();
      onClose();
    } catch (err) {
      /* ⚠ IKKALA MAYDON HAM TOZALANADI. Server PIN ni rad etsa
         (juda oson, uzunlik noto'g'ri), yarim terilgan ikkinchi
         qadamda qolish xodimni chalkashtirardi: u qaysi biri
         noto'g'ri ekanini bilmasdi. */
      setFirst("");
      setAgain("");
      setError(err?.message || t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const onChange = (v) => {
    setError("");
    if (!stage2) { setFirst(v); return; }
    setAgain(v);
    if (v.length === length) {
      if (v !== first) {
        /* Mos kelmadi — BOSHIDAN. Faqat ikkinchisini tozalash xodimga
           birinchisi to'g'ri degan ishonch berardi, holbuki xato
           o'shanda ham bo'lishi mumkin. */
        setFirst("");
        setAgain("");
        setError(t("pin.mismatch"));
        return;
      }
      save(v);
    }
  };

  return (
    <Modal title={t("pin.setTitle")} onClose={onClose} maxWidth={340}
           footer={
             <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
               {t("common.cancel")}
             </button>
           }>
      <p className="ek-muted pin-hint">
        {stage2 ? t("pin.repeat") : t("pin.myPinHint")}
      </p>

      {error && <div className="ek-note ek-note--warn pin-error">{error}</div>}

      <PinPad length={length} value={value} disabled={busy} onChange={onChange} />
    </Modal>
  );
}
