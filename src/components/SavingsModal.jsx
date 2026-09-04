import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { dateTime } from "../lib/ek-format";
import Modal from "./Modal";
import { Empty } from "./ui";
import { NumField } from "./ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ JAMG'ARMASI — KASSA OYNASI (V63)

   ═══ ⚠ BU KESHBEK EMAS ═════════════════════════════════════════════════

   Ekranda ikkalasi yonma-yon turadi va chalkashish xavfi REAL, shuning
   uchun oynaning o'zi buni aytib turadi:

     · BALL — do'konning sovg'asi: kuyadi, naqdga chiqarilmaydi,
       marketing xarajati;
     · JAMG'ARMA — MIJOZNING PULI: do'konga haqiqatan berilgan, kuymaydi
       va so'ralganda qaytariladi. Do'kon uchun bu MAJBURIYAT.

   Kassir bu farqni bilmasa, mijozga «ballaringiz bor» deb noto'g'ri
   gapiradi yoki jamg'armani «kuyib ketadi» deb qo'rqitadi.

   ═══ RUXSAT ════════════════════════════════════════════════════════════

   TO'LDIRISH — kassirga ochiq: mijoz pulni aynan kassaga beradi va uni
   rahbar kutishga majburlash imkoniyatni o'ldirardi. Bu pul KIRISHI.

   QAYTARISH — faqat rahbarga: bu kassadan pul CHIQISHI va kassir
   istalgan mijozning jamg'armasini o'z cho'ntagiga aylantira olardi.
   Server ham shu qoidani qo'yadi (`SecurityConfig`) — bu yerdagi
   shart faqat tugmani yashiradi.
   ══════════════════════════════════════════════════════════════════════════ */

const ICON = {
  TOP_UP:  "fa-arrow-down",
  CHANGE:  "fa-arrow-rotate-left",
  OVERPAY: "fa-hand-holding-dollar",
  SPEND:   "fa-cart-shopping",
  REFUND:  "fa-arrow-up",
  ADJUST:  "fa-pen",
};

/** Mijoz ko'zi bilan: pul kirsa «+», chiqsa «−». */
const signed = (e) => {
  const v = Number(e.amount) || 0;
  if (e.type === "ADJUST") return v;
  return e.type === "SPEND" || e.type === "REFUND" ? -v : v;
};

export default function SavingsModal({ account, customer, canRefund, busy,
                                       onTopUp, onRefund, onClose }) {
  const [amount, setAmount] = useState("");
  const balance = Number(account?.balance) || 0;
  const entered = Math.max(0, Math.round(Number(amount) || 0));

  return (
    <Modal
      title={`${t("savings.title")} — ${customer?.fullName || ""}`}
      onClose={onClose}
      maxWidth={720}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
          {/* ⚠ QAYTARISH CHAPDA va OUTLINE: u kamdan-kam kerak
              bo'ladigan, orqaga qaytarib bo'lmaydigan amal —
              to'ldirish tugmasi bilan bir xil ko'rinsa, kassir
              ikkalasini adashtirardi. */}
          {canRefund && (
            <button className="btn btn-outline btn-sm"
                    disabled={busy || entered <= 0 || entered > balance}
                    onClick={() => onRefund(entered)}>
              <i className="fa-solid fa-arrow-up" /> {t("savings.refund")}
            </button>
          )}
          <button className="btn btn-primary btn-sm"
                  disabled={busy || entered <= 0}
                  onClick={() => onTopUp(entered)}>
            <i className="fa-solid fa-sack-dollar" /> {t("savings.topUp")}
          </button>
        </>
      }
    >
      <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="fw-700">{t("savings.balance")}</span>
        {/* ⚠ YASHIL: bu mijozning puli va u yaxshi xabar. Qarz qizil
            bo'lgani uchun jamg'armani ham qizil qilish ikkalasini
            bir xil «muammo» qilib ko'rsatardi. */}
        <span className="mono fw-800" style={{ color: "var(--fg-success)" }}>
          {money(balance)}
        </span>
      </div>
      {/* Farqni EKRANNING O'ZI aytadi — izoh kodda qolib ketmasin. */}
      <div className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {t("savings.notCashback")}
      </div>

      <label className="form-label" htmlFor="savings-amount">{t("bill.amount")}</label>
      <NumField kind="money" id="savings-amount" className="form-input mono"
                value={amount} autoFocus
                onChange={(e) => setAmount(e.target.value)} />

      <div className="form-label" style={{ marginTop: 14 }}>{t("savings.history")}</div>
      <div className="table-wrap"
           style={{ maxHeight: "min(42vh, 420px)", minHeight: 180, overflowY: "auto" }}>
        <table>
          <tbody>
            {(account?.history || []).map((e) => (
              <tr key={e.id}>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  <i className={`fa-solid ${ICON[e.type] || "fa-circle"}`} aria-hidden="true" />{" "}
                  {t(`savings.type.${e.type}`)}
                </td>
                <td className="mono text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {dateTime(e.createdAt)}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{e.reason || "—"}</td>
                <td className="mono fw-700" style={{
                  color: signed(e) >= 0 ? "var(--fg-success)" : "var(--fg-danger)",
                }}>
                  {signed(e) >= 0 ? "+" : "−"}{money(Math.abs(signed(e)))}
                </td>
                {/* ⚠ O'SHA PAYTDAGI qoldiq — muzlatilgan qiymat.
                    Mijoz «o'sha kuni qancha qolgan edi» deb so'raydi
                    va javob keyingi harakatlardan o'zgarmasligi kerak. */}
                <td className="mono text-muted" style={{ fontSize: 12 }}>
                  {e.balanceAfter == null ? "" : money(e.balanceAfter)}
                </td>
              </tr>
            ))}
            {!(account?.history || []).length && (
              <tr><td colSpan={5}><Empty icon="fa-sack-dollar" text={t("savings.empty")} /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
