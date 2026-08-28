import "./styles.css";
/* BUILD_ID: EMERGENCY_FIX_V3_0116 */
import { useState, Suspense, lazy } from "react";
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
import LoginPage       from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import { isDesktop, isNativeShell, isMobileApp } from "./lib/ek-desktop";
import MobileApp from "./mobile/MobileApp";
import { hasRole, roleSet } from "./lib/ek-roles";
import ErrorBoundary, { RouteErrorBoundary } from "./components/ek/ErrorBoundary";
import { P } from "./lib/ek-pages";
import { Progress } from "./components/ek/Loading";
import { BadgeProvider } from "./context/BadgeProvider";
import { KeyboardProvider } from "./context/KeyboardProvider";
/* ⚠ MIJOZ DARAXTI KECHIKTIRIB YUKLANADI. Xodim ilovasi (kassa, ombor,
   hisobotlar) bu ekranlarni HECH QACHON chizmaydi va aksincha — lekin
   ular bitta kirish to'plamida turgani uchun kassir har ochilishda
   mijoz kabinetini ham yuklab olardi. Do'kondagi internet esa sekin. */
const CustomerPortal = lazy(() => import("./portal/CustomerPortal"));
/* Mijoz ilovasi (V37) — telefon ilovasida kirish ekrani endi shu */
const CustomerLogin = lazy(() => import("./customer/CustomerLogin"));
const CustomerApp = lazy(() => import("./customer/CustomerApp"));
/* Mijoz ilovasi BRAUZERDA (V40) — Telegram OIDC dan qaytish ham shu yerda */
const CustomerWeb = lazy(() => import("./customer/CustomerWeb"));
import { getAppToken } from "./customer/customerApi";

// ⚠ Tilni URL dan olish MODUL TANASIDA, `replaceState` dan OLDIN bo'lishi
// shart. Bu fayl `main.jsx` dan import qilinadi va ES modul tartibiga ko'ra
// shu tana `main.jsx` dagi `initLang()` dan OLDIN ishlaydi. Agar avval URL
// tozalansa, `?lang=` yo'qoladi va login'da tanlangan til yetib kelmaydi.
initLang();

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ KABINETI (V34) — bu yo'llar XODIM oqimidan BUTUNLAY chetda

   ⚠ Tekshiruv MODUL TANASIDA, hamma narsadan OLDIN turishi SHART. Quyida
   token yo'q bo'lsa `localStorage.clear()` + `auth.e-kassam.uz` ga
   yo'naltirish bor — mijozda esa xodim tokeni HECH QACHON bo'lmaydi, ya'ni
   QR ni o'qigan xaridor to'g'ridan-to'g'ri kirish sahifasiga otilib
   ketardi va kartasini umuman ko'rmasdi.
   ══════════════════════════════════════════════════════════════════════════ */
/* ⚠ `q/` ham shu yerda (V46): qarz tasdig'i sahifasi mijozniki va u
   xodim daraxtiga umuman kirmasligi kerak. */
