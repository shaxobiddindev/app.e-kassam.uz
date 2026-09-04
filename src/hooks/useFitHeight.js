import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   OYNA O'ZINI O'ZI SIG'DIRADI — SCROL HECH QACHON BO'LMASIN (V66)

   Do'kon egasi: «to'lov oynasida scrol hech qachon bo'lmasin, nima
   bo'lganda ham; kerak bo'lsa o'zini o'zi tartiblaydigan qilsang ham».

   ═══ NEGA CSS YETMAYDI ═════════════════════════════════════════════════

   Mazmun o'zgaruvchan: mijozda qarz ham, jamg'arma ham, ball ham
   bo'lishi mumkin; to'lov beshta usulga bo'linishi mumkin; chegirma
   ogohlantirishi chiqishi mumkin. Ekran ham o'zgaruvchan: 1080p
   monitor ham, 720p monoblok ham. CSS «sig'dimi?» deb SO'RAY OLMAYDI —
   faqat o'lchov beradi. Shuning uchun bu yerda O'LCHANADI.

   ═══ QANDAY ISHLAYDI ═══════════════════════════════════════════════════

   Har renderdan keyin (chizishdan OLDIN — `useLayoutEffect`) tana
   o'lchanadi: `scrollHeight > clientHeight` bo'lsa sig'magan. Shunda
   daraja bittaga oshadi va sahifa qayta chiziladi:

     0 — oddiy;
     1 — havo kamayadi (bo'shliqlar, jami kartasi, tugma balandligi);
     2 — izohlar yashirinadi, bloklar boshqa ustunga ko'chadi;
     oxirgisi — MASSHTAB: mazmun sig'guncha kichrayadi (`zoom`).

   Hammasi chizishdan oldin bo'lgani uchun ko'z «sakrash»ni ko'rmaydi.

   ⚠ QAYTISH: mazmun qisqarganda (mijoz olib tashlandi, usul o'chirildi)
   daraja o'zi tushmaydi — «pastroq daraja ham sig'armidi?» ni o'lchab
   bo'lmaydi. Shuning uchun chaqiruvchi `key` beradi: mazmunni
   o'zgartiradigan narsalar o'zgarganda daraja nolga qaytadi va yana
   yuqoriga o'lchab chiqiladi. Oyna o'lchami o'zgarsa ham shunday.

   ⚠ `zoom` — layoutni QAYTA HISOBLAYDI (`transform` esa faqat rasmni
   kichraytiradi va ostida bo'sh joy qoldiradi). Eski Firefox da
   `zoom` yo'q — u yerda `transform` + kenglik kompensatsiyasi.
   ══════════════════════════════════════════════════════════════════════════ */

const ZERO = { level: 0, zoom: 1 };
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports?.("zoom", "0.9");

/**
 * @param ref       o'lchanadigan tana (`overflow` bor element)
 * @param enabled   oyna ochiqmi
 * @param key       mazmunni o'zgartiradigan holatlardan yig'ilgan satr
 * @param maxLevel  CSS darajalarining eng kattasi (undan keyin masshtab)
 * @param minZoom   masshtab shundan pastga tushmaydi
 */
export function useFitHeight(ref, { enabled = true, key = "", maxLevel = 2, minZoom = 0.6 } = {}) {
  const [fit, setFit] = useState(ZERO);
  /* ⚠ QAYTA O'LCHASH UCHUN ALOHIDA HISOBLAGICH. Oyna o'lchami
     o'zgarganda `setFit(ZERO)` yetmaydi: daraja allaqachon 0 bo'lsa
     React BIR XIL qiymatni ko'rib qayta chizmaydi va o'lchov umuman
     bo'lmaydi — 1366 da sig'gan oyna 1280 ga toraytirilganda scrol
     bilan qolardi (brauzer sinovida tutildi). Hisoblagich har safar
     yangi qiymat — render bo'ladi, o'lchov bo'ladi. */
  const [, bump] = useState(0);
  const keyRef = useRef(key);

  useLayoutEffect(() => {
    if (!enabled) return;
    if (keyRef.current !== key) {
      keyRef.current = key;
      if (fit !== ZERO) { setFit(ZERO); return; }
    }
    const el = ref.current;
    if (!el) return;
    const over = el.scrollHeight - el.clientHeight;
    if (over <= 1) return;                                   // sig'di
    if (fit.level < maxLevel) { setFit({ level: fit.level + 1, zoom: 1 }); return; }
    /* ⚠ `transform` bilan layout o'zgarmaydi va `scrollHeight` ham
       o'zgarmaydi — bir marta hisoblanadi, aks holda har renderda
       yana kichrayaverardi. */
    if (fit.zoom < 1 && !SUPPORTS_ZOOM) return;
    const z = Math.max(minZoom, ((el.clientHeight - 2) / el.scrollHeight) * fit.zoom);
    if (fit.zoom - z > 0.004) setFit({ level: fit.level, zoom: z });
  });

  useEffect(() => {
    if (!enabled) { setFit(ZERO); return undefined; }
    const reset = () => { setFit(ZERO); bump((n) => n + 1); };
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, [enabled]);

  return fit;
}

/** Masshtab uchun inline uslub — `zoom` bo'lsa u, bo'lmasa `transform`. */
export function fitStyle(zoom) {
  if (!(zoom < 1)) return undefined;
  if (SUPPORTS_ZOOM) return { zoom };
  return { transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` };
}
