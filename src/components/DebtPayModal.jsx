import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { dateTime } from "../lib/ek-format";
import { paymentEntry } from "../lib/ek-labels";
import { NumField } from "./ek/EkFields";
import { Spinner } from "./ek/Loading";
import Overlay from "./ek/Overlay";
import Select from "./ek/Select";

/* ══════════════════════════════════════════════════════════════════════════
   QARZ TO'LOVI — KASSA OYNASI KO'RINISHIDA (V47)

   ⚠ NEGA KASSADAGIDEK. Ilgari bu oddiy shakl edi: kichik maydon va ikkita
   yorliq. Lekin bu AYNI O'SHA ish — kassir mijozdan pul oladi. Kassa
   oynasidagi katta summa, to'lov turi katakchalari va raqamli klaviatura
   sensorli monitorda barmoq bilan ishlash uchun; qarz to'lovida esa
   kassir sichqoncha qidirishga majbur edi.

   ⚠ Tugmalar KASSA bilan bir xil sinfda (`pay-*`): ikki joyda ikki xil
   ko'rinish bo'lsa, kassir har safar qayta o'rganardi.

   ═══ O'Z TARTIBI — `pay-lite` (V66) ═══════════════════════════════════

   ⚠ Ilgari bu oyna to'lov oynasining `pay-modal-body` sinfini olardi,
   u esa UCH USTUNLI to'r. Bu oynaning bo'laklari o'sha uch ustunga
   sochilib ketardi: qoldiq kartasi chapda, «to'lov turi» yozuvi
   o'rtada osilib, summa maydoni boshqa ustunda, «to'lov summasi»
   yozuvi ostida esa hech narsa yo'q (do'kon egasi rasm bilan
   ko'rsatdi: «dizayni juda yomon»). Endi tartib o'ziniki: chapda
   mijoz, qoldiq, usul va summa — o'ngda raqamli klaviatura.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ CLICK va PAYME ham bor: qarzni bugun ko'pincha o'tkazma bilan
   yopishadi va uni «karta» deb yozib qo'yish bank yarashtiruvida
   nomuvofiqlik berardi. */
