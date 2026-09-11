/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHABLON ↔ TAHRIR FARQI (G6)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ NIMA UCHUN BU FAYL BOR. Tahrirlagich shablonni ochadi, do'konchi
 * bitta raqamni o'zgartiradi va yopadi. Ertaga ochganda EKRANDA 40 ta
 * raqam turadi va ularning qaysi biri o'ziniki, qaysi biri
 * shablonniki — bilib bo'lmaydi. Yagona yo'l: hammasini yodda
 * saqlash. Odam buni qilmaydi.
 *
 * Shuning uchun ASL NUSXA saqlanadi va har bir maydon o'zi haqida
 * javob beradi: «men shablondagidekman» yoki «meni siz
 * o'zgartirgansiz». Va o'zgartirilgani QAYTARILADI.
 *
 * ⚠ BU YERDA i18n YO'Q — faqat hisob. Matnni komponent yozadi.
 * Sabab: bu mantiq node dan sinaladi, `ek-i18n` esa modul
 * darajasida DOM ga tegadi.
 *
 * ⚠ HECH NARSA QO'SHILMAYDI. `formOf` shablonda YO'Q kalitni
 * o'ylab topmaydi. Ilgari tahrirlagich shablonda bo'lmagan
 * `sheet` (A4 210×297, 2×7) ni O'ZI qo'shib qo'yardi va
 * do'konchi hech narsaga tegmasdan «Saqlash» bossa ham,
 * 58×40 rulon shabloni A4 varaq shabloniga aylanardi.
 * O'lchandi: 15/15 tizim shabloni shunday o'zgarardi.
 */

/** Yuqori darajadagi tahrirlanadigan maydonlar. */
export const TOP_KEYS = ["name", "widthMm", "heightMm", "dpi", "thermal"];

/** Har bir maydonning tahrirlanadigan xossalari. */
export const FIELD_KEYS = ["visible", "x", "y", "w", "h", "size", "align", "overflow"];

/**
 * Shablondan tahrir shaklini yasaydi.
 *
 * ⚠ `spec` NUSXALANADI, havola olinmaydi: aks holda tahrir
 * galereyadagi kartochkani ham o'zgartirib yuborardi (ikkalasi
 * bitta obyektni ko'rsatib turardi).
 */
export function formOf(template) {
  const spec = parseSpec(template?.spec);
  return {
    name: template?.name ?? "",
    kind: template?.kind ?? "SHELF",
    widthMm: num(template?.widthMm, 50),
    heightMm: num(template?.heightMm, 30),
    dpi: num(template?.dpi, 203),
    thermal: Boolean(template?.thermal),
    spec,
  };
}

/** `spec` ni obyektga aylantiradi — HECH NARSA QO'SHMASDAN. */
export function parseSpec(spec) {
  let base = {};
  try {
    base = typeof spec === "string" ? JSON.parse(spec) : (spec || {});
  } catch {
    base = {};
  }
  const fields = Array.isArray(base.fields) ? base.fields.map((f) => ({ ...f })) : [];
  return { ...base, fields };
}

/**
 * Maydon manzili.
 *
 * ⚠ MAYDON TARTIB RAQAMI BILAN EMAS, KALITI BILAN manzillanadi
 * (`f:price:size`). Tartib raqami ishlatilsa, bitta maydon
 * o'chirilganda qolganlarining «farq qiladi» belgisi bir
 * pog'ona siljib ketardi.
 */
export const fieldPath = (key, prop) => `f:${key}:${prop}`;

/** Manzildagi qiymat. `undefined` — shablonda umuman yo'q. */
export function valueAt(form, path) {
  if (!path) return undefined;
  if (!path.startsWith("f:")) return form?.[path];
  const [, key, prop] = path.split(":");
  const f = (form?.spec?.fields || []).find((x) => x.key === key);
  return f ? f[prop] : undefined;
}

/**
 * Qaysi manzillar shablondan farq qiladi.
 *
 * ⚠ `undefined` va yozilmagan qiymat BIR XIL deb qaralmaydi
 * ko'r-ko'rona: `size` shablonda yo'q bo'lsa va do'konchi 8 yozsa —
 * bu FARQ, garchi chizuvchining o'zi ham 8 ishlatsa ham. Sabab:
 * shablon o'zgarsa, yozilmagan maydon shablon bilan birga
 * o'zgaradi, yozilgani esa qotib qoladi.
 */
export function diffPaths(form, base) {
  const out = [];
  for (const k of TOP_KEYS) {
    if (!same(form?.[k], base?.[k])) out.push(k);
  }
  const bf = base?.spec?.fields || [];
  for (const f of form?.spec?.fields || []) {
    const b = bf.find((x) => x.key === f.key);
    for (const p of FIELD_KEYS) {
      if (b === undefined) continue;           // yangi maydon — pastda
      if (!same(f[p], b[p])) out.push(fieldPath(f.key, p));
    }
  }
  return out;
}

