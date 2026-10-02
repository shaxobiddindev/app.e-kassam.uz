import { useEffect, useRef } from "react";
/* ⚠ YENGIL moduldan: `ek-hardware` chek chizish va QR ni ham olib
   kelardi va skaner uchun bitta sozlama o'qish 90 KB ga tushardi. */
import { getSettings } from "../lib/ek-hw-settings";

/* ══════════════════════════════════════════════════════════════════════════
   Global barkod tutish

   USB skanerlarning aksariyati "klaviatura rejimi"da ishlaydi: skanerlangan
   kodni tez-tez tugma bosilgandek yuboradi va oxirida Enter qo'yadi.

   Ilgari bu FAQAT barkod maydoni fokusda bo'lganda ishlardi. Amalda kassir
   mijoz qo'shish oynasini ochib qo'yadi yoki sichqoncha bilan boshqa joyni
   bosadi — va skaner kodi qayergadir "yo'qoladi" yoki tovar nomi maydoniga
   yozilib qoladi. Shu sababli endi tutish HUJJAT darajasida.

   Ajratish mezoni — TEZLIK, tugma emas. Odam soniyasiga 5-8 belgi yozadi,
   skaner 30-100 belgi. `MAX_GAP` dan sekin kelgan belgilar odamniki deb
   hisoblanadi va tegilmaydi.

   ⚠ Matn maydoniga yozayotgan odamga XALAQIT BERMAYDI: fokus `input`/
   `textarea` da bo'lsa, tutish faqat ketma-ketlik skaner tezligida bo'lsa
   ishlaydi va bunda maydonga tushib ulgurgan belgilar tozalanadi.
   ══════════════════════════════════════════════════════════════════════════ */

const MAX_GAP  = 35;   // ms — belgilar orasidagi eng katta tanaffus
const MIN_LEN  = 4;    // shundan qisqasi barkod emas (tasodifiy bosish)

/**
 * Nechta belgidan keyin «bu skaner» deb ishonch hosil qilinadi.
 *
 * ⚠ Shundan KEYINGI belgilar maydonga UMUMAN tushmaydi
 * (`preventDefault`). Ilgari butun kod maydonga yozilib, keyin
 * matndan «kesib olinardi» — va aynan shu buzilardi: barkod maydonida
 * niqob bor (faqat raqam, 14 belgigacha), shuning uchun uzun yoki
 * harfli kod maydonda O'ZGARIB qolardi va «oxiri kodga teng» sharti
 * bajarilmasdi. Qoldiq tozalanmay qolar, keyingi skaner uning ustiga
 * yozilar edi — foydalanuvchi shikoyati: «ketma-ket skaner qilinganda
 * barkodlar ham ketma-ket yozilib ketyapti».
 *
 * ⚠ 2026-10-01: qoldiqning ASL sababi boshqa edi — tozalash umuman
 * ishlamagan (Enter'dagi izohga qarang).
 *
 * Ikkita ataylab: bitta belgidan skanerni odamdan ajratib bo'lmaydi
 * (tanaffus hali o'lchanmagan), uchtasi esa maydonga ko'proq belgi
 * o'tkazib yuborardi.
 */
const SURE_LEN = 2;

/** Matn yoziladigan maydonmi — faqat shularning qiymati tiklanadi. */
const isTextField = (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/** Maydon holatining surati: qiymat va belgilangan joy. */
function snapshot(el) {
  if (!isTextField(el)) return null;
  let start = null;
  let end = null;
  // `number`/`email` turida tanlov yo'q — o'qish ham xato berishi mumkin.
  try { start = el.selectionStart; end = el.selectionEnd; } catch { /* tanlovsiz tur */ }
  return { value: el.value, start, end };
}

/**
 * Maydonni ketma-ketlik boshidagi holatiga qaytaradi.
 *
 * React qiymatni o'zi kuzatadi — to'g'ridan-to'g'ri `value` berish uni
 * xabardor qilmaydi. Shuning uchun prototip setteri + `input` hodisasi:
 * maydonning o'z `onChange` i (niqob, formatlash) odatdagidek ishlaydi.
 */
function restore(el, snap) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, snap.value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  /* Belgilangan matn ham qaytadi: kassada «ishlatilgan» so'rov belgilangan
     turadi va keyingi yozish uni almashtirishi kerak. */
  if (snap.start != null && document.activeElement === el) {
    try { el.setSelectionRange(snap.start, snap.end); } catch { /* tanlovsiz tur */ }
  }
}

