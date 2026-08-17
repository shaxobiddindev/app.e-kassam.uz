import { isMobileApp } from "./ek-desktop";

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
.pt-total { font-size: 14px; font-weight: 800; padding: 6px 0; border-top: 1px solid #111111; margin-top: 4px; }
.pt-earn { font-weight: 700; }
.pt-returned {
  margin: 10px 0; padding: 6px; text-align: center; font-weight: 800; letter-spacing: .2em;
  border: 2px solid #111111; border-radius: 4px;
}
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
function buildHtml(tapeHtml, title) {
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* ⚠ `data-theme="light"`: ilova qorong'i temada bo'lsa ham chek oq
     qog'ozda qoladi (ekranda ham shunday — `[data-theme=dark] .pt-tape`). */
  return `<!DOCTYPE html><html lang="uz" data-theme="light"><head>`
    + `<meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${PRINT_CSS}</style></head><body>${tapeHtml}</body></html>`;
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
  const name = title || "Chek";
  const html = buildHtml(tapeEl.outerHTML, name);

  if (isMobileApp()) {
    const plugin = window.Capacitor?.Plugins?.ReceiptPrint;
    /* Plagin yo'q (eski APK yoki brauzerdagi `ek_forceMobile` sinovi) —
       oddiy brauzer yo'liga tushamiz, u yerda ishlasa ishlaydi. */
    if (plugin) {
      await plugin.print({ html, name });
      return;
    }
  }

  const win = window.open("", "_blank", "width=420,height=720");
  /* Popup to'silgan — bu YAGONA kutiladigan xato, matni ham aniq bo'lsin */
  if (!win) throw new Error("Brauzer yangi oynani to'sdi — ruxsat bering va qayta urinib ko'ring");
  win.document.write(html);
  win.document.close();
  /* Chop etilgach oyna O'ZI yopiladi — aks holda har chekdan keyin bitta
     ochiq oyna qolib ketardi (ek-hardware.js dagi bilan bir xil qoida). */
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 80);
}
