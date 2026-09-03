import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { paymentEntry } from "../lib/ek-labels";
import { NumField } from "./ek/EkFields";
import { Spinner } from "./ek/Loading";
import Overlay from "./ek/Overlay";

/* ══════════════════════════════════════════════════════════════════════════
   QARZ TO'LOVI — KASSA OYNASI KO'RINISHIDA (V47)

   ⚠ NEGA KASSADAGIDEK. Ilgari bu oddiy shakl edi: kichik maydon va ikkita
   yorliq. Lekin bu AYNI O'SHA ish — kassir mijozdan pul oladi. Kassa
   oynasidagi katta summa, to'lov turi katakchalari va raqamli klaviatura
   sensorli monitorda barmoq bilan ishlash uchun; qarz to'lovida esa
   kassir sichqoncha qidirishga majbur edi.

   ⚠ Tugmalar KASSA bilan bir xil sinfda (`pay-*`): ikki joyda ikki xil
   ko'rinish bo'lsa, kassir har safar qayta o'rganardi.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ CLICK va PAYME ham bor: qarzni bugun ko'pincha o'tkazma bilan
   yopishadi va uni «karta» deb yozib qo'yish bank yarashtiruvida
   nomuvofiqlik berardi. */
const METHODS = ["CASH", "CARD", "CLICK", "PAYME"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"];

export default function DebtPayModal({ customer, onClose, onSubmit, paying }) {
  const balance = Number(customer?.balance) || 0;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");

  const num = Number(String(amount).replace(/\D/g, "")) || 0;
  /* ⚠ Qarzdan ORTIQ to'lov server tomonidan ham rad etiladi. Bu yerda
     tugma oldindan o'chiriladi: kassir mijoz oldida xato javob
     olmasligi kerak. */
  const tooMuch = num > balance;
  const canPay = num > 0 && !tooMuch && !paying;

  const press = (k) => {
    if (k === "⌫") return setAmount((v) => String(v).slice(0, -1));
    setAmount((v) => (String(v) + k).replace(/^0+(?=\d)/, "").slice(0, 12));
  };

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("credit.payTitle")}
         onEscape={onClose}>
      <div className="pay-modal-box ek-dialog">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true" />
            {t("credit.payTitle")} — {customer?.fullName}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="pay-modal-body">
          <div className="pay-modal-total">
            <div className="pay-modal-total-label">{t("credit.balance")}</div>
            <div className="pay-modal-total-value ek-num">{money(balance)}</div>
          </div>

          <div className="pay-modal-section-label">
            <i className="fa-solid fa-credit-card" aria-hidden="true" /> {t("credit.method")}
          </div>
          <div className="pay-modal-types">
            {METHODS.map((key) => {
              const p = paymentEntry(key);
              return (
                <button key={key} className={`pay-type-btn ${method === key ? "active" : ""}`}
                        onClick={() => setMethod(key)} aria-pressed={method === key}
                        style={{ "--pay-color": p.color }}>
                  <div className="pay-type-icon"><i className={`fa-solid ${p.icon || "fa-wallet"}`} aria-hidden="true" /></div>
                  <div className="pay-type-label">{p.label}</div>
                </button>
              );
            })}
          </div>

          <div className="pay-modal-section-label">
            <i className="fa-solid fa-money-bill-wave" aria-hidden="true" /> {t("credit.payAmount")}
          </div>
          <NumField kind="money" max={balance} autoFocus
                    className="form-input qty-modal__input ek-num"
                    value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />

          {/* ⚠ «Hammasi» — eng ko'p bosiladigan tugma: mijoz odatda
              qarzini to'liq yopadi va uni har safar qo'lda terish
              ortiqcha qadam edi. */}
          <div className="debt-quick">
            <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => setAmount(String(Math.round(balance)))}>
              {t("credit.payAll")} · {money(balance)}
            </button>
            <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => setAmount(String(Math.round(balance / 2)))}>
              {t("credit.payHalf")}
            </button>
          </div>

          <div className="qty-modal__keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="qty-modal__key" onClick={() => press(k)}>
                {k === "⌫" ? <i className="fa-solid fa-delete-left" aria-hidden="true" /> : k}
              </button>
            ))}
          </div>

          {tooMuch && (
            <div className="pay-mixed-warn" style={{ marginTop: 10 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
              {t("credit.overpay")}
            </div>
          )}
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("common.close")}</button>
          <button className="btn btn-primary" disabled={!canPay}
                  onClick={() => onSubmit({ amount: num, method })}>
            {paying ? <Spinner small /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {t("credit.pay")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
