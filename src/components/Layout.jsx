import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGO_URL, initials } from "../utils";
import { useConfirm } from "../context/ConfirmProvider";
import { getTheme, toggleTheme } from "../lib/ek-theme";

const NAV_ITEMS = [
  { section: "Asosiy", items: [
    { id: "dashboard", path: "/",      label: "Dashboard",     icon: "fa-chart-pie",     roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "sale",      path: "/sale",  label: "Kassa",         icon: "fa-cash-register", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "Do'kon", items: [
    { id: "products",   path: "/products",   label: "Mahsulotlar",  icon: "fa-box",       roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "categories", path: "/categories", label: "Kategoriyalar",icon: "fa-tags",      roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "inventory",  path: "/inventory",  label: "Ombor",        icon: "fa-warehouse", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "customers",  path: "/customers",  label: "Mijozlar",     icon: "fa-users",     roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
    { id: "sales",      path: "/sales",      label: "Sotuvlar tarixi", icon: "fa-receipt",   roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "Hisobotlar", items: [
    { id: "reports",        path: "/reports",       label: "Hisobotlar",    icon: "fa-chart-bar",     roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "custom-report",  path: "/custom-report", label: "Maxsus hisobot",icon: "fa-calendar-days", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
  ]},
  { section: "Sozlamalar", items: [
    { id: "shop-users", path: "/shop-users", label: "Xodimlar", icon: "fa-users-gear", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "branches",   path: "/branches",   label: "Filiallar", icon: "fa-store",      roles: ["OWNER"] },
  ]},
];

const ROLE_LABELS_MAP = {
  OWNER: "Do'kon egasi",
  SHOP_ADMIN: "Admin",
  ADMIN: "Admin",
  STOREKEEPER: "Omborchi",
  CASHIER: "Kassir",
  SUPERADMIN: "Super Admin"
};

const PAGE_TITLES = {
  "/":               { label:"Dashboard",        icon:"fa-chart-pie"     },
  "/sale":           { label:"Kassa",            icon:"fa-cash-register" },
  "/products":       { label:"Mahsulotlar",      icon:"fa-box"           },
  "/categories":     { label:"Kategoriyalar",    icon:"fa-tags"          },
  "/inventory":      { label:"Ombor",            icon:"fa-warehouse"     },
  "/customers":      { label:"Mijozlar",         icon:"fa-users"         },
  "/sales":          { label:"Sotuvlar tarixi",  icon:"fa-receipt"       },
  "/reports":        { label:"Hisobotlar",       icon:"fa-chart-bar"     },
  "/custom-report":  { label:"Maxsus hisobot",   icon:"fa-calendar-days" },
  "/shop-users":     { label:"Xodimlar",         icon:"fa-users-gear"    },
  "/branches":       { label:"Filiallar",        icon:"fa-store"         },
};

/** Qorong'i rejim almashtirgichi — 02-DESIGN-SYSTEM.md: yon menyuda, ko'rinadigan
 *  joyda. Smena kechqurun boshlanadi va yorug' ekran charchatadi. */
function ThemeToggle({ collapsed }) {
  const [theme, setTheme] = useState(getTheme);
  const dark = theme === "dark";
  return (
    <button
      className="sb-item"
      style={{ width: "100%", background: "none", border: 0, cursor: "pointer", fontFamily: "inherit" }}
      onClick={() => setTheme(toggleTheme())}
      title={collapsed ? (dark ? "Yorug' rejim" : "Qorong'i rejim") : ""}
      aria-pressed={dark}
    >
      <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"}`} aria-hidden="true" />
      <span className="sb-label">{dark ? "Yorug' rejim" : "Qorong'i rejim"}</span>
    </button>
  );
}

function LowStockBadge({ items, count, onGoInventory }) {
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
          <span className="ek-num">{count}</span> mahsulot kam
        </span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div className="ek-dialog" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--bg-surface)", borderRadius: "var(--r-xl)", minWidth: 300, boxShadow: "var(--sh-lg)", border: "1px solid var(--border-warning)", zIndex: 300, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "var(--bg-warning-subtle)", borderBottom: "1px solid var(--border-warning)", fontWeight: 700, fontSize: 13, color: "var(--fg-warning)" }}>Ombor ogohlantirishi</div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.productName}</span>
                  <span className="ek-num" style={{ fontWeight: 700, color: "var(--fg-warning)" }}>{item.quantity} dona</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 10 }}>
              <button className="btn btn-full" onClick={() => { onGoInventory(); setOpen(false); }} style={{ background: "var(--bg-warning)", color: "var(--ek-ink-950)" }}>Omborga o'tish</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Sidebar({ user, onLogout, open, onClose, isCollapsed, onToggleCollapse, lowStockCount }) {
  const confirm = useConfirm();
  const handleLogoutClick = async () => {
    const ok = await confirm({ title: "Tizimdan chiqish", message: "Chindan ham tizimdan chiqmoqchimisiz?", type: "warning" });
    if (ok) onLogout();
  };
  return (
    <aside className={`sidebar ${open ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sb-logo">
        <div className="sb-logo-inner">
          <img src={isCollapsed ? "/favicon.png" : LOGO_URL} alt="logo" />
        </div>
      </div>
      <button className="sb-toggle" onClick={onToggleCollapse}>
        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`} />
      </button>
      <nav className="sb-nav">
        {NAV_ITEMS.map((group) => {
          const userRole = (user?.role || "").toUpperCase().replace("ROLE_", "");
          const isOwner = userRole === "OWNER";
          
          const visibleItems = group.items.filter(item => {
            if (!item.roles) return true;
            return item.roles.includes(userRole) || isOwner;
          });
          
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section}>
              <div className="sb-section">{group.section}</div>
              {visibleItems.map((item) => (
                <NavLink key={item.id} to={item.path} title={isCollapsed ? item.label : ""} onClick={() => onClose()} className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}>
                  <i className={`fa-solid ${item.icon}`} /> 
                  <span className="sb-label">{item.label}</span>
                  {item.id === "inventory" && lowStockCount > 0 && <span className="badge badge-red" style={{ marginLeft: "auto" }}>{lowStockCount}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="sb-footer">
        <ThemeToggle collapsed={isCollapsed} />
        <div className="sb-user" onClick={handleLogoutClick} title={isCollapsed ? "Tizimdan chiqish" : ""}>
          <div className="av" style={{ width: isCollapsed ? 28 : 34, height: isCollapsed ? 28 : 34 }}>{initials(user?.fullName || user?.username)}</div>
          <div className="sb-user-info">
            <div className="sb-user-name">{user?.fullName || user?.username}</div>
            <div className="sb-user-role">{ROLE_LABELS_MAP[user?.role] || user?.role} <i className="fa-solid fa-right-from-bracket" /></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ user, onLogout, isAdmin, lowStockItems, lowStockCount, children }) {
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
          <button className="btn-icon ham-btn" onClick={() => setOpen(v => !v)}><i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} /></button>
          <span className="topbar-title"><i className={`fa-solid ${title.icon}`} /> {title.label}</span>
          {isKassaPage && (
            <button className="btn btn-sm kassa-fs-topbar-btn" onClick={toggleKassaFullscreen} title="To'liq ekran">
              <i className="fa-solid fa-expand" /> To'liq ekran
            </button>
          )}
          <LowStockBadge items={lowStockItems || []} count={lowStockCount || 0} onGoInventory={() => navigate("/inventory")} />
          <span className="topbar-date"><i className="fa-regular fa-clock" /> {new Date().toLocaleDateString("uz-UZ", { weekday:"short", year:"numeric", month:"short", day:"numeric" })}</span>
        </div>
        {/* Sahifa o'tishi — FAQAT opacity, 140ms. Siljish yo'q: POS'da chalg'itadi. */}
        <div className="page-content ek-page-in" key={location.pathname}>
          {children}
        </div>
      </main>

      {/* Kassa fullscreen exit button */}
      {kassaFullscreen && (
        <button className="kassa-fs-exit" onClick={toggleKassaFullscreen} title="To'liq ekrandan chiqish">
          <i className="fa-solid fa-compress" />
        </button>
      )}
    </div>
  );
}
