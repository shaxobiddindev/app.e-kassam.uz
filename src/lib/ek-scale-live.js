import { available, isNative, known, open, portId, POLL } from "./ek-serial.js";
import { persistDevice } from "./ek-device-store.js";

/* ═══════════════════════════════════════════════════════════════════════════
   TAROZI ULANISHI — BUTUN ILOVA UCHUN BITTA (V111, V112)

   Do'kon egasi: «tarozi kassa bilan aloqa qilishi kerak».

   ═══ NEGA KOMPONENTDA EMAS, MODULDA ════════════════════════════

   Birinchi urinishda port sozlamalar panelining ichida ochilardi va
   do'kon darhol ikkita muammoga urildi:

     · boshqa bo'limga o'tib qaytganda ulanish uzilib qolardi
       («yana eski holatga qaytib qolyapti»);
     · kassada esa tarozi umuman yo'q edi — panel u yerda chizilmaydi.

   Port — QURILMA, sahifaning bir qismi emas. Shuning uchun u modul
   darajasida yashaydi: bir marta ulanadi, sahifalar almashaveradi,
   kassa ham, sozlamalar ham o'sha bitta oqimni tinglaydi.

   ═══ ⚠ QO'LDA ULASH — FAQAT BIR MARTA (V112) ═══════════════════

   Do'kon: «har safar tarozini ulayverish yaxshi emas». Haq gap:
   kassir smenani sozlamalar sahifasidan boshlamasligi kerak.

   Brauzer portni FAQAT tugma bosilganda tanlatadi — lekin ruxsatni
   ESLAB QOLADI (Chrome uni sayt sozlamalarida saqlaydi). Ya'ni
   «tanlash» bir marta bo'ladi, «ochish» esa keyin oynasiz.

   Shuning uchun bu modul ilova ishga tushganda `autoConnect()` bilan
   uyg'onadi va uchta holatni O'ZI ko'taradi:

     1. ILOVA OCHILDI — ilgari ruxsat berilgan port oynasiz ochiladi;
     2. USB SUG'URILDI/QAYTA ULANDI — brauzerning `connect` hodisasi
        tutiladi va ulanish tiklanadi;
     3. OQIM O'LDI YOKI JIMIB QOLDI — qorovul buni sezadi va qaytadan
        ochadi (monoblok uyqudan chiqqanda aynan shunday bo'ladi).

   ⚠ FAQAT DO'KON O'ZI YOQIB QO'YGAN BO'LSA (`enabled`). Tarozisi
   yo'q do'konda hech narsa qidirilmaydi va konsol xatoga to'lmaydi.
   ═══════════════════════════════════════════════════════════════════════════ */

const LS = "ek_scale_port";

/* Qorovul qadami va jimlik chegarasi. */
const TICK_MS = 3000;
const SILENT_MS = 8000;
/* Ulanmasa — tobora kamroq urinish (30 soniyagacha). */
const RETRY_MAX = 30_000;

export const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (_) { return {}; }
};
export const writeCfg = (v) => {
  try { localStorage.setItem(LS, JSON.stringify(v)); } catch (_) { /* shaxsiy oyna */ }
  /* Desktop'da nusxa ilova faylida ham — WebView xotirasi yo'qolsa ham tiklanadi. */
  persistDevice();
};

/* Joriy holat — obunachilar shuni oladi. */
let state = { on: false, kg: null, stable: false, bytes: [] };
let stopFn = null;
let starting = null;
let lastAt = 0;
let watching = false;
let retryAt = 0;
let fails = 0;
const subs = new Set();

const emit = () => { for (const fn of subs) { try { fn(state); } catch (_) { /* obunachi xatosi oqimni to'xtatmasin */ } } };

/** Holatga obuna. Qaytadi: obunani bekor qiluvchi funksiya. */
export function subscribe(fn) {
  subs.add(fn);
  fn(state);
  return () => subs.delete(fn);
}

export const snapshot = () => state;

/** Ulanganmi. */
export const isOn = () => state.on;

