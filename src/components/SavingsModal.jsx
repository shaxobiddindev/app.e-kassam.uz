import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { dateTime } from "../lib/ek-format";
import { paymentEntry } from "../lib/ek-labels";
import Modal from "./Modal";
import { Empty } from "./ui";
import { Spinner } from "./ek/Loading";
import DebtPayModal from "./DebtPayModal";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ JAMG'ARMASI — MIJOZLAR SAHIFASIDAGI OYNA (V63)

   ═══ ⚠ BU KESHBEK EMAS ═════════════════════════════════════════════════

   Ekranda ikkalasi yonma-yon turadi va chalkashish xavfi REAL, shuning
   uchun oynaning o'zi buni aytib turadi:

     · BALL — do'konning sovg'asi: kuyadi, naqdga chiqarilmaydi,
       marketing xarajati;
     · JAMG'ARMA — MIJOZNING PULI: do'konga haqiqatan berilgan, kuymaydi
       va so'ralganda qaytariladi. Do'kon uchun bu MAJBURIYAT.

   ═══ TO'LDIRISH — KASSADAGI OYNA ORQALI (V66) ═══════════════════════════

   ⚠ Ilgari bu yerda yalang'och summa maydoni turardi va to'ldirish
   DOIM «naqd» deb yozilardi — mijoz kartadan bergan bo'lsa ham. Do'kon
   egasi: «kassadagiday oyna ochilsin, shunchaki to'ldirmasin; qaysi
   to'lov usuli bilan qilingani ham saqlanishi kerak». Endi
   «Jamg'armaga qo'shish» va «Qaytarish» kassadagi o'sha oynani
   (`DebtPayModal`) ochadi: usul tanlanadi, raqamli klaviatura, so'ng
   kvitansiya. Bu oyna esa TARIX va HOLAT: qoldiq, har qator usuli
   bilan, har qatorning kvitansiyasi.

   ═══ RUXSAT ════════════════════════════════════════════════════════════

   TO'LDIRISH — kassirga ochiq: mijoz pulni aynan kassaga beradi.
   QAYTARISH — faqat rahbarga: bu kassadan pul CHIQISHI. Server ham shu
   qoidani qo'yadi (`SecurityConfig`) — bu yerdagi shart faqat tugmani
   yashiradi.
   ══════════════════════════════════════════════════════════════════════════ */

const ICON = {
  TOP_UP:  "fa-arrow-down",
  CHANGE:  "fa-arrow-rotate-left",
  OVERPAY: "fa-hand-holding-dollar",
  SPEND:   "fa-cart-shopping",
  REFUND:  "fa-arrow-up",
  RETURN:  "fa-rotate-left",
  ADJUST:  "fa-pen",
};

/** Mijoz ko'zi bilan: pul kirsa «+», chiqsa «−». */
const signed = (e) => {
  const v = Number(e.amount) || 0;
  if (e.type === "ADJUST") return v;
  return e.type === "SPEND" || e.type === "REFUND" ? -v : v;
};

export default function SavingsModal({ account, customer, canRefund, busy,
                                       onTopUp, onRefund, onReceipt, receiptLoading, onClose }) {
  /* Ochiq amal: `"savings"` — to'ldirish, `"refund"` — qaytarish. */
  const [action, setAction] = useState(null);
  const balance = Number(account?.balance) || 0;

  /* ⚠ Oyna faqat MUVAFFAQIYATDA yopiladi: xatoda kassir summani va
     usulni qayta termasin. Ota `true/false` qaytaradi. */
  const submit = async (p) => {
    const ok = await (action === "refund" ? onRefund : onTopUp)(p);
    if (ok) setAction(null);
  };

  return (
    <>
      <Modal
        title={`${t("savings.title")} — ${customer?.fullName || ""}`}
        onClose={onClose}
        maxWidth={760}
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
                      disabled={busy || balance <= 0}
                      onClick={() => setAction("refund")}>
                <i className="fa-solid fa-arrow-up" /> {t("savings.refund")}
              </button>
            )}
            <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => setAction("savings")}>
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
          <span className="mono fw-800" style={{ color: "var(--fg-success)", fontSize: 18 }}>
            {money(balance)}
          </span>
        </div>
        {/* Farqni EKRANNING O'ZI aytadi — izoh kodda qolib ketmasin. */}
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
          {t("savings.notCashback")}
        </div>

        <div className="form-label">{t("savings.history")}</div>
        <div className="table-wrap"
             style={{ maxHeight: "min(52vh, 520px)", minHeight: 180, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{t("common.type")}</th>
                <th>{t("common.date")}</th>
                {/* USUL (V66): mijoz kartadan bergan bo'lsa shu yerda ko'rinadi. */}
                <th>{t("credit.method")}</th>
                <th>{t("common.comment")}</th>
                <th style={{ textAlign: "right" }}>{t("bill.amount")}</th>
                <th style={{ textAlign: "right" }}>{t("savings.balance")}</th>
                <th />
              </tr>
            </thead>
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
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {e.method ? paymentEntry(e.method).label : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {/* Izoh VA xarid raqami — ikkalasi ham bo'lsa ikkalasi:
                        «qaysi xarid?» degan savolga javob shu. */}
                    {[e.reason, e.saleId ? `A-${e.saleId}` : null].filter(Boolean).join(" · ")}
                  </td>
                  <td className="mono fw-700" style={{
                    textAlign: "right", whiteSpace: "nowrap",
                    color: signed(e) >= 0 ? "var(--fg-success)" : "var(--fg-danger)",
                  }}>
                    {signed(e) >= 0 ? "+" : "−"}{money(Math.abs(signed(e)))}
                  </td>
                  {/* ⚠ O'SHA PAYTDAGI qoldiq — muzlatilgan qiymat.
                      Mijoz «o'sha kuni qancha qolgan edi» deb so'raydi
                      va javob keyingi harakatlardan o'zgarmasligi kerak. */}
                  <td className="mono text-muted" style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                    {e.balanceAfter == null ? "" : money(e.balanceAfter)}
                  </td>
                  {/* ⚠ HAR QATORNING KVITANSIYASI BOR (V66) — to'g'irlash
                      ham: jamg'arma mijozning puli va uning har tiyin
                      o'zgarishi hujjatli bo'lishi kerak. */}
                  <td style={{ width: 40, textAlign: "right" }}>
                    {onReceipt && (
                      <button type="button" className="btn-icon"
                              title={t("savings.receipt")} aria-label={t("savings.receipt")}
                              disabled={receiptLoading === e.id}
                              onClick={() => onReceipt(e.id)}>
                        {receiptLoading === e.id ? <Spinner small /> : <i className="fa-solid fa-receipt" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!(account?.history || []).length && (
                <tr><td colSpan={7}><Empty icon="fa-sack-dollar" text={t("savings.empty")} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Kassadagi o'sha oyna — usul, klaviatura, keyin kvitansiya. */}
      {action && (
        <DebtPayModal mode={action}
                      customer={{ ...customer, savingsBalance: balance }}
                      onClose={() => setAction(null)}
                      onSubmit={submit}
                      paying={busy} />
      )}
    </>
  );
}
