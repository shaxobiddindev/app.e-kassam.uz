import { useState, useEffect, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { unitLabel } from "../lib/ek-labels";
import { money } from "../utils";

/* ══════════════════════════════════════════════════════════════════════════
   Miqdor kiritish — FAQAT bo'linadigan birliklar uchun (kg, litr, metr).

   NEGA ALOHIDA OYNA: donalab sotiladigan tovarda "+" tugmasi yetarli, ammo
   0.350 kg ni "+" bilan yig'ib bo'lmaydi. Tarozi barkodi bo'lsa miqdor
   avtomatik keladi va bu oyna FAQAT TASDIQLASH uchun ochiladi — chunki
   tarozi formati do'kondan do'konga farq qiladi va noto'g'ri o'qilgan
   og'irlik jimgina chekka tushib qolmasligi kerak.

   Klaviatura: raqamlar, nuqta, Enter (tasdiq), Esc (bekor). Sichqonchasiz
   ham, sensorli ekranda ham ishlaydi — tugmalar 56px (CLAUDE.md #3).
   ══════════════════════════════════════════════════════════════════════════ */

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

export default function QuantityModal({ product, initial, onConfirm, onClose }) {
  const decimals = product?.unitDecimals ?? 3;
  const [value, setValue] = useState(
    initial != null ? String(Number(initial)) : ""
  );
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const num = Number(value.replace(",", "."));
  const valid = Number.isFinite(num) && num > 0;
  const total = valid && product?.salePrice != null ? num * product.salePrice : 0;

  /**
   * ⚠ Nuqta ALOHIDA ishlanadi. Ilgari u umumiy qoidaga tushardi
   * («qiymat "0" bo'lsa, ustiga yozamiz») va bo'sh maydonda «.» bosilganda
   * qiymat ".25" bo'lib qolardi: 0.25 kg o'rniga chekka ".25" tushishi
   * mumkin edi. Endi bo'sh maydonda «.» → "0.".
   *
   * Holat YANGILAGICH ichida o'qiladi: ketma-ket tez bosishda tashqi
   * `value` eskirgan bo'lishi mumkin.
   */
  const press = (key) => {
    if (key === "⌫") { setValue((v) => v.slice(0, -1)); return; }
    if (key === ".") {
      if (!decimals) return;
      setValue((v) => (v.includes(".") ? v : (v === "" ? "0." : v + ".")));
      return;
    }
    setValue((v) => (v === "0" ? key : v + key));
  };

  const confirm = () => { if (valid) onConfirm(num); };

  const onKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirm(); return; }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.enterQuantity")} onKeyDown={onKeyDown}>
      <div className="ek-dialog qty-modal">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
            {t("kassa.enterQuantity")}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="qty-modal__body">
          <div className="qty-modal__product">
            {t("kassa.quantityFor", { name: product?.name, unit: unitLabel(product?.unit) })}
          </div>

          <input
            ref={inputRef}
            className="form-input qty-modal__input ek-num"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="0"
            aria-label={t("kassa.enterQuantity")}
          />

          {valid && product?.salePrice != null && (
            <div className="qty-modal__total ek-num">{money(total)}</div>
          )}

          <div className="qty-modal__keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="qty-modal__key"
                      onClick={() => press(k)}
                      disabled={k === "." && !decimals}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-green btn-pos" onClick={confirm} disabled={!valid}>
            <i className="fa-solid fa-check" aria-hidden="true" /> {t("kassa.confirmQty")}
            <span className="kbd">Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
