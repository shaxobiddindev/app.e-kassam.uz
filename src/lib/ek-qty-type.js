/* ══════════════════════════════════════════════════════════════════════════
   SAVATDA RAQAM BILAN MIQDOR (V66) — SOF MANTIQ

   Do'kon egasi: «savatda tepa-pastga tugma bilan mahsulot tanlanganda
   raqam bosish orqali miqdorni o'zgartira olsin. 1, 2, 3 ni ketma-ket
   bossa miqdor 123 bo'ladi; qanchadir vaqtdan keyin yana 3, 2 deb
   yozsa u ESKISI O'RNIGA yozilsin; vaqt tugamasdan yozsa ketidan
   davom etsin (3245)».

   ═══ NEGA ALOHIDA FAYL ═════════════════════════════════════════════════

   Bu yerda VAQT bor va vaqtli mantiq brauzerda ko'z bilan sinab
   bo'lmaydi: «1,5 soniyadan keyin» degan holatni har safar kutib
   o'tirish kerak. Sof funksiya bo'lsa `now` ni qo'lda beriladi va
   sinov soniyalarni kutmaydi (`test/qty-type.test.mjs`).

   ═══ SKANER BILAN TO'QNASHMASIN ═══════════════════════════════════════

   ⚠ USB skaner ham «raqam bosadi» — soniyasiga 30–100 belgi. Uning
   birinchi belgisi oddiy raqamdan farq qilmaydi (`useScanner` ham uni
   ikkinchi belgidan keyin tanib oladi). Shuning uchun raqam DARHOL
   qo'llanmaydi: `APPLY_DELAY_MS` kutiladi va shu orada yana belgi
   kelsa (`BURST_MS` dan tez) — bu skaner, hech narsa o'zgarmaydi.
   Odam soniyasiga 5–8 belgi yozadi, ya'ni 45 ms ichida ikkinchi
   raqamni hech qachon bosmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Yozish oynasi: shundan keyin bosilgan raqam eskisi O'RNIGA yoziladi. */
export const QTY_TYPE_MS = 1500;
/** Shundan tez kelgan ikki belgi — skaner, odam emas. */
export const BURST_MS = 45;
/** Raqam qo'llanishidan oldingi kutish (skanerni ajratish uchun). */
export const APPLY_DELAY_MS = 60;
/** Eng ko'p raqam soni — 9999 dan ortiq miqdor yozish xato bosishdir. */
export const MAX_DIGITS = 4;

/**
 * Bitta tugma bosildi.
 *
 * @param session  {{ id, text, at }|null} oldingi holat
 * @param lineId   tanlangan savat qatori
 * @param key      `"0"`…`"9"` yoki `"Backspace"`
 * @param now      ms
 * @returns {{ session: object|null, apply: number|null }}
 *   `apply` — savatga qo'llanadigan miqdor (kamida 1) yoki `null`
 *   (masalan «0» yoki bo'sh matn — miqdor tegilmaydi).
 */
export function typeQtyKey(session, lineId, key, now, windowMs = QTY_TYPE_MS) {
  /* ⚠ DAVOM ETISH SHARTI — o'sha qator VA oyna hali yopilmagan.
     Boshqa qator tanlangan bo'lsa raqam yangidan boshlanadi: «5»
     bosgan kassir oldingi qatorning «12» siga qo'shilib «125»
     bo'lishini kutmaydi. */
  const cont = !!session && session.id === lineId && now - session.at < windowMs;
  let text = cont ? session.text : "";

  if (key === "Backspace") {
    /* Yozilayotgan narsa bo'lmasa Backspace hech narsa qilmaydi —
       eski miqdorning oxirgi raqamini o'chirish kutilmagan bo'lardi. */
    if (!cont) return { session: null, apply: null };
    text = text.slice(0, -1);
  } else if (/^[0-9]$/.test(key)) {
    /* Boshidagi nollar tashlanadi: «05» → 5. */
    text = (text + key).replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
  } else {
    return { session, apply: null };
  }

  const n = parseInt(text, 10);
  return { session: { id: lineId, text, at: now }, apply: n >= 1 ? n : null };
}

/** Oldingi tugmadan shu qadar tez kelgan belgi — skaner. */
export const isBurst = (lastAt, now) => now - lastAt < BURST_MS;
