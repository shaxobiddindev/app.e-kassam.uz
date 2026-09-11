/* ══════════════════════════════════════════════════════════════════════════
   PROGNOZ VA REJA — SOF MANTIQ (V70)

   Do'kon egasi ikkita narsani so'radi: «oy tugashiga 8 kun qoldi,
   tizim 2.08 mlrd bo'lishini taxmin qilsin» va «reja 2.0 mlrd,
   haqiqat 1.62 mlrd, bajarilish 81%».

   ═══ NEGA ODDIY USUL, «SUN'IY AQL» EMAS ═══════════════════════════════

   Bu yerda chiziqli trend va hafta kuni koeffitsiyenti ishlatiladi —
   ya'ni arifmetika, va uni QO'LDA TEKSHIRIB bo'ladi. Murakkab model
   (ARIMA, neyron tarmoq) do'kon ma'lumotida (bir necha o'n kunlik
   qator) aniqroq javob bermaydi, lekin tushuntirib bo'lmaydigan qora
   quti bo'lardi. Prognoz bir marta ko'zga tashlanadigan darajada
   noto'g'ri chiqsa, unga ishonch qaytmaydi — shuning uchun u soddaligi
   bilan himoyalangan.

   ⚠ MA'LUMOT KAM BO'LSA PROGNOZ YO'Q (`null`). Uch kunlik qatordan
   chiqarilgan «kelasi hafta» taxmini son bo'lib ko'rinadi-yu, aslida
   tasodif. Bo'sh javob esa ekranni «hali ma'lumot yetarli emas»
   deyishga majbur qiladi va bu halol.
   ══════════════════════════════════════════════════════════════════════════ */

const nz = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Prognoz uchun kerakli eng kam nuqta soni. */
export const MIN_POINTS = 7;

/**
 * Eng kichik kvadratlar bo'yicha chiziqli trend.
 *
 * @param ys qiymatlar (vaqt bo'yicha tartiblangan)
 * @returns `{ a, b }` — `y = a + b·x`, `x` nuqta tartibi (0 dan)
 */
export function trend(ys) {
  const n = ys.length;
  if (!n) return { a: 0, b: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const y = nz(ys[i]);
    sx += i; sy += y; sxy += i * y; sxx += i * i;
  }
  const den = n * sxx - sx * sx;
  /* ⚠ Bitta nuqtada maxraj NOL bo'ladi — bunda qiyalik yo'q va
     javob o'sha qiymatning o'zi. Bo'lishga tashlab qo'yilsa `NaN`
     chiqib, ekranga «NaN so'm» yozilardi. */
  if (den === 0) return { a: sy / n, b: 0 };
  const b = (n * sxy - sx * sy) / den;
  return { a: (sy - b * sx) / n, b };
}

/**
 * Keyingi kunlar uchun taxmin.
 *
 * @param points `[{ at, value }]` — kunlik qator (bo'sh kunlar ham)
 * @param ahead  nechta kun oldinga
 * @returns `[{ at, value, low, high }]` yoki `null` (ma'lumot kam)
 *
 * ⚠ HAFTA KUNI KOEFFITSIYENTI qo'llanadi. Do'konda shanba va
 * dushanba butunlay boshqa kunlar; faqat trend bilan chizilgan
 * prognoz ikkalasiga ham o'rtacha berardi va har hafta oxirida
 * xato takrorlanardi.
 *
 * ⚠ ORALIQ (`low`/`high`) — o'tmishdagi xatoning o'rtachasidan.
 * Bitta son ko'rsatish uni «va'da» qilib qo'yardi; oraliq esa
 * taxmin ekanini ochiq aytadi.
 */