/**
 * Ro'yxatdan KERAKLI portni tanlaydi.
 *
 * ⚠ Ilgari shunchaki birinchisi olinardi. Monoblokka odatda bir
 * nechta ketma-ket qurilma ulanadi (chek printeri, skaner, tarozi)
 * va «birinchisi» ularning ichida chek printeri bo'lib chiqishi
 * mumkin edi — o'shanda tarozi jim, printer esa axlat qabul qiladi.
 *
 * Endi ulangan port belgisi eslab qolinadi va aynan o'sha qidiriladi.
 */
export function pickPort(ports, id) {
  if (!ports?.length) return null;
  if (id) {
    const hit = ports.find((p) => portId(p) === id);
    if (hit) return hit;
    /* ⚠ Belgi mos kelmadi — lekin port BITTA bo'lsa, u o'sha
       qurilmaning o'zi (adapter almashtirilgan bo'lishi mumkin).
       Ikkitadan ko'p bo'lsa taxmin qilinmaydi. */
    if (ports.length === 1) return ports[0];
    return null;
  }
  return ports[0];
}

/**
 * Portni ochadi va oqimni boshlaydi.
 *
 * ⚠ IKKI MARTA OCHILMAYDI: bir vaqtda ikkita o'quvchi bo'lsa port
 * band bo'lib qolar va ikkalasi ham hech narsa olmasdi.
 */
export async function start(port, opts = {}) {
  if (starting) return starting;
  starting = (async () => {
    /* ⚠ `close`, `stop` EMAS: qayta ulanishda «avtomatik» sozlamasi
       o'chib ketmasligi kerak. */
    if (stopFn) await close(true);
    const key = opts.poll || readCfg().poll || "ENQ_DC1";
    const baudRate = Number(opts.baudRate || readCfg().baudRate || 9600);
    lastAt = Date.now();
    stopFn = await open(port, {
      baudRate,
      poll: POLL[key]?.bytes || [],
      after: POLL[key]?.after || [],
      pollMs: 700,
      /* Oqim o'z-o'zidan tugadi — qorovul buni kutib o'tirmasin. */
      onEnd: () => { close(true); },
    }, (st, chunk) => {
      /* ⚠ Oxirgi 128 bayt — tashxis oynasi uchun. Ko'proq saqlash
         xotirani cheksiz o'stirardi. */
      const bytes = state.bytes.concat(Array.from(chunk)).slice(-128);
      lastAt = Date.now();
      /* ⚠ HISOB PORT OCHILGANDA EMAS, BAYT KELGANDA tozalanadi
         (V114). Tarozi o'chiq bo'lsa port BARIBIR ochiladi: kabel
         joyida, adapter javob beradi, o'lchov esa yo'q. Hisob
         o'shanda ham nolga tushsa, kutish oralig'i hech qachon
         o'smas va ilova har 11 soniyada portni ochib-yopib turardi —
         panelda holat yashildan sariqqa sakrab, «ishlayaptimi yoki
         yo'qmi?» degan savol tug'dirardi. */
      if (fails) { fails = 0; retryAt = 0; }
      state = { on: true, kg: st.kg, stable: st.stable, bytes };
      emit();
    });
    state = { ...state, on: true };
    writeCfg({ ...readCfg(), baudRate, poll: key, id: portId(port), name: port?.name || "",
               enabled: true, off: false });
    emit();
  })();
  try { await starting; } finally { starting = null; }
}

/**
 * Portni yopadi.
 *
 * @param keep  `true` — «avtomatik ulanish» yoqilganicha qoladi
 *              (uzilish vaqtinchalik, o'zi tiklanadi);
 *              `false` — do'kon O'ZI o'chirdi, boshqa urinilmaydi.
 */
async function close(keep) {
  const fn = stopFn;
  stopFn = null;
  try { await fn?.(); } catch (_) { /* allaqachon yopiq */ }
  /* ⚠ `kg` TOZALANADI. Ekranda oxirgi og'irlik qotib qolsa, kassir
     uni yangi tovarniki deb o'ylab, noto'g'ri miqdorni chekka
     tushirardi. */
  state = { on: false, kg: null, stable: false, bytes: state.bytes };
  /* `off` — do'kon O'ZI uzdi: avtomatik topish ham uni qayta ulamasin. */
  if (!keep) writeCfg({ ...readCfg(), enabled: false, off: true });
  emit();
}

