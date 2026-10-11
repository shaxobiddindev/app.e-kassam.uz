/* ══════════════════════════════════════════════════════════════════════════
   KUNLIK HISOBOT — sof hisoblar (2026-10-09)

   ⚠ KUN — TOSHKENT BO'YICHA, qurilma mintaqasidan qat'i nazar. Server kunni
   `Asia/Tashkent` da oladi (`common.time.Zones`); kassa kompyuterining
   soati boshqa mintaqaga qo'yilgan bo'lsa, «bugun» ikki tomonda har xil
   bo'lib, xulosa va tovarlar jadvali boshqa-boshqa kunni ko'rsatardi.
   O'zbekistonda 1992 dan beri yozgi vaqt yo'q — qat'iy +05:00.

   Bu fayl DOM bilmaydi — node'da sinaladi (`test/day-report.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

const OFFSET_MS = 5 * 3600 * 1000;

/** Toshkentdagi bugungi sana — «YYYY-MM-DD». */
export function todayIso(now = Date.now()) {
  return new Date(now + OFFSET_MS).toISOString().slice(0, 10);
}

/** Kunni surish (−1 kecha, +1 ertaga). */
export function shiftDay(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Toshkent kunining chegaralari — analitika so'roviga (ISO, UTC). */
export function dayBounds(iso) {
  const from = new Date(`${iso}T00:00:00+05:00`);
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Jadvalda nimalar: «moved» — kun ichida harakati bo'lganlar (server shuni
 * beradi), «sold» — faqat sotilgan yoki qaytarilganlar, «all» — hammasi
 * (server `all=true` bilan beradi).
 */
export function rowFilter(rows, show) {
  if (show !== "sold") return rows;
  return rows.filter((r) => Number(r.sold) > 0 || Number(r.returned) > 0);
}

/* ══ DAVR (2026-10-11) ═════════════════════════════════════════════════════
   Egasi: «kunlik, oylik, yillik va hokazo — juda keng va sodda». Chegaralar
   TOSHKENT kunlarida (yuqoridagi sabab), ikkalasi ham KIRADI.
   `key` — `ek-period.PERIODS` dan biri; `custom` — { from, to } «YYYY-MM-DD». */
export function periodDays(key, today = todayIso(), custom = null) {
  const d = new Date(`${today}T00:00:00Z`);
  const iso = (x) => x.toISOString().slice(0, 10);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const dow = (d.getUTCDay() + 6) % 7;                       // dushanba = 0
  const monday = shiftDay(today, -dow);
  switch (key) {
    case "yesterday": { const k = shiftDay(today, -1); return { from: k, to: k }; }
    case "week":      return { from: monday, to: today };
    case "lastWeek":  return { from: shiftDay(monday, -7), to: shiftDay(monday, -1) };
    case "month":     return { from: iso(new Date(Date.UTC(y, m, 1))), to: today };
    case "lastMonth": return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
    case "quarter":   return { from: iso(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))), to: today };
    case "year":      return { from: `${y}-01-01`, to: today };
    case "lastYear":  return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "custom": {
      const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
      if (!ok(custom?.from) || !ok(custom?.to)) return { from: today, to: today };
      return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from };
    }
    default:          return { from: today, to: today };
  }
}

/** Davrdagi kunlar soni (ikkala chekka ham kiradi). */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/** Eng ko'p (sotuv puli, foyda…) bo'yicha birinchi `n` ta — nolinchilar tashlanadi. */
export function topBy(rows, get, n = 10) {
  return (rows || []).filter((r) => Number(get(r)) > 0)
    .sort((a, b) => Number(get(b)) - Number(get(a))).slice(0, n);
}

/** Sotilmay yotgan: qoldig'i bor, davrda bittasi ham sotilmagan (qoldiq qiymati bo'yicha). */
export function idleRows(rows, n = 20) {
  return (rows || []).filter((r) => r.tracksStock && Number(r.closing) > 0 && !(Number(r.sold) > 0))
    .sort((a, b) => Number(b.closing) * Number(b.salePrice || 0) - Number(a.closing) * Number(a.salePrice || 0))
    .slice(0, n);
}
