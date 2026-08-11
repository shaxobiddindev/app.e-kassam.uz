import { useEffect, useState } from "react";

/**
 * Aloqa bormi — oflaynda taqiqlanadigan amallar uchun.
 *
 * ═══ NEGA KERAK ═════════════════════════════════════════════════════════
 *
 * Oflayn navbat (`ek-offline.js`) FAQAT SOTUVNI saqlaydi va bu ataylab:
 * sotuv — yopiq hodisa, uni keyin yuborsa bo'ladi. Qolgan amallar esa
 * server holatiga tayanadi:
 *
 *   · QAYTARISH — qaysi chek, qaysi qator, qancha qoldiq — hammasi
 *     serverda; oflaynda ularni bilib bo'lmaydi.
 *   · SMENA YOPISH — kutilgan naqd server hisoblaydi, kassir emas.
 *   · NARX O'ZGARTIRISH — u boshqa kassalarga ham tegadi.
 *
 * Ilgari bu amallar oflaynda shunchaki TARMOQ XATOSI bilan yiqilardi:
 * xodim «Xatolik yuz berdi» degan yozuvni ko'rib, nima qilishni
 * bilmasdi va qayta-qayta bosardi. Endi sabab oldindan aytiladi.
 *
 * ⚠ CHEKLOV: `navigator.onLine` faqat QURILMANING tarmoqqa ulanganini
 * biladi, serverga yetib borishni EMAS. Do'kon Wi-Fi'si ishlab, interneti
 * yo'q bo'lsa u `true` qaytaradi va amal baribir tarmoq xatosi bilan
 * yiqiladi. Ya'ni bu — xatoni ALDINDAN va tushunarli aytish vositasi,
 * kafolat emas; API xatosi ishlovi joyida qolishi SHART.
 */
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
