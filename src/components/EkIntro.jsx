import { useEffect, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   Brend introsi — landing (e-kassam.uz) bilan AYNAN bir xil sahna:
   orqa chek sirg'aladi, old chek ko'tariladi, satrlar ochiladi, yashil ✓
   chiziladi, so'ng wordmark harflari ko'tariladi.

   Bu TELEFON ilovasining kirish ekranida ko'rsatiladi (LoginPage o'zi
   qaror qiladi): ilova sovuq ochilishida BIR MARTA. Bosish darhol yopadi,
   1.8s dan keyin o'zi yopiladi. `prefers-reduced-motion` da chaqiruvchi
   uni umuman chizmaydi.

   Uslublar: sahna animatsiyalari `src/styles/ek-motion.css` da (sync'dan
   keladi, `.ek-intro__back/front/ln/chk/char`), maket esa `styles.css`
   oxiridagi `.ek-intro` blokida (ilovaning o'z fayli).
   ══════════════════════════════════════════════════════════════════════════ */

const WORD = "e-Kassam.uz";

export default function EkIntro({ onDone }) {
  const [out, setOut] = useState(false);
  const closed = useRef(false);

  const finish = () => {
    if (closed.current) return;
    closed.current = true;
    setOut(true);                       // chiqish animatsiyasi (is-out)
    setTimeout(onDone, 340);            // animatsiya tugagach olib tashlanadi
  };

  useEffect(() => {
    const t = setTimeout(finish, 1800);
    return () => clearTimeout(t);
  }, []);

  const dotAt = WORD.indexOf(".");
  return (
    <div className={`ek-intro${out ? " is-out" : ""}`} onClick={finish} role="presentation">
      <div className="ek-intro__stage">
        <svg className="ek-intro__mark" viewBox="0 0 48 48" width="96" height="96" fill="none" aria-hidden="true">
          <path className="ek-intro__back" d="M19 7.6a4.2 4.2 0 0 1 4.2-4.2h11.6a4.2 4.2 0 0 1 4.2 4.2v20.8L35.67 32 32.33 28.4 29 32l-3.33-3.6L22.33 32 19 28.4Z" fill="var(--ek-blue-400)" />
          <path className="ek-intro__front" d="M9 13.2a4.6 4.6 0 0 1 4.6-4.6h14.8a4.6 4.6 0 0 1 4.6 4.6v21.4L30 39l-3-4.4L24 39l-3-4.4L18 39l-3-4.4L12 39l-3-4.4Z" fill="var(--ek-blue-600)" />
          <path className="ek-intro__ln l1" d="M13.6 13.2h14a1.35 1.35 0 0 1 0 2.7h-14a1.35 1.35 0 0 1 0-2.7Z" fill="#fff" />
          <path className="ek-intro__ln l2" d="M13.6 18.1h9a1.35 1.35 0 0 1 0 2.7h-9a1.35 1.35 0 0 1 0-2.7Z" fill="#fff" />
          <path className="ek-intro__chk" d="M14.1 28.9l3.4 3.4L28 21.8" stroke="var(--ek-green-400)" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="ek-intro__word">
          {WORD.split("").map((ch, i) => (
            <span
              key={i}
              className={"ek-intro__char" + (i >= dotAt ? " dot" : "")}
              style={{ animationDelay: `${900 + i * 28}ms` }}
            >{ch}</span>
          ))}
        </div>
        <div className="ek-intro__tag">Kassa va CRM tizimi</div>
      </div>
    </div>
  );
}
