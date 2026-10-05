/**
 * ══════════════════════════════════════════════════════════════════════════
 * BAYT YO'LI — PRINTER TILIGA O'GIRISH (G3)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ JOYLASHUV BU YERDA HISOBLANMAYDI. `layoutLabel` millimetrdagi
 * elementlar ro'yxatini beradi, bu fayl esa uni printer tiliga
 * o'giradi — xolos. HTML yo'li ham AYNAN o'sha ro'yxatdan chiqadi.
 *
 * Ikkita alohida joylashuv yozilsa, ular ALBATTA ayri tushadi:
 * bugun bir xil, olti oydan keyin biri 2 mm chapda. Va buni faqat
 * ikkala yo'ldan ham chiqarib ko'rgan odam biladi — ya'ni hech kim.
 *
 * ⚠ YANGI KANAL QURILMAYDI. Baytlar `ek-hardware.js` dagi mavjud
 * `print_raw` / `print_tcp` orqali ketadi — chek printeri uchun
 * ishlab turgan o'sha yo'l. Yorliq printeri ham xuddi shu yo'ldan
 * boradi.
 *
 * ⚠ FAQAT BILGANIMIZNI YOZAMIZ. TSPL va ZPL — hujjatlashtirilgan,
 * keng tarqalgan tillar. EPL, EZPL (Godex) va ESC/POS uchun bu
 * yerda kod YO'Q va taxmin ham qilinmaydi: noto'g'ri buyruq
 * yuborilsa printer uni MATN sifatida bosib chiqaradi va rulon
 * to'la tushunarsiz belgi bo'ladi. Ular drayver yo'liga tushadi.
 */

/** mm → printer nuqtasi. TSPL va ZPL da koordinata NUQTADA beriladi. */
export const mmToDots = (mm, dpi) => Math.round(Number(mm) * Number(dpi) / 25.4);

/** Bayt yo'li qo'llab-quvvatlaydigan tillar. */
export const BYTE_LANGS = ["TSPL", "ZPL"];

/**
 * Shu til bayt yo'lidan chiqadimi.
 *
 * ⚠ «Yo'q» degan javob XATO EMAS: drayver yo'li ham to'liq ishlaydi.
 * Chaqiruvchi shunchaki boshqa yo'lni tanlaydi.
 */
export const supportsBytes = (lang) => BYTE_LANGS.includes(String(lang || "").toUpperCase());

/* ── Matn qochirish ──────────────────────────────────────────────────── */
const q = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * TSPL ichki shriftini tanlaydi.
 *
 * ⚠ BAYT YO'LIDA SHRIFT O'LCHAMI DISKRET. TSPL ning ichki
 * shriftlari qat'iy balandlikda (203 dpi da taxminan 12/16/24/32
 * nuqta) va oraliq qiymat yo'q: 11 pt so'ralsa printer eng yaqinini
 * oladi. Bu printerning xossasi, bizning kamchiligimiz emas —
 * lekin YOZIB QO'YILISHI kerak, aks holda «ekranda boshqacha
 * ko'rindi» degan savol javobsiz qoladi.
 */
function tsplFont(sizePt, dpi) {
  const dots = Number(sizePt) * dpi / 72;
  const table = [["1", 12], ["2", 20], ["3", 24], ["4", 32], ["5", 48]];
  let best = table[0];
  for (const row of table) {
    if (Math.abs(row[1] - dots) < Math.abs(best[1] - dots)) best = row;
  }
  const mul = Math.max(1, Math.min(8, Math.round(dots / best[1])));
  return { font: best[0], mul };
}

/**
 * Barkod CHIZIQLARINING balandligi.
 *
 * ⚠ RAQAMLAR MAYDON ICHIDA. SVG yo'lida (`barcodeSvgMm`) chiziqlar
 * `h − 2,6 mm`, raqamlar esa qolgan joyda — ya'ni hammasi maydonga
 * sig'adi. TSPL `BARCODE` va ZPL `^BE`/`^BC` esa balandlikni FAQAT
 * chiziqlarga beradi va raqamlarni ularning OSTIGA qo'shadi. Butun `h`
 * yuborilganda raqamlar maydondan 2,6 mm pastga tushib, «Standart
 * 40×30» da narx ustiga chiqardi (2026-10-03, rulon yo'li ulanganda
 * topildi — ungacha bu kod faqat sinov yorlig'ida ishlardi).
 */
