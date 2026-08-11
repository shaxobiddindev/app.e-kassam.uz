import { useEffect, useRef, useState } from "react";
import { groupDigits } from "../../lib/ek-format";

/* ==========================================================================
   KPI kartochkasi + raqam sanash + sparkline
   03-MOTION.md #4, 07-ADMIN.md → "Bosh sahifa"

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

const REDUCED = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * 0 dan qiymatgacha 900ms, ease-out.
 * Faqat BIRINCHI ko'rinishda ishlaydi (IntersectionObserver) — har scroll'da
 * qayta sanash asabiylashtiradi. `prefers-reduced-motion` da darhol yakuniy qiymat.
 */
// ⚠ Standart formatlash `ek-format` dan. Ilgari bu yerda
// `n.toLocaleString("uz-UZ")` turardi: u 02-DESIGN-SYSTEM.md ning
// "komponentda toLocaleString chaqirilmaydi" qoidasini buzardi va
// razryad ajratgichini brauzerga qoldirardi — bir xil son turli
// mashinada turlicha ko'rinardi.
export function CountUp({ value, format = groupDigits, duration = 900 }) {
  const [shown, setShown] = useState(REDUCED() ? value : 0);
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    const target = Number(value) || 0;
    if (REDUCED()) { setShown(target); return; }
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (done.current) { setShown(target); return; }
      done.current = true;
      const t0 = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);   // ease-out
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        setShown(Math.round(target * ease(p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) { run(); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } },
      { threshold: .35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  // Tabular figures majburiy — aks holda raqam o'zgarganda kenglik sakraydi
  return <span ref={ref} className="ek-countup">{format(shown)}</span>;
}

/** Kichik sparkline. Rang yolg'iz signal emas — yonida foiz matni turadi. */
export function Sparkline({ data = [], width = 84, height = 26 }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke="var(--fg-brand)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    </svg>
  );
}

/**
 * @param label   nimani o'lchayotgani
 * @param value   son (sanaladi)
 * @param format  ko'rsatish funksiyasi (packages/ui/ek-format.js dan)
 * @param delta   o'zgarish foizi, ixtiyoriy
 * @param trend   sparkline uchun raqamlar massivi
 * @param hint    yorliq ostidagi izoh — ko'rsatkich nimani anglatishini
 *                aytadi ("30 kunda kamida bitta sotuv"). Raqamning o'zi
 *                tushuntirmaydigan hollarda kerak.
 */
/**
 * `danger` — raqamni qizil qiladi. Sof foyda MANFIY bo'lgan hol uchun:
 * u bosh sahifadagi eng muhim xabar va oddiy rangda ko'zdan qochardi.
 */
export default function Kpi({ label, value, format, delta, trend, hint, danger }) {
  const dir = delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "fa-arrow-trend-up" : dir === "down" ? "fa-arrow-trend-down" : "fa-minus";
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value" style={danger ? { color: "var(--fg-danger)" } : undefined}>
        <CountUp value={value} format={format} />
      </span>
      {hint && <span className="kpi__hint">{hint}</span>}
      <div className="kpi__foot">
        {delta != null ? (
          <span className="kpi__delta" data-dir={dir}>
            <i className={`fa-solid ${arrow}`} aria-hidden="true" />
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : <span />}
        {trend?.length > 1 && <Sparkline data={trend} />}
      </div>
    </div>
  );
}
