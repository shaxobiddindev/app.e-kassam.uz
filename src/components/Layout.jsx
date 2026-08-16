import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGO_URL, LOGO_DARK_URL, MARK_URL, initials } from "../utils";
import { useConfirm } from "../context/ConfirmProvider";
import { roleLabel } from "../lib/ek-labels";
import { hasRole, topRole, roleSet } from "../lib/ek-roles";
import { isMobileApp } from "../lib/ek-desktop";
import { useT } from "../lib/ek-i18n";
import { weekdayDate } from "../lib/ek-format";
import { useSuspiciousCount } from "../hooks/useSuspiciousCount";


/* Menyu tuzilishi — YORLIQ EMAS, KALIT saqlanadi. Yorliq har render'da
   `t()` dan olinadi, aks holda til almashtirilganda menyu eski tilda qolardi. */
const NAV_ITEMS = [
  { section: "nav.section.main", items: [
    { id: "dashboard", path: "/",      key: "nav.dashboard", icon: "fa-chart-pie",     roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "sale",      path: "/sale",  key: "nav.kassa",     icon: "fa-cash-register", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "nav.section.shop", items: [
    { id: "products",   path: "/products",   key: "nav.products",   icon: "fa-box",       roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "categories", path: "/categories", key: "nav.categories", icon: "fa-tags",      roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "inventory",  path: "/inventory",  key: "nav.inventory",  icon: "fa-warehouse", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "stock-take", path: "/stock-take", key: "nav.stockTake",  icon: "fa-clipboard-list", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "supply",     path: "/supply",     key: "nav.supply",     icon: "fa-truck-ramp-box", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    /* Ko'chirish — OMBOR bo'limida, «Boshqaruv» da emas: bu tovarni
       jismonan qo'zg'atadigan kundalik ish, filial sozlamasi emas.
       Filiali yo'q do'konda sahifa o'zi nima qilish kerakligini aytadi. */
    { id: "transfers",  path: "/transfers",  key: "nav.transfers",  icon: "fa-truck-fast", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "prices",     path: "/prices",     key: "nav.prices",     icon: "fa-tags", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "customers",  path: "/customers",  key: "nav.customers",  icon: "fa-users",     roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
    { id: "sales",      path: "/sales",      key: "nav.sales",      icon: "fa-receipt",   roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "nav.section.reports", items: [
    { id: "reports",        path: "/reports",       key: "nav.reports",      icon: "fa-chart-bar",     roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "expenses",       path: "/expenses",      key: "nav.expenses",     icon: "fa-money-bill-wave", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "custom-report",  path: "/custom-report", key: "nav.customReport", icon: "fa-calendar-days", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
  ]},
  /* ── BOSHQARUV ────────────────────────────────────────────────────────────
     DO'KONNI boshqarish — egasi va do'kon admini uchun. Ilgari bu bandlar
     "Sozlamalar" bo'limida, xodimning shaxsiy sozlamalari bilan bir qatorda
     turardi: kassir "Sozlamalar" ni ochib xodimlar ro'yxatini kutardi,
     egasi esa do'konni boshqaradigan joyni topolmasdi. 07-ADMIN.md aytadigan
     "egasi/admin paneli" — aynan shu bo'lim, alohida sayt emas.

     ⚠ Bu FAQAT ko'rinish tartibi. Haqiqiy ruxsat serverda: `SecurityConfig`
     `/shop/users/**` va `/shop/branches/**` ni alohida tekshiradi. */
  { section: "nav.section.management", items: [
    { id: "shop-users", path: "/shop-users", key: "nav.staff",    icon: "fa-users-gear", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "branches",   path: "/branches",   key: "nav.branches", icon: "fa-store",      roles: ["OWNER"] },
    /* Sodiqlik — chegirma jadvali, ya'ni PULGA tegadigan sozlama.
       Shuning uchun "Boshqaruv" da, kassirda emas. */
    { id: "loyalty",    path: "/loyalty",    key: "nav.loyalty",  icon: "fa-award",      roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    /* Aksiyalar — do'konning MIJOZLARGA ketadigan gapi (V39). Kassirda
       emas: bitta bosishda minglab telefonga push ketadi. */
    { id: "announcements", path: "/announcements", key: "nav.announcements", icon: "fa-bullhorn", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    /* Xavfsizlik — bajik va tasdiqlar. SHOP_ADMIN ham kiradi, lekin u
       yerda faqat jurnal va smenalarni ko'radi: bajik chiqarish FAQAT
       egasida (server ham shuni qo'yadi). */
    { id: "security",   path: "/security",   key: "nav.security", icon: "fa-shield-halved", roles: ["SHOP_ADMIN", "OWNER"] },
    { id: "audit",      path: "/audit",      key: "nav.audit",    icon: "fa-clock-rotate-left", roles: ["SHOP_ADMIN", "OWNER"] },
  ]},
  { section: "nav.section.settings", items: [
    /* Sozlamalar — HAMMA rolga ochiq: til va tema shu yerda va ular
       xodimning shaxsiy tanlovi, do'kon sozlamasi emas. */
    { id: "settings",   path: "/settings",   key: "nav.settings", icon: "fa-gear" },
  ]},
];

/* Rol nomi — lug'atdan. SUPERADMIN va ADMIN do'kon roli emas: birinchisi
   tizim admini, ikkinchisi eski nom. Shuning uchun alohida kalitlar. */
const EXTRA_ROLE_KEYS = {
  SUPERADMIN: "enum.adminRole.SUPER_ADMIN",
  ADMIN:      "enum.role.SHOP_ADMIN",
};

const PAGE_TITLES = {
  "/":               { key:"nav.dashboard",    icon:"fa-chart-pie"     },
  "/sale":           { key:"nav.kassa",        icon:"fa-cash-register" },
  "/products":       { key:"nav.products",     icon:"fa-box"           },
  "/categories":     { key:"nav.categories",   icon:"fa-tags"          },
  "/inventory":      { key:"nav.inventory",    icon:"fa-warehouse"     },
  "/stock-take":     { key:"nav.stockTake",    icon:"fa-clipboard-list"},
  "/supply":         { key:"nav.supply",       icon:"fa-truck-ramp-box"},
  "/transfers":      { key:"nav.transfers",    icon:"fa-truck-fast"    },
  "/prices":         { key:"nav.prices",       icon:"fa-tags"          },
  "/customers":      { key:"nav.customers",    icon:"fa-users"         },
  "/sales":          { key:"nav.sales",        icon:"fa-receipt"       },
  "/reports":        { key:"nav.reports",      icon:"fa-chart-bar"     },
  "/expenses":       { key:"nav.expenses",     icon:"fa-money-bill-wave"},
  "/custom-report":  { key:"nav.customReport", icon:"fa-calendar-days" },
  "/shop-users":     { key:"nav.staff",        icon:"fa-users-gear"    },
  "/branches":       { key:"nav.branches",     icon:"fa-store"         },
  "/loyalty":        { key:"nav.loyalty",      icon:"fa-award"         },
  "/announcements":  { key:"nav.announcements", icon:"fa-bullhorn"     },
  /* ⚠ Ro'yxatda yo'q yo'l JIMGINA "/" ga tushadi: `/security` shu sababli
     tepada "Dashboard" deb yozilib turardi. Yangi sahifa qo'shsangiz,
     shu yerga ham qo'shing. */
  "/security":       { key:"nav.security",     icon:"fa-shield-halved" },
  "/audit":          { key:"nav.audit",        icon:"fa-clock-rotate-left"},
  "/settings":       { key:"nav.settings",     icon:"fa-gear"          },
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
                  <span className="ek-num" style={{ fontWeight: 700, color: "var(--fg-warning)" }}>{item.quantity} {t("layout.pieces")}</span>
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

function Sidebar({ user, onLogout, open, onClose, isCollapsed, onToggleCollapse, lowStockCount }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { count: suspiciousCount } = useSuspiciousCount(user);
  // Yorliqda BITTA rol ko'rsatiladi — ierarxiyadagi eng yuqorisi.
  // "SHOP_ADMIN,CASHIER" deb yozib qo'yish foydalanuvchiga hech narsa
  // bermaydi va tarjima qilinmagan holda chiqardi.
  const roleName = (r) => {
    const top = topRole(r);
    const key = EXTRA_ROLE_KEYS[top];
    return key ? t(key) : roleLabel(top);
  };
  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: t("layout.logout"),
      message: t("layout.logoutConfirm"),
      type: "warning",
      confirmText: t("layout.logout"),
      cancelText: t("common.cancel"),
    });
    if (ok) onLogout();
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
      </div>
      <button className="sb-toggle" onClick={onToggleCollapse}
              aria-label={isCollapsed ? t("nav.expand") : t("nav.collapse")}
              title={isCollapsed ? t("nav.expand") : t("nav.collapse")}>
        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`} />
      </button>
      <nav className="sb-nav">
        {NAV_ITEMS.map((group) => {
          // ⚠ Tekshiruv TO'PLAM bo'yicha. Ilgari bu yerda
          // `item.roles.includes(userRole)` turardi va `userRole` — sessiyadagi
          // BUTUN satr. Xodimda ikkita rol bo'lsa u `"SHOP_ADMIN,CASHIER"`
          // bo'lardi, hech bir ro'yxatga mos kelmasdi va yon menyuda faqat
          // «Sozlamalar» qolardi. OWNER uchun istisno `hasRole` ichida.
          const visibleItems = group.items.filter((item) => hasRole(user?.role, item.roles));

          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section}>
              <div className="sb-section">{t(group.section)}</div>
              {visibleItems.map((item) => (
                <NavLink key={item.id} to={item.path} title={isCollapsed ? t(item.key) : ""} onClick={() => onClose()} className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}>
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                  <span className="sb-label">{t(item.key)}</span>
                  {item.id === "inventory" && lowStockCount > 0 && <span className="badge badge-red sb-badge" style={{ marginLeft: "auto" }}>{lowStockCount}</span>}
                  {item.id === "security" && suspiciousCount > 0 && <span className="badge badge-red sb-badge" style={{ marginLeft: "auto" }}>{suspiciousCount}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      {/* Tema tanlagichi bu yerdan OLIB TASHLANDI: barcha sozlamalar endi
          «Sozlamalar» sahifasida — bitta joy, bitta qidiruv. */}
      <div className="sb-footer">
        <div className="sb-user" onClick={handleLogoutClick} title={isCollapsed ? t("layout.logout") : ""}
             role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLogoutClick(); } }}>
          <div className="av" style={{ width: isCollapsed ? 28 : 34, height: isCollapsed ? 28 : 34 }}>{initials(user?.fullName || user?.username)}</div>
          <div className="sb-user-info">
            <div className="sb-user-name">{user?.fullName || user?.username}</div>
            <div className="sb-user-role">{roleName(user?.role)} <i className="fa-solid fa-right-from-bracket" /></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ user, onLogout, isAdmin, lowStockItems, lowStockCount, children }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sb_collapsed") === "1");
  const [kassaFullscreen, setKassaFullscreen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const toggleCollapse = () => {
    setIsCollapsed(p => {
      const v = !p;
      localStorage.setItem("sb_collapsed", v ? "1" : "0");
      return v;
    });
  };

  const isKassaPage = location.pathname === "/sale";
  const toggleKassaFullscreen = () => setKassaFullscreen(v => !v);

  // Boshqa sahifaga o'tganda fullscreen dan chiqish
  if (!isKassaPage && kassaFullscreen) setKassaFullscreen(false);

  const matchedTitle = Object.keys(PAGE_TITLES).find(k => location.pathname === k) || "/";
  const title = PAGE_TITLES[matchedTitle] || PAGE_TITLES["/"];

  // Children ga kassaFullscreen props ni uzatish
  const enhancedChildren = isKassaPage
    ? (typeof children?.type === 'function' || children?.type?.$$typeof)
      ? children
      : children
    : children;

  return (
    <div className={`app-layout ${isCollapsed ? "collapsed" : ""} ${kassaFullscreen ? "kassa-fullscreen" : ""}`}>
      {open && <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:199 }} />}
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        open={open} 
        onClose={() => setOpen(false)} 
        isCollapsed={isCollapsed} 
        onToggleCollapse={toggleCollapse} 
        lowStockCount={lowStockCount} 
      />
      <main className="main-content">
        <div className="topbar">
          <button className="btn-icon ham-btn" onClick={() => setOpen(v => !v)}
                  aria-label={t("layout.menu")} aria-expanded={open}><i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" /></button>
          <span className="topbar-title"><i className={`fa-solid ${title.icon}`} aria-hidden="true" /> {t(title.key)}</span>
          {/* Telefon ilovasida egasi «To'liq panel»dan NAZORAT paneliga
              qaytadi (bayroqni App.jsx o'qiydi — reload yetarli). */}
          {isMobileApp() && (roleSet(user?.role).has("OWNER") || roleSet(user?.role).has("SHOP_ADMIN")) && (
            <button className="btn btn-sm" onClick={() => { localStorage.removeItem("ek_mobileFull"); window.location.reload(); }}>
              <i className="fa-solid fa-gauge-high" aria-hidden="true" /> {t("m.controlPanel")}
            </button>
          )}
          {isKassaPage && (
            <button className="btn btn-sm kassa-fs-topbar-btn" onClick={toggleKassaFullscreen} title={t("layout.fullscreen")}>
              <i className="fa-solid fa-expand" aria-hidden="true" /> {t("layout.fullscreen")}
            </button>
          )}
          <LowStockBadge items={lowStockItems || []} count={lowStockCount || 0} onGoInventory={() => navigate("/inventory")} />
          {/* Sana `ek-format` dan — `toLocaleDateString("uz-UZ")` brauzerga qarab
              turlicha chiqadi va tilga ergashmaydi (02-DESIGN-SYSTEM.md). */}
          <span className="topbar-date ek-num"><i className="fa-regular fa-clock" aria-hidden="true" /> {weekdayDate()}</span>
        </div>
        {/* Sahifa o'tishi — FAQAT opacity, 140ms. Siljish yo'q: POS'da chalg'itadi. */}
        <div className="page-content ek-page-in" key={location.pathname}>
          {children}
        </div>
      </main>

      {/* Kassa fullscreen exit button */}
      {kassaFullscreen && (
        <button className="kassa-fs-exit" onClick={toggleKassaFullscreen} title={t("layout.fullscreenExit")} aria-label={t("layout.fullscreenExit")}>
          <i className="fa-solid fa-compress" />
        </button>
      )}
    </div>
  );
}
