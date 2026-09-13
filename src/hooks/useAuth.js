import { LOGIN_URL } from "../config";
import { t, withLang } from "../lib/ek-i18n";
import { isNativeShell } from "../lib/ek-desktop";
import { useCallback, useSyncExternalStore } from "react";
import { resetShopFeatures } from "./useShopFeatures";

function ls(...keys) {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v !== "null" && v !== "undefined" && v.trim()) return v;
  }
  return "";
}

/** Saqlangan sessiyadan foydalanuvchi. Yo'q bo'lsa `null`. */
function readUser() {
  const token = ls("ek_token");
  const type  = ls("ek_type");
  if (!token || type !== "user") return null;
  return {
    username: ls("ek_username", "ek_user") || t("common.username"),
    fullName: ls("ek_fullName", "ek_name") || t("common.username"),
    role:     ls("ek_role") || "",
    shopCode: ls("ek_shopCode", "ek_shop") || "",
  };
}

/* ══ HOLAT UMUMIY — HAR HOOK O'ZINIKI EMAS ════════════════════════════
   ⚠ ILGARI `useState` EDI va bu jimgina nosozlik berardi. `useAuth`
   to'rt joyda chaqiriladi (`App`, `SettingsPage`, `BranchSelector`,
   `ShopUsersPage`) va har chaqiruv O'Z holatini yaratardi. Sozlamalardan
   chiqilganda `logout()` SettingsPage nusxasini `null` qilardi,
   `App.jsx` niki esa tegilmasdi — ekran o'zgarmay qolardi va kassir
   ilovani X bilan yopib qayta ochishga majbur bo'lardi.

   ⚠ BRAUZERDA BU KO'RINMASDI: u yerda `logout` sahifani butunlay
   almashtiradi (`location.replace`), ya'ni holat baribir noldan
   o'qilardi. Nosozlik FAQAT `.exe` va telefon ilovasida chiqardi —
   o'sha yerda chiqish oynani tashlab ketmaydi.

   Naqsh loyihada allaqachon bor (`components/ek/Overlay.jsx`). */
let cached;                       // `undefined` — hali o'qilmagan
const subscribers = new Set();

/* ⚠ NATIJA KESHLANADI. `readUser()` har chaqiruvda YANGI obyekt
   qaytaradi; keshsiz React "snapshot o'zgardi" deb cheksiz qayta
   chizardi. */
const snapshot = () => {
  if (cached === undefined) cached = readUser();
  return cached;
};
const subscribe = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };
/** `localStorage` o'zgargach — hamma chaqiruvchiga xabar. */
const refreshUser = () => { cached = readUser(); subscribers.forEach((fn) => fn()); };

export function useAuth() {
  const user = useSyncExternalStore(subscribe, snapshot, snapshot);

  /**
   * Desktop'dagi kirish natijasini saqlaydi.
   *
   * Brauzer versiyasida bu ish `App.jsx` ning modul tanasida, `?auth=`
   * parametridan bajariladi. Desktop'da parametr yo'q — ma'lumot to'g'ridan
   * -to'g'ri formadan keladi, lekin KALITLAR bir xil: ikkala yo'l ham bir xil
   * sessiyani yasashi shart, aks holda `api/index.js` tokenni topolmasdi.
   */
  const login = useCallback(({ token, refresh, deviceId, username, fullName, role, shopCode }) => {
    localStorage.setItem("ek_token",    token);
    localStorage.setItem("ek_type",     "user");
    localStorage.setItem("ek_username", username || "");
    localStorage.setItem("ek_fullName", fullName || username || "");
    localStorage.setItem("ek_role",     role || "");
    localStorage.setItem("ek_shopCode", shopCode || "");
    if (refresh)  localStorage.setItem("ek_refresh",  refresh);
    // Refresh token login paytidagi qurilma id'siga BOG'LANGAN. Boshqa id
    // bilan yangilash "boshqa qurilma" deb rad etiladi va foydalanuvchi bir
    // soatda chiqib ketadi.
    if (deviceId) localStorage.setItem("ek_deviceId", deviceId);
    refreshUser();
  }, []);

  const logout = useCallback(() => {
    ["ek_token","ek_type","ek_username","ek_fullName","ek_role",
     "ek_user","ek_name","ek_shop","ek_shopCode","ek_refresh","ek_deviceId"
    ].forEach((k) => localStorage.removeItem(k));
    /* ⚠ Modul keshini tozalash (V49): keyingi xodim BOSHQA do'konga
       kirishi mumkin (filial almashtirish, umumiy kompyuter). Kesh
       qolib ketsa, u oldingi do'konning menyusini ko'rardi. */
    resetShopFeatures();
    // Til brauzerga tegishli — `ek_lang` o'chirilmaydi.

    // Desktop'da chiqish oynani TASHLAB KETMAYDI: holat tozalanadi va
    // kirish ekrani shu oynada chiziladi.
    if (isNativeShell()) { refreshUser(); return; }
    window.location.replace(withLang(`${LOGIN_URL}?logged_out=1`));
  }, []);

  return { user, login, logout };
}
