/**
 * ══════════════════════════════════════════════════════════════════════════
 * STIKER — AVTOMATIK TANLOVLAR (2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Egasining talabi: «bu bo'lim juda murakkab, nima qilayotganimni bilmayapman
 * — ko'p narsani avto qiladigan qilib, men qiladigan ishlar aniq va juda
 * sodda bo'lsin, hamma ham texnikani tushunmaydi».
 *
 * Ilgari do'konchi o'zi tanlashi kerak edi: printer MODELI (TSPL/ZPL nimaligini
 * bilmay), Windows navbati, qog'oz profili, dizayn, datchik, zichlik, siljish,
 * navbat manbasi va son qoidasi. Endi undan faqat IKKITA narsa so'raladi —
 * printer (ro'yxatdan, yorliq printeri allaqachon belgilangan) va stiker
 * o'lchami. Qolganini shu fayl HAL QILADI.
 *
 * ⚠ SOF MANTIQ, DOM YO'Q: Node'da sinaladi (`test/sticker-auto.test.mjs`).
 */

/* ── Printer nomidan turini topish ─────────────────────────────────────
   ⚠ XPRINTER CHEK PRINTERLARI HAM «XP-» BILAN BOSHLANADI (XP-58, XP-80C,
   XP-Q200). Ular yorliq tilini (TSPL) tushunmaydi va baytlarni MATN qilib
   chiqarardi. Shuning uchun avval chek printeri qoidasi tekshiriladi. */
const RECEIPT = /\bpos[- ]?(58|76|80)|xp[- ]?(58|76|80)|xp[- ]?[qnct]\d|80\s?mm|58\s?mm|receipt|чек|chek|tm-t\d|rp[- ]?(58|80)\b/i;
const VIRTUAL = /pdf|xps|onenote|fax|факс|anydesk|send to|microsoft print/i;
const TSPL = /xp[- ]?\d{3}b|xp[- ]?(dt|tt|h)\d|xprinter|tsc|ttp[- ]?\d|te[23]\d\d|da2\d\d|rongta|rp4\d\d|hprt|gprinter|gp[- ]?\d{4}|label|этикет|yorliq|stiker|sticker/i;
const ZPL = /zebra|\bzd\d|\bgk4|\bgx4|\bzt\d|\bgc4/i;
const EZPL = /godex|\bg5\d\d|\bez[- ]?\d/i;

/**
 * @returns {"tspl"|"zpl"|"ezpl"|"receipt"|"virtual"|"other"}
 */
export function printerKind(name) {
  const s = String(name || "");
  if (VIRTUAL.test(s)) return "virtual";
  if (RECEIPT.test(s)) return "receipt";
  if (ZPL.test(s)) return "zpl";
  if (EZPL.test(s)) return "ezpl";
  if (TSPL.test(s)) return "tspl";
  return "other";
}

const isLabel = (kind) => kind === "tspl" || kind === "zpl" || kind === "ezpl";

/**
 * Windows printerlari — yorliq printerlari tepada, virtual (PDF, Fax) pastda.
 *
 * ⚠ CHEK PRINTERI YORLIQ PRINTERI DEB TANLANMAYDI: kassada allaqachon chek
 * printeri sifatida sozlangan nom (`receiptName`) ham chek deb sanaladi.
 */
