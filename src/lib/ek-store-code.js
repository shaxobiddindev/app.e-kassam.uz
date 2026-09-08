/* ══════════════════════════════════════════════════════════════════════════
   DO'KONNING O'Z KODI — barkodsiz tovar uchun (V98)

   ⚠ QOIDA SERVERDA (`common.util.StoreCode`). Bu yerda faqat KO'RSATISH
   va TANIB OLISH: kod yaratish serverning ishi, chunki u do'kon
   hisoblagichiga tayanadi va ikki kassir bir vaqtda bosganda bitta
   raqam ikki marta berilmasligi kerak.

   Format: `2 NNNNNN C` — EAN-8.

   ⚠ NEGA SAKKIZ XONA. Tarozi barkodi har doim 13 xonali va do'konning
   standart tarozi prefiksi bitta raqam — `2` — ya'ni tarozi butun `2…`
   maydonini egallaydi. Uzunlik farqi to'qnashuvni SOZLAMA bilan emas,
   TUZILISHI bilan yo'q qiladi.
   ══════════════════════════════════════════════════════════════════════════ */

export const STORE_CODE_LENGTH = 8;
const PREFIX = "2";

/** GS1 «modulo 10» — vazn OXIRIDAN sanaladi (EAN-8 va EAN-13 uchun bir xil). */
function checkDigit(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const w = (body.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(body[i]) * w;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Shu kod do'konning o'z kodimi. */
export function isStoreCode(code) {
  const s = String(code ?? "").trim();
  if (s.length !== STORE_CODE_LENGTH) return false;
  if (s[0] !== PREFIX || !/^\d+$/.test(s)) return false;
  return checkDigit(s.slice(0, STORE_CODE_LENGTH - 1)) === s[STORE_CODE_LENGTH - 1];
}

/**
 * Odam o'qiydigan ko'rinish: `2 000142 1`.
 *
 * ⚠ Bo'shliqlar FAQAT ekran uchun. Bu qiymat hech qachon serverga
 * yuborilmaydi va qidiruvga tushmaydi — aks holda bitta tovar ikki
 * xil yozuvda qolardi.
 */
export function prettyStoreCode(code) {
  const s = String(code ?? "").trim();
  if (!isStoreCode(s)) return s;
  return `${s[0]} ${s.slice(1, 7)} ${s[7]}`;
}

/**
 * Kassir aytadigan qisqa raqam: `2 000142 1` → `142`.
 *
 * ⚠ Kod butunligicha yodda qolmaydi, o'rtadagi son esa qoladi —
 * «yuz qirq ikki». Ro'yxatda va stikerda aynan shu urg'ulanadi.
 */
export function storeCodeShort(code) {
  const s = String(code ?? "").trim();
  if (!isStoreCode(s)) return null;
  return String(Number(s.slice(1, 7)));
}
