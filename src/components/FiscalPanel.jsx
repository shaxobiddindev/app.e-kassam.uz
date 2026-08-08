import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/ek-i18n";
import { fiscalApi } from "../api";
import { fmtDateTime } from "../utils";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   Fiskal holat paneli — do'kon egasi uchun.

   ⚠ BU PANEL YOMON XABARNI YASHIRMAYDI. Fiskal modul ulanmagan bo'lsa u
   shuni ochiq aytadi va navbatda nechta chek turganini ko'rsatadi. "Hammasi
   joyida" ko'rinishini yasash eng zararli variant bo'lardi: do'kon buni
   faqat tekshiruv kunida bilib qolardi.

   Qonuniy holat ham shu yerda yozilgan: chakana savdo dasturi soliq
   organlari bilan virtual kassa sifatida integratsiya qilinishi shart,
   buning uchun OFD operatori bilan shartnoma kerak — bu kodda hal
   bo'lmaydi va do'kon egasi buni bilishi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

export default function FiscalPanel({ toast }) {
  const [status, setStatus] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([fiscalApi.status(), fiscalApi.receipts()]);
      setStatus(s.data);
      setReceipts(r.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const retry = async (id) => {
    setBusyId(id);
    try {
      await fiscalApi.retry(id);
      toast.success(t("fiscal.retried"));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !status) return <div className="card" style={{ padding: 18 }}><Spinner /></div>;
  if (!status) return null;

  const problem = !status.enabled || status.failed > 0;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-receipt text-blue" aria-hidden="true" /> {t("fiscal.title")}
        </span>
        <button className="btn btn-outline btn-sm" onClick={load}>
          <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <div className={`ek-note ${problem ? "ek-note--warn" : ""}`}>
          <i className={`fa-solid ${status.enabled ? "fa-circle-check" : "fa-triangle-exclamation"}`} />
          <div>
            <div>
              {t("fiscal.provider")}: <b>{status.provider}</b> —{" "}
              {status.enabled ? t("fiscal.connected") : t("fiscal.notConnected")}
            </div>
            {!status.enabled && <div className="form-hint">{t("fiscal.legalNote")}</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
          <Stat label={t("fiscal.pending")} value={status.pending} tone={status.pending ? "warning" : null} />
          <Stat label={t("fiscal.sent")} value={status.sent} />
          <Stat label={t("fiscal.failed")} value={status.failed} tone={status.failed ? "danger" : null} />
        </div>

        {receipts.length === 0 ? (
          <div className="form-hint" style={{ marginTop: 14 }}>{t("fiscal.noReceipts")}</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("common.status")}</th>
                  <th>{t("kassa.receiptFiscalSign")}</th>
                  <th>{t("common.date")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td className="ek-num">{r.saleId ?? "—"}{r.operation === "REFUND" ? " ↩" : ""}</td>
                    <td>
                      <span className={`badge ${badgeFor(r.status)}`}>{statusLabel(r.status)}</span>
                      {r.lastError && (
                        <div className="form-hint" style={{ color: "var(--fg-danger)" }}>{r.lastError}</div>
                      )}
                    </td>
                    <td className="ek-num" style={{ fontSize: 12 }}>{r.fiscalSign || "—"}</td>
                    <td className="ek-num" style={{ fontSize: 12 }}>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      {r.status !== "SENT" && r.status !== "CANCELLED" && (
                        <button className="btn btn-outline btn-sm" disabled={busyId === r.id}
                                onClick={() => retry(r.id)}>
                          {busyId === r.id ? <Spinner /> : <i className="fa-solid fa-paper-plane" />}
                          {t("fiscal.retry")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="form-hint">{label}</div>
      <div className="ek-num" style={{
        fontSize: 22, fontWeight: 900,
        color: tone === "danger" ? "var(--fg-danger)"
             : tone === "warning" ? "var(--fg-warning)" : "var(--fg-primary)",
      }}>{value}</div>
    </div>
  );
}

const badgeFor = (s) => ({
  SENT: "badge-green", PENDING: "badge-yellow", FAILED: "badge-red", CANCELLED: "badge-gray",
}[s] || "badge-gray");

const statusLabel = (s) => ({
  SENT: t("fiscal.sent"), PENDING: t("fiscal.pending"), FAILED: t("fiscal.failed"),
  CANCELLED: t("common.cancel"),
}[s] || s);
