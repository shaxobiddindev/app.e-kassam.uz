/* ══════════════════════════════════════════════════════════════════════════
   OVOZ ADAPTERI — WEB AUDIO (V89)

   Bu modul VOQEALARNI BILMAYDI. U faqat «shu chastotalarni shu
   davomiylikda chal» degan buyruqni oladi. Voqea, sozlama va qaror
   `ek-sound.js` da — ya'ni biznes mantiqi platformaga bog'lanmagan.

   ⚠ NEGA BITTA ADAPTER, UCHTA EMAS. Kassa uchta muhitda ishlaydi:
   brauzer, Tauri (.exe) va Capacitor (Android). Ikkalasi ham WebView,
   ya'ni Web Audio o'sha yerda ishlaydi. Uchta adapter yozish —
   ishlatilmaydigan abstraksiya bo'lardi. Kelajakda native ovoz kerak
   bo'lsa, `play`/`prime`/`activePri` interfeysi shunga tayyor.

   ⚠ HAMMA JOYDA HIMOYA. `AudioContext` bo'lmasligi mumkin (eski
   WebView), qurilma ovozsiz bo'lishi mumkin, brauzer rad etishi
   mumkin. Bularning HECH BIRI istisno bo'lib chiqmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

let ctx = null;
let broken = false;
/** Hozir ijro etilayotgan ohang: `{ nodes, until, pri }`. */
let active = null;

function context() {
  if (ctx || broken) return ctx;
  try {
    const AC = typeof window !== "undefined"
      && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { broken = true; return null; }
    ctx = new AC();
  } catch (_) {
    broken = true;
  }
  return ctx;
}

/**
 * Autoplay qulfini ochadi.
 *
 * ⚠ Brauzer `AudioContext` ni foydalanuvchi sahifaga TEGMAGUNCHA
 * `suspended` holatda tutadi. Birinchi ovoz aynan shu sababdan
 * jimgina yo'qolardi — va bu kassa uchun «ishlamayapti» degani.
 *
 * Chaqiruvchi (`App.jsx`) buni birinchi bosish/tugma bosishida bir
 * marta chaqiradi.
 */
export function prime() {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
}

/**
 * Ijro etilayotgan ohangning prioriteti; hech narsa chalinmasa 0.
 *
 * ⚠ KONTEKST YARATMAYDI (`context()` chaqirilmaydi). Bu funksiya HAR
 * voqeada chaqiriladi — jim voqealarda ham, chunki `sfx()` uni
 * `decide()` ga argument qilib beradi. `context()` chaqirilsa,
 * hech qachon ovoz chiqarmaydigan brauzer ham birinchi `toast` da
 * `AudioContext` ochib qo'yardi: keraksiz resurs va ba'zi
 * platformalarda ortiqcha ruxsat so'rovi.
 *
 * Kontekst yo'q bo'lsa hech narsa chalinmayotgan bo'ladi — javob 0.
 */
export function activePri() {
  if (!ctx || !active) return 0;
  return ctx.currentTime < active.until ? active.pri : 0;
}

/**
 * Ijro etilayotgan ohangni to'xtatadi.
 *
 * ⚠ Kesish KERAK: yangi, muhimroq ovoz eskisining ustiga qo'shilib
 * ketsa, ikkalasi ham tanib bo'lmaydigan shovqinga aylanardi.
 */
function stop() {
  if (!active) return;
  for (const n of active.nodes) {
    try { n.stop(); } catch (_) { /* allaqachon to'xtagan */ }
  }
  active = null;
}

/**
 * Ohangni chaladi.
 *
 * @param spec `{ tone: [[gts, ms], …], w, gain, pri }` — `ek-sound.js` dan.
 */
export function play(spec) {
  const c = context();
  if (!c || !spec) return;
  /* Qulf hali ochilmagan bo'lsa ochishga urinamiz: ijro shu safar
     chiqmasligi mumkin, lekin keyingisi chiqadi. */
  if (c.state === "suspended") c.resume().catch(() => {});

  stop();

  const start = c.currentTime + 0.01;   // kichik zaxira: uzilib qolmasin
  let at = start;
  const nodes = [];

  for (const [freq, ms] of spec.tone) {
    const dur = ms / 1000;
    if (freq > 0) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = spec.w || "sine";
      osc.frequency.setValueAtTime(freq, at);

      /* ⚠ ENVELOPE SHART. Ovozni to'satdan yoqib-o'chirish quloqqa
         «klik» bo'lib eshitiladi (kvadrat to'lqinda ayniqsa) va u
         arzon, buzuq karnay taassurotini beradi. Tez ko'tarilish +
         yumshoq tushish buni yo'qotadi. */
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(spec.gain, 0.0002), at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(at);
      osc.stop(at + dur);
      nodes.push(osc);
    }
    at += dur;
  }

  active = nodes.length ? { nodes, until: at, pri: spec.pri || 0 } : null;
}
