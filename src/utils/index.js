export const API_BASE = "http://localhost:8080/api";

export const LOGO_URL = "/logo.png";

export const money = (n) =>
  new Intl.NumberFormat("uz-UZ").format(Number(n) || 0) + " so'm";

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("uz-UZ") : "—";

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("uz-UZ") : "—";

export const initials = (s = "") =>
  (s || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

// DeviceId — bir marta generate qilinadi, o'zgarmaydi
export function getDeviceId() {
  let id = localStorage.getItem("ek_deviceId");
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem("ek_deviceId", id);
  }
  return id;
}

// Enum labellar
export const SHOP_STATUS = {
  ACTIVE:    { label: "Aktiv",         color: "green"  },
  BLOCKED:   { label: "Bloklangan",    color: "red"    },
  SUSPENDED: { label: "To'xtatilgan",  color: "yellow" },
  DELETED:   { label: "O'chirilgan",   color: "red"    },
};

export const ROLE_LABELS = {
  OWNER:       "Egasi",
  SHOP_ADMIN:  "Do'kon Admin",
  STOREKEEPER: "Omborchi",
  CASHIER:     "Kassir",
};

export const confirmDelete = (name) =>
  window.confirm(`${name} ni o'chirishni tasdiqlaysizmi?`);
