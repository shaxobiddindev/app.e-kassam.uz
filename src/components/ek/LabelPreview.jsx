import { useMemo, useRef, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { renderLabel } from "../../lib/ek-label-render";
import {
  CARD_WIDTH_MM, isCalibrated, pxPerMm, reset as resetCalibration,
  saveFromCardWidth,
} from "../../lib/ek-screen-calibration";

/* ══════════════════════════════════════════════════════════════════════════
   BITTA YORLIQ — HAQIQIY O'LCHAMDA (F3)

   ⚠ CHIZUVCHI BU YERDA YO'Q. Komponent `renderLabel` ni chaqiradi va
   natijani ekranga qo'yadi — xolos. Chop etish ham aynan o'sha
   funksiyani chaqiradi. Agar bu komponent «ekran uchun biroz
   boshqacha» chiza boshlasa, ko'rish oynasi yolg'on gapira boshlaydi
   va butun tizimning asosiy qoidasi buziladi.

   ⚠ «100% O'LCHAM» EKRAN KALIBRLASHINI TALAB QILADI: brauzer uchun
   1 dyuym = 96 CSS piksel, monitorning haqiqiy zichligi esa boshqa.
   Kalibrlanmagan ekranda «100%» taxminiy bo'ladi va buni AYTIB
   TURISH shart — aks holda do'konchi yorliq javoniga sig'adi deb
   o'ylab, 200 tasini chiqarib yuboradi.
   ══════════════════════════════════════════════════════════════════════════ */

const ZOOMS = [1, 1.5, 2, 3];

export default function LabelPreview({ template, product, ctx = {}, onCalibrated }) {
  const [zoom, setZoom] = useState(1);
  const [trueSize, setTrueSize] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [cardPx, setCardPx] = useState(() => Math.round(CARD_WIDTH_MM * pxPerMm()));
  const [tick, setTick] = useState(0);
  const boxRef = useRef(null);

  const { svg, warnings } = useMemo(() => {
    if (!template || !product) return { svg: "", warnings: [] };
    try {
      return renderLabel(template, product, ctx);
    } catch (e) {
      /* ⚠ Chizishdagi xato butun sahifani yiqitmasin: yorliq
         chizilmasa ham foydalanuvchi shablonni almashtira olishi
         kerak. */
      return { svg: "", warnings: [{ field: "-", code: "RENDER_FAIL", text: e.message }] };
    }
  }, [template, product, ctx]);

  if (!template || !product) return null;

  const perMm = pxPerMm();
  const scale = trueSize ? zoom : zoom;
  const wPx = Number(template.widthMm) * perMm * scale;
  const hPx = Number(template.heightMm) * perMm * scale;
  const calibrated = isCalibrated();

  const applyCalibration = () => {
    if (saveFromCardWidth(cardPx)) {
      setCalibrating(false);
      setTick((n) => n + 1);
      onCalibrated?.();
    }
  };

  return (
    <div className="lbl-preview" key={tick}>
      <div className="lbl-preview__bar">
        <span className="lbl-preview__size ek-num">
          {Number(template.widthMm)} × {Number(template.heightMm)} {t("lbl.mm")}
          {" · "}{template.dpi} dpi
        </span>

        <div className="lbl-preview__zoom">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              className={`btn btn-sm ${zoom === z ? "btn-primary" : "btn-outline"}`}
              onClick={() => setZoom(z)}
            >
              {z}×
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-outline btn-sm"
                onClick={() => setCalibrating((v) => !v)}>
          <i className="fa-solid fa-ruler" aria-hidden="true" /> {t("lbl.calibrate")}
        </button>
      </div>

      {/* ⚠ KALIBRLANMAGANLIGI AYTILADI. Rang yolg'iz signal emas —
          matn bilan. */}
      {!calibrated && (
        <div className="ek-note ek-note--warn">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <div>{t("lbl.notCalibrated")}</div>
        </div>
      )}

      {calibrating && (
        <div className="lbl-calib">
          <div className="form-hint">{t("lbl.calibrateHint")}</div>
          {/* Kartaning kengligi — foydalanuvchi haqiqiy kartani
              ekranga qo'yib moslaydi. */}
          <div className="lbl-calib__card" style={{ width: cardPx }}>
            <span className="ek-num">{CARD_WIDTH_MM} {t("lbl.mm")}</span>
          </div>
          <input
            type="range" min={200} max={700} value={cardPx}
            aria-label={t("lbl.calibrate")}
            onChange={(e) => setCardPx(Number(e.target.value))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={applyCalibration}>
              <i className="fa-solid fa-check" /> {t("common.save")}
            </button>
            <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => { resetCalibration(); setTick((n) => n + 1); setCalibrating(false); }}>
              {t("lbl.calibrateReset")}
            </button>
          </div>
        </div>
      )}

      <div className="lbl-preview__stage">
        {/* ⚠ `dangerouslySetInnerHTML` — SVG matn sifatida keladi.
            Manba O'ZIMIZNING renderer, tashqi kirish emas: barcha
            qiymatlar `esc()` dan o'tadi. */}
        <div
          ref={boxRef}
          className="lbl-preview__paper"
          style={{ width: wPx, height: hPx }}
          dangerouslySetInnerHTML={{ __html: sized(svg, wPx, hPx) }}
        />
      </div>

      <Warnings list={warnings} />
    </div>
  );
}

/**
 * SVG ni ekran piksellariga moslaydi.
 *
 * ⚠ FAQAT TASHQI O'LCHAM o'zgaradi, ichki `viewBox` emas — ya'ni
 * chizilgan narsa aynan o'sha, faqat kattalashtirilgan. Ichkariga
 * tegilsa, ko'rish va chop etish ajralib ketardi.
 */
function sized(svg, wPx, hPx) {
  if (!svg) return "";
  return svg.replace(/^<svg([^>]*)>/, (m, attrs) => {
    const kept = attrs.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "");
    return `<svg${kept} width="${wPx}" height="${hPx}">`;
  });
}

/**
 * SIG'MASLIK OGOHLANTIRISHI.
 *
 * ⚠ RANG YOLG'IZ SIGNAL EMAS: har bir ogohlantirishda belgi ham,
 * MATN ham bor. Rangni ajrata olmaydigan odam ham, kichik ekranda
 * ishlayotgan odam ham xabarni oladi.
 */
function Warnings({ list }) {
  if (!list?.length) {
    return (
      <div className="lbl-warn lbl-warn--ok">
        <i className="fa-solid fa-circle-check" aria-hidden="true" /> {t("lbl.fits")}
      </div>
    );
  }
  return (
    <ul className="lbl-warn lbl-warn--bad">
      {list.map((w, i) => (
        <li key={i}>
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span className="fw-700">{w.field}</span>: {w.text}
        </li>
      ))}
    </ul>
  );
}
