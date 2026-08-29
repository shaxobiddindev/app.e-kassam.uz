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
  let res;
  try {
    res = await fetch(`${API_BASE}/app${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && getAppToken() ? { "X-App-Token": getAppToken() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    /* ⚠ Brauzerning o'z matni — «Failed to fetch» (2026-08-17 shikoyati).
       U odamga hech narsa demaydi va uni «ilova buzuq» deb o'ylatadi.
       Aslida bu deyarli har doim internet uzilishi yoki server javob
       bermayotgani. Xatoni BELGILAB qo'yamiz — ekran shunga qarab
       «qayta urinish» taklif qiladi. */
    const err = new Error("Internet bilan aloqa yo'q. Ulanishni tekshirib, qayta urinib ko'ring.");
    err.offline = true;
    throw err;
  }
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

  /* ── Kirishning boshqa yo'llari (V40) ──
     ⚠ `methods()` qaysi usul HOZIR ishlashini aytadi: sozlanmagan
     usulni ko'rsatib qo'yish odamni ishlamaydigan yo'lga boshlaydi. */
  methods:      ()             => call("/auth/methods", { auth: false }),

  emailStart:   (email)        => call("/auth/email/start",
                                       { method: "POST", body: { email }, auth: false }),
  emailVerify:  (email, code)  => call("/auth/email/verify",
                                       { method: "POST", body: { email, code }, auth: false }),

  smsStart:     (phone)        => call("/auth/sms/start",
                                       { method: "POST", body: { phone }, auth: false }),
  smsVerify:    (phone, code)  => call("/auth/sms/verify",
                                       { method: "POST", body: { phone, code }, auth: false }),

  /* Telegram NATIV kirish (V41): SDK bergan `id_token` serverda
     tekshiriladi (imzo, `aud`, muddat) va sessiya qaytadi. */
  telegramNative: (idToken) => call("/auth/telegram/native",
                                    { method: "POST", body: { idToken }, auth: false }),

  /* Telegram OIDC: server manzil beradi, brauzer o'sha yerga o'tadi va
     `?code=&state=` bilan qaytadi. */
  oidcStart:    ()             => call("/auth/telegram/oidc/start", { auth: false }),
  oidcFinish:   (code, state)  => call("/auth/telegram/oidc/callback",
                                       { method: "POST", body: { code, state }, auth: false }),

  /* Profildagi pochta — qo'shish va kod bilan tasdiqlash. */
  emailAdd:     (email)        => call("/me/email", { method: "POST", body: { email } }),
  emailConfirm: (code)         => call("/me/email/confirm", { method: "POST", body: { code } }),

  /* ── Bildirishnoma ──
     Qurilma tokeni XODIMNIKIDAN alohida jadvalda (`app_push_tokens`):
     mijoz `users` da yo'q va bu chegara ataylab qo'yilgan. */
  pushRegister: (token, platform = "android") =>
                call("/push/register", { method: "POST", body: { token, platform } }),

  /* ── Profil va do'konlar ── */
  me:         ()      => call("/me"),
  updateMe:   (data)  => call("/me", { method: "PUT", body: data }),
  /* HISOBNI O'CHIRISH (V49) — Google Play talabi.
     ⚠ Do'konning mijoz yozuvi (qarz, ball, xarid tarixi) O'CHMAYDI, faqat
     bog'lanish uziladi — sabab serverdagi `deleteAccount` izohida va
     foydalanuvchiga oynada ochiq aytiladi. */
  deleteMe:   ()      => call("/me", { method: "DELETE" }),
  shops:      ()      => call("/shops"),
  /* Aylanma karta siri (V45) — bir marta olinadi, keyin kod ILOVADA,
     oflaynda yasaladi. ⚠ Bu chaqiruvdan keyin server o'sha kartadan
     TOTP talab qila boshlaydi. */
  cardSecret: (id)    => call(`/shops/${id}/card-secret`, { method: "POST" }),

  /* ── Qarzlarim (V46) ──
     ⚠ Ro'yxat PUSH DAN MUSTAQIL: push kelmasligi mumkin (tokeni yo'q,
     telefon o'chiq, ruxsat berilmagan) — o'shanda ham mijoz ilovani
     ochib qarzini ko'radi. */
  debts:      ()      => call("/debts"),
  answerDebt: (id, confirmed, note) =>
    call(`/debts/${id}/answer?confirmed=${confirmed}`
         + (note ? `&note=${encodeURIComponent(note)}` : ""), { method: "POST" }),

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
