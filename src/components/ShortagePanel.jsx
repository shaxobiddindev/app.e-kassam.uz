import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { recipeApi } from "../api";
import { quantity as fmtQty, dateTime } from "../lib/ek-format";
import { unitLabel } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { useShopFeatures } from "../hooks/useShopFeatures";

/* ══════════════════════════════════════════════════════════════════════════
   MASALLIQ KAMOMADI — Ombor sahifasida (R3, V150)

   Taom sotildi, retseptdagi masalliq omborda yetmadi. Sotuv TO'XTAMAGAN
   (egasining qarori) — shuning uchun bu yerda ko'rinishi shart: aks holda
   «guruch kirimi kiritilmagan» degan holat hech qayerda sezilmasdi va
   tannarx kartochkadagi narx bilan taxminiy hisoblanaverardi.

   ⚠ KAMOMAD BO'LMASA UMUMAN CHIZILMAYDI va restoran modulisiz do'konda
   so'rov ham yuborilmaydi (server 403 berardi).
   ══════════════════════════════════════════════════════════════════════════ */
export default function ShortagePanel() {
  const { has, ready } = useShopFeatures();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !has("RECIPES")) return undefined;
    let alive = true;
    recipeApi.shortages()
      .then((r) => { if (alive) setRows(asArray(r?.data)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ready]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length) return null;
  return (
    <section className="rcp-short" role="status">
      <button type="button" className="rcp-short__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>{t("rcp.shortTitle", { n: rows.length })}</span>
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <p className="rcp-short__hint">{t("rcp.shortHint")}</p>
          <ul className="rcp-short__list">
            {rows.map((r) => (
              <li key={r.ingredientId}>
                <span className="fw-700">{r.name}</span>
                <span className="ek-num">−{fmtQty(r.quantity, r.unitDecimals)} {unitLabel(r.unit)}</span>
                <span className="text-muted">{t("rcp.shortTimes", { n: r.times })} · {dateTime(r.lastAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
