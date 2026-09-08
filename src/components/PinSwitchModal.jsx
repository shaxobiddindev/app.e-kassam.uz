/* ══════════════════════════════════════════════════════════════════════════
   KASSIR PIN BILAN ALMASHADI (V99)

   ═══ NEGA BU OYNA `app` ICHIDA ════════════════════════════════════════

   Do'kon egasi: «PIN moduli `app` ga o'tkazilsin, chunki `auth` alohida
   serverda turadi va yuklash vaqti tizimni sekinlashtiradi».

   ⚠ NARX SEKINLIKDAN KATTAROQ. `auth` — BOSHQA origin va boshqa server:
   chiqish → DNS + TLS → auth SPA yuklanadi → kirish → app ga qaytish →
   app qaytadan yuklanadi. Ya'ni savat, ochiq smena, skaner tinglovchisi
   va tarozi ulanishi — hammasi UZILADI. Bu mijoz kassada turganda
   bo'ladi.

   Bu oyna sahifani QAYTA YUKLAMAYDI: `useAuth().login()` yangi tokenni
   yozadi va React holatni yangilaydi, xolos.

   ═══ UCHTA QAROR ══════════════════════════════════════════════════════

   1. FOYDALANUVCHI NOMI SO'RALMAYDI, faqat PIN. Kassir almashinuvi
      mijoz oldida bo'ladi; ikkita maydon to'ldirish uni
      sekinlashtiradi. Xavfsizlik bundan zaiflashmaydi — server PIN ni
      faqat OCHIQ SMENADAGI xodimlar orasidan qidiradi va qurilma
      allaqachon do'kon tokeniga ega.

   2. SAVAT BO'SH BO'LMASA ALMASHISH YO'Q. To'lanmagan savat boshqa
      kassirning ismi bilan yopilsa, chekda va hisobotda noto'g'ri odam
      turardi. ⚠ Bu qoida FAQAT EKRANDA bajariladi — savat brauzer
      xotirasida va server uni ko'rmaydi. Shuning uchun u xavfsizlik
      emas, CHALKASHLIKNING oldini olish.

   3. TO'LGACH O'ZI YUBORILADI. «Tasdiqlash» tugmasi bitta ortiqcha
      bosish bo'lardi — PIN uzunligi allaqachon ma'lum.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../components";
import PinPad from "./ek/PinPad";
import { authApi } from "../api";
import { t } from "../lib/ek-i18n";

/** Do'kon tanlagan uzunlik. Profil bilan birga eslab qolinadi. */
function storedLength() {
  const n = Number(localStorage.getItem("ek_pinLength"));
  return n === 6 ? 6 : 4;
}

export default function PinSwitchModal({ onClose, onSwitched, toast }) {
  const length = storedLength();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /* ⚠ So'rov ketayotganda ikkinchi marta yuborilmasin: to'lgan PIN
     `useEffect` bilan yuboriladi va holat yangilanishi uni takrorlashi
     mumkin edi. */
  const sending = useRef(false);

  const submit = useCallback(async (value) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await authApi.pinSwitch(value);
      onSwitched(res?.data || {});
      toast?.success(res?.message || t("pin.switched"));
      onClose();
    } catch (err) {
      /* ⚠ XATODAN KEYIN MAYDON TOZALANADI. Qolgan raqamlar ustiga
         terish yarim-yorti qiymat yasar va kassir «yana noto'g'ri»
         degan xabarni sababsiz olardi — qulf esa har urinishda
         yaqinlashardi. */
      setPin("");
      setError(err?.message || t("pin.invalid"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, [onClose, onSwitched, toast]);

  useEffect(() => {
    if (pin.length === length) submit(pin);
  }, [pin, length, submit]);

  return (
    <Modal title={t("pin.switchTitle")} onClose={onClose} maxWidth={340}
           footer={
             <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
               {t("common.cancel")}
             </button>
           }>
      <p className="ek-muted pin-hint">{t("pin.switchHint")}</p>

      {error && <div className="ek-note ek-note--warn pin-error">{error}</div>}

      <PinPad length={length} value={pin} disabled={busy}
              onChange={(v) => { setError(""); setPin(v); }} />
    </Modal>
  );
}
