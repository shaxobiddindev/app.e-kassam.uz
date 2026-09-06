/* ══════════════════════════════════════════════════════════════════════════
   APPARAT SOZLAMALARI — ALOHIDA, YENGIL MODUL (V60)

   ⚠ NEGA AJRATILDI. Sozlamalar `ek-hardware.js` ichida edi va ularni
   o'qish uchun O'SHA butun modulni import qilish kerak edi. Modul esa
   yengil emas: u chek chizadi, ESC/POS buyruqlarini yasaydi, barkod va
   QR chizadi — ya'ni `qrcode-generator` ni ham (51 KB) o'zi bilan
   olib keladi.

   Natijada `useScanner` (skaner yoqilganmi degan bitta savol uchun) va
   `ShiftBar` butun bosib chiqarish to'plamini KIRISH bo'lagiga tortib
   kelardi: kassir har ochilishda 90 KB dan ortiq ortiqcha kod kutardi,
   uni hech qachon ishlatmasa ham.

   Endi «sozlama o'qish» va «chek chizish» ikki xil modul. Birinchisi
   kichkina va hamma joyda, ikkinchisi og'ir va faqat kerak bo'lganda.

   ⚠ `ek-hardware.js` ularni QAYTA EKSPORT qiladi: eski importlar
   ishlayveradi va bir vaqtning o'zida ikki manba paydo bo'lmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY = "ek_hw";

export const DEFAULTS = {
  transport:   "windows",  // "windows" | "tcp" | "browser"
  printerName: "",         // windows: drayver nomi
  host:        "",         // tcp: IP
  port:        9100,
  width:       80,         // 80 | 58 (mm)
  autoPrint:   true,       // sotuv yakunlanganda chek o'zi chiqsin
  openDrawer:  true,       // naqd to'lovda yashik ochilsin
  scanner:     true,       // global barkod tutish

  /* ⚠ MIJOZ EKRANI standart bo'yicha O'CHIQ (V77): do'konlarning
     ko'pida ikkinchi monitor yo'q va yoqib qo'yilganda kassa har
     tugma bosilishida `localStorage` ga bekorga yozardi — sekin
     monoblokda bu sezilardi. */
  customerDisplay: false,

  /* ══ OVOZLI BILDIRISHNOMA (V89) ═══════════════════════════════════
     ⚠ NEGA APPARAT SOZLAMASI, do'kon sozlamasi EMAS. Bir do'konning
     zaldagi kassasi shovqinli joyda, ofisdagisi jim xonada turadi —
     ovoz balandligi QURILMANING xususiyati. Server tomonda terminal
     registri ham yo'q (`Shift.terminal_id` — erkin satr), ya'ni buni
     bazaga yozish yangi jadval va yangi identifikatsiya talab
     qilardi. Ustiga-ustak sozlama TARMOQSIZ o'qilishi kerak: kassa
     uzilishda ham ishlaydi.

     `events` — faqat STANDARTDAN farqli voqealar (`ek-sound.js`
     dagi `SFX[...].on` standart). Yozuv yo'q = standart. */
  sound: { on: true, volume: 0.7, events: {} },
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  /* Sozlama o'zgarishi ochiq ekranlarga yetib borsin (Sozlamalar va
     Kassa bir vaqtda ochiq bo'lishi mumkin). */
  window.dispatchEvent(new CustomEvent("ek:hw", { detail: next }));
  return next;
}
