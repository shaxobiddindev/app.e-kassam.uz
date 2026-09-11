/* ══════════════════════════════════════════════════════════════════════════
   DAVR TANLASH — SOF MANTIQ (V69)

   Do'kon egasi: «foydalanuvchi istalgan davrni tanlay olishi kerak —
   bugun, kecha, shu hafta, o'tgan hafta, shu oy, o'tgan oy, shu chorak,
   shu yil, o'tgan yil, va o'z oralig'i».

   ═══ NEGA ALOHIDA FAYL VA NEGA SINOV BILAN ════════════════════════════

   Davr chegarasi noto'g'ri hisoblansa, hisobotdagi HAMMA raqam noto'g'ri
   bo'ladi — lekin ekranda hech narsa buzilmaydi. Bir kunga siljigan
   «o'tgan oy» hech qanday xato bermaydi, shunchaki boshqa oyni
   ko'rsatadi va buni faqat qo'lda hisoblab tekshirib topsa bo'ladi.

   ⚠ ENG QIMMAT XATO SHU YERDA BO'LGAN. Ilgari `ReportsPage` da sutka
   boshi `Date.UTC(...)` bilan olinardi: mahalliy 00:00–05:00 oralig'ida
   bu KELAJAK lahzasini berardi, oraliq teskari bo'lib qolardi va
   hisobot BO'M-BO'SH chiqardi. Ya'ni har kuni tunda besh soat davomida
   do'kon egasi «bugun savdo yo'q» degan ekranni ko'rardi. Shuning
   uchun bu yerda hamma chegara MAHALLIY vaqtda quriladi
   (`new Date(y, m, d)`), backend esa aynan shu qoidani `Asia/Tashkent`
   da takrorlaydi.

   ⚠ Oxiri — DAVRNING OXIRGI LAHZASI, «hozir» EMAS. «O'tgan oy» ni
   `hozir` bilan yopsak, u o'tgan oydan bugungacha bo'lgan hamma narsani
   qamrardi. Joriy davrlarda esa oxiri kelajakda bo'lishi mumkin va bu
   xato emas: kelajakda chek yo'q.
   ══════════════════════════════════════════════════════════════════════════ */

/** Tanlovlar — ekrandagi tartibda. `key` saqlanadi (localStorage). */
export const PERIODS = [
  "today", "yesterday", "week", "lastWeek", "month",
  "lastMonth", "quarter", "year", "lastYear", "custom",
];

/** Kun boshi — MAHALLIY vaqtda. */
export const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Kun oxiri — keyingi kunning boshi (yarim ochiq oraliq). */
export const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/**
 * Hafta boshi — DUSHANBA.
 *
 * ⚠ `getDay()` da yakshanba = 0. To'g'ridan-to'g'ri ayirsak, yakshanba
 * kuni hafta KEYINGI dushanbadan boshlangan bo'lib chiqardi va butun
 * hafta ma'lumoti yo'qolardi.
 */
export const weekStart = (d) => {
  const x = dayStart(d);
  const dow = (x.getDay() + 6) % 7;          // dushanba = 0
  x.setDate(x.getDate() - dow);
  return x;
};

export const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const quarterStart = (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
export const yearStart = (d) => new Date(d.getFullYear(), 0, 1);

/**
 * Tanlangan davrning chegaralari.
 *
 * @param key   `PERIODS` dan biri
 * @param now   «hozir» — sinov uchun beriladi, ilovada tashlab ketiladi
 * @param custom `{ from, to }` — `YYYY-MM-DD` (faqat `custom` uchun)
 * @returns `{ from: Date, to: Date }` — `to` YARIM OCHIQ (kirmaydi)
 */
export function periodRange(key, now = new Date(), custom = null) {
  const d = now;
  switch (key) {
    case "yesterday": {
      const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      return { from: dayStart(y), to: dayEnd(y) };
    }
    case "week":      return { from: weekStart(d), to: dayEnd(d) };
    case "lastWeek": {
      const s = weekStart(d);
      const prev = new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7);
      return { from: prev, to: s };
    }
    case "month":     return { from: monthStart(d), to: dayEnd(d) };
    case "lastMonth": {
      const s = monthStart(d);
      return { from: new Date(s.getFullYear(), s.getMonth() - 1, 1), to: s };
    }
    case "quarter":   return { from: quarterStart(d), to: dayEnd(d) };
    case "year":      return { from: yearStart(d), to: dayEnd(d) };
    case "lastYear": {
      const s = yearStart(d);
      return { from: new Date(s.getFullYear() - 1, 0, 1), to: s };
    }
    case "custom": {
      /* ⚠ Bo'sh yoki teskari oraliq — BUGUNGA qaytadi, bo'sh javobga
         emas: foydalanuvchi sanani yozib bo'lmaguncha ekran «savdo
         yo'q» deb turishi kerak emas. */
      const a = parseDate(custom?.from);
      const b = parseDate(custom?.to);
      if (!a || !b) return periodRange("today", d);
      const from = dayStart(a <= b ? a : b);
      const to = dayEnd(a <= b ? b : a);
      return { from, to };
    }
    default:          return { from: dayStart(d), to: dayEnd(d) };
  }
}

/** `YYYY-MM-DD` → mahalliy `Date`; noto'g'ri qiymat — `null`. */
export function parseDate(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `Date` → `YYYY-MM-DD` (mahalliy — `toISOString` UTC ga siljitardi). */
export const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Serverga ketadigan ISO lahza.
 *
 * ⚠ Mintaqa siljishi SAQLANADI (`toISOString`): server `Instant` kutadi
 * va u mutlaq lahza. Mahalliy matnni «Z» bilan yuborsak, server uni
 * boshqa lahza deb o'qib, davrni besh soatga siljitardi.
 */
export const isoInstant = (d) => d.toISOString().replace(/\.\d{3}/, "");

/**
 * Davr uzunligi, kunlarda (kamida 1).
 * Grafik qadamini va «kuniga o'rtacha» ni hisoblash uchun.
 */
export const lengthDays = ({ from, to }) =>
  Math.max(1, Math.round((to - from) / 86400000));

/**
 * O'sish foizi: `(now − prev) / |prev| × 100`.
 *
 * ⚠ Oldingi davr NOL bo'lsa foiz YO'Q (`null`), nol emas va cheksizlik
 * ham emas. «0 dan 12 mln ga o'sish» ni foizda ifodalab bo'lmaydi;
 * ekranda «+∞%» yoki «+0%» yozilsa, ikkalasi ham yolg'on bo'lardi.
 * Ekran bunda o'sish o'rniga «yangi» deb yozadi.
 */
export function growth(now, prev) {
  const a = Number(now) || 0;
  const b = Number(prev) || 0;
  if (b === 0) return a === 0 ? 0 : null;
  return ((a - b) / Math.abs(b)) * 100;
}
