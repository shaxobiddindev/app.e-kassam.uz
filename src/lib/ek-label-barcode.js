/**
 * ══════════════════════════════════════════════════════════════════════════
 * BARKOD FIZIKASI — mm, dpi va PRINTER NUQTASI (F2)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ BU FAYL CHEK BARKODIDAN ALOHIDA. `ek-barcode.js` va
 * `ek-barcode-ean.js` chek uchun yozilgan: u yerda o'lcham SVG
 * birligida va modul kengligi qo'lda beriladi. Yorliqda esa o'lcham
 * FIZIK — millimetrda, va modul kengligi PRINTER NUQTASIGA butun son
 * bo'lib tushishi SHART.
 *
 * <p>Modul kengligini ular bilan birlashtirish vasvasasi bor edi,
 * lekin chek printeri bitta (203 dpi, doim bir xil), yorliq esa
 * ikki xil printerga chiqadi. Bitta funksiyaga ikkala mantiqni
 * yuklash — ikkalasini ham chalkashtirish.
 *
 * ═══ NEGA BUTUN NUQTA ═══
 *
 * 203 dpi da bitta nuqta 25,4/203 = 0,1251 mm. Modul 0,3 mm qilib
 * berilsa, u 2,4 nuqtaga to'g'ri keladi — printer esa yarim nuqta
 * chiza olmaydi va HAR BIR chiziqni turlicha yaxlitlaydi. Natijada
 * chiziqlar kengligi «gohida 2, gohida 3 nuqta» bo'lib chiqadi.
 *
 * ⚠ VA BU KO'RINMAYDI. Yorliq ko'zga butunlay normal ko'rinadi;
 * faqat skaner o'qimaydi. Buni javonda, mijoz oldida bilib olasiz.
 *
 * Shuning uchun modul NUQTADA beriladi (2 yoki 3), mm esa undan
 * hisoblanadi.
 */
import { eanModules, eanValid } from "./ek-barcode-ean.js";
import { code128 } from "./ek-barcode.js";
import { barcodeVerdict } from "./ek-barcode-check.js";

/** Bitta printer nuqtasining kengligi (mm). */
export const dotMm = (dpi) => 25.4 / Number(dpi || 203);

/**
 * ══════════════════════════════════════════════════════════════════
 * EAN NING MINIMAL BALANDLIGI — YORLIQ TURIGA QARAB
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠ ILGARI BITTA SON EDI (18 mm) VA U NOTO'G'RI EDI. O'lchov
 * ko'rsatdi: 15 ta tizim shablonining 14 tasi bu chegaradan
 * o'tolmasdi va har bir tovarda ogohlantirish chiqarardi. Har doim
 * yonadigan ogohlantirishni odamlar e'tiborsiz qoldirishni
 * o'rganadi — ya'ni u yo'q ogohlantirishdan ham yomon.
 *
 * ⚠ SABAB SHABLONLARDA EMAS EDI. 70×37 javon yorlig'iga nom (8 mm)
 * + narx (14 mm) + 18 mm barkod + chekkalar ≈ 44 mm kerak. Bu
 * jismonan sig'maydi va sig'maydigan qilib loyihalangani ham
 * bejiz emas: javon yorlig'i shunday bo'ladi.
 *
 * ⚠ FARQ — QANDAY O'QILISHIDA. Javon yorlig'i va stiker QO'LDAGI
 * skaner bilan 5–10 sm dan o'qiladi: EAN standarti ruxsat bergan
 * «kesilgan» (truncated) balandlik bu masofada ishlaydi va
 * chakana savdoda hamma joyda shunday. Ombor kartoni esa uzoqdan,
 * burchak ostida o'qiladi — u yerda balandlik zaxirasi kerak.
 *
 * ⚠ 12 mm — TANLANGAN QIYMAT, standartdan olingan emas. EAN-13
 * ning to'liq balandligi 22,85 mm; 12 mm — chakana amaliyotdagi
 * odatiy kesilgan balandlik. HAR BIR DO'KON O'Z SKANERI bilan
 * tekshirishi kerak: kalibrlash varag'i (F7) aynan shuning uchun
 * bor.
 *
 * ⚠ NOMA'LUM TUR 18 MM OLADI. Yangi yorliq turi qo'shilsa, u
 * ataylab EHTIYOTKOR tomonga tushadi: kimdir uni ongli ravishda
 * shu jadvalga yozmaguncha to'liq balandlik talab qilinadi.
 */
export const EAN_MIN_MM = {
  SHELF: 12,
  STICKER: 12,
};

/** ⚠ Noma'lum yoki ko'rsatilmagan tur — to'liq balandlik. */
export const EAN_MIN_MM_DEFAULT = 18;

