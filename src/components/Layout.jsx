import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LOGO_URL, initials } from "../utils";

const NAV_ITEMS = [
  { section: "Asosiy", items: [
    { id: "dashboard", path: "/",      label: "Dashboard",     icon: "fa-chart-pie",     roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "STOREKEEPER", "OWNER"] },
    { id: "sale",      path: "/sale",  label: "Kassa",         icon: "fa-cash-register", roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "Do'kon", items: [
    { id: "products",   path: "/products",   label: "Mahsulotlar",  icon: "fa-box",       roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "categories", path: "/categories", label: "Kategoriyalar",icon: "fa-tags",      roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "inventory",  path: "/inventory",  label: "Ombor",        icon: "fa-warehouse", roles: ["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"] },
    { id: "customers",  path: "/customers",  label: "Mijozlar",     icon: "fa-users",     roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
    { id: "sales",      path: "/sales",      label: "Sotuvlar",     icon: "fa-receipt",   roles: ["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"] },
  ]},
  { section: "Hisobotlar", items: [
    { id: "reports",        path: "/reports",       label: "Hisobotlar",    icon: "fa-chart-bar",     roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "custom-report",  path: "/custom-report", label: "Maxsus hisobot",icon: "fa-calendar-days", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
  ]},
  { section: "Sozlamalar", items: [
    { id: "shop-users", path: "/shop-users", label: "Xodimlar", icon: "fa-users-gear", roles: ["ADMIN", "SHOP_ADMIN", "OWNER"] },
    { id: "shops", path: "/shops", label: "Do'konlar", icon: "fa-store", roles: ["SUPERADMIN"] },
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
  "/shops":          { label:"Do'konlar",        icon:"fa-store"         },
};

// ── Low Stock Tooltip popup ─────────────────────────────────
function LowStockBadge({ items, count, onGoInventory }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#fef3c7", border: "1.5px solid #f59e0b",
          borderRadius: 20, padding: "5px 12px 5px 9px",
          cursor: "pointer", fontFamily: "inherit",
          animation: "pulse-warn 2s infinite",
        }}
      >
        <i className="fa-solid fa-triangle-exclamation" style={{ color: "#d97706", fontSize: 13 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: "#92400e" }}>
          {count} mahsulot kam
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* backdrop */}
          <div onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: "white", borderRadius: 14, minWidth: 300, maxWidth: 360,
            boxShadow: "0 8px 32px rgba(0,0,0,.15)", border: "1.5px solid #fde68a",
            zIndex: 300, overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: "#92400e" }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 7, color: "#d97706" }} />
                Ombor ogohlantirishi
              </span>
              <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700, background: "#fde68a", padding: "2px 8px", borderRadius: 10 }}>
                {count} ta
              </span>
            </div>

            {/* List */}
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.productId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", borderBottom: "1px solid #f1f5f9",
                  gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      Min: {item.minQuantity} dona
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 900, fontSize: 14,
                    color: item.quantity === 0 ? "#dc2626" : "#d97706",
                    background: item.quantity === 0 ? "#fef2f2" : "#fffbeb",
                    border: `1.5px solid ${item.quantity === 0 ? "#fca5a5" : "#fde68a"}`,
                    borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap",
                  }}>
                    {item.quantity === 0
                      ? "Tugagan!"
                      : `${item.quantity} dona`}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9" }}>
              <button
                onClick={() => { onGoInventory(); setOpen(false); }}
                style={{
                  width: "100%", padding: "9px 0", background: "linear-gradient(135deg,#f59e0b,#d97706)",
                  color: "white", border: "none", borderRadius: 9, fontWeight: 800,
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                <i className="fa-solid fa-warehouse" />
                Omborga o'tish
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────
function Sidebar({ page, setPage, user, onLogout, open, onClose, isAdmin, lowStockCount }) {
  const confirm = useConfirm();

  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: "Tizimdan chiqish",
      message: "Chindan ham tizimdan chiqmoqchimisiz?",
      type: "warning"
    });
    if (ok) onLogout();
  };

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sb-logo">
        <div className="sb-logo-inner">
          <img src={LOGO_URL} alt="e-Kassam"
            style={{ width:"100%", height:"100%", objectFit:"contain" }}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }} />
          <div style={{ display:"none", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", background:"linear-gradient(135deg,#017dca,#01368d)", borderRadius:8, color:"white", fontSize:20 }}>
            <i className="fa-solid fa-cash-register" />
          </div>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV_ITEMS.map((group) => {
          // Filter group items based on user role
          const visibleItems = group.items.filter(item => {
            if (!item.roles) return true;
            return item.roles.includes(user?.role) || user?.role === "OWNER";
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.section}>
              <div className="sb-section">{group.section}</div>
              {visibleItems.map((item) => (
                <NavLink 
                  key={item.id}
                  to={item.path}
                  onClick={() => onClose()}
                  className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                  style={{ position: "relative", display: "flex", alignItems: "center", textDecoration: "none" }}
                >
                  <i className={`fa-solid ${item.icon}`} />
                  {item.label}
                  {item.id === "inventory" && lowStockCount > 0 && (
                    <span style={{
                      marginLeft: "auto", background: "#ef4444", color: "white",
                      fontSize: 10, fontWeight: 900, borderRadius: 10,
                      padding: "1px 6px", minWidth: 18, textAlign: "center",
                    }}>
                      {lowStockCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sb-footer">
        <div className="sb-user" onClick={handleLogoutClick} title="Chiqish">
          <div className="av" style={{ width:34, height:34, borderRadius:9, fontSize:13 }}>
            {initials(user?.fullName || user?.username)}
          </div>
          <div className="sb-user-info">
            <div className="sb-user-name">{user?.fullName || user?.username}</div>
            <div className="sb-user-role">
              {ROLE_LABELS_MAP[user?.role] || user?.role || "Xodim"}
              <i className="fa-solid fa-right-from-bracket" style={{ marginLeft:5 }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Layout ───────────────────────────────────────────────────
export default function Layout({ user, onLogout, isAdmin, lowStockItems, lowStockCount, children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // We identify title by matching current pathname
  const matchedTitle = Object.keys(PAGE_TITLES).find(k => location.pathname === k) || "/";
  const title = PAGE_TITLES[matchedTitle] || PAGE_TITLES["/"];

  return (
    <div className="app-layout">
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:199 }} />
      )}

      <Sidebar user={user} onLogout={onLogout}
        open={open} onClose={() => setOpen(false)} isAdmin={isAdmin}
        lowStockCount={lowStockCount} />

      <main className="main-content">
        <div className="topbar">
          <button className="btn-icon ham-btn" onClick={() => setOpen(v => !v)}>
            <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} />
          </button>

          <span className="topbar-title">
            <i className={`fa-solid ${title.icon}`} />
            {title.label}
          </span>

          {/* Low stock badge — topbarda doim ko'rinadi */}
          <LowStockBadge
            items={lowStockItems || []}
            count={lowStockCount || 0}
            onGoInventory={() => navigate("/inventory")}
          />

          {isAdmin && (
            <span style={{ background:"var(--blue-l)", color:"var(--blue-d)", fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:20 }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight:5 }} />
              ADMIN
            </span>
          )}

          <span className="topbar-date">
            <i className="fa-regular fa-clock" />
            {new Date().toLocaleDateString("uz-UZ", { weekday:"short", year:"numeric", month:"short", day:"numeric" })}
          </span>
        </div>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
