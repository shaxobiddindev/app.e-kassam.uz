import { useState, useEffect, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { unitLabel } from "../lib/ek-labels";
import { money, quantity as fmtQty } from "../utils";
import { NumField } from "./ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   Miqdor kiritish — FAQAT bo'linadigan birliklar uchun (kg, litr, metr).

   NEGA ALOHIDA OYNA: donalab sotiladigan tovarda "+" tugmasi yetarli, ammo
   0.350 kg ni "+" bilan yig'ib bo'lmaydi. Tarozi barkodi bo'lsa miqdor
   avtomatik keladi va bu oyna FAQAT TASDIQLASH uchun ochiladi — chunki
   tarozi formati do'kondan do'konga farq qiladi va noto'g'ri o'qilgan
   og'irlik jimgina chekka tushib qolmasligi kerak.

   Klaviatura: raqamlar, nuqta, Enter (tasdiq), Esc (bekor), Delete
   (tozalash). Sichqonchasiz ham, sensorli ekranda ham ishlaydi —
   tugmalar 56px (CLAUDE.md #3).
   ══════════════════════════════════════════════════════════════════════════ */

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

export default function QuantityModal({ product, initial, stock: stockProp, onConfirm, onClose }) {
  const decimals = product?.unitDecimals ?? 3;
  const [value, setValue] = useState(
    initial != null ? String(Number(initial)) : ""
  );
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const num = Number(value.replace(",", "."));
  const valid = Number.isFinite(num) && num > 0;
  const total = valid && product?.salePrice != null ? num * product.salePrice : 0;

  /* Ombor qoldig'i. `null` — xizmat yoki ombor yuritilmaydigan tovar:
     bunda qoldiq tushunchasi yo'q va hech narsa ko'rsatilmaydi.

     ⚠ `stock` proplari ustun: Kassa boshqa ochiq savatlarda band bo'lgan
     miqdorni ayirib beradi va oynadagi raqam tasdiqlashdagi tekshiruv
     bilan bir xil bo'lishi kerak. */
  const stock = stockProp != null
    ? Number(stockProp)
    : (product?.stockQuantity != null ? Number(product.stockQuantity) : null);
  const stockText = stock != null
    ? `${fmtQty(stock, product?.unitDecimals)} ${unitLabel(product?.unit)}`
    : null;
  const over = stock != null && valid && num > stock;

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

  /* Butun maydonni tozalash. ⌫ bilan 6 xonali xato miqdorni o'chirish
     olti bosish — mijoz oldida bu uzoq. */
  const clearAll = () => { setValue(""); inputRef.current?.focus(); };

  const confirm = () => { if (valid) onConfirm(num); };

  /* ⚠ Tinglovchi HUJJATDA, oyna elementida emas. Ilgari `onKeyDown` shu
     `div` da turardi va faqat fokus oyna ICHIDA bo'lgandagina ishlardi:
     kassir raqam tugmasini bosgach fokus tugmaga o'tar, keyin sichqoncha
     bilan fon bosilsa esa umuman yo'qolardi — Esc javob bermay qolardi.
     Endi oyna ochiq ekan, tugmalar fokusdan qat'i nazar ishlaydi.

     `capture` bosqichida: Kassa sahifasining o'z yorliqlari ham `window`
     da turibdi va Esc ni savatni tozalash so'roviga olib ketishi mumkin. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === "Enter")  { e.preventDefault(); e.stopPropagation(); if (valid) onConfirm(num); return; }
      if (e.key === "Delete") { e.preventDefault(); clearAll(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });   // har renderda yangilanadi — `valid`/`num` yangi bo'lishi shart

  return (
    <div className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.enterQuantity")}>
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

          {/* ⚠ QOLDIQ SHU YERDA. Ilgari kassir «omborda nechta bor?» degan
              savolga javob olish uchun oynani yopib, tovar katakchasiga
              qarab, keyin qaytadan ochishga majbur edi. Endi raqam
              kiritilayotgan joyning o'zida turadi.

              Qoldiqdan oshib ketsa qizarib, sababi yoziladi — xato
              «Tasdiqlash» dan KEYIN emas, oldin ko'rinadi. */}
          {stockText && (
            <div className={`qty-modal__stock ek-num ${over ? "is-over" : ""}`}>
              <i className={`fa-solid ${over ? "fa-triangle-exclamation" : "fa-boxes-stacked"}`} aria-hidden="true" />
              {over ? t("kassa.overStock", { qty: stockText }) : t("kassa.inStock", { qty: stockText })}
            </div>
          )}

          <NumField
            ref={inputRef}
            kind="qty"
            /* ⚠ BIRLIK BERILADI. Ilgari maydon `kind="qty"` ning uch
               kasr xonasini olardi va DONA tovarga ham `0.6` yozib
               bo'lardi: klaviaturadagi «.» o'chirilgan bo'lsa-da,
               matn maydoniga qo'lda yozish ochiq qolgan edi. */
            unit={product?.unit}
            className="form-input qty-modal__input ek-num"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            aria-label={t("kassa.enterQuantity")}
          />

          {/* ⚠ QATOR HAR DOIM TURADI, faqat MATNI paydo bo'ladi.

              Ilgari butun qator shartli edi: miqdor kiritilgan zahoti u
              yo'qdan bor bo'lib, ostidagi raqamli klaviaturani ~30px
              pastga surardi. Kassir «7» ni mo'ljallab bosgan barmog'i
              tugmalar surilgach «4» ga tushishi mumkin edi — sotuvda
              bunday xato jimgina noto'g'ri miqdorga aylanadi.

              Klaviatura hech qachon surilmasligi kerak. Shuning uchun
              bo'sh holatda ham element chizilaveradi va balandligini
              ushlab turadi (`min-height` — `styles.css`).

              `aria-live` bilan ekran o'quvchi summa o'zgarganini aytadi,
              chunki endi element «paydo bo'lish» hodisasi bermaydi. */}
          <div className={`qty-modal__total ek-num ${valid ? "" : "is-hint"}`} aria-live="polite">
            {valid && product?.salePrice != null
              ? money(total)
              /* ⚠ BO'SH QOLDIRILMAYDI. Joyni ushlab turish uchun bo'sh
                 qatorni qoldirish oynada tushunarsiz teshik hosil
                 qilardi — «bu yerda nimadir bo'lishi kerakmi?». Endi
                 o'sha joyda birlik narxi turadi: kassir uni baribir
                 bilishi kerak va qator balandligi o'zgarmaydi. */
              : (product?.salePrice != null
                  ? `1 ${unitLabel(product?.unit)} = ${money(product.salePrice)}`
                  : "")}
          </div>

          <div className="qty-modal__keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="qty-modal__key"
                      onClick={() => press(k)}
                      disabled={k === "." && !decimals}>
                {k}
              </button>
            ))}
            {/* Kalkulyatordagi «C» — butun qiymatni bir bosishda tozalaydi.
                Raqamlar joyi O'ZGARMADI: kassirning barmog'i 7-8-9 ni
                yod biladi va ularni surish yangi xatolar tug'dirardi. */}
            <button type="button" className="qty-modal__key qty-modal__clear"
                    onClick={clearAll}
                    aria-label={t("kassa.clearInput")}>
              C
              <span className="kbd">Del</span>
            </button>
          </div>
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline qty-modal__cancel" onClick={onClose}>
            {t("common.cancel")}
            <span className="kbd">Esc</span>
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
