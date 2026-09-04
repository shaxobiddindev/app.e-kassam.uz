import Modal from "./Modal";
import { Badge } from "./ui";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { saleStatus, paymentEntry } from "../lib/ek-labels";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   CHEK TAFSILOTI — BITTA joyda (V47)

   ⚠ NEGA AJRATILDI. Bu oyna ilgari faqat «Sotuvlar tarixi» ichida edi.
   Endi u qarz jurnalidan ham ochiladi: do'kon egasi «bu 76 970 so'm
   qayerdan chiqdi?» degan savolga qarzdorlar oynasidan chiqmasdan javob
   oladi. Ikki joyda ikki xil ko'rinish bo'lsa, ular vaqt o'tib bir-biridan
   ajralib ketardi.
   ══════════════════════════════════════════════════════════════════════════ */

const TONE_COLOR = { success: "green", danger: "red", warning: "yellow", info: "blue", neutral: "gray" };

function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

export default function SaleDetailModal({ sale, onClose, onReprint, printing = false }) {
  if (!sale) return null;
  const st = saleStatus(sale.status);
  /* ⚠ CHEGIRMA USTUNI FAQAT KERAK BO'LGANDA (V48). Server chek
     chegirmasini, sodiqlik chegirmasini va ballni QATORLARGA taqsimlab
     saqlaydi — «umumiy summadan 50 ming tushdi, qaysi tovarga qanchadan
     tushdi?» degan savolning javobi shu yerda. Chegirmasiz chekda esa
     bo'sh ustun jadvalni bekorga toraytirardi. */
  const hasDiscount = (sale.items || []).some((i) => Number(i.discountAmount) > 0);

  return (
    <Modal
      title={`${t("sales.one")} #${sale.id}`}
      onClose={onClose}
      footer={
        <>
          {onReprint && sale.status !== "CANCELLED" && (
            <button className="btn btn-primary btn-sm" onClick={() => onReprint(sale)} disabled={printing}>
              {printing ? <Spinner small /> : <i className="fa-solid fa-print" />}
              {t("kassa.reprint")}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.close")}</button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: t("sales.colCashier"), value: sale.cashierName || "—" },
          { label: t("cust.col"),         value: sale.customerName || "—" },
          { label: t("sales.colPayment"), value: <PayLabel type={sale.paymentType} /> },
          { label: t("common.status"),    value: <Badge color={TONE_COLOR[st.tone] || "blue"}>{st.label}</Badge> },
          { label: t("common.date"),      value: sale.createdAt ? new Date(sale.createdAt).toLocaleString("uz-UZ") : "—" },
          { label: t("common.total"),     value: <span className="mono fw-700 text-blue">{money(sale.totalAmount)}</span> },
        ].map((item, i) => (
          <div key={i} style={{ background: "var(--bg)", borderRadius: 8, padding: "9px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
        {t("kassa.products")} ({sale.items?.length || 0})
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("products.col")}</th>
              <th>{t("common.count")}</th>
              <th>{t("sales.colPrice")}</th>
              {hasDiscount && <th>{t("kassa.discount")}</th>}
              <th>{t("common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items || []).map((item, i) => {
              const disc = Number(item.discountAmount) || 0;
              /* «Jami» — mijoz SHU qator uchun to'lagan summa: chegirma
                 ayrilgandan keyingisi. Ilgari bu yerda chegirmadan
                 OLDINGI summa turardi va qatorlar yig'indisi chekning
                 jamisiga to'g'ri kelmasdi. */
              const net = Math.max(0, (Number(item.subtotal) || 0) - disc);
              return (
                <tr key={i}>
                  <td className="fw-700">{item.productName}</td>
                  <td><Badge color="blue">{item.quantity}</Badge></td>
                  <td className="mono">{money(item.price)}</td>
                  {hasDiscount && (
                    <td className="mono" style={{ color: disc > 0 ? "var(--red)" : "var(--text3)" }}>
                      {disc > 0 ? `−${money(disc)}` : "—"}
                    </td>
                  )}
                  <td className="mono fw-700 text-blue">{money(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ TO'LOV QISMLARI (V66) ══════════════════════════════════════
          Do'kon egasi: «jamg'armadan to'lov sotuv tarixida boshqa usul
          kabi ko'rinsin». «Aralash» degan bitta so'z hech narsa
          aytmaydi — aynan qaysi usuldan qancha, shu yerda. Ball esa
          to'lov usuli EMAS: u umumiy summadan ayrilgan chegirma va
          alohida qatorda «−» bilan turadi. */}
      {((sale.payments || []).length > 0 || Number(sale.bonusUsed) > 0) && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase",
                        letterSpacing: ".5px", margin: "14px 0 8px" }}>
            {t("sales.colPayment")}
          </div>
          <div className="pay-sum" style={{ marginTop: 0 }}>
            {(sale.payments || []).map((p, i) => (
              <div className="pay-sum__row" key={i} style={{ "--pay-color": paymentEntry(p.type).color }}>
                <span className="pay-sum__name"><PayLabel type={p.type} /></span>
                <b className="ek-num">{money(p.amount)}</b>
              </div>
            ))}
            {Number(sale.bonusUsed) > 0 && (
              <div className="pay-sum__row">
                <span className="pay-sum__name">
                  <i className="fa-solid fa-coins" style={{ color: "var(--fg-warning)" }} aria-hidden="true" />{" "}
                  {t("bonus.used")}
                </span>
                <b className="ek-num" style={{ color: "var(--fg-warning)" }}>−{money(sale.bonusUsed)}</b>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
