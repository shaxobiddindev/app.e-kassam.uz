/* ══════════════════════════════════════════════════════════════════════════
   TAROZIDAN KELGAN OQIMNI O'QISH (V111) — SOF MANTIQ

   Do'kon egasi: «bir do'konda smart tarozi bor, lekin sticker
   chiqarmaydi; monoblokka ulangan, kassa bilan aloqa qilishi kerak».

   Tarozi: MERTECH M-ER 328ACPX LED (Max 15 kg, e = 2 g).

   ═══ NEGA SOF FUNKSIYA ═════════════════════════════════════════════════

   Bu yerda chiqadigan son TO'G'RIDAN-TO'G'RI CHEKKA tushadi. Portni
   ochish, uzilishni kutish, qayta ulanish — bularning hammasi
   brauzerda sinaladi; RAQAMNI AJRATIB OLISH esa aynan shu yerda va
   uni yozib qo'yilgan haqiqiy oqimlarda sinash mumkin
   (`test/scale.test.mjs`).

   ═══ ⚠ FORMAT BITTA EMAS ═══════════════════════════════════════════════

   Tarozilar bir xil gapirmaydi va bitta model ham sozlamasiga qarab
   boshqacha yuborishi mumkin. Uch oila keng tarqalgan:

     · CAS / Mettler-Toledo ASCII — «ST,GS,   0.123kg\r\n»
       (ST = barqaror, US = tebranmoqda, GS = brutto, NT = netto);
     · sodda ASCII — faqat son va birlik: «  0.123 kg\r\n»;
     · uzluksiz oqim — ramkalarsiz, har 100 ms da yangi qiymat.

   Shuning uchun o'qish IKKI QADAM: avval oqim ramkalarga bo'linadi,
   keyin har ramkadan son qidiriladi. Ramkani tanimasa ham son
   topiladi — «tanimadim» deb jim turgandan ko'ra, kassirga raqam
   ko'rsatgan afzal (u baribir tarozining ekrani bilan solishtiradi).

   ═══ ⚠ BARQARORLIK — ENG MUHIM BELGI ═══════════════════════════════════

   Tortilayotgan tovar tebranib turadi va oqimda o'nlab oraliq qiymat
   keladi. Ularning birortasi chekka tushmasligi kerak: savatga faqat
   BARQAROR o'lchov qo'shiladi. Tarozi buni o'zi aytadi (`ST`); aytmasa
   esa qiymat bir necha o'qishda O'ZGARMAY tursa barqaror deb
   hisoblanadi (`stableOf`).
   ══════════════════════════════════════════════════════════════════════════ */

/** Ramka chegarasi: CR, LF yoki ETX. Ko'p tarozi ikkalasini yuboradi. */
const FRAME_SPLIT = /[\r\n\x03]+/;

/**
 * Oqimdan TUGALLANGAN ramkalarni ajratadi.
 *
 * ⚠ OXIRGI BO'LAK QAYTARILADI, ishlatilmaydi: port ma'lumotni
 * bo'lak-bo'lak beradi va «0.1» bilan «23 kg» ikki o'qishda kelishi
 * mumkin. Yarim ramkadan son olib qo'yilsa, kassir 0.1 kg ni 1.23 kg
 * o'rniga ko'rardi.
 *
 * @returns {{ frames: string[], rest: string }}
 */
export function splitFrames(buffer) {
  const parts = String(buffer ?? "").split(FRAME_SPLIT);
  const rest = parts.pop() ?? "";
  return { frames: parts.map((f) => f.trim()).filter(Boolean), rest };
}

/**
 * Bitta ramkadan o'lchovni o'qiydi.
 *
 * @returns {{ kg: number, stable: boolean|null, net: boolean|null }|null}
 *   `null` — ramkada son yo'q (masalan tarozining javob belgisi).
 *   `stable` `null` bo'lsa tarozi barqarorlikni AYTMAGAN va uni
 *   `stableOf` bilan kuzatish kerak.
 */
export function parseFrame(frame) {
  const raw = String(frame ?? "").trim();
  if (!raw) return null;

  /* ⚠ Son BIRINCHI emas, ENG UZUN kasr bo'yicha tanlanmaydi ham:
     ramkada bitta o'lchov bo'ladi, qolgan raqamlar esa holat kodi
     («ST», «GS» dan keyingi bo'sh joylar). Shuning uchun oddiy
     qidiruv — imzoli o'nlik son. */
  const m = raw.match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const num = Number(m[0].replace(",", "."));
  if (!Number.isFinite(num)) return null;

  /* Birlik: kg, g yoki lb. Ko'rsatilmasa — kg (tarozi kilogrammda). */
  const unit = /\b(kg|кг)\b/i.test(raw) ? "kg"
             : /\b(g|г|гр)\b/i.test(raw) ? "g"
             : /\blb\b/i.test(raw) ? "lb" : "kg";
  const kg = unit === "g" ? num / 1000
           : unit === "lb" ? num * 0.45359237
           : num;

  /* ⚠ Holat belgilari ramkaning BOSHIDA turadi va ular bo'lmasligi
     ham mumkin — o'shanda `null`, «barqaror emas» EMAS. Ikkisini
     aralashtirish barqarorlikni aytadigan tarozida ham kutishga
     majbur qilardi. */
  const hasSt = /\bST\b/i.test(raw);
  const hasUs = /\bUS\b/i.test(raw);
  let stable = hasSt ? true : hasUs ? false : null;

  /* ══ ⚠ STX DAN KEYINGI BELGI — HOLAT (V111) ═════════════
     Do'kondagi M-ER 328AC aynan shunday yuboradi (haqiqiy oqimdan
     olingan):

         06 01 02 53 20 30 30 2E 34 38 38 6B 67 65 03 04
         ACK SOH STX «S» « » «00.488» «kg» «e» ETX EOT

     Ya'ni holat `ST`/`US` so'zlari bilan emas, BITTA HARF bilan
     aytiladi: `S` — barqaror, `U` — tebranmoqda.

     ⚠ Buni o'qimaslik ham «ishlardi» — kuzatuv (`stableOf`) to'rtta
     bir xil o'lchovdan keyin baribir barqaror deb topardi. Lekin
     o'shanda kassir har tortishda ortiqcha kutar, tarozining o'zi
     esa allaqachon «barqaror» deb turgan bo'lardi. */
  const stx = raw.indexOf("\u0002");
  if (stx >= 0) {
    const flag = raw[stx + 1];
    if (flag === "S" || flag === "s") stable = true;
    else if (flag === "U" || flag === "u") stable = false;
  }

  const hasNt = /\bNT\b/i.test(raw);
  const hasGs = /\bGS\b/i.test(raw);
  const net = hasNt ? true : hasGs ? false : null;

  return { kg: round3(kg), stable, net };
}

