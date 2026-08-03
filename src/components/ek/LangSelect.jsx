import { useT, LANGS } from "../../lib/ek-i18n";
import Select from "./Select";

/* ==========================================================================
   Til tanlagichi — O'zbekcha · Русский · English

   Nega native `<select>` emas: uning ochilgan ro'yxatini OS chizadi va CSS
   unga ta'sir qilmaydi (ThemeSelect bilan bir xil sabab, 09-CHETLANISHLAR §1g).

   `compact` — yon menyu yig'ilganda faqat "UZ" / "RU" / "EN" ko'rinadi.

   ⚠ Bu tanlov FAQAT INTERFEYSGA ta'sir qiladi. Tovar, mijoz, kategoriya
   nomlari — foydalanuvchi ma'lumoti va tarjima qilinmaydi.

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

export default function LangSelect({ compact = false, block = false, className = "", onChanged }) {
  const { t, lang, setLang } = useT();

  const options = LANGS.map((l) => ({
    value: l.value,
    label: compact ? l.short : l.label,
    icon: l.icon,
  }));

  return (
    <Select
      value={lang}
      onChange={(v) => { setLang(v); onChanged?.(v); }}
      options={options}
      icon="fa-language"
      ariaLabel={t("settings.language")}
      variant={compact ? "compact" : ""}
      block={block}
      className={className}
    />
  );
}
