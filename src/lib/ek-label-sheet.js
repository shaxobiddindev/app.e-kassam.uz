import { productCode } from "./ek-code.js";
/* ══════════════════════════════════════════════════════════════════════════
   JAVON YORLIG'I — A4 VARAQDA (V108)

   ═══ NIMA YETISHMAYOTGAN EDI ═══════════════════════════════════════════

   Yorliq loyihada bor edi, lekin FAQAT `.exe` da: `printPriceLabels`
   birinchi qatorida `isDesktop()` ni tekshiradi va aks holda xato
   beradi. Ya'ni brauzerdan yoki Android ilovadan ishlaydigan do'kon
   javoniga yorliq QO'YA OLMASDI.

   Bu esa V107 dagi qisqa raqamning butun ma'nosini yarim qoldirardi:
   raqam faqat EKRANDA turardi. Kassir uni javonga qarab ham eslab
   qolishi kerak — yorliq aynan shuning uchun bor.

   ═══ NEGA CHEK PRINTERI EMAS, QOG'OZ ═══════════════════════════════════

   Chek printeri tasmaga bitta-bitta chiqaradi va u faqat `.exe` da
   ishlaydi (baytlar Tauri orqali ketadi). A4 esa har joyda bor:
   brauzerda ham, telefonda ham, oddiy ofis printeri bilan ham.
   Yigirma to'rtta yorliq bitta varaqda chiqadi va qaychi bilan
   kesiladi.

   ⚠ HALOL CHEGARA: do'konning qanday STIKER varaqi borligini bilmaymiz.
   Shuning uchun yorliqlar tayyor stiker o'lchamiga «moslanmagan» deb
   ko'rsatilmaydi — ular oddiy qog'oz uchun va chetlarida KESISH
   CHIZIG'I bor. Aniq stiker varaqiga moslash — keyingi ish, va u
   do'kondan varaq nomini so'rashni talab qiladi.

   ═══ NEGA `buildLabelSheet` VA `printLabelSheet` ALOHIDA ════════════════

   `buildPriceLabels` (ESC/POS) bilan bir xil sabab: sinov va haqiqiy
   chiqarish BITTA kod bo'lishi kerak. Chop etish yo'lini sinovdan
   o'tkazib bo'lmaydi (u brauzer oynasini ochadi), HTML ni esa mumkin.
   ══════════════════════════════════════════════════════════════════════════ */
import { money } from "./ek-format.js";
import { eanSvg } from "./ek-barcode-ean.js";
import { code128Svg } from "./ek-barcode.js";

/**
 * Yorliq o'lchamlari.
 *
 * ⚠ RAQAMLAR MILLIMETRDA va A4 dan HISOBLANGAN: 210 mm kenglikdan
 * 8 mm chekka ikki tomondan olinsa, 194 mm qoladi. Uchga bo'linsa
 * 64 mm, to'rtga bo'linsa 48 mm. Ya'ni ustunlar varaqqa aynan
 * sig'adi va oxirgi ustun keyingi varaqqa tushib ketmaydi.
 */
