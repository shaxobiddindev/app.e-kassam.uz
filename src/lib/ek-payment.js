/* ══════════════════════════════════════════════════════════════════════════
   TO'LOVNI TAQSIMLASH (V58)

   ═══ NEGA ESKI MODEL TASHLANDI ═════════════════════════════════════════

   Ilgari «Aralash» alohida to'lov TURI edi: kassir avval «bu chek
   aralash» deb qaror qilar, so'ng har usul uchun alohida qator va
   alohida maydon ochilardi. Ikkita muammo bor edi:

     · kassir OLDINDAN bilishi kerak edi. Amalda esa u buni bilmaydi:
       mijoz «20 mingi naqd» deydi, qolgani haqida keyin gaplashadi.
     · har usul o'z maydonini ochar, oyna o'sar va qaysi maydonga
       yozayotganini adashtirardi.

   Yangi model do'kon egasining so'zi bilan: «naqd tanlandi, 20 000
   kiritildi, qolgani nasiyaga hisoblanib tursin; keyin Click tanlanadi,
   15 000 kiritiladi va yana qolgani nasiyaga».

   Ya'ni:
     · MAYDON BITTA — u tanlangan usulning summasini tahrirlaydi;
     · usul qayta tanlansa, ESKI qiymati qaytadi;
     · yozilmagan qism o'z-o'zidan NASIYA bo'ladi;
     · «Aralash» degan tur umuman kerak emas.

   ═══ QAYTIM QAYERDAN CHIQADI ═══════════════════════════════════════════

   ⚠ ORTIQCHA FAQAT NAQDDA BO'LADI. Mijoz 100 000 lik chekka 150 000
   uzatadi va 50 000 qaytim oladi — bu har kuni. Kartada esa terminal
   AYNAN so'ralgan summani oladi: u yerdagi ortiqcha son xato, qaytim
   emas, va uni «qaytim» deb ko'rsatish kassirni yanglishtirardi.

   Shuning uchun chekka tushadigan naqd `kerakli` qismgacha kesiladi,
   ortiqchasi esa faqat EKRANDA qaytim bo'lib ko'rinadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Naqd — yagona usul, unda ortiqcha to'lash mumkin. */
export const CASH = "CASH";

/** Qolgan summa shu usulga yoziladi. */
export const CREDIT = "CREDIT";

/**
 * Qatorlar SHU tartibda chiziladi — kiritilish tartibida EMAS.
 *
 * ⚠ NEGA KERAK. `Object.entries` kalitlarni QO'SHILISH tartibida
 * beradi. Kassir naqdni o'chirib qayta yozsa, «Naqd» qatori pastga
 * tushib qolardi va ro'yxat u yozayotgan paytda o'z-o'zidan qayta
 * saflanardi — brouzerda ko'rildi. Bir xil ikki chekning qatorlari
 * ham har xil tartibda chiqardi.
 */
export const ORDER = [CASH, "CARD", "CLICK", "PAYME"];

/** Ro'yxatda yo'q usul — oxiriga. */
const rank = (t) => {
  const i = ORDER.indexOf(t);
  return i < 0 ? ORDER.length : i;
};

/**
 * Hech narsa yozilmagan chek — TO'LIQ NAQD.
 *
 * ⚠ NEGA SHUNDAY. Do'kon egasining talabi bilan summa maydoni endi
 * BO'SH ochiladi: kassir «108 000» ni avval o'chirib, keyin o'zining
 * raqamini yozishi kerak emas. Lekin bo'sh maydon «hech kim hech
 * narsa to'lamadi» degani EMAS: odatiy chekda mijoz butun summani
 * naqd beradi va kassir hech narsa yozmasdan «Sotish» ni bosadi.
 *
 * Agar bo'sh maydon nol deb olinsa, o'sha odatiy chek BUTUNLAY
 * NASIYAGA yozilardi — kassir buni sezmasdi ham. Shuning uchun:
 * hech qayerga hech narsa yozilmagan bo'lsa, chek to'liq naqd.
 * Maydonning placeholder'i aynan shu summani ko'rsatib turadi.
 *
 * ⚠ TO'LIQ NASIYA baribir mumkin: naqdga `0` yoziladi. Shunda
 * ro'yxat bo'sh emas va bu qoida ishlamaydi.
 */
