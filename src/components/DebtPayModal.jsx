import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { dateTime } from "../lib/ek-format";
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
 */
export default function DebtPayModal({ customer, ledger, onClose, onSubmit, paying, mode = "debt" }) {
  const savingsMode = mode === "savings";
  const balance = Number(savingsMode ? customer?.savingsBalance : customer?.balance) || 0;
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
  const pickedSum = openDebts.filter((l) => picked.has(l.id))
    .reduce((s, l) => s + (Number(l.remaining) || 0), 0);

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
  const extra = savingsMode ? 0 : Math.max(0, num - balance);
  const manualEmpty = !savingsMode && alloc === "MANUAL" && picked.size === 0;
  const canPay = num > 0 && !paying && !manualEmpty;

  const press = (k) => {
    if (k === "⌫") return setAmount((v) => String(v).slice(0, -1));
    setAmount((v) => (String(v) + k).replace(/^0+(?=\d)/, "").slice(0, 12));
  };

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={savingsMode ? t("savings.topUpTitle") : t("credit.payTitle")}
         onEscape={onClose}>
      <div className="pay-modal-box ek-dialog">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className={`fa-solid ${savingsMode ? "fa-sack-dollar" : "fa-hand-holding-dollar"}`}
               aria-hidden="true" />
            {savingsMode ? t("savings.topUpTitle") : t("credit.payTitle")} — {customer?.fullName}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="pay-modal-body">
          <div className="pay-modal-total">
            <div className="pay-modal-total-label">
              {savingsMode ? t("savings.balance") : t("credit.balance")}
            </div>
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
          {/* ⚠ `max` YO'Q (V63): qarzdan ortiq to'lov jamg'armaga
              tushadi, uni maydonda kesish o'sha imkoniyatni yopib
              qo'yardi. */}
          <NumField kind="money" autoFocus
                    className="form-input qty-modal__input ek-num"
                    value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />

          {/* ── QAYSI QARZLAR (V65) — faqat bittadan ko'p ochiq qarz
              bo'lsa: bitta qarzda tanlovning ma'nosi yo'q va ortiqcha
              tugma kassirni to'xtatardi. */}
          {!savingsMode && openDebts.length > 1 && (
            <>
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-list-check" aria-hidden="true" /> {t("credit.allocTitle")}
              </div>
              <div className="debt-quick">
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

          {/* ⚠ «Hammasi» — eng ko'p bosiladigan tugma: mijoz odatda
              qarzini to'liq yopadi va uni har safar qo'lda terish
              ortiqcha qadam edi. Jamg'arma rejimida ma'nosi yo'q. */}
          {!savingsMode && (
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

          <div className="qty-modal__keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="qty-modal__key" onClick={() => press(k)}>
                {k === "⌫" ? <i className="fa-solid fa-delete-left" aria-hidden="true" /> : k}
              </button>
            ))}
          </div>

          {/* ⚠ OGOHLANTIRISH EMAS, MA'LUMOT: ortig'i yo'qolmaydi, u
              mijozning hisobiga tushadi. Qizil rang «xato» deb
              o'qilardi. */}
          {extra > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--fg-success)", fontWeight: 700 }}>
              <i className="fa-solid fa-sack-dollar" aria-hidden="true" />{" "}
              {t("credit.overpayToSavings", { n: money(extra) })}
            </div>
          )}
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("common.close")}</button>
          <button className="btn btn-primary" disabled={!canPay}
                  onClick={() => onSubmit(savingsMode ? { amount: num, method }
                    : { amount: num, method, mode: alloc,
                        chargeIds: alloc === "MANUAL" ? [...picked] : null })}>
            {paying ? <Spinner small /> : <i className="fa-solid fa-check" aria-hidden="true" />}
            {savingsMode ? t("savings.topUp") : t("credit.pay")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
