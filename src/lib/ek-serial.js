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

  /* ⚠⚠ XOM BAYTLAR O'QILADI, MATN EMAS.

     Birinchi urinishda `TextDecoderStream` (UTF-8) ishlatilgan edi va u
     aynan tashxis qo'yish kerak bo'lgan narsani YO'Q QILARDI: tarozi
     ikkilik protokolda gapirsa, baytlar «▯» (almashtirish belgisi)
     bo'lib qolar va ularning HAQIQIY QIYMATI butunlay yo'qolardi.
     Do'kon ekranda kvadratchalar ko'rdi, men esa ulardan hech narsa
     ayta olmadim.

     Endi baytlar o'z holicha keladi: ular HEX bo'lib ko'rsatiladi
     (protokolni aynan shu aniqlaydi), matnga esa `latin1` bilan
     o'giriladi — har bayt bitta belgiga to'g'ri keladi va ASCII
     raqamlar buzilmaydi. */
  const reader = port.readable.getReader();
  const closed = Promise.resolve();

  /* ⚠ Yozuvchi o'qish halqasidan OLDIN olinadi: halqa ichida ACK ga
     javob yuboriladi va u paytda `writer` allaqachon tayyor
     bo'lishi kerak. */
  const writer = port.writable?.getWriter?.() || null;
  async function ask(bytes) {
    if (!writer || !bytes?.length) return;
    try { await writer.write(new Uint8Array(bytes)); } catch (_) { /* port yopildi */ }
  }

  let stopped = false;
  let state = null;

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || stopped) break;
        if (!value?.length) continue;
        state = feed(state, latin1(value));

        /* ══ ⚠ QO'L BERISH: ENQ → ACK → BUYRUQ ═══════════════════════
           Do'kon oqimida ketma-ket «06 06 06…» chiqdi. `06` — ACK,
           ya'ni tarozi so'rovni OLDI va «eshitdim» dedi, lekin
           og'irlikni bermadi.

           Bu keng tarqalgan uch qadamli suhbat: kassa ENQ yuboradi,
           tarozi ACK bilan javob beradi, keyin kassa ASOSIY buyruqni
           yuboradi va shundagina o'lchov keladi. Ikkinchi qadamda
           to'xtab qolgan kassa abadiy «06» yig'ib o'tiraveradi.

           ⚠ Javob HAR ACK ga yuboriladi: suhbat sikli shunday va
           bittasini o'tkazib yuborish oqimni to'xtatib qo'yardi. */
        if (opts.after?.length && value.includes(0x06)) ask(opts.after);

        onData(state, value);
      }
    } catch (_) {
      /* Kabel sug'urib olindi yoki port yo'qoldi — bu XATO EMAS,
         odatiy hol. Chaqiruvchi buni `onEnd` orqali biladi. */
    }

    /* ⚠ OQIM O'LGANI AYTILADI (V112). Ilgari halqa jimgina
       tugardi va yuqoridagi qatlam «ulangan» deb turaverardi:
       ekranda oxirgi og'irlik QOTIB qolardi va kassir uni
       yangi tovarniki deb o'ylashi mumkin edi.

       Biz o'zimiz to'xtatgan bo'lsak — xabar yo'q, bu odatiy
       yopilish. */
    if (!stopped) { try { opts.onEnd?.(); } catch (_) { /* chaqiruvchi xatosi */ } }
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
  let timer = null;

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
 * Portning belgisi — QAYSI qurilma ekanini eslab qolish uchun.
 *
 * ⚠ Port obyektining O'ZI saqlab bo'lmaydi: u sahifa bilan birga
 * yo'qoladi. `getInfo()` esa USB sotuvchi/mahsulot raqamlarini
 * beradi va monoblokka bir nechta qurilma ulangan bo'lsa
 * (chek printeri, skaner, tarozi) aynan tarozini tanlashga yetadi.
 *
 * Ichki COM portlarda (RS-232) bu raqamlar bo'lmaydi — o'shanda
 * bo'sh satr qaytadi va tanlov boshqa yo'l bilan qilinadi.
 */
export function portId(port) {
  try {
    const i = port?.getInfo?.() || {};
    if (i.usbVendorId == null && i.usbProductId == null) return "";
    return `${i.usbVendorId ?? "?"}:${i.usbProductId ?? "?"}`;
  } catch (_) { return ""; }
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

  /* ══ ⚠ UCH QADAMLI SUHBAT ═══════════════════════════════════════════
     Do'kon tarozisi ENQ ga «06» (ACK) bilan javob berdi va to'xtadi —
     demak u ikkinchi buyruqni kutmoqda. `after` aynan shu: ACK
     kelganda yuboriladigan ASOSIY buyruq.

     Qaysi bayt to'g'ri ekanini tarozining o'zi ko'rsatadi, shuning
     uchun bir nechtasi tayyor turadi va birma-bir sinaladi. */
  ENQ_DC1: { label: "ENQ → ACK → DC1 (11)", bytes: [0x05], after: [0x11] },
  ENQ_DC2: { label: "ENQ → ACK → DC2 (12)", bytes: [0x05], after: [0x12] },
  ENQ_ENQ: { label: "ENQ → ACK → ENQ (05)", bytes: [0x05], after: [0x05] },
  ENQ_W:   { label: "ENQ → ACK → W",        bytes: [0x05], after: [0x57, 0x0D, 0x0A] },

  /* Ba'zi tarozilar harf kutadi. */
  W:    { label: "W", bytes: [0x57, 0x0D, 0x0A] },
  S:    { label: "S (SICS)", bytes: [0x53, 0x0D, 0x0A] },
  P:    { label: "P", bytes: [0x50, 0x0D, 0x0A] },
  /* «Штрих» oilasidagi ba'zi modellar. */
  ESC_P:{ label: "ESC P", bytes: [0x1B, 0x50] },
};

/**
 * Baytlarni matnga — HAR BAYT BITTA BELGI (`latin1`).
 *
 * ⚠ UTF-8 EMAS. Ikkilik protokolda UTF-8 dekodlash baytlarni «▯» ga
 * aylantirib, qiymatini yo'qotadi. `latin1` esa hech qachon
 * yiqilmaydi va ASCII raqamlar (tarozilarning ko'pchiligi shunday
 * yuboradi) o'z holicha qoladi.
 */
export function latin1(bytes) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

/**
 * HEX ko'rinish — PROTOKOLNI AYNAN SHU ANIQLAYDI.
 *
 * ⚠ Yonida ASCII ustuni ham bo'ladi: ko'p tarozi raqamlarni matn
 * bilan yuboradi va o'shanda javob bir qarashda ko'rinadi. Faqat hex
 * bo'lsa, oddiy «ST,GS,0.123kg» ni ham o'qish uchun jadval kerak
 * bo'lardi.
 *
 * @param bytes  `Uint8Array` yoki baytlar massivi
 * @param width  bir qatordagi bayt soni
 */
export function hexDump(bytes, width = 16) {
  const arr = Array.from(bytes || []);
  const lines = [];
  for (let i = 0; i < arr.length; i += width) {
    const row = arr.slice(i, i + width);
    const hex = row.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    /* Ko'rinmaydigan baytlar nuqta bilan — aks holda qator buzilardi. */
    const txt = row.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${hex.padEnd(width * 3 - 1)}  ${txt}`);
  }
  return lines.join("\n");
}