export const LABEL_SIZES = {
  /* Katta — nomi uzun tovarlar va uzoqdan o'qish uchun. */
  big:   { cols: 3, rows: 8,  w: 64, h: 34, name: 7.5, price: 15, code: 11, bar: 11 },
  /* Kichik — ko'p tovarni bir varaqda chiqarish uchun. */
  small: { cols: 4, rows: 10, w: 48, h: 27, name: 6.5, price: 12, code: 9,  bar: 8 },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Bitta yorliqning ichi.
 *
 * ⚠ TARTIB — UZOQLIKDAN O'QILISH BO'YICHA. Mijoz javonga bir metr
 * naridan qaraydi va unga NARX kerak; kassirga esa RAQAM kerak va u
 * yaqindan qaraydi. Shuning uchun narx eng katta, raqam undan
 * kichikroq, nom esa eng mayda — nomni tovarning o'zidan ham o'qish
 * mumkin.
 */
function labelHtml(item, size, shopName) {
  /* ⚠ TARTIB: EAN → Code 128 (ESC/POS yorlig'idagi bilan bir xil).
     EAN qisqa va chiroyli, lekin do'konning barkodi har doim ham EAN
     emas: bozordan olingan tovarga do'kon o'zi ixtiyoriy kod yozib
     qo'ygan bo'lishi mumkin. Code 128 har qanday matnni ko'taradi va
     u loyihada ALLAQACHON bor (`ek-barcode.js`, chek raqami uchun) —
     ya'ni ikkinchi kutubxona ham, ikkinchi haqiqat manbasi ham
     kerak emas.

     ⚠ Nazorat raqami buzuq EAN Code 128 ga TUSHMAYDI: `eanSvg` null
     qaytarsa, kod EAN ko'rinishida bo'lsa ham (13 xona) uni Code 128
     bilan chizish MUMKIN, chunki Code 128 da nazorat raqami boshqa
     qoidada. Ya'ni skaner o'sha 13 raqamni o'qiydi va kassada tovar
     TOPILADI — bazadagi kod ham aynan shu. */
  const svg = item.barcode
    ? (eanSvg(item.barcode, { height: 30 }) || code128Svg(item.barcode, { height: 10 }) || null)
    : null;

  /* ⚠ BARKOD CHIZILMASA — O'RNI BO'SH QOLADI, «xato» yozilmaydi.
     Sabab: yorliq JAVONGA ketadi va uni mijoz ham ko'radi. «Barkod
     yaroqsiz» degan yozuv mijozga hech nima anglatmaydi, do'konning
     o'ziga esa bu ma'lumot tovar kartochkasida allaqachon bor
     (shtrix-kod ogohlantirishi, V137). */
  return `<div class="lb">`
    + (shopName ? `<div class="lb-shop">${esc(shopName)}</div>` : "")
    + `<div class="lb-name">${esc(item.name || "—")}</div>`
    + `<div class="lb-row">`
    +   (productCode(item) != null
          ? `<span class="lb-code">№${esc(productCode(item))}</span>` : `<span></span>`)
    +   `<span class="lb-price">${esc(money(item.salePrice, { withUnit: true }))}</span>`
    + `</div>`
    + `<div class="lb-bar">${svg || ""}</div>`
    + `</div>`;
}

/**
 * Yorliq varag'ining HTML tanasi — chop etishdan ALOHIDA (sinov uchun).
 *
 * @param {Array} items   `{name, salePrice, barcode, searchCode}`
 * @param {object} opts   `size` ("big"|"small"), `copies`, `shopName`
 */
export function buildLabelSheet(items = [], { size = "big", copies = 1, shopName = "" } = {}) {
  const s = LABEL_SIZES[size] || LABEL_SIZES.big;
  const list = (items || []).filter(Boolean);
  if (!list.length) throw new Error("Yorliq uchun tovar tanlanmadi");

  /* ⚠ Nusxa soni CHEGARALANGAN (1…50): «0» yozilsa bo'sh varaq
     chiqardi, «1000» esa printerga yuz varaq yuborardi va uni
     to'xtatib bo'lmasdi. */
  const n = Math.max(1, Math.min(50, Number(copies) || 1));

  let cells = "";
  for (const item of list) for (let i = 0; i < n; i++) cells += labelHtml(item, s, shopName);

  return `<div class="lb-sheet">${cells}</div>`;
}

/**
 * Varaq uslubi.
 *
 * ⚠ `@page` MAJBURIY: usiz brauzer o'z chekkasini qo'yadi va
 * millimetrda hisoblangan ustunlar sig'may qoladi — oxirgi ustun
 * keyingi varaqqa tushib ketardi.
 */
export function labelSheetCss(size = "big") {
  const s = LABEL_SIZES[size] || LABEL_SIZES.big;
  return `
@page { size: A4; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "Segoe UI", Roboto, sans-serif; color: #000; }
.lb-sheet { display: grid; grid-template-columns: repeat(${s.cols}, ${s.w}mm); }
.lb {
  width: ${s.w}mm; height: ${s.h}mm; padding: 1.5mm 2mm;
  display: flex; flex-direction: column; overflow: hidden;
  /* ⚠ KESISH CHIZIG'I — qaychi uchun. Ochiq kulrang: qora chiziq
     yorliqni "ramkali" qilib, narxdan e'tiborni tortardi. */
  border-right: 0.2mm dashed #bbb; border-bottom: 0.2mm dashed #bbb;
  /* Har varaqning oxirgi qatori bo'linib ketmasin. */
  break-inside: avoid; page-break-inside: avoid;
}
.lb-shop  { font-size: ${(s.name - 1.5).toFixed(1)}pt; color: #666;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* ⚠ Nom IKKI QATORGACHA: uzun nomni bir qatorga kesish yorliqni
   foydasiz qiladi — «Sut 2,5% 1l» ning «Sut 2,5%» qismi yonidagi
   boshqa qadoqdan farq qilmaydi (ESC/POS yorlig'ida ham shu qoida). */
.lb-name  { font-size: ${s.name}pt; font-weight: 700; line-height: 1.15;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            overflow: hidden; }
.lb-row   { display: flex; align-items: baseline; justify-content: space-between;
            gap: 1mm; margin-top: auto; }
.lb-code  { font-size: ${s.code}pt; font-weight: 800; font-variant-numeric: tabular-nums; }
.lb-price { font-size: ${s.price}pt; font-weight: 800; white-space: nowrap;
            font-variant-numeric: tabular-nums; }
.lb-bar   { height: ${s.bar}mm; margin-top: 0.8mm; }
.lb-bar svg { height: 100%; width: 100%; display: block; }
`;
}

/* ⚠ CHOP ETISH BU YERDA EMAS — ATAYLAB.
   `printHtml` brauzerga xos modullarga tayanadi (`ek-desktop`) va
   ularni `node` bevosita yechа olmaydi. Loyihadagi qoida shu: sinovdan
   o'tadigan mantiq YAPROQ modulda turadi, chop etish esa chaqiruvchida
   — `QrPoster` va `StatementModal` ham aynan shunday qilgan.

   Ya'ni chaqiruvchi shunday yozadi:
       printHtml(buildLabelSheet(items, o), "Javon yorliqlari",
                 labelSheetCss(o.size), "width=900,height=760");
*/
