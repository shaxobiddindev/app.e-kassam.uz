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
