/* ══════════════════════════════════════════════════════════════════════════
   OHANGLARNI ESHITISH — WAV FAYLGA CHIQARISH (V89)

   ⚠ NEGA KERAK. Ovozni brauzersiz eshitib bo'lmaydi, avtomatik
   tekshiruv esa faqat «oscillator yaratildimi» degan savolga javob
   beradi — TEMBRni u eshitmaydi. Do'kon egasi «bu ohang menga
   yoqdimi?» degan savolga javob olishi kerak, kassa oldiga borib
   emas, shu yerdan.

   ⚠ OHANG JADVALI IMPORT QILINADI (`TONES`), qayta yozilmaydi:
   nusxa olinsa, eshitilgan ohang bilan kassadagisi bir kuni
   boshqacha bo'lib qolardi.

   ⚠ Bu render brauzer bilan 1:1 EMAS: Web Audio ning `square` va
   `triangle` to'lqinlari CHEGARALANGAN spektrli (alias yo'q), bu
   yerdagisi esa sodda — ya'ni haqiqiy kassada ohang bir oz
   YUMSHOQROQ eshitiladi. Balandlik, uzunlik, notalar va envelope
   aynan bir xil.

   Ishga tushirish:  node scripts/sfx-render.mjs [papka]
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { dispatchEvent() {} };

const { TONES, SFX } = await import("../src/lib/ek-sound.js");

const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), "..", "sfx-out");
const RATE = 44100;

/** Web Audio to'lqin shakllari (soddalashtirilgan). */
const wave = {
  sine: (x) => Math.sin(x),
  square: (x) => (Math.sin(x) >= 0 ? 1 : -1),
  triangle: (x) => (2 / Math.PI) * Math.asin(Math.sin(x)),
};

/**
 * Bitta ohangni namunalar massiviga aylantiradi.
 *
 * ⚠ ENVELOPE ADAPTERDAGI BILAN AYNAN BIR XIL: 8 ms eksponensial
 * ko'tarilish, keyin nota oxirigacha eksponensial tushish. Uni
 * o'zgartirish ohangni boshqa narsaga aylantirardi (adapterdagi
 * izohga qarang: to'satdan yoqib-o'chirish quloqqa «klik» bo'ladi).
 */
function render({ tone, w, gain }) {
  const total = tone.reduce((n, [, ms]) => n + ms, 0) / 1000;
  const out = new Float32Array(Math.ceil(total * RATE));
  let at = 0;
  for (const [freq, ms] of tone) {
    const dur = ms / 1000;
    if (freq > 0) {
      const n = Math.floor(dur * RATE);
      const start = Math.floor(at * RATE);
      const A = 0.008;                        // ko'tarilish, s
      const lo = 0.0001;
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        /* Eksponensial ramp: V0 · (V1/V0)^(o'tilgan / uzunlik) */
        const env = t < A
          ? lo * Math.pow(gain / lo, t / A)
          : gain * Math.pow(lo / gain, (t - A) / Math.max(dur - A, 1e-6));
        out[start + i] += wave[w || "sine"](2 * Math.PI * freq * t) * env;
      }
    }
    at += dur;
  }
  return out;
}

/** 16-bitli PCM WAV — kutubxonasiz, sarlavha qo'lda yoziladi. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);            // PCM
  head.writeUInt16LE(1, 22);            // mono
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

fs.mkdirSync(OUT, { recursive: true });

/* ── Har ohang oilasi alohida fayl ── */
const rendered = {};
for (const [name, spec] of Object.entries(TONES)) {
  const s = render(spec);
  rendered[name] = s;
  const file = path.join(OUT, `${name.toLowerCase()}.wav`);
  fs.writeFileSync(file, wav(s));
  const events = Object.keys(SFX).filter((e) => SFX[e].t === name);
  console.log(`  ${name.padEnd(6)} ${(s.length / RATE).toFixed(2)}s  ← ${events.join(", ")}`);
}

/* ── Hammasi ketma-ket: 900 ms tanaffus bilan ── */
const GAP = Math.floor(0.9 * RATE);
const order = ["DONE", "OK", "WARN", "ERROR", "TICK"];
const all = new Float32Array(order.reduce((n, k) => n + rendered[k].length + GAP, 0));
let at = 0;
for (const k of order) {
  all.set(rendered[k], at);
  at += rendered[k].length + GAP;
}
fs.writeFileSync(path.join(OUT, "hammasi.wav"), wav(all));
console.log(`\n  hammasi.wav — ${(all.length / RATE).toFixed(2)}s (${order.join(" · ")})`);
console.log(`  papka: ${OUT}\n`);
