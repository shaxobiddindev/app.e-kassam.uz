/* ==========================================================================
   e-Kassam — enum qiymatlari lug'ati

   Backend enum'lari (`uz.kassa.common.enums`) foydalanuvchiga HECH QACHON xom
   ko'rinishda chiqmaydi: `CASH` emas, `Naqd`. Yagona manba shu fayl —
   backendga yangi qiymat qo'shilsa, shu yerga ham qo'shiladi.

   ⚠ MATN BU YERDA TURMAYDI. Har bir yozuvning `label` i — `ek-i18n.js` dagi
   `enum.*` kalitiga bog'langan GETTER. Ya'ni til o'zgarganda mavjud
   obyektlar ham yangi tilni qaytaradi va hech qayerda "eski tildagi yorliq"
   qotib qolmaydi. Bu yerda faqat KO'RINISH metama'lumoti: tone, icon, color.

   Yorliq matnini `packages/ui/locales/uz.js` da tahrirlang.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

import { t } from "./ek-i18n";

/**
 * Metama'lumot jadvalidan lug'at quradi: har bir kalitga `label` GETTER
 * qo'shiladi. Getter — spread (`{...entry}`) qilinganda qiymatga aylanadi,
 * shuning uchun modul darajasida spread qilmang, `entry()` ni chaqiring.
 */
function dict(prefix, meta) {
  const out = {};
  for (const [key, meta_] of Object.entries(meta)) {
    const { hasShort, ...visual } = meta_;
    out[key] = Object.defineProperties(visual, {
      label: { get: () => t(`${prefix}.${key}`), enumerable: true },
      ...(hasShort
        ? { short: { get: () => t(`${prefix}.${key}.short`), enumerable: true } }
        : {}),
    });
  }
  return out;
}

/* ── To'lov turi — uz.kassa.common.enums.PaymentType ─────────────────────── */
export const PAYMENT_TYPE = dict("enum.payment", {
  CASH:  { icon: "fa-money-bill-1",         color: "var(--ek-pay-cash)" },
  CARD:  { icon: "fa-credit-card",          color: "var(--ek-pay-card)" },
  CLICK: { icon: "fa-mobile-screen",        color: "var(--ek-role-stock)" },
  PAYME: { icon: "fa-mobile-screen-button", color: "var(--ek-role-cashier)" },
  MIXED: { icon: "fa-shuffle",              color: "var(--ek-pay-mixed)" },
  /* Nasiya — to'lov EMAS: kassaga pul tushmaydi, mijozning qarzi oshadi.
     Rang ogohlantirish rangida: kassir uni tasodifan tanlab qo'ymasin. */
  CREDIT:{ icon: "fa-hand-holding-dollar",  color: "var(--fg-warning)" },
  /* JAMG'ARMA (V63) — mijozning do'kondagi shaxsiy puli.
     ⚠ Rang YASHIL (muvaffaqiyat), nasiyaniki kabi sariq EMAS: bu
     haqiqiy to'lov va chek yopiladi. Sariq kassirni «bu ham qarz
     ekan» deb o'ylatardi. */
  SAVINGS:{ icon: "fa-piggy-bank",          color: "var(--fg-success)" },
});

/* ── Sotuv holati — SaleStatus ───────────────────────────────────────────── */
export const SALE_STATUS = dict("enum.sale", {
  CREATED:   { tone: "info",    icon: "fa-clock" },
  PAID:      { tone: "success", icon: "fa-circle-check" },
  /* ⚠ NASIYA CHEKI YASHIL EMAS (V46). Ilgari u ham `PAID` bo'lib, do'kon
     egasining ko'zi oldida yashil «To'langan» yozuvi turardi — holbuki
     kassaga bir tiyin tushmagan. Sariq: bu tugallanmagan ish. */
  CREDIT:    { tone: "warning", icon: "fa-hand-holding-dollar" },
  CANCELLED: { tone: "danger",  icon: "fa-circle-xmark" },
});

/* ── Ko'chirish holati — TransferStatus (V22) ────────────────────────────── */
export const TRANSFER_STATUS = dict("enum.transferStatus", {
  /* «Yo'lda» — ogohlantirish rangida: bu tugallanmagan ish. Tovar hech
     qaysi do'konning javonida yo'q va uni kimdir qabul qilishi kerak. */
  SENT:      { tone: "warning", icon: "fa-truck-fast" },
  RECEIVED:  { tone: "success", icon: "fa-circle-check" },
  CANCELLED: { tone: "neutral", icon: "fa-rotate-left" },
});

/* ── Do'kon holati — ShopStatus ──────────────────────────────────────────── */
export const SHOP_STATUS = dict("enum.shopStatus", {
  ACTIVE:    { tone: "success", icon: "fa-circle-check" },
  BLOCKED:   { tone: "danger",  icon: "fa-ban" },
  SUSPENDED: { tone: "warning", icon: "fa-pause" },
  INACTIVE:  { tone: "neutral", icon: "fa-circle-minus" },
  // Backend enum'ida yo'q, lekin API javobida uchraydi (yumshoq o'chirilgan)
  DELETED:   { tone: "neutral", icon: "fa-trash" },
});

