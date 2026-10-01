import { useSyncExternalStore } from "react";
import { subscribeLayers, layerCount } from "../lib/modal-stack";

/* ══════════════════════════════════════════════════════════════════════════
   Ochiq oynalar soni — o'zgarganda sahifa qayta chiziladi (2026-10-01)

   ⚠ NEGA KERAK. Katalog va Ombordagi sahifa skaneri oyna ochiq bo'lganda
   BUTUNLAY o'chishi shart. Faqat kod kelganda «oyna ochiqmi?» deb so'rash
   yetmaydi: `useScanner` tez kelgan tugmalarni Enter'gacha ham ushlab,
   maydonga tushirmaydi. Shu sabab oynadagi maydon (filtr, kirim,
   markirovka) skanerlangan kodni olmay qolardi va kod jimgina yo'qolardi.
   Birinchi bo'lib `check-inv` ushladi: filtr oynasiga tez yozilgan «sut»
   diskka «su» bo'lib tushdi.
   ══════════════════════════════════════════════════════════════════════════ */
export function useLayerCount() {
  return useSyncExternalStore(subscribeLayers, layerCount, () => 0);
}
