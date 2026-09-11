import { isDesktop, isMobileApp } from "./ek-desktop";

/* ══════════════════════════════════════════════════════════════════════════
   CHEKNI PDF QILIB SAQLASH

   ⚠ NEGA PDF SERVERDA YASALMAYDI. Kutubxonasiz PDF'da faqat base-14
   shriftlar bor va ular WinAnsi (Latin-1) bilan cheklangan — kirillcha
   do'kon yoki tovar nomi chekda kvadratchaga aylanardi. Buni tuzatish
   uchun TTF ni ichiga singdirish (cmap/hmtx tahlili, CIDFontType2) va
   ~330 KB shriftni serverga qo'shish kerak bo'lardi — prod 1 CPU / 965 MB.
   Brauzerda esa tayyor va to'g'ri ishlaydigan PDF dvigateli ALLAQACHON bor.

   ⚠ NEGA CHEK MATNI QAYTA YOZILMAYDI. `Receipt.jsx` ning boshidagi
   ogohlantirish: chek ko'rinishi BITTA joyda qolishi kerak. Shuning uchun
   bu yerda ekranda ALLAQACHON chizilgan `.pt-tape` tugunining nusxasi
   olinadi (`outerHTML`) — chekka yangi satr qo'shilsa PDF'ga o'zi tushadi.
   Faqat CSS takrorlanadi: bosma hujjatda ilovaning tokenlari (`var(--...)`)
   yo'q va bo'lishi ham kerak emas — qog'oz doim oq.

   Ikki yo'l, natija bir xil:
     · brauzer — yangi oyna + `print()`, foydalanuvchi «PDF sifatida saqlash»
       ni tanlaydi (mobil Chrome va Safari'da ham shu);
     · Android ilova — `window.print()` WebView'da JIM (hech narsa
       qilmaydi), shuning uchun o'z plagini: `ReceiptPrint.print({html})`
       tizimning chop etish oynasini ochadi, uning standart manzili
       «PDF sifatida saqlash».
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Bosma hujjatning uslubi — `styles.css` dagi `.pt-*` qoidalarining
 * TOKENSIZ nusxasi.
 *
 * ⚠ O'lchamlar 58 mm tasmaga moslangan: ekranda chek 380px kenglikdagi
 * modalda turadi, qog'ozda esa ~219px (58mm @96dpi). Shrift 11px —
 * satrga ~29 belgi, ya'ni haqiqiy chek printerining nisbati.
 */
