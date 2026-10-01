/* ══════════════════════════════════════════════════════════════════════════
   SKANER NATIJASI — Katalog va Ombor oynasi uchun (2026-10-01)

   Egasining talabi: «mahsulotlar oynasida biror mahsulotni skaner qilganda
   uni topib bersin va bir oyna ochib bersin — shu mahsulot bilan nima qilish
   mumkin bo'lsa, shuni qilish imkoni bo'lsin». Omborda ham shunday, lekin
   faqat do'kondagi tovar. Katalogda esa tovar bu do'konda yo'q, boshqa
   do'konlarda bor bo'lsa — o'ziga ko'chirish taklif qilinadi.

   ⚠ Bu modul faqat QAROR qiladi (qaysi holat, qaysi maydon), chizmaydi —
   shuning uchun u brauzersiz sinovda tekshiriladi
   (`test/scan-result.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

/* Do'konning o'z tovari topilgan javoblar (`ScanResponse.source`). */
const OWN = new Set(["PRODUCT", "PACK", "WEIGHT"]);

/**
 * `/products/scan` javobi (+ Katalogda keng taklif) → oyna holati.
 *
 * @param code       skanerlangan kod
 * @param data       `productApi.scan` javobining `data` qismi
 * @param suggestion `catalogApi.suggest` natijasi — faqat Katalogda va faqat
 *                   «hech qayerda yo'q» bo'lganda so'raladi
 * @param allowCopy  Katalog — `true`; Ombor — `false`
 */
export function scanOutcome(code, data, suggestion = null, { allowCopy = false } = {}) {
  const source = data?.source;
  if (OWN.has(source) && data.product) {
    return {
      kind: "found",
      code,
      product: data.product,
      packLabel: source === "PACK" ? data.packLabel || null : null,
    };
  }
  if (source === "ARCHIVED" && data.archivedMatch) {
    return { kind: "archived", code, archived: data.archivedMatch };
  }
  if (source === "OTHER_BRANCH") {
    return { kind: "otherBranch", code, shopName: data.otherShopName || "" };
  }
  /* ⚠ Omborda ko'chirish YO'Q — egasining so'zi: «faqat birinchisi, ya'ni
     do'konda bor mahsulotlarni topsin». U yerda katalog taklifi ham «bu
     do'konda yo'q» bo'ladi. */
  const offered = source === "GLOBAL" ? data.suggestion : suggestion;
  if (allowCopy && offered?.name) {
    return { kind: "suggest", code, suggestion: offered, verified: offered.status === "VERIFIED" };
  }
  return { kind: "none", code };
}

/**
 * Ko'chirishda formaga tushadigan maydonlar — FAQAT tovarning tavsifi.
 *
 * ⚠ RO'YXAT ATAYLAB YOPIQ («oq ro'yxat»): narx, tannarx, bo'lim, SKU, PLU,
 * QQS — do'konning o'ziniki va egasining talabi bo'yicha ko'chmaydi. Server
 * javobida ular baribir yo'q (`GlobalProductDto`), lekin u yerga kelajakda
 * yangi maydon qo'shilsa ham, bu yerdan o'tib ketmasin.
 *
 * Rasm faqat umumiy bo'lsa (`imageId` keladi): boshqa do'konning o'z
 * suratini server umuman yubormaydi.
 */
export function copyFields(s, code) {
  const imageId = s?.imageId ?? null;
  return {
    barcode: code,
    name: s?.name || "",
    unit: s?.unit || "DONA",
    mxikCode: s?.mxikCode || "",
    packageCode: s?.packageCode || "",
    markingGroup: s?.markingGroup || "",
    imageId,
    imageUrl: imageId ? s.thumbUrl || s.imageUrl || null : null,
  };
}
