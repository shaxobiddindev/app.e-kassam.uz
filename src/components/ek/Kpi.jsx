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
/**
 * ⚠ ANIMATSIYA VAQT BILAN CHEKLANGAN, raqam bilan emas.
 *
 * Tezlik sondan kelib chiqadi, davomiylik esa YO'Q: qancha katta son
 * bo'lmasin, u belgilangan vaqtda to'xtaydi. Aks holda millionlik summa
 * mayda raqamdan sezilarli uzoq «sanardi» va bosh sahifadagi beshta
 * katak turli vaqtda tinchlanardi — ko'z qayerga qarashni bilmasdi.
 *
 * Xonalar soniga qarab biroz cho'ziladi (uzun songa ko'z ko'proq vaqt
 * kerak), lekin `MAX_MS` dan oshmaydi.
 */
const MIN_MS = 420;
const MAX_MS = 700;

/** Son uzunligiga qarab davomiylik — lekin doim `MAX_MS` ichida. */
function budget(value) {
  const digits = String(Math.abs(Math.round(Number(value) || 0))).length;
  return Math.min(MAX_MS, MIN_MS + Math.max(0, digits - 3) * 40);
}

export function CountUp({ value, format = groupDigits, duration }) {
  const target = Number(value) || 0;
  const ref = useRef(null);
  /* Ekranda turgan qiymat — REF da ham saqlanadi, chunki keyingi
     animatsiya AYNAN shu yerdan boshlanishi kerak. */
  const shownRef = useRef(REDUCED() ? target : 0);
  const [shown, setShown] = useState(shownRef.current);

  /* ══════════════════════════════════════════════════════════════════
     ⚠ BU YERDA HAQIQIY XATO BOR EDI — RAQAMLAR NOL BO'LIB QOLARDI

     Kartochka avval BO'SH chiziladi (`value` hali kelmagan, ya'ni 0),
     keyin javob kelib qiymat almashadi. Eski kodda birinchi
     animatsiya «0 dan 0 gacha» ishga tushardi va u ~420 ms davom
     etardi. Javob shu oraliqda kelsa — tez tarmoqda DOIM shunday
     bo'ladi — yangi qiymat qo'yilar, lekin ESKI halqa keyingi
     kadrda uni yana NOLGA qaytarardi. Halqa tugagach ekranda «0»
     qolib ketardi va boshqa hech qachon yangilanmasdi.

     Xato JIMGINA edi: sahifa yiqilmasdi, foizlar to'g'ri turardi,
     faqat eng katta raqamlar nol ko'rsatardi.

     Yechim ikkita: (1) eski halqa TOZALASHDA bekor qilinadi;
     (2) animatsiya noldan emas, EKRANDAGI qiymatdan boshlanadi —
     shu bilan avto-yangilanishda raqam nolga tushib qaytmaydi.
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const set = (v) => { shownRef.current = v; setShown(v); };
    if (REDUCED()) { set(target); return; }
    const el = ref.current;
    if (!el) return;

    let raf = 0, stop = false;
    const from = shownRef.current;

    const animate = () => {
      if (from === target) { set(target); return; }
      const t0 = performance.now();
      const ms = duration || budget(target);
      const ease = (t) => 1 - Math.pow(1 - t, 3);   // ease-out
      const tick = (now) => {
        if (stop) return;
        const p = Math.min(1, (now - t0) / ms);
        set(Math.round(from + (target - from) * ease(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const stopAll = () => { stop = true; if (raf) cancelAnimationFrame(raf); };

    /* Sanash faqat kartochka KO'RINGANDA boshlanadi — ekrandan
       tashqarida sanalgan raqamni hech kim ko'rmaydi. */
    if (!("IntersectionObserver" in window)) { animate(); return stopAll; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { animate(); io.disconnect(); } },
      { threshold: .35 }
    );
    io.observe(el);
    return () => { stopAll(); io.disconnect(); };
  }, [target, duration]);

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
 *
 * ⚠ Bu xususiyat bir marta YO'QOLGAN: ilgari u faqat `ekassam-app` ichidagi
 * NUSXAGA yozilgan edi va keyingi `sync-tokens.ps1` uni manbadagi eski
 * versiya bilan qayta yozib yubordi. Shu papkadagi komponentlar MANBA —
 * ilova ichidagi nusxa hech qachon qo'lda tahrirlanmaydi.
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
