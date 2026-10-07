import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, recipeApi } from "../api";
import { Field } from "./ui";
import { money } from "../lib/ek-format";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { recipeCost, isIngredient } from "../lib/ek-recipe";

/* ══════════════════════════════════════════════════════════════════════════
   TEXNOLOGIK KARTA — tovar formasida (R3, V150, docs/22-RESTORAN.md)

   «1 porsiya osh: guruch 0,150 kg, go'sht 0,100 kg …». Sotilganda shu
   masalliqlar ombordan yechiladi; yetmasa sotuv TO'XTAMAYDI, kamomad
   yoziladi (egasining qarori).

   ⚠ HOLAT YUQORIDA (ProductsPage). Retsept TAOM saqlangandan keyin
   yuboriladi: yangi taomning ID si saqlashdan oldin yo'q.

   ⚠ MASALLIQ — omborda turadigan TOVAR. Qidiruvda xizmat va boshqa taomlar
   ko'rsatilmaydi: server ularni baribir rad etadi, ekran esa rad etiladigan
   narsani taklif qilmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */
export default function RecipeEditor({ productId, lines, onChange, salePrice }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const seq = useRef(0);

  /* Tahrirda — serverdagi retsept. Faqat bir marta (`lines == null`). */
  useEffect(() => {
    if (!productId || lines != null) return;
    let alive = true;
    recipeApi.get(productId)
      .then((r) => { if (alive) onChange(asArray(r?.data?.lines).map(fromServer), false); })
      .catch(() => { if (alive) onChange([], false); });
    return () => { alive = false; };
  }, [productId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const text = q.trim();
    if (!text) { setFound([]); return undefined; }
    const my = ++seq.current;
    const id = setTimeout(() => {
      productApi.search(text, 0, 12)
        .then((r) => {
          if (my !== seq.current) return;
          setFound(asArray(r?.data).filter((p) => isIngredient(p) && p.id !== productId));
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [q, productId]);

  const list = lines || [];
  const has = (id) => list.some((l) => l.ingredientId === id);
  const cost = recipeCost(list);
  const sale = Number(salePrice) || 0;

  const add = (p) => {
    onChange([...list, { ingredientId: p.id, name: p.name, unit: p.unit,
      unitDecimals: unitDecimals(p.unit), quantity: "", costPrice: p.costPrice ?? null }], true);
    setQ(""); setFound([]);
  };
  const setQty = (idx, v) => onChange(list.map((l, i) => (i === idx ? { ...l, quantity: v } : l)), true);
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx), true);

  return (
    <div className="rcp">
      {list.length === 0
        ? <p className="form-hint">{t("rcp.empty")}</p>
        : (
          <div className="rcp-rows">
            {list.map((l, idx) => (
              <div className="rcp-row" key={l.ingredientId}>
                <span className="rcp-row__name">{l.name}</span>
                <Field kind="qty" unit={l.unit} className="form-input ek-num rcp-row__qty" placeholder="0"
                       aria-label={`${l.name} — ${t("rcp.qty")}`} value={l.quantity}
                       onChange={(e) => setQty(idx, e.target.value)} />
                <span className="rcp-row__unit">{unitLabel(l.unit)}</span>
                <span className="rcp-row__cost ek-num">
                  {l.costPrice != null && Number(l.quantity) > 0 ? money(Number(l.costPrice) * Number(l.quantity)) : "—"}
                </span>
                <button type="button" className="btn-icon danger" aria-label={`${l.name} — ${t("common.delete")}`}
                        onClick={() => remove(idx)}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

      <Field className="form-input" placeholder={t("rcp.find")} aria-label={t("rcp.find")}
             value={q} onChange={(e) => setQ(e.target.value)} />
      {found.length > 0 && (
        <ul className="mod-found">
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={has(p.id)} onClick={() => add(p)}>
                <i className={`fa-solid ${has(p.id) ? "fa-check" : "fa-plus"}`} aria-hidden="true" /> {p.name}
                <span className="text-muted"> · {unitLabel(p.unit)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="rcp-total">
          <span>{t("rcp.cost")}: <b className="ek-num">{money(cost)}</b></span>
          {sale > 0 && cost > 0 && (
            <span className={cost >= sale ? "text-danger" : "text-muted"}>
              {cost >= sale && <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />}{" "}
              {t("rcp.share", { pct: Math.round((cost / sale) * 100) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function fromServer(l) {
  return {
    ingredientId: l.ingredientId, name: l.name, unit: l.unit,
    unitDecimals: l.unitDecimals ?? unitDecimals(l.unit),
    quantity: l.quantity == null ? "" : String(Number(l.quantity)),
    costPrice: l.costPrice ?? null,
  };
}
