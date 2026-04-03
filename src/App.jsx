import "./styles.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import ShopUsersPage    from "./pages/admin/ShopUsersPage";
import NotFound from "./pages/NotFound";

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
    
    // Agar backend bir nechta &role= qilib jo'natgan bo'lsa (masalan: ADMIN, OWNER, CASHIER)
    const rolesArray = p.getAll("role");
    let parsedRole = "";
    if (rolesArray.length > 0) {
      const fullRolesStr = rolesArray.join(",").toUpperCase();
      if (fullRolesStr.includes("SUPERADMIN")) parsedRole = "SUPERADMIN";
      else if (fullRolesStr.includes("OWNER")) parsedRole = "OWNER";
      else if (fullRolesStr.includes("SHOP_ADMIN")) parsedRole = "SHOP_ADMIN";
      else if (fullRolesStr.includes("ADMIN")) parsedRole = "ADMIN";
      else if (fullRolesStr.includes("STOREKEEPER")) parsedRole = "STOREKEEPER";
      else if (fullRolesStr.includes("CASHIER")) parsedRole = "CASHIER";
      else parsedRole = rolesArray[0];
    } else {
      parsedRole = p.get("role") || "";
    }

    const parsedShopCode = p.get("shopCode") || "";
    const parsedRefresh  = p.get("refresh")  || "";

    console.log("[APP] auth param parsed → type:", parsedType, "| roles:", rolesArray, "| finalRole:", parsedRole);

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

// ── Ruxsatlarni himoyalovchi komponent (RBAC) ────────────────
const ProtectedRoute = ({ user, roles, children }) => {
  if (!user) return <Navigate to={LOGIN_URL} replace />;
  if (roles && user.role && user.role !== "OWNER") {
    if (!roles.includes(user.role)) {
      return <Navigate to="/" replace />; // ruxsatsiz yo'llar dashboard ga qaytadi
    }
  }
  return children;
};

export default function App() {
  const { user, logout }                               = useAuth();
  const { toasts, toast, dismiss }                     = useToast();
  const { lowStockItems, lowStockCount, refreshLowStock } = useLowStock();

  if (!user) return null;

  return (
    <BrowserRouter>
      <Toast toasts={toasts} onDismiss={dismiss} />
      <Layout user={user} onLogout={logout} isAdmin={user?.role === "SUPERADMIN"}
        lowStockItems={lowStockItems} lowStockCount={lowStockCount}>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "STOREKEEPER", "OWNER"]}>
              <DashboardPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/sale" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}>
              <KassaPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}>
              <ProductsPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/categories" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}>
              <CategoriesPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}>
              <InventoryPage toast={toast} refreshLowStock={refreshLowStock} />
            </ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}>
              <CustomersPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/sales" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}>
              <SalesPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}>
              <ReportsPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/custom-report" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}>
              <CustomReportPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/shop-users" element={
            <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}>
              <ShopUsersPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="/shops" element={
            <ProtectedRoute user={user} roles={["SUPERADMIN"]}>
              <ShopsPage toast={toast} />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