export function forecast(points, ahead = 7) {
  const pts = (points || []).filter((p) => p && p.at);
  if (pts.length < MIN_POINTS) return null;

  const ys = pts.map((p) => nz(p.value));
  const { a, b } = trend(ys);

  /* ══ HAFTA KUNI KOEFFITSIYENTI ══════════════════════════════════
     ⚠ TRENDDAN TOZALANGAN qator ustida hisoblanadi (`y / trend`),
     xom qiymat ustida EMAS.

     Sabab — sinov ushlagan haqiqiy xato. Xom o'rtacha bilan
     hisoblanganda o'sib borayotgan qatorda BOSHIDAGI kunlar past,
     OXIRIDAGI kunlar baland chiqadi — ya'ni o'sish «hafta kuni
     ta'siri» deb o'qilardi. Ikki haftalik qatorda har kun aynan
     ikki marta uchraydi va bu xato eng kuchli bo'ladi: bir tekis
     o'sayotgan savdoda prognoz kelasi kunni HOZIRGIDAN PAST
     ko'rsatardi.

     Trenddan tozalangach, koeffitsiyent faqat haqiqiy haftalik
     tebranishni ushlaydi: «shanba trend chizig'idan 1,4 barobar
     yuqori». */
  const fit = (i) => a + b * i;
  const byDow = new Map();
  pts.forEach((p, i) => {
    const base = fit(i);
    /* Trend nolga yaqin bo'lgan nuqta tashlanadi: nolga bo'lish
       cheksizlik beradi va bitta shunday kun butun koeffitsiyentni
       buzardi. */
    if (!(base > 0)) return;
    const d = new Date(p.at).getDay();
    const box = byDow.get(d) || { sum: 0, n: 0 };
    box.sum += ys[i] / base; box.n += 1;
    byDow.set(d, box);
  });
  /* Ma'lumot yetmasa — 1 (ta'sir yo'q): bitta kuzatuvdan «shanba
     ikki barobar» degan xulosa chiqarib bo'lmaydi. */
  const k = (dow) => {
    const box = byDow.get(dow);
    if (!box || box.n < 2) return 1;
    return box.sum / box.n;
  };

  /* O'tmishdagi o'rtacha xato — oraliq kengligi shundan. */
  let err = 0;
  ys.forEach((y, i) => { err += Math.abs(y - fit(i) * k(new Date(pts[i].at).getDay())); });
  const band = ys.length ? err / ys.length : 0;

  const last = new Date(pts[pts.length - 1].at);
  const out = [];
  for (let i = 1; i <= ahead; i++) {
    const at = new Date(last.getFullYear(), last.getMonth(), last.getDate() + i);
    /* ⚠ Manfiy prognoz NOLGA qisiladi: tushayotgan trend uzoq
       kunlarda minusga o'tadi va «−1.2 mln sotamiz» degan ekran
       ma'nosiz bo'lardi. */
    const raw = fit(pts.length - 1 + i) * k(at.getDay());
    const value = Math.max(0, raw);
    out.push({ at, value, low: Math.max(0, value - band), high: value + band });
  }
  return out;
}

/**
 * Davr oxirigacha kutilayotgan jami.
 *
 * @param done   hozirgacha yig'ilgan summa
 * @param points kunlik qator (prognoz uchun)
 * @param daysLeft davr oxirigacha qolgan KUNLAR
 *
 * ⚠ Qolgan kun NOL bo'lsa — kutilayotgan jami hozirgi jamining
 * o'zi: davr tugagan va taxmin qiladigan narsa qolmagan.
 */
export function expectedTotal(done, points, daysLeft) {
  const base = nz(done);
  if (daysLeft <= 0) return base;
  const f = forecast(points, daysLeft);
  if (!f) return null;
  return base + f.reduce((s, x) => s + x.value, 0);
}

/**
 * Reja bajarilishi.
 *
 * @returns `{ percent, left, perDayNeeded }` yoki `null` (reja yo'q)
 *
 * ⚠ Reja NOL yoki yo'q bo'lsa — `null`, «100% bajarildi» EMAS.
 * Nolga bo'lish cheksizlik beradi, «0 dan 0» esa ma'nosiz; ikkalasi
 * ham ekranda yolg'on bo'lardi.
 */
export function targetProgress(target, done, daysLeft) {
  const t = nz(target);
  if (t <= 0) return null;
  const d = nz(done);
  const left = Math.max(0, t - d);
  return {
    percent: (d / t) * 100,
    left,
    /* Qolgan kunlarda kuniga qancha kerak. Kun qolmagan bo'lsa —
       `null`: «kuniga cheksiz kerak» degan javob foydasiz. */
    perDayNeeded: daysLeft > 0 ? left / daysLeft : null,
  };
}