/* ── Tarif — ShopPlan ────────────────────────────────────────────────────── */
export const SHOP_PLAN = dict("enum.plan", {
  FREE:       { tone: "neutral", icon: "fa-hourglass-half" },
  BASIC:      { tone: "info",    icon: "fa-store" },
  PREMIUM:    { tone: "success", icon: "fa-crown" },
  ENTERPRISE: { tone: "success", icon: "fa-building" },
});

/* ── To'lov provayderi — uz.kassa.common.enums.PaymentProvider ──────────── */
export const PAYMENT_PROVIDER = dict("enum.provider", {
  MANUAL: { icon: "fa-hand-holding-dollar", tone: "neutral" },
  PAYME:  { icon: "fa-mobile-screen-button", tone: "info" },
  CLICK:  { icon: "fa-mobile-screen",        tone: "info" },
});

/* ── Do'kon xodimi roli — RoleType ───────────────────────────────────────── */
export const ROLE = dict("enum.role", {
  OWNER:       { hasShort: true, color: "var(--ek-role-owner)",   bg: "var(--ek-role-owner-bg)" },
  SHOP_ADMIN:  { hasShort: true, color: "var(--ek-role-admin)",   bg: "var(--ek-role-admin-bg)" },
  CASHIER:     { hasShort: true, color: "var(--ek-role-cashier)", bg: "var(--ek-role-cashier-bg)" },
  STOREKEEPER: { hasShort: true, color: "var(--ek-role-stock)",   bg: "var(--ek-role-stock-bg)" },
});

/* ── Tizim admini — AdminRole ────────────────────────────────────────────── */
export const ADMIN_ROLE = dict("enum.adminRole", {
  SUPER_ADMIN:   { icon: "fa-crown",   color: "var(--ek-role-superadmin)", bg: "var(--ek-role-superadmin-bg)" },
  SYSTEM_ADMIN:  { icon: "fa-server",  color: "var(--ek-role-admin)",      bg: "var(--ek-role-admin-bg)" },
  SUPPORT_ADMIN: { icon: "fa-headset", color: "var(--ek-role-cashier)",    bg: "var(--ek-role-cashier-bg)" },
  AUDITOR:       { icon: "fa-magnifying-glass-chart", color: "var(--ek-role-stock)", bg: "var(--ek-role-stock-bg)" },
});

/* ── Ombor holati — InventoryStatus ──────────────────────────────────────── */
export const INVENTORY_STATUS = dict("enum.inventory", {
  ACTIVE:  { tone: "success", icon: "fa-circle-check" },
  EXPIRED: { tone: "danger",  icon: "fa-triangle-exclamation" },
});

/* ── O'lchov birligi — UnitOfMeasure ─────────────────────────────────────────
   `decimals` — nechta kasr xonasi ma'noli. Backend'dagi qiymat bilan BIR XIL
   bo'lishi shart: kassa miqdor maydonini shu raqamga qarab chizadi (DONA'da
   kasr umuman kiritilmaydi, KG'da uch xona). */
export const UNIT = dict("enum.unit", {
  DONA:       { decimals: 0, icon: "fa-cube" },
  QUTI:       { decimals: 0, icon: "fa-box" },
  QOP:        { decimals: 0, icon: "fa-bag-shopping" },
  JUFT:       { decimals: 0, icon: "fa-shoe-prints" },
  RULON:      { decimals: 0, icon: "fa-scroll" },
  TO_PLAM:    { decimals: 0, icon: "fa-boxes-stacked" },
  KG:         { decimals: 3, icon: "fa-weight-scale" },
  GRAM:       { decimals: 0, icon: "fa-weight-hanging" },
  LITR:       { decimals: 3, icon: "fa-bottle-droplet" },
  MILLILITR:  { decimals: 0, icon: "fa-flask" },
  METR:       { decimals: 2, icon: "fa-ruler" },
  METR_KV:    { decimals: 3, icon: "fa-vector-square" },
  METR_KUB:   { decimals: 3, icon: "fa-cube" },
  SOAT:       { decimals: 2, icon: "fa-clock" },
});

/* ── Tovar yoki xizmat — ProductType ─────────────────────────────────────── */
export const PRODUCT_TYPE = dict("enum.productType", {
  GOODS:   { icon: "fa-box",       tone: "neutral" },
  SERVICE: { icon: "fa-handshake", tone: "info" },
});

