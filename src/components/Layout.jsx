import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGO_URL, LOGO_DARK_URL, MARK_URL, initials } from "../utils";
import { roleLabel, unitDecimals, unitLabel } from "../lib/ek-labels";
import { hasRole, topRole, roleSet } from "../lib/ek-roles";
import { isMobileApp } from "../lib/ek-desktop";
import { setFullscreen, onFullscreenLeft } from "../lib/ek-fullscreen";
import { KEY_BY_ID, matches as keyMatches, keyLabel } from "../lib/ek-kassa-keys";
import { useT } from "../lib/ek-i18n";
import { weekdayDate, quantity } from "../lib/ek-format";
import { useSuspiciousCount } from "../hooks/useSuspiciousCount";
import { useBreezzPending } from "../hooks/useBreezzPending";
import { BREEZZ_UI } from "../config";
import { useShopFeatures } from "../hooks/useShopFeatures";


/* ══════════════════════════════════════════════════════════════════════════
   MENYU — GURUHLANGAN (2026-08-20)

   Ilgari yon menyuda 5 bo'lim va 21 ta band turardi, faqat «Do'kon» ning
   o'zida 9 tasi. Bunday ro'yxatda ko'z kerakli bandni o'qib emas, QIDIRIB
   topadi — va har yangi sahifa uni yana bir qator uzaytirardi.

   Endi o'xshash sahifalar bitta bandga yig'ilgan va o'zaro tab bilan
   almashadi (`children`). Yon menyuda 8 ta band qoldi.

   ⚠ YO'LLAR O'ZGARMADI. Har sahifa o'z manzilida turibdi (`/prices`,
   `/supply`, …) — saqlangan havolalar, brauzer tarixi va koddagi
   `navigate()` chaqiruvlari ishlayveradi. Guruh — FAQAT ko'rinish qatlami,
   marshrutlar `App.jsx` da tegilmagan.

   ⚠ Guruh bandining havolasi — uning KO'RINADIGAN birinchi bolasi. Filtr
   bolalarga qo'llanadi: omborchida «Katalog» ichida «Narxlar» yo'q, shu
   sababli band uni `/products` ga olib boradi, bo'sh guruh esa umuman
   chizilmaydi.

   ⚠ Bandning YORLIG'I emas, KALITI saqlanadi — yorliq har render'da `t()`
   dan olinadi, aks holda til almashtirilganda menyu eski tilda qolardi.
   ══════════════════════════════════════════════════════════════════════════ */