const IS_PORTAL = /^\/(qr|kabinet|c\/|q\/)(\/|$|\d)/.test(window.location.pathname);

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ ILOVASI BRAUZERDA (V40)

   `/kirish/telegram` — Telegram OIDC dan qaytish manzili (BotFather'da
   ro'yxatdan o'tgan bo'lishi shart), `/mening` — kirgandan keyingi
   ekranlar.

   ⚠ Bu ham `IS_PORTAL` kabi MODUL TANASIDA va quyidagi `clear()` dan
   OLDIN aniqlanishi shart: u yerda xodim tokeni yo'q deb hisoblanib,
   brauzer kirish sahifasiga otib yuborilardi. */
const IS_APP_WEB = /^\/(mening|kirish\/telegram)(\/|$)/.test(window.location.pathname);

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
/* ⚠ `!IS_PORTAL`: mijoz kabinetida xodim tokeni yo'q va BO'LMAYDI ham.
   Usiz `clear()` mijozning kabinet kalitini o'chirib, uni kirish
   sahifasiga otib yuborardi. */
if (!IS_PORTAL && !IS_APP_WEB && (!localToken || localType !== "user")) {
  // Til tanlovi sessiyaga emas, BRAUZERGA tegishli — `clear()` dan omon
  // qolsin, aks holda chiqarilgan foydalanuvchi kirish ekranini yana
  // boshqa tilda ko'radi. `ek_forceMobile` ham (dev-bayroq): usiz mobil
  // UI'ni brauzerda chiqib-kirib sinab bo'lmaydi — clear() uni o'chirib,
  // sahifa auth'ga qochib ketardi.
  const _lang = localStorage.getItem("ek_lang");
  const _fm   = localStorage.getItem("ek_forceMobile");
  /* ⚠⚠ MIJOZ SESSIYASI ham omon qolishi SHART (V37 dan beri buzuq edi):
     mijoz qurilmasida xodim tokeni HECH QACHON bo'lmaydi, ya'ni bu shox
     har ochilishda ishlaydi va `clear()` mijozning kalitini o'chirib
     yuborardi — odam ilovani har safar qaytadan ochganda Telegramdan
     qayta kirishga majbur bo'lardi. Karta tanlovi ham shu yerda: u
     shunchaki qulaylik sozlamasi. */
  const _app  = localStorage.getItem("ek_app_token");
  const _card = localStorage.getItem("ek_app_card_shop");
  localStorage.clear();
  if (_lang) localStorage.setItem("ek_lang", _lang);
  if (_fm)   localStorage.setItem("ek_forceMobile", _fm);
  if (_app)  localStorage.setItem("ek_app_token", _app);
  if (_card) localStorage.setItem("ek_app_card_shop", _card);

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

  /* ── MIJOZ KABINETI (V34) ────────────────────────────────────────────
     Xaridorning sahifasi: kirish, rol, do'kon tanlash — hech biri yo'q.

     ⚠ `IS_PORTAL` — MODUL darajasidagi o'zgarmas (manzil qatoridan bir
     marta o'qiladi). Shu sababli bu erta `return` React'ning hook
     tartibini buzmaydi: har render'da bir xil shox tanlanadi. */
  /* ── MIJOZ ILOVASI BRAUZERDA (V40) ──────────────────────────────────
     Telegram OIDC dan qaytish va undan keyingi ekranlar. Xodim oqimidan
     butunlay chetda — bu yerda ham kirish, ham rol, ham do'kon yo'q. */
  if (IS_APP_WEB) {
    return (
      <ErrorBoundary>
        <ConfirmProvider>
          <Suspense fallback={<Progress />}><CustomerWeb /></Suspense>
        </ConfirmProvider>
      </ErrorBoundary>
    );
  }

  if (IS_PORTAL) {
    return (
      <ErrorBoundary>
        {/* Tasdiq oynasi shu shoxda ham kerak: kartani o'chirish qaytarib
            bo'lmaydigan amal va u brauzerning `confirm` i bilan emas,
            ilovaning modali bilan so'raladi (butun tizimda shunday). */}
        <ConfirmProvider>
          <Suspense fallback={<Progress />}><CustomerPortal /></Suspense>
        </ConfirmProvider>
      </ErrorBoundary>
    );
  }
  const { user, login, logout }                           = useAuth();
  const { toasts, toast, dismiss }                        = useToast();
  const { lowStockItems, lowStockCount, refreshLowStock } = useLowStock();


  /* Mijoz ilovasi (V37): sessiya kaliti va «xodim rejimi» bayrog'i.
     ⚠ `staffMode` SAQLANMAYDI: xodim kirgach `user` paydo bo'ladi va
     keyingi ochilishlarda shuning o'zi yetarli. Uni localStorage ga
     yozish esa mijozni bir marta xato bosgani uchun doim kassa kirishiga
     otib yuborardi. */
  const [appToken, setAppToken] = useState(() => getAppToken());
  const [staffMode, setStaffMode] = useState(false);

  // Desktop'da kirish SHU YERDA — alohida origin ham, yo'naltirish ham yo'q.
  // Brauzerda bu holatga umuman kelinmaydi: modul tanasi allaqachon
  // `auth.e-kassam.uz` ga jo'natgan.
  //
  // ⚠ `AppUpdater` IKKALA shoxda ham chiziladi, va aynan shu MUHIM: kirish
  // ekranida hech kim sotuv qilmayapti, ya'ni yangilanishni hech kimdan
  // so'ramasdan o'rnatsa bo'ladi. Faqat ichki daraxtga qo'yilsa, yangilanish
  // faqat kassir ISHLAYOTGANDA taklif qilinardi — eng noqulay payt.
  /* ══════════════════════════════════════════════════════════════════════
     MIJOZ ILOVASI (V37) — ilova endi HAR KIMGA ochiq

     Telefonda kirish ekrani MIJOZNIKI: odam Telegram bilan ro'yxatdan
     o'tadi va o'z kartasini, ballarini, cheklarini ko'radi. Xodim esa
     pastdagi «Do'kon xodimiman» havolasi orqali odatdagi kirish
     formasiga (do'kon kodi + parol) o'tadi.

     ⚠ Bu FAQAT telefon ilovasida: brauzer va `.exe` da kassa oqimi
     o'zgarmaydi — u yerda mijoz ilovasining ma'nosi yo'q.

     ⚠ Mijoz tokeni bo'lsa, xodim kirishi umuman chizilmaydi: bitta
     qurilmada ikkalasi ham bo'lishi mumkin, lekin bir vaqtda bittasi
     ko'rinadi (do'kon egasi ham oddiy mijoz). */
  if (isMobileApp() && !user && !staffMode) {
    return (
      <ErrorBoundary>
        {/* ConfirmProvider kerak: hisobdan chiqish tasdig'i */}
        <ConfirmProvider>
          <Toast toasts={toasts} onDismiss={dismiss} />
          <Suspense fallback={<Progress />}>
            {appToken
              ? <CustomerApp onLoggedOut={() => setAppToken("")} />
              : <CustomerLogin onLoggedIn={() => setAppToken(getAppToken())}
                               onStaffLogin={() => setStaffMode(true)} />}
          </Suspense>
          <AppUpdater loggedIn={false} toast={toast} />
        </ConfirmProvider>
      </ErrorBoundary>
    );
  }

  if (!user) {
    return isNativeShell() ? (
      <KeyboardProvider>
        <Toast toasts={toasts} onDismiss={dismiss} />
        {/* Mijoz ilovasidan kelingan bo'lsa — orqaga qaytish yo'li */}
        {staffMode && (
          <button className="cu-back-to-app" onClick={() => setStaffMode(false)}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" /> Mijoz ilovasi
          </button>
        )}
        <LoginPage onLogin={login} />
        <AppUpdater loggedIn={false} toast={toast} />
      </KeyboardProvider>
    ) : null;
  }

  /* ── MOBIL ILOVA (V33/V34) ──────────────────────────────────────────
     Telefonda ROLGA QARAB ikki daraxtdan biri chiziladi:

       · EGASI / do'kon admini → NAZORAT paneli (bugungi raqamlar,
         signallar, cheklar lentasi) — standart ko'rinish. Sozlamalardagi
         «To'liq panel» tugmasi `ek_mobileFull` bayrog'i bilan pastdagi
         to'liq daraxtga o'tkazadi (topbar'dagi «Nazorat paneli» qaytaradi).

       · KASSIR / OMBORCHI va boshqa rollar → TO'LIQ daraxt (pastda):
         kassa, ombor, mijozlar — brauzerdagi bilan bir xil, sidebar
         ≤900px da drawer bo'ladi. Ilgari ularga «bu ilova egasi uchun»
         to'sig'i chiqardi — endi tizimning HAMMA foydalanuvchisi
         ilovadan ishlay oladi (foydalanuvchi talabi, 2026-08-15). */
  if (isMobileApp()) {
    const mRoles = roleSet(user?.role);
    const managerish = mRoles.has("OWNER") || mRoles.has("SHOP_ADMIN");
    const fullPanel = localStorage.getItem("ek_mobileFull") === "1";
    if (managerish && !fullPanel) {
      return (
        <ErrorBoundary>
          {/* ConfirmProvider kerak: chiqish tasdig'i + TelegramPanel */}
          <ConfirmProvider>
            <Toast toasts={toasts} onDismiss={dismiss} />
            <MobileApp user={user} logout={logout} toast={toast} />
          </ConfirmProvider>
        </ErrorBoundary>
      );
    }
    /* aks holda pastdagi to'liq daraxt davom etadi */
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
          isAdmin={roleSet(user?.role).has("SUPERADMIN")}
          lowStockItems={lowStockItems} 
          lowStockCount={lowStockCount}
        >
          <RouteErrorBoundary>
          {/* ⚠ Fallback YENGIL bo'lishi shart. Sahifalar endi alohida
              chunk va o'tishda qisqa kutish paydo bo'ladi; butun ekranni
              egallaydigan yuklagich bunda miltillab, o'tishni sekin
              ko'rsatardi. Ingichka chiziq — bor-yo'g'i "kutilmoqda"
              belgisi. */}
          <Suspense fallback={<Progress />}>
          <Routes>
            {/* Kassirning uy sahifasi — Kassa, Dashboard emas: u smenani
                sotuvdan boshlaydi. Tekshiruv `hasRole` bilan emas, ANIQ:
                faqat kassirlik roli borlar. Kassir + omborchi bo'lsa
                Dashboard foydaliroq. */}
            <Route path="/" element={
              roleSet(user?.role).size === 1 && roleSet(user?.role).has("CASHIER")
                ? <Navigate to="/sale" replace />
                : <ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Dashboard toast={toast} /></ProtectedRoute>
            } />
            <Route path="/sale" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><P.Kassa toast={toast} /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Products toast={toast} /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Categories toast={toast} /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Inventory toast={toast} refreshLowStock={refreshLowStock} /></ProtectedRoute>} />
            {/* Inventarizatsiya — omborchi va yuqorisi; kassirning bu
                yerda ishi yo'q (backend ham shu cheklovni qo'yadi). */}
            <Route path="/stock-take" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.StockTake toast={toast} /></ProtectedRoute>} />
            {/* Kirim — tovarni jismonan qabul qiladigan odam hujjatni
                ham yozadi, shuning uchun omborchiga ham ochiq. */}
            <Route path="/supply" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Supply toast={toast} /></ProtectedRoute>} />
            {/* Filiallararo ko'chirish — ombor bilan bir xil doira:
                tovarni mashinaga ortadigan va tushiradigan odam omborchi.
                Kassirga yopiq (server ham shuni qo'yadi). */}
            <Route path="/transfers" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Transfers toast={toast} /></ProtectedRoute>} />
            {/* OMBORDAN BERIB YUBORISH (V48). ⚠ KASSIR YO'Q: tovarni
                chiqaruvchi bilan pulni oluvchi ajralgan bo'lishi kerak —
                sabab `SecurityConfig` dagi izohda. */}
            <Route path="/pickup" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "STOREKEEPER", "OWNER"]}><P.Pickup toast={toast} /></ProtectedRoute>} />
            {/* Narx — egasi va do'kon adminining ishi; omborchi narx
                qo'ymaydi. */}
            <Route path="/prices" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.Prices toast={toast} /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><P.Customers toast={toast} /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "CASHIER", "OWNER"]}><P.Sales toast={toast} /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.Reports toast={toast} /></ProtectedRoute>} />
            <Route path="/custom-report" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.CustomReport toast={toast} /></ProtectedRoute>} />
            {/* Xarajat — do'kon pulining qayerga ketgani; kassirga yopiq. */}
            <Route path="/expenses" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.Expenses toast={toast} /></ProtectedRoute>} />
            <Route path="/shop-users" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.ShopUsers toast={toast} /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute user={user} roles={["OWNER"]}><P.Shops toast={toast} /></ProtectedRoute>} />
            {/* Sodiqlik jadvali — chegirma, ya'ni pulga tegadigan sozlama. */}
            <Route path="/loyalty" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.Loyalty toast={toast} /></ProtectedRoute>} />
            {/* Aksiyalar (V39) — do'konning MIJOZLARGA ketadigan gapi;
                kassirga yopiq (server ham shu cheklovni qo'yadi). */}
            <Route path="/announcements" element={<ProtectedRoute user={user} roles={["ADMIN", "SHOP_ADMIN", "OWNER"]}><P.Announcements toast={toast} /></ProtectedRoute>} />
            {/* Sozlamalar — hamma rolga ochiq: mavzu va til xodimning
                shaxsiy tanlovi, do'kon sozlamasi emas. */}
            <Route path="/settings" element={<P.Settings toast={toast} />} />
            {/* Xavfsizlik — bajik, smena, tasdiqlar jurnali.
                Egasi bajik chiqaradi; SHOP_ADMIN faqat jurnalni ko'radi
                (backend ham shu cheklovni qo'yadi). */}
            <Route path="/security" element={<ProtectedRoute user={user} roles={["OWNER", "SHOP_ADMIN"]}><P.Security toast={toast} /></ProtectedRoute>} />
            {/* Jurnal — egasi va do'kon administratoriga; kassirga yopiq. */}
            <Route path="/audit" element={<ProtectedRoute user={user} roles={["OWNER", "SHOP_ADMIN"]}><P.Audit toast={toast} /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </RouteErrorBoundary>
        </Layout>
      </BrowserRouter>
      </KeyboardProvider>
      </BadgeProvider>
    </ConfirmProvider>
    </ErrorBoundary>
  );
}
