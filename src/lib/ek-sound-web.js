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

/** Muhimroq ovoz pastrog'ini to'sib turadigan oyna (soniya). */
const GUARD_S = 0.25;

let ctx = null;
let broken = false;
/** Hozir ijro etilayotgan ohang: `{ nodes, until, pri }`. */
let active = null;

/* ══ YOZILGAN OVOZLAR (V93) ════════════════════════════════════════════
   Kalit — manzil, qiymat — dekodlangan `AudioBuffer` yoki `null`.

   ⚠ `null` — «URINDIK VA BO'LMADI», «hali urinmadik» EMAS. Farq muhim:
   birinchisida qayta urinmaymiz (har chek yopilishida 404 so'rov
   yuborish oflayn kassani sekinlashtirardi), ikkinchisida esa
   yuklashni boshlaymiz. Shuning uchun kalitning BORLIGI tekshiriladi,
   qiymati emas. */
const buffers = Object.create(null);

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
export function prime(urls) {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  /* ⚠ YOZUVLAR SHU YERDA OLINADI — birinchi sotuvda emas. Kassir
     kunning birinchi chekini yopganda bufer allaqachon tayyor bo'lsin:
     aks holda birinchi chek ohang bilan, qolganlari yozuv bilan
     chalinib, ovoz «beqaror» bo'lib tuyulardi. */
  for (const u of urls || []) load(u);
}

/**
 * Yozilgan ovozni oladi va dekodlaydi. HECH QACHON kutilmaydi.
 *
 * ⚠ `sfx()` bu yerni kutmaydi va kuta olmaydi ham: ovoz `Promise`
 * qaytarmaydi (`ek-sound.js` sarlavhasidagi qoida — V58 pretsedenti).
 * Fayl tayyor bo'lgunicha ohang chalinaveradi.
 *
 * ⚠ HAR XATO YUTILADI va manzil `null` bilan BELGILANADI: shundan
 * keyin qayta urinilmaydi. Oflayn kassada har chek yopilishida
 * muvaffaqiyatsiz so'rov yuborish — bekorga kechikish.
 */
function load(url) {
  if (!url || url in buffers) return;
  const c = context();
  if (!c) return;
  buffers[url] = undefined;            // «yuklanmoqda» — takror boshlanmasin
  fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http"))))
    .then((buf) => c.decodeAudioData(buf))
    .then((decoded) => { buffers[url] = decoded; })
    .catch(() => { buffers[url] = null; });
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
 *
 * ⚠⚠ HIMOYA OYNASI OHANGDAN QISQA (V90). Ilgari u ohangning BUTUN
 * uzunligiga cho'zilardi: `ERROR` 800 ms chalinayotganda undan
 * pastroq har qanday ovoz jimgina yutilardi. Ohanglar uzaytirilgach
 * bu darhol «tugma ishlamadi» holatiga aylanardi — kassir xatodan
 * keyin darrov boshqa tugmani bosadi va hech narsa eshitmasdi.
 *
 * Endi himoya faqat BOSHIDA: «xato» ovozini «qo'shildi» bosib
 * ketmasligi uchun shuncha yetarli, undan keyin har amal o'z ovozini
 * oladi.
 */
export function activePri() {
  if (!ctx || !active) return 0;
  return ctx.currentTime < active.guard ? active.pri : 0;
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
 * @param spec `{ tone: [[gts, ms], …], w, gain, pri, url }` — `ek-sound.js` dan.
 */
export function play(spec) {
  const c = context();
  if (!c || !spec) return;
  /* Qulf hali ochilmagan bo'lsa ochishga urinamiz: ijro shu safar
     chiqmasligi mumkin, lekin keyingisi chiqadi. */
  if (c.state === "suspended") c.resume().catch(() => {});

  stop();

  const start = c.currentTime + 0.01;   // kichik zaxira: uzilib qolmasin

  /* ══ YOZILGAN OVOZ — BO'LSA (V93) ══════════════════════════════════
     ⚠ TARTIB AYNAN SHUNDAY: avval bufer tekshiriladi, YO'Q BO'LSA
     ohangga tushiladi. Teskarisi (avval yuklashni kutish) kassani jim
     qoldirardi — tarmoq sekin bo'lsa chek yopilgani eshitilmasdi.

     ⚠ `load()` shu yerda ham chaqiriladi: `prime()` o'tkazib
     yuborilgan bo'lsa (boshqa sahifadan kirish, eski sessiya) ovoz
     KEYINGI safar to'g'ri chiqsin. */
  if (spec.url) {
    const buf = buffers[spec.url];
    if (buf) {
      const src = c.createBufferSource();
      const gain = c.createGain();
      src.buffer = buf;
      /* ⚠ Yozuv allaqachon normallangan (cho'qqi 0.92), shuning uchun
         bu yerda faqat SOZLAMADAGI ovoz balandligi qo'llanadi. Ohang
         `gain` iga ko'paytirilsa, yozuv undan ikki barobar jim
         chiqardi — oilalarning `gain` i sintez uchun tanlangan. */
      gain.gain.setValueAtTime(Math.min(1, Math.max(0.0001, spec.vol ?? 1)), start);
      src.connect(gain);
      gain.connect(c.destination);
      src.start(start);
      const until = start + buf.duration;
      active = { nodes: [src], until,
                 guard: Math.min(until, start + GUARD_S), pri: spec.pri || 0 };
      return;
    }
    if (!(spec.url in buffers)) load(spec.url);
  }

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

  /* `guard` — pastroq ovozlarni to'sib turadigan qisqa oyna;
     `until` esa ohangning haqiqiy oxiri (kesish uchun kerak). */
  active = nodes.length
    ? { nodes, until: at, guard: Math.min(at, start + GUARD_S), pri: spec.pri || 0 }
    : null;
}
