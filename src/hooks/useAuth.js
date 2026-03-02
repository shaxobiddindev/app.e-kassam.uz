import { LOGIN_URL } from "../config";
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
      username: ls("ek_username", "ek_user") || "Foydalanuvchi",
      fullName: ls("ek_fullName", "ek_name") || "Foydalanuvchi",
      role:     ls("ek_role") || "",
      shopCode: ls("ek_shopCode", "ek_shop") || "",
    };
  });

  const logout = useCallback(() => {
    ["ek_token","ek_type","ek_username","ek_fullName","ek_role",
     "ek_user","ek_name","ek_shop","ek_shopCode","ek_refresh","ek_deviceId"
    ].forEach((k) => localStorage.removeItem(k));
    window.location.replace(`${LOGIN_URL}?logged_out=1`);
  }, []);

  return { user, logout };
}
