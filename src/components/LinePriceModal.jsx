import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import { NumField } from "./ek/EkFields";
import Overlay from "./ek/Overlay";
import {
  lineBase, lineQty, lineFloor, initialPrice, wholesaleOffer,
  quickPrices, priceVerdict, priceDiscount, lossDiscount, lineNetTotal, parsePrice,
} from "../lib/ek-line-price";

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

   ⚠ HISOB BU YERDA EMAS (V97). U `lib/ek-line-price.js` da va u yerda
   sinaladi: ilgari hisob shu faylda, JSX bilan aralash turgani uchun
   uchta pul xatosi uzoq vaqt sezilmay yotdi. Bu fayl endi faqat
   chizadi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function LinePriceModal({ item, onClose, onApply }) {
  const base = lineBase(item);
  const qty = lineQty(item);
  const [price, setPrice] = useState(String(initialPrice(item)));

  const num = parsePrice(price);

  const minPrice = lineFloor(item);
  const hasLimit = minPrice != null && minPrice < base;

  const verdict = priceVerdict(item, num);
  const tooHigh = verdict === "high";
  const tooLow  = verdict === "low";
  const ok = verdict === "ok";

  /* Chegirma — QATOR bo'yicha jami summa (server aynan shuni kutadi). */
  const discount = priceDiscount(item, num);

  /* ⚠ OPTOM NARX — EGASI RUXSAT BERGAN NARX (V97). Kassir uni qo'lda
     terib o'tirmasin: mijoz oldida har soniya sanaladi va qo'lda
     terilgan raqamda xato ham bo'ladi. */
  const wholesale = wholesaleOffer(item);

  /* Yaxlit narx tugmalari — eng past narxdan e'lon narxigacha.
     ⚠ Kassir raqam yozmasdan bosadi: mijoz oldida har soniya sanaladi. */
  const quick = quickPrices(item).filter((v) => v !== wholesale);

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.linePrice")}
         onEscape={onClose}
         /* ⚠ Orqa fonga bosish YOPMAYDI (V72): sensor ekranda barmoq
            chetga tasodifan tegishi oddiy hol va yarim yozilgan narx
            yo'qolib ketardi. Chiqish — ✕, «Bekor qilish» va ESC. */>
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

          {/* ⚠ `decimals={0}` — PUL BUTUN SO'M (V80). Ilgari bu yerda
              maydonning odatiy ikki kasr xonasi turardi va nuqta
              yozilsa narx 10 baravar o'qilardi (`parsePrice` izohiga
              qarang). Endi nuqtani yozib bo'lmaydi. */}
          <NumField kind="money" decimals={0} autoFocus
                    className="form-input qty-modal__input ek-num"
                    value={price} onChange={(e) => setPrice(e.target.value)} />

          {/* ⚠ NATIJA DARHOL KO'RINADI: kassir mijozga aytadigan raqam —
              qatorning yangi jamisi, chegirma esa uning izohi.

              ⚠ JAMI `narx × miqdor` EMAS, chegirmadan keyingi HAQIQIY
              jami: chekka aynan shu son tushadi. Ikkisi kasrli
              miqdorda bir-biridan farq qilishi mumkin edi. */}
          <div className={`qty-modal__total ${tooHigh || tooLow ? "is-over" : ""}`}>
            {tooHigh ? t("kassa.priceTooHigh")
              : tooLow ? `${t("kassa.priceTooLow")}: ${money(minPrice)}`
              : <>{money(lineNetTotal(item, num))}{discount > 0 && <> · −{money(discount)}</>}</>}
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

          {/* ⚠ OPTOM NARX ALOHIDA VA NOMI BILAN, yaxlit tugmalar orasiga
              qorishmaydi: kassir «21 000» degan yalang'och raqamdan uning
              nima ekanini bilolmasdi. */}
          {wholesale != null && (
            <button type="button"
                    className={`line-wholesale ${num === wholesale ? "is-on" : ""}`}
                    onClick={() => setPrice(String(wholesale))}>
              <span>
                <i className="fa-solid fa-boxes-stacked" aria-hidden="true" />{" "}
                {t("products.wholesalePrice")}
              </span>
              <b className="ek-num">{money(wholesale)}</b>
            </button>
          )}

          {quick.length > 0 && (
            <div className="line-quick">
              {quick.map((v) => (
                <button key={v} type="button"
                        className={`line-quick__btn ${num === v ? "is-on" : ""}`}
                        onClick={() => setPrice(String(v))}>
                  {money(v)}
                </button>
              ))}
            </div>
          )}

          {/* ══ ZARARGA SOTISH — FAQAT BAJIK BILAN (do'kon egasi, 2026-09-09) ══

              ⚠ NEGA KERAK EDI. Chegaradan past narx yozilganda «Saqlash»
              shunchaki O'CHIQ qolardi: kassir sababni ko'rardi-yu, yo'lni
              ko'rmasdi. Ya'ni rahbar ruxsat bermoqchi bo'lsa ham, uni
              kassadan berib bo'lmasdi — narxni katalogda o'zgartirishdan
              boshqa chora yo'q edi.

              ⚠ RUXSATNI BU YER BERMAYDI. Tugma faqat qatorga narxni
              qo'yadi; zararni SERVER aniqlaydi va `SALE_BELOW_COST`
              amali uchun bajik so'raydi (`Discounts.decide`). Ya'ni
              chegara joyida qoladi — o'zgargani shuki, endi unga
              BORISH mumkin.

              ⚠ BAJIK CHEK YOPILAYOTGANDA SO'RALADI, shu yerda emas —
              server qoidasi shunday: bitta chek uchun ikki marta
              skanerlash marosimga aylanib, himoya ma'nosini yo'qotardi.
              Shuning uchun tugma ostida NIMA BO'LISHI yozib qo'yiladi:
              kassir rahbarni oldindan chaqira olsin.

              ⚠ FAQAT «past» HOLATDA. Narxni OSHIRISHGA bu yo'l ochilmaydi:
              u zarar emas, boshqa tovar yoki boshqa narx demakdir. */}
          {tooLow && (
            <button type="button" className="btn btn-outline line-loss"
                    onClick={() => onApply(lossDiscount(item, num))}>
              <span>
                <i className="fa-solid fa-arrow-trend-down" aria-hidden="true" />{" "}
                {t("kassa.sellAtLoss")}
              </span>
              <small>{t("kassa.sellAtLossHint")}</small>
            </button>
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
