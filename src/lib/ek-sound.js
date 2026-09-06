/* ══════════════════════════════════════════════════════════════════════════
   OVOZLI BILDIRISHNOMA — VOQEALAR LUG'ATI VA QAROR (V89)

   ═══ NEGA UMUMAN OVOZ ══════════════════════════════════════════════════

   Kassir ekranga qaramaydi. U tovarga, mijozga va pulga qaraydi —
   ekran esa yon tomonda. Shuning uchun ekrandagi qizil yozuv ba'zan
   umuman ko'rilmaydi: skaner tovarni topmadi, kassir esa keyingisini
   skanerlashda davom etadi va buni faqat mijoz ketganda payqaydi.

   Ovoz — E'TIBORNI QAYTARADIGAN yagona kanal. Skaner apparatining
   o'zi ham aynan shu tilda gapiradi va kassir uni allaqachon biladi.

   ═══ IKKI XIL ULANISH ══════════════════════════════════════════════════

   1. AVTOMATIK — `useToast` orqali. Ilovada 138 ta `toast.*` chaqiruvi
      bor; ularning HAMMASI shu yerdan o'tadi va bittasiga ham tegilmadi.
   2. ANIQ — `sfx("SALE_DONE")` kabi, atigi bir nechta joyda: toast
      turi «xato/muvaffaqiyat» dan boshqa narsa ayta olmaydi, kassir
      esa AYNAN QAYSI voqea bo'lganini eshitishi kerak.

   ═══ ⚠ FAYL YO'Q, OHANG SINTEZ QILINADI ════════════════════════════════

   `.mp3` fayllari ATAYLAB ishlatilmadi:

     · bandl byudjeti CI qorovuli (`size-budget.json`) — base64 uni
       yiqitardi, alohida fayl esa har kassirga qo'shimcha so'rov;
     · serverda saqlash — disk iste'molchisi, VPS esa 2026-09-06 da
       aynan disk to'lganidan o'chgan;
     · OFLAYN majburiy: yuklanmagan fayl — ovozsiz kassa.

   Butun to'plam ~1 KB kod bo'lib chiqadi va uzilishda ham ishlaydi.

   ═══ ⚠ OVOZ HECH QACHON SOTUVNI BUZMAYDI ═══════════════════════════════

   `sfx()` istisno tashlamaydi va `Promise` qaytarmaydi. Sabab —
   pretsedent: V58 da sotuvdan keyingi yo'ldagi bitta `ReferenceError`
   tugmani abadiy «Bajarilmoqda…» da qoldirgan va kassa to'xtagan.
   Ovoz — qulaylik; u pul yo'liga bir tomchi ham xavf qo'sha olmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

import { getSettings } from "./ek-hw-settings.js";
import * as web from "./ek-sound-web.js";

/* ══ OHANG OILALARI — BESHTA, YIGIRMATA EMAS ═══════════════════════════
   Do'kon egasining umumiy qoidasi: ortiqcha element bo'lmasin. Ovozda
   ham shunday — yigirma xil ohangni hech kim yodlamaydi, beshtasi esa
   bir kunda o'rganiladi. Ekranda matn baribir bor; ovozning vazifasi —
   BOSHNI KO'TARTIRISH, hikoya aytish emas.

   Nota: `[chastota Gts, davomiyligi ms]`. Chastota 0 — pauza. */
/**
 * ⚠ EKSPORT QILINADI, chunki ikkita iste'molchi bor va ular AJRALIB
 * KETMASLIGI kerak: brauzerdagi adapter va `scripts/sfx-render.mjs`
 * (ohanglarni WAV faylga chiqaradi — do'kon egasi brauzer ochmasdan
 * eshitib ko'rishi uchun). Jadval ikki joyda yozilsa, eshitilgan
 * ohang bilan kassadagisi bir kuni boshqacha bo'lib qolardi.
 */
