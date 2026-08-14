import { useCallback, useEffect, useState } from "react";
import { t, getLang } from "../lib/ek-i18n";
import { saleApi } from "../api";
import { money } from "../utils";
import { paymentEntry } from "../lib/ek-labels";

/* Oxirgi cheklar lentasi — egasi «hozir nima sotilyapti?» deb qaraydi.
   Faqat o'qish: bekor qilish/qaytarish kassada, telefon esa nazorat. */
export default function MobileSales({ toast, branchId }) {
  const [sales, setSales] = useState([]);
  const [busy, setBusy]   = useState(true);

  const load = useCallback(() => {
    setBusy(true);
    saleApi.getAll(branchId)
      .then((r) => setSales((r.data || []).slice(0, 40)))
      .catch((e) => toast?.error(e.message))
      .finally(() => setBusy(false));
  }, [branchId, toast]);

  useEffect(() => { load(); }, [load]);

  const timeOf = (s) => {
    try {
      return new Date(s.createdAt).toLocaleString(getLang() === "ru" ? "ru-RU" : "uz-UZ", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return ""; }
  };

  return (
    <div className="m-screen">
      <header className="m-head">
        <h1 className="m-head__title">{t("m.tab.sales")}</h1>
        <button type="button" className="m-iconbtn" onClick={load} aria-label={t("common.refresh")}>
          <i className={`fa-solid fa-rotate ${busy ? "fa-spin" : ""}`} aria-hidden="true" />
        </button>
      </header>

      {sales.length === 0 && !busy ? (
        <div className="m-empty m-card">{t("dash.noSales")}</div>
      ) : (
        <section className="m-card">
          {sales.map((s) => {
            const pay = paymentEntry(s.paymentType || s.payments?.[0]?.type);
            const returned = s.type === "RETURN" || s.status === "CANCELLED";
            return (
              <div key={s.id} className="m-sale">
                <i className={`fa-solid ${returned ? "fa-rotate-left" : (pay.icon || "fa-receipt")}`}
                   style={{ color: returned ? "var(--fg-danger)" : pay.color }} aria-hidden="true" />
                <span className="m-sale__info">
                  <b className="ek-num">{money(s.totalAmount ?? s.total ?? 0)}</b>
                  <small>{timeOf(s)}{s.cashierName ? ` · ${s.cashierName}` : ""}</small>
                </span>
                {returned && <span className="m-sale__badge">{t("m.returned")}</span>}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
