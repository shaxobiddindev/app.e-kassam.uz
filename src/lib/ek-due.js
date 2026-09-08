/**
 * ══════════════════════════════════════════════════════════════════════════
 *  QARZ MUDDATI — SANA HISOBI (V87)
 *
 *  Do'kon egasining talabi: «qarz berilayotganda qarz muddatini to'lov
 *  paytida so'raydigan qilish kerak, qo'shimchasiga sozlamadagi muddat
 *  deb belgilay olsin, lekin to'lov paytida muddat so'rash birinchi».
 *
 *  ═══ ⚠ NEGA ALOHIDA FAYL ═══════════════════════════════════════════════
 *
 *  To'rtta kichkina funksiya, lekin ikkalasi ham JIMGINA xato qiladigan
 *  turdan: sana arifmetikasi va vaqt mintaqasi. Kassa ekranida bunday
 *  xato «bir kun surilgan muddat» bo'lib chiqadi va uni faqat mijoz
 *  bilan tortishuv paytida sezasiz.
 *
 *  ⚠⚠ `toISOString()` ISHLATILMAYDI. U UTC beradi, Toshkent esa UTC+5:
 *  soat 19:00 dan keyin `new Date().toISOString().slice(0, 10)`
 *  ERTANGI kunni qaytaradi. Kassa aynan kechqurun ishlaydi, ya'ni bu
 *  xato eng ko'p savdo bo'ladigan paytda chiqardi: «bugun» deb
 *  belgilangan muddat chekda ertaga bo'lib bosilardi.
 *
 *  Shuning uchun hamma joyda MAHALLIY sana qismlari olinadi
 *  (`getFullYear`/`getMonth`/`getDate`) — brauzer qaysi mintaqada
 *  bo'lsa, kassir ham o'sha mintaqada turibdi.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** `Date` → `YYYY-MM-DD` (MAHALLIY sana bo'yicha). */
export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Bugun — `YYYY-MM-DD`. Maydonning `min` i ham shu. */
export function today(now = new Date()) {
  return iso(now);
}

/**
 * Bugundan N kun keyin.
 *
 * ⚠ `setDate` orqali — `+ n * 864e5` EMAS. Millisekund qo'shish yozgi
 * vaqtga o'tadigan mintaqalarda bir soatga adashadi va aynan yarim
 * tunga yaqin kunni ham surib yuboradi. `setDate` esa kalendar
 * amali: oy va yil oshishini o'zi hal qiladi (31-dekabr + 1 kun).
 */
export function plus(days, now = new Date()) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + Math.round(n));
  return iso(d);
}

/**
 * Berilgan sanagacha necha kun qolgani. O'tgan sana uchun MANFIY.
 *
 * ⚠ Ikkala chetni ham TUN YARMIGA tekislaydi: aks holda «bugun» ba'zan
 * 0, ba'zan −1 chiqar va ekranda «muddati o'tgan» degan yozuv soatga
 * qarab paydo bo'lib turardi.
 */
/**
 * Sana BUGUNDAN OLDINMI (V99).
 *
 * ⚠ NEGA ALOHIDA FUNKSIYA KERAK BO'LDI. Qarz muddati maydonida
 * `min={today()}` turardi, lekin `<input type="date">` da `min`
 * KALENDARNI cheklaydi, QO'LDA TERISHNI emas: brauzer maydonni
 * `:invalid` deb belgilaydi-yu, qiymatni baribir beradi. Ya'ni
 * kassir «20.08.2025» deb terib qo'ysa, qarz TUG'ILGAN ZAHOTI
 * muddati o'tgan bo'lib yozilardi.
 *
 * Do'kon egasining xabari: «qarz berishda bugundan eski muddat ham
 * kiritish mumkin bo'lyapti».
 *
 * `null` — sana yo'q yoki tushunarsiz; bunda «o'tmishda emas»
 * deyiladi: muddatsiz qarz qonuniy («qachon bo'lsa ham»).
 */
export function isPast(value, now = new Date()) {
  const d = daysLeft(value, now);
  return d != null && d < 0;
}

export function daysLeft(value, now = new Date()) {
  const d = parse(value);
  if (!d) return null;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - a) / 864e5);
}

/**
 * `YYYY-MM-DD` → `Date` (mahalliy tun yarmi), yaroqsiz bo'lsa `null`.
 *
 * ⚠ `new Date("2026-10-20")` ISHLATILMAYDI: u satrni UTC deb o'qiydi
 * va UTC+5 da mahalliy 05:00 chiqadi — kun chegarasida yana o'sha bir
 * kunlik siljish.
 */
export function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const out = new Date(y, mo - 1, d);
  /* Kalendar tekshiruvi: 2026-02-31 `Date` da 3-martga «sirg'alib»
     ketadi va bunday sanani jimgina qabul qilish xato. */
  return out.getFullYear() === y && out.getMonth() === mo - 1 && out.getDate() === d
    ? out : null;
}