/** Do'kon o'zi uzdi — avtomatik ulanish ham o'chadi. */
export async function stop() { await close(false); }

/**
 * ILGARI RUXSAT BERILGAN portni oynasiz ochadi.
 *
 * ⚠ Faqat do'kon o'zi YOQIB QO'YGAN bo'lsa (`enabled`). Aks holda
 * tarozisi yo'q do'konda ham har ochilishda port qidirilardi va
 * brauzer konsoli xatoga to'lardi.
 */
export async function resume() {
  if (!available() || stopFn || starting || !readCfg().enabled) return false;
  const ports = await known();
  const port = pickPort(ports, readCfg().id);
  if (!port) return false;
  try { await start(port); return true; } catch (_) { return false; }
}

/** Brauzer ruxsatini ham qaytaradi — tarozi butunlay unutiladi. */
export async function forget() {
  await close(false);
  const port = pickPort(await known(), readCfg().id);
  try { await port?.forget?.(); } catch (_) { /* eski Chrome bilmaydi */ }
  /* Unutildi — yangi tarozi ulansa, avtomatik topish uni o'zi tanlasin. */
  writeCfg({ ...readCfg(), enabled: false, id: "", off: false });
}

/* ══ AVTOMATIK TOPISH — DESKTOP (2026-10-05) ════════════════════════════════
   Egasi: «avto sozlaydigan qil, xuddi stikernikidek». Desktop'da port ro'yxati
   ruxsatsiz ko'rinadi, demak tarozini ilova O'ZI topa oladi: USB adapterlar
   birma-bir ochiladi, keng tarqalgan tezlik va so'rovlar sinaladi va og'irlik
   ramkasi kelgan birinchi juftlik saqlanadi. Bo'sh tarozi ham «0.000 kg»
   yuboradi — topish uchun ustiga narsa qo'yish shart emas.

   ⚠ FAQAT USB-SERIAL ADAPTERLAR (CH340, FTDI, Prolific, CP210x) o'zi sinaladi.
   Boshqa COM portga ham ENQ yoki «W» yuborilsa, u ketma-ket chek printeri
   bo'lib chiqishi va qog'ozga axlat bosishi mumkin edi. Ichki COM portni
   (RS-232) do'kon «Avtomatik topish» tugmasi bilan o'zi sinatadi. */
const ADAPTERS = new Set([0x1A86, 0x0403, 0x067B, 0x10C4]);
const isAdapter = (p) => p?.kind === "usb" && (ADAPTERS.has(p.vid)
  || /ch34|serial|uart|usb.?to|cp210|ftdi|prolific|scale|tarozi|весы/i.test(`${p.product || ""} ${p.manufacturer || ""}`));

