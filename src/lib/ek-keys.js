/* ══════════════════════════════════════════════════════════════════════════
   Ekran klaviaturasi maydonga qanday yozadi

   ⚠ ENG MUHIM JOY: `el.value = "..."` React uchun YETARLI EMAS.
   React `value` propertysini o'z setteri bilan almashtirib qo'yadi va
   to'g'ridan-to'g'ri yozilgan qiymatni "o'zgarish" deb hisoblamaydi —
   `onChange` chaqirilmaydi, holat eskiligicha qoladi va keyingi render
   yozganimizni o'chirib tashlaydi.

   Yechim: PROTOTIPDAGI asl setterni chaqirib, so'ng `input` hodisasini
   qo'lda yuborish. Shunda React o'zining odatdagi yo'li bilan xabardor
   bo'ladi va boshqaruvchi komponent (`value={...}`) buzilmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Maydon turiga mos ASL `value` setteri (React ustidan yozgani emas). */
function nativeSetter(el) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, "value")?.set;
}

/**
 * Maydonga yangi qiymat yozadi va kursorni joylashtiradi.
 *
 * ⚠ `type="number"` maydonda `selectionStart` MAVJUD EMAS (brauzer uni
 * qo'llab-quvvatlamaydi va o'qishga urinish istisno beradi). Shuning uchun
 * kursor bilan ishlash himoyalangan: bunday maydonda matn oxiriga yoziladi.
 */
export function setValue(el, next, caret) {
  const set = nativeSetter(el);
  if (set) set.call(el, next);
  else el.value = next;

  if (caret != null) {
    try { el.setSelectionRange(caret, caret); } catch (e) { /* number maydon */ }
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Kursor o'rni; olib bo'lmasa matn oxiri. */
function caretOf(el) {
  try {
    if (el.selectionStart != null) return el.selectionStart;
  } catch (e) { /* number maydon */ }
  return (el.value || "").length;
}

/** Belgini kursor o'rniga qo'shadi (tanlangan matn bo'lsa — uning o'rniga). */
export function insert(el, text) {
  const value = el.value || "";
  let start = caretOf(el);
  let end = start;
  try { if (el.selectionEnd != null) end = el.selectionEnd; } catch (e) { /* number */ }

  const next = value.slice(0, start) + text + value.slice(end);
  setValue(el, next, start + text.length);
}

/** Kursordan oldingi bitta belgini o'chiradi (tanlov bo'lsa — tanlovni). */
export function backspace(el) {
  const value = el.value || "";
  let start = caretOf(el);
  let end = start;
  try { if (el.selectionEnd != null) end = el.selectionEnd; } catch (e) { /* number */ }

  if (start === end) {
    if (start === 0) return;
    setValue(el, value.slice(0, start - 1) + value.slice(end), start - 1);
  } else {
    setValue(el, value.slice(0, start) + value.slice(end), start);
  }
}

/** Maydonni butunlay tozalaydi. */
export function clear(el) {
  setValue(el, "", 0);
}

/**
 * Maydon RAQAMLI mi — klaviatura qaysi rejimda ochilishini shu hal qiladi.
 *
 * ⚠ Maydonlarni qo'lda belgilashning HOJATI YO'Q: ilovada raqamli
 * maydonlarga allaqachon `type="number"` yoki `inputMode` qo'yilgan
 * (mobil brauzerlar uchun kerak edi). Shu belgidan foydalanamiz — ya'ni
 * yangi yozilgan maydon ham avtomatik to'g'ri klaviatura oladi.
 */
export function isNumericField(el) {
  if (!el) return false;
  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "number" || type === "tel") return true;
  const mode = (el.getAttribute("inputmode") || el.inputMode || "").toLowerCase();
  return mode === "numeric" || mode === "decimal" || mode === "tel";
}

/** Klaviatura ochiladigan maydonmi (tugma, checkbox va h.k. emas). */
export function isTextEntry(el) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  return ["text", "search", "number", "tel", "password", "email", "url", ""].includes(type);
}
