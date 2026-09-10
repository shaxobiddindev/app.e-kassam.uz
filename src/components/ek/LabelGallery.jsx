import { useMemo } from "react";
import { t } from "../../lib/ek-i18n";
import { renderLabel } from "../../lib/ek-label-render";
import { templateName } from "../../lib/ek-label-name";
import { fitOf, hasInk } from "../../lib/ek-label-fit";

/* ══════════════════════════════════════════════════════════════════════════
   DIZAYN GALEREYASI (G5) — «DIZAYNLAR KO'RINMAYAPTI» SHU YERDA TUGAYDI

   ⚠ O'LCHOV NIMA KO'RSATGANI (G0). Chizish yo'lida hech narsa
   buzilmagan edi: 15 ta shablonning hammasi haqiqiy mazmun
   chizadi, SVG DOM ga tushadi, o'lchami to'g'ri. Muammo boshqa
   edi — dizaynlarni KO'RIB CHIQIB BO'LMASDI: bitta ochiladigan
   ro'yxat, faqat nomlar, bir vaqtda bitta dizayn. 15 tasini ko'rish
   uchun 15 marta tanlash kerak edi.

   ⚠ KARTOCHKADAGI RASM — HAQIQIY RENDERER CHIZGANI. Ikonka emas,
   skrinshot emas, «namuna rasm» emas. Aynan chiqadigan narsa.
   Bu — «yagona renderer» qoidasining o'zi: agar renderer buzilsa,
   galereya ham DARHOL buziladi va buni ko'rish uchun chop etish
   shart emas.

   ⚠ MOS KELMAYDIGAN SHABLON YASHIRILMAYDI. 58×40 uchun chizilgan
   dizayn 30×20 rulonda ishlamaydi, lekin uni ro'yxatdan olib
   tashlash do'konchini «qayerga ketdi?» degan holatda qoldirardi.
   U ko'rinadi, ustida esa nima mos kelmagani yozilgan.
   ══════════════════════════════════════════════════════════════════════════ */

/** Kartochkadagi rasm balandligi (px) — barcha kartochkalar bir xil. */
const CARD_H = 96;

export default function LabelGallery({
  templates = [], product, media = null, selectedId = null, onPick, onOpen,
}) {
  const cards = useMemo(() => templates.map((tpl) => {
    let svg = "";
    let failed = null;
    let blank = null;
    try {
      /* ⚠ HAQIQIY TOVAR MA'LUMOTI bilan: «Lorem ipsum» da hamma
         narsa chiroyli sig'adi, muammo esa haqiqiy nomlarda
         chiqadi. */
      const out = product ? renderLabel(tpl, product, {}) : { svg: "", warnings: [] };
      svg = out.svg;

      /* ⚠ BO'SH KARTOCHKA SABABINI AYTADI. Yorliq faqat barkoddan
         iborat bo'lib, barkod chizilmasa (masalan tovarning
         nazorat raqami buzuq va Code 128 yorliqqa sig'masa),
         kartochka BO'M-BO'SH chiqardi — ya'ni aynan «dizayn
         ko'rinmayapti» holati, endi kichkina ko'rinishda. */
      if (!hasInk(svg) && out.warnings?.length) blank = out.warnings[0].text;
    } catch (e) {
      /* ⚠ BITTA BUZUQ SHABLON GALEREYANI YIQITMASIN: qolganlarini
         ko'rish imkoniyati saqlanadi, buzug'i esa aytiladi. */
      failed = e.message;
    }
    return { tpl, svg, failed, blank, fit: fitOf(tpl, media) };
  }), [templates, product, media]);

  if (!templates.length) return null;

  return (
    <div className="lbl-gallery">
      {cards.map(({ tpl, svg, failed, blank, fit }) => {
        const on = tpl.id === selectedId;
        return (
          <button
            key={tpl.id}
            type="button"
            className={`lbl-card ${on ? "is-on" : ""}`}
            aria-pressed={on}
            onClick={() => (on ? onOpen?.(tpl) : onPick?.(tpl))}
            onDoubleClick={() => onOpen?.(tpl)}
          >
            <div className="lbl-card__art">
              {failed
                ? <span className="form-hint form-hint--warn">{failed}</span>
                /* eslint-disable-next-line react/no-danger */
                : <div className="lbl-card__svg" dangerouslySetInnerHTML={{ __html: svg }} />}
            </div>

            <div className="lbl-card__name">{templateName(tpl)}</div>
            <div className="lbl-card__meta ek-num">
              {Number(tpl.widthMm)}×{Number(tpl.heightMm)} mm
            </div>

            {/* ⚠ RANG YOLG'IZ SIGNAL EMAS: belgi va MATN ham bor. */}
            {on && (
              <div className="lbl-card__on">
                <i className="fa-solid fa-circle-check" /> {t("lbl.chosen")}
              </div>
            )}

            {blank && (
              <div className="lbl-card__warn">
                <i className="fa-solid fa-triangle-exclamation" /> {blank}
              </div>
            )}

            {fit && (
              <div className="lbl-card__warn">
                {/* ⚠ XABAR IKKALA SONNI HAM AYTADI: «mos emas» degan
                    xabar do'konchini taxmin qilishga majbur qilardi —
                    nimasi mos emas, qaysi biri katta? */}
                <i className="fa-solid fa-triangle-exclamation" />{" "}
                {t("lbl.fitMismatch", { ...fit, mh: fit.mh ?? "?" })}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