/* ── Markirovka guruhi — MarkingGroup ("Asl Belgisi") ────────────────────── */
export const MARKING_GROUP = dict("enum.marking", {
  TAMAKI:          { icon: "fa-smoking",         tone: "warning" },
  ALKOGOL:         { icon: "fa-wine-bottle",     tone: "warning" },
  PIVO:            { icon: "fa-beer-mug-empty",  tone: "warning" },
  SUV_ICHIMLIK:    { icon: "fa-bottle-water",    tone: "warning" },
  DORI:            { icon: "fa-pills",           tone: "warning" },
  TIBBIY_VOSITA:   { icon: "fa-kit-medical",     tone: "warning" },
  OYOQ_KIYIM:      { icon: "fa-shoe-prints",     tone: "warning" },
  MAISHIY_TEXNIKA: { icon: "fa-plug",            tone: "warning" },
  ZARGARLIK:       { icon: "fa-gem",             tone: "warning" },
  YOG_MOY:         { icon: "fa-oil-can",         tone: "warning" },
  BOSHQA:          { icon: "fa-barcode",         tone: "warning" },
});

/* ── Faoliyat turi — BusinessType ────────────────────────────────────────── */
export const BUSINESS_TYPE = dict("enum.business", {
  GROCERY:      { icon: "fa-basket-shopping" },
  CONSTRUCTION: { icon: "fa-trowel-bricks" },
  CLOTHING:     { icon: "fa-shirt" },
  COSMETICS:    { icon: "fa-pump-soap" },
  STATIONERY:   { icon: "fa-pen" },
  ELECTRONICS:  { icon: "fa-tv" },
  AUTO_PARTS:   { icon: "fa-car" },
  SERVICE:      { icon: "fa-handshake" },
  OTHER:        { icon: "fa-store" },
});

/* ── Global katalog holati — GlobalProductStatus ─────────────────────────── */
export const GLOBAL_STATUS = dict("enum.globalStatus", {
  PENDING:  { tone: "warning", icon: "fa-hourglass-half" },
  VERIFIED: { tone: "success", icon: "fa-circle-check" },
  REJECTED: { tone: "danger",  icon: "fa-circle-xmark" },
});

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
 * qaytaradi: `PENDING_REVIEW` → `Pending review`. Foydalanuvchi hech qachon
 * `SNAKE_CASE` ko'rmaydi, hatto backend yangi qiymat qo'shsa ham.
 */
export function entry(d, value) {
  const key = normalize(value);
  if (!key) return { label: "—", tone: "neutral" };
  if (d[key]) return d[key];
  const readable = key.toLowerCase().replace(/_/g, " ");
  return { label: readable.charAt(0).toUpperCase() + readable.slice(1), tone: "neutral" };
}

/** Faqat matn kerak bo'lganda. */
export const label = (d, value) => entry(d, value).label;

/**
 * `<Select>` uchun tayyor ro'yxat: [{ value, label }].
 * ⚠ Natijani modul darajasida saqlab qo'ymang — til o'zgarsa eskiradi.
 * Har render'da qayta chaqiring (arzon).
 */
export const options = (d, only) =>
  (only || Object.keys(d)).map((k) => ({ value: k, label: d[k]?.label || k }));

/* Qulay qisqartmalar — chaqiruvchi kod lug'atni ikki marta yozmasin */
export const paymentLabel   = (v) => label(PAYMENT_TYPE, v);
export const paymentEntry   = (v) => entry(PAYMENT_TYPE, v);
export const saleStatus     = (v) => entry(SALE_STATUS, v);
export const transferStatus = (v) => entry(TRANSFER_STATUS, v);
export const shopStatus     = (v) => entry(SHOP_STATUS, v);
export const shopPlan       = (v) => entry(SHOP_PLAN, v);
export const paymentProvider= (v) => entry(PAYMENT_PROVIDER, v);
export const roleEntry      = (v) => entry(ROLE, v);
export const roleLabel      = (v) => entry(ROLE, v).label;
export const adminRole      = (v) => entry(ADMIN_ROLE, v);
export const inventoryState = (v) => entry(INVENTORY_STATUS, v);
export const unitEntry      = (v) => entry(UNIT, v);
export const unitLabel      = (v) => entry(UNIT, v).label;
export const productType    = (v) => entry(PRODUCT_TYPE, v);
export const markingGroup   = (v) => entry(MARKING_GROUP, v);
export const businessType   = (v) => entry(BUSINESS_TYPE, v);
export const globalStatus   = (v) => entry(GLOBAL_STATUS, v);

/**
 * Birlikdagi kasr xonalari soni.
 *
 * ⚠ Noma'lum birlik uchun 0 emas, 3 qaytariladi. Sabab: backend yangi
 * bo'linadigan birlik qo'shsa (masalan TONNA), eski front uni "butun son"
 * deb hisoblab kassirga 0.5 tonna sotishga yo'l bermay qo'yardi — ya'ni
 * xato SOTUVNI TO'SARDI. Ortiqcha aniqlik esa zararsiz: server baribir
 * o'z qoidasi bo'yicha yaxlitlaydi.
 */
export const unitDecimals = (v) => {
  const e = UNIT[normalize(v)];
  return e && typeof e.decimals === "number" ? e.decimals : 3;
};

/** Bir nechta rol kelganda (`user.roles` massivi) — vergul bilan. */
export const rolesLabel = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .map((r) => entry(ROLE, r).label)
    .filter(Boolean)
    .join(", ") || "—";
