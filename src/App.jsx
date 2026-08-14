import "./styles.css";
/* BUILD_ID: EMERGENCY_FIX_V3_0116 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LOGIN_URL } from "./config";
import { initLang, withLang, useT } from "./lib/ek-i18n";
import { useAuth }  from "./hooks/useAuth";
import { useLowStock } from "./hooks/useLowStock";
import { useToast } from "./hooks/useToast";

import Toast            from "./components/Toast";
import Layout           from "./components/Layout";
import AppUpdater       from "./components/AppUpdater";
import { ConfirmProvider } from "./context/ConfirmProvider";
import DashboardPage    from "./pages/DashboardPage";
import ProductsPage     from "./pages/ProductsPage";
import InventoryPage    from "./pages/InventoryPage";
import StockTakePage    from "./pages/StockTakePage";
import ExpensesPage     from "./pages/ExpensesPage";
import LoyaltyPage      from "./pages/LoyaltyPage";
import SupplyPage       from "./pages/SupplyPage";
import TransfersPage    from "./pages/TransfersPage";
import PricesPage       from "./pages/PricesPage";
import CustomersPage    from "./pages/CustomersPage";
import KassaPage        from "./pages/KassaPage";
import ReportsPage      from "./pages/ReportsPage";
import SalesPage        from "./pages/SalesPage";
import CategoriesPage   from "./pages/admin/CategoriesPage";
import CustomReportPage from "./pages/admin/CustomReportPage";
import ShopUsersPage    from "./pages/admin/ShopUsersPage";
import ShopsPage        from "./pages/admin/ShopsPage";
import SettingsPage    from "./pages/SettingsPage";
import LoginPage       from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import { isDesktop, isNativeShell, isMobileApp } from "./lib/ek-desktop";
import MobileApp from "./mobile/MobileApp";
import { hasRole, roleSet } from "./lib/ek-roles";
import ErrorBoundary, { RouteErrorBoundary } from "./components/ek/ErrorBoundary";
import { BadgeProvider } from "./context/BadgeProvider";
import { KeyboardProvider } from "./context/KeyboardProvider";
import SecurityPage from "./pages/SecurityPage";
import AuditPage from "./pages/AuditPage";

// ⚠ Tilni URL dan olish MODUL TANASIDA, `replaceState` dan OLDIN bo'lishi
// shart. Bu fayl `main.jsx` dan import qilinadi va ES modul tartibiga ko'ra
// shu tana `main.jsx` dagi `initLang()` dan OLDIN ishlaydi. Agar avval URL
// tozalansa, `?lang=` yo'qoladi va login'da tanlangan til yetib kelmaydi.
initLang();

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
    // Refresh token login domenidagi deviceId ga bog'langan — o'shani
    // saqlaymiz, aks holda bu yerda yangi id yaralib refresh rad etiladi.
    const deviceId = p.get("deviceId") || "";
    if (token && type) {
      localStorage.setItem("ek_token", token);
      localStorage.setItem("ek_refresh", refresh);
      if (deviceId) localStorage.setItem("ek_deviceId", deviceId);
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
  // Til tanlovi sessiyaga emas, BRAUZERGA tegishli — `clear()` dan omon
  // qolsin, aks holda chiqarilgan foydalanuvchi kirish ekranini yana
  // boshqa tilda ko'radi.
  const _lang = localStorage.getItem("ek_lang");
  localStorage.clear();
  if (_lang) localStorage.setItem("ek_lang", _lang);

  // ⚠ DESKTOP'DA YO'NALTIRISH YO'Q. `.exe` ichida `auth.e-kassam.uz` ga
  // o'tish oynani bo'sh sahifaga aylantirardi va kassir uchun ilova
  // "yiqilgandek" ko'rinardi. Bu yerda `LoginPage` chiziladi (pastda).
  if (!isNativeShell()) window.location.replace(withLang(`${LOGIN_URL}?logged_out=1`));
}

/* ⚠ Tekshiruv `hasRole` orqali — xodimda bir nechta rol bo'lishi mumkin va
   ular sessiyada vergul bilan saqlanadi. Ilgari bu yerda butun satr bitta
   rol nomi bilan solishtirilardi va ikki rolli xodim hech qayerga
   kira olmasdi. OWNER istisnosi `hasRole` ichida.

   Bu FAQAT ko'rinish: haqiqiy ruxsat serverda tekshiriladi. */