/* ⚠ 3,4 MM, 2,6 EMAS (2026-10-05). Egasi: «ba'zi yozuvlar tagidan kesilgan
   holatda chiqyapti». 2,6 mm SVG dagi raqamlar o'lchami edi, printer esa
   raqamlarni O'Z shrifti bilan chizadi: Xprinter/TSC da EAN raqamlari
   ~22 nuqta + chiziqdan ~4 nuqta oraliq ≈ 3,2 mm (203 dpi). Barkod pastki
   qatorda turgan dizaynlarda (30×20 da chekka atigi 0,8 mm) raqamlarning
   pastki qismi yorliq chetidan chiqib, kesilardi. Chiziqlar 0,8 mm qisqaradi —
   10 mm li kichik stikerda ham 6,6 mm qoladi, qo'l skaneriga yetadi. */
const PRINTER_DIGITS_MM = 3.4;
const barsHeightMm = (it) => {
  /* Burilgan barkodda chiziqlar balandligi — qutining ENI (`ek-label-render`). */
  const h = it.rot ? Number(it.w) : Number(it.h);
  return it.showText ? Math.max(h - PRINTER_DIGITS_MM, 1) : h;
};

/** EAN-13 / EAN-8 / Code 128 → TSPL barkod turi. */
const tsplBarcodeType = (kind) =>
  kind === "EAN13" ? "EAN13" : kind === "EAN8" ? "EAN8" : "128";

/**
 * TSPL — Xprinter, TSC, Rongta.
 *
 * @param layout `layoutLabel` natijasi
 * @param opts   {dpi, media, printer, copies}
 */
export function toTSPL(layout, { dpi = 203, media = {}, printer = {}, copies = 1 } = {}) {
  const D = (mm) => mmToDots(mm, dpi);
  const out = tsplHead(layout.widthMm, layout.heightMm, { dpi, media, printer });

  for (const it of layout.items) {
    if (it.kind === "border") {
      out.push(`BOX ${D(it.x)},${D(it.y)},${D(it.x + it.w)},${D(it.y + it.h)},`
        + `${Math.max(1, D(it.strokeWidthMm))}`);
      continue;
    }
    if (it.kind === "text") {
      const { font, mul } = tsplFont(it.sizePt, dpi);
      /* ⚠ TSPL da tekislash yo'q: matn boshlanish nuqtasidan
         chapdan o'ngga yoziladi. O'ngga tekislash uchun boshlanish
         nuqtasi o'zi suriladi — HTML yo'lidagi `text-anchor` ning
         bayt yo'lidagi muqobili. */
      const x = it.align === "center" ? D(it.x + it.w / 2)
              : it.align === "right" ? D(it.x + it.w)
              : D(it.x);
      const align = it.align === "center" ? 2 : it.align === "right" ? 3 : 1;
      if (it.rot) {
        /* 270°: tayanch nuqta qutining PASTKI chap burchagi, matn yuqoriga yoziladi. */
        out.push(`TEXT ${D(it.x)},${D(it.y + it.h)},"${font}",270,${mul},${mul},1,"${q(it.text)}"`);
        continue;
      }
      out.push(`TEXT ${x},${D(it.y)},"${font}",0,${mul},${mul},${align},"${q(it.text)}"`);
      continue;
    }
    if (it.kind === "barcode") {
      const line = tsplBarcode(it, D);
      if (line) out.push(line);
      continue;
    }
    /* ⚠ QR va teshik bayt yo'lida CHIZILMAYDI: QR uchun
       ma'lumot manbayi (URL) hali yo'q, teshik esa qog'ozga
       tegishli, printerga emas. Ular jimgina tashlab ketilmaydi —
       chaqiruvchi ogohlantirishni ko'radi. */
  }

  out.push(`PRINT ${Math.max(1, Number(copies) || 1)},1`);
  return out.join("\r\n") + "\r\n";
}