const PRINT_CSS = `
/* Chek qog'ozi — A4 EMAS. @page bo'lmasa brauzer chekni A4 varaqning
   burchagiga qo'yib, chetiga o'z sarlavha-izohini qo'shadi. */
@page { size: 58mm auto; margin: 0; }

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 58mm; padding: 4mm 3mm 6mm;
  background: #FFFFFF; color: #111111;
  /* Shrift TIZIMNIKI: yangi oynaga tashqi shrift yuklanmaydi (chek
     printeriga chop etishda ham shu qoida — ek-hardware.js). */
  font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
  font-variant-numeric: tabular-nums;
  font-size: 11px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* Ekrandagi qog'oz effektlari bosmada keraksiz */
.pt-tape { background: #FFFFFF; color: #111111; padding: 0; border-radius: 0; box-shadow: none; }
.ek-tear::after { display: none; }

.pt-tape__head { text-align: center; }
.pt-tape__shop { font-size: 14px; font-weight: 800; letter-spacing: .5px; }
.pt-hr { border-top: 1px dashed #999999; margin: 7px 0; }
.pt-tape__row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.pt-tape__row > span:last-child { white-space: nowrap; }
.pt-line { padding: 3px 0; }
.pt-line__name { font-weight: 700; }
/* Qator chegirmasi — qog'oz chekdagi bilan bir xil, ichkariroq va
   so'nikroq: u qatorning IZOHI, alohida qator emas. */
.pt-line__cut { padding-left: 10px; opacity: .75; }
/* ⚠ CHEK TURI (V61) — «QARZ TO'LOVI». Bu qator EKRANDA bor edi, PDF
   da esa yo'q: saqlangan nusxada u oddiy mayda matnga aylanib,
   xarid chekidan ajralib turmay qolardi — holbuki uni ajratib
   turadigan YAGONA narsa shu (V109 da topildi). */
.pt-tape__kind {
  margin-top: 6px; padding-top: 5px; border-top: 1px solid #111111;
  font-size: 11px; font-weight: 800; letter-spacing: .18em;
}
.pt-total { font-size: 14px; font-weight: 800; padding: 6px 0; border-top: 1px solid #111111; margin-top: 4px; }
.pt-earn { font-weight: 700; }
.pt-returned {
  margin: 10px 0; padding: 6px; text-align: center; font-weight: 800; letter-spacing: .2em;
  border: 2px solid #111111; border-radius: 4px;
}
/* ⚠ BEKOR QILINGAN TO'LOV (V109) — «pt-returned» bilan bir oilada:
   ikkalasi ham «bu hujjat endi boshqa narsani anglatadi» deydi va
   mijoz ularni bir xil tanishi kerak. Farqi — bu yerda uch qator
   (nima · qachon · nega), chunki «nega?» savoli darhol tug'iladi. */
.pt-void {
  margin: 10px 0; padding: 6px; text-align: center;
  border: 2px solid #111111; border-radius: 4px;
}
.pt-void__title { font-weight: 800; letter-spacing: .2em; }
.pt-void__when  { font-size: 11px; margin-top: 2px; }
.pt-void__why   { font-size: 11px; margin-top: 2px; }
.pt-center { text-align: center; }
.pt-tape__no { font-size: 12px; font-weight: 800; margin-top: 2px; }
.pt-thanks { margin-top: 10px; font-weight: 700; }
.pt-tape__site { font-size: 10px; color: #555555; }

/* Ekranda fiskal QR va shtrix — bosiladigan tugma (kattalashtirish uchun).
   Qog'ozda ular oddiy rasm: tugma bezaklari olib tashlanadi. */
.pt-tape button { all: unset; display: block; width: 100%; }
.pt-fiscalqr { margin: 8px 0; }
.pt-fiscalqr svg, .pt-barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;

/** Bosma hujjat — bitta oq sahifa, ichida chek tasmasining nusxasi. */
function buildHtml(tapeHtml, title, css = PRINT_CSS) {
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* ⚠ `data-theme="light"`: ilova qorong'i temada bo'lsa ham chek oq
     qog'ozda qoladi (ekranda ham shunday — `[data-theme=dark] .pt-tape`). */
  return `<!DOCTYPE html><html lang="uz" data-theme="light"><head>`
    + `<meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${css}</style></head><body>${tapeHtml}</body></html>`;
}

/**
 * ══════════════════════════════════════════════════════════════════════
 * HUJJATNI CHOP ETISH / PDF QILIB SAQLASH — UMUMIY YO'L (V98)
 *
 * ⚠ NEGA AJRATILDI. Platformaga xos ikkita nozik joy bor va ular
 * TAKRORLANMASLIGI kerak:
 *
 *   · Android ilovada `window.print()` JIM ishlaydi — hech narsa
 *     qilmaydi va foydalanuvchi tugma buzilgan deb o'ylaydi;
 *   · brauzerda ochilgan oyna chop etilgach O'ZI yopilishi kerak,
 *     aks holda har hujjatdan keyin bitta ochiq oyna qolib ketadi.
 *
 * Mijoz hisoboti ham shu yo'ldan o'tadi — faqat uslubi boshqa (A4,
 * chek esa 58 mm). Ikkinchi nusxa yozilsa, bu ikki nozik joydan biri
 * unda bir kuni tushib qolardi.
 * ══════════════════════════════════════════════════════════════════════
 */
export async function printHtml(bodyHtml, title, css, win = "width=420,height=720") {
  const name = title || "Hujjat";
  const html = buildHtml(bodyHtml, name, css);

  if (isMobileApp()) {
    const plugin = window.Capacitor?.Plugins?.ReceiptPrint;
    /* Plagin yo'q (eski APK yoki brauzerdagi `ek_forceMobile` sinovi) —
       oddiy brauzer yo'liga tushamiz, u yerda ishlasa ishlaydi. */
    if (plugin) {
      await plugin.print({ html, name });
      return;
    }
  }

  /* ⚠ O'LCHAM PARAMETR: chek 420px oynada ochiladi (u 58 mm), hisobot
     esa kengrog'ida. Umumiy yo'lga ko'chirishda buni unutib, chekni
     ham 820px ga o'tkazib yuborgan edim — ishlab turgan yo'lning
     ko'rinishini beixtiyor o'zgartirish aynan shunday boshlanadi. */
  /* ══════════════════════════════════════════════════════════════════
     ⚠ DESKTOPDA `window.open` ISHLAMAYDI — VA NULL HAM QAYTARMAYDI.

     Tauri/WebView2 da wry yangi oyna so'rovini `SetHandled(true)` bilan
     yopadi, lekin WebView2 baribir «dummy» WindowProxy qaytaradi. Ya'ni:
       · oyna ochilmaydi;
       · `w` NULL EMAS, shuning uchun pastdagi popup tekshiruvi ham
         ishlamaydi;
       · `w.document.write` jimgina yo'qoladi va funksiya
         MUVAFFAQIYAT qaytaradi.

     Natijasi eng yomon turdagi nosozlik: kassir «Chop etish» ni bosadi,
     hech narsa chiqmaydi, xato ham chiqmaydi va navbat qatori
     «chiqarilgan» deb belgilanadi.

     Aynan shu qoida `ek-hardware.js` da allaqachon bor edi — bu yerga
     ko'chirilmagani uchun v1.10.0 dan keyin qo'shilgan YORLIQ moduli
     (`LabelsPage`, `LabelQueue`) desktopda umuman chop eta olmasdi.

     `window.print()` esa WebView2 da ISHLAYDI. Shuning uchun hujjat
     ilova oynasining ICHIDA, yashirin iframe da chop etiladi.
     ══════════════════════════════════════════════════════════════════ */
  if (isDesktop()) {
    await printInFrame(html);
    return;
  }

  const w = window.open("", "_blank", win);
  /* Popup to'silgan — bu YAGONA kutiladigan xato, matni ham aniq bo'lsin */
  if (!w) throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");
  w.document.write(html);
  w.document.close();
  /* Chop etilgach oyna O'ZI yopiladi — aks holda har hujjatdan keyin
     bitta ochiq oyna qolib ketardi (`ek-hardware.js` bilan bir xil). */
  w.onafterprint = () => w.close();
  setTimeout(() => w.print(), 80);
}

/**
 * Chekni PDF qilib saqlash oynasini ochadi.
 *
 * @param {HTMLElement} tapeEl ekranda chizilgan `.pt-tape` tuguni
 * @param {string} title hujjat nomi — saqlanadigan faylning nomi ham shu
 *                       (brauzer `document.title` ni, Android esa chop
 *                       etish ishining nomini oladi)
 */
export async function saveReceiptPdf(tapeEl, title) {
  if (!tapeEl) throw new Error("Chek hali yuklanmadi");
  /* ⚠ Uslub BERILMAYDI — chek 58 mm tasmada qoladi (`PRINT_CSS`).
     Platformaga xos yo'l esa `printHtml` da, bitta joyda. */
  return printHtml(tapeEl.outerHTML, title || "Chek");
}

/**
 * Hujjatni ILOVA OYNASI ICHIDA chop etadi (desktop yo'li).
 *
 * ⚠ IFRAME OLIB TASHLANADI, lekin DARHOL EMAS: `print()` sinxron
 * ko'rinadi-yu, WebView2 da chop etish dialogi yopilgunga qadar
 * iframe tirik turishi kerak. Shuning uchun `onafterprint` kutiladi,
 * va u kelmasa ham (dialog bekor qilinsa ba'zi versiyalarda kelmaydi)
 * vaqt bo'yicha tozalanadi — aks holda har chop etishdan keyin
 * DOM da bitta o'lik iframe qolib ketardi.
 */
function printInFrame(html) {
  return new Promise((resolve, reject) => {
    const fr = document.createElement("iframe");
    fr.setAttribute("aria-hidden", "true");
    fr.setAttribute("title", "");
    fr.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
    document.body.appendChild(fr);

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      try { fr.remove(); } catch { /* allaqachon olingan */ }
      resolve();
    };

    fr.onload = () => {
      try {
        const win = fr.contentWindow;
        if (!win) throw new Error("Chop etish oynasi ochilmadi");
        win.onafterprint = cleanup;
        win.focus();
        win.print();
        /* ⚠ ZAXIRA TOZALASH: `onafterprint` kafolatlanmagan. */
        setTimeout(cleanup, 60000);
      } catch (e) {
        try { fr.remove(); } catch { /* bo'lmasa bo'ldi */ }
        done = true;
        reject(e);
      }
    };

    /* ⚠ `srcdoc` ishlatiladi, `document.write` emas: CSP `default-src
       'self'` da iframe ga `about:blank` orqali yozish bloklanishi
       mumkin, `srcdoc` esa hujjatni bevosita beradi. */
    fr.srcdoc = html;
  });
}
