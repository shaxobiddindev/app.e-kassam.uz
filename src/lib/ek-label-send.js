/**
 * ══════════════════════════════════════════════════════════════════════════
 * YORLIQNI PRINTERGA YUBORISH — BITTA YO'L (2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ NEGA ALOHIDA FAYL. Yorliq uch joydan chiqadi: oddiy «Stiker chiqarish»
 * ekrani, kengaytirilgan navbat va sozlashdagi sinov stikeri. Ilgari har biri
 * o'z yo'lini yozgan edi va ular ajralib ketgan: sinov stikeri TSPL bilan
 * chiqib, haqiqiy chop etish A4 varaq ochardi. Endi uchalasi ham shu bitta
 * funksiyadan o'tadi — sinov to'g'ri chiqsa, haqiqiysi ham to'g'ri chiqadi.
 *
 * Bu yerda faqat YO'NALTIRISH: qaysi yo'l (`outputMode`), barkodlar
 * (`ensureBarcodes`), teskari rasm sozlamasi. Joylash `ek-label-print.js`
 * da, chizish `ek-label-render.js` da.
 */
import { productApi } from "../api";
import { t } from "./ek-i18n";
import { isDesktop } from "./ek-desktop";
import { getSettings } from "./ek-hw-settings";
import { printHtml } from "./ek-receipt-pdf";
import { printRawLabel } from "./ek-hardware";
import { buildPrintDoc, buildRollBytes, buildRollDoc, outputMode, pageOf } from "./ek-label-print";
import { rasterizeSvg } from "./ek-label-raster";
import { ensureBarcodes } from "./ek-label-codes";
import { calibrationCommand } from "./ek-label-bytes";

/** Shu kompyuterda qaysi yo'l bilan chiqadi: "bytes" | "driver" | "sheet". */
export function routeOf(media, printer) {
  const queue = (getSettings().labelPrinterName || "").trim();
  return outputMode(media, printer, { desktop: isDesktop(), queue });
}

/**
 * Barkodsiz tovarlarga serverdan kod. Birortasiga berilmasa — XATO.
 *
 * ⚠ STIKERDA BARKOD SHART (egasining talabi): kod berilmagan tovar bilan
 * chop etish to'xtaydi va qaysi tovar, nega ekani aytiladi.
 */
export async function withCodes(items, template) {
  const { items: out, failed } = await ensureBarcodes(items, template,
    (id) => productApi.generateCode(id));
  if (failed.length) {
    const list = failed.slice(0, 5)
      .map((f) => `${f.product.name}${f.message ? ` (${f.message})` : ""}`).join("; ");
    throw new Error(t("lbl.codeFailed", { n: failed.length, list }));
  }
  return out;
}

/**
 * Yorliqlarni chiqaradi. Barkodlar OLDINDAN berilgan bo'lishi kerak
 * (`withCodes`) — tasdiqlash oynasi aynan o'sha ro'yxatni belgilaydi.
 *
 * @returns {Promise<"bytes"|"driver"|"sheet">} qaysi yo'l bilan ketgani:
 *   "bytes" da yorliq printerga YETIB BORGANI aniq, qolganlarida esa
 *   brauzer oynasi buni bilmaydi (chaqiruvchi so'raydi).
 */
export async function sendLabels({ template, items, media, printer, title = "",
                                   ctx = {}, startPosition = 1 }) {
  const mode = routeOf(media, printer);
  if (mode === "bytes") {
    const invert = Boolean(getSettings().labelInvert);
    const bytes = await buildRollBytes(template, items, media, printer, {
      ctx, raster: (svg, w, h) => rasterizeSvg(svg, w, h, { invert }),
    });
    await printRawLabel(bytes);
    return mode;
  }
  const page = mode === "sheet" ? pageOf(media) : null;
  const doc = mode === "sheet"
    ? buildPrintDoc(template, items, { startPosition, ctx, page })
    : buildRollDoc(template, items, media, { ctx, printer });
  if (!doc) throw new Error(t("lbl.blockNoTemplate"));
  /* ⚠ HUJJAT NOMI = SAQLANGAN PDF NING NOMI (brauzer «PDF ga saqlash»). */
  await printHtml(doc.html, title, doc.css, "width=980,height=800",
    mode === "sheet" ? page : doc.page);
  return mode;
}

/**
 * Printerga «qog'ozni o'lcha» buyrug'i (TSPL `GAPDETECT`, ZPL `~JC`).
 * Printer bir-ikki bo'sh stiker o'tkazib, oraliqni eslab qoladi.
 * @returns {Promise<boolean>} buyruq yuborildimi (tili ma'lum bo'lmasa — yo'q)
 */
export async function calibrate(printer) {
  const cmd = calibrationCommand(printer?.lang);
  if (!cmd || !isDesktop()) return false;
  await printRawLabel(cmd);
  return true;
}
