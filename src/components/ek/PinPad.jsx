/* ══════════════════════════════════════════════════════════════════════════
   RAQAMLI KLAVIATURA — PIN UCHUN (V99)

   Ikkita oyna ishlatadi: kassirni almashtirish (`PinSwitchModal`) va
   o'z PIN ini qo'yish (`PinSetModal`).

   ⚠ NEGA UMUMIY. Ikki nusxa yozilsa, ulardan biri tuzatilib
   ikkinchisi eskicha qolishi — bu loyihadagi eng ko'p takrorlangan
   nuqson. Bu yerda esa farq KO'RINMAS bo'lardi: ikkala oyna ham
   ishlaydi, faqat biri fizik klaviaturani tinglamaydi yoki
   kataklarni boshqacha sanaydi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { t } from "../../lib/ek-i18n";

/**
 * @param length   nechta raqam kutiladi (do'kon sozlamasi: 4 yoki 6)
 * @param value    terilgan raqamlar
 * @param onChange yangi qiymat
 * @param disabled so'rov ketayotganda tugmalar o'chadi
 */
export default function PinPad({ length, value, onChange, disabled = false }) {
  const push = (d) => {
    if (disabled) return;
    onChange(value.length >= length ? value : value + d);
  };
  const back = () => { if (!disabled) onChange(value.slice(0, -1)); };

  /* ⚠ FIZIK KLAVIATURA HAM ISHLAYDI. Monoblokda klaviatura bor va
     kassir raqamni undan terishi tabiiy; faqat ekran tugmalari
     qoldirilsa, u sichqonchani qidirib vaqt yo'qotardi. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") { push(e.key); e.preventDefault(); }
      else if (e.key === "Backspace") { back(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {/* Terilgan raqamlar SONI ko'rinadi, qiymati emas. */}
      <div className="pin-dots" role="status">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`pin-dot${i < value.length ? " pin-dot--on" : ""}`} />
        ))}
      </div>

      <div className="pin-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className="pin-key"
                  onClick={() => push(String(d))} disabled={disabled}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="pin-key" onClick={() => push("0")} disabled={disabled}>
          0
        </button>
        <button type="button" className="pin-key pin-key--back" onClick={back}
                disabled={disabled} aria-label={t("common.delete")}>
          <i className="fa-solid fa-delete-left" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
