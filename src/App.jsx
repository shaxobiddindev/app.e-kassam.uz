import "./styles.css";
import { useState } from "react";
import { LOGIN_URL } from "./config";
import { useAuth }  from "./hooks/useAuth";
import { useLowStock } from "./hooks/useLowStock";
import { useToast } from "./hooks/useToast";

import Toast            from "./components/Toast";
import Layout           from "./components/Layout";
import DashboardPage    from "./pages/DashboardPage";
import ProductsPage     from "./pages/ProductsPage";
import InventoryPage    from "./pages/InventoryPage";
import CustomersPage    from "./pages/CustomersPage";
import KassaPage        from "./pages/KassaPage";
import ReportsPage      from "./pages/ReportsPage";
import SalesPage        from "./pages/SalesPage";
import CategoriesPage   from "./pages/admin/CategoriesPage";
import CustomReportPage from "./pages/admin/CustomReportPage";
import ShopsPage        from "./pages/admin/ShopsPage";

const PAGES = {
  dashboard:       DashboardPage,
  sale:            KassaPage,
  products:        ProductsPage,
  categories:      CategoriesPage,
  inventory:       InventoryPage,
  customers:       CustomersPage,
  sales:           SalesPage,
  reports:         ReportsPage,
  "custom-report": CustomReportPage,
  shops:           ShopsPage,
};

// ── URL dan token olib localStorage ga yozish ────────────────
const urlParams = new URLSearchParams(window.location.search);
const authParam = urlParams.get("auth");
if (authParam) {
  try {
    const p = new URLSearchParams(decodeURIComponent(authParam));
    const parsedToken    = p.get("token")    || "";
    const parsedType     = p.get("type")     || "";
    const parsedUsername = p.get("username") || "";
    const parsedFullName = p.get("fullName") || parsedUsername;
    const parsedRole     = p.get("role")     || "";
    const parsedShopCode = p.get("shopCode") || "";
    const parsedRefresh  = p.get("refresh")  || "";

    console.log("[APP] auth param parsed → type:", parsedType, "| token:", parsedToken.slice(0,20));

    if (parsedToken && parsedType) {
      localStorage.setItem("ek_token",    parsedToken);
      localStorage.setItem("ek_refresh",  parsedRefresh);
      localStorage.setItem("ek_type",     parsedType);
      localStorage.setItem("ek_username", parsedUsername);
      localStorage.setItem("ek_fullName", parsedFullName);
      localStorage.setItem("ek_role",     parsedRole);
      localStorage.setItem("ek_shopCode", parsedShopCode);
    }
  } catch(e) {
    console.error("[APP] auth param parse xatosi:", e);
  }
  window.history.replaceState({}, "", window.location.pathname);
}

// ── Tekshiruv ────────────────────────────────────────────────
const token = localStorage.getItem("ek_token");
const type  = localStorage.getItem("ek_type");
console.log("[APP] token check → token:", token?.slice(0,20), "| type:", type);
if (!token || type !== "user") {
  localStorage.clear();
  window.location.replace(`${LOGIN_URL}?logged_out=1`);
}

export default function App() {
  const { user, logout }                               = useAuth();
  const { toasts, toast, dismiss }                     = useToast();
  const [page, setPage]                                = useState("dashboard");
  const { lowStockItems, lowStockCount, refreshLowStock } = useLowStock();

  if (!user) return null;

  const PageComponent = PAGES[page] || DashboardPage;

  return (
    <>
      <Toast toasts={toasts} onDismiss={dismiss} />
      <Layout page={page} setPage={setPage} user={user} onLogout={logout} isAdmin={false}
        lowStockItems={lowStockItems} lowStockCount={lowStockCount}>
        <PageComponent toast={toast} setPage={setPage} refreshLowStock={refreshLowStock} />
      </Layout>
    </>
  );
}
