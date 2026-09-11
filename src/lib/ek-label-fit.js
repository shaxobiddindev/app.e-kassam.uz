/**
 * Yorliq dizaynining qog'ozga mosligi (G5).
 *
 * ⚠ SOF MANTIQ, KOMPONENTDAN TASHQARIDA. Komponent ichida
 * yashiringan qoida sinaladigan narsa emas: uni tekshirish uchun
 * butun React daraxtini ko'tarish kerak bo'lardi va shu sababdan
 * hech kim tekshirmasdi.
 *
 * ⚠ MATN BU YERDA YO'Q, faqat SONLAR qaytadi. Tarjima UI
 * qatlamida qoladi — shu sababdan bu fayl `node` da to'g'ridan-
 * to'g'ri sinaladi (loyihaning boshqa sinaladigan kutubxonalari
 * kabi).
 */

/**
 * Shablon tanlangan qog'ozga sig'adimi.
 *
 * @returns {null|{tw,th,mw,mh}} `null` — sig'adi; obyekt — sig'maydi
 *          va ichida IKKALA o'lcham ham bor.
 */
export function fitOf(tpl, media) {
  if (!media || !tpl) return null;
  const tw = Number(tpl.widthMm), th = Number(tpl.heightMm);
  const mw = Number(media.labelWidthMm);
  const mh = media.labelHeightMm == null ? null : Number(media.labelHeightMm);
  if (!(tw > 0 && mw > 0)) return null;

  const wideBy = tw - mw;
  /* ⚠ BALANDLIGI NOMA'LUM (uzluksiz) MEDIADA BO'Y TEKSHIRILMAYDI:
     printer uzunlikni o'zi kesadi, ya'ni har qanday bo'y sig'adi.
     Aks holda har bir dizayn «mos emas» bo'lib chiqardi. */
  const tallBy = mh == null ? -1 : th - mh;
  if (wideBy <= 0.001 && tallBy <= 0.001) return null;

  return { tw: round1(tw), th: round1(th), mw: round1(mw), mh: mh == null ? null : round1(mh) };
}

/**
 * Yorliqda ko'rinadigan narsa BORMI.
 *
 * ⚠ FON VA RAMKA SANALMAYDI: ular har doim chiziladi va «bo'sh
 * emas» degan yolg'on javob berardi. Ko'rinadigan narsa — matn
 * yoki qora bo'yalgan shakl.
 */
export function hasInk(svg) {
  const s = String(svg || "");
  if (/<text/.test(s)) return true;
  return (s.match(/fill="#000"/g) || []).length > 0;
}

const round1 = (n) => (Math.round(Number(n) * 10) / 10).toString();
