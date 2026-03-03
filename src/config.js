// ╔══════════════════════════════════════════════════════════════╗
// ║           BARCHA URL VA SOZLAMALAR SHU YERDA               ║
// ║   Deployment uchun faqat shu faylni o'zgartiring           ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Server URL ─────────────────────────────────────────────────
export const API_BASE  = "https://api.e-kassam.uz/api";

// ── Frontend URL lar ───────────────────────────────────────────
export const LOGIN_URL = "https://auth.e-kassam.uz";

// ── Logo (public/ papkasiga logo.png qo'ying) ──────────────────
export const LOGO_URL  = "/logo.png";

// ── localStorage kalitlari ─────────────────────────────────────
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

// ── Yordamchi funksiyalar ──────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem(K.deviceId);
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(K.deviceId, id);
  }
  return id;
}

export const money = (n) =>
  new Intl.NumberFormat("uz-UZ").format(Number(n) || 0) + " so'm";

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("uz-UZ") : "—";

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("uz-UZ") : "—";

export const initials = (s = "") =>
  (s || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
