import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { dateTime } from "../lib/ek-format";
import MixedPay from "./ek/MixedPay";
import { enteredTotal, enteredParts } from "../lib/ek-payment";
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
  /* ══ ARALASH TO'LOV (V96) ═══════════════════════════════════════════
     Do'kon egasi: «butun tizimda to'lov qilinadigan hamma oynada
     kassadagiday aralash to'lov tizimi bo'lishi kerak».

     ⚠ BITTA SUMMA O'RNIGA XARITA. Ilgari `amount` + `method` edi va
     500 000 lik qarzning 300 000 ini kartadan, qolganini naqd to'lash
     imkonsiz edi: kassir ikkita alohida to'lov yasar, jurnalda bitta
     harakat ikkiga bo'linib ketardi. */
  const [entered, setEntered] = useState({});
  const [focus, setFocus] = useState("CASH");

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
      /* ⚠ QOLGANLARI TOZALANADI, ustiga qo'shilmaydi (V96). Tanlangan
         qarzlar yig'indisi — TO'LANADIGAN SUMMANING O'ZI; kassir
         kartaga 300 000 yozib qo'ygan bo'lsa, uning ustiga yana
         500 000 qo'shilsa jami 800 000 bo'lib, u aytmagan pul
         chiqardi. */
      setEntered(sum > 0 ? { [focus]: String(Math.round(sum)) } : {});
      return next;
    });
  };

  /* To'lov summasi — kiritilganlarning YIG'INDISI (V96). Bu yerda
     belgilangan chek summasi yo'q, shuning uchun `settle` emas. */
  const num = enteredTotal(entered);
  /* Serverga ketadigan ro'yxat; bitta usulda ham yuboriladi — server
     uni o'zi yakka usulga aylantiradi. */
  const parts = enteredParts(entered);
  /* Eski maydon HAM yuboriladi: server yangilanmagan bo'lsa (yoki
     oflayn navbatdagi so'rov eski serverga tushsa) to'lov baribir
     o'tishi kerak. Yangi server ro'yxatni afzal ko'radi. */
  const method = parts.length === 1 ? parts[0].type : "MIXED";
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

            {/* ══ ARALASH TO'LOV (V96) — kassadagi bilan bir xil ══════
                Usul tugmasi TO'LOV TURINI emas, tahrirlanadigan usulni
                tanlaydi; bosilganda kursor summa maydoniga o'tadi.

                ⚠ `cap` FAQAT QAYTARISHDA. Qarz to'lash va jamg'arma
                to'ldirishda chegara YO'Q va bu ataylab (V63):
                qarzdan ortiq to'langan pul mijozning jamg'armasiga
                tushadi va maydonni kesish o'sha imkoniyatni yopib
                qo'yardi. Qaytarishda esa qoldiqdan ortig'ini berib
                bo'lmaydi.

                ⚠ Chegara JAMIGA qo'yiladi, bitta maydonga emas:
                «naqd 100 000 + karta 100 000» ni har maydonni alohida
                tekshirib o'tkazib yuborardi (`enteredMax`). */}
            <MixedPay methods={METHODS}
                      entered={entered} onChange={setEntered}
                      focus={focus} onFocus={setFocus}
                      cap={refundMode ? balance : null}
                      inputId="debt-amount"
                      autoFocus={!needCustomer}
                      disabled={paying} />
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
                {/* ⚠ TUGMA HAMMA MAYDONNI ALMASHTIRADI, fokusdagisiga
                    QO'SHMAYDI (V96). «Hammasi» — to'lanadigan
                    SUMMANING O'ZI; kassir kartaga 300 000 yozib
                    qo'ygan bo'lsa, uning ustiga yana butun qarz
                    qo'shilsa mijoz aytmagan pul chiqardi. Tanlangan
                    qarzlar tugmasidagi bilan bir xil qoida. */}
                <button type="button" className="btn btn-outline btn-sm"
                        onClick={() => setEntered({ [focus]: String(Math.round(balance)) })}>
                  {t("credit.payAll")} · {money(balance)}
                </button>
                <button type="button" className="btn btn-outline btn-sm"
                        onClick={() => setEntered({ [focus]: String(Math.round(balance / 2)) })}>
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

        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("common.close")}</button>
          <button className="btn btn-primary btn-pos" disabled={!canPay}
                  title={needCustomer ? t("savings.customerRequired") : undefined}
                  onClick={() => onSubmit(savingsAcc
                    ? { amount: num, method, payments: parts, customer }
                    : { amount: num, method, payments: parts, mode: alloc,
                        chargeIds: alloc === "MANUAL" ? [...picked] : null })}>
            {paying ? <Spinner small /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {refundMode ? t("savings.refund") : savingsMode ? t("savings.topUp") : t("credit.pay")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
