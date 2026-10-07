import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../utils";
import Overlay from "./ek/Overlay";
import { toggle, missing, chosen, extraOf, isSingle } from "../lib/ek-modifiers";

/* ══════════════════════════════════════════════════════════════════════════
   TAOM QO'SHIMCHALARI — kassada tanlash (R2, V149)

   Taom bosilganda, unga guruh biriktirilgan bo'lsa ochiladi. Kassir
   «Pishloq», «Piyozsiz» ni bosadi va «Savatga» — qator shu tanlov bilan
   tushadi (`lib/ek-modifiers.js`).

   ⚠ MAJBURIY GURUH TO'LMAGUNCHA «SAVATGA» O'CHIQ va qaysi guruh
   yetishmayotgani YOZILADI (rang yolg'iz signal emas). Ilgari bunday
   tekshiruv yo'q joyda oshxona «porsiyasi qanaqa?» deb qaytib so'rardi.

   ⚠ TUGMALAR ≥ 56px (kassir ekrani qoidasi) — kassir barmoq bilan, tez
   bosadi. Enter — tasdiq, Esc — bekor.
   ══════════════════════════════════════════════════════════════════════════ */
export default function ModifierModal({ product, groups, onConfirm, onClose }) {
  const [picked, setPicked] = useState({});

  const lacking = missing(groups, picked);
  const mods = chosen(groups, picked);
  const total = (Number(product?.salePrice) || 0) + extraOf(mods);
  const valid = lacking.length === 0;

  const confirm = () => { if (valid) onConfirm(mods); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirm(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const rule = (g) => {
    const min = Number(g.minSelect) || 0;
    const max = Number(g.maxSelect) || 0;
    if (min > 0 && max === min) return t("mod.ruleExact", { n: min });
    if (min > 0) return max ? t("mod.ruleRange", { min, max }) : t("mod.ruleMin", { n: min });
    return max ? t("mod.ruleUpTo", { n: max }) : t("mod.ruleAny");
  };

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
             aria-label={t("mod.title", { name: product?.name })} onEscape={onClose}>
      <div className="ek-dialog mod-modal">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-utensils" aria-hidden="true" />
            {product?.name}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="mod-modal__body">
          {groups.map((g) => {
            const sel = picked[g.id] || [];
            const short = lacking.includes(g);
            return (
              <fieldset key={g.id} className="mod-group">
                <legend className="mod-group__head">
                  <span className="mod-group__name">{g.name}</span>
                  <span className={`mod-group__rule${short ? " is-short" : ""}`}>
                    {short && <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />} {rule(g)}
                  </span>
                </legend>
                <div className="mod-group__opts" role={isSingle(g) ? "radiogroup" : "group"}>
                  {g.options.map((o) => {
                    const on = sel.includes(o.id);
                    return (
                      <button key={o.id} type="button"
                              className={`mod-opt${on ? " is-on" : ""}`}
                              role={isSingle(g) ? "radio" : "checkbox"} aria-checked={on}
                              onClick={() => setPicked((p) => toggle(p, g, o.id))}>
                        {/* Bo'sh katak — chiziqli, belgilangani — to'liq: rang yolg'iz signal emas. */}
                        <i className={on ? "fa-solid fa-square-check" : "fa-regular fa-square"} aria-hidden="true" />
                        {/* ⚠ Narx NOM OSTIDA: yonma-yon turganda tor katakda
                            «+4 000 so'm» nomning ustiga chiqib ketardi. */}
                        <span className="mod-opt__txt">
                          <span className="mod-opt__name">{o.name}</span>
                          {Number(o.price) > 0 && <span className="mod-opt__price ek-num">+{money(o.price)}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            {t("common.cancel")}
            <span className="kbd">Esc</span>
          </button>
          <button className="btn btn-green btn-pos" onClick={confirm} disabled={!valid}>
            <i className="fa-solid fa-cart-plus" aria-hidden="true" /> {t("mod.add")}
            <span className="ek-num">{money(total)}</span>
            <span className="kbd">Enter</span>
          </button>
        </div>
      </div>
    </Overlay>
  );
}
