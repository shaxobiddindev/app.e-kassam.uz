import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGO_URL, initials } from "../utils";
import { useConfirm } from "../context/ConfirmProvider";

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

function LowStockBadge({ items, count, onGoInventory }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fef3c7", border: "1.5px solid #f59e0b", borderRadius: 20, padding: "5px 12px 5px 9px", cursor: "pointer", fontFamily: "inherit" }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ color: "#d97706", fontSize: 13 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: "#92400e" }}>{count} mahsulot kam</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "white", borderRadius: 14, minWidth: 300, boxShadow: "0 8px 32px rgba(0,0,0,.15)", border: "1.5px solid #fde68a", zIndex: 300 }}>
            <div style={{ padding: "12px 16px", background: "#fffbeb", borderBottom: "1px solid #fde68a", fontWeight: 800, fontSize: 13, color: "#92400e" }}>Ombor ogohlantirishi</div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.productName}</span>
                  <span style={{ fontWeight: 900, color: "#d97706" }}>{item.quantity} dona</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px" }}>
              <button onClick={() => { onGoInventory(); setOpen(false); }} style={{ width: "100%", padding: "8px", background: "#f59e0b", color: "white", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>Omborga o'tish</button>
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
          <img src={isCollapsed ? "/favicon.png" : LOGO_URL} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
        </div>
      </div>
      <button className="sb-toggle" onClick={onToggleCollapse}>
        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`} />
      </button>
      <nav className="sb-nav">
        {NAV_ITEMS.map((group) => {
          const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(user?.role) || user?.role === "OWNER");
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
  const location = useLocation();
  const navigate = useNavigate();
  
  const toggleCollapse = () => {
    setIsCollapsed(p => {
      const v = !p;
      localStorage.setItem("sb_collapsed", v ? "1" : "0");
      return v;
    });
  };

  const matchedTitle = Object.keys(PAGE_TITLES).find(k => location.pathname === k) || "/";
  const title = PAGE_TITLES[matchedTitle] || PAGE_TITLES["/"];

  return (
    <div className={`app-layout ${isCollapsed ? "collapsed" : ""}`}>
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
          <LowStockBadge items={lowStockItems || []} count={lowStockCount || 0} onGoInventory={() => navigate("/inventory")} />
          <span className="topbar-date"><i className="fa-regular fa-clock" /> {new Date().toLocaleDateString("uz-UZ", { weekday:"short", year:"numeric", month:"short", day:"numeric" })}</span>
        </div>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
