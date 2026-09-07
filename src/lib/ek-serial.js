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

  /* ⚠ DTR/RTS KO'TARILADI. Ko'p USB-tarozi va RS-232 qurilma bu ikki
     signalsiz UMUMAN gapirmaydi: kabel ulangan, port ochiq, ekranda
     esa jimlik. Windows dasturlari ularni o'zi ko'taradi va shu sabab
     «boshqa dasturda ishlaydi-ku» degan holat kelib chiqadi.

     Qo'llab-quvvatlamaydigan adapterda xato tashlanadi va u
     yutiladi — signalsiz ham ishlaydigan tarozilar bor. */
  try {
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  } catch (_) { /* adapter bu signallarni bilmaydi */ }

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

  /* ══ ⚠ SO'ROV YUBORISH ═══════════════════════════════════════════════

     Tarozilar ikki xil ishlaydi va bu FARQ eng ko'p vaqt yeydigan joy:

       · UZLUKSIZ — ustiga narsa qo'yilishi bilan o'zi yuboraveradi;
       · SO'ROV BO'YICHA — kassa so'ramaguncha JIM turadi.

     Ikkinchisida port ochiq bo'ladi, kabel joyida bo'ladi, ekranda esa
     hech narsa chiqmaydi — va buni «tarozi buzuq» deb o'ylash juda
     oson. Shuning uchun so'rov yuborish YO'LI BOR va u sozlamalarda
     tanlanadi.

     Buyruq har tarozida boshqacha (`ENQ`, «W», «S», «P»…), shuning
     uchun u TANLANADI, kodga yozib qo'yilmaydi. */
  const writer = port.writable?.getWriter?.() || null;
  let timer = null;

  async function ask(bytes) {
    if (!writer || !bytes?.length) return;
    try { await writer.write(new Uint8Array(bytes)); } catch (_) { /* port yopildi */ }
  }

  if (opts.poll?.length) {
    /* ⚠ Birinchi so'rov DARHOL: kassir tugmani bosgach javobni
       kutadi, bir soniya jimlik esa «ishlamadi» degan taassurot
       beradi. */
    ask(opts.poll);
    timer = setInterval(() => ask(opts.poll), Math.max(200, opts.pollMs ?? 500));
  }

  return async function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    try { writer?.releaseLock(); } catch (_) { /* allaqachon bo'shatilgan */ }
    try { await reader.cancel(); } catch (_) { /* allaqachon yopiq */ }
    try { await closed; } catch (_) { /* yuqoridagi bilan bir xil */ }
    try { await port.close(); } catch (_) { /* allaqachon yopiq */ }
  };
}

/**
 * Keng tarqalgan so'rov buyruqlari.
 *
 * ⚠ RO'YXAT — TAXMIN EMAS, TANLOV. Qaysi biri to'g'ri ekanini faqat
 * tarozining o'zi ko'rsatadi: sozlamalarda birma-bir sinaladi va
 * javob kelgani XOM OQIMDA darhol ko'rinadi.
 */
export const POLL = {
  NONE: { label: "—", bytes: [] },
  /* `ENQ` (0x05) — CAS va unga o'xshaganlarda eng keng tarqalgani. */
  ENQ:  { label: "ENQ (05)", bytes: [0x05] },
  /* Ba'zi tarozilar harf kutadi. */
  W:    { label: "W", bytes: [0x57, 0x0D, 0x0A] },
  S:    { label: "S (SICS)", bytes: [0x53, 0x0D, 0x0A] },
  P:    { label: "P", bytes: [0x50, 0x0D, 0x0A] },
  /* «Штрих» oilasidagi ba'zi modellar. */
  ESC_P:{ label: "ESC P", bytes: [0x1B, 0x50] },
};

/** Xom baytlarni O'QILADIGAN qilib ko'rsatish — formatni aniqlash uchun. */
export function visible(text) {
  return String(text ?? "")
    .replace(/\r/g, "␍")
    .replace(/\n/g, "␊\n")
    .replace(/\x02/g, "␂")
    .replace(/\x03/g, "␃");
}