/** Sinash tartibi: avval eslab qolingan juftlik, keyin eng ko'p uchraydiganlari. */
function combos() {
  const cfg = readCfg();
  const base = [[9600, "ENQ_DC1"], [9600, "NONE"], [9600, "ENQ"], [9600, "W"], [9600, "S"],
    [4800, "ENQ_DC1"], [4800, "NONE"], [19200, "NONE"], [2400, "NONE"], [9600, "P"]];
  const saved = cfg.baudRate && cfg.poll ? [[Number(cfg.baudRate), cfg.poll]] : [];
  const seen = new Set();
  return [...saved, ...base].filter(([b, k]) => {
    const key = `${b}/${k}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Bitta port + tezlik + so'rov: og'irlik ramkasi kelsa `true`. */
async function probe(port, baudRate, pollKey, ms = 1500) {
  let got = false;
  let stopProbe = null;
  try {
    stopProbe = await open(port, {
      baudRate, poll: POLL[pollKey]?.bytes || [], after: POLL[pollKey]?.after || [], pollMs: 300,
    }, (st) => { if (st?.kg != null) got = true; });
    const until = Date.now() + ms;
    while (!got && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  } catch (_) { /* port band yoki yo'q */ }
  try { await stopProbe?.(); } catch (_) { /* allaqachon yopiq */ }
  return got;
}

let detecting = null;
let detectSig = "";

/**
 * Tarozini o'zi topadi va ulaydi. Topilsa `{ name, baudRate, poll }`, aks holda `null`.
 *
 * @param all  `true` — barcha COM portlar (do'kon tugmani bosdi); aks holda faqat USB adapterlar
 * @param onStep  `(text) => void` — panelda «COM3 · 9600 · ENQ» ko'rsatish uchun
 */
export function autoDetect({ all = false, onStep } = {}) {
  if (detecting) return detecting;
  detecting = (async () => {
    if (!isNative()) return null;
    if (stopFn) await close(true);
    const ports = (await known()).filter((p) => (all ? p.kind !== "bluetooth" : isAdapter(p)));
    for (const port of ports) {
      for (const [baudRate, poll] of combos()) {
        onStep?.(`${port.name} · ${baudRate} · ${POLL[poll]?.label || poll}`);
        if (await probe(port, baudRate, poll)) {
          await start(port, { baudRate, poll });
          return { name: port.name, baudRate, poll };
        }
      }
    }
    return null;
  })();
  return detecting.finally(() => { detecting = null; });
}

/**
 * Qorovul qadami — uzilishni sezadi va qaytadan ulanadi.
 *
 * ⚠ JIMLIK QOROVULI FAQAT SO'ROV YUBORILAYOTGANDA ishlaydi. Biz
 * har 0.7 soniyada so'rab tursak, 8 soniya jimlik — uzilish. Lekin
 * so'rov «—» (NONE) bo'lsa, tarozi o'zi xohlaganda gapiradi va
 * jimlik mutlaqo odatiy hol: o'shanda portni uzish faqat ziyon
 * qilardi.
 */
async function tick() {
  const cfg = readCfg();
  if (!cfg.enabled) {
    /* Desktop: tarozi hali tanishtirilmagan (yoki sozlama yo'qolgan) va do'kon
       uni o'zi uzmagan — USB adapterlar ro'yxati o'zgarganda bir marta sinaladi.
       Ro'yxat o'sha bo'lsa takrorlanmaydi: har 3 soniyada port ochib-yopish
       boshqa qurilmalarga xalaqit berardi. */
    if (!isNative() || cfg.off || detecting || starting) return;
    const ports = (await known()).filter(isAdapter);
    const sig = ports.map((p) => `${p.name}:${p.vid}:${p.pid}`).sort().join("|");
    if (!sig || sig === detectSig) return;
    detectSig = sig;
    await autoDetect();
    return;
  }

  if (stopFn) {
    const polling = (POLL[cfg.poll]?.bytes || []).length > 0;
    if (polling && state.on && Date.now() - lastAt > SILENT_MS) {
      await close(true);
      /* Ochildi, lekin jim — bu ham muvaffaqiyatsizlik: keyingi
         urinish kechroq bo'ladi. */
      fails += 1;
      retryAt = Date.now() + Math.min(RETRY_MAX, 2000 * fails);
    }
    return;
  }

  if (starting || Date.now() < retryAt) return;
  const okay = await resume();
  if (!okay) {
    fails += 1;
    retryAt = Date.now() + Math.min(RETRY_MAX, 2000 * fails);
  }
}

/**
 * AVTOMATIK ULANISHNI YOQADI — ilova ishga tushganda bir marta.
 *
 * ⚠ IKKI MARTA CHAQIRILSA HAM BIR MARTA ishlaydi: React ishlab
 * chiqish rejimida effektlarni ikki marta yuritadi va ikkita qorovul
 * bir portni tortishtirib qo'yardi.
 */
export function autoConnect() {
  if (watching || !available()) return;
  watching = true;

  /* Qurilma qaytib ulandi — kutib o'tirmaymiz. (Desktop'da `navigator.serial`
     bo'lmasligi mumkin — u yerda qorovul ro'yxat o'zgarishini o'zi sezadi.) */
  navigator.serial?.addEventListener?.("connect", () => {
    fails = 0; retryAt = 0;
    resume();
  });
  /* Sug'urib olindi — holat darhol tozalanadi, «avtomatik» qoladi. */
  navigator.serial?.addEventListener?.("disconnect", () => {
    if (stopFn) close(true);
  });

  resume();
  setInterval(tick, TICK_MS);
}