/** Barkod qatori yoki `null` (qiymat yo'q / chizib bo'lmaydi). */
function tsplBarcode(it, D) {
  if (!it.value || !it.metrics) return null;
  const type = tsplBarcodeType(it.metrics.kind);
  const narrow = Number(it.cfg?.moduleDots ?? 2);
  if (it.rot) {
    /* ⚠ 270°: TSPL tayanch nuqta atrofida buradi — barkod undan YUQORIGA
       va O'NGGA ketadi. Shuning uchun nuqta qutining pastki chap burchagi
       (markazlash `shift` ga ko'tarilgan): raqamlar chiziqlarning o'ngida,
       egasining tarozi stikeridagidek. */
    return `BARCODE ${D(it.x)},${D(it.y + it.h - (it.shift || 0))},"${type}",${D(barsHeightMm(it))},`
      + `${it.showText ? 1 : 0},270,${narrow},${narrow * 2},"${q(it.value)}"`;
  }
  return `BARCODE ${D(it.x)},${D(it.y)},"${type}",${D(barsHeightMm(it))},`
    + `${it.showText ? 1 : 0},0,${narrow},${narrow * 2},"${q(it.value)}"`;
}

/**
 * TSPL — MATN RASM BO'LIB, BARKOD PRINTER BUYRUG'I BILAN (2026-10-03).
 *
 * ⚠ NEGA RASM. TSPL ning ichki shriftlari faqat ASCII ni biladi:
 * «Сахар 1кг» yoki «Oʻrik» printerda `????` yoki tushunarsiz belgi
 * bo'lib chiqardi — O'zbekistondagi do'konlarda tovar nomlarining
 * ko'pi aynan shunday. Ustiga-ustak shrift o'lchami diskret (yuqoridagi
 * `tsplFont`) va «katta so'm, kichik tiyin» narx uslubi umuman yo'q edi:
 * qog'ozdagi yorliq ko'rish oynasidagidan boshqacha chiqardi.
 *
 * Rasm AYNAN ko'rish oynasini chizgan renderer'dan olinadi, shuning
 * uchun qog'oz ekrandagidek bo'ladi.
 *
 * ⚠ BARKOD RASMGA KIRMAYDI — sababi `renderLabel` dagi `ctx.omit`
 * izohida: rasterlangan chiziqlar nuqta to'riga tushmaydi.
 *
 * ⚠ TSPL `BITMAP` da 1 — OQ, 0 — QORA (ZPL `^GF` ning teskarisi).
 * `packMono` shuni hisobga oladi. ⚠ Haqiqiy qog'ozda hali sinalmagan:
 * yorliq teskari (qora fonda) chiqsa, xato aynan shu bayroqda.
 *
 * @param p.widthMm, p.heightMm  qog'oz katagi (rulon qatori)
 * @param p.bitmap  {widthDots, heightDots, data} — `packMono` natijasi
 * @param p.barcodes `layoutLabel` barkod elementlari, mm da, siljitilgan
 * @returns {Uint8Array}
 */
export function toTSPLRaster({ widthMm, heightMm, bitmap, barcodes = [],
                               dpi = 203, media = {}, printer = {}, copies = 1 }) {
  const D = (mm) => mmToDots(mm, dpi);
  const head = tsplHead(widthMm, heightMm, { dpi, media, printer });
  const enc = new TextEncoder();
  const parts = [enc.encode(head.join("\r\n") + "\r\n")];

  if (bitmap && bitmap.data?.length) {
    const wb = Math.ceil(bitmap.widthDots / 8);
    parts.push(enc.encode(`BITMAP 0,0,${wb},${bitmap.heightDots},0,`));
    parts.push(bitmap.data);
    parts.push(enc.encode("\r\n"));
  }

  const tail = [];
  for (const it of barcodes) {
    const line = tsplBarcode(it, D);
    if (line) tail.push(line);
  }
  tail.push(`PRINT ${Math.max(1, Number(copies) || 1)},1`);
  parts.push(enc.encode(tail.join("\r\n") + "\r\n"));
  return concatBytes(parts);
}

