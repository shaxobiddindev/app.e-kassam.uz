// ╔══════════════════════════════════════════════════════════════╗
// ║           BARCHA URL VA SOZLAMALAR SHU YERDA               ║
// ║   Deployment uchun faqat DOMAIN ni o'zgartiring            ║
// ╚══════════════════════════════════════════════════════════════╝

// `npm run dev` → LOCALHOST, `npm run build` → PRODUCTION (avtomatik).
// Boshqa qiymat kerak bo'lsa .env faylida VITE_* ni bering.
const PROD = import.meta.env.PROD;

export const API_BASE  = import.meta.env.VITE_API_BASE
  ?? (PROD ? `https://api.e-kassam.uz/api` : `http://localhost:8080/api`);
export const LOGIN_URL = import.meta.env.VITE_LOGIN_URL
  ?? (PROD ? `https://auth.e-kassam.uz`    : `http://localhost:5175`);

// ── Brend fayllari ────────────────────────────────────────────
// SVG — rastr emas: har qanday ekranda aniq va ~20 barobar yengil.
// Fayllar packages/brand/logo/ dan sync-tokens.ps1 orqali public/ ga tushadi.
export const LOGO_URL      = "/lockup-light.svg";   // yorug' fonda (oq plastinka)
export const LOGO_DARK_URL = "/lockup-dark.svg";    // qorong'i panelda
export const MARK_URL      = "/mark-color.svg";     // yolg'iz belgi, 32px+
export const MARK_SMALL_URL= "/mark-small.svg";     // 32px dan kichik

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

// ── Formatlash ────────────────────────────────────────────────
// 02-DESIGN-SYSTEM.md: komponentda `toLocaleString` chaqirilmaydi.
// Yagona manba — src/lib/ek-format.js (packages/ui dan sinxronlanadi).
export {
  groupDigits, money as fmtMoney, qty, quantity, percent,
  date as fmtDate, dateTime as fmtDateTime, time as fmtTime,
  phone as fmtPhone, initials,
} from "./lib/ek-format";

import { money as _money } from "./lib/ek-format";

/** Pul + "so'm". Jadval ustunida birlik sarlavhada bo'lsa `fmtMoney` ishlating. */
export const money = (n) => _money(n, { withUnit: true });

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

/* ══════════════════════════════════════════════════════════════════════════
   FISKAL MODUL — MVP DA YASHIRIN

   ⚠ NEGA BAYROQ, NEGA O'CHIRISH EMAS. Soliq bilan bog'liq maydonlar
   (QQS stavkasi, MXIK/IKPU, qadoq kodi, «narx QQS bilan») MVP da
   kerak emas: ular do'kon egasini fiskal modul hali ulanmagan turib
   ham to'ldirishga majburlaydi va formani ikki barobar uzaytiradi.

   Lekin kod O'CHIRILMAYDI va ustunlar BAZADA QOLADI:

     · ular allaqachon ishlaydi va fiskal modul ulanganda kerak bo'ladi;
     · o'chirilsa, qaytadan yozish bir necha kunlik ish bo'lardi;
     · to'ldirilgan tovarlarning ma'lumoti YO'QOLMASLIGI kerak — bugun
       yashirilgan maydon ertaga o'sha qiymati bilan qaytadi.

   ⚠ QIYMATLAR SAQLANADI: forma yashirilgan maydonlarni ham serverga
   bor holicha yuboradi. Aks holda tovarni tahrirlash uni jimgina
   fiskal jihatdan «to'ldirilmagan» holatga o'tkazib qo'yardi.

   Yoqish uchun: shu qiymatni `true` qiling.
   ══════════════════════════════════════════════════════════════════════════ */
export const FISCAL_UI = false;
