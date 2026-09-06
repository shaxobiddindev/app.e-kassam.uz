/* ══════════════════════════════════════════════════════════════════════════
   NAQD PUL TUGMALARI — QANCHA BERDI? (V76)

   ═══ MUAMMO ══════════════════════════════════════════════════════════

   Ilgari to'lov oynasida uchta QOTIB QOLGAN tugma turardi: 50 000,
   100 000, 200 000. Ular chekning summasiga umuman qaramasdi va
   shuning uchun ko'p hollarda ishlamasdi:

     · chek 8 000 so'm — uchala tugma ham juda katta, kassir baribir
       qo'lda yozardi;
     · chek 420 000 so'm — uchala tugma ham kichik, foydasi yo'q;
     · chek 73 000 so'm — mijoz odatda 75 000 yoki 80 000 beradi,
       ro'yxatda esa bunday qiymat yo'q.

   Ya'ni tugmalar aynan kerak bo'lган paytda kerak bo'lmagan sonni
   ko'rsatardi.

   ═══ YECHIM: YAXLITLASH ZINAPOYASI ═══════════════════════════════════

   Mijoz qo'lidagi pulni yaxlit qilib beradi. Shuning uchun takliflar
   ham to'lanishi kerak bo'lgan summani YUQORIGA yaxlitlash bilan
   quriladi: 1 000, 5 000, 10 000, 50 000, 100 000.

     73 000  →  75 000 · 80 000 · 100 000
      8 000  →  10 000 · 50 000        (8 000 ning o'zi tushib qoladi)
    420 000  →  425 000 · 450 000 · 500 000

   ⚠ SUMMANING O'ZI TAKLIF QILINMAYDI. «Aniq summa» uchun alohida
   tugma bor («Qolganini») va uni ikkinchi marta ko'rsatish qatorni
   bekorga to'ldirardi.

   ⚠ UCHTADAN OSHMAYDI. To'lov oynasida SCROL BO'LMASLIGI kerak
   (09-CHETLANISHLAR) va har qo'shimcha tugma qatorni yangi satrga
   tushirish xavfini oshiradi. Uchta variant amalda yetadi: undan
   kattasini mijoz kamdan-kam beradi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Yaxlitlash qadamlari — o'zbek pul kupyuralarining haqiqiy tuzilishi.
 *
 * ⚠ 2 000 va 20 000 YO'Q va bu ataylab: ular mavjud kupyura bo'lsa
 * ham, «yuqoriga yaxlitlash» bosqichi sifatida deyarli hech qachon
 * yangi variant bermaydi (5 000 va 50 000 ularni qoplaydi), qatorni
 * esa uzaytirardi.
 */
const STEPS = [1_000, 5_000, 10_000, 50_000, 100_000];

/** Nechta tugma — sabab fayl izohida. */
const LIMIT = 3;

/**
 * To'lanishi kerak bo'lgan summa uchun naqd tugmalari.
 *
 * @param due to'lanmagan qoldiq (so'm)
 * @returns o'sish tartibidagi takliflar; noto'g'ri kirishda bo'sh ro'yxat
 */
export function cashSuggestions(due) {
  const n = Number(due);
  /* ⚠ NOL VA MANFIY — BO'SH RO'YXAT. To'lanadigan narsa qolmaganda
     tugmalar ma'nosini yo'qotadi, `Math.ceil(0 / 1000) * 1000` esa
     nolni qaytarib, «0» degan tugma chizardi. */
  if (!Number.isFinite(n) || n <= 0) return [];

  const cand = new Set();
  for (const step of STEPS) {
    const v = Math.ceil(n / step) * step;
    /* Summaning O'ZI tushib qoladi — sabab fayl izohida. */
    if (v > n) cand.add(v);
  }

  /* ⚠ YUMALOQ SUMMADA ro'yxat BO'SH qolardi va bu haqiqiy teshik edi:
     chek aynan 100 000 bo'lsa, har bir qadam ham 100 000 ni qaytaradi
     va hammasi «summaning o'zi» deb tashlanardi — natijada naqd
     tugmalari umuman chizilmasdi. O'shanda keyingi yuz minglik
     olinadi: mijoz 100 000 lik chekka 200 000 beradi. */
  if (cand.size === 0) cand.add(Math.floor(n / 100_000) * 100_000 + 100_000);

  /* ⚠ TARTIBLASH KESISHDAN OLDIN: qadamlar bo'yicha yig'ilgan ro'yxat
     o'sish tartibida bo'lishi SHART emas (50 000 lik qadam ba'zan
     100 000 likdan katta son beradi), kesilganda esa eng yaqin —
     ya'ni eng foydali — variant tushib qolardi. */
  return [...cand].sort((a, b) => a - b).slice(0, LIMIT);
}
