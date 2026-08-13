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
import { Field } from "./ui";
import { money } from "../utils";
import { paymentLabel } from "../lib/ek-labels";
import { printShiftReport } from "../lib/ek-hardware";
import { isDesktop } from "../lib/ek-desktop";
import { useBadge } from "../context/BadgeProvider";
import { useOnline } from "../hooks/useOnline";

/** Kiritilgan matndan son — bo'sh bo'lsa 0. */
const num = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function ShiftBar({ toast }) {
  // Naqd amallari 428 qaytarishi mumkin (kamomad, inkassatsiya) — bajik
  // modalini shu ochadi va tasdiqdan keyin amalni O'ZI qayta yuboradi.
  const { guard } = useBadge();
  const online = useOnline();
  const [shift, setShift] = useState(undefined);   // undefined=yuklanmoqda, null=yopiq
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);      // ko'rsatilayotgan X/Z hisobot
  const [openForm, setOpenForm]   = useState(null); // { float } — ochish oynasi
  /* { counted, nonCash: {CARD: "…"}, types: ["CARD"] } — yopish oynasi.
     `types` serverdan keladi: qaysi naqdsiz turlar bo'yicha sotuv bo'lgan.
     ⚠ SUMMALAR kelmaydi — kassir ularni terminal chekidan ko'chiradi. */
  const [closeForm, setCloseForm] = useState(null);
  const [cashForm, setCashForm]   = useState(null); // { type, amount, reason }

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

  /* Ochish/yopish endi BIR BOSISHDA emas: ikkalasi ham naqd summa so'raydi.
     Ochishda — boshlang'ich qoldiq, yopishda — kassir SANAGAN summa. */
  const askOpen = async () => {
    let suggested = "";
    try {
      // Oldingi smenada sanalgan naqd — odatda kassada o'sha qoladi.
      const r = await securityApi.suggestedFloat();
      if (r?.data != null) suggested = String(r.data);
    } catch (_) { /* taklif bo'lmasa ham ochish ishlayveradi */ }
    setOpenForm({ float: suggested });
  };

  const doOpen = async () => {
    setBusy(true);
    try {
      const res = await securityApi.openShift(num(openForm.float));
      toast?.success(res.message);
      setShift(res.data);
      setOpenForm(null);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* Yopish oynasi SERVERDAN so'raladi: qaysi naqdsiz turlar bo'yicha
     sotuv bo'lgani faqat serverga ma'lum. Ro'yxat bo'sh bo'lsa oyna
     ilgarigidek bitta maydondan iborat bo'ladi. */
  const askClose = async () => {
    let types = [];
    try {
      types = (await securityApi.nonCashTypes()).data || [];
    } catch (_) {
      // Ro'yxat kelmasa ham yopishga yo'l ochiq qoldiramiz: server
      // yetishmagan turni baribir o'zi aytadi.
    }
    setCloseForm({ counted: "", nonCash: {}, types });
  };

  const doClose = async () => {
    /* ⚠ OFLAYNDA TAQIQ: kutilgan naqdni SERVER hisoblaydi (smenadagi
       sotuvlar, naqd harakatlari, boshlang'ich qoldiq). Oflaynda uni
       hisoblab bo'lmaydi va yopishga urinish tarmoq xatosi bilan
       yiqilardi — kassir esa kunni topshira olmay qolardi va sababini
       bilmasdi. Endi sabab oldindan aytiladi. */
    if (!online) { toast?.error(t("offline.actionBlocked")); return; }
    setBusy(true);
    try {
      // Yopish javobi — Z-hisobot: darhol modalda ko'rsatamiz, kassir
      // qog'ozga chiqarib kunni topshiradi.
      const nonCash = {};
      for (const k of closeForm.types || []) nonCash[k] = num(closeForm.nonCash[k]);
      const res = await guard(() => securityApi.closeShift(num(closeForm.counted), nonCash));
      toast?.success(res.message);
      setShift(null);
      setCloseForm(null);
      setReport(res.data);
    } catch (err) {
      if (!err?.cancelled) toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doCash = async () => {
    setBusy(true);
    try {
      await guard(() => securityApi.addCash({
        type: cashForm.type,
        amount: num(cashForm.amount),
        reason: cashForm.reason || null,
      }));
      toast?.success(t("cash.saved"));
      setCashForm(null);
    } catch (err) {
      if (!err?.cancelled) toast?.error(err.message);
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
          {shift && (
            <button className="btn btn-outline btn-sm" onClick={() => setCashForm({ type: "COLLECTION", amount: "", reason: "" })}
                    title={t("cash.title")}>
              <i className="fa-solid fa-money-bill-transfer" aria-hidden="true" /> {t("cash.title")}
            </button>
          )}
          <button className={`btn btn-sm ${shift ? "btn-outline" : "btn-primary"}`}
                  onClick={() => (shift ? askClose() : askOpen())} disabled={busy}>
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

            {/* ── Naqd yarashtiruv ──────────────────────────────────────
                X-hisobotda `countedCash` bo'sh: kassir hali sanamagan.
                Z-hisobotda esa farq ham chiqadi. */}
            {report.cash && (
              <>
                <hr style={{ border: "none", borderTop: "1px dashed var(--border, #d4d4d8)", margin: "4px 0" }} />
                <Row k={t("cash.openingFloat")} v={money(report.cash.openingFloat)} />
                {/* ⚠ Kutilgan qiymatlar kassirga `null` keladi (server
                    maskalaydi) — u sanashdan oldin raqamni ko'rmasligi
                    kerak. Shuning uchun qatorlar shartli chiziladi. */}
                {report.cash.cashSales != null && <Row k={t("cash.sales")}     v={money(report.cash.cashSales)} />}
                {report.cash.movements != null && <Row k={t("cash.movements")} v={money(report.cash.movements)} />}
                {report.cash.expectedCash != null && (
                  <Row k={t("cash.expected")} v={money(report.cash.expectedCash)} strong />
                )}
                {report.cash.countedCash != null && (
                  <>
                    <Row k={t("cash.counted")} v={money(report.cash.countedCash)} strong />
                    <Row k={t("cash.difference")} v={money(report.cash.difference)}
                         danger={Number(report.cash.difference) !== 0} strong />
                  </>
                )}
              </>
            )}

            {/* ── Naqdsiz yarashtiruv ──────────────────────────────────
                X-hisobotda faqat TURLAR ko'rinadi (kassirga summa yo'q),
                Z-hisobotda esa tizim/terminal/farq uchligi. */}
            {report.nonCash?.length > 0 && (
              <>
                <hr style={{ border: "none", borderTop: "1px dashed var(--border, #d4d4d8)", margin: "4px 0" }} />
                <Row k={t("noncash.title")} v="" muted />
                {report.nonCash.map((l) => (
                  <div key={l.paymentType} style={{ marginLeft: 8 }}>
                    <Row k={`· ${paymentLabel(l.paymentType)}`}
                         v={l.counted == null
                             ? (l.expected == null ? "—" : money(l.expected))
                             : `${money(l.expected)} / ${money(l.counted)}`}
                         muted />
                    {l.difference != null && Number(l.difference) !== 0 && (
                      <Row k={`  ${t("cash.difference")}`} v={money(l.difference)} danger strong />
                    )}
                  </div>
                ))}
              </>
            )}
            {report.staff?.length > 1 && (
              <Row k={t("shift.staff")} v={report.staff.join(", ")} muted />
            )}
          </div>
        </Modal>
      )}

      {/* ── Smena ochish: boshlang'ich naqd ─────────────────────────────── */}
      {openForm && (
        <Modal title={t("shift.open")} onClose={() => setOpenForm(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setOpenForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={doOpen} disabled={busy}>
                <i className="fa-solid fa-right-to-bracket" aria-hidden="true" /> {t("shift.open")}
              </button>
            </>
          }>
          <label className="form-label">{t("cash.openingFloat")}</label>
          <Field kind="money" className="form-input ek-num"
                 value={openForm.float} autoFocus
                 onChange={(e) => setOpenForm({ float: e.target.value })} />
          <p className="form-hint">{t("cash.openingHint")}</p>
        </Modal>
      )}

      {/* ── Smena yopish: SANALGAN naqd ──────────────────────────────────
          ⚠ Kutilgan summa ATAYLAB ko'rsatilmaydi. Ko'rsatilsa kassir shu
          raqamni ko'chirib yozadi va sanoq ma'nosini yo'qotadi. */}
      {closeForm && (
        <Modal title={t("shift.close")} onClose={() => setCloseForm(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCloseForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-danger btn-sm" onClick={doClose}
                      disabled={busy || closeForm.counted === ""
                                || (closeForm.types || []).some((k) => (closeForm.nonCash[k] ?? "") === "")}>
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> {t("shift.close")}
              </button>
            </>
          }>
          <label className="form-label">{t("cash.counted")}</label>
          <Field kind="money" className="form-input ek-num"
                 value={closeForm.counted} autoFocus
                 onChange={(e) => setCloseForm({ ...closeForm, counted: e.target.value })} />
          <p className="form-hint">{t("cash.countHint")}</p>

          {/* ── Naqdsiz yarashtiruv ──────────────────────────────────────
              Faqat shu smenada ishlatilgan turlar so'raladi: terminali
              yo'q do'kon har kuni uchta nolni yozib o'tirmasin.
              Raqam TERMINALNING o'z chekidan ko'chiriladi — u bank
              raqami va kassir uni o'ylab topa olmaydi. */}
          {(closeForm.types || []).length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px dashed var(--border, #d4d4d8)", margin: "14px 0 10px" }} />
              <p className="form-hint" style={{ marginTop: 0 }}>{t("noncash.hint")}</p>
              {closeForm.types.map((k) => (
                <div key={k} style={{ marginTop: 8 }}>
                  <label className="form-label">{paymentLabel(k)}</label>
                  <Field kind="money" className="form-input ek-num"
                         value={closeForm.nonCash[k] ?? ""}
                         onChange={(e) => setCloseForm({
                           ...closeForm,
                           nonCash: { ...closeForm.nonCash, [k]: e.target.value },
                         })} />
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      {/* ── Naqd harakati ────────────────────────────────────────────────
          Inkassatsiya va xarajat bajik so'raydi (kamomad yaratadi), kirim
          esa yo'q. */}
      {cashForm && (
        <Modal title={t("cash.title")} onClose={() => setCashForm(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCashForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={doCash}
                      disabled={busy || !cashForm.amount}>
                {t("common.save")}
              </button>
            </>
          }>
          <div className="cat-tabs" role="tablist" aria-label={t("cash.title")} style={{ marginBottom: 12 }}>
            {["COLLECTION", "WITHDRAWAL", "DEPOSIT"].map((k) => (
              <button key={k} type="button" role="tab" aria-selected={cashForm.type === k}
                      className={`cat-tab ${cashForm.type === k ? "active" : ""}`}
                      onClick={() => setCashForm({ ...cashForm, type: k })}>
                {t(`cash.type.${k}`)}
              </button>
            ))}
          </div>
          <label className="form-label">{t("common.sum")}</label>
          <Field kind="money" className="form-input ek-num"
                 value={cashForm.amount} autoFocus
                 onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })} />
          <label className="form-label" style={{ marginTop: 10 }}>{t("inv.reason")}</label>
          <Field className="form-input" value={cashForm.reason}
                 onChange={(e) => setCashForm({ ...cashForm, reason: e.target.value })} />
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
