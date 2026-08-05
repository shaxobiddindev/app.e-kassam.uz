import { LOGIN_URL } from "../config";
import { t, withLang } from "../lib/ek-i18n";
import { isDesktop } from "../lib/ek-desktop";
import { useState, useCallback } from "react";

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

export function useAuth() {
  const [user, setUser] = useState(readUser);

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
    setUser(readUser());
  }, []);

  const logout = useCallback(() => {
    ["ek_token","ek_type","ek_username","ek_fullName","ek_role",
     "ek_user","ek_name","ek_shop","ek_shopCode","ek_refresh","ek_deviceId"
    ].forEach((k) => localStorage.removeItem(k));
    // Til brauzerga tegishli — `ek_lang` o'chirilmaydi.

    // Desktop'da chiqish oynani TASHLAB KETMAYDI: holat tozalanadi va
    // kirish ekrani shu oynada chiziladi.
    if (isDesktop()) { setUser(null); return; }
    window.location.replace(withLang(`${LOGIN_URL}?logged_out=1`));
  }, []);

  return { user, login, logout };
}