/**
 * @param onScan  to'liq kod bilan chaqiriladi
 * @param enabled tinglash yoqilganmi
 * @param only    ixtiyoriy: faqat shu maydonda boshlangan kod tutiladi —
 *                `(el) => boolean`. Qolgan maydonlarga skaner umuman tegmaydi.
 *
 * ⚠ `only` MATN KO'P YOZILADIGAN OYNALAR UCHUN (tovar formasi, 2026-10-02).
 * Skaner tezlikni uchinchi belgidan biladi va shundan keyingilarini to'sadi.
 * Juda tez yozadigan odamning ketma-ket uchta tez tugmasi ham shunday
 * ko'rinadi va uchinchi harf yo'qolardi. Nom va tavsif maydonida bu xavfga
 * hojat yo'q — u yerda skaner kutilmaydi.
 */
export function useScanner(onScan, { enabled = true, only = null } = {}) {
  // `onScan` har render'da yangi funksiya bo'ladi; uni ref'da saqlaymiz,
  // aks holda hodisa tinglovchisi har safar qayta ulanardi.
  const handler = useRef(onScan);
  handler.current = onScan;
  const filter = useRef(only);
  filter.current = only;

  useEffect(() => {
    if (!enabled) return;

    let buf = "";
    let last = 0;
    let target = null;   // belgilar qaysi maydonga tushayotgani
    let before = null;   // o'sha maydonning ketma-ketlik BOSHIDAGI holati
    let skip = false;    // ketma-ketlik `only` dan o'tmagan maydonda boshlangan

    const reset = () => { buf = ""; target = null; before = null; skip = false; };

    const onKeyDown = (e) => {
      if (!getSettings().scanner) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = e.timeStamp || Date.now();
      const gap = now - last;
      last = now;

      if (e.key === "Enter") {
        /* ⚠ AVVAL O'QILADI, KEYIN TOZALANADI (2026-10-01). Ilgari `reset()`
           tozalashdan OLDIN chaqirilardi va maydon bilan tushgan belgilarni
           bo'shatib qo'yardi — ya'ni quyidagi tozalash hook yaratilgan
           kundan (2026-08-06) beri BIR MARTA HAM ishlamagan. Maydonga
           tushib ulgurgan ikki belgi joyida qolar, har skanerlash yana
           ikkitasini qo'shardi. Do'kon shikoyati «qidiruvda 45 → 4545»
           aynan shu edi: barkodning boshi qidiruv maydonida to'planardi. */
        const code = buf;
        const field = target;
        const was = before;
        reset();
        if (code.length < MIN_LEN) return;

        /* Maydon ketma-ketlik BOSHIDAGI holatiga qaytariladi. Ilgari
           «oxiri tushgan belgilar bilan tugasa — kesib olinadi» edi va u
           ikki holatda baribir yolg'on bo'lardi: karetka matn o'rtasida
           turganda (belgilar o'rtaga tushadi) va niqobli maydonda (raqam
           maydoni «9 000» ga «47» ni qo'shib «900 047» qilib qayta
           formatlaydi). Boshlang'ich qiymat esa ikkalasida ham aniq. */
        if (field && was && field.value !== was.value) restore(field, was);

        e.preventDefault();
        e.stopPropagation();
        handler.current?.(code);
        return;
      }

      // Faqat bitta belgi beradigan tugmalar (Shift, F1, Tab — yo'q)
      if (e.key.length !== 1) return;

      /* Tanaffus uzun bo'lsa yoki oldingi kod Enter bilan tugagan bo'lsa —
         yangi ketma-ketlik. Maydon holati SHU YERDA olinadi: `keydown`
         belgi maydonga qo'yilishidan OLDIN keladi.
         ⚠ `!buf` — ketma-ket skanerlash uchun: keyingi kod oldingi
         Enter'dan 35 ms ichida boshlanishi mumkin. */
      if (gap > MAX_GAP || !buf) {
        buf = "";
        target = e.target;
        before = snapshot(e.target);
        skip = !!filter.current && !filter.current(e.target);
      }
      /* Tutilmaydigan maydon: `buf` bo'sh qoladi — Enter'da kod qisqa deb
         o'tkazib yuboriladi va maydonning o'z Enter'i ishlaydi. */
      if (skip) return;
      buf += e.key;

      /* Skaner ekani aniqlangach belgilar maydonga o'tkazilmaydi.
         Shu paytgacha tushganlari Enter'da maydonni boshlang'ich
         holatiga qaytarish bilan olib tashlanadi. */
      if (buf.length > SURE_LEN) e.preventDefault();
    };

    // `capture: true` — sahifadagi maydonlar hodisani to'xtatib qo'ysa ham
    // biz uni birinchi ko'ramiz.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
