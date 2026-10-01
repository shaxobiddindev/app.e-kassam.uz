/* ══════════════════════════════════════════════════════════════════════════
   «ISHLATILGAN» QIDIRUVDAN KEYINGI YOZISH — kassa (2026-10-01)

   Do'kon shikoyati: «qidiruvda mahsulot topilib qo'shilgandan keyin ikkinchi
   kiritish eskisining DAVOMIDAN yozilyapti: 45 → 45 4545».

   Matn qo'shilgandan keyin ATAYLAB qoladi (§10Ū): kassir o'sha tovarni yana
   bossin. Lekin keyingi YOZISH — yangi qidiruv. Asosiy yo'l — maydonga
   qaytganda matn belgilanadi va yozilgan narsa uni almashtiradi (ekran
   klaviaturasi ham tanlovni almashtiradi — `ek-keys.insert`). Bu funksiya
   — zaxira: belgi biror sababdan yo'qolgan bo'lsa ham (sensorli ekran,
   brauzer farqi), OXIRIGA qo'shilgan matn eskisini almashtiradi.

   ⚠ O'rtaga yozish yoki o'chirish — odamning ATAYLAB tahriri, unga
   tegilmaydi. Kod rejimidagi `*` saqlanadi: kassir keyingi kodni yozmoqda,
   rejimdan chiqib ketmasin.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @param old  qo'shilishdan oldingi (ishlatilgan) so'rov
 * @param next maydonning yangi qiymati
 * @returns qidiruvga ketadigan so'rov
 */
export function freshQuery(old, next) {
  const prev = old || "";
  const value = next || "";
  if (!prev || value.length <= prev.length || !value.startsWith(prev)) return value;
  const tail = value.slice(prev.length);
  return prev.startsWith("*") && !tail.startsWith("*") ? "*" + tail : tail;
}