export const NAV = [
  { id: "dashboard", path: "/",     key: "nav.dashboard", icon: "fa-chart-pie",     roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
  { id: "sale",      path: "/sale", key: "nav.kassa",     icon: "fa-cash-register", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  /* KATALOG — tovarning O'ZI haqidagi ma'lumot: nomi, turkumi, narxi.
     Miqdor bu yerda emas: u «Ombor» ning ishi. */
  { id: "catalog", key: "nav.group.catalog", icon: "fa-box", children: [
    { id: "products",   path: "/products",   key: "nav.products",   icon: "fa-box",                roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "categories", path: "/categories", key: "nav.categories", icon: "fa-tags",               roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "labels", path: "/labels", key: "nav.labels", icon: "fa-tag",                       roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "prices",     path: "/prices",     key: "nav.prices",     icon: "fa-money-check-dollar", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
  ]},

  /* OMBOR — tovarning MIQDORINI qo'zg'atadigan ishlar. Ko'chirish ham shu
     yerda: u tovarni jismonan yuradigan kundalik ish, filial sozlamasi
     emas (filiali yo'q do'konda sahifa o'zi shuni aytadi). */
  { id: "warehouse", key: "nav.group.warehouse", icon: "fa-warehouse", children: [
    { id: "inventory",  path: "/inventory",  key: "nav.stock",     icon: "fa-warehouse",      roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "INVENTORY" },
    { id: "stock-take", path: "/stock-take", key: "nav.stockTake", icon: "fa-clipboard-list", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "STOCK_TAKE" },
    { id: "supply",     path: "/supply",     key: "nav.supply",    icon: "fa-truck-ramp-box", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "SUPPLY" },
    { id: "transfers",  path: "/transfers",  key: "nav.transfers", icon: "fa-truck-fast",     roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "TRANSFER" },
    /* Berib yuborish — omborchining KUNDALIK ekrani, shuning uchun
       ombor guruhida turadi. */
    { id: "pickup",     path: "/pickup",     key: "nav.pickup",    icon: "fa-dolly",          roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "PICKUP" },
  ]},

  /* SAVDO — bo'lib o'tgan xarid va uni kim qilgani. Kassirga ochiq yagona
     guruh: u chekni qaytadan chiqaradi va mijozni qidiradi. */
  { id: "trade", key: "nav.group.trade", icon: "fa-receipt", children: [
    { id: "sales",     path: "/sales",     key: "nav.sales",     icon: "fa-receipt", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
    { id: "customers", path: "/customers", key: "nav.customers", icon: "fa-users",   roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"], feature: "CUSTOMERS" },
  ]},

  { id: "reports", key: "nav.reports", icon: "fa-chart-bar", children: [
    { id: "reports-main",  path: "/reports",       key: "nav.overview",     icon: "fa-chart-bar",       roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "REPORTS" },
    { id: "expenses",      path: "/expenses",      key: "nav.expenses",     icon: "fa-money-bill-wave", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "EXPENSES" },
    /* Mahsulot hisoboti (2026-10-05) — «Maxsus hisobot» o'rnida. U sahifa
       «Umumiy» dagi «O'z oralig'i» davrining to'liq takrori edi; endi
       `/custom-report` shu yerga yo'naltiriladi (App.jsx). */
    /* Kunlik hisobot (2026-10-09) — bir kun, har tovarning butun harakati. */
    { id: "day-report", path: "/reports/day", key: "nav.dayReport", icon: "fa-calendar-day", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "REPORTS" },
    { id: "product-report", path: "/reports/product", key: "nav.productReport", icon: "fa-magnifying-glass-chart", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "REPORTS" },
  ]},

  /* BOSHQARUV — DO'KONNI boshqarish, egasi va do'kon admini uchun.
     07-ADMIN.md aytadigan «egasi paneli» aynan shu, alohida sayt emas.

     Sodiqlik bu yerda: u chegirma jadvali, ya'ni PULGA tegadigan sozlama.
     Aksiyalar ham: bitta bosishda minglab telefonga push ketadi.

     ⚠ Bu FAQAT ko'rinish tartibi. Haqiqiy ruxsat serverda:
     `SecurityConfig` `/shop/users/**` va `/shop/branches/**` ni alohida
     tekshiradi. Xavfsizlikka SHOP_ADMIN ham kiradi, lekin bajik chiqarish
     faqat egasida — buni ham server qo'yadi. */
  { id: "manage", key: "nav.group.manage", icon: "fa-users-gear", children: [
    { id: "shop-users",    path: "/shop-users",    key: "nav.staff",         icon: "fa-users-gear",        roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "branches",      path: "/branches",      key: "nav.branches",      icon: "fa-store",             roles: ["OWNER"] },
    /* Breezz (V140) — tasdiq faqat egasida, shuning uchun band ham faqat unda.
       ⏸ Vaqtincha yashirin (`BREEZZ_UI`, config.js). */
    ...(BREEZZ_UI
      ? [{ id: "breezz",   path: "/breezz",        key: "nav.breezz",        icon: "fa-plug",              roles: ["OWNER"] }]
      : []),
    { id: "loyalty",       path: "/loyalty",       key: "nav.loyalty",       icon: "fa-award",             roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "LOYALTY" },
    { id: "announcements", path: "/announcements", key: "nav.announcements", icon: "fa-bullhorn",          roles: ["ADMIN", "SHOP_ADMIN", "OWNER"], feature: "ANNOUNCEMENTS" },
    { id: "security",      path: "/security",      key: "nav.security",      icon: "fa-shield-halved",     roles: ["SHOP_ADMIN", "OWNER"] },
    { id: "audit",         path: "/audit",         key: "nav.audit",         icon: "fa-clock-rotate-left", roles: ["SHOP_ADMIN", "OWNER"] },
  ]},

  /* Sozlamalar — HAMMA rolga ochiq: til va tema shu yerda va ular
     xodimning shaxsiy tanlovi, do'kon sozlamasi emas. */
  { id: "settings", path: "/settings", key: "nav.settings", icon: "fa-gear" },
];

/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN MENYUSI — ALOHIDA ILOVA (4-bosqich E1, 2026-10-10)

   Egasi: «restoran bo'limi baribir do'konlarga o'xshab qolyapti — umuman
   yaqin bo'lmasin; restoran bo'lsa mutlaqo boshqa oyna ishlasin».
   Restoran yo'nalishli joyda yon menyu BUTUNLAY shu ro'yxatdan quriladi:
   do'konning «Katalog / Ombor / Savdo» guruhlari umuman chizilmaydi.

   ⚠ Ikki bo'lim — `section` (sarlavha): XIZMAT (zalda har kuni ishlaydigan
   joylar) va BOSHQARUV (menejer va egasi). Prototip:
   docs/22-RESTORAN.md, 4-bosqich.

   ⚠ Ba'zi bandlar hozircha mavjud sahifaga olib boradi (taomlar —
   `/products`, masalliq qoldig'i — `/inventory`, buyurtmalar — `/sales`):
   ular E2–E7 da restoranning o'z sahifasi bilan almashadi. Menyuda nomi
   va o'rni allaqachon restoranniki — keyin faqat sahifa almashadi.
   ══════════════════════════════════════════════════════════════════════════ */
const MGR = ["ADMIN", "SHOP_ADMIN", "OWNER"];
export const RESTAURANT_NAV = [
  { id: "r-hall",    section: "rnav.sec.service", path: "/restaurant", key: "rnav.hall",    icon: "fa-utensils",      roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "WAITER", "OWNER"], feature: "TABLES" },
  { id: "r-kitchen", path: "/kitchen",    key: "rnav.kitchen", icon: "fa-fire-burner",   roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "WAITER", "COOK", "OWNER"], feature: "KITCHEN" },
  { id: "r-orders",  path: "/sales",      key: "rnav.orders",  icon: "fa-receipt",       roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  { id: "r-till",    path: "/sale",       key: "rnav.till",    icon: "fa-cash-register", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  { id: "r-guests",  path: "/customers",  key: "rnav.guests",  icon: "fa-users",         roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"], feature: "CUSTOMERS" },

  { id: "r-today",   section: "rnav.sec.manage", path: "/", key: "rnav.today", icon: "fa-chart-simple", roles: MGR },
  { id: "r-menu", key: "rnav.menu", icon: "fa-book-open", children: [
    { id: "r-dishes",   path: "/products",   key: "rnav.dishes",   icon: "fa-bowl-food",           roles: MGR },
    { id: "r-sections", path: "/categories", key: "rnav.sections", icon: "fa-layer-group",         roles: MGR },
    { id: "r-mods",     path: "/modifiers",  key: "nav.modifiers", icon: "fa-plus",                roles: MGR, feature: "MODIFIERS" },
    { id: "r-prices",   path: "/prices",     key: "rnav.prices",   icon: "fa-money-check-dollar",  roles: MGR },
  ]},
  { id: "r-stock", key: "rnav.stock", icon: "fa-carrot", children: [
    { id: "inventory",    path: "/inventory",  key: "rnav.stockLeft", icon: "fa-carrot",          roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "INVENTORY" },
    { id: "r-supply",     path: "/supply",     key: "rnav.supply",    icon: "fa-truck-ramp-box",  roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "SUPPLY" },
    { id: "r-count",      path: "/stock-take", key: "rnav.count",     icon: "fa-clipboard-list",  roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "STOCK_TAKE" },
    { id: "r-transfers",  path: "/transfers",  key: "nav.transfers",  icon: "fa-truck-fast",      roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"], feature: "TRANSFER" },
  ]},
  { id: "r-reports", key: "rnav.reports", icon: "fa-chart-column", children: [
    { id: "r-rep-main", path: "/reports",     key: "nav.overview",  icon: "fa-chart-column",     roles: MGR, feature: "REPORTS" },
    { id: "r-rep-day",  path: "/reports/day", key: "nav.dayReport", icon: "fa-calendar-day",     roles: MGR, feature: "REPORTS" },
    { id: "r-expenses", path: "/expenses",    key: "nav.expenses",  icon: "fa-money-bill-wave",  roles: MGR, feature: "EXPENSES" },
  ]},
  { id: "r-staff", key: "rnav.staff", icon: "fa-user-group", children: [
    { id: "r-users",  path: "/shop-users", key: "rnav.staff",   icon: "fa-user-group",         roles: MGR },
    { id: "security", path: "/security",   key: "nav.security", icon: "fa-shield-halved",      roles: ["SHOP_ADMIN", "OWNER"] },
    { id: "r-audit",  path: "/audit",      key: "nav.audit",    icon: "fa-clock-rotate-left",  roles: ["SHOP_ADMIN", "OWNER"] },
  ]},
  { id: "r-setup", key: "nav.settings", icon: "fa-gear", children: [
    { id: "r-tables",   path: "/tables-setup", key: "nav.tables",   icon: "fa-chair",  roles: MGR, feature: "TABLES" },
    { id: "r-branches", path: "/branches",     key: "nav.branches", icon: "fa-store",  roles: ["OWNER"] },
    { id: "r-settings", path: "/settings",     key: "nav.settings", icon: "fa-gear" },
  ]},
];

/**
 * Restoranda OCHILMAYDIGAN do'kon sahifalari — manzil qo'lda yozilsa ham
 * bosh sahifaga qaytadi (`App.jsx`). Restoranda bu ishlarning o'zi yo'q:
 * omborchining berib yuborish navbati, javon yorliqlari, aksiyalar, Breezz.
 */
export const STORE_ONLY_PATHS = ["/pickup", "/labels", "/loyalty", "/announcements", "/breezz"];

/** Guruhning bolalari; oddiy band — o'zi bitta bola. */
const childrenOf = (item) => item.children || [item];

/* ══════════════════════════════════════════════════════════════════════════
   IKKI FILTR: ROL va MODUL (V49)

   Ular BOSHQA-BOSHQA savolga javob beradi va ikkalasi ham kerak:

     `roles`   — SHU ODAM qila oladimi. Kassir «Xarajatlar» ni ko'rmaydi,
                 chunki bu rahbarning ma'lumoti.
     `feature` — BU DO'KONDA bunday ish umuman bormi. Sartaroshxonada
                 «Inventarizatsiya» yo'q — u yerda hech kimga ko'rinmaydi,
                 egasiga ham.

   ⚠ `feature` siz bandlar HAR DOIM ko'rinadi: kassa, mahsulotlar,
   sotuvlar tarixi, xodimlar, sozlamalar. Ularsiz ilova ilova bo'lmaydi.

   ⚠ Modul ro'yxati kelmagan bo'lsa hammasi ko'rinadi — sabab
   `useShopFeatures` da: bu ro'yxat himoya emas, haqiqiy to'siq serverda.
   ══════════════════════════════════════════════════════════════════════════ */
const visibleChildren = (item, role, hasFeature = () => true) =>
  childrenOf(item).filter((c) => hasRole(role, c.roles) && hasFeature(c.feature));

/**
 * Manzil qaysi guruhning qaysi sahifasi.
 *
 * ⚠ `PAGE_TITLES` jadvali OLIB TASHLANDI. U shu ro'yxat bilan qo'lda
 * sinxron turishi kerak edi va bir marta `/security` unutilgani uchun
 * sahifa tepasida «Dashboard» deb yozilib turgan edi. Endi sarlavha ham,
 * tab qatori ham AYNAN shu yagona ro'yxatdan chiqadi.
 */
function findPlace(pathname, NAV) {
  for (const item of NAV) {
    const child = childrenOf(item).find((c) => c.path === pathname);
    if (child) return { group: item, child };
  }

  /* ⚠ ICHKI SAHIFALAR (V60). `/inventory/5` kabi yo'llar `NAV` da yo'q va
     ilgari ular BOSH SAHIFA deb hisoblanardi: partiyalar sahifasi
     ochilganda sarlavhada «Dashboard» yozilib, menyuda ham boshqa band
     yonardi. Endi eng UZUN mos keluvchi ota-yo'l olinadi. */
  let best = null;
  for (const item of NAV) {
    for (const c of childrenOf(item)) {
      if (!c.path || c.path === "/") continue;
      if (pathname.startsWith(c.path + "/")
          && (!best || c.path.length > best.child.path.length)) {
        best = { group: item, child: c };
      }
    }
  }
  if (best) return best;

  /* Noma'lum yo'l — bosh sahifa (eski xatti-harakat) */
  return { group: NAV[0], child: NAV[0] };
}

/* Bo'limda e'tibor talab qiladigan yozuv borligini bildiruvchi son.
   Guruh bandida ham, uning ichidagi tab'da ham AYNI raqam chiqadi: usiz
   egasi menyudagi qizil sonni ko'rib guruhga kirardi-yu, keyin tab'lar
   orasidan qay birida ekanini qidirishga majbur bo'lardi. */
const badgeFor = (id, { lowStock, suspicious, breezz = 0 }) => {
  if (id === "warehouse" || id === "inventory" || id === "r-stock") return lowStock;
  /* «Boshqaruv» guruhi — ikkala sababning yig'indisi: egasi guruhga
     kirgach qaysi tab'da ekanini tab'dagi sondan ko'radi. */
  if (id === "manage") return suspicious + breezz;
  if (id === "r-staff") return suspicious;
  if (id === "security") return suspicious;
  if (id === "breezz") return breezz;
  return 0;
};

/* Rol nomi — lug'atdan. SUPERADMIN va ADMIN do'kon roli emas: birinchisi
   tizim admini, ikkinchisi eski nom. Shuning uchun alohida kalitlar. */
const EXTRA_ROLE_KEYS = {
  SUPERADMIN: "enum.adminRole.SUPER_ADMIN",
  ADMIN:      "enum.role.SHOP_ADMIN",
};

function LowStockBadge({ items, count, onGoInventory }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Kam qoldiq — yorliq BIR MARTA pulsatsiya qiladi. Miltillash yo'q (03-MOTION.md).
  useEffect(() => {
    if (!count) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 460);
    return () => clearTimeout(t);
  }, [count]);

  if (!count) return null;
  return (
    <div style={{ position: "relative" }}>
      <button
        className={pulse ? "ek-pulse-once" : ""}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 34, background: "var(--bg-warning-subtle)", border: "1.5px solid var(--border-warning)", borderRadius: 20, padding: "5px 12px 5px 9px", cursor: "pointer", fontFamily: "inherit" }}
      >
        <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--fg-warning)", fontSize: 13 }} aria-hidden="true" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-warning)" }}>
          {t("layout.lowStockBadge", { n: count })}
        </span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div className="ek-dialog" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--bg-surface)", borderRadius: "var(--r-xl)", minWidth: 300, boxShadow: "var(--sh-lg)", border: "1px solid var(--border-warning)", zIndex: 300, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "var(--bg-warning-subtle)", borderBottom: "1px solid var(--border-warning)", fontWeight: 700, fontSize: 13, color: "var(--fg-warning)" }}>{t("layout.lowStockTitle")}</div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.productName}</span>
                  <span className="ek-num" style={{ fontWeight: 700, color: "var(--fg-warning)" }}>{quantity(item.quantity, unitDecimals(item.unit))} {unitLabel(item.unit)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 10 }}>
              <button className="btn btn-full" onClick={() => { onGoInventory(); setOpen(false); }} style={{ background: "var(--bg-warning)", color: "var(--ek-ink-950)" }}>{t("layout.lowStockGo")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Sidebar({ user, open, onClose, isCollapsed, onToggleCollapse, lowStockCount, suspiciousCount, breezzCount, onSwitchUser, nav, restaurant }) {
  const { t } = useT();
  /* Do'konda qaysi bo'limlar borligi (V49). Ro'yxat kelmaguncha
     `has()` hamma narsaga `true` qaytaradi — menyu bo'sh ko'rinmaydi. */
  const { has: hasFeature } = useShopFeatures();
  /* Guruh bandi o'z bolalaridan birortasida turgan bo'lsa yonadi — shuning
     uchun bu yerda joriy manzil kerak (NavLink ning isActive i yetmaydi). */
  const { pathname } = useLocation();
  // Yorliqda BITTA rol ko'rsatiladi — ierarxiyadagi eng yuqorisi.
  // "SHOP_ADMIN,CASHIER" deb yozib qo'yish foydalanuvchiga hech narsa
  // bermaydi va tarjima qilinmagan holda chiqardi.
  const roleName = (r) => {
    const top = topRole(r);
    const key = EXTRA_ROLE_KEYS[top];
    return key ? t(key) : roleLabel(top);
  };
  return (
    <aside className={`sidebar ${open ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sb-logo">
        <div className="sb-logo-inner">
          {isCollapsed ? (
            <img src={MARK_URL} alt="e-Kassam" />
          ) : (
            <>
              {/* Ikkala variant ham turadi, CSS keraksizini yashiradi —
                  lockup so'z belgisi to'q siyoh rangida va qorong'i fonda
                  ko'rinmay qolardi. */}
              <img className="logo--light" src={LOGO_URL} alt="e-Kassam" />
              <img className="logo--dark" src={LOGO_DARK_URL} alt="" aria-hidden="true" />
            </>
          )}
        </div>
        {/* Restoran — alohida ilova: logotip ostida nomi (yangi CSS yo'q, 44/44). */}
        {restaurant && !isCollapsed && (
          <span style={{ display: "block", marginTop: 4, fontFamily: "Manrope, var(--font-sans)", fontWeight: 800, fontSize: 14, color: "var(--fg-brand)" }}>
            Restaurant
          </span>
        )}
      </div>
      <button className="sb-toggle" onClick={onToggleCollapse}
              aria-label={isCollapsed ? t("nav.expand") : t("nav.collapse")}
              title={isCollapsed ? t("nav.expand") : t("nav.collapse")}>
        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`} />
      </button>
      <nav className="sb-nav">
        {nav.map((item) => {
          // ⚠ Tekshiruv TO'PLAM bo'yicha. Ilgari bu yerda
          // `item.roles.includes(userRole)` turardi va `userRole` — sessiyadagi
          // BUTUN satr. Xodimda ikkita rol bo'lsa u `"SHOP_ADMIN,CASHIER"`
          // bo'lardi, hech bir ro'yxatga mos kelmasdi va yon menyuda faqat
          // «Sozlamalar» qolardi. OWNER uchun istisno `hasRole` ichida.
          const kids = visibleChildren(item, user?.role, hasFeature);
          if (kids.length === 0) return null;

          /* Guruh havolasi — ko'rinadigan BIRINCHI bola. Guruhning o'z
             manzili yo'q: yangi yo'l ochish `App.jsx` ni ham, saqlangan
             havolalarni ham qayta ishlashni talab qilardi. */
          const to = item.path || kids[0].path;
          /* ⚠ `NavLink` ning o'z `isActive` i yaramaydi: u faqat `to`
             bilan solishtiradi va «Ombor» dan «Kirim» ga o'tilganda band
             o'chib qolardi. Guruh o'z bolalaridan BIRORTASIDA turgan
             bo'lsa yonib turishi kerak. */
          const active = kids.some((c) => c.path === pathname);
          const badge = badgeFor(item.id, { lowStock: lowStockCount, suspicious: suspiciousCount, breezz: breezzCount });

          const link = (
            <NavLink key={item.id} to={to} title={isCollapsed ? t(item.key) : ""} onClick={() => onClose()}
                     className={`sb-item ${active ? "active" : ""}`}>
              <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
              <span className="sb-label">{t(item.key)}</span>
              {badge > 0 && <span className="badge badge-red sb-badge" style={{ marginLeft: "auto" }}>{badge}</span>}
            </NavLink>
          );
          /* Restoran menyusida bo'lim sarlavhasi («Xizmat», «Boshqaruv»). */
          if (!item.section || isCollapsed) return link;
          return [
            <span key={item.id + "-sec"} style={{ display: "block", padding: "12px 12px 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-secondary)" }}>
              {t(item.section)}
            </span>,
            link,
          ];
        })}
      </nav>
      {/* Tema tanlagichi bu yerdan OLIB TASHLANDI: barcha sozlamalar endi
          «Sozlamalar» sahifasida — bitta joy, bitta qidiruv. */}
      <div className="sb-footer">
        {/* ⚠ CHIQISH TUGMASI BU YERDAN OLIB TASHLANDI (2026-08-27).

            U kassirning ismi ustida turardi va butun blok bosiladigan edi:
            yon menyu yopilayotganda yoki sichqoncha sirg'anganda tizimdan
            chiqib ketish uchun bitta noto'g'ri bosish yetardi. Kassada bu
            terilgan savatni, ochiq smenani va mijozning vaqtini
            yo'qotishga teng.

            Chiqish endi FAQAT «Sozlamalar» sahifasida — ataylab
            boriladigan, tasodifan bosilmaydigan joyda. Shu sababli bu
            blok endi o'sha sahifaga olib boradi: kassir «chiqish qayerda?»
            deb qidirib qolmasin. */}
        <div className="sb-user-row">
          <NavLink to="/settings" className="sb-user" title={isCollapsed ? t("nav.settings") : ""}>
            <div className="av" style={{ width: isCollapsed ? 28 : 34, height: isCollapsed ? 28 : 34 }}>{initials(user?.fullName || user?.username)}</div>
            <div className="sb-user-info">
              <div className="sb-user-name">{user?.fullName || user?.username}</div>
              <div className="sb-user-role">{roleName(user?.role)} <i className="fa-solid fa-gear" /></div>
            </div>
          </NavLink>

          {/* ══ KASSIRNI ALMASHTIRISH (V99) ═══════════════════════════
              ⚠ ALOHIDA, KICHIK tugma — hisob blokining ICHIDA emas.
              Blokning o'zi «Sozlamalar» ga olib boradi va uni bosishga
              odatlangan kassir tasodifan almashtirish oynasini ochib
              yuborardi.

              ⚠ CHIQISHNING O'RNIGA EMAS, YONIDA. Bular boshqa-boshqa
              ish: chiqish smenani ham, savatni ham tashlab ketadi,
              almashtirish esa ikkalasini ham JOYIDA qoldiradi —
              butun ishning ma'nosi shunda. */}
          {!isCollapsed && (
            <button type="button" className="sb-switch" onClick={onSwitchUser}
                    title={t("pin.switchTitle")} aria-label={t("pin.switchTitle")}>
              <i className="fa-solid fa-user-clock" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ user, isAdmin, lowStockItems, lowStockCount, onSwitchUser, children }) {
  /* ⚠ Sidebar bilan BIR XIL manba: hook natijani keshlaydi, ya'ni
     ikkinchi chaqiruv yangi so'rov yubormaydi. Tab qatori va yon menyu
     bir xil ro'yxatdan chizilishi shart — aks holda menyuda yo'q
     sahifa tab'da paydo bo'lardi. */
  const { has: hasFeature, isRestaurant } = useShopFeatures();
  /* ⚠ Restoran — BOSHQA menyu (E1): do'kon guruhlari umuman chizilmaydi. */
  const nav = isRestaurant ? RESTAURANT_NAV : NAV;
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sb_collapsed") === "1");
  const [kassaFullscreen, setKassaFullscreen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  /* ⚠ Hisob SHU YERDA olinadi va yon menyuga prop bilan uzatiladi: hook
     ikkinchi marta chaqirilsa server IKKI BAROBAR ko'p so'rov olardi
     (har 2 daqiqada va har sahifa almashganda). */
  const { count: suspiciousCount } = useSuspiciousCount(user);
  const breezzCount = useBreezzPending(user);
  
  const toggleCollapse = () => {
    setIsCollapsed(p => {
      const v = !p;
      localStorage.setItem("sb_collapsed", v ? "1" : "0");
      return v;
    });
  };

  const isKassaPage = location.pathname === "/sale";

  /* ══ TO'LIQ EKRAN ══════════════════════════════════════════════════
     Rejim ikki qatlamdan iborat: ilovaning o'z yon menyusi va sarlavhasi
     yashiriladi (CSS), ekranning o'zi esa haqiqatan to'liq ekranga
     o'tadi (`ek-fullscreen.js`). Ilgari FAQAT birinchisi bor edi va
     kassir tepada brauzerning manzil qatorini ko'rib turardi.

     ⚠ HAQIQIY to'liq ekran SHU YERDA so'raladi, `useEffect` da EMAS.
     Brauzer `requestFullscreen()` ni faqat foydalanuvchi harakatining
     ichida bajaradi; effekt esa keyinroq va alohida chaqiriladi —
     u yerdan so'ralgani JIMGINA rad etilardi. */
  const applyFullscreen = (on) => { setKassaFullscreen(on); setFullscreen(on); };
  const toggleKassaFullscreen = () => applyFullscreen(!kassaFullscreen);

  // Boshqa sahifaga o'tganda fullscreen dan chiqish
  if (!isKassaPage && kassaFullscreen) setKassaFullscreen(false);

  /* Yuqoridagi qator holatni render paytida tushiradi (sahifa bir lahza
     ham menyusiz chizilmasin uchun), ekranni esa shu effekt qaytaradi.
     Chiqishga foydalanuvchi harakati talab qilinmaydi — faqat kirishga. */
  useEffect(() => { if (!kassaFullscreen) setFullscreen(false); }, [kassaFullscreen]);

  /* ⚠ F11 FAQAT KASSA SAHIFASIDA tortib olinadi. Boshqa sahifalarda
     rejim yo'q va tugmani brauzerdan olishning ma'nosi ham yo'q —
     hisobot ko'rayotgan egasi F11 ni bosganda odatdagi natijani kutadi.
     Yorliqning o'zi `ek-kassa-keys.js` jadvalidan: yordam oynasi ham
     shu jadvaldan chiziladi, ya'ni ikkalasi hech qachon ajralmaydi. */
  useEffect(() => {
    if (!isKassaPage) return;
    const onKey = (e) => {
      if (!keyMatches(e, KEY_BY_ID.fullscreen.combo)) return;
      e.preventDefault();
      applyFullscreen(!kassaFullscreen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isKassaPage, kassaFullscreen]);

  /* Brauzer to'liq ekrandan O'ZI chiqarsa (Esc yoki brauzer tugmasi) —
     yon menyuni qaytaramiz. Aks holda ekran oddiy holatga qaytgan-u,
     ilova hamon «to'liq ekran» deb o'ylab turardi va kassir menyusiz
     qolardi. */
  useEffect(() => onFullscreenLeft(() => setKassaFullscreen(false)), []);

  /* Sarlavha ham, tab qatori ham YAGONA `NAV` ro'yxatidan chiqadi —
     ilgari buning uchun alohida `PAGE_TITLES` jadvali bor edi va u
     ro'yxat bilan qo'lda sinxron turishi kerak edi. */
  const { group, child } = findPlace(location.pathname, nav);
  const tabs = visibleChildren(group, user?.role, hasFeature);

  // Children ga kassaFullscreen props ni uzatish
  const enhancedChildren = isKassaPage
    ? (typeof children?.type === 'function' || children?.type?.$$typeof)
      ? children
      : children
    : children;

  return (
    <div className={`app-layout ${isCollapsed ? "collapsed" : ""} ${kassaFullscreen || location.pathname.startsWith("/restaurant") || location.pathname.startsWith("/kitchen") ? "kassa-fullscreen" : ""}`}>
      {open && <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:199 }} />}
      <Sidebar 
        user={user} 
        open={open} 
        onClose={() => setOpen(false)} 
        isCollapsed={isCollapsed} 
        onToggleCollapse={toggleCollapse} 
        lowStockCount={lowStockCount}
        suspiciousCount={suspiciousCount}
        breezzCount={breezzCount}
        onSwitchUser={onSwitchUser}
        nav={nav}
        restaurant={isRestaurant}
      />
      <main className="main-content">
        <div className="topbar">
          <button className="btn-icon ham-btn" onClick={() => setOpen(v => !v)}
                  aria-label={t("layout.menu")} aria-expanded={open}><i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" /></button>
          <span className="topbar-title"><i className={`fa-solid ${group.icon}`} aria-hidden="true" /> {t(group.key)}</span>
          {/* Telefon ilovasida egasi «To'liq panel»dan NAZORAT paneliga
              qaytadi (bayroqni App.jsx o'qiydi — reload yetarli). */}
          {isMobileApp() && (roleSet(user?.role).has("OWNER") || roleSet(user?.role).has("SHOP_ADMIN")) && (
            <button className="btn btn-sm" onClick={() => { localStorage.removeItem("ek_mobileFull"); window.location.reload(); }}>
              <i className="fa-solid fa-gauge-high" aria-hidden="true" /> {t("m.controlPanel")}
            </button>
          )}
          {isKassaPage && (
            <button className="btn btn-sm kassa-fs-topbar-btn" onClick={toggleKassaFullscreen}
                    title={`${t("layout.fullscreen")} (${keyLabel("fullscreen")})`}>
              <i className="fa-solid fa-expand" aria-hidden="true" /> {t("layout.fullscreen")}
            </button>
          )}
          <LowStockBadge items={lowStockItems || []} count={lowStockCount || 0} onGoInventory={() => navigate("/inventory")} />
          {/* Sana `ek-format` dan — `toLocaleDateString("uz-UZ")` brauzerga qarab
              turlicha chiqadi va tilga ergashmaydi (02-DESIGN-SYSTEM.md). */}
          <span className="topbar-date ek-num"><i className="fa-regular fa-clock" aria-hidden="true" /> {weekdayDate()}</span>
        </div>
        {/* ── Guruh ichidagi sahifalar ────────────────────────────────────
            Yon menyu 8 bandga tushgani uchun guruhning qolgan sahifalari
            AYNAN shu qatorda ochiladi. Ko'rinishi sahifa ichidagi tab'lar
            bilan bir xil (`btn btn-sm` + `btn-primary`/`btn-outline`) —
            Xavfsizlik sahifasidagi qolip, foydalanuvchi uni allaqachon
            biladi.

            ⚠ Bitta sahifali guruhda qator UMUMAN chizilmaydi: yolg'iz
            tab hech qayerga olib bormaydi va faqat joy egallaydi
            (kassirda «Savdo» dan bittasi qolishi mumkin). */}
        {tabs.length > 1 && (
          <div className="pg-tabs" role="tablist">
            {tabs.map((c) => {
              const badge = badgeFor(c.id, { lowStock: lowStockCount, suspicious: suspiciousCount, breezz: breezzCount });
              return (
                <NavLink key={c.id} to={c.path} role="tab"
                         aria-selected={c.path === child.path}
                         className={`btn btn-sm ${c.path === child.path ? "btn-primary" : "btn-outline"}`}>
                  <i className={`fa-solid ${c.icon}`} aria-hidden="true" /> {t(c.key)}
                  {badge > 0 && <span className="badge badge-red tab-badge">{badge}</span>}
                </NavLink>
              );
            })}
          </div>
        )}
        {/* Sahifa o'tishi — FAQAT opacity, 140ms. Siljish yo'q: POS'da chalg'itadi. */}
        <div className="page-content ek-page-in" key={location.pathname}>
          {children}
        </div>
      </main>

      {/* Kassa fullscreen exit button */}
      {kassaFullscreen && (
        <button className="kassa-fs-exit" onClick={toggleKassaFullscreen}
                title={`${t("layout.fullscreenExit")} (${keyLabel("fullscreen")})`}
                aria-label={t("layout.fullscreenExit")}>
          <i className="fa-solid fa-compress" />
        </button>
      )}
    </div>
  );
}
