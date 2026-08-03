import { LOGIN_URL } from "../config";
import { t, withLang } from "../lib/ek-i18n";
import { useState, useCallback } from "react";

function ls(...keys) {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v !== "null" && v !== "undefined" && v.trim()) return v;
  }
  return "";
}

export function useAuth() {
  const [user] = useState(() => {
    const token = ls("ek_token");
    const type  = ls("ek_type");
    if (!token || type !== "user") return null;
    return {
      username: ls("ek_username", "ek_user") || t("common.username"),
      fullName: ls("ek_fullName", "ek_name") || t("common.username"),
      role:     ls("ek_role") || "",
      shopCode: ls("ek_shopCode", "ek_shop") || "",
    };
  });

  const logout = useCallback(() => {
    ["ek_token","ek_type","ek_username","ek_fullName","ek_role",
     "ek_user","ek_name","ek_shop","ek_shopCode","ek_refresh","ek_deviceId"
    ].forEach((k) => localStorage.removeItem(k));
    // Til brauzerga tegishli — `ek_lang` o'chirilmaydi va kirish
    // ekraniga uzatiladi (originlar turli, localStorage bo'linmaydi).
    window.location.replace(withLang(`${LOGIN_URL}?logged_out=1`));
  }, []);

  return { user, logout };
}
