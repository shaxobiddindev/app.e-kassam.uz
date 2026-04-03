import "./styles.css";
/* BUILD_ID: EMERGENCY_FIX_V3_0116 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LOGIN_URL } from "./config";
import { useAuth }  from "./hooks/useAuth";
import { useLowStock } from "./hooks/useLowStock";
import { useToast } from "./hooks/useToast";

import Toast            from "./components/Toast";
import Layout           from "./components/Layout";
import { ConfirmProvider } from "./context/ConfirmProvider";
import DashboardPage    from "./pages/DashboardPage";
import ProductsPage     from "./pages/ProductsPage";
import InventoryPage    from "./pages/InventoryPage";
import CustomersPage    from "./pages/CustomersPage";
import KassaPage        from "./pages/KassaPage";
import ReportsPage      from "./pages/ReportsPage";
import SalesPage        from "./pages/SalesPage";
import CategoriesPage   from "./pages/admin/CategoriesPage";
import CustomReportPage from "./pages/admin/CustomReportPage";
import ShopUsersPage    from "./pages/admin/ShopUsersPage";
import NotFound from "./pages/NotFound";

// ── Auth Handling ────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const authParam = urlParams.get("auth");
if (authParam) {
  try {
    const p = new URLSearchParams(decodeURIComponent(authParam));
    const token = p.get("token") || "";
    const type = p.get("type") || "";
    const username = p.get("username") || "";
    const fullName = p.get("fullName") || username;
    const rolesArray = p.getAll("role");
    let role = "";
    if (rolesArray.length > 0) {
      const fullRolesStr = rolesArray.join(",").toUpperCase();
      if (fullRolesStr.includes("SUPERADMIN")) role = "SUPERADMIN";
      else if (fullRolesStr.includes("OWNER")) role = "OWNER";
      else if (fullRolesStr.includes("SHOP_ADMIN")) role = "SHOP_ADMIN";
      else if (fullRolesStr.includes("ADMIN")) role = "ADMIN";
      else if (fullRolesStr.includes("STOREKEEPER")) role = "STOREKEEPER";
      else if (fullRolesStr.includes("CASHIER")) role = "CASHIER";
      else role = rolesArray[0];
    } else { role = p.get("role") || ""; }
    const shopCode = p.get("shopCode") || "";
    const refresh = p.get("refresh") || p.get("refreshToken") || "";
    if (token && type) {
      localStorage.setItem("ek_token", token);
      localStorage.setItem("ek_refresh", refresh);
      localStorage.setItem("ek_type", type);
      localStorage.setItem("ek_username", username);
      localStorage.setItem("ek_fullName", fullName);
      localStorage.setItem("ek_role", role);
      localStorage.setItem("ek_shopCode", shopCode);
    }
  } catch(e) {}
  window.history.replaceState({}, "", window.location.pathname);
}

const localToken = localStorage.getItem("ek_token");
const localType = localStorage.getItem("ek_type");
if (!localToken || localType !== "user") {
  localStorage.clear();
  window.location.replace(`${LOGIN_URL}?logged_out=1`);
}

const ProtectedRoute = ({ user, roles, children }) => {
  if (!user) return <Navigate to={LOGIN_URL} replace />;
  if (roles && user.role && user.role !== "OWNER") {
    if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  const { user, logout }                                  = useAuth();
  const { toasts, toast, dismiss }                        = useToast();
  const { lowStockItems, lowStockCount, refreshLowStock } = useLowStock();

  if (!user) return null;

  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Toast toasts={toasts} onDismiss={dismiss} />
        <Layout 
          user={user} 
          onLogout={logout} 
          isAdmin={user?.role === "SUPERADMIN"}
          lowStockItems={lowStockItems} 
          lowStockCount={lowStockCount}
        >
          <Routes>
            <Route path="/" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "STOREKEEPER", "OWNER"]}><DashboardPage toast={toast} /></ProtectedRoute>} />
            <Route path="/sale" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><KassaPage toast={toast} /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><ProductsPage toast={toast} /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><CategoriesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><InventoryPage toast={toast} refreshLowStock={refreshLowStock} /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><CustomersPage toast={toast} /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><SalesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><ReportsPage toast={toast} /></ProtectedRoute>} />
            <Route path="/custom-report" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><CustomReportPage toast={toast} /></ProtectedRoute>} />
            <Route path="/shop-users" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><ShopUsersPage toast={toast} /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ConfirmProvider>
  );
}
