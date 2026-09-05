import { useId, useMemo, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   GRAFIKLAR — O'Z SVG, KUTUBXONASIZ (V69)

   ═══ NEGA KUTUBXONA EMAS ══════════════════════════════════════════════

   Recharts/Chart.js ilovaga 150–300 KB qo'shadi. Bu ilova MONOBLOKDA
   ishlaydi — sekin protsessor, ko'pincha sekin internet — va butun
   `index.js` hozir 120 KB (gzip). Grafik kutubxonasi uni IKKI
   BAROBARDAN oshirardi, holbuki bu yerda kerak bo'lgani to'rtta oddiy
   shakl: chiziq, ustun, halqa va issiqlik xaritasi. Ularning har biri
   50 qatorlik SVG.

   Yana bir sabab: kutubxonalarning uslubi o'zining, ilovaniki emas.
   Rang, shrift, chegara, sichqoncha ostidagi yozuv — hammasi qaytadan
   sozlanadi va baribir «boshqa dastur» bo'lib ko'rinadi.

   ═══ UMUMIY QOIDALAR ══════════════════════════════════════════════════

   ⚠ HAR GRAFIK BO'SH MA'LUMOTDA HAM CHIZILADI (bo'sh o'q va yozuv),
   `null` qaytarmaydi: yo'qolgan grafik o'rnida sahifa sakrab qoladi va
   foydalanuvchi «yuklanmadimi?» deb o'ylaydi.

   ⚠ Rang TOKENDAN olinadi (`--fg-brand` va h.k.), qattiq yozilmaydi:
   qorong'i mavzuda qattiq rang fon bilan qo'shilib ketardi.

   ⚠ O'lchov `viewBox` da, piksel emas: grafik konteynerga moslashadi va
   monoblokning tor ekranida ham, kattasida ham bir xil ko'rinadi.
   ══════════════════════════════════════════════════════════════════════════ */

const nz = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Qisqa son: 1 240 000 → «1.2 mln». O'q yozuvlari uchun. */
export function shortNum(v, suffix = { k: "ming", m: "mln", b: "mlrd" }) {
  const n = nz(v);
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1).replace(/\.0$/, "")} ${suffix.b}`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1).replace(/\.0$/, "")} ${suffix.m}`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)} ${suffix.k}`;
  return `${sign}${Math.round(a)}`;
}

/**
 * Yaxlit o'q chegarasi: 0…max ni «chiroyli» songa yaxlitlaydi.
 *
 * ⚠ Xom maksimum olinganda o'q yozuvlari «1 237 411» kabi chiqardi va
 * ularni o'qib bo'lmasdi. Yaxlit qadam esa grafikni ham tinchitadi:
 * ma'lumot bir oz o'zgarganda o'q sakramaydi.
 */
export function niceMax(max) {
  const m = Math.abs(nz(max));
  if (m === 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(m));
  const n = m / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/* ══ CHIZIQ / MAYDON ═══════════════════════════════════════════════════ */

/**
 * Ko'p qatorli chiziqli grafik.
 *
 * @param points  `[{ label, ...values }]`
 * @param lines   `[{ key, name, color, area }]` — `area` bo'lsa ostiga
 *                shaffof to'ldiruv qo'yiladi (asosiy qator uchun)
 */
export function LineChart({ points = [], lines = [], height = 240, fmt = shortNum, empty = "" }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  const W = 1000, H = height, PL = 62, PR = 12, PT = 12, PB = 26;

  const max = useMemo(() => {
    let m = 0;
    for (const p of points) for (const l of lines) m = Math.max(m, nz(p[l.key]));
    return niceMax(m);
  }, [points, lines]);
  /* ⚠ Manfiy qiymat ham bo'lishi mumkin (foyda zararga ketsa) — pastki
     chegara shundan chiqariladi, aks holda chiziq maydondan chiqib
     ketardi va grafik yolg'on gapirardi. */
  const min = useMemo(() => {
    let m = 0;
    for (const p of points) for (const l of lines) m = Math.min(m, nz(p[l.key]));
    return m === 0 ? 0 : -niceMax(-m);
  }, [points, lines]);

  const n = points.length;
  const x = (i) => (n <= 1 ? PL : PL + (i * (W - PL - PR)) / (n - 1));
  const y = (v) => {
    const span = max - min || 1;
    return PT + (H - PT - PB) * (1 - (nz(v) - min) / span);
  };

  if (!n) return <ChartEmpty height={height} text={empty} />;

  const path = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = (key) =>
    `${path(key)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  /* O'q yozuvlari — beshta chiziq. Ko'proq qilinsa ular bir-biriga
     yopishib, grafikni to'r bilan qoplab qo'yardi. */
  const grid = [0, 0.25, 0.5, 0.75, 1].map((k) => min + (max - min) * k);
  /* Nuqta yozuvlari — hammasi sig'masa, oraliq tashlab ketiladi. */
  const every = Math.max(1, Math.ceil(n / 12));

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
           style={{ width: "100%", height, display: "block" }}>
        <defs>
          {lines.filter((l) => l.area).map((l) => (
            <linearGradient key={l.key} id={`g-${uid}-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={l.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={l.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {grid.map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)}
                  stroke="var(--border-subtle, #e5e7eb)" strokeWidth="1"
                  strokeDasharray={v === 0 ? "" : "3 4"} vectorEffect="non-scaling-stroke" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end"
                  fill="var(--fg-tertiary, #9ca3af)" fontSize="11">{fmt(v)}</text>
          </g>
        ))}

        {lines.filter((l) => l.area).map((l) => (
          <path key={`a-${l.key}`} d={area(l.key)} fill={`url(#g-${uid}-${l.key})`} />
        ))}
        {lines.map((l) => (
          <path key={l.key} d={path(l.key)} fill="none" stroke={l.color} strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}

        {points.map((p, i) => (i % every === 0 || i === n - 1) && (
          <text key={`x-${i}`} x={x(i)} y={H - 8} textAnchor="middle"
                fill="var(--fg-tertiary, #9ca3af)" fontSize="11">{p.label}</text>
        ))}

        {/* Sichqoncha uchun ko'rinmas ustunlar — nuqtaning o'ziga tegish
            qiyin, ustun esa butun balandlikni egallaydi. */}
        {points.map((p, i) => (
          <rect key={`h-${i}`} x={x(i) - (W - PL - PR) / Math.max(1, n * 2)} y={PT}
                width={(W - PL - PR) / Math.max(1, n)} height={H - PT - PB}
                fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover != null && (
          <>
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={H - PB}
                  stroke="var(--fg-tertiary, #9ca3af)" strokeWidth="1" strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke" />
            {lines.map((l) => (
              <circle key={l.key} cx={x(hover)} cy={y(points[hover][l.key])} r="4"
                      fill="var(--bg-surface, #fff)" stroke={l.color} strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke" />
            ))}
          </>
        )}
      </svg>

      <div className="chart__legend">
        {lines.map((l) => (
          <span key={l.key} className="chart__key">
            <i style={{ background: l.color }} /> {l.name}
          </span>
        ))}
      </div>

      {/* Yozuv SVG dan TASHQARIDA: `preserveAspectRatio="none"` matnni
          cho'zib yuborardi va o'qib bo'lmas holga keltirardi. */}
      {hover != null && (
        <div className="chart__tip">
          <b>{points[hover].label}</b>
          {lines.map((l) => (
            <div key={l.key}>
              <i style={{ background: l.color }} /> {l.name}
              <span>{fmt(points[hover][l.key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ USTUNLAR ══════════════════════════════════════════════════════════ */

export function BarChart({ bars = [], height = 200, fmt = shortNum, color = "var(--bg-brand)", empty = "" }) {
  const max = useMemo(() => niceMax(Math.max(0, ...bars.map((b) => nz(b.value)))), [bars]);
  if (!bars.length) return <ChartEmpty height={height} text={empty} />;
  return (
    <div className="chart chart--bars" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="bar" title={`${b.label}: ${fmt(b.value)}`}>
          {/* ⚠ NOL USTIDA YOZUV YO'Q. Yopiq soatlarda 24 ta ustunning
              yarmi ustida «0» turardi va bu qator shovqin bo'lib,
              haqiqiy raqamlarni bosib qo'yardi. Nol ustunning O'ZI
              (ingichka chiziq) allaqachon «bu yerda savdo yo'q»
              deydi. */}
          <span className="bar__v">{nz(b.value) === 0 ? "" : fmt(b.value)}</span>
          {/* ⚠ Balandlik FOIZDA: konteyner o'lchami oldindan noma'lum
              va piksel bilan hisoblansa, tor ekranda ustunlar qutidan
              chiqib ketardi. Eng kichik balandlik 2px — nol bo'lmagan
              qiymat ko'rinmay qolmasin. */}
          <div className="bar__fill"
               style={{ height: `calc(${(nz(b.value) / max) * 100}% + 2px)`,
                        background: b.color || color }} />
          <span className="bar__l">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ══ HALQA ═════════════════════════════════════════════════════════════ */

/**
 * Halqa diagramma — ulushlar uchun.
 *
 * ⚠ `stroke-dasharray` bilan chiziladi, burchak hisoblanmaydi: bu
 * yozilishi ham, o'qilishi ham oson va SVG uni aniq bajaradi.
 */
export function Donut({ slices = [], size = 180, thickness = 22, center = null, empty = "" }) {
  const total = slices.reduce((s, x) => s + Math.abs(nz(x.value)), 0);
  if (!slices.length || total === 0) return <ChartEmpty height={size} text={empty} />;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            const frac = Math.abs(nz(s.value)) / total;
            const dash = `${(c * frac).toFixed(2)} ${(c * (1 - frac)).toFixed(2)}`;
            const off = -c * acc;
            acc += frac;
            return (
              <circle key={i} cx={size / 2} cy={size / 2} r={r}
                      fill="none" stroke={s.color} strokeWidth={thickness}
                      strokeDasharray={dash} strokeDashoffset={off}>
                <title>{s.label}</title>
              </circle>
            );
          })}
        </g>
      </svg>
      {center && <div className="donut__mid">{center}</div>}
    </div>
  );
}

/* ══ ISSIQLIK XARITASI ═════════════════════════════════════════════════ */

/**
 * Hafta kuni × soat — savdo zichligi.
 *
 * @param cells `[{ dow, hour, value }]` — bo'sh kataklar 0 deb chiziladi
 * @param dows  hafta kunlarining qisqa nomlari (dushanbadan)
 */
export function HeatMap({ cells = [], dows = [], hours = null, fmt = shortNum, empty = "" }) {
  const map = useMemo(() => {
    const m = new Map();
    for (const c of cells) m.set(`${c.dow}:${c.hour}`, nz(c.value));
    return m;
  }, [cells]);
  const max = useMemo(() => Math.max(0, ...cells.map((c) => nz(c.value))), [cells]);
  if (!cells.length) return <ChartEmpty height={220} text={empty} />;

  /* Ko'rsatiladigan soatlar — ma'lumot BOR oraliq. Sutkaning 24
     soatini har doim chizish yarmi bo'm-bo'sh jadval berardi va
     tirband soat ichida yo'qolib ketardi. */
  const used = cells.filter((c) => nz(c.value) > 0).map((c) => c.hour);
  const h0 = hours?.[0] ?? Math.max(0, Math.min(...used, 23) - 1);
  const h1 = hours?.[1] ?? Math.min(23, Math.max(...used, 0) + 1);
  const cols = [];
  for (let h = h0; h <= h1; h++) cols.push(h);

  return (
    <div className="heat">
      <div className="heat__grid" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
        <span />
        {cols.map((h) => <span key={h} className="heat__h">{String(h).padStart(2, "0")}</span>)}
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <Row key={d} d={d} name={dows[d - 1] || d} cols={cols} map={map} max={max} fmt={fmt} />
        ))}
      </div>
    </div>
  );
}

function Row({ d, name, cols, map, max, fmt }) {
  return (
    <>
      <span className="heat__d">{name}</span>
      {cols.map((h) => {
        const v = map.get(`${d}:${h}`) || 0;
        /* ⚠ Shaffoflik CHIZIQLI EMAS, ildiz bilan: bitta tirband soat
           qolgan hammasini oqartirib yuborardi va xarita bitta qora
           katak bo'lib qolardi. */
        const k = max === 0 ? 0 : Math.sqrt(v / max);
        return (
          <span key={h} className="heat__c"
                title={v ? `${name} ${String(h).padStart(2, "0")}:00 — ${fmt(v)}` : undefined}
                style={{ background: v ? `color-mix(in srgb, var(--bg-brand) ${Math.round(k * 100)}%, transparent)` : undefined }} />
        );
      })}
    </>
  );
}

/* ══ BO'SH HOLAT ═══════════════════════════════════════════════════════ */

function ChartEmpty({ height, text }) {
  return (
    <div className="chart chart--empty" style={{ height }}>
      <i className="fa-solid fa-chart-line" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
