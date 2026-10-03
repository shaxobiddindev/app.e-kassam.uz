/**
 * ══════════════════════════════════════════════════════════════════════════
 * STIKERDA BARKOD — HAR DOIM (2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Egasining talabi: yopishtiriladigan stikerda shtrix kod BO'LISHI SHART.
 * Barkodi bor tovarda — o'zi, yo'q tovarda — do'konning maxsus kodi
 * shtrix kod bo'lib (`StoreCode`: `2 NNNNNN C`, EAN-8).
 *
 * Ilgari ikki teshik bor edi:
 *   · kod berilmasa (maxsus kod yo'q, kod band, tarmoq uzildi) stiker
 *     JIMGINA barkodsiz chiqardi — `catch` uni yutib, chop etishni davom
 *     ettirardi. Bunday stiker kassada skanerlanmaydi va buni faqat
 *     javonda bilish mumkin edi;
 *   · ko'rish oynasi barkodsiz tovarning stikerini barkodsiz chizardi va
 *     do'konchi «barkod chiqmaydi» deb o'ylardi.
 *
 * ⚠ KOD SERVERDAN OLINADI, mahalliy yasalmaydi: server uni
 * `product_barcodes` ga yozadi. Mahalliy kod hech qayerda saqlanmasdi va
 * kassada «topilmadi» chiqardi. Ko'rish oynasidagi kod — o'sha formulaning
 * nusxasi (`storeCodeOf`), faqat ko'rsatish uchun.
 */
import { storeCodeOf } from "./ek-store-code.js";

const specOf = (template) => {
  try {
    return typeof template?.spec === "string" ? JSON.parse(template.spec) : (template?.spec || {});
  } catch { return {}; }
};

/** Dizaynda ko'rinadigan barkod maydoni bormi. */
export function drawsBarcode(template) {
  return (specOf(template).fields || []).some((f) => f.key === "barcode" && f.visible !== false);
}

/**
 * Ko'rish oynasi uchun: barkodsiz tovarga chiqadigan do'kon kodi.
 *
 * ⚠ `barcodePending` belgisi — oyna «chop etishda beriladi» deb yozishi
 * uchun. Bu qiymat hech qachon serverga yuborilmaydi.
 */
export function withPreviewBarcode(product) {
  if (!product || product.barcode) return product;
  const code = storeCodeOf(product.searchCode);
  return code ? { ...product, barcode: code, barcodePending: true } : product;
}

/**
 * Chop etishdan OLDIN har barkodsiz tovarga serverdan kod.
 *
 * ⚠ BIRORTASIGA KOD BERILMASA — `failed` bo'sh emas va chaqiruvchi chop
 * etishni TO'XTATADI. Barkodsiz stiker chiqarishdan ko'ra, qaysi tovar va
 * nega ekanini aytish to'g'ri: sabab deyarli har doim tuzatiladigan narsa
 * (tovarda maxsus kod yo'q yoki u boshqa tovarda band).
 *
 * @param items    [{product, quantity, lineId}]
 * @param generate (productId) => Promise<{data: {barcode}}> — `productApi.generateCode`
 * @returns {Promise<{items, failed: Array<{product, message}>}>}
 */
export async function ensureBarcodes(items, template, generate) {
  if (!drawsBarcode(template)) return { items, failed: [] };
  const out = [];
  const failed = [];
  /* ⚠ BITTA TOVARGA BITTA SO'ROV: navbatda bir tovar bir necha qatorda
     bo'lishi mumkin (har xil sonda). */
  const issued = new Map();
  for (const it of items || []) {
    const p = it.product;
    if (p?.barcode || !p?.id) { out.push(it); continue; }
    if (!issued.has(p.id)) {
      try {
        const r = await generate(p.id);
        issued.set(p.id, { barcode: r?.data?.barcode || null });
      } catch (e) {
        issued.set(p.id, { barcode: null, message: e?.message || "" });
      }
    }
    const got = issued.get(p.id);
    if (got.barcode) out.push({ ...it, product: { ...p, barcode: got.barcode } });
    else {
      if (!failed.some((f) => f.product.id === p.id)) failed.push({ product: p, message: got.message });
      out.push(it);
    }
  }
  return { items: out, failed };
}
