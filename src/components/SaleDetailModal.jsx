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
            <tr><th>{t("products.col")}</th><th>{t("common.count")}</th><th>{t("sales.colPrice")}</th><th>{t("common.total")}</th></tr>
          </thead>
          <tbody>
            {(sale.items || []).map((item, i) => (
              <tr key={i}>
                <td className="fw-700">{item.productName}</td>
                <td><Badge color="blue">{item.quantity}</Badge></td>
                <td className="mono">{money(item.price)}</td>
                <td className="mono fw-700 text-blue">{money(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
