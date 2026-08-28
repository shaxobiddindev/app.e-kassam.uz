import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import { NumField } from "./ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   QATOR NARXINI TUSHIRISH (V48)

   ⚠ KASSIR NARX BILAN O'YLAYDI, chegirma bilan emas. «Bu yog'ni 22 mingga
   berdim» — u shunday aytadi, «2 ming chegirma qildim» deb emas. Shuning
   uchun kiritiladigan narsa YANGI NARX; chegirma summasi undan o'zi
   hisoblanadi va serverga o'sha yuboriladi.

   ⚠ NARXNI OSHIRIB BO'LMAYDI. Server ham manfiy chegirmani rad etadi,
   lekin kassir buni tugmani bosishdan OLDIN bilishi kerak. Narxni
   oshirish kerak bo'lsa — bu boshqa tovar yoki boshqa narx, uni
   katalogda o'zgartirish kerak.

   ⚠ Do'kon chegarasi (`maxDiscountPercent`) SERVERDA tekshiriladi va
   oshsa bajik so'raladi — bu yerda takrorlanmaydi: ikki joyda ikki xil
   chegara bo'lib qolishi mumkin edi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function LinePriceModal({ item, onClose, onApply }) {
  const base = Number(item?.salePrice) || 0;
  const qty = Number(item?.qty) || 0;
  const current = base - (Number(item?.discount) || 0) / (qty || 1);
  const [price, setPrice] = useState(String(Math.round(current)));

  const num = Number(String(price).replace(/\D/g, "")) || 0;
  const tooHigh = num > base;
  const ok = num > 0 && !tooHigh;
  /* Chegirma — QATOR bo'yicha jami summa (server aynan shuni kutadi). */
  const discount = ok ? Math.max(0, Math.round((base - num) * qty * 100) / 100) : 0;

  return (
    <div className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.linePrice")}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ek-dialog qty-modal">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-tag" aria-hidden="true" /> {t("kassa.linePrice")}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="qty-modal__body">
          <div className="qty-modal__product">{item?.name}</div>
          <div className="qty-modal__stock">
            {t("kassa.listPrice")}: <b className="mono">{money(base)}</b>
            {qty > 1 && <> · {fmtQty(qty, item?.unitDecimals)} {unitLabel(item?.unit)}</>}
          </div>

          <NumField kind="money" autoFocus
                    className="form-input qty-modal__input ek-num"
                    value={price} onChange={(e) => setPrice(e.target.value)} />

          {/* ⚠ NATIJA DARHOL KO'RINADI: kassir mijozga aytadigan raqam —
              qatorning yangi jamisi, chegirma esa uning izohi. */}
          <div className={`qty-modal__total ${tooHigh ? "is-over" : ""}`}>
            {tooHigh
              ? t("kassa.priceTooHigh")
              : <>{money(num * qty)}{discount > 0 && <> · −{money(discount)}</>}</>}
          </div>

          <div className="qty-modal__keys">
            <button type="button" className="btn btn-outline qty-modal__clear"
                    onClick={() => setPrice(String(Math.round(base)))}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true" /> {t("kassa.resetPrice")}
            </button>
            {["1","2","3","4","5","6","7","8","9","000","0","⌫"].map((k) => (
              <button key={k} type="button" className="qty-modal__key"
                      onClick={() => setPrice((v) => (k === "⌫"
                        ? String(v).slice(0, -1)
                        : (String(v) + k).replace(/^0+(?=\d)/, "").slice(0, 12)))}>
                {k === "⌫" ? <i className="fa-solid fa-delete-left" aria-hidden="true" /> : k}
              </button>
            ))}
          </div>
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline qty-modal__cancel" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!ok}
                  onClick={() => onApply(discount)}>
            <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
