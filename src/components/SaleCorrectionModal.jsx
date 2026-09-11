import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { saleApi } from "../api";
import { money } from "../utils";
import { Modal } from "./index";
import { Field } from "./ui";
import Select from "./ek/Select";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   TUZATUVCHI CHEK (V86)

   ═══ KASSIR UCHTA AMALNI ADASHTIRMASLIGI KERAK ═══════════════════════════

     Mijoz tovarni olib qaytdimi?        → QAYTARISH
     Chek xato, mijoz hali ketmaganmi?   → BEKOR QILISH
     Soliqqa noto'g'ri summa ketganmi?   → TUZATISH (shu oyna)

   Shuning uchun oynaning boshida shu farq YOZIB QO'YILGAN. Uchalasi
   ham pulga tegadi va nomlari o'xshash — tushuntirishsiz kassir
   birinchisini tanlab, tovarni ikkinchi marta javonga qaytarardi.

   ═══ ⚠ ISHORA — ENG NOZIK JOY ════════════════════════════════════════════

   Summani MANFIY yozish kerak bo'lsa, uni oddiy matn maydonida so'rash
   xatoga ochiq: kassir minusni unutadi va tuzatish teskari tomonga
   ketadi — soliqqa ko'p yuborilgan summa yana ko'payadi.

   Shuning uchun bu yerda MINUS YOZILMAYDI: yo'nalish ikkita tugma
   bilan tanlanadi va ekranda natija so'z bilan ham, raqam bilan ham
   ko'rsatiladi. Kassir «−5 000» ni emas, «5 000 kamaytirish» ni
   tanlaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Yo'nalish: soliqqa ko'p ketganmi yoki kam. */
const LESS = "LESS";
const MORE = "MORE";

export default function SaleCorrectionModal({ sale, toast, onClose, onDone }) {
  const [dir, setDir] = useState(LESS);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState("CASH");
  const [saving, setSaving] = useState(false);

  const raw = Number(String(amount).replace(/\s/g, "")) || 0;
  /* ⚠ Ishora SHU YERDA, bitta joyda qo'llanadi. Ikki joyda
     hisoblansa (ekranda va yuborishda), ular bir-biridan ajralib
     ketishi mumkin edi — va ekranda to'g'ri, serverga esa teskari
     raqam ketardi. */
  const signed = dir === LESS ? -raw : raw;
  const ready = raw > 0 && reason.trim().length > 0;

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      await saleApi.correct({
        amount: signed,
        reason: reason.trim(),
        parentSaleId: sale?.id ?? null,
        paymentType: payment,
      });
      onDone?.();
    } catch (err) {
      /* ⚠ OYNA YOPILMAYDI. Xato toast'da chiqadi, yozilgan summa va
         sabab esa joyida qoladi: kassirni hammasini qaytadan
         terishga majbur qilish eng oson yo'qotiladigan ishonch. */
      toast?.error(err?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t("corr.title")}
      onClose={onClose}
      maxWidth={520}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-danger" onClick={submit} disabled={!ready || saving}>
            {saving ? <Spinner small /> : <i className="fa-solid fa-file-pen" aria-hidden="true" />}
            {t("corr.issue")}
          </button>
        </>
      }
    >
      {/* ⚠ FARQ BIRINCHI O'RINDA — pastda emas. Kassir oynani ochib
          darrov summa yozishga tushadi va pastdagi izohni o'qimaydi. */}
      <div className="form-hint" style={{ marginBottom: 12 }}>
        {t("corr.whatIsIt")}
      </div>

      {sale && (
        <div className="form-hint" style={{ marginBottom: 12 }}>
          {t("corr.forReceipt")}: <b>#{sale.id}</b> · {money(sale.totalAmount)}
        </div>
      )}

      <label className="form-label">{t("corr.direction")}</label>
      <div className="btn-group" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {/* ⚠ MATNI «minus»/«plus» EMAS, MA'NOSI bilan: kassir
            arifmetikani emas, nima bo'lganini tanlaydi. */}
        <button
          className={`btn ${dir === LESS ? "btn-danger" : "btn-outline"}`}
          style={{ flex: 1 }}
          onClick={() => setDir(LESS)}
        >
          {t("corr.dirLess")}
        </button>
        <button
          className={`btn ${dir === MORE ? "btn-green" : "btn-outline"}`}
          style={{ flex: 1 }}
          onClick={() => setDir(MORE)}
        >
          {t("corr.dirMore")}
        </button>
      </div>

      <label className="form-label">{t("corr.amount")}</label>
      <Field
        kind="money"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onClear={() => setAmount("")}
        placeholder="0"
        autoFocus
      />

      {/* ⚠ NATIJA ISHORASI BILAN QAYTA KO'RSATILADI. Kassir
          yuborishdan oldin «tizim meni to'g'ri tushundimi?» degan
          savolga javob olishi kerak — bu yerdagi yagona qaytarilmas
          amal. */}
      {raw > 0 && (
        <div className="form-hint"
             style={{ marginTop: 6, fontWeight: 800, fontSize: 15,
                      color: dir === LESS ? "var(--fg-danger)" : "var(--fg-success)" }}>
          {dir === LESS ? "−" : "+"}{money(raw)}
        </div>
      )}

      <label className="form-label" style={{ marginTop: 12 }}>{t("corr.payment")}</label>
      <Select
        value={payment}
        onChange={setPayment}
        block
        variant="field"
        ariaLabel={t("corr.payment")}
        options={[
          { value: "CASH",  label: t("enum.payment.CASH") },
          { value: "CARD",  label: t("enum.payment.CARD") },
          { value: "CLICK", label: t("enum.payment.CLICK") },
          { value: "PAYME", label: t("enum.payment.PAYME") },
        ]}
      />
      {/* ⚠ NAQD TANLANSA SMENA HISOBI O'ZGARADI va buni kassir
          bilishi kerak: «naqd −5 000» degan tuzatish «yashikda
          5 000 kam bo'lishi kerak edi» degani. */}
      <div className="form-hint" style={{ marginTop: 4 }}>{t("corr.paymentHint")}</div>

      <label className="form-label" style={{ marginTop: 12 }}>{t("corr.reason")}</label>
      <Field
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onClear={() => setReason("")}
        maxLength={255}
        placeholder={t("corr.reasonPlaceholder")}
      />
      <div className="form-hint" style={{ marginTop: 4 }}>{t("corr.reasonHint")}</div>

    </Modal>
  );
}
