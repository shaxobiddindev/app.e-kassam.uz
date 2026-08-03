import { useState } from "react";
import { THEME_OPTIONS, getMode, setMode } from "../../lib/ek-theme";

/* ==========================================================================
   Tema tanlagichi — Tizim / Yorug' / Qorong'i

   Nega tugma emas: holat UCHTA. "Tizim" — bu alohida qiymat, "yorug'" ham,
   "qorong'i" ham emas: u OS sozlamasiga ergashadi. Ikki holatli tugma buni
   ifodalay olmaydi va "Qorong'i rejim" yozuvi yon menyuda juda uzun edi.

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

export default function ThemeSelect({ compact = false, className = "" }) {
  const [mode, setLocal] = useState(getMode);
  const active = THEME_OPTIONS.find((o) => o.value === mode) || THEME_OPTIONS[0];

  return (
    <label className={`ek-theme-select ${compact ? "is-compact" : ""} ${className}`}
           title={compact ? `Ko'rinish: ${active.label}` : undefined}>
      <i className={`fa-solid ${active.icon}`} aria-hidden="true" />
      <select
        value={mode}
        aria-label="Ko'rinish rejimi"
        onChange={(e) => setLocal(setMode(e.target.value))}
      >
        {THEME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
