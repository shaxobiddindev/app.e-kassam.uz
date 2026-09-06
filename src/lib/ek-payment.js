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
 * JAMG'ARMA — mijozning do'kondagi shaxsiy puli (V63).
 *
 * ⚠ HISOB-KITOB uchun u ODDIY NAQDSIZ usul: aniq summa yoziladi va
 * undan qaytim CHIQMAYDI (mijozning o'z hisobidan ortiqcha yechishning
 * ma'nosi yo'q). Shuning uchun `settle` ga hech qanday maxsus shox
 * qo'shilmadi — u `CARD` bilan bir xil yo'ldan o'tadi.
 *
 * ⚠ FARQI EKRANDA: tugma faqat MIJOZ TANLANGANDA va qoldig'i bor
 * bo'lganda chiqadi, kiritiladigan summa esa o'sha qoldiq bilan
 * CHEGARALANADI.
 */
export const SAVINGS = "SAVINGS";

/**
 * Qatorlar SHU tartibda chiziladi — kiritilish tartibida EMAS.
 *
 * ⚠ NEGA KERAK. `Object.entries` kalitlarni QO'SHILISH tartibida
 * beradi. Kassir naqdni o'chirib qayta yozsa, «Naqd» qatori pastga
 * tushib qolardi va ro'yxat u yozayotgan paytda o'z-o'zidan qayta
 * saflanardi — brouzerda ko'rildi. Bir xil ikki chekning qatorlari
 * ham har xil tartibda chiqardi.
 */
/* ⚠ JAMG'ARMA OXIRIDA, o'rtasida emas. Sabab klaviaturada:
   F1..F4 aynan shu to'rttasiga bog'langan va kassirlarning barmog'i
   uni yod biladi (`ek-kassa-keys.js` izohi). Yangi usulni o'rtaga
   qo'yish ularning hammasini surib yuborardi. Jamg'armaning o'z
   yorlig'i bor — `Alt+J`. */
export const ORDER = [CASH, "CARD", "CLICK", "PAYME", SAVINGS];

/** Ro'yxatda yo'q usul — oxiriga. */
const rank = (t) => {
  const i = ORDER.indexOf(t);
  return i < 0 ? ORDER.length : i;
};


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
  /* Jamg'armadan tashqari naqdsiz usullar — karta, Click, Payme. */
  const cards = rows.filter(([t]) => t !== CASH && t !== SAVINGS)
                    .reduce((s, [, a]) => s + a, 0);
  const savingsIn = rows.filter(([t]) => t === SAVINGS)
                        .reduce((s, [, a]) => s + a, 0);

  /* ══════════════════════════════════════════════════════════════════
     ⚠⚠ JAMG'ARMA QOLGAN SUMMADAN OSHA OLMAYDI (V78)

     Bu XAVFSIZLIK qoidasi, qulaylik emas. Ilgari jamg'arma oddiy
     naqdsiz usul edi va 30 000 lik chekka 20 000 boshqa usul + 20 000
     jamg'arma yozish mumkin edi. Ortiqcha 10 000 esa qaytim bo'lib
     chiqardi — ya'ni mijoz jamg'armasidan NAQD PUL yechib olardi.
     Jamg'arma bunday ishlatilganda u do'kondagi hisob bo'lishdan
     to'xtab, pul chiqarish yo'liga aylanardi.

     Endi jamg'arma FAQAT qolgan summaga teng miqdorda yechiladi:
     ortiqchasi jimgina tashlanadi va hisobda qoladi.

     ⚠ Chegara BOSHQA USULLARDAN KEYIN hisoblanadi (naqd ham
     kiradi): mijoz avval naqd bergan bo'lsa, jamg'armadan faqat
     qolgani yechilishi kerak. */
  const savingsCap = Math.max(0, goal - cashIn - cards);
  const savingsPaid = Math.min(savingsIn, savingsCap);
  /* Yozilgan-u, ishlatilmagan qism — ekran buni aytishi kerak. */
  const savingsCut = savingsIn - savingsPaid;

  const others = cards + savingsPaid;

  /* ⚠ NAQDSIZ USULLAR JAMIDAN OSHSA — terminal aynan so'ralgan
     summani oladi va u yerdan NAQD qaytmaydi. Shuning uchun bu pul
     mijozga qo'lda berilmaydi; uning yagona to'g'ri manzili —
     mijozning jamg'armasi (`excess`).

     ⚠ Jamg'arma bu yerda QATNASHMAYDI: u yuqorida kesilgan va
     ta'rifi bo'yicha ortiqcha yarata olmaydi. */
  const over = Math.max(0, cards - goal);

  /* Naqddan qancha kerak — qolganini naqd yopadi. */
  const needCash = Math.max(0, goal - others);
  const cashPaid = Math.min(cashIn, needCash);
  const change = Math.max(0, cashIn - needCash);

  /* ⚠ ORTIQCHA TO'LOVNING HAMMASI — qaysi usuldan kelganidan qat'i
     nazar (V78). Ilgari faqat naqd qaytimi jamg'armaga yo'naltirilardi
     va kartadan ortiq to'langan pulning yo'li umuman yo'q edi: u
     ekranda «xato» bo'lib turar, lekin mijozning puli edi. */
  const excess = change + over;

  const credit = Math.max(0, goal - others - cashPaid);

  const parts = rows
    /* ⚠ Naqd KESILGAN qiymati bilan ketadi: ortiqcha pul kassaga
       tushmaydi, u mijozga qaytariladi (yoki jamg'armaga yoziladi).
       Jamg'arma ham kesilgan qiymati bilan — sabab yuqorida. */
    .map(([type, amount]) => [type,
      type === CASH ? cashPaid : type === SAVINGS ? savingsPaid : amount])
    .filter(([, amount]) => amount > 0)
    .map(([type, amount]) => ({ type, amount }));

  if (credit > 0) parts.push({ type: CREDIT, amount: credit });

  return { others, cards, cashIn, cashPaid, change, credit, over, excess,
           savingsIn, savingsPaid, savingsCap, savingsCut, parts };
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

