import { available, known, open, POLL } from "./ek-serial.js";

/* ══════════════════════════════════════════════════════════════════════════
   TAROZI ULANISHI — BUTUN ILOVA UCHUN BITTA (V111)

   Do'kon egasi: «tarozi kassa bilan aloqa qilishi kerak».

   ═══ NEGA KOMPONENTDA EMAS, MODULDA ════════════════════════════════════

   Birinchi urinishda port sozlamalar panelining ichida ochilardi va
   do'kon darhol ikkita muammoga urildi:

     · boshqa bo'limga o'tib qaytganda ulanish uzilib qolardi
       («yana eski holatga qaytib qolyapti»);
     · kassada esa tarozi umuman yo'q edi — panel u yerda chizilmaydi.

   Port — QURILMA, sahifaning bir qismi emas. Shuning uchun u modul
   darajasida yashaydi: bir marta ulanadi, sahifalar almashaveradi,
   kassa ham, sozlamalar ham o'sha bitta oqimni tinglaydi.

   ═══ ⚠ RUXSAT BIR MARTA SO'RALADI ══════════════════════════════════════

   Brauzer portni faqat tugma bosilganda tanlatadi, lekin ruxsatni
   ESLAB QOLADI. Shuning uchun kassa ochilganda `resume()` chaqiriladi:
   u ilgari ruxsat berilgan portni oynasiz ochadi. Kassir har smenada
   sozlamalarga kirib o'tirmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

const LS = "ek_scale_port";

export const readCfg = () => {
  try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (_) { return {}; }
};
export const writeCfg = (v) => {
  try { localStorage.setItem(LS, JSON.stringify(v)); } catch (_) { /* shaxsiy oyna */ }
};

/* Joriy holat — obunachilar shuni oladi. */
let state = { on: false, kg: null, stable: false, bytes: [] };
let stopFn = null;
let starting = null;
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
 * Portni ochadi va oqimni boshlaydi.
 *
 * ⚠ IKKI MARTA OCHILMAYDI: bir vaqtda ikkita o'quvchi bo'lsa port
 * band bo'lib qolar va ikkalasi ham hech narsa olmasdi.
 */
export async function start(port, opts = {}) {
  if (stopFn) await stop();
  if (starting) return starting;
  starting = (async () => {
    const key = opts.poll || readCfg().poll || "ENQ_DC1";
    const baudRate = Number(opts.baudRate || readCfg().baudRate || 9600);
    stopFn = await open(port, {
      baudRate,
      poll: POLL[key]?.bytes || [],
      after: POLL[key]?.after || [],
      pollMs: 700,
    }, (st, chunk) => {
      /* ⚠ Oxirgi 128 bayt — tashxis oynasi uchun. Ko'proq saqlash
         xotirani cheksiz o'stirardi. */
      const bytes = state.bytes.concat(Array.from(chunk)).slice(-128);
      state = { on: true, kg: st.kg, stable: st.stable, bytes };
      emit();
    });
    state = { ...state, on: true };
    writeCfg({ ...readCfg(), baudRate, poll: key, enabled: true });
    emit();
  })();
  try { await starting; } finally { starting = null; }
}

export async function stop() {
  const fn = stopFn;
  stopFn = null;
  try { await fn?.(); } catch (_) { /* allaqachon yopiq */ }
  state = { on: false, kg: null, stable: false, bytes: state.bytes };
  writeCfg({ ...readCfg(), enabled: false });
  emit();
}

/**
 * ILGARI RUXSAT BERILGAN portni oynasiz ochadi.
 *
 * ⚠ Faqat do'kon o'zi YOQIB QO'YGAN bo'lsa (`enabled`). Aks holda
 * tarozisi yo'q do'konda ham har ochilishda port qidirilardi va
 * brauzer konsoli xatoga to'lardi.
 */
export async function resume() {
  if (!available() || stopFn || !readCfg().enabled) return false;
  const ports = await known();
  if (!ports.length) return false;
  try { await start(ports[0]); return true; } catch (_) { return false; }
}
