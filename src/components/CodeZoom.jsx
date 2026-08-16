import { useEffect } from "react";
import { qrSvg } from "../lib/ek-qr";
import { code128Svg } from "../lib/ek-barcode";
import { maxBrightness, restoreBrightness } from "../lib/ek-brightness";

/* ══════════════════════════════════════════════════════════════════════════
   KODNI KATTALASHTIRISH — kassada ko'rsatish uchun

   Kartada QR ham, shtrix ham yonma-yon turadi (ikki xil skaner uchun).
   Ular kichkina va telefon xira bo'lsa skaner ololmaydi. Kodning ustiga
   bosilganda AYNAN O'SHA bittasi butun ekranga, oq fonda va maksimal
   yorug'likda chiziladi.

   Yopish uchun UCH yo'l — mijoz qaysi birini o'ylasa, o'sha ishlaydi:
   bo'sh joyga bosish · ✕ tugmasi · Escape.

   ⚠ OQ FON QATTIQ KODLANGAN (tokendan emas): qorong'i temada teskari
   rangdagi kodni skanerlarning ko'pi umuman o'qimaydi.

   ⚠ Yorug'lik oyna darajasida (`ek-brightness.js`) — qurilma sozlamasi
   tegilmaydi va yopilganda tiklanadi.
   ══════════════════════════════════════════════════════════════════════════ */

export default function CodeZoom({ kind = "qr", value, caption, onClose }) {
  useEffect(() => {
    maxBrightness();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreBrightness();
    };
  }, [onClose]);

  /* Kattaligi CSS bilan beriladi; bu yerdagi o'lchamlar faqat SVG ning
     ichki koordinatalari. Shtrix balandligi ATAYLAB katta: keng va past
     shtrixni lazerli skaner nishonga olishi qiyin. */
  const svg = kind === "qr"
    ? qrSvg(value, { size: 1000, margin: 1 })
    : code128Svg(value, { height: 30, unit: 0.5, quiet: 4 });

  const label = kind === "qr" ? "QR kod" : "Shtrix kod";

  return (
    <div className="ekz" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <button type="button" className="ekz__x" onClick={onClose} aria-label="Yopish">
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>

      {/* Kodning o'ziga bosish yopmaydi: mijoz uni skanerga tutib turganda
          tasodifan tegib ketishi tabiiy. */}
      <div className={`ekz__code ekz__code--${kind === "qr" ? "qr" : "bar"}`}
           onClick={(e) => e.stopPropagation()}
           dangerouslySetInnerHTML={{ __html: svg }} />

      {caption && <div className="ekz__num" onClick={(e) => e.stopPropagation()}>{caption}</div>}

      <div className="ekz__hint">Yopish uchun bo'sh joyga bosing</div>
    </div>
  );
}