/**
 * Jamg'armadan ko'pi bilan qancha yechish mumkin.
 *
 * ⚠ IKKI CHEGARANING KICHIGI: mijozning qoldig'i va chekning
 * to'lanmagan qismi. Ikkinchisi XAVFSIZLIK uchun — sabab `settle`
 * dagi izohda: usiz jamg'arma naqd pul chiqarish yo'liga aylanardi.
 *
 * ⚠ EKRANDA HAM, HISOBDA HAM shu qiymat ishlatiladi: maydonni bu son
 * bilan cheklab, `settle` da yana kesish — ataylab ikki qavat. Ekran
 * chegarani o'tkazib yuborsa (yangi yo'l, boshqa komponent), hisob
 * baribir to'g'ri qoladi.
 */
export function savingsMax(entered, total, balance) {
  return Math.max(0, Math.min(
    Math.max(0, Math.round(Number(balance) || 0)),
    restFor(entered, total, SAVINGS)));
}

/* ══════════════════════════════════════════════════════════════════════════
   ARALASH TO'LOV — CHEKSIZ OYNALAR UCHUN (V96)

   ⚠ NEGA `settle` YARAMAYDI. `settle` CHEK SUMMASIDAN kelib chiqadi:
   qolgani nasiyaga, ortig'i qaytimga. Qarz to'lash, jamg'arma
   to'ldirish va ta'minotchiga to'lovda esa BELGILANGAN SUMMA YO'Q —
   to'lov summasi kiritilganlarning YIG'INDISI. Ya'ni bu boshqa
   shakl va uni `settle` ichiga tiqish o'sha funksiyani ikki xil
   vazifaga bo'lib yuborardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Kiritilganlarning yig'indisi — to'lovning umumiy summasi. */
export function enteredTotal(entered) {
  return Object.values(entered || {}).reduce((s, v) => s + num(v), 0);
}

/**
 * Serverga ketadigan qismlar ro'yxati.
 *
 * ⚠ TARTIB `ORDER` bo'yicha — kiritilish tartibida EMAS. Sabab
 * `ORDER` izohida: kassir summani o'chirib qayta yozsa, qator
 * ro'yxatda sakrab yurardi.
 *
 * ⚠ Noldan katta qatorlargina qoladi: server nol qismni RAD ETADI
 * (u klientdagi nosozlik belgisi).
 */
export function enteredParts(entered) {
  return Object.entries(entered || {})
    .map(([type, amount]) => [type, num(amount)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([type, amount]) => ({ type, amount }));
}

/**
 * Tanlangan usulga ko'pi bilan qancha yozish mumkin.
 *
 * ⚠ CHEGARA JAMIGA QO'YILADI, bitta maydonga emas. Jamg'armadan
 * qaytarishda qoldiq 100 000 bo'lsa, «naqd 100 000 + karta 100 000»
 * ni har maydon alohida tekshirilganda O'TKAZIB YUBORARDI.
 *
 * `cap` berilmasa (null) — chegara yo'q.
 */
export function enteredMax(entered, cap, type) {
  if (cap == null) return null;
  const others = Object.entries(entered || {})
    .filter(([t]) => t !== type)
    .reduce((s, [, v]) => s + num(v), 0);
  return Math.max(0, Math.round(cap) - others);
}
