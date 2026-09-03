/* ══════════════════════════════════════════════════════════════════════════
   OYNALAR TAXLAMI — oxirgi ochilgan oyna DOIM ustida

   ═══ MUAMMO ═════════════════════════════════════════════════════════════

   To'lov oynasidan «yangi mijoz» oynasi ochilganda u to'lovning ORQASIDA
   qolib ketardi: kassir yozayotgan maydonini ko'rmasdi. Sabab — har oyna
   o'z `z-index` ini QATTIQ KODLAB olgan edi: oddiy oyna 500, to'lov oynasi
   600. Ya'ni «kim ustida turadi» degan savolga JAVOB CSS da yozib
   qo'yilgan edi, holbuki bu savolga faqat ISH TARTIBI javob bera oladi —
   oxirgi ochilgan oyna ustida turishi kerak, qaysi sahifadan ochilganidan
   qat'i nazar.

   ═══ YECHIM ═════════════════════════════════════════════════════════════

   Har oyna `document.body` ga portal qilinadi va HAMMASI BIR XIL
   `z-index` oladi (`--z-modal`). Teng `z-index` da brauzer DOM
   TARTIBIni oladi: keyin qo'shilgan tugun ustida chiziladi. Portal esa
   tugunni mount paytida `body` OXIRIGA qo'shadi — ya'ni «oxirgi ochilgan
   ustida» qoidasi o'z-o'zidan bajariladi va uni hech kim buzolmaydi.

   Raqamli hisoblagich (600, 610, 620…) ATAYLAB ISHLATILMADI: u React
   ning qat'iy rejimida ikki marta oshib ketardi va yopilgan oynalardan
   keyin «teshiklar» qolardi. DOM tartibi esa har doim haqiqatni aytadi.

   ═══ BU MODULNING VAZIFASI ══════════════════════════════════════════════

   `z-index` uchun hech narsa kerak emas. Kerak bo'lgan yagona narsa —
   «men eng ustidagi oynamanmi?» degan savolga javob, chunki Esc tugmasi
   FAQAT eng ustidagi oynani yopishi kerak. Aks holda bitta Esc ikkala
   oynani ham yopib yuborardi.
   ══════════════════════════════════════════════════════════════════════════ */

const stack = [];
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function pushLayer(id) {
  if (!stack.includes(id)) {
    stack.push(id);
    notify();
  }
}

export function popLayer(id) {
  const i = stack.indexOf(id);
  if (i >= 0) {
    stack.splice(i, 1);
    notify();
  }
}

/** Shu qatlam eng ustidamikan. Oyna umuman ro'yxatda bo'lmasa — yo'q. */
export function isTopLayer(id) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/** Ochiq oynalar soni — sahifa ortidagi surishni to'sish uchun. */
export function layerCount() {
  return stack.length;
}

export function subscribeLayers(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
