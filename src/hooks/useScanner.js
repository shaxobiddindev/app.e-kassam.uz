import { useEffect, useRef } from "react";
import { getSettings } from "../lib/ek-hardware";

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

export function useScanner(onScan, { enabled = true } = {}) {
  // `onScan` har render'da yangi funksiya bo'ladi; uni ref'da saqlaymiz,
  // aks holda hodisa tinglovchisi har safar qayta ulanardi.
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buf = "";
    let last = 0;
    let target = null;   // belgilar qaysi maydonga tushayotgani

    const reset = () => { buf = ""; target = null; };

    const onKeyDown = (e) => {
      if (!getSettings().scanner) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = e.timeStamp || Date.now();
      const gap = now - last;
      last = now;

      if (e.key === "Enter") {
        const code = buf;
        reset();
        if (code.length < MIN_LEN) return;

        // Skaner maydonga yozib ulgurgan bo'lsa — tozalaymiz, aks holda
        // barkod tovar nomi yoki qidiruv maydonida qolib ketardi.
        if (target && typeof target.value === "string" && target.value.endsWith(code)) {
          const rest = target.value.slice(0, -code.length);
          const setter = Object.getOwnPropertyDescriptor(
            target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          // React qiymatni o'zi kuzatadi — to'g'ridan-to'g'ri `value` berish
          // uni xabardor qilmaydi. Shuning uchun prototip setteri + `input`.
          setter?.call(target, rest);
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }

        e.preventDefault();
        e.stopPropagation();
        handler.current?.(code);
        return;
      }

      // Faqat bitta belgi beradigan tugmalar (Shift, F1, Tab — yo'q)
      if (e.key.length !== 1) return;

      // Tanaffus uzun bo'lsa — bu yangi ketma-ketlikning boshi
      if (gap > MAX_GAP) buf = "";
      buf += e.key;
      target = e.target;
    };

    // `capture: true` — sahifadagi maydonlar hodisani to'xtatib qo'ysa ham
    // biz uni birinchi ko'ramiz.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
