import { feed } from "./ek-scale.js";

/* ══════════════════════════════════════════════════════════════════════════
   TAROZI PORTI (V111) — Web Serial

   Do'kon egasi: «tarozi sticker chiqarmaydi, monoblokka ulangan —
   kassa bilan aloqa qilishi kerak».

   ═══ NEGA WEB SERIAL, DRAYVER EMAS ═════════════════════════════════════

   Chek printeri ish stoli ilovasi (Tauri) orqali boshqariladi va u
   yerga yangi imkoniyat qo'shish YANGI O'RNATMA tarqatishni talab
   qiladi. Tarozi esa bugun kerak.

   `navigator.serial` — brauzerning o'z yo'li: Chrome/Edge (Windows,
   monoblokda aynan shular turadi) COM portni to'g'ridan-to'g'ri
   ochadi, HTTPS va foydalanuvchi bosgan tugma yetarli. USB tarozi ham
   shu ro'yxatda ko'rinadi (CH340/FTDI «COM3» bo'lib chiqadi).

   ⚠ ANDROID VA iOS DA YO'Q. Bu chegara yashirilmaydi: `available()`
   `false` qaytaradi va sozlamalar sahifasi sababini AYTADI. Tugmani
   ko'rsatib, bosilganda jim qolish eng yomon variant bo'lardi.

   ═══ ⚠ RUXSAT — FOYDALANUVCHI BOSGANDA ════════════════════════════════

   `requestPort()` FAQAT tugma bosilishidan chiqadi (brauzer talabi).
   Shuning uchun ulanish ikki qismga bo'lingan: `pick()` — tugmadan,
   `open()` — istalgan payt (ilgari berilgan ruxsat saqlanadi va
   sahifa qayta yuklanganda port QAYTA SO'RALMAYDI).
   ══════════════════════════════════════════════════════════════════════════ */

/** Brauzerda Web Serial bormi. */
export const available = () =>
  typeof navigator !== "undefined" && "serial" in navigator;

/**
 * Ilgari ruxsat berilgan portlar.
 *
 * ⚠ Sahifa har yuklanganda port QAYTA SO'RALMAYDI: ruxsat brauzerda
 * saqlanadi va kassir har smenada oyna ochishga majbur bo'lmasligi
 * kerak.
 */
export async function known() {
  if (!available()) return [];
  try { return await navigator.serial.getPorts(); } catch (_) { return []; }
}

/** Foydalanuvchi portni tanlaydi — FAQAT tugma bosilishidan. */
export async function pick() {
  if (!available()) throw new Error("no-serial");
  return navigator.serial.requestPort();
}

/**
 * Portni ochadi va o'qishni boshlaydi.
 *
 * @param port     `pick()` yoki `known()` dan
 * @param opts     `{ baudRate, dataBits, stopBits, parity }` — tarozining
 *                 sozlamasi bilan bir xil bo'lishi shart
 * @param onData   `(state, rawChunk) => void` — har bo'lakda chaqiriladi.
 *                 `state.kg` — og'irlik, `state.stable` — barqarormi.
 *                 `rawChunk` — XOM matn: formatni aniqlash uchun
 *                 sozlamalar sahifasida ko'rsatiladi.
 * @returns `stop()` — o'qishni to'xtatib, portni yopadi
 */
export async function open(port, opts = {}, onData = () => {}) {
  await port.open({
    baudRate: opts.baudRate ?? 9600,
    dataBits: opts.dataBits ?? 8,
    stopBits: opts.stopBits ?? 1,
    parity:   opts.parity   ?? "none",
  });

  const decoder = new TextDecoderStream();
  /* ⚠ Oqim ulanishi SAQLANADI: `stop()` da uni kutmasak, port band
     bo'lib qolar va ikkinchi marta ochib bo'lmasdi — kassir esa
     «tarozi ishlamayapti» deb monoblokni qayta yoqardi. */
  const closed = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();

  let stopped = false;
  let state = null;

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || stopped) break;
        if (!value) continue;
        state = feed(state, value);
        onData(state, value);
      }
    } catch (_) {
      /* Kabel sug'urib olindi yoki port yo'qoldi — bu XATO EMAS,
         odatiy hol. Chaqiruvchi buni `stop()` orqali biladi. */
    }
  })();

  return async function stop() {
    stopped = true;
    try { await reader.cancel(); } catch (_) { /* allaqachon yopiq */ }
    try { await closed; } catch (_) { /* yuqoridagi bilan bir xil */ }
    try { await port.close(); } catch (_) { /* allaqachon yopiq */ }
  };
}

/** Xom baytlarni O'QILADIGAN qilib ko'rsatish — formatni aniqlash uchun. */
export function visible(text) {
  return String(text ?? "")
    .replace(/\r/g, "␍")
    .replace(/\n/g, "␊\n")
    .replace(/\x02/g, "␂")
    .replace(/\x03/g, "␃");
}
