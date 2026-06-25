// ╔══════════════════════════════════════════════════════════════╗
// ║           BARCHA URL VA SOZLAMALAR SHU YERDA               ║
// ║   Deployment uchun faqat DOMAIN ni o'zgartiring            ║
// ╚══════════════════════════════════════════════════════════════╝

// ┌──────────────────────────────────────────────────────────────┐
// │  🔧 YAGONA SOZLAMA — faqat shu qatorni o'zgartiring        │
// │  Masalan: "e-kassam.uz" → "test.e-kassam.uz"               │
// │  Qolgan barcha URL lar avtomatik o'zgaradi                 │
// └──────────────────────────────────────────────────────────────┘

export const API_BASE  = `https://api.e-kassam.uz/api`;
export const LOGIN_URL = `https://auth.e-kassam.uz`;

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

export const maskPhone = (val) => {
  let v = (val || "").replace(/\D/g, "");
  if (v.length > 0 && !v.startsWith("998")) v = "998" + v;
  if (v.length < 3) v = "998";
  v = v.slice(0, 12);

  if (v.length <= 3) return "+" + v;
  if (v.length <= 5) return "+" + v.slice(0, 3) + " (" + v.slice(3);
  if (v.length <= 8) return "+" + v.slice(0, 3) + " (" + v.slice(3, 5) + ") " + v.slice(5);
  if (v.length <= 10) return "+" + v.slice(0, 3) + " (" + v.slice(3, 5) + ") " + v.slice(5, 8) + "-" + v.slice(8);
  return "+" + v.slice(0, 3) + " (" + v.slice(3, 5) + ") " + v.slice(5, 8) + "-" + v.slice(8, 10) + "-" + v.slice(10);
};

export const cleanPhone = (val) => {
  let v = (val || "").replace(/\D/g, "");
  if (v.length > 0 && !v.startsWith("998")) v = "998" + v;
  if (v.length < 3) v = "998";
  return v.slice(0, 12);
};
