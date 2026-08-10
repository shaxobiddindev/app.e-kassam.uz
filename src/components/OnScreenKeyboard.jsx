import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { insert, backspace, clear, isNumericField } from "../lib/ek-keys";

/* ══════════════════════════════════════════════════════════════════════════
   Ekran klaviaturasi — monoblok uchun

   Ikki rejim, maydon turiga qarab O'ZI tanlanadi (`isNumericField`):

     RAQAMLI  — miqdor, narx, to'lov, telefon. Faqat raqamlar chiqadi:
                bunday maydonda harf yozib bo'lmaydi, ya'ni harfli
                klaviatura ekranni bekorga egallagan bo'lardi.
     MATNLI   — nom, izoh, qidiruv. Harflar VA yuqorida raqamlar qatori
                birga: "Coca-Cola 1.5" kabi qiymatlarda rejim almashtirib
                o'tirish kassirni sekinlashtirardi.

   ⚠ FOKUS YO'QOTILMAYDI. Har bir tugmada `onPointerDown` da
   `preventDefault()` — aks holda tugmaga tegilishi bilan maydon fokusni
   yo'qotadi, klaviatura esa qayerga yozishini bilmay qoladi.
   ══════════════════════════════════════════════════════════════════════════ */

const NUM_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  [".", "0", "⌫"],
];

/* Lotin — o'zbekcha `oʻ gʻ ʼ` bilan. Ular alohida tugma: kassir ularni
   `o` + tirnoq deb yozsa, qidiruv va nom bazadagidan farq qilardi. */
const LAT_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "oʻ"],
  ["⇧", "z", "x", "c", "v", "b", "n", "m", "gʻ", "ʼ", "⌫"],
];

const CYR_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х"],
  ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
  ["⇧", "я", "ч", "с", "м", "и", "т", "ь", "б", "ю", "⌫"],
];

export default function OnScreenKeyboard({ target, onClose }) {
  const numeric = isNumericField(target);
  const [caps, setCaps] = useState(false);
  const [cyr, setCyr]   = useState(false);
  const boxRef = useRef(null);

  /* Klaviatura ekranning pastini egallaydi va fokusdagi maydonni yopib
     qo'yishi mumkin. Ochilganda maydonni ko'rinadigan joyga suramiz —
     aks holda kassir nima yozayotganini ko'rmaydi. */
  useEffect(() => {
    if (!target) return;
    const id = setTimeout(() => {
      try { target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    }, 60);
    return () => clearTimeout(id);
  }, [target]);

  // Jismoniy `Esc` ham yopsin — monoblokka klaviatura ulangan bo'lishi mumkin.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!target) return null;

  const press = (key) => {
    if (!target || !target.isConnected) { onClose(); return; }
    if (key === "⌫") { backspace(target); return; }
    if (key === "⇧") { setCaps((v) => !v); return; }
    insert(target, caps ? key.toUpperCase() : key);
    // Katta harf bitta belgidan keyin o'chadi — telefon klaviaturalari
    // shunday ishlaydi va kassir uni qayta bosishni o'ylab o'tirmaydi.
    if (caps) setCaps(false);
  };

  // ⚠ `onPointerDown` — `onClick` EMAS: fokus `pointerdown` da yo'qoladi,
  // demak to'sish ham o'sha yerda bo'lishi kerak.
  const hold = (e) => e.preventDefault();

  const rows = numeric ? NUM_ROWS : (cyr ? CYR_ROWS : LAT_ROWS);

  return (
    <div
      className={`osk ${numeric ? "osk--num" : "osk--text"}`}
      ref={boxRef}
      role="group"
      aria-label={t("osk.title")}
      onPointerDown={hold}
    >
      <div className="osk__bar">
        <span className="osk__hint">{t(numeric ? "osk.numeric" : "osk.text")}</span>
        <button type="button" className="osk__close" onPointerDown={hold} onClick={onClose}
                aria-label={t("common.close")}>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </button>
      </div>

      <div className="osk__rows">
        {rows.map((row, i) => (
          <div className="osk__row" key={i}>
            {row.map((k) => (
              <button
                key={k}
                type="button"
                className={`osk__key${k === "⌫" ? " osk__key--wide" : ""}${k === "⇧" && caps ? " is-on" : ""}`}
                onPointerDown={hold}
                onClick={() => press(k)}
              >
                {k === "⇧" ? <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                 : k === "⌫" ? <i className="fa-solid fa-delete-left" aria-hidden="true" />
                 : (caps && !numeric ? k.toUpperCase() : k)}
              </button>
            ))}
          </div>
        ))}

        <div className="osk__row osk__row--foot">
          {!numeric && (
            <button type="button" className="osk__key osk__key--fn" onPointerDown={hold}
                    onClick={() => setCyr((v) => !v)}>
              {cyr ? "ABC" : "АБВ"}
            </button>
          )}
          <button type="button" className="osk__key osk__key--fn" onPointerDown={hold}
                  onClick={() => clear(target)}>
            {t("osk.clear")}
          </button>
          {!numeric && (
            <button type="button" className="osk__key osk__key--space" onPointerDown={hold}
                    onClick={() => press(" ")}>
              {t("osk.space")}
            </button>
          )}
          <button type="button" className="osk__key osk__key--ok" onPointerDown={hold}
                  onClick={onClose}>
            <i className="fa-solid fa-check" aria-hidden="true" /> {t("osk.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
