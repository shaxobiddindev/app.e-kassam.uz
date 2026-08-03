import { useState } from "react";
import { THEME_VALUES, getMode, setMode } from "../../lib/ek-theme";
import { useT } from "../../lib/ek-i18n";
import Select from "./Select";

/* ==========================================================================
   Tema tanlagichi — Tizim / Yorug' / Qorong'i

   Nega tugma emas: holat UCHTA. "Tizim" — alohida qiymat, u OS sozlamasiga
   ergashadi; ikki holatli tugma buni ifodalay olmaydi.

   Nega native `<select>` emas: uning ochilgan ro'yxatini OS chizadi va
   qorong'i rejimda oq tizim oynasi paydo bo'lardi. `Select` — o'zimizniki.

   ⚠ Yorliqlar `ek-theme.js` dan EMAS, `useT` dan olinadi — `ek-theme.js`
   modul darajasida yuklanadi va u yerdagi matn til o'zgarganda yangilanmasdi.

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

export default function ThemeSelect({ compact = false, block = false, className = "" }) {
  const { t } = useT();
  const [mode, setLocal] = useState(getMode);

  const options = THEME_VALUES.map((o) => ({
    value: o.value,
    label: t(`theme.${o.value}`),
    icon: o.icon,
  }));
  const active = options.find((o) => o.value === mode) || options[0];

  return (
    <Select
      value={mode}
      onChange={(v) => setLocal(setMode(v))}
      options={options}
      icon={active.icon}
      ariaLabel={t("theme.label")}
      variant={compact ? "compact" : ""}
      block={block}
      className={className}
    />
  );
}
