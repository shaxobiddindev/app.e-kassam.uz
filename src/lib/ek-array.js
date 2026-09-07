/* ══════════════════════════════════════════════════════════════════════════
   SERVER JAVOBIDAN RO'YXAT OLISH

   ═══ NEGA ALOHIDA FUNKSIYA ════════════════════════════════════════════

   Kodda o'nlab joyda shunday yozilgan edi:

       setItems(r.data || []);

   Bu himoya YOLG'ON. `||` faqat «bo'sh» qiymatlarni ushlaydi:
   `null`, `undefined`, `0`, `""`. Obyekt esa — `{}` bo'lsa ham —
   TRUTHY, ya'ni u shundoq o'tib ketadi va keyingi qatordagi
   `.map(...)` yiqiladi:

       TypeError: r.map is not a function

   ⚠ NATIJASI BITTA QATOR EMAS, BUTUN SAHIFA. React'da render
   ichidagi istisno butun daraxtni yiqitadi va foydalanuvchi
   ErrorBoundary'ning «Bu bo'limda xatolik yuz berdi» oynasini
   ko'radi. Kassir uchun bu kassa to'xtaganini bildiradi.

   ═══ BU HAQIQIY XAVFMI ════════════════════════════════════════════════

   Ha, va dalili shu kodning O'ZIDA: `CommandPalette.jsx` da

       .then((r) => r.data?.content || r.data || [])

   deb yozilgan. Ya'ni kimdir allaqachon shu holatga tushgan —
   endpoint ro'yxat qaytarishdan sahifalangan javobga
   (`{content: [...]}`) o'tgan va chaqiruvchi yiqilgan. O'shanda u
   BITTA joyda tuzatilgan, qolgan o'nlab joy esa o'sha holicha
   qolgan.

   Server tomonda `List<T>` ni `Page<T>` ga o'zgartirish — oddiy va
   mantiqiy qadam. Uni qilgan odam esa frontendning qaysi yigirma
   joyi yiqilishini bilmaydi.

   ═══ QOIDA ════════════════════════════════════════════════════════════

   Server javobidan ro'yxat olinadigan HAR joyda `asArray` ishlatiladi.
   Tekshiruv: `scripts/check-array.mjs`.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Har qanday qiymatdan MASSIV qaytaradi.
 *
 * ⚠ Sahifalangan javob (`{content: [...]}`) ham tushuniladi: server
 * ro'yxatni sahifalashga o'tkazsa, chaqiruvchi yiqilmaydi — bo'sh
 * ro'yxat emas, HAQIQIY ma'lumot ko'rinadi.
 *
 * @param {*} value  server javobining `data` qismi
 * @returns {Array}  har doim massiv — hech qachon `null`/`undefined`
 */
export function asArray(value) {
  if (Array.isArray(value)) return value;
  /* Sahifalangan javob — Spring `Page<T>` shakli. */
  if (value && Array.isArray(value.content)) return value.content;
  return [];
}
