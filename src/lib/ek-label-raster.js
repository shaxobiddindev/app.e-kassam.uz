/**
 * ══════════════════════════════════════════════════════════════════════════
 * SVG → PRINTER NUQTALARI (2026-10-03)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ALOHIDA MODUL, chunki bu yerda DOM bor (Image, canvas). Joylashtirish
 * (`ek-label-print.js`) va bayt yasash (`ek-label-bytes.js`) Node'da
 * sinaladi — ular bu faylni import qilmaydi, rasterlovchi ularga
 * PARAMETR bo'lib beriladi.
 *
 * ⚠ CANVAS OLDINDAN OQ BILAN TO'LDIRILADI. SVG fonida oq to'rtburchak
 * bor, lekin rasm yuklanmay qolsa yoki bir qismi shaffof bo'lsa,
 * shaffof piksel qora deb o'qilmasin — butun rulon qora bo'yalardi.
 */
import { packMono } from "./ek-label-bytes.js";

/**
 * @param svg     to'liq `<svg>` satri, viewBox mm da
 * @param widthDots, heightDots  printer nuqtasida
 * @returns {Promise<{widthDots, heightDots, data: Uint8Array}>}
 */
export async function rasterizeSvg(svg, widthDots, heightDots, { invert = false } = {}) {
  /* ⚠ O'LCHAM NUQTADA QAYTA YOZILADI: renderer `width="58mm"` beradi,
     brauzer esa uni 96 dpi deb 219 px qiladi. Printer 203 dpi da —
     58 mm = 464 nuqta. viewBox mm da qoladi, ya'ni chizma o'zgarmaydi,
     faqat piksel zichligi printernikiga tenglashadi. */
  const sized = svg
    .replace(/^<svg([^>]*?)\swidth="[^"]*"/, `<svg$1 width="${widthDots}"`)
    .replace(/^<svg([^>]*?)\sheight="[^"]*"/, `<svg$1 height="${heightDots}"`);

  const img = new Image();
  img.decoding = "sync";
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Yorliq rasmini chizib bo'lmadi"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = widthDots;
  canvas.height = heightDots;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, widthDots, heightDots);
  ctx.drawImage(img, 0, 0, widthDots, heightDots);
  const { data } = ctx.getImageData(0, 0, widthDots, heightDots);
  return packMono(data, widthDots, heightDots, { invert });
}
