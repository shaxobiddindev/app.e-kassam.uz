import { useState } from "react";
import { THEME_OPTIONS, getMode, setMode } from "../../lib/ek-theme";
import Select from "./Select";

/* ==========================================================================
   Tema tanlagichi — Tizim / Yorug' / Qorong'i

   Nega tugma emas: holat UCHTA. "Tizim" — alohida qiymat, u OS sozlamasiga
   ergashadi; ikki holatli tugma buni ifodalay olmaydi.

   Nega native `<select>` emas: uning ochilgan ro'yxatini OS chizadi va
   qorong'i rejimda oq tizim oynasi paydo bo'lardi. `Select` — o'zimizniki.

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

export default function ThemeSelect({ compact = false, block = false, className = "" }) {
  const [mode, setLocal] = useState(getMode);
  const active = THEME_OPTIONS.find((o) => o.value === mode) || THEME_OPTIONS[0];

  return (
    <Select
      value={mode}
      onChange={(v) => setLocal(setMode(v))}
      options={THEME_OPTIONS}
      icon={active.icon}
      ariaLabel="Ko'rinish rejimi"
      variant={compact ? "compact" : ""}
      block={block}
      className={className}
    />
  );
}
