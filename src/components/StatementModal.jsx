import { useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { shortDate } from "../lib/ek-format";
import Modal from "./Modal";
import { Field } from "./ui";
import { buildStatement } from "../lib/ek-statement";
import { downloadXlsx } from "../lib/ek-xlsx";
import { printHtml } from "../lib/ek-receipt-pdf";
import { paymentEntry } from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ HISOBOTI — QARZDORLIK BAYONNOMASI (V98)

   Do'kon egasining talabi: mijozga beriladigan hisobot — «Jami qarz /
   To'langan / Qoldiq» va tagida «Sana · Chek · Qarz · To'lov · Qoldiq».

   ═══ ⚠ JURNAL OYNASI TEGILMADI ═════════════════════════════════════════

   Qarz oynasidagi jurnal o'z ko'rinishini SAQLAB QOLDI: u ishlaydi va
   undagi ishora qoidasi (qarz manfiy, to'lov musbat) foydalanuvchining
   o'z talabi. Hisobot esa BOSHQA hujjat va boshqa o'quvchi uchun —
   mijoz uchun. Unda yo'nalishni USTUNNING O'ZI aytadi, ya'ni ishora
   keraksiz.

   Ikkalasini bitta ko'rinishga majburlash biri uchun to'g'ri, ikkinchisi
   uchun noto'g'ri bo'lardi.

   ═══ ⚠ CHOP ETISH — MAVJUD YO'LDAN ═════════════════════════════════════

   `printHtml` (`ek-receipt-pdf.js`) ishlatiladi: unda Android'ning
   `window.print()` jimligi va oynani yopish mantiqi allaqachon hal
   qilingan. Bu yerda takrorlansa, o'sha ikki nozik joydan biri bir kuni
   tushib qolardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Hisobot qog'ozi — A4, ilovaning tokenlarisiz (qog'oz doim oq). */
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font: 12px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
h1 { font-size: 17px; margin: 0 0 2px; }
.sub { color: #555; font-size: 11px; margin-bottom: 12px; }
.tot { display: flex; gap: 18px; flex-wrap: wrap; margin: 0 0 14px;
       padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; }
.tot div { display: flex; flex-direction: column; }
.tot span { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
.tot b { font-size: 15px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em;
     color: #444; border-bottom: 2px solid #999; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tfoot td { font-weight: 800; border-top: 2px solid #999; border-bottom: none; }
.foot { margin-top: 18px; font-size: 10px; color: #666;
        display: flex; justify-content: space-between; }
`;

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default function StatementModal({ customer, ledger, shopName, onClose, toast }) {
  /* ⚠ DAVR BO'SH BOSHLANADI — «boshidan hozirgacha». Ko'p do'konda
     mijozning butun tarixi bir necha o'nlab qator va uni bo'lish
     shart emas; kerak bo'lganda egasi o'zi qo'yadi. */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const st = useMemo(() => buildStatement(ledger, { from, to }), [ledger, from, to]);

  const title = `${t("credit.statement")} — ${customer?.fullName || ""}`;
  const period = from || to
    ? `${from ? shortDate(from) : "…"} — ${to ? shortDate(to) : "…"}`
    : t("credit.stAllTime");

  /** Hisobot jadvali — ekranda ham, qog'ozda ham AYNAN bir xil. */
  const rowsHtml = st.rows.map((r) => `<tr>
      <td>${esc(shortDate(r.at))}</td>
      <td>${r.saleId ? "#" + esc(r.saleId) : esc(r.reason || "—")}</td>
      <td>${r.method ? esc(paymentEntry(r.method).label) : ""}</td>
      <td class="n">${r.charge ? esc(money(r.charge)) : "—"}</td>
      <td class="n">${r.payment ? esc(money(r.payment)) : "—"}</td>
      <td class="n">${r.balance == null ? "" : esc(money(r.balance))}</td>
    </tr>`).join("");

  const doPrint = async () => {
    try {
      await printHtml(`
        <h1>${esc(title)}</h1>
        <div class="sub">${esc(shopName || "")}${customer?.phone ? " · " + esc(customer.phone) : ""}
          · ${esc(period)}</div>
        <div class="tot">
          <div><span>${esc(t("credit.stOpening"))}</span><b>${esc(money(st.opening))}</b></div>
          <div><span>${esc(t("credit.stCharge"))}</span><b>${esc(money(st.charge))}</b></div>
          <div><span>${esc(t("credit.stPaid"))}</span><b>${esc(money(st.payment))}</b></div>
          <div><span>${esc(t("credit.stClosing"))}</span><b>${esc(money(st.closing))}</b></div>
        </div>
        <table>
          <thead><tr>
            <th>${esc(t("common.date"))}</th><th>${esc(t("kassa.receiptNo"))}</th>
            <th>${esc(t("credit.method"))}</th>
            <th class="n">${esc(t("credit.stCharge"))}</th>
            <th class="n">${esc(t("credit.stPaid"))}</th>
            <th class="n">${esc(t("credit.stBalance"))}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr>
            <td colspan="3">${esc(t("common.total"))}</td>
            <td class="n">${esc(money(st.charge))}</td>
            <td class="n">${esc(money(st.payment))}</td>
            <td class="n">${esc(money(st.closing))}</td>
          </tr></tfoot>
        </table>
        <div class="foot"><span>${esc(new Date().toLocaleString("uz-UZ"))}</span>
          <span>${esc(t("kassa.receiptSystem"))}</span></div>`,
        title, PRINT_CSS, "width=820,height=900");
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const doXlsx = () => {
    const head = (...c) => c.map((v) => ({ v, bold: true }));
    downloadXlsx(`hisobot-${(customer?.fullName || "mijoz").replace(/\s+/g, "-")}`, [{
      name: t("credit.statement"),
      rows: [
        [{ v: title, bold: true }],
        [period],
        [],
        head(t("credit.stOpening"), t("credit.stCharge"), t("credit.stPaid"), t("credit.stClosing")),
        [st.opening, st.charge, st.payment, st.closing],
        [],
        head(t("common.date"), t("kassa.receiptNo"), t("credit.method"),
             t("credit.stCharge"), t("credit.stPaid"), t("credit.stBalance")),
        ...st.rows.map((r) => [
          shortDate(r.at),
          r.saleId ? `#${r.saleId}` : (r.reason || ""),
          r.method ? paymentEntry(r.method).label : "",
          r.charge || 0, r.payment || 0,
          r.balance == null ? "" : r.balance,
        ]),
      ],
    }]);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth={860}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.close")}</button>
          <button className="btn btn-outline btn-sm" onClick={doXlsx}>
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={doPrint}>
            <i className="fa-solid fa-print" aria-hidden="true" /> {t("common.print")}
          </button>
        </>
      }
    >
      {/* ⚠ DAVR — IXTIYORIY. Bo'sh qoldirilsa butun tarix chiqadi va
          bu eng ko'p kerak bo'ladigan holat. */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <label className="form-label" htmlFor="st-from">{t("common.from")}</label>
          <Field id="st-from" type="date" className="form-input" value={from}
                 onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="st-to">{t("common.to")}</label>
          <Field id="st-to" type="date" className="form-input" value={to}
                 onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="st-tot">
        <div><span>{t("credit.stOpening")}</span><b className="ek-num">{money(st.opening)}</b></div>
        <div><span>{t("credit.stCharge")}</span>
             <b className="ek-num" style={{ color: "var(--fg-danger)" }}>{money(st.charge)}</b></div>
        <div><span>{t("credit.stPaid")}</span>
             <b className="ek-num" style={{ color: "var(--fg-success)" }}>{money(st.payment)}</b></div>
        <div><span>{t("credit.stClosing")}</span><b className="ek-num">{money(st.closing)}</b></div>
      </div>

      <div className="table-wrap" style={{ maxHeight: "min(46vh, 460px)", overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("kassa.receiptNo")}</th>
              <th className="ta-right">{t("credit.stCharge")}</th>
              <th className="ta-right">{t("credit.stPaid")}</th>
              <th className="ta-right">{t("credit.stBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {st.rows.length ? st.rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{shortDate(r.at)}</td>
                <td style={{ fontSize: 12 }}>
                  {r.saleId ? <span className="mono">#{r.saleId}</span>
                            : <span className="text-muted">{r.reason || "—"}</span>}
                  {r.method && (
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {paymentEntry(r.method).label}
                    </div>
                  )}
                </td>
                {/* ⚠ ISHORASIZ: yo'nalishni ustunning o'zi aytadi. */}
                <td className="mono ta-right" style={{ fontSize: 12 }}>
                  {r.charge ? money(r.charge) : <span className="text-muted">—</span>}
                </td>
                <td className="mono ta-right" style={{ fontSize: 12 }}>
                  {r.payment ? money(r.payment) : <span className="text-muted">—</span>}
                </td>
                {/* ⚠ Bo'sh — «server aytmadi», nol EMAS (`ek-statement.js`). */}
                <td className="mono ta-right fw-700" style={{ fontSize: 12 }}>
                  {r.balance == null ? "" : money(r.balance)}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="text-muted" style={{ padding: 18, textAlign: "center" }}>
                {t("credit.stEmpty")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