const ProtectedRoute = ({ user, roles, children }) => {
  if (!user) return <Navigate to={LOGIN_URL} replace />;
  if (!hasRole(user.role, roles)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  // Yagona til obunasi: til o'zgarganda BUTUN daraxt qayta chiziladi va
  // ichkaridagi barcha `t()` chaqiruvlari yangi tilni oladi. Shu sababli
  // har bir sahifada alohida obuna kerak emas.
  useT();
  const { user, login, logout }                           = useAuth();
  const { toasts, toast, dismiss }                        = useToast();
  const { lowStockItems, lowStockCount, refreshLowStock } = useLowStock();

  // Desktop'da kirish SHU YERDA — alohida origin ham, yo'naltirish ham yo'q.
  // Brauzerda bu holatga umuman kelinmaydi: modul tanasi allaqachon
  // `auth.e-kassam.uz` ga jo'natgan.
  //
  // ⚠ `AppUpdater` IKKALA shoxda ham chiziladi, va aynan shu MUHIM: kirish
  // ekranida hech kim sotuv qilmayapti, ya'ni yangilanishni hech kimdan
  // so'ramasdan o'rnatsa bo'ladi. Faqat ichki daraxtga qo'yilsa, yangilanish
  // faqat kassir ISHLAYOTGANDA taklif qilinardi — eng noqulay payt.
  if (!user) {
    return isNativeShell() ? (
      <KeyboardProvider>
        <Toast toasts={toasts} onDismiss={dismiss} />
        <LoginPage onLogin={login} />
        <AppUpdater loggedIn={false} toast={toast} />
      </KeyboardProvider>
    ) : null;
  }

  /* ── MOBIL ILOVA (V33) — kassaning nusxasi EMAS ─────────────────────
     Telefonda EGASINING NAZORAT daraxti chiziladi: bugungi raqamlar,
     signallar, cheklar lentasi, sozlamalar. Kassa/ombor/formalar yo'q —
     savdo do'konda qilinadi, telefonda KUZATILADI. Web/desktop bu
     shoxga umuman kirmaydi. */
  if (isMobileApp()) {
    return (
      <ErrorBoundary>
        {/* ConfirmProvider kerak: Sozlamalardagi TelegramPanel undan foydalanadi */}
        <ConfirmProvider>
          <Toast toasts={toasts} onDismiss={dismiss} />
          <MobileApp user={user} logout={logout} toast={toast} />
        </ConfirmProvider>
      </ErrorBoundary>
    );
  }

  // Ikki qavatli himoya. ICHKI to'siq (`RouteErrorBoundary`) — sahifa
  // darajasida: buzilgan bo'lim o'rniga xabar chiqadi, yon menyu va
  // navigatsiya ISHLAYVERADI, kassir boshqa bo'limga o'tib ketaveradi.
  // TASHQI to'siq — oxirgi chora: `Layout` yoki `Toast` ning o'zi yiqilsa
  // ham ekranda hech bo'lmasa xabar va "qayta yuklash" tugmasi qoladi.
  return (
    <ErrorBoundary>
    <ConfirmProvider>
      {/* Bajik so'rovi butun ilova bo'ylab bitta joydan boshqariladi:
          428 kelganda modal ochilib, amal skanerlashdan keyin O'ZI
          qayta yuboriladi. */}
      <BadgeProvider toast={toast}>
      {/* Ekran klaviaturasi butun daraxt ustida: u qaysi maydon fokusda
          ekanini `focusin` orqali o'zi biladi, ya'ni sahifalarga hech narsa
          qo'shish kerak emas. */}
      <KeyboardProvider>
      <BrowserRouter>
        <Toast toasts={toasts} onDismiss={dismiss} />
        <AppUpdater loggedIn toast={toast} />
        <Layout 
          user={user} 
          onLogout={logout} 
          isAdmin={roleSet(user?.role).has("SUPERADMIN")}
          lowStockItems={lowStockItems} 
          lowStockCount={lowStockCount}
        >
          <RouteErrorBoundary>
          <Routes>
            {/* Kassirning uy sahifasi — Kassa, Dashboard emas: u smenani
                sotuvdan boshlaydi. Tekshiruv `hasRole` bilan emas, ANIQ:
                faqat kassirlik roli borlar. Kassir + omborchi bo'lsa
                Dashboard foydaliroq. */}
            <Route path="/" element={
              roleSet(user?.role).size === 1 && roleSet(user?.role).has("CASHIER")
                ? <Navigate to="/sale" replace />
                : <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><DashboardPage toast={toast} /></ProtectedRoute>
            } />
            <Route path="/sale" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><KassaPage toast={toast} /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><ProductsPage toast={toast} /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><CategoriesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><InventoryPage toast={toast} refreshLowStock={refreshLowStock} /></ProtectedRoute>} />
            {/* Inventarizatsiya — omborchi va yuqorisi; kassirning bu
                yerda ishi yo'q (backend ham shu cheklovni qo'yadi). */}
            <Route path="/stock-take" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><StockTakePage toast={toast} /></ProtectedRoute>} />
            {/* Kirim — tovarni jismonan qabul qiladigan odam hujjatni
                ham yozadi, shuning uchun omborchiga ham ochiq. */}
            <Route path="/supply" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><SupplyPage toast={toast} /></ProtectedRoute>} />
            {/* Filiallararo ko'chirish — ombor bilan bir xil doira:
                tovarni mashinaga ortadigan va tushiradigan odam omborchi.
                Kassirga yopiq (server ham shuni qo'yadi). */}
            <Route path="/transfers" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><TransfersPage toast={toast} /></ProtectedRoute>} />
            {/* Narx — egasi va do'kon adminining ishi; omborchi narx
                qo'ymaydi. */}
            <Route path="/prices" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><PricesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><CustomersPage toast={toast} /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><SalesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><ReportsPage toast={toast} /></ProtectedRoute>} />
            <Route path="/custom-report" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><CustomReportPage toast={toast} /></ProtectedRoute>} />
            {/* Xarajat — do'kon pulining qayerga ketgani; kassirga yopiq. */}
            <Route path="/expenses" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><ExpensesPage toast={toast} /></ProtectedRoute>} />
            <Route path="/shop-users" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><ShopUsersPage toast={toast} /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute user={user} roles={["OWNER"]}><ShopsPage toast={toast} /></ProtectedRoute>} />
            {/* Sodiqlik jadvali — chegirma, ya'ni pulga tegadigan sozlama. */}
            <Route path="/loyalty" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><LoyaltyPage toast={toast} /></ProtectedRoute>} />
            {/* Sozlamalar — hamma rolga ochiq: mavzu va til xodimning
                shaxsiy tanlovi, do'kon sozlamasi emas. */}
            <Route path="/settings" element={<SettingsPage toast={toast} />} />
            {/* Xavfsizlik — bajik, smena, tasdiqlar jurnali.
                Egasi bajik chiqaradi; SHOP_ADMIN faqat jurnalni ko'radi
                (backend ham shu cheklovni qo'yadi). */}
            <Route path="/security" element={<ProtectedRoute user={user} roles={["OWNER", "SHOP_ADMIN"]}><SecurityPage toast={toast} /></ProtectedRoute>} />
            {/* Jurnal — egasi va do'kon administratoriga; kassirga yopiq. */}
            <Route path="/audit" element={<ProtectedRoute user={user} roles={["OWNER", "SHOP_ADMIN"]}><AuditPage toast={toast} /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </RouteErrorBoundary>
        </Layout>
      </BrowserRouter>
      </KeyboardProvider>
      </BadgeProvider>
    </ConfirmProvider>
    </ErrorBoundary>
  );
}
