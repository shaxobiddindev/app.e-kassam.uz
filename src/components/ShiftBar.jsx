/* ══════════════════════════════════════════════════════════════════════════
   Smena paneli — Kassa ekranining tepasida

   Nega ko'zga tashlanadigan joyda: bajik FAQAT smena ochiq bo'lganda
   ishlaydi (BadgeGuard). Kassir smenani ochmagan bo'lsa, birinchi muhim
   amalda tushunarsiz "xodim smenada emas" xatosini olardi — panel esa
   buni oldindan ko'rsatib, bir bosishda tuzatadi.

   Smena holati SERVERDA (localStorage emas): u xavfsizlik fakti va
   terminal almashsa ham yashashi kerak.

   Hisobotlar: X — ochiq smenaning oraliq holati («Holat» tugmasi),
   Z — yopilishda avtomatik ochiladi. Ikkalasi ham chek printerida
   chop etiladi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { securityApi } from "../api";
import { Modal } from "../components";
import { money } from "../utils";
import { paymentLabel } from "../lib/ek-labels";
import { printShiftReport } from "../lib/ek-hardware";
import { isDesktop } from "../lib/ek-desktop";

export default function ShiftBar({ toast }) {
  const [shift, setShift] = useState(undefined);   // undefined=yuklanmoqda, null=yopiq
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);      // ko'rsatilayotgan X/Z hisobot

  const load = useCallback(async () => {
    try {
      const res = await securityApi.currentShift();
      setShift(res.data || null);
    } catch (_) {
      // Smena holati bilinmasa kassani TO'XTATMAYMIZ — panel shunchaki
      // ko'rinmaydi; muhim amalda server baribir o'zi tekshiradi.
      setShift(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (shift) {
        // Yopish javobi — Z-hisobot: darhol modalda ko'rsatamiz, kassir
        // qog'ozga chiqarib kunni topshiradi.
        const res = await securityApi.closeShift();
        toast?.success(res.message);
        setShift(null);
        setReport(res.data);
      } else {
        const res = await securityApi.openShift();
        toast?.success(res.message);
        setShift(res.data);
      }
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const showX = async () => {
    try {
      setReport((await securityApi.shiftReport()).data);
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const print = async () => {
    try {
      await printShiftReport(report, localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode"));
      toast?.success(t("shift.reportPrinted"));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const fmtT = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "-");

  if (shift === undefined) return null;

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "8px 14px", borderRadius: 10, marginBottom: 10,
        background: shift ? "var(--green-l, #dcfce7)" : "#fef3c7",
        border: `1px solid ${shift ? "var(--green, #16a34a)" : "#f59e0b"}`,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: shift ? "var(--green-d, #166534)" : "#92400e" }}>
          <i className={`fa-solid ${shift ? "fa-circle-check" : "fa-triangle-exclamation"}`} aria-hidden="true" />{" "}
          {shift
            ? `${t("shift.openSince")} ${new Date(shift.openedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`
            : t("shift.closedWarn")}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          {shift && (
            <button className="btn btn-outline btn-sm" onClick={showX} title={t("shift.viewXHint")}>
              <i className="fa-solid fa-chart-simple" aria-hidden="true" /> {t("shift.viewX")}
            </button>
          )}
          <button className={`btn btn-sm ${shift ? "btn-outline" : "btn-primary"}`} onClick={toggle} disabled={busy}>
            <i className={`fa-solid ${shift ? "fa-right-from-bracket" : "fa-right-to-bracket"}`} aria-hidden="true" />{" "}
            {shift ? t("shift.close") : t("shift.open")}
          </button>
        </span>
      </div>

      {/* ── X/Z hisobot modali ── */}
      {report && (
        <Modal
          title={report.closedAt ? t("shift.zTitle") : t("shift.xTitle")}
          onClose={() => setReport(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setReport(null)}>
                {t("common.close")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={print} disabled={!isDesktop()}>
                <i className="fa-solid fa-print" aria-hidden="true" /> {t("shift.printReport")}
              </button>
            </>
          }
        >
          <div style={{ display: "grid", gap: 8 }}>
            <Row k={t("sales.colCashier")} v={report.cashierName} />
            <Row k={t("sec.openedAt")} v={fmtT(report.openedAt)} />
            {report.closedAt && <Row k={t("shift.closedAt")} v={fmtT(report.closedAt)} />}
            <hr style={{ border: "none", borderTop: "1px dashed var(--border, #d4d4d8)", margin: "4px 0" }} />
            <Row k={t("rpt.salesCount")} v={report.salesCount} />
            <Row k={t("rpt.salesTotal")} v={money(report.salesTotal)} strong />
            {Object.entries(report.byPaymentType || {}).map(([type, sum]) => (
              <Row key={type} k={`· ${paymentLabel(type)}`} v={money(sum)} muted />
            ))}
            <hr style={{ border: "none", borderTop: "1px dashed var(--border, #d4d4d8)", margin: "4px 0" }} />
            <Row k={t("rpt.cancelled")} v={`${report.cancelledCount} / ${money(report.cancelledTotal)}`} />
            <Row k={t("rpt.confirmations")} v={report.confirmationsCount} />
            {report.suspiciousCount > 0 && (
              <Row k={t("rpt.suspicious")} v={report.suspiciousCount} danger />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function Row({ k, v, strong, muted, danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: muted ? 13 : 14 }}>
      <span className={muted ? "text-muted" : "fw-600"}>{k}</span>
      <span className={strong ? "fw-800 mono" : "mono"}
            style={danger ? { color: "var(--red, #dc2626)", fontWeight: 700 } : undefined}>
        {v}
      </span>
    </div>
  );
}