const METHODS = ["CASH", "CARD", "CLICK", "PAYME"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"];

/**
 * `mode`:
 *   `"debt"`    — qarz to'lovi (standart): ortig'i JAMG'ARMAGA tushadi;
 *   `"savings"` — jamg'armaga pul qo'yish (V64): savdoga aloqasi yo'q,
 *                 chegarasi yo'q, keshbeksiz.
 *
 * ⚠ BITTA OYNA, IKKI REJIM — ataylab. Ikkalasi ham «kassir mijozdan
 * pul oladi» degan bitta harakat va kassirning barmog'i bitta raqamli
 * klaviaturani biladi. Alohida oyna yozilsa, ular allaqachon
 * bir-biridan ajralib ketgan bo'lardi.
 *
 * MIJOZNI OYNANING O'ZIDA TANLASH (V66, faqat jamg'arma rejimi):
 *   `customers`        — ro'yxat berilsa tanlagich chiqadi;
 *   `onCustomerChange` — tanlov o'zgardi (ota `customer` ni yangilaydi);
 *   `onNewCustomer`    — «+» tugmasi: yangi mijoz oynasi (ota ochadi).
 *
 * ⚠ Do'kon egasi: «jamg'armaga pul qo'yishda mijozni shu oynaning
 * o'zida tanlasin». Ilgari tugma mijozsiz o'chiq turardi va kassir
 * avval to'lov oynasini ochib, mijozni tanlab, yopib, keyin
 * jamg'armaga qaytardi — uch ortiqcha qadam.
 */
export default function DebtPayModal({
  customer, ledger, onClose, onSubmit, paying, mode = "debt",
  customers = null, onCustomerChange, onNewCustomer,
}) {
  const savingsMode = mode === "savings";
  /* `"refund"` — jamg'armadan NAQD qaytarish (V66): o'sha oyna, usul
     tanlanadi, summa qoldiqdan oshmaydi. */
  const refundMode = mode === "refund";
  const savingsAcc = savingsMode || refundMode;
  const balance = Number(savingsAcc ? customer?.savingsBalance : customer?.balance) || 0;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");

  /* ── TAQSIMLASH (V65): avtomatik yoki alohida ──────────────────────
     Do'kon egasi: «bir vaqtda bir nechtasini yopmoqchi bo'lsa tanlov
     berilsin — avto tanlansa eng eskilaridan, alohidada mijoz tanlagan
     qarzlar so'ndiriladi».

     ⚠ OCHIQ qarzlar jurnaldan (`remaining > 0`), ENG ESKISIDAN. Ro'yxat
     faqat «alohida» rejimda ochiladi: avto rejimda kassir uni ko'rishi
     shart emas — tizim o'zi eng eskisidan yopadi. */
  const [alloc, setAlloc] = useState("AUTO");
  const [picked, setPicked] = useState(() => new Set());
  const openDebts = (ledger || [])
    .filter((l) => Number(l.remaining) > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  /* ⚠ Tanlov o'zgarganda SUMMA O'ZI TO'LADI: kassir uchta qarzni belgilab,
     keyin yig'indisini qo'lda terishi ortiqcha qadam — va xato manbai. */
  const togglePick = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      const sum = openDebts.filter((l) => next.has(l.id))
        .reduce((s, l) => s + (Number(l.remaining) || 0), 0);
      setAmount(sum > 0 ? String(Math.round(sum)) : "");
      return next;
    });
  };

  const num = Number(String(amount).replace(/\D/g, "")) || 0;
  /* ⚠ QARZDAN ORTIQ TO'LOV ENDI TO'SILMAYDI (V63): ortig'i mijozning
     jamg'armasiga tushadi. Ilgari bu yerda tugma o'chirilardi va
     kassir 470 000 lik qarzga 500 000 uzatgan mijozga qaytim qidirardi.
     Endi ortig'i KO'RSATILADI — kassir mijozga «50 mingingiz
     jamg'armangizda» deb aytib beradi. */
  const extra = savingsAcc ? 0 : Math.max(0, num - balance);
  const manualEmpty = !savingsAcc && alloc === "MANUAL" && picked.size === 0;
  /* Jamg'arma rejimida EGASIZ pul qo'yib bo'lmaydi. */
  const needCustomer = savingsMode && !customer;
  /* Qaytarish qoldiqdan oshmaydi — server ham rad etadi, lekin kassir
     buni tugmani bosgandan KEYIN emas, OLDIN ko'rsin. */
  const overRefund = refundMode && num > balance;
  const canPay = num > 0 && !paying && !manualEmpty && !needCustomer && !overRefund;

  const press = (k) => {
    if (k === "⌫") return setAmount((v) => String(v).slice(0, -1));
    setAmount((v) => (String(v) + k).replace(/^0+(?=\d)/, "").slice(0, 12));
  };

  const title = refundMode ? t("savings.refundTitle")
    : savingsMode ? t("savings.topUpTitle") : t("credit.payTitle");
  const showPicker = savingsMode && Array.isArray(customers);

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={title} onEscape={onClose}>
      <div className="pay-modal-box pay-modal-box--lite ek-dialog">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className={`fa-solid ${refundMode ? "fa-arrow-up" : savingsMode ? "fa-sack-dollar" : "fa-hand-holding-dollar"}`}
               aria-hidden="true" />
            {title}{customer?.fullName ? ` — ${customer.fullName}` : ""}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="pay-modal-body pay-lite">
          <div className="pay-lite__main">
            {/* ── MIJOZ (V66) — tanlagich oynaning o'zida ──────────── */}
            {showPicker && (
              <>
                <div className="pay-modal-section-label">
                  <i className="fa-solid fa-user" aria-hidden="true" /> {t("kassa.customer")}
                </div>
                <div className={`cart-cust cart-cust--bare ${needCustomer ? "is-needed" : ""}`}>
                  <div className="cart-cust__row">
                    <Select
                      block
                      ariaLabel={t("kassa.customer")}
                      placeholder={t("kassa.pickCustomer")}
                      searchable
                      searchPlaceholder={t("kassa.searchCustomer")}
                      value={customer?.id ? String(customer.id) : ""}
                      onChange={(v) => onCustomerChange?.(
                        customers.find((c) => String(c.id) === v) || null)}
                      options={customers.map((c) => ({
                        value: String(c.id),
                        label: c.fullName,
                        hint: c.phone,
                        icon: "fa-user",
                      }))}
                    />
                    {onNewCustomer && (
                      <button type="button" className="btn-icon cart-cust__btn"
                              title={t("kassa.newCustomer")} aria-label={t("kassa.newCustomer")}
                              onClick={onNewCustomer}>
                        <i className="fa-solid fa-user-plus" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {needCustomer && (
                    <div className="cart-cust__need" role="status">
                      <i className="fa-solid fa-arrow-turn-up fa-flip-horizontal" aria-hidden="true" />
                      {t("savings.pickHint")}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="pay-modal-total">
              <div className="pay-modal-total-label">
                {savingsAcc ? t("savings.balance") : t("credit.balance")}
              </div>
              <div className="pay-modal-total-value ek-num">
                {needCustomer ? "—" : money(balance)}
              </div>
            </div>

            <div className="pay-modal-section-label">
              <i className="fa-solid fa-credit-card" aria-hidden="true" /> {t("credit.method")}
            </div>
            <div className="pay-modal-types">
              {METHODS.map((key) => {
                const p = paymentEntry(key);
                return (
                  <button key={key} type="button"
                          className={`pay-type-btn ${method === key ? "active" : ""}`}
                          onClick={() => setMethod(key)} aria-pressed={method === key}
                          style={{ "--pay-color": p.color }}>
                    <span className="pay-type-icon"><i className={`fa-solid ${p.icon || "fa-wallet"}`} aria-hidden="true" /></span>
                    <span className="pay-type-label">{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pay-modal-section-label">
              <i className="fa-solid fa-money-bill-wave" aria-hidden="true" /> {t("credit.payAmount")}
            </div>
            {/* ⚠ `max` YO'Q (V63): qarzdan ortiq to'lov jamg'armaga
                tushadi, uni maydonda kesish o'sha imkoniyatni yopib
                qo'yardi. */}
            <NumField kind="money" autoFocus={!needCustomer}
                      max={refundMode ? balance : undefined}
                      className="form-input qty-modal__input ek-num"
                      value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            {refundMode && (
              <div className="pay-modal-hint">
                <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} aria-hidden="true" />
                {t("savings.max", { n: money(balance) })}
              </div>
            )}

            {/* ⚠ «Hammasi» — eng ko'p bosiladigan tugma: mijoz odatda
                qarzini to'liq yopadi va uni har safar qo'lda terish
                ortiqcha qadam edi. Jamg'arma rejimida ma'nosi yo'q. */}
            {!savingsAcc && (
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
            )}

            {/* ── QAYSI QARZLAR (V65) — faqat bittadan ko'p ochiq qarz
                bo'lsa: bitta qarzda tanlovning ma'nosi yo'q va ortiqcha
                tugma kassirni to'xtatardi. */}
            {!savingsAcc && openDebts.length > 1 && (
              <>
                <div className="pay-modal-section-label" style={{ marginTop: 12 }}>
                  <i className="fa-solid fa-list-check" aria-hidden="true" /> {t("credit.allocTitle")}
                </div>
                <div className="debt-quick" style={{ marginTop: 0 }}>
                  <button type="button"
                          className={`btn btn-sm ${alloc === "AUTO" ? "btn-primary" : "btn-outline"}`}
                          onClick={() => { setAlloc("AUTO"); setPicked(new Set()); }}>
                    {t("credit.allocAuto")}
                  </button>
                  <button type="button"
                          className={`btn btn-sm ${alloc === "MANUAL" ? "btn-primary" : "btn-outline"}`}
                          onClick={() => setAlloc("MANUAL")}>
                    {t("credit.allocManual")}
                  </button>
                </div>
                {alloc === "AUTO" && (
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t("credit.allocAutoHint")}
                  </div>
                )}
                {alloc === "MANUAL" && (
                  <div className="table-wrap" style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                    <table>
                      <tbody>
                        {openDebts.map((l) => (
                          <tr key={l.id} onClick={() => togglePick(l.id)} style={{ cursor: "pointer" }}>
                            <td style={{ width: 28 }}>
                              <input type="checkbox" checked={picked.has(l.id)} readOnly />
                            </td>
                            <td className="mono text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                              {dateTime(l.createdAt)}
                            </td>
                            <td className="mono" style={{ fontSize: 12 }}>
                              {l.saleId ? `#${l.saleId}` : (l.reason || `Q-${l.id}`)}
                            </td>
                            <td className="mono fw-700" style={{ textAlign: "right" }}>
                              {money(l.remaining)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {manualEmpty && (
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t("credit.allocPick")}
                  </div>
                )}
              </>
            )}

            {/* ⚠ OGOHLANTIRISH EMAS, MA'LUMOT: ortig'i yo'qolmaydi, u
                mijozning hisobiga tushadi. Qizil rang «xato» deb
                o'qilardi. */}
            {extra > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--fg-success)", fontWeight: 700 }}>
                <i className="fa-solid fa-sack-dollar" aria-hidden="true" />{" "}
                {t("credit.overpayToSavings", { n: money(extra) })}
              </div>
            )}
            {/* Jamg'arma — keshbek EMAS; kassir mijozga shuni aytadi. */}
            {savingsMode && (
              <div className="pay-modal-hint" style={{ marginTop: 10 }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} aria-hidden="true" />
                {t("savings.notCashback")}
              </div>
            )}
          </div>

          {/* ── RAQAMLI KLAVIATURA — o'z ustunida ───────────────────── */}
          <div className="pay-lite__keys">
            <div className="qty-modal__keys">
              {KEYS.map((k) => (
                <button key={k} type="button" className="qty-modal__key" onClick={() => press(k)}
                        aria-label={k === "⌫" ? t("common.delete") : undefined}>
                  {k === "⌫" ? <i className="fa-solid fa-delete-left" aria-hidden="true" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("common.close")}</button>
          <button className="btn btn-primary btn-pos" disabled={!canPay}
                  title={needCustomer ? t("savings.customerRequired") : undefined}
                  onClick={() => onSubmit(savingsAcc ? { amount: num, method, customer }
                    : { amount: num, method, mode: alloc,
                        chargeIds: alloc === "MANUAL" ? [...picked] : null })}>
            {paying ? <Spinner small /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {refundMode ? t("savings.refund") : savingsMode ? t("savings.topUp") : t("credit.pay")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
