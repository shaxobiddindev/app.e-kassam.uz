/* ══════════════════════════════════════════════════════════════════════════
   Rollar bilan ishlash — YAGONA joy

   Xodimda BIR NECHTA rol bo'lishi mumkin va sessiyada ular bitta satrda,
   vergul bilan saqlanadi: `"SHOP_ADMIN,CASHIER"`.

   ⚠ Ilgari bu satr BUTUNLIGICHA bitta rol nomi bilan solishtirilardi
   (`item.roles.includes(userRole)`). Bitta roli bor xodimda bu tasodifan
   ishlardi, ikkitasi bo'lsa — hech biriga mos kelmasdi va yon menyuda
   faqat «Sozlamalar» qolardi (unda rol cheklovi yo'q).

   Shu sababli tekshiruv endi TO'PLAM bo'yicha. Funksiyalar eski
   sessiyalarni ham to'g'ri o'qiydi — foydalanuvchini qayta kirishga
   majburlash shart emas.
   ══════════════════════════════════════════════════════════════════════════ */

/** Yuqoridan pastga. Yangi rol qo'shilsa SHU YERGA joylashtiriladi. */
export const ROLE_RANK = ["OWNER", "SHOP_ADMIN", "ADMIN", "STOREKEEPER", "CASHIER"];

/**
 * Xom qiymatdan rollar to'plami.
 * Qabul qiladi: `"CASHIER"`, `"SHOP_ADMIN,CASHIER"`, `"ROLE_OWNER"`,
 * massiv, yoki backend'dan kelgan `[{type:"CASHIER"}]`.
 */
export function roleSet(raw) {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return new Set(
    list
      .map((r) => (typeof r === "object" && r ? r.type || r.name : r))
      .map((r) => String(r ?? "").trim().toUpperCase().replace(/^ROLE_/, ""))
      .filter(Boolean)
  );
}

/** Xodimda shu rollardan birortasi bormi. */
export function hasRole(raw, allowed) {
  if (!allowed || !allowed.length) return true;
  const mine = roleSet(raw);
  // OWNER — do'kon egasi, hamma joyga kiradi. Uni har bir ro'yxatga
  // qo'shib yurishdan ko'ra shu yerda bir marta aytgan ma'qul.
  if (mine.has("OWNER")) return true;
  return allowed.some((r) => mine.has(String(r).toUpperCase()));
}

/**
 * Ierarxiya bo'yicha ENG YUQORI rol — ko'rsatish uchun (yorliq, avatar).
 * Ruxsat tekshirish uchun `hasRole` ishlating: eng yuqori rol xodimning
 * qolgan rollarini yashiradi.
 */
export function topRole(raw) {
  const mine = roleSet(raw);
  return ROLE_RANK.find((r) => mine.has(r)) || [...mine][0] || "";
}