export function sortPrinters(names = [], receiptName = "") {
  const rank = { tspl: 0, zpl: 0, ezpl: 0, other: 1, receipt: 2, virtual: 3 };
  return [...new Set(names.filter(Boolean))]
    .map((name) => {
      const kind = name === receiptName ? "receipt" : printerKind(name);
      return { name, kind, label: isLabel(kind) };
    })
    .sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * Avtomatik tanlanadigan printer: ro'yxatda BITTA yorliq printeri bo'lsa —
 * o'sha. Bir nechta bo'lsa yoki birortasi bo'lmasa — null (odam tanlaydi).
 *
 * ⚠ IKKITA YORLIQ PRINTERIDAN BIRINI TAXMIN QILMAYMIZ: noto'g'ri tanlansa
 * stiker boshqa xonadagi printerdan chiqadi va do'konchi «ishlamayapti» deydi.
 */
export function autoPrinter(names = [], receiptName = "") {
  const labels = sortPrinters(names, receiptName).filter((p) => p.label);
  return labels.length === 1 ? labels[0].name : null;
}

/* ── Printer profili ────────────────────────────────────────────────────
   Serverdagi tayyor profillar (V135): xprinter_365b, tsc_te200,
   rongta_rp400 (TSPL), zebra_zd230 (ZPL), godex_g500 (EZPL), driver_a4. */
const PROFILE_BY = [
  [/tsc|ttp|te[23]\d\d|da2\d\d/i, "tsc_te200"],
  [/rongta|rp4\d\d/i, "rongta_rp400"],
];

/**
 * Windows nomidan printer profili.
 *
 * ⚠ NOMA'LUM PRINTER — DRAYVER YO'LI (brauzer oynasi). Unga TSPL yuborish
 * xavfli: tilni bilmasa u buyruqlarni matn qilib chiqaradi va rulon to'la
 * tushunarsiz yozuv bo'ladi. Drayver yo'li sekinroq, lekin har doim ishlaydi.
 */
export function profileFor(name, profiles = []) {
  const system = profiles.filter((p) => p.system || p.code);
  const byCode = (code) => system.find((p) => p.code === code) || null;
  const kind = printerKind(name);
  if (kind === "zpl") return byCode("zebra_zd230");
  if (kind === "ezpl") return byCode("godex_g500");
  if (kind === "tspl") {
    for (const [re, code] of PROFILE_BY) if (re.test(String(name))) return byCode(code);
    return byCode("xprinter_365b");
  }
  return byCode("driver_a4");
}

/* ── Stiker o'lchami ────────────────────────────────────────────────────
   ⚠ TARTIB BOZORDAN: O'zbekistonda stiker rulonlarining eng ko'p
   sotiladigani 58×40, 40×30 va 30×20. Birinchi uchtasi katta tugma,
   qolgani «boshqa o'lcham» ichida. */
export const MAIN_SIZES = [[58, 40], [40, 30], [30, 20]];

/** Rulon profili o'lcham bo'yicha (bir qatorli rulon ustun). */
export function mediaFor(w, h, medias = []) {
  const rolls = medias.filter((m) => String(m.mediaType) === "RULON"
    && Number(m.labelWidthMm) === Number(w) && Number(m.labelHeightMm) === Number(h));
  return rolls.find((m) => Number(m.across || 1) === 1) || rolls[0] || null;
}

/** Stiker uchun tanlasa bo'ladigan rulonlar (chek lentasi va varaqsiz). */
export function stickerMedias(medias = []) {
  return medias.filter((m) => String(m.mediaType) === "RULON" && String(m.sensor) !== "UZLUKSIZ");
}

/* ── Dizaynlar (V142) ───────────────────────────────────────────────────
   ⚠ BITTA DIZAYN — HAMMA O'LCHAMDA. Egasining talabi: «shablonlarni juda
   ko'paytir va ular mavjud hamma o'lchamda bo'lsin». Bazada har dizayn har
   rulon o'lchami uchun alohida qator (`stk_<dizayn>_<eni>x<bo'yi>`), ularni
   `scripts/gen-sticker-templates.mjs` hisoblaydi. Front esa dizaynni KOD
   orqali taniydi: do'konchi rulonni almashtirsa, o'sha ko'rinish yangi
   o'lchamda o'zi tanlanadi.

   Tartib — galereyadagi tartib: eng ko'p ishlatiladiganlari tepada. */
export const DESIGN_ORDER = [
  "standard", "big_price", "price_top", "name_big", "barcode_price", "barcode_only",
  "code_first", "side", "framed", "shop", "bilingual", "brand", "expiry", "clothing",
];

/** Javon yorlig'i dizaynlari (V143) — xuddi shu usul, kod `shf_<dizayn>_<eni>x<bo'yi>`. */
export const SHELF_DESIGN_ORDER = [
  "classic", "big_price", "minimal", "code_big", "promo", "weighed", "shop", "bilingual", "detailed",
];

/** V131 dagi shablonlar — o'z dizayniga (yangilari ularning o'rnini to'ldiradi). */
const LEGACY = {
  sticker_standard: "standard", sticker_small: "barcode_price", sticker_expiry: "expiry",
  sticker_barcode_only: "barcode_only", sticker_code_first: "code_first", sticker_clothing: "clothing",
  shelf_classic: "classic", shelf_big_price: "big_price", shelf_promo: "promo",
  shelf_weighed: "weighed", shelf_minimal: "minimal", shelf_detailed: "detailed",
  shelf_bilingual: "bilingual", shelf_a5: "promo",
};

/** Shablonning dizayni yoki null (do'konning o'z shabloni). */
export function designOf(tpl) {
  const code = String(tpl?.code || "");
  if (LEGACY[code]) return LEGACY[code];
  const m = code.match(/^(?:stk|shf)_([a-z_]+)_\d+x\d+$/);
  return m ? m[1] : null;
}

const designRank = (tpl) => {
  const order = tpl?.kind === "SHELF" ? SHELF_DESIGN_ORDER : DESIGN_ORDER;
  const i = order.indexOf(designOf(tpl));
  return i < 0 ? -1 : i;   // do'konning o'zinikilari — eng tepada
};

const sameSize = (tpl, media) => Number(tpl.widthMm) === Number(media?.labelWidthMm)
  && Number(tpl.heightMm) === Number(media?.labelHeightMm);

/**
 * Shu qog'oz o'lchamidagi stiker dizaynlari — galereya uchun, tartib bilan.
 * Qog'oz noma'lum bo'lsa — hammasi.
 */
export function designsFor(templates = [], media = null, kind = "STICKER") {
  const list = templates.filter((x) => x.kind === kind && (!media || sameSize(x, media)));
  return list.sort((a, b) => designRank(a) - designRank(b));
}

/**
 * Qog'ozga mos dizayn.
 *
 * Tartib: (1) do'konchi tanlagan dizayn — AYNAN SHU O'LCHAMDAGISI (rulon
 * almashsa ko'rinish saqlanadi); (2) aynan o'lchamdagi: do'konning o'zinikisi,
 * bo'lmasa «Standart»; (3) sig'adiganlarning eng kattasi; (4) eng kichigi.
 *
 * ⚠ «ENG KATTA SIG'ADIGANI», birinchisi emas: 58×40 rulonga 30×20 dizayn
 * ham sig'adi, lekin u stikerning burchagida mitti bo'lib chiqardi.
 */
export function pickTemplate(templates = [], media = null, preferId = null, kind = "STICKER") {
  const list = templates.filter((x) => x.kind === kind);
  if (!list.length) return null;
  /* ⚠ VARAQ (A4) — O'LCHAM YO'Q: varaqqa har qanday yorliq sig'adi va to'r
     dizayndan hisoblanadi. Varaq profilidagi «50×30» — katak namunasi, cheklov
     emas; unga qarab tanlansa, javon yorlig'i doim 50×30 bo'lib qolardi. */
  if (!media || String(media.mediaType) === "VARAQ") {
    const base = kind === "SHELF" ? "classic" : "standard";
    return list.find((x) => x.id === preferId)
      || list.find((x) => x.isDefault)
      || list.find((x) => designOf(x) === base && x.system)
      || list[0];
  }
  const W = Number(media?.labelWidthMm) || Infinity;
  const H = Number(media?.labelHeightMm) || Infinity;
  const fits = (x) => Number(x.widthMm) <= W + 0.001 && Number(x.heightMm) <= H + 0.001;
  const exactOf = (x) => Number(x.widthMm) === W && Number(x.heightMm) === H;

  const preferred = list.find((x) => x.id === preferId);
  if (preferred) {
    if (exactOf(preferred) || !media) return preferred;
    const d = designOf(preferred);
    const same = d && list.find((x) => exactOf(x) && designOf(x) === d);
    if (same) return same;
    if (fits(preferred) && !list.some(exactOf)) return preferred;
  }

  const exact = list.filter(exactOf);
  if (exact.length) {
    return exact.find((x) => !x.system)
      || exact.find((x) => designOf(x) === "standard")
      || [...exact].sort((a, b) => designRank(a) - designRank(b))[0];
  }

  const area = (x) => Number(x.widthMm) * Number(x.heightMm);
  const fitting = list.filter(fits).sort((a, b) => area(b) - area(a));
  if (fitting.length) return fitting[0];
  return [...list].sort((a, b) => area(a) - area(b))[0];
}

/**
 * Sozlash tugaganmi.
 *
 * ⚠ BRAUZERDA PRINTER SO'RALMAYDI: u yerda printer chop etish oynasida
 * tanlanadi va sahifa uni bilolmaydi. Faqat o'lcham yetarli.
 */
export function setupDone(out, { desktop = false, queue = "" } = {}) {
  if (!out?.media) return false;
  /* A4 varaq oddiy printerdan, chop etish oynasi orqali — navbat kerak emas. */
  if (String(out.media.mediaType) === "VARAQ") return true;
  return desktop ? Boolean(queue) : true;
}

/** A4 yopishqoq/oddiy varaq profili (javon yorlig'i uchun). */
export function sheetMedia(medias = []) {
  return medias.find((m) => m.code === "sheet_a4")
    || medias.find((m) => String(m.mediaType) === "VARAQ" && Number(m.pageWidthMm) === 210)
    || null;
}

/**
 * Printer xatosini odam tiliga o'giradi. Lug'at kaliti yoki null.
 *
 * ⚠ WINDOWS XATOSI DO'KONCHIGA HECH NARSA DEMAYDI: «StartDocPrinter
 * muvaffaqiyatsiz» yoki «OpenPrinterW: 0x80070709» o'rniga nima qilish
 * kerakligi aytiladi. Asl matn yo'qolmaydi — u kichik qilib yoniga qo'yiladi.
 */
export function printerErrorKey(message) {
  const s = String(message || "");
  if (/Printer ochilmadi|OpenPrinter|0x80070709|StartDocPrinter|WritePrinter|Yuborildi \d+\/\d+/i.test(s)) {
    return "stk.errPrinter";
  }
  if (/ulanib bo'lmadi|timed out|connect/i.test(s)) return "stk.errNetwork";
  return null;
}

/** Kompyuter ilovasini yuklab olish — landingdagi bilan bir xil manzil. */
export const DESKTOP_URL =
  "https://github.com/shaxobiddindev/app.e-kassam.uz/releases/latest/download/e-Kassam-setup.exe";

/* ── Oxirgi tanlangan dizayn (shu kompyuterda) ─────────────────────────
   ⚠ BRAUZER XOTIRASIDA: bu shaxsiy qulaylik, do'kon sozlamasi emas —
   yo'qolsa `pickTemplate` qog'ozga mosini o'zi topadi. */
const LAST_TPL = "ek_lbl_last_tpl";
export const lastTemplateId = () => {
  try { return Number(localStorage.getItem(LAST_TPL)) || null; } catch { return null; }
};
export const rememberTemplate = (id) => {
  try { localStorage.setItem(LAST_TPL, String(id)); } catch { /* to'la yoki yopiq */ }
};
