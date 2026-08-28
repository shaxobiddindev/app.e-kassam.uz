/* ══════════════════════════════════════════════════════════════════════════
   SAVATLARNI SAQLASH — brauzerda, kassir va do'kon bo'yicha alohida.

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

   ⚠ ENDI SAVAT BITTA EMAS (2026-08-27). Bitta kassada bir vaqtda bir
   nechta mijozga xizmat ko'rsatiladi, shuning uchun yozuvda savatlar
   RO'YXATI turadi. Eski, bitta savatli yozuv ham o'qiladi — yangilanish
   paytida kassaning o'rtasida turgan savat yo'qolmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

const PREFIX = "ek_cart_";

/** Bir vaqtda ochib turish mumkin bo'lgan savatlar soni. */
export const MAX_CARTS = 5;

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

/** Bo'sh savat. `id` — faqat brauzer ichida, serverga hech qachon ketmaydi. */
export function blank(id) {
  return { id, items: [], customer: null };
}

/** Savatlar ro'yxatini saqlaydi. Hammasi bo'sh bo'lsa — yozuvni o'chiradi. */
export function save(carts, activeId) {
  try {
    const key = keyFor();
    const full = (carts || []).filter((c) => c.items?.length);
    if (full.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), v: 2, carts: full, activeId }));
  } catch (_) {
    /* Xotira to'lgan yoki shaxsiy rejim — saqlanmasa ham kassa ishlaydi.
       Bu qatlam qulaylik va iz uchun, sotuvning sharti emas. */
  }
}

/**
 * Saqlangan savatlarni o'qiydi va YOZUVNI O'CHIRADI.
 *
 * Qaytadi: `{ carts, activeId, stale }` yoki `null`.
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

    /* ⚠ ESKI YOZUV (v1) — bitta savat `cart` maydonida. Uni tashlab
       yuborish yangilanish chiqqan kunning o'rtasida terilgan savatlarni
       yo'q qilardi, ya'ni aynan o'sha xatoni qaytarardi. */
    const list = Array.isArray(parsed?.carts)
      ? parsed.carts
      : (Array.isArray(parsed?.cart) ? [{ id: 1, items: parsed.cart, customer: null }] : null);
    if (!list) return null;

    const carts = list
      .map((c, i) => ({
        id: Number(c?.id) || i + 1,
        items: Array.isArray(c?.items) ? c.items : [],
        customer: c?.customer || null,
      }))
      .filter((c) => c.items.length > 0)
      .slice(0, MAX_CARTS);
    if (carts.length === 0) return null;

    const wanted = Number(parsed?.activeId);
    const activeId = carts.some((c) => c.id === wanted) ? wanted : carts[0].id;

    return { carts, activeId, stale: Date.now() - (parsed.savedAt || 0) > STALE_MS };
  } catch (_) {
    return null;   // buzuq yozuv — yo'q deb hisoblanadi
  }
}

/** Jurnal uchun qisqa matn: «Suv ×2; Non ×1». */
export function describe(items) {
  return (items || [])
    .map((i) => `${i.name} ×${i.qty}`)
    .join("; ")
    .slice(0, 1000);
}

/** Savat jami summasi — qator chegirmalari AYRILGAN holda (V48).
    Kassir savatda narxni tushirgan bo'lsa, savat yorlig'ida eski summa
    turishi uni chalkashtirardi: yorliqda bir raqam, to'lov oynasida
    boshqasi. */
export function totalOf(items) {
  return (items || []).reduce((sum, i) => sum + Math.max(0,
    (Number(i.salePrice) || 0) * (Number(i.qty) || 0) - (Number(i.discount) || 0)), 0);
}

/** Barcha savatlardagi tovarlar — eskirgan savatni jurnalga yozish uchun. */
export function flatten(carts) {
  return (carts || []).flatMap((c) => c.items || []);
}
