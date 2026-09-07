import { useState, useEffect, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { unitLabel } from "../lib/ek-labels";
import { money, quantity as fmtQty } from "../utils";
import { NumField } from "./ek/EkFields";
import Overlay from "./ek/Overlay";
import { MODE_QTY, MODE_SUM, qtyFromSum, switchMode } from "../lib/ek-qty-sum";
import { subscribe as scaleSubscribe, resume as scaleResume } from "../lib/ek-scale-live";

/* ══════════════════════════════════════════════════════════════════════════
   Miqdor kiritish — FAQAT bo'linadigan birliklar uchun (kg, litr, metr).

   NEGA ALOHIDA OYNA: donalab sotiladigan tovarda "+" tugmasi yetarli, ammo
   0.350 kg ni "+" bilan yig'ib bo'lmaydi. Tarozi barkodi bo'lsa miqdor
   avtomatik keladi va bu oyna FAQAT TASDIQLASH uchun ochiladi — chunki
   tarozi formati do'kondan do'konga farq qiladi va noto'g'ri o'qilgan
   og'irlik jimgina chekka tushib qolmasligi kerak.

   ═══ MIQDOR YOKI SUMMA (V104) ══════════════════════════════════════════

   Do'kon egasi: «pulini yozsa miqdorini o'zi qo'yib savatga qo'shsin».
   Mijoz go'shtni «yarim kilo» deb emas, «50 minglik» deb so'raydi —
   ilgari bu hisobni kassir kalkulyatorda yoki boshida qilardi.

   Ikki rejim bitta oynada: yozilayotgan raqamning MA'NOSI o'zgaradi,
   oyna emas. Tasdiqlanganda esa baribir MIQDOR chiqadi — `onConfirm`
   ning shartnomasi o'zgarmagan va Kassa sahifasi bu tanlovni umuman
   bilmaydi. Hisob-kitob `lib/ek-qty-sum.js` da, sinovlari bilan.

   Klaviatura: raqamlar, nuqta, Enter (tasdiq), Esc (bekor), Delete
   (tozalash) — sichqonchasiz ham ishlaydi.
   ══════════════════════════════════════════════════════════════════════════ */


export default function QuantityModal({ product, initial, stock: stockProp, onConfirm, onClose }) {
  const decimals = product?.unitDecimals ?? 3;
  const boxRef = useRef(null);

  const [value, setValue] = useState(
    initial != null ? String(Number(initial)) : ""
  );
  /* ⚠ HAR DOIM MIQDORDAN boshlanadi. Tarozi barkodi bilan kelgan
     `initial` — og'irlik; summa rejimida ochilsa u jimgina pulga
     aylanib qolardi. */
  const [mode, setMode] = useState(MODE_QTY);
  const inputRef = useRef(null);

  /* ══ TAROZIDAN JONLI OG'IRLIK (V111) ═══════════════════════════════
     Do'kon egasi: «tarozi sticker chiqarmaydi, kassa bilan aloqa
     qilishi kerak».

     ⚠ MAYDONGA O'ZI YOZILMAYDI. Og'irlik tugmada ko'rinadi va
     kassir uni BOSIB oladi. Sabab shu oynaning boshidagi qoida bilan
     bir xil: noto'g'ri o'qilgan og'irlik jimgina chekka tushib
     qolmasligi kerak. Tarozida boshqa tovar turgan bo'lishi ham
     mumkin — ekranda ikkalasi ham ko'rinadi va tanlovni kassir
     qiladi. */
  const [scale, setScale] = useState(null);
  useEffect(() => {
    /* Ilgari ruxsat berilgan port — oynasiz ochiladi. */
    scaleResume();
    return scaleSubscribe((st) => setScale(st.on ? st : null));
  }, []);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const price = Number(product?.salePrice);
  /* Narxsiz tovarda summadan miqdor chiqarib bo'lmaydi (nolga bo'lish):
     tanlov umuman ko'rsatilmaydi — o'chiq tugma savol tug'dirardi. */
  const hasPrice = Number.isFinite(price) && price > 0;
  const sumMode = mode === MODE_SUM && hasPrice;

  const num = Number(value.replace(",", "."));
  /* ⚠ SAVATGA TUSHADIGAN YAGONA SON. Summa rejimida u kiritilgan
     puldan chiqariladi va PASTGA yaxlitlanadi — chek mijoz aytgan
     puldan oshmasligi kerak (`ek-qty-sum.js`). */
  const qtyNum = sumMode ? qtyFromSum(num, price, decimals) : num;
  const valid = Number.isFinite(qtyNum) && qtyNum > 0;
  /* Haqiqiy summa — AYNAN shu miqdor uchun. Kiritilgan puldan bir oz
     kam bo'lishi mumkin va kassir buni tasdiqlashdan OLDIN ko'radi. */
  const total = valid && hasPrice ? qtyNum * price : 0;

  /* ⚠ Rejim almashganda maydon TOZALANMAYDI, O'GIRILADI: 0.5 kg →
     6 750 so'm. Savatga tushadigan narsa o'zgarmaydi, faqat savol
     o'zgaradi. Tozalab yuborish kassirni qaytadan yozishga majbur
     qilardi. */
  const changeMode = (next) => {
    if (next === mode) return;
    setValue((v) => switchMode(v, next, price, decimals));
    setMode(next);
    inputRef.current?.focus();
  };

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
  const over = stock != null && valid && qtyNum > stock;

  /* Butun maydonni tozalash. ⌫ bilan 6 xonali xato miqdorni o'chirish
     olti bosish — mijoz oldida bu uzoq. */
  const clearAll = () => { setValue(""); inputRef.current?.focus(); };

  const confirm = () => { if (valid) onConfirm(qtyNum); };

  /* ⚠ Tinglovchi HUJJATDA, oyna elementida emas. Ilgari `onKeyDown` shu
     `div` da turardi va faqat fokus oyna ICHIDA bo'lgandagina ishlardi:
     kassir raqam tugmasini bosgach fokus tugmaga o'tar, keyin sichqoncha
     bilan fon bosilsa esa umuman yo'qolardi — Esc javob bermay qolardi.
     Endi oyna ochiq ekan, tugmalar fokusdan qat'i nazar ishlaydi.

     `capture` bosqichida: Kassa sahifasining o'z yorliqlari ham `window`
     da turibdi va Esc ni savatni tozalash so'roviga olib ketishi mumkin. */
  useEffect(() => {
    const onKey = (e) => {
      /* ⚠ Faqat ENG USTIDAGI oyna javob beradi. `Overlay` ustki qatlamga
         `data-ek-top` qo'yadi; bu oyna boshqasining ostida qolgan bo'lsa
         Enter uning tugmasini bosib yuborardi. Esc ni esa `Overlay` ning
         o'zi hal qiladi — pastdagi oynalarga o'tkazmaydi. */
      if (!boxRef.current?.closest("[data-ek-top]")) return;
      if (e.key === "Enter")  { e.preventDefault(); e.stopPropagation(); if (valid) onConfirm(qtyNum); return; }
      if (e.key === "Delete") { e.preventDefault(); clearAll(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });   // har renderda yangilanadi — `valid`/`qtyNum` yangi bo'lishi shart

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("kassa.enterQuantity")} onEscape={onClose}>
      <div className="ek-dialog qty-modal" ref={boxRef}>
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

          {/* ⚠ TANLOV MAYDONDAN YUQORIDA (V104): kassir avval NIMA
              yozishini biladi, keyin yozadi. Pastga qo'yilsa raqam
              terilgandan keyin ma'nosi o'zgarardi.

              Narxsiz tovarda umuman chizilmaydi — summadan miqdor
              chiqarish uchun narx kerak. Bu oynaning balandligini
              o'zgartiradi, lekin FAQAT ochilishda: bir oyna ichida
              tugmalar sakramaydi va maydon joyida qoladi. */}
          {hasPrice && (
            <div className="qty-modal__mode" role="group" aria-label={t("kassa.entryMode")}>
              <button type="button"
                      className={`qty-modal__mode-btn${sumMode ? "" : " is-on"}`}
                      aria-pressed={!sumMode}
                      onClick={() => changeMode(MODE_QTY)}>
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                {t("kassa.byQty")}
              </button>
              <button type="button"
                      className={`qty-modal__mode-btn${sumMode ? " is-on" : ""}`}
                      aria-pressed={sumMode}
                      onClick={() => changeMode(MODE_SUM)}>
                <i className="fa-solid fa-money-bill-wave" aria-hidden="true" />
                {t("kassa.bySum")}
              </button>
            </div>
          )}

          <NumField
            ref={inputRef}
            /* ⚠ TUR REJIMGA QARAB. Summa rejimida `unit` BERILMAYDI:
               u maydonni tovarning kasr xonalariga qamrardi va DONA
               tovarga summa yozib bo'lmay qolardi — pul birligining
               kasr xonalari tovarnikiga aloqasiz. */
            kind={sumMode ? "money" : "qty"}
            /* ⚠ BIRLIK BERILADI. Ilgari maydon `kind="qty"` ning uch
               kasr xonasini olardi va DONA tovarga ham `0.6` yozib
               bo'lardi: klaviaturadagi «.» o'chirilgan bo'lsa-da,
               matn maydoniga qo'lda yozish ochiq qolgan edi. */
            unit={sumMode ? undefined : product?.unit}
            className="form-input qty-modal__input ek-num"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            aria-label={sumMode ? t("kassa.enterSum") : t("kassa.enterQuantity")}
          />

          {/* ⚠ TAROZI TUGMASI FAQAT ULANGANDA (V111). Ulanmagan
              do'konda o'chiq tugma turgani kassirni «nega
              ishlamayapti?» degan savolga olib borardi — holbuki
              tarozi umuman yo'q. */}
          {scale?.kg > 0 && !sumMode && (
            <button type="button" className="btn btn-outline qty-modal__scale"
                    onClick={() => setValue(String(scale.kg))}>
              <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
              <span className="ek-num">{fmtQty(scale.kg, decimals)} {unitLabel(product?.unit)}</span>
              {/* Tarozi hali tebranayotgan bo'lsa — belgisi bilan:
                  kassir barqarorlashishini kutadi. */}
              <span className={scale.stable ? "text-success" : "text-muted"} style={{ fontSize: 11 }}>
                {scale.stable ? t("scale.steady") : t("scale.moving")}
              </span>
            </button>
          )}

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
            {valid && hasPrice
              /* ⚠ SUMMA REJIMIDA IKKALASI HAM YOZILADI. Kassirga kerakli
                 javob — «qancha tortay?» (miqdor), do'kon egasiga kerakli
                 javob — «chekka qancha tushadi?» (summa). Ikkinchisi
                 kiritilgan puldan bir oz KAM bo'lishi mumkin (pastga
                 yaxlitlash) va uni yashirib qo'yish kassirni mijoz oldida
                 «50 ming dedingiz-ku?» degan savolga tayyorlanmagan
                 holda qoldirardi. */
              ? (sumMode
                  ? `${fmtQty(qtyNum, decimals)} ${unitLabel(product?.unit)} = ${money(total)}`
                  : money(total))
              /* ⚠ BO'SH QOLDIRILMAYDI. Joyni ushlab turish uchun bo'sh
                 qatorni qoldirish oynada tushunarsiz teshik hosil
                 qilardi — «bu yerda nimadir bo'lishi kerakmi?». Endi
                 o'sha joyda birlik narxi turadi: kassir uni baribir
                 bilishi kerak va qator balandligi o'zgarmaydi.

                 Summa rejimida bu qator yana bir ish bajaradi: pul bir
                 birlikka ham yetmagan bo'lsa (miqdor 0), aynan shu
                 narx SABABNI aytib turadi. */
              : (hasPrice
                  ? `1 ${unitLabel(product?.unit)} = ${money(price)}`
                  : "")}
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
    </Overlay>
  );
}