export const TONES = {
  /* Uch nota yuqoriga — «bo'ldi». Eng uzun ohang, chunki u kunda
     o'nlab marta emas, chek yopilganda bir marta eshitiladi. */
  DONE:  { tone: [[784, 80], [988, 80], [1319, 170]], w: "sine",     gain: 0.75 },
  /* Ikki nota yuqoriga — «yaxshi». */
  OK:    { tone: [[784, 70], [1047, 110]],            w: "sine",     gain: 0.60 },
  /* Bitta past — «diqqat». */
  WARN:  { tone: [[392, 150]],                        w: "triangle", gain: 0.70 },
  /* Ikki past, orasida pauza — «xato». Kassir buni boshqasi bilan
     adashtirmasligi kerak, shuning uchun u YAGONA ikki marta past. */
  ERROR: { tone: [[311, 120], [0, 60], [247, 190]],   w: "square",   gain: 0.55 },
  /* Juda qisqa — skaner «tik» i. Standart bo'yicha jim. */
  TICK:  { tone: [[1568, 45]],                        w: "square",   gain: 0.35 },
};

/**
 * VOQEALAR — YAGONA MANBA.
 *
 * `pri`  — prioritet (0…3). Yuqorisi pastini KESADI, past yoki teng
 *          bo'lgani esa TASHLANADI. Navbat ataylab yo'q: 3 soniyadan
 *          keyin chiyillagan ovoz allaqachon boshqa harakatga tegishli
 *          bo'ladi va kassirni chalg'itadi.
 * `gap`  — shu voqea qayta ijro etilishidan oldin o'tishi kerak bo'lgan
 *          vaqt. Kassada o'nta tovar ketma-ket skanerlanadi — o'nta
 *          chiyillash o'rniga bittasi kerak.
 * `on`   — standart bo'yicha yoqiqmi. ⚠ FAQAT BESHTASI YOQIQ: har
 *          harakatda ovoz chiqaradigan kassa birinchi kuni butunlay
 *          o'chiriladi va shundan keyin MUHIM ovozlar ham yo'qoladi.
 */
export const SFX = {
  /* ── Standart bo'yicha YOQIQ ─────────────────────────────────────── */
  SALE_DONE: { t: "DONE",  pri: 3, gap: 0,    on: true  },
  ERROR:     { t: "ERROR", pri: 3, gap: 600,  on: true  },
  WARN:      { t: "WARN",  pri: 2, gap: 600,  on: true  },
  /* Skaner tovarni topmadi — aynan ekranga qaramaydigan paytdagi voqea. */
  SCAN_MISS: { t: "WARN",  pri: 2, gap: 400,  on: true  },
  /* Uzilish: kassir buni BILISHI shart, chunki cheklar navbatga tushadi. */
  OFFLINE:   { t: "WARN",  pri: 2, gap: 5000, on: true  },

  /* ── Standart bo'yicha JIM ───────────────────────────────────────── */
  OK:        { t: "OK",    pri: 1, gap: 300,  on: false },
  INFO:      { t: "TICK",  pri: 1, gap: 300,  on: false },
  CART_ADD:  { t: "TICK",  pri: 1, gap: 120,  on: false },
  SYNCED:    { t: "OK",    pri: 2, gap: 3000, on: false },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Amaldagi sozlama — buzuq `localStorage` da ham ishlaydigan shakl.
 *
 * ⚠ `events` — FAQAT STANDARTDAN FARQLILARI. Ikkita ro'yxat (`on` va
 * `off`) o'rniga bitta xarita, chunki ikkita ro'yxatda «ikkalasida
 * ham bor» degan ma'nosiz holat paydo bo'lardi. Yozuv yo'q =
 * standart. Bu ERD dagi `shop_sound_events` qoidasining aynan o'zi:
 * qator yo'q — standart.
 *
 * ⚠ Yangi voqea qo'shilganda eski terminalda uning yozuvi bo'lmaydi,
 * ya'ni u STANDART bilan boshlanadi — bu to'g'ri xulq.
 */
export function config(raw) {
  const s = raw || getSettings().sound || {};
  const ev = s.events && typeof s.events === "object" ? s.events : {};
  /* ⚠ «Son emas» va «chegaradan tashqarida» — IKKI XIL holat.
     Ilgari ikkalasi ham standartga qaytardi va shu sababdan
     `volume: -5` 0.7 bo'lib chiqardi: foydalanuvchi ovozni nolga
     tushirmoqchi bo'lgan bo'lsa ham, kassa baland gapirardi.
     Endi son bo'lsa — KESILADI, bo'lmasa — standart. */
  const v = Number(s.volume);
  return {
    on: s.on !== false,
    volume: clamp(Number.isFinite(v) ? v : 0.7, 0, 1),
    events: ev,
  };
}