/** Code 128 da qat'iy standart yo'q; 8 mm dan pastda skaner ishonchsiz. */
export const CODE128_MIN_MM = 8;

export const eanMinMm = (labelKind) =>
  EAN_MIN_MM[String(labelKind || "").toUpperCase()] ?? EAN_MIN_MM_DEFAULT;

/**
 * Qaysi turda chiziladi.
 *
 * ⚠ QOIDA O'ZGARMAYDI (§10s): nazorat raqami to'g'ri bo'lsa EAN,
 * aks holda Code 128. Nazorat raqami NOTO'G'RI EAN hech qachon
 * jimgina chizilmaydi — chunki u skanerda BOSHQA tovarga aylanadi.
 *
 * @returns {"EAN13"|"EAN8"|"CODE128"|null}
 */
export function barcodeKind(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (eanValid(s)) return s.length === 8 ? "EAN8" : "EAN13";
  /* Ichki (tarozi) kodi ham EAN qoidasiga bo'ysunadi; nazorat raqami
     buzuq bo'lsa u EAN bo'lib chiqmaydi. */
  if (/^\d+$/.test(s) && barcodeVerdict(s) === "CHECK_DIGIT") return "CODE128";
  return "CODE128";
}

/** Turga qarab modul satri (`"1010…"`) yoki `null`. */
function modulesOf(value, kind) {
  if (kind === "EAN13" || kind === "EAN8") return eanModules(value);
  const bars = code128(value);
  if (!bars) return null;
  let out = "";
  for (const b of bars) out += (b.bar ? "1" : "0").repeat(b.width);
  return out;
}

/**
 * Barkodning FIZIK o'lchovlari.
 *
 * @returns {{kind, modules, moduleMm, widthMm, minHeightMm, ok, reason}|null}
 */
export function barcodeMetrics(value, {
  dpi = 203, moduleDots = 2, quietLeftModules = 9, quietRightModules = 7,
  heightMm = 10, labelKind = null,
} = {}) {
  const kind = barcodeKind(value);
  if (!kind) return null;
  const modules = modulesOf(value, kind);
  if (!modules) return null;

  const moduleMm = moduleDots * dotMm(dpi);
  const total = modules.length + quietLeftModules + quietRightModules;
  const widthMm = total * moduleMm;

  const minHeightMm = kind === "CODE128" ? CODE128_MIN_MM : eanMinMm(labelKind);

  return {
    kind, modules, moduleMm, widthMm, minHeightMm,
    quietLeftMm: quietLeftModules * moduleMm,
    ok: heightMm + 0.001 >= minHeightMm,
    reason: heightMm + 0.001 >= minHeightMm ? null : "SHORT",
  };
}

/**
 * Barkod SVG — o'lchamlari MILLIMETRDA.
 *
 * ⚠ RASTR (PNG) EMAS va tashqi kutubxona EMAS: yorliq oflayn
 * chiqishi shart, PNG esa miqyoslanganda chetlari yoyilib skaner
 * o'qimay qoladi.
 *
 * ⚠ Yaroqsiz kodda `null` qaytadi — CHIZILMAYDI. Chaqiruvchi buni
 * ogohlantirishga aylantiradi (F3); jimgina bo'sh joy qoldirish
 * eng yomon yo'l bo'lardi.
 */
export function barcodeSvgMm(value, opts = {}) {
  const m = barcodeMetrics(value, opts);
  if (!m) return null;

  const { heightMm = 10, showText = true, x = 0, y = 0 } = opts;
  const barsH = showText ? Math.max(heightMm - 2.6, 1) : heightMm;
  let cursor = m.quietLeftMm;
  let out = "";

  for (let i = 0; i < m.modules.length; ) {
    if (m.modules[i] === "1") {
      let j = i;
      while (j < m.modules.length && m.modules[j] === "1") j++;
      const w = (j - i) * m.moduleMm;
      out += `<rect x="${r(x + cursor)}" y="${r(y)}" width="${r(w)}"`
           + ` height="${r(barsH)}" fill="#000"/>`;
      cursor += w;
      i = j;
    } else {
      cursor += m.moduleMm;
      i++;
    }
  }

  if (showText) {
    const cx = x + m.widthMm / 2;
    out += `<text x="${r(cx)}" y="${r(y + heightMm - 0.4)}" text-anchor="middle"`
         + ` font-family="monospace" font-size="${r(Math.min(2.6, heightMm * 0.3))}"`
         + ` fill="#000">${esc(String(value))}</text>`;
  }
  return out;
}

/** ⚠ Uch xona — bayt darajasidagi taqqoslash uchun barqaror. */
const r = (n) => (Math.round(n * 1000) / 1000).toString();
const esc = (s) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
