import { useEffect, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { productApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { useDebounced } from "../../hooks/useDebounced";
import { money } from "../../utils";

/**
 * MAHSULOT HISOBOTINI OCHISH — qidiruv (2026-10-05).
 *
 * ⚠ NEGA SERVERDAN QIDIRILADI, hisobotdagi ro'yxatdan emas. «Tovarlar»
 * jadvalida faqat DAVRDA SOTILGANLAR bor. Egasi esa ko'pincha aynan
 * sotilmayotgan tovarni so'raydi («bu nega ketmayapti, qancha qoldi?») —
 * u ro'yxatda bo'lmasdi va «tovar yo'q» degan xato xulosa chiqardi.
 */
export default function ProductFinder({ shopId, onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const slow = useDebounced(q.trim(), 250);

  useEffect(() => {
    if (slow.length < 2) { setRows([]); return undefined; }
    let alive = true;
    setBusy(true);
    productApi.getPage(0, 8, { q: slow, shopId })
      .then((r) => { if (alive) setRows(asArray(r?.data?.content ?? r?.data)); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [slow, shopId]);

  return (
    <div className="rpt-find">
      <label className="rpt-find__box">
        <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-magnifying-glass"}`} aria-hidden="true" />
        <input type="search" className="rpt-find__input" value={q}
               placeholder={t("rpt2.findProduct")} aria-label={t("rpt2.findProduct")}
               onChange={(e) => setQ(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter" && rows[0]) onPick(rows[0]); }} />
      </label>
      {slow.length >= 2 && !busy && (
        <div className="rpt-find__list" role="listbox" aria-label={t("rpt2.findProduct")}>
          {rows.length ? rows.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected="false"
                    className="rpt-find__row" onClick={() => onPick(p)}>
              <span className="rpt-find__name">{p.name}</span>
              {p.barcode && <span className="rpt-find__code ek-num">{p.barcode}</span>}
              <span className="rpt-find__price ek-num">{money(p.salePrice)}</span>
            </button>
          )) : <div className="rpt-find__empty">{t("rpt2.findNone")}</div>}
        </div>
      )}
    </div>
  );
}
