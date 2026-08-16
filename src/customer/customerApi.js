/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ ILOVASINING API QATLAMI (V37)

   ⚠ `src/api/index.js` ATAYLAB ishlatilmaydi: u har so'rovga XODIM
   tokenini qo'shadi va 401 da xodim kirish sahifasiga otadi. Mijozda esa
   xodim tokeni yo'q va uni kassa kirishiga yuborish mantiqsiz.

   Kalit `X-App-Token` sarlavhasida — xodimning `Authorization: Bearer` i
   bilan ataylab boshqa: bitta qurilmada ikkalasi ham bo'lishi mumkin
   (do'kon egasi ham oddiy mijoz).
   ══════════════════════════════════════════════════════════════════════════ */
import { API_BASE } from "../config";

export const APP_TOKEN_KEY = "ek_app_token";

export const getAppToken = () => localStorage.getItem(APP_TOKEN_KEY) || "";
export const setAppToken = (t) => localStorage.setItem(APP_TOKEN_KEY, t);
export const clearAppToken = () => localStorage.removeItem(APP_TOKEN_KEY);

async function call(path, { method = "GET", body, auth = true } = {}) {
  const res = await fetch(`${API_BASE}/app${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && getAppToken() ? { "X-App-Token": getAppToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || `Xatolik ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export const appApi = {
  /* ── Kirish ── */
  loginStart: ()      => call("/auth/telegram/start", { method: "POST", auth: false }),
  loginPoll:  (code)  => call(`/auth/telegram/poll?code=${encodeURIComponent(code)}`, { auth: false }),
  /* ⚠ Chiqishda qurilma push tokeni ham unutiladi — telefonda boshqa
     odam kirsa, xabarlar eski egaga kelib turmasin. */
  logout:     (push)  => call(`/auth/logout${push ? `?push=${encodeURIComponent(push)}` : ""}`,
                              { method: "POST" }),

  /* ── Bildirishnoma ──
     Qurilma tokeni XODIMNIKIDAN alohida jadvalda (`app_push_tokens`):
     mijoz `users` da yo'q va bu chegara ataylab qo'yilgan. */
  pushRegister: (token, platform = "android") =>
                call("/push/register", { method: "POST", body: { token, platform } }),

  /* ── Profil va do'konlar ── */
  me:         ()      => call("/me"),
  updateMe:   (data)  => call("/me", { method: "PUT", body: data }),
  shops:      ()      => call("/shops"),

  /* ── Cheklar ──
     ⚠ Lenta HAMMA do'kon bo'yicha bitta ro'yxat (server qo'shib beradi),
     bitta chekni ochishda esa qaysi do'kondagi yozuv ekani ham
     yuboriladi — mijozning har do'konda alohida `customers.id` si bor. */
  receipts:   (limit = 30) => call(`/receipts?limit=${limit}`),

  /* ── Ball tarixi ──
     ⚠ Do'kon bo'yicha ALOHIDA: ballar do'konlar o'rtasida ko'chmaydi,
     aralash lenta esa mijozni chalkashtirardi. */
  bonus:      (customerId, limit = 50) =>
                call(`/bonus?c=${encodeURIComponent(customerId)}&limit=${limit}`),

  /* ── Aksiyalar ──
     Mijozning barcha do'konlaridagi JORIY e'lonlar; muddati o'tgani
     serverda filtrlanadi (tugagan aksiya do'konni yolg'onchi qiladi). */
  announcements: () => call("/announcements"),
};
