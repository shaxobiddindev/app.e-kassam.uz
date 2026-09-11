/* ══════════════════════════════════════════════════════════════════════════
   SHTRIX-KOD NAZORAT RAQAMI

   ⚠ SERVERDAGI `BarcodeCheck.java` NING AYNAN JUFTI. Qoida ikkala
   tomonda bir xil bo'lishi shart: front «shubhali» desa-yu, server
   bayroq qo'ymasa (yoki teskarisi), foydalanuvchi ikki xil javob
   ko'rardi va qaysi biriga ishonishni bilmasdi.

   ═══ NIMA UCHUN KERAK ═════════════════════════════════════════════════

   Xato terilgan shtrix-kod — umumiy bazadagi eng yomon narsa. U bitta
   do'konda qolmaydi: tasdiqlangandan keyin yuzlab do'konga tarqaladi
   va ularning har birida skaner tovarni topa olmaydi. Kassir esa buni
   «dastur ishlamayapti» deb tushunadi.

   Yaxshi tomoni: xatoni bepul ushlash mumkin. EAN-13, EAN-8 va UPC-A
   ning oxirgi raqami — qolganlaridan hisoblanadigan NAZORAT raqami.
   Bitta raqamni noto'g'ri tergan odamning kodi katta ehtimol bilan bu
   tekshiruvdan o'tmaydi.

   ═══ ⚠ TO'SIQ EMAS, OGOHLANTIRISH ═════════════════════════════════════

   Nazorat raqamiga bo'ysunmaydigan, lekin mutlaqo qonuniy kodlar bor:

     · ichki kodlar — `02`, `20`…`29` bilan boshlanadigan EAN-13. Ularni
       do'konning O'ZI chiqaradi (tarozi, ichki yorliq);
     · SKU va artikul — harfli kodlar, ular umuman EAN emas;
     · boshqa uzunlik — ITF-14, GS1-128, ichki 6 xonali kod.

   Bu tekshiruv to'siq bo'lganda yuqoridagilarning hammasi tizimga kira
   olmasdi.
   ══════════════════════════════════════════════════════════════════════════ */

/** `OK` · `CHECK_DIGIT` · `INTERNAL` · `NOT_STANDARD` */
export function barcodeVerdict(barcode) {
  if (barcode == null) return "NOT_STANDARD";
  const s = String(barcode).trim();
  if (!s) return "NOT_STANDARD";
  if (!/^\d+$/.test(s)) return "NOT_STANDARD";

  const len = s.length;
  if (len !== 8 && len !== 12 && len !== 13) return "NOT_STANDARD";

  /* ⚠ Ichki kod nazorat raqamidan OLDIN tekshiriladi. Aks holda tarozi
     chiqargan kod «xato» deb belgilanardi va foydalanuvchi har kuni
     o'nlab yolg'on ogohlantirishni ko'rardi — bir haftadan keyin u
     bayroqqa umuman qaramay qo'yardi. */
  if (len === 13 && (s.startsWith("02") || s[0] === "2")) return "INTERNAL";

  return modulo10Valid(s) ? "OK" : "CHECK_DIGIT";
}

/** Ogohlantirishga arziydigan yagona holat. */
export const barcodeSuspicious = (barcode) => barcodeVerdict(barcode) === "CHECK_DIGIT";

/**
 * GS1 «modulo 10» — EAN-8, UPC-A va EAN-13 uchun BIR XIL.
 *
 * ⚠ Vazn OXIRIDAN sanaladi. Uni boshidan sanash EAN-13 da to'g'ri,
 * EAN-8 da esa noto'g'ri natija berardi va sakkiz xonali kodlar
 * kamdan-kam uchragani uchun xato uzoq sezilmasdan turardi.
 */
function modulo10Valid(digits) {
  const len = digits.length;
  let sum = 0;
  for (let i = 0; i < len - 1; i++) {
    const weight = (len - 1 - i) % 2 === 1 ? 3 : 1;
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[len - 1]);
}
