/* ==========================================================================
   e-Kassam — enum qiymatlari lug'ati

   Backend enum'lari (`uz.kassa.common.enums`) foydalanuvchiga HECH QACHON xom
   ko'rinishda chiqmaydi: `CASH` emas, `Naqd`. Ilgari har bir sahifada o'z
   kichik jadvali bor edi va ular to'liq emasdi — masalan `CLICK`/`PAYME`
   hech qayerda tarjima qilinmagan, `BLOCKED`/`SUSPENDED` esa ro'yxatda yo'q
   edi. Natijada select'lar va jadvallarda baza qiymati ko'rinardi.

   Endi yagona manba shu fayl. Har bir enum'da BARCHA qiymatlar bor —
   backendga yangi qiymat qo'shilsa, shu yerga ham qo'shiladi.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

/* ── To'lov turi — uz.kassa.common.enums.PaymentType ─────────────────────── */
export const PAYMENT_TYPE = {
  CASH:  { label: "Naqd",    icon: "fa-money-bill-1",         color: "var(--ek-pay-cash)"  },
  CARD:  { label: "Karta",   icon: "fa-credit-card",          color: "var(--ek-pay-card)"  },
  CLICK: { label: "Click",   icon: "fa-mobile-screen",        color: "var(--ek-role-stock)" },
  PAYME: { label: "Payme",   icon: "fa-mobile-screen-button", color: "var(--ek-role-cashier)" },
  MIXED: { label: "Aralash", icon: "fa-shuffle",              color: "var(--ek-pay-mixed)" },
};

/* ── Sotuv holati — SaleStatus ───────────────────────────────────────────── */
export const SALE_STATUS = {
  CREATED:   { label: "Yangi",     tone: "info",    icon: "fa-clock" },
  PAID:      { label: "To'langan", tone: "success", icon: "fa-circle-check" },
  CANCELLED: { label: "Bekor qilingan", tone: "danger", icon: "fa-circle-xmark" },
};

/* ── Do'kon holati — ShopStatus ──────────────────────────────────────────── */
export const SHOP_STATUS = {
  ACTIVE:    { label: "Faol",         tone: "success", icon: "fa-circle-check" },
  BLOCKED:   { label: "Bloklangan",   tone: "danger",  icon: "fa-ban" },
  SUSPENDED: { label: "To'xtatilgan", tone: "warning", icon: "fa-pause" },
  INACTIVE:  { label: "Nofaol",       tone: "neutral", icon: "fa-circle-minus" },
  // Backend enum'ida yo'q, lekin API javobida uchraydi (yumshoq o'chirilgan)
  DELETED:   { label: "O'chirilgan",  tone: "neutral", icon: "fa-trash" },
};

/* ── Tarif — ShopPlan ────────────────────────────────────────────────────── */
export const SHOP_PLAN = {
  FREE:    { label: "Bepul",        tone: "neutral" },
  BASIC:   { label: "Boshlang'ich", tone: "info" },
  PREMIUM: { label: "Professional", tone: "success" },
};

/* ── Do'kon xodimi roli — RoleType ───────────────────────────────────────── */
export const ROLE = {
  OWNER:       { label: "Do'kon egasi", short: "Egasi",    color: "var(--ek-role-owner)",   bg: "var(--ek-role-owner-bg)" },
  SHOP_ADMIN:  { label: "Do'kon admini", short: "Admin",   color: "var(--ek-role-admin)",   bg: "var(--ek-role-admin-bg)" },
  CASHIER:     { label: "Kassir",       short: "Kassir",   color: "var(--ek-role-cashier)", bg: "var(--ek-role-cashier-bg)" },
  STOREKEEPER: { label: "Omborchi",     short: "Omborchi", color: "var(--ek-role-stock)",   bg: "var(--ek-role-stock-bg)" },
};

/* ── Tizim admini — AdminRole ────────────────────────────────────────────── */
export const ADMIN_ROLE = {
  SUPER_ADMIN:   { label: "Super admin",     icon: "fa-crown",         color: "var(--ek-role-superadmin)", bg: "var(--ek-role-superadmin-bg)" },
  SYSTEM_ADMIN:  { label: "Tizim admini",    icon: "fa-server",        color: "var(--ek-role-admin)",      bg: "var(--ek-role-admin-bg)" },
  SUPPORT_ADMIN: { label: "Qo'llab-quvvatlash", icon: "fa-headset",    color: "var(--ek-role-cashier)",    bg: "var(--ek-role-cashier-bg)" },
  AUDITOR:       { label: "Auditor",         icon: "fa-magnifying-glass-chart", color: "var(--ek-role-stock)", bg: "var(--ek-role-stock-bg)" },
};

/* ── Ombor holati — InventoryStatus ──────────────────────────────────────── */
export const INVENTORY_STATUS = {
  ACTIVE:  { label: "Yaroqli",        tone: "success", icon: "fa-circle-check" },
  EXPIRED: { label: "Muddati o'tgan", tone: "danger",  icon: "fa-triangle-exclamation" },
};

/* ==========================================================================
   Yordamchilar
   ========================================================================== */

/** Spring `ROLE_` prefiksi va katta-kichik harf farqini yo'qotadi. */
function normalize(value) {
  if (value == null) return "";
  const raw = typeof value === "object"
    ? (value.type || value.name || value.role || "")
    : String(value);
  return raw.trim().toUpperCase().replace(/^ROLE_/, "");
}

/**
 * Lug'atdan yozuvni oladi. Topilmasa `null` emas, **o'qiladigan** zaxira
 * qaytaradi: `SHOP_ADMIN` → `Shop admin`. Foydalanuvchi hech qachon
 * `SNAKE_CASE` ko'rmaydi, hatto backend yangi qiymat qo'shsa ham.
 */
export function entry(dict, value) {
  const key = normalize(value);
  if (!key) return { label: "—", tone: "neutral" };
  if (dict[key]) return dict[key];
  const readable = key.toLowerCase().replace(/_/g, " ");
  return { label: readable.charAt(0).toUpperCase() + readable.slice(1), tone: "neutral" };
}

/** Faqat matn kerak bo'lganda. */
export const label = (dict, value) => entry(dict, value).label;

/** `<select>` uchun tayyor ro'yxat: [{ value, label }] */
export const options = (dict, only) =>
  (only || Object.keys(dict)).map((k) => ({ value: k, label: dict[k]?.label || k }));

/* Qulay qisqartmalar — chaqiruvchi kod lug'atni ikki marta yozmasin */
export const paymentLabel   = (v) => label(PAYMENT_TYPE, v);
export const paymentEntry   = (v) => entry(PAYMENT_TYPE, v);
export const saleStatus     = (v) => entry(SALE_STATUS, v);
export const shopStatus     = (v) => entry(SHOP_STATUS, v);
export const shopPlan       = (v) => entry(SHOP_PLAN, v);
export const roleEntry      = (v) => entry(ROLE, v);
export const roleLabel      = (v) => entry(ROLE, v).label;
export const adminRole      = (v) => entry(ADMIN_ROLE, v);
export const inventoryState = (v) => entry(INVENTORY_STATUS, v);

/** Bir nechta rol kelganda (`user.roles` massivi) — vergul bilan. */
export const rolesLabel = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .map((r) => entry(ROLE, r).label)
    .filter(Boolean)
    .join(", ") || "—";