/** Voqea jimmi — foydalanuvchi tanlovi standartdan ustun. */
export function muted(event, cfg) {
  const def = SFX[event];
  if (!def) return true;
  const own = cfg.events[event];
  if (own === true) return false;
  if (own === false) return true;
  return !def.on;
}

/**
 * QAROR — SOF FUNKSIYA. Yon ta'siri yo'q, vaqt ham tashqaridan keladi:
 * shuning uchun uni brauzersiz, ovoz qurilmasisiz sinash mumkin
 * (`test/sound.test.mjs`) — headless Chromium'da ovoz qurilmasi yo'q va
 * ijroni «eshitib» tekshirib bo'lmaydi.
 *
 * @returns ijro spetsifikatsiyasi yoki `null` (ovoz chiqmaydi)
 */
export function decide(event, cfg, { lastAt = 0, activePri = 0, now = 0 } = {}) {
  const def = SFX[event];
  if (!def) return null;                       // noma'lum voqea — jimgina
  if (!cfg.on) return null;
  if (muted(event, cfg)) return null;
  /* ⚠ `lastAt <= 0` — «HECH QACHON chalinmagan», «vaqt nolida
     chalingan» EMAS. Ilgari bu farq yo'q edi va soat noldan
     boshlanadigan har qanday muhitda (sinov, `performance` asosidagi
     vaqt) birinchi ovoz jimgina yutilardi. */
  if (def.gap > 0 && lastAt > 0 && now - lastAt < def.gap) return null;
  /* ⚠ Muhimroq ovoz ijro etilayotgan bo'lsa — TEGILMAYDI. «Xato»
     hech qachon «qo'shildi» ostida qolib ketmasligi kerak. */
  if (activePri > def.pri) return null;

  const base = TONES[def.t];
  const gain = base.gain * cfg.volume;
  if (gain <= 0) return null;
  return { tone: base.tone, w: base.w, gain, pri: def.pri };
}

/**
 * Toast turini voqeaga aylantiradi.
 *
 * ⚠ Toast SATR oladi, voqea nomini emas — ya'ni undan faqat OG'IRLIK
 * bilinadi. Aynan qaysi voqea bo'lgani muhim bo'lgan joylarda `sfx()`
 * qo'lda chaqiriladi.
 */
export function fromToast(type) {
  return type === "error" ? "ERROR"
       : type === "warning" ? "WARN"
       : type === "success" ? "OK"
       : "INFO";
}

/* ══ IJRO — YAGONA YON TA'SIRLI QISM ═══════════════════════════════════ */

/** Voqea oxirgi marta qachon ijro etilgani. */
const lastAt = Object.create(null);

/**
 * Ovoz chiqaradi.
 *
 * ⚠⚠ ISTISNO TASHLAMAYDI VA `Promise` QAYTARMAYDI. Chaqiruvchi uni
 * `await` qila olmasligi ham ataylab: ovoz sotuvni bir millisekund
 * ham kutdirmasligi kerak.
 */
export function sfx(event) {
  try {
    const cfg = config();
    const now = Date.now();
    const spec = decide(event, cfg, { lastAt: lastAt[event] || 0, activePri: web.activePri(), now });
    if (!spec) return;
    lastAt[event] = now;
    web.play(spec);
  } catch (_) { /* ovoz hech qachon ishni to'xtatmaydi */ }
}

/**
 * Autoplay qulfini ochadi — birinchi foydalanuvchi imo-ishorasida.
 *
 * ⚠ USIZ BIRINCHI OVOZ JIMGINA YO'QOLADI: brauzer foydalanuvchi
 * sahifaga tegmaguncha ovozni rad etadi va buni faqat konsolda
 * aytadi. Kassa uchun bu «ishlamayapti» degani.
 */
export function prime() {
  try { web.prime(); } catch (_) { /* jim */ }
}

/**
 * Sozlamadagi «sinab ko'rish» — chegaralarni CHETLAB o'tadi.
 *
 * ⚠ Kerak, chunki ovoz jimgina yo'qolishi mumkin (ADR-3): egasi uni
 * eshitib tekshira olmasa, nosozlikni umuman aniqlay olmaydi.
 */
export function preview(event, cfg) {
  try {
    const c = config(cfg);
    const def = SFX[event];
    if (!def) return;
    const base = TONES[def.t];
    const gain = base.gain * (c.volume || 0.7);
    web.play({ tone: base.tone, w: base.w, gain, pri: 3 });
  } catch (_) { /* jim */ }
}