/**
 * RGBA piksellarni TSPL `BITMAP` qatorlariga o'giradi.
 *
 * ⚠ CHEGARA 128 VA ALFA HISOBGA OLINADI: shaffof piksel oq qog'oz
 * deb sanaladi. Canvas oldindan oq bilan to'ldiriladi, lekin chegara
 * bu yerda ham himoyalangan — aks holda shaffof joy qora bo'lib,
 * butun yorliq qora to'rtburchak bo'lib chiqardi.
 *
 * @returns {{widthDots, heightDots, data: Uint8Array}}
 */
export function packMono(rgba, widthDots, heightDots, { invert = false } = {}) {
  const wb = Math.ceil(widthDots / 8);
  /* ⚠ 0xFF bilan to'ldiriladi: TSPL da 1 — oq. Qator oxiridagi
     ortiqcha bitlar ham oq bo'lishi shart, aks holda o'ng chekkada
     ingichka qora chiziq chiqadi. */
  /* ⚠ TESKARI REJIMDA FON HAM TESKARI (0x00): printer 1 ni qora deb
     o'qisa, 0xFF fon butun stikerni qora qilardi. */
  const data = new Uint8Array(wb * heightDots).fill(invert ? 0x00 : 0xff);
  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < widthDots; x++) {
      const i = (y * widthDots + x) * 4;
      const a = rgba[i + 3] / 255;
      const lum = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      const seen = lum * a + 255 * (1 - a);
      if (seen >= 128) continue;
      if (invert) data[y * wb + (x >> 3)] |= 0x80 >> (x & 7);
      else data[y * wb + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  return { widthDots, heightDots, data };
}

function concatBytes(parts) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** SIZE, datchik, zichlik, siljish — `toTSPL` va `toTSPLRaster` uchun bitta. */
function tsplHead(widthMm, heightMm, { dpi = 203, media = {}, printer = {} } = {}) {
  const D = (mm) => mmToDots(mm, dpi);
  const out = [];

  out.push(`SIZE ${num(widthMm)} mm,${num(heightMm)} mm`);

  /* ⚠ SENSOR TURI BUYRUQNI O'ZGARTIRADI:
       ORALIQ      → GAP (yorliqlar orasidagi bo'shliq),
       QORA_BELGI  → BLINE (orqadagi qora chiziq),
       UZLUKSIZ    → GAP 0,0 va balandlik SIZE da aytilgan bo'lishi
                     shart — printer uni o'zi bila olmaydi. */
  const sensor = String(media.sensor || "ORALIQ").toUpperCase();
  if (sensor === "QORA_BELGI") out.push(`BLINE ${num(media.gapYMm ?? 3)} mm,0 mm`);
  else if (sensor === "UZLUKSIZ") out.push("GAP 0 mm,0 mm");
  else out.push(`GAP ${num(media.gapYMm ?? 2)} mm,0 mm`);

  out.push("DIRECTION 1");
  if (printer.density != null) out.push(`DENSITY ${clampInt(printer.density, 1, 15)}`);
  if (printer.speed != null) out.push(`SPEED ${clampInt(printer.speed, 1, 12)}`);

  /* Siljish tuzatishi: «yozuv 2 mm pastga surilgan». */
  const ox = D(printer.offsetXMm || 0), oy = D(printer.offsetYMm || 0);
  out.push(`REFERENCE ${ox},${oy}`);
  out.push("CLS");
  return out;
}

/**
 * ZPL — Zebra.
 *
 * ⚠ `^A0` MASSHTABLANADIGAN shrift: TSPL dan farqli o'laroq
 * balandlik aniq nuqtada beriladi, ya'ni pt o'lchami deyarli aniq
 * tushadi.
 */
export function toZPL(layout, { dpi = 203, media = {}, printer = {}, copies = 1 } = {}) {
  const D = (mm) => mmToDots(mm, dpi);
  const out = ["^XA"];

  out.push(`^PW${D(layout.widthMm)}`);
  out.push(`^LL${D(layout.heightMm)}`);
  out.push(`^LH${D(printer.offsetXMm || 0)},${D(printer.offsetYMm || 0)}`);
  if (printer.density != null) out.push(`^MD${clampInt(printer.density, 0, 30)}`);

  /* ⚠ UZLUKSIZ mediada balandlik MAJBURIY va u `^LL` da aytiladi;
     oraliqli mediada printer o'zi topadi (`^MNY`). */
  const sensor = String(media.sensor || "ORALIQ").toUpperCase();
  out.push(sensor === "UZLUKSIZ" ? "^MNN" : sensor === "QORA_BELGI" ? "^MNM" : "^MNY");

  for (const it of layout.items) {
    if (it.kind === "border") {
      out.push(`^FO${D(it.x)},${D(it.y)}^GB${D(it.w)},${D(it.h)},`
        + `${Math.max(1, D(it.strokeWidthMm))}^FS`);
      continue;
    }
    if (it.kind === "text") {
      const h = Math.max(6, Math.round(Number(it.sizePt) * dpi / 72));
      const just = it.align === "center" ? "C" : it.align === "right" ? "R" : "L";
      if (it.rot) {
        /* `B` — pastdan yuqoriga; maydon bloki eni burilgan yo'nalishda (qutining bo'yi). */
        out.push(`^FO${D(it.x)},${D(it.y)}^A0B,${h},${Math.round(h * 0.6)}`
          + `^FB${D(it.h)},1,0,L,0^FD${zplEscape(it.text)}^FS`);
        continue;
      }
      out.push(`^FO${D(it.x)},${D(it.y)}^A0N,${h},${Math.round(h * 0.6)}`
        + `^FB${D(it.w)},1,0,${just},0^FD${zplEscape(it.text)}^FS`);
      continue;
    }
    if (it.kind === "barcode" && it.value && it.metrics) {
      const narrow = Number(it.cfg?.moduleDots ?? 2);
      const bh = D(barsHeightMm(it));
      /* 270° (`B`): ^FO — burilgan barkodning YUQORI chap burchagi. */
      const o = it.rot ? "B" : "N";
      const top = it.rot ? it.y + it.h - (it.shift || 0) - Number(it.metrics.widthMm || 0) : it.y;
      out.push(`^FO${D(it.x)},${D(Math.max(0, top))}^BY${narrow}`);
      out.push(it.metrics.kind === "EAN13" || it.metrics.kind === "EAN8"
        ? `^BE${o},${bh},${it.showText ? "Y" : "N"},N^FD${zplEscape(it.value)}^FS`
        : `^BC${o},${bh},${it.showText ? "Y" : "N"},N,N^FD${zplEscape(it.value)}^FS`);
      continue;
    }
  }

  out.push(`^PQ${Math.max(1, Number(copies) || 1)}`);
  out.push("^XZ");
  return out.join("\n") + "\n";
}

/**
 * MEDIA KALIBRLASH BUYRUG'I.
 *
 * ⚠ QO'LLAB-QUVVATLASHNING №1 MUAMMOSI: «yorliq qiyshiq chiqyapti»
 * yoki «uchta bo'sh yorliq chiqib ketyapti». Sababi deyarli har doim
 * bitta: printer yangi qog'ozning oralig'ini o'lchamagan. Buyruq
 * printerni bir necha yorliq o'tkazib, sensor qiymatini yozib
 * olishga majbur qiladi.
 */
export function calibrationCommand(lang) {
  const L = String(lang || "").toUpperCase();
  if (L === "TSPL") return "GAPDETECT\r\n";
  if (L === "ZPL") return "~JC\n";
  return null;
}

/** Berilgan til uchun joylashuvni baytga o'giradi yoki `null`. */
export function toBytes(lang, layout, opts) {
  const L = String(lang || "").toUpperCase();
  if (L === "TSPL") return toTSPL(layout, opts);
  if (L === "ZPL") return toZPL(layout, opts);
  return null;
}

/* ── Yordamchilar ────────────────────────────────────────────────────── */
const num = (n) => (Math.round(Number(n) * 10) / 10).toString();
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
/** ZPL da `^`, `~` va `\` maxsus belgilar. */
const zplEscape = (s) => String(s ?? "").replace(/[\^~\\]/g, "");
