/**
 * ══════════════════════════════════════════════════════════════════════════
 * CHEKSIZ RO'YXAT — SOF MANTIQ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ NEGA ALOHIDA FAYL. Bu mantiq React'dan MUSTAQIL va node'dan
 * sinaladi. Hook ichida qolsa, uni sinash uchun butun komponentni
 * render qilish kerak bo'lardi — va aynan shu sabab bilan bunday
 * mantiq odatda umuman sinalmaydi.
 *
 * ⚠ i18n IMPORT QILINMAYDI: `ek-i18n.js` modul darajasida DOM'ga
 * tegadi, ya'ni node'da yuklanmaydi.
 *
 * ═══ NEGA TAKRORNI O'ZIMIZ TOZALAYMIZ ══════════════════════════════════
 *
 * Sahifalash NIMADA XATO BO'LADI: ro'yxat ko'rilayotganda yangi qator
 * qo'shilsa yoki o'chsa, keyingi sahifaning chegarasi SURILADI. Natijada
 * bitta yozuv IKKI MARTA keladi (yoki bittasi tushib qoladi).
 *
 * ⚠ IKKI MARTA KELGAN QATOR REACT'DA KO'RINMAYDIGAN NUQSON EMAS —
 * u `key` takrorlanishiga olib keladi va React qatorlarni chalkashtirib
 * yuboradi: tovar tahrirlansa boshqasi o'zgargandek ko'rinadi.
 *
 * Shuning uchun har qo'shishda `id` bo'yicha tozalanadi. Narxi —
 * bitta `Set`; foydasi — chalkashmaydigan ro'yxat.
 */

/** Standart sahifa hajmi — serverdagi `Paging.DEFAULT_SIZE` bilan bir xil. */
export const PAGE_SIZE = 50;

/**
 * Server javobidan sahifa ma'lumotini oladi.
 *
 * ⚠ IKKALA SHAKLNI HAM TUSHUNADI:
 *   · `{content, page, size, total, hasNext}` — sahifalangan;
 *   · `[...]` — eski, to'liq ro'yxat.
 *
 * Ikkinchisi kerak, chunki server sahifalashni IXTIYORIY qildi va
 * ba'zi endpointlar hali sahifalanmagan. Front ikkalasi bilan ham
 * ishlashi shart, aks holda har endpoint uchun alohida yo'l yozilardi.
 */
export function readPage(data) {
  if (Array.isArray(data)) {
    /* ⚠ To'liq ro'yxat — «yana bor» degan tushuncha yo'q, shuning
       uchun `hasNext: false`. Aks holda cheksiz scroll bir xil
       ro'yxatni qayta-qayta so'rab turardi. */
    return { rows: data, hasNext: false, total: data.length, paged: false };
  }
  if (data && Array.isArray(data.content)) {
    return {
      rows: data.content,
      /* ⚠ `hasNext` SERVERDAN OLINADI, hisoblanmaydi: ba'zi ro'yxatda
         `total` qimmat va u `-1` bo'lib keladi. */
      hasNext: Boolean(data.hasNext),
      total: Number.isFinite(data.total) && data.total >= 0 ? data.total : null,
      paged: true,
    };
  }
  return { rows: [], hasNext: false, total: 0, paged: false };
}

/**
 * Yangi sahifani mavjud ro'yxatga qo'shadi — TAKRORSIZ.
 *
 * ⚠ TARTIB SAQLANADI: serverdan kelgan tartib yagona haqiqat
 * (narx bo'yicha, sana bo'yicha…). Front qayta saralasa,
 * sahifalar orasidagi chegara buzilardi.
 *
 * @param have  allaqachon ko'rsatilgan qatorlar
 * @param next  yangi sahifa
 * @param key   qatorni ajratuvchi maydon nomi
 */
export function mergePage(have, next, key = "id") {
  const list = Array.isArray(have) ? have : [];
  const add = Array.isArray(next) ? next : [];
  if (!add.length) return list;

  const seen = new Set();
  for (const r of list) {
    const k = r?.[key];
    if (k !== undefined && k !== null) seen.add(k);
  }

  const out = list.slice();
  for (const r of add) {
    const k = r?.[key];
    /* ⚠ KALITI YO'Q QATOR TASHLANMAYDI: ba'zi ro'yxatlarda `id`
       bo'lmaydi (hisobot qatorlari). Ularni tozalab bo'lmaydi,
       lekin yo'qotish ham mumkin emas. */
    if (k === undefined || k === null) { out.push(r); continue; }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Keyingi sahifani so'rash kerakmi.
 *
 * ⚠ UCHTA SHART VA UCHALASI HAM KERAK:
 *   · `hasNext` — server yana bor dedi;
 *   · `loading` — oldingi so'rov tugagan (aks holda scroll
 *     chegarasida o'nlab bir xil so'rov ketardi);
 *   · `error` — oxirgi urinish yiqilmagan (yiqilgan so'rovni
 *     avtomatik takrorlash cheksiz aylanish beradi; foydalanuvchi
 *     «Qayta urinish» ni o'zi bosadi).
 */
export function shouldLoadMore({ hasNext, loading, error }) {
  return Boolean(hasNext) && !loading && !error;
}

/** Sahifalash holatining boshlang'ich qiymati. */
export const emptyState = () => ({
  rows: [], page: 0, hasNext: true, total: null,
  loading: false, error: null, paged: true,
});