/** Shablonda yo'q, tahrirda qo'shilgan maydonlar. */
export function addedFields(form, base) {
  const bf = new Set((base?.spec?.fields || []).map((x) => x.key));
  return (form?.spec?.fields || []).map((f) => f.key).filter((k) => !bf.has(k));
}

/** Shablonda bor, tahrirda o'chirilgan maydonlar. */
export function removedFields(form, base) {
  const ff = new Set((form?.spec?.fields || []).map((x) => x.key));
  return (base?.spec?.fields || []).map((f) => f.key).filter((k) => !ff.has(k));
}

/**
 * BITTA manzilni shablon qiymatiga qaytaradi.
 *
 * ⚠ Shablonda qiymat YO'Q bo'lsa, kalit O'CHIRILADI — nolga yoki
 * bo'sh satrga tenglashtirilmaydi. Nol ham qiymat: chizuvchi
 * uchun «yozilmagan» va «0» boshqa-boshqa narsa.
 */
export function resetPath(form, base, path) {
  if (!path) return form;
  if (!path.startsWith("f:")) {
    const next = { ...form };
    if (base && path in base) next[path] = base[path];
    return next;
  }
  const [, key, prop] = path.split(":");
  const b = (base?.spec?.fields || []).find((x) => x.key === key);
  const fields = (form?.spec?.fields || []).map((f) => {
    if (f.key !== key) return f;
    const nf = { ...f };
    if (b && prop in b) nf[prop] = b[prop];
    else delete nf[prop];
    return nf;
  });
  return { ...form, spec: { ...form.spec, fields } };
}

/** Hammasini shablonga qaytaradi — o'chirilgan maydonlar ham qaytadi. */
export function resetAll(base) {
  return formOf(toTemplate(base));
}

/** Shaklni yana shablon ko'rinishiga keltiradi (saqlash va qaytarish uchun). */
export function toTemplate(form) {
  return {
    name: form?.name, kind: form?.kind,
    widthMm: form?.widthMm, heightMm: form?.heightMm,
    dpi: form?.dpi, thermal: form?.thermal,
    spec: JSON.stringify(form?.spec ?? {}),
  };
}

/**
 * MEDIA ALMASHGANDA — nima sig'maydi.
 *
 * ⚠ HECH NARSA TUZATILMAYDI. Faqat aytiladi. Sabab: avtomatik
 * «tuzatish» do'konchining o'z qo'li bilan qo'ygan raqamini
 * jimgina yeb qo'yadi va u buni faqat qog'ozda ko'radi.
 * PROMPT G, 10-bo'lim: «Media almashganda maydonlar jimgina
 * tuzatilmaydi».
 *
 * @returns [{code, need, have}] — matnni komponent yozadi
 */
export function mediaIssues(form, media) {
  if (!media) return [];
  const out = [];
  const W = num(form?.widthMm, 0);
  const H = num(form?.heightMm, 0);
  const mw = numOrNull(media.labelWidthMm);
  const mh = numOrNull(media.labelHeightMm);

  if (mw !== null && W > mw + 0.01) out.push({ code: "wide", need: W, have: mw });

  /* ⚠ UZLUKSIZ media da balandlik solishtirilmaydi: rulon
     kerakli joyidan kesiladi, «sig'maydi» degan tushuncha yo'q. */
  if (mh !== null && H > mh + 0.01) out.push({ code: "tall", need: H, have: mh });

  /* ⚠ MAYDONLAR HAM TEKSHIRILADI, faqat umumiy o'lcham emas:
     yorliq 58 → 30 mm ga o'tganda o'ng chekkadagi narx maydoni
     qog'ozdan chiqib ketadi, lekin yorliqning o'zi «sig'adi». */
  for (const f of form?.spec?.fields || []) {
    if (f.visible === false) continue;
    const fx = num(f.x, 0), fw = num(f.w, 0);
    const fy = num(f.y, 0), fh = num(f.h, 0);
    if (mw !== null && fx + fw > mw + 0.01) {
      out.push({ code: "fieldWide", field: f.key, need: round1(fx + fw), have: mw });
    }
    if (mh !== null && fy + fh > mh + 0.01) {
      out.push({ code: "fieldTall", field: f.key, need: round1(fy + fh), have: mh });
    }
  }
  return out;
}

/* ── kichik yordamchilar ── */

function same(a, b) {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  if (typeof a === "number" || typeof b === "number") {
    return Math.abs(Number(a) - Number(b)) < 0.0001;
  }
  return a === b;
}

const num = (v, d) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const round1 = (n) => Math.round(n * 10) / 10;