export function effective(entered, total) {
  if (entered && Object.keys(entered).length > 0) return entered;
  return { [CASH]: Math.max(0, Math.round(Number(total) || 0)) };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Kiritilganlarni chekka aylantiradi.
 *
 * @param entered `{ CASH: "20000", CLICK: "15000" }` — matn ham, son ham
 * @param total   chekning yakuniy summasi
 *
 * @returns
 *   `others`   naqddan boshqa usullar yig'indisi
 *   `cashIn`   kassir yozgan naqd (ortiqchasi bilan)
 *   `cashPaid` chekka tushadigan naqd (ortiqchasi kesilgan)
 *   `change`   qaytim
 *   `credit`   nasiyaga yoziladigan qism
 *   `over`     naqdsiz usullar jamidan oshib ketgan miqdor
 *   `parts`    serverga ketadigan ro'yxat
 */
export function settle(entered, total) {
  const goal = Math.max(0, Math.round(Number(total) || 0));
  const rows = Object.entries(entered || {})
    .map(([type, amount]) => [type, num(amount)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => rank(a[0]) - rank(b[0]));

  const cashIn = rows.filter(([t]) => t === CASH)
                     .reduce((s, [, a]) => s + a, 0);
  const others = rows.filter(([t]) => t !== CASH)
                     .reduce((s, [, a]) => s + a, 0);

  /* ⚠ NAQDSIZ USULLAR JAMIDAN OSHSA — bu XATO, qaytim emas. Terminal
     aynan so'ralgan summani oladi va u yerdan pul qaytmaydi. */
  const over = Math.max(0, others - goal);

  /* Naqddan qancha kerak — qolganini naqd yopadi. */
  const needCash = Math.max(0, goal - others);
  const cashPaid = Math.min(cashIn, needCash);
  const change = Math.max(0, cashIn - needCash);

  const credit = Math.max(0, goal - others - cashPaid);

  const parts = rows
    /* ⚠ Naqd KESILGAN qiymati bilan ketadi: ortiqcha pul kassaga
       tushmaydi, u mijozga qaytariladi. */
    .map(([type, amount]) => [type, type === CASH ? cashPaid : amount])
    .filter(([, amount]) => amount > 0)
    .map(([type, amount]) => ({ type, amount }));

  if (credit > 0) parts.push({ type: CREDIT, amount: credit });

  return { others, cashIn, cashPaid, change, credit, over, parts };
}

/**
 * Chekning to'lov TURI — hisobot uchun bitta so'z.
 *
 * ⚠ Bitta usul bo'lsa — o'sha usul. Bir nechtasi bo'lsa «MIXED»:
 * hisobotda «aralash» degan qator kerak, aks holda bir chek ikki
 * bo'limda sanalardi. Ya'ni «Aralash» EKRANDAN yo'qoldi, lekin
 * HISOBOTDA qoladi — ular boshqa-boshqa narsa.
 */
export function payType(parts) {
  if (!parts?.length) return CASH;
  return parts.length === 1 ? parts[0].type : "MIXED";
}

/**
 * Tanlangan usulga «qolganini» yozish uchun summa.
 *
 * ⚠ SHU USULNING O'ZI HISOBGA OLINMAYDI: kassir 20 000 yozib, keyin
 * «qolganini» bossa, u 20 000 ustiga qo'shilmasligi kerak —
 * maydondagi raqam ALMASHADI.
 */
export function restFor(entered, total, type) {
  const rest = Object.entries(entered || {})
    .filter(([t]) => t !== type)
    .reduce((s, [, a]) => s - num(a), Math.max(0, Math.round(Number(total) || 0)));
  return Math.max(0, rest);
}
