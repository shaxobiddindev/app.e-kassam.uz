// ─── Barcha 3 loyiha bir xil kalitlarni ishlatadi ────────────
export const API_BASE   = "http://localhost:8080/api";
export const LOGIN_URL  = "http://localhost:5175";
export const APP_URL    = "http://localhost:5173";
export const ADMIN_URL  = "http://localhost:5174";

// localStorage kalitlari
export const K = {
  token:    "ek_token",
  refresh:  "ek_refresh",
  type:     "ek_type",      // "admin" | "user"
  username: "ek_username",
  fullName: "ek_fullName",
  role:     "ek_role",
  shopCode: "ek_shopCode",
  deviceId: "ek_deviceId",
};

export function getDeviceId() {
  let id = localStorage.getItem(K.deviceId);
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(K.deviceId, id);
  }
  return id;
}

export const LOGO_URL =
  "https://raw.githubusercontent.com/shaxobiddindev/e-kassam-frontend/main/images/logo.png";

export const money = (n) =>
  new Intl.NumberFormat("uz-UZ").format(Number(n) || 0) + " so'm";

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("uz-UZ") : "—";

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("uz-UZ") : "—";

export const initials = (s = "") =>
  (s || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
