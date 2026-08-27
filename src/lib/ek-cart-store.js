/* ══════════════════════════════════════════════════════════════════════════
   SAVATNI SAQLASH — brauzerda, kassir va do'kon bo'yicha alohida.

   ⚠ NEGA KERAK. Savatdan tovarni o'chirish bajik bilan qo'riqlanadi va
   jurnalga yoziladi (`CART_ITEM_REMOVE`). Lekin savat `useState` da edi —
   ya'ni bitta F5 butun savatni izsiz yo'q qilardi. Qo'riqlash marosimga
   aylanib qolgan edi: uni aylanib o'tish uchun tugmani ham bosish shart
   emasdi.

   Endi savat saqlanadi va F5 uni yo'qotmaydi — demak undan qutulishning
   yagona yo'li qo'riqlanadigan tugma bo'lib qoladi.

   ⚠ HALOL CHEKLOV — BU DEVOR EMAS. Brauzer kassirning qo'lida: u
   `localStorage` ni tozalashi, boshqa profilda ochishi mumkin. Bu qatlam
   TASODIFIY va BEPARVO chetlab o'tishni yopadi, ataylab qilinganini esa
   KO'RINADIGAN qiladi (eskirgan savat jurnalga tushadi). Haqiqiy devor
   faqat bitta: savatning o'zi serverda yashashi. U — boshqa ish va
   oflayn rejimni qaytadan o'ylashni talab qiladi.

   ⚠ KALIT DO'KON VA KASSIR BO'YICHA. Aks holda bitta terminalda smena
   almashganda yangi kassir oldingisining savatini meros qilib olardi va
   jurnal butunlay yolg'on ko'rsatardi.
   ══════════════════════════════════════════════════════════════════════════ */

const PREFIX = "ek_cart_";

/**
 * Savat shuncha vaqtdan keyin ESKIRGAN hisoblanadi.
 *
 * ⚠ Nega umuman muddat bor: kecha yopilgan terminal bugun ochilganda
 * o'sha savatni tiklash xato bo'lardi — mijoz ketib bo'lgan, narxlar
 * o'zgargan bo'lishi mumkin. 6 soat — bir smena ichidagi uzilishni
 * (brauzer yopildi, kompyuter o'chdi) qoplaydi, lekin kechani emas.
 */
export const STALE_MS = 6 * 60 * 60 * 1000;

function keyFor() {
  const shop = localStorage.getItem("ek_shopCode") || "-";
  const user = localStorage.getItem("ek_username") || "-";
  return `${PREFIX}${shop}_${user}`;
}

/** Savatni saqlaydi. Bo'sh savat — yozuvni butunlay o'chiradi. */
export function save(cart) {
  try {
    const key = keyFor();
    if (!cart || cart.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), cart }));
  } catch (_) {
    /* Xotira to'lgan yoki shaxsiy rejim — saqlanmasa ham kassa ishlaydi.
       Bu qatlam qulaylik va iz uchun, sotuvning sharti emas. */
  }
}

/**
 * Saqlangan savatni o'qiydi va YOZUVNI O'CHIRADI.
 *
 * Qaytadi: `{ cart, stale }` yoki `null`.
 *   stale=false → tiklash kerak (yaqinda uzilgan)
 *   stale=true  → tiklanmaydi, lekin JURNALGA YOZILADI
 *
 * ⚠ O'qish bilan birga o'chirilishi ataylab: qanday tugasa ham (tiklandi
 * yoki tashlandi) bir marta hal qilinadi. Aks holda eskirgan savat har
 * ochilishda qayta-qayta jurnalga tushardi.
 */
export function take() {
  try {
    const key = keyFor();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);

    const parsed = JSON.parse(raw);
    const cart = Array.isArray(parsed?.cart) ? parsed.cart : null;
    if (!cart || cart.length === 0) return null;

    return { cart, stale: Date.now() - (parsed.savedAt || 0) > STALE_MS };
  } catch (_) {
    return null;   // buzuq yozuv — yo'q deb hisoblanadi
  }
}

/** Jurnal uchun qisqa matn: «Suv ×2; Non ×1». */
export function describe(cart) {
  return (cart || [])
    .map((i) => `${i.name} ×${i.qty}`)
    .join("; ")
    .slice(0, 1000);
}

/** Savat jami summasi. */
export function totalOf(cart) {
  return (cart || []).reduce((sum, i) => sum + (Number(i.salePrice) || 0) * (Number(i.qty) || 0), 0);
}
