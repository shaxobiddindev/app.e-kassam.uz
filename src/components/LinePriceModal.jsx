import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import { NumField } from "./ek/EkFields";
import Overlay from "./ek/Overlay";

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

  /* ⚠ ENG PAST NARXNI SERVER BERADI (`ProductResponse.minPrice`).
     Front uni O'ZI hisoblamaydi va bu ataylab: hisobda tovar foizi,
     do'kon foizi va kassirning shaxsiy chegarasi qatnashadi, ya'ni
     formula ikki joyda yozilsa ular ajralib ketishi va kassir
     «ekranda ruxsat edi, saqlaganda rad etildi» degan holatga
     tushishi mumkin edi. Eski serverda maydon yo'q — bunda chegara
     ko'rsatilmaydi va tekshiruv faqat serverda qoladi. */
  const minPrice = item?.minPrice == null ? null : Math.ceil(Number(item.minPrice));
  const hasLimit = minPrice != null && Number.isFinite(minPrice) && minPrice < base;

  const tooHigh = num > base;
  const tooLow  = minPrice != null && num > 0 && num < minPrice;
  const ok = num > 0 && !tooHigh && !tooLow;
  /* Chegirma — QATOR bo'yicha jami summa (server aynan shuni kutadi). */
  const discount = ok ? Math.max(0, Math.round((base - num) * qty * 100) / 100) : 0;

  /* Yaxlit narx tugmalari — eng past narxdan e'lon narxigacha.
     ⚠ Kassir raqam yozmasdan bosadi: mijoz oldida har soniya sanaladi. */
  const quickPrices = (() => {
    if (!hasLimit) return [];
    const step = base >= 100000 ? 5000 : base >= 20000 ? 1000 : 500;
    const out = [];
    for (let v = Math.floor(base / step) * step; v >= minPrice && out.length < 4; v -= step) {
      if (v < base && v > 0) out.push(v);
    }
    return out;
  })();

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.linePrice")}
         onEscape={onClose}
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
          <div className={`qty-modal__total ${tooHigh || tooLow ? "is-over" : ""}`}>
            {tooHigh ? t("kassa.priceTooHigh")
              : tooLow ? `${t("kassa.priceTooLow")}: ${money(minPrice)}`
              : <>{money(num * qty)}{discount > 0 && <> · −{money(discount)}</>}</>}
          </div>

          {/* ⚠ CHEGARA HAR DOIM KO'RINADI, xato bo'lganda emas. Kassir
              narxni AYTISHDAN oldin bilishi kerak: mijozga «22 mingga
              beraman» deb aytib, keyin «bo'lmadi» deyish — do'kon
              uchun eng noqulay holat. */}
          {hasLimit && (
            <div className="line-limit">
              <span>
                <i className="fa-solid fa-arrow-down-short-wide" aria-hidden="true" />{" "}
                {t("kassa.lowestPrice")}
              </span>
              <b className="ek-num">{money(minPrice)}</b>
            </div>
          )}

          {quickPrices.length > 0 && (
            <div className="line-quick">
              {quickPrices.map((v) => (
                <button key={v} type="button"
                        className={`line-quick__btn ${num === v ? "is-on" : ""}`}
                        onClick={() => setPrice(String(v))}>
                  {money(v)}
                </button>
              ))}
            </div>
          )}

          <div className="qty-modal__reset">
            <button type="button" className="btn btn-outline qty-modal__clear"
                    onClick={() => setPrice(String(Math.round(base)))}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true" /> {t("kassa.resetPrice")}
            </button>
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
    </Overlay>
  );
}
