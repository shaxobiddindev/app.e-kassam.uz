/* ══════════════════════════════════════════════════════════════════════════
   ZAL TERMINALI (3-bosqich D1, docs/22-RESTORAN.md)

   Restoranning umumiy monitori yoki planshet: rahbar bir marta parol bilan
   kiradi va smenani ochadi, keyin ofitsiantlar o'z PIN i bilan ishlaydi.
   Ekran harakatsizlikda va qulf tugmasida yopiladi.

   ⚠ BU QURILMA SOZLAMASI, xodimniki emas: `ek-session.js` dagi
   DEVICE_KEYS da turadi — chiqib-kirishda yo'qolmaydi. Kassa ham shu
   kompyuterda bo'lsa, terminal rejimini o'chirish — rahbarning ishi.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY = "ek_terminal";
const IDLE_KEY = "ek_terminal_idle";

/** Tanlanadigan qulf vaqtlari (soniya). */
export const IDLE_CHOICES = [30, 60, 120, 300];
export const IDLE_DEFAULT = 60;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* yopiq xotira */ } };

export const isTerminal = () => read(KEY) === "1";
export const setTerminal = (on) => write(KEY, on ? "1" : null);

export function idleSeconds() {
  const n = Number(read(IDLE_KEY));
  return IDLE_CHOICES.includes(n) ? n : IDLE_DEFAULT;
}
export const setIdleSeconds = (n) => write(IDLE_KEY, IDLE_CHOICES.includes(Number(n)) ? String(n) : null);

/** Qulf tugmasi va boshqa joylar shu hodisani yuboradi; `TerminalGate` tinglaydi. */
export const LOCK_EVENT = "ek:terminal-lock";
export const lockNow = () => window.dispatchEvent(new Event(LOCK_EVENT));

/** Qancha vaqt qoldi (ms) — oxirgi harakatdan beri. Sof funksiya, sinaladi. */
export const leftMs = (lastActivity, now, seconds) => Math.max(0, lastActivity + seconds * 1000 - now);

/**
 * Harakatsizlikni kuzatadi.
 *
 * ⚠ `pointermove` YO'Q: sichqoncha stolga tegib turgan monitorda o'zi
 * siljiydi va ekran hech qachon qulflanmasdi. Faqat bosish, tegish,
 * klaviatura va g'ildirak — ya'ni odamning niyati.
 *
 * @returns {{ stop(): void, last(): number }}
 */
export function watchIdle(seconds, onIdle) {
  let last = Date.now();
  let timer = null;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (leftMs(last, Date.now(), seconds) <= 0) onIdle();
      else arm();
    }, leftMs(last, Date.now(), seconds) + 50);
  };
  const touch = () => { last = Date.now(); };
  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  for (const e of events) window.addEventListener(e, touch, { passive: true, capture: true });
  arm();
  return {
    stop() {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, touch, { capture: true });
    },
    last: () => last,
  };
}