/** Kilogramm — uch kasr xona (1 gramm). Tarozining o'z aniqligi 2 g. */
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/**
 * Tarozi barqarorlikni AYTMAGANDA uni o'zimiz aniqlaymiz.
 *
 * ⚠ Qoida sodda va ataylab shunday: oxirgi `n` ta o'lchov BIR XIL
 * bo'lsa — barqaror. «Farqi 2 grammdan kam» kabi qoida yaxshiroq
 * tuyuladi, lekin tarozi allaqachon 2 g gacha yaxlitlab beradi va
 * qo'shimcha chidam faqat tebranishni «barqaror» qilib ko'rsatardi.
 *
 * @param history oxirgi o'lchovlar (eng yangisi OXIRIDA)
 * @param n       nechta bir xil o'lchov barqarorlik hisoblanadi
 */
export function stableOf(history, n = 4) {
  const h = Array.isArray(history) ? history : [];
  if (h.length < n) return false;
  const tail = h.slice(-n);
  return tail.every((v) => v === tail[0]);
}

/**
 * Butun oqim holati — o'qish halqasi shuni chaqiradi.
 *
 * @param state  `{ rest, history, kg, stable }` yoki `null` (boshlanish)
 * @param chunk  portdan kelgan matn bo'lagi
 * @returns yangi holat; `kg` — oxirgi o'qilgan og'irlik (`null` — hali yo'q)
 */
export function feed(state, chunk, { stableCount = 4 } = {}) {
  const prev = state || { rest: "", history: [], kg: null, stable: false };
  const { frames, rest } = splitFrames(prev.rest + String(chunk ?? ""));

  let kg = prev.kg;
  let said = null;                       // tarozining o'z barqarorlik belgisi
  const history = prev.history.slice(-19);
  for (const f of frames) {
    const r = parseFrame(f);
    if (!r) continue;
    kg = r.kg;
    said = r.stable;
    history.push(r.kg);
  }

  /* ⚠ Tarozi aytgan bo'lsa — O'SHA, aks holda kuzatuv. Kuzatuv
     tarozining so'zidan ustun qo'yilsa, barqaror o'lchov ham to'rt
     o'qish kutishga majbur bo'lardi. */
  const stable = said != null ? said : stableOf(history, stableCount);

  return { rest, history: history.slice(-20), kg, stable };
}

/* ══════════════════════════════════════════════════════════════════════════
   ⚠ TAROZI KILOGRAMM BERADI — TOVAR BIRLIGI ESA HAR XIL (V113)

   Miqdor oynasi BO'LINADIGAN har qanday birlikda ochiladi: KG, LITR,
   METR, METR_KV, METR_KUB, SOAT. Jonli og'irlik tugmasi esa ularning
   HAMMASIDA chizilardi va tarozining kilogrammi tovar birligining
   nomi bilan yozilardi.

   Ya'ni mato sotayotgan do'konda tugmada «0.488 metr» deb turardi —
   va bir bosishda chekka SHU son tushardi. Bu jimgina noto'g'ri
   miqdor: ekranda ishonchli ko'rinadi, hisobda esa mato ham,
   pul ham to'g'ri kelmaydi.

   Shuning uchun o'girish shu yerda va u FAQAT OG'IRLIKNI taniydi.
   Boshqa birlikda `null` qaytadi va tugma umuman chizilmaydi:
   tarozi metr o'lchay olmaydi, «taxminan» ham qila olmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Og'irlik birliklari va bitta kilogrammda nechtaligi. */
const WEIGHT_UNITS = { KG: 1, GRAM: 1000 };

/**
 * Tarozining kilogrammini TOVAR birligiga o'giradi.
 *
 * @param unit  tovar birligi (`KG`, `GRAM`, `LITR`…)
 * @param kg    tarozidan kelgan og'irlik, kilogrammda
 * @returns     tovar birligidagi miqdor, yoki `null` — birlik
 *              og'irlik EMAS (o'shanda tugma chizilmaydi)
 */
export function weightQty(unit, kg) {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  /* Backend enum'i ba'zan `ROLE_` kabi qo'shimchasiz, lekin turli
     registrda keladi — solishtirish oldidan bir ko'rinishga keltiriladi. */
  const key = String(unit ?? "").trim().toUpperCase();
  const per = WEIGHT_UNITS[key];
  if (!per) return null;
  return kg * per;
}
