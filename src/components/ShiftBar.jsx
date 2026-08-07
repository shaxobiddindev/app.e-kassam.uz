/* ══════════════════════════════════════════════════════════════════════════
   Smena paneli — Kassa ekranining tepasida

   Nega ko'zga tashlanadigan joyda: bajik FAQAT smena ochiq bo'lganda
   ishlaydi (BadgeGuard). Kassir smenani ochmagan bo'lsa, birinchi muhim
   amalda tushunarsiz "xodim smenada emas" xatosini olardi — panel esa
   buni oldindan ko'rsatib, bir bosishda tuzatadi.

   Smena holati SERVERDA (localStorage emas): u xavfsizlik fakti va
   terminal almashsa ham yashashi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { securityApi } from "../api";

export default function ShiftBar({ toast }) {
  const [shift, setShift] = useState(undefined);   // undefined=yuklanmoqda, null=yopiq
  const [busy, setBusy] = useState(false);

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
      const res = shift ? await securityApi.closeShift() : await securityApi.openShift();
      toast?.success(res.message);
      setShift(shift ? null : res.data);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (shift === undefined) return null;

  return (
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
      <button className={`btn btn-sm ${shift ? "btn-outline" : "btn-primary"}`} onClick={toggle} disabled={busy}>
        <i className={`fa-solid ${shift ? "fa-right-from-bracket" : "fa-right-to-bracket"}`} aria-hidden="true" />{" "}
        {shift ? t("shift.close") : t("shift.open")}
      </button>
    </div>
  );
}
