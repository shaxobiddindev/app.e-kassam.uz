import { API_BASE, LOGIN_URL, getDeviceId } from "../config";
import { getLang, withLang } from "../lib/ek-i18n";
import { isDesktop } from "../lib/ek-desktop";

/**
 * Sessiya tiklab bo'lmadi — foydalanuvchini kirish ekraniga qaytaramiz.
 *
 * ⚠ Desktop'da `auth.e-kassam.uz` ga YO'NALTIRILMAYDI: `.exe` oynasi tashqi
 * sahifaga o'tsa kassir ilovadan chiqib qoladi va orqaga yo'l topolmaydi.
 * O'rniga sessiya tozalanadi va oyna qayta yuklanadi — `App.jsx` kirish
 * ekranini shu oynada chizadi.
 */
function forceLogout() {
  const lang = localStorage.getItem("ek_lang");
  localStorage.clear();
  if (lang) localStorage.setItem("ek_lang", lang);

  if (isDesktop()) window.location.reload();
  else window.location.replace(withLang(`${LOGIN_URL}?logged_out=1`));
}

let refreshPromise = null;

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = (async () => {
    try {
      const refresh = localStorage.getItem("ek_refresh");
      const deviceId = getDeviceId();
      if (!refresh) return false;

      // `credentials: include` — refresh token httpOnly cookie'da keladi
      // (05-AUTH.md). Server avval cookie'ni oladi; tanadagi token esa hozircha
      // zaxira sifatida yuboriladi, chunki eski sessiyalar localStorage'da.
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept":       "application/json",
          "X-Device-Id":  deviceId,
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!res.ok) return false;

      const json = await res.json().catch(() => ({}));
      if (!json.success || !json?.data?.accessToken) {
        return false;
      }

      const newToken   = json.data.accessToken;
      const newRefresh = json.data.refreshToken;

      localStorage.setItem("ek_token",   newToken);
      localStorage.setItem("ek_refresh", newRefresh || refresh);
      return true;
    } catch (_) {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

/* ── Bajik ────────────────────────────────────────────────────
   Skanerlangan bajik shu modul o'zgaruvchisida turadi va faqat BITTA
   so'rovga qo'shiladi (`BadgeProvider` qayta urinishdan oldin qo'yadi).

   ⚠ Nega holat/kontekstda emas: bajik `request()` ning ICHIGA tushishi
   kerak, u esa React daraxtidan tashqarida. Har API chaqiruviga qo'shimcha
   parametr qo'shish yuzlab joyni o'zgartirishni talab qilardi va bitta
   unutilgan joy himoyani jimgina o'chirib qo'yardi.

   ⚠⚠ Bajik hech qachon `localStorage` ga YOZILMAYDI: u faqat skanerdan
   keladi va ishlatilgach darhol o'chadi. Saqlansa — nusxa olish uchun
   ochiq turgan joy paydo bo'lardi. */
let pendingBadgeToken = null;

export function setPendingBadgeToken(token) {
  pendingBadgeToken = token || null;
}

/** 428 → bajik kerak. Klient buni oddiy xatodan ajratishi shart. */
export class BadgeRequiredError extends Error {
  constructor(message, action, policy) {
    super(message);
    this.name = "BadgeRequiredError";
    this.badgeRequired = true;
    this.action = action;
    this.policy = policy;
  }
}

async function request(path, options = {}, _retry = false) {
  const token    = localStorage.getItem("ek_token");
  const { headers: extraHeaders, ...restOptions } = options;

  // Bajik BIR MARTA ishlatiladi — o'qib olib darhol tozalaymiz, aks holda
  // keyingi so'rovlarga ham ilashib ketardi.
  const badge = pendingBadgeToken;
  pendingBadgeToken = null;

  const headers = {
    "Content-Type":    "application/json",
    // Backend xato xabarlari foydalanuvchi tilida kelsin
    "Accept-Language": getLang(),
    "X-Device-Id":     getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(badge ? { "X-Badge-Token": badge } : {}),
    ...(extraHeaders || {}),
  };

  // ⚠ `undefined` qiymatli sarlavha O'CHIRILADI, aks holda `fetch` uni
  // "undefined" MATNI sifatida yuboradi. Bu fayl yuklashda kerak:
  // `FormData` uchun `Content-Type` ni brauzerning o'zi boundary bilan
  // yozishi shart, biz esa standart `application/json` ni olib tashlaymiz.
  for (const key of Object.keys(headers)) {
    if (headers[key] === undefined) delete headers[key];
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    credentials: "include",
    headers,
  });

  // Token muddati o'tgan — refresh qilib qayta urinib ko'r
  if (res.status === 401 && !_retry) {
    if (path.includes("/auth/login")) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `Xatolik: ${res.status}`);
    }
    
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Yangi token bilan qayta so'rov
      return request(path, options, true);
    } else {
      // Refresh ham ishlamadi — login ga
      forceLogout();
      throw new Error("AUTH_FAILED");
    }
  }

  // 2-urinishda ham 401 — login ga
  if (res.status === 401 && _retry) {
    forceLogout();
    throw new Error("AUTH_FAILED");
  }

  const json = await res.json().catch(() => ({}));

  // 428 — bajik kerak. Alohida xato sinfi: chaqiruvchi buni ushlab
  // skanerlash modalini ochadi va SO'ROVNI QAYTA yuboradi.
  if (res.status === 428 && json.badgeRequired) {
    throw new BadgeRequiredError(json.message || "Bajikni skanerlang", json.action, json.policy);
  }

  if (!res.ok) throw new Error(json.message || `Xatolik: ${res.status}`);
  return json;
}

// ─── Auth ─────────────────────────────────────────────────────
export const authApi = {
  userLogin: (data) =>
    request("/auth/login", {
      method: "POST",
      headers: { "X-Device-Id": getDeviceId() },
      body: JSON.stringify(data),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
};

// ─── Hisobotlar ───────────────────────────────────────────────
export const reportApi = {
  daily:   (shopId)        => request(`/reports/daily${shopId ? `?shopId=${shopId}` : ""}`),
  weekly:  (shopId)        => request(`/reports/weekly${shopId ? `?shopId=${shopId}` : ""}`),
  monthly: (shopId)        => request(`/reports/monthly${shopId ? `?shopId=${shopId}` : ""}`),
  custom:  (from, to, shopId) => request(`/reports/custom?from=${from}&to=${to}${shopId ? `&shopId=${shopId}` : ""}`),
};

// ─── Mahsulotlar ──────────────────────────────────────────────
export const productApi = {
  getAll:       (shopId)   => request(`/products${shopId ? `?shopId=${shopId}` : ""}`),
  /** Kassa ro'yxati — kategoriya va «tez tovarlar» filtri bilan. */
  search:       (q = "", page = 0, size = 30, shopId, opts = {}) => {
                  const p = new URLSearchParams({ q, page, size });
                  if (shopId) p.set("shopId", shopId);
                  if (opts.categoryId) p.set("categoryId", opts.categoryId);
                  if (opts.favorites) p.set("favorites", "true");
                  return request(`/products/search?${p}`);
                },
  /**
   * Skanerlangan kod. Bitta so'rovda: oddiy barkod, qadoq barkodi (miqdor
   * karraga oshadi), tarozi barkodi (og'irlik ichida) yoki umumiy katalog
   * taklifi. Kassa endi barkodni o'zi tahlil qilmaydi — mantiq serverda.
   */
  scan:         (code, shopId) =>
                  request(`/products/scan?code=${encodeURIComponent(code)}${shopId ? `&shopId=${shopId}` : ""}`),
  getById:      (id)       => request(`/products/${id}`),
  create:       (data)     => request("/products",     { method: "POST",   body: JSON.stringify(data) }),
  update:       (id, data) => request(`/products/${id}`, { method: "PUT",  body: JSON.stringify(data) }),
  delete:       (id)       => request(`/products/${id}`, { method: "DELETE" }),
  toggleActive: (id)       => request(`/products/${id}/toggle-active`, { method: "PATCH" }),
  fiscalReadiness: ()      => request("/products/fiscal-readiness"),

  // ⚠ Kategoriya endi TANADA yuboriladi (`?name=` emas): nomdan tashqari
  // rang, ikonka va standart qiymatlar ham bor.
  getCategories:  (shopId)   => request(`/products/categories${shopId ? `?shopId=${shopId}` : ""}`),
  createCategory: (data, shopId)     => request(`/products/categories${shopId ? `?shopId=${shopId}` : ""}`,
                                          { method: "POST", body: JSON.stringify(typeof data === "string" ? { name: data } : data) }),
  updateCategory: (id, data, shopId) => request(`/products/categories/${id}${shopId ? `?shopId=${shopId}` : ""}`,
                                          { method: "PUT", body: JSON.stringify(typeof data === "string" ? { name: data } : data) }),
  deleteCategory: (id, shopId)       => request(`/products/categories/${id}${shopId ? `?shopId=${shopId}` : ""}`, { method: "DELETE" }),

  getVariantGroups: (shopId) => request(`/products/variant-groups${shopId ? `?shopId=${shopId}` : ""}`),
  createVariantGroup: (data) => request("/products/variant-groups", { method: "POST", body: JSON.stringify(data) }),
};

// ─── Tayyor katalog va global barkod bazasi ───────────────────
export const catalogApi = {
  templates:  ()      => request("/catalog/templates"),
  template:   (key)   => request(`/catalog/templates/${key}`),
  apply:      (data)  => request("/catalog/apply", { method: "POST", body: JSON.stringify(data) }),
  global:     (barcode) => request(`/catalog/global/${encodeURIComponent(barcode)}`),
  globalSearch: (q, page = 0, size = 30) =>
                  request(`/catalog/global?q=${encodeURIComponent(q)}&page=${page}&size=${size}`),
};

// ─── Markirovka ("Asl Belgisi") ───────────────────────────────
/**
 * ⚠ Kod TANADA yuboriladi, `?code=` da emas: DataMatrix ichida GS (0x1D)
 * boshqaruv belgisi bor va u URL'da ishonchli o'tmaydi. JSON'da esa
 * `JSON.stringify` uni `` qilib o'zi qochiradi.
 */
export const markingApi = {
  check:    (code)              => request("/marking/check", { method: "POST", body: JSON.stringify({ code }) }),
  receive:  (productId, codes)  => request("/marking/receive", { method: "POST", body: JSON.stringify({ productId, codes }) }),
  list:     (status, productId, page = 0, size = 50) => {
              const p = new URLSearchParams({ page, size });
              if (status) p.set("status", status);
              if (productId) p.set("productId", productId);
              return request(`/marking?${p}`);
            },
  stats:    ()                  => request("/marking/stats"),
  writeOff: (id, reason)        => request(`/marking/${id}/write-off`, { method: "PATCH", body: JSON.stringify({ reason }) }),
};

// ─── Fiskal cheklar ───────────────────────────────────────────
export const fiscalApi = {
  status:   ()        => request("/fiscal/status"),
  receipts: (status, page = 0, size = 50) => {
              const p = new URLSearchParams({ page, size });
              if (status) p.set("status", status);
              return request(`/fiscal/receipts?${p}`);
            },
  // Kassa chek chop etishdan oldin bir marta so'raydi (kutib qolmaydi).
  bySale:   (saleId)  => request(`/fiscal/by-sale/${saleId}`),
  retry:    (id)      => request(`/fiscal/receipts/${id}/retry`, { method: "POST" }),
};

// ─── Rasmlar ──────────────────────────────────────────────────
/**
 * ⚠ `Content-Type` ATAYLAB qo'yilmaydi: `FormData` uchun uni brauzer o'zi
 * `multipart/form-data; boundary=…` qilib yozadi. Qo'lda yozilsa boundary
 * tushib qoladi va server faylni umuman ko'rmaydi.
 */
export const mediaApi = {
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/media", { method: "POST", body: fd, headers: { "Content-Type": undefined } });
  },
  /** Nisbiy yo'lni (`/media/abc.jpg`) to'liq manzilga aylantiradi. */
  url: (path) => (path ? `${API_BASE}${path}` : null),
};

// ─── Ombor ────────────────────────────────────────────────────
export const inventoryApi = {
  getAll: (shopId) => request(`/inventory${shopId ? `?shopId=${shopId}` : ""}`),
  getLow: () => request("/inventory/low-stock"),
  // expiryDate ixtiyoriy — bo'sh bo'lsa muddatsiz partiya (idish, kanstovar)
  // `markingCodes` — faqat markirovkali tovarda. Server kirim miqdorini
  // qabul qilingan yorliqlar soniga tenglashtiradi.
  addStock: (productId, qty, expiryDate, reason, markingCodes = null) =>
    request(`/inventory/product/${productId}/add`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: Number(qty),
        expiryDate: expiryDate || null,
        reason: reason || null,
        ...(markingCodes ? { markingCodes } : {}),
      }),
    }),
  // To'g'irlash PARTIYA bo'yicha (inventoryId) — mahsulot bo'yicha emas:
  // ko'p partiyali mahsulotda "qaysi birini" degan noaniqlik bo'lardi.
  correctBatch: (inventoryId, qty, reason) =>
    request(`/inventory/batch/${inventoryId}/correct`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: Number(qty), reason: reason || null }),
    }),
  // Kirim-chiqim jurnali
  getMovements: (productId, page = 0, size = 50) =>
    request(`/inventory/movements?page=${page}&size=${size}${productId ? `&productId=${productId}` : ""}`),
};

// ─── Xavfsizlik: bajik, smena, jurnal, obuna ──────────────────
export const securityApi = {
  // Bajik — FAQAT do'kon egasi (backend ham yo'l darajasida cheklaydi).
  // `issue` javobidagi `token` BIR MARTA keladi va saqlanmaydi.
  issueBadge:  (userId) => request(`/security/badges/${userId}`, { method: "POST" }),
  revokeBadge: (userId) => request(`/security/badges/${userId}`, { method: "DELETE" }),
  badges:      ()       => request("/security/badges"),

  policies:    ()               => request("/security/policies"),
  setPolicy:   (action, data)   => request(`/security/policies/${action}`, {
                                     method: "PUT", body: JSON.stringify(data) }),

  log:              (onlySuspicious = false, page = 0, size = 50) =>
                      request(`/security/log?onlySuspicious=${onlySuspicious}&page=${page}&size=${size}`),
  suspiciousCount:  () => request("/security/log/suspicious-count"),
  acknowledge:      (id) => request(`/security/log/${id}/ack`, { method: "PATCH" }),

  /* ⚠ Smena KASSAGA tegishli (`X-Device-Id` bo'yicha), xodimga emas.
     Hamkasb allaqachon ochgan bo'lsa yangisi ochilmaydi — chaqiruvchi
     o'shanga qo'shiladi va bajigi ishlay boshlaydi. */
  openShift:    (openingFloat) => request("/security/shift/open", {
                  method: "POST", body: JSON.stringify({ openingFloat }) }),
  /* Yopish javobi — Z-HISOBOT (yakuniy). X — ochiq smenaning oraliq holati.
     ⚠ `countedCash` MAJBURIY: yopish "tugatish" emas, naqdni topshirish. */
  closeShift:   (countedCash) => request("/security/shift/close", {
                  method: "POST", body: JSON.stringify({ countedCash }) }),
  /* Oldingi smenada sanalgan naqd — yangi smenaga boshlang'ich taklif. */
  suggestedFloat: () => request("/security/shift/suggested-float"),
  cashMovements:  () => request("/security/cash"),
  addCash:        (data) => request("/security/cash", { method: "POST", body: JSON.stringify(data) }),
  shiftReport:  () => request("/security/shift/report"),
  currentShift: () => request("/security/shift/current"),
  openShifts:   () => request("/security/shift/open-list"),

  // Serverda mavjud bo'lmagan amalni tasdiqlash (savatdan o'chirish,
  // pul yashigini ochish) — bajik `setPendingBadgeToken` orqali ketadi.
  confirm: (data) => request("/security/confirm", { method: "POST", body: JSON.stringify(data) }),

  billing: () => request("/security/billing"),
};

// ─── Mijozlar ─────────────────────────────────────────────────
export const customerApi = {
  /* ── Nasiya ────────────────────────────────────────────────────
     Qarz JURNALDA saqlanadi, balans esa undan hisoblangan kesh —
     "qarz qayerdan chiqdi" degan savolga javob bo'lishi uchun. */
  payDebt:   (id, data) => request(`/customers/${id}/payment`, { method: "POST", body: JSON.stringify(data) }),
  adjustDebt:(id, data) => request(`/customers/${id}/adjust`,  { method: "POST", body: JSON.stringify(data) }),
  ledger:    (id) => request(`/customers/${id}/ledger`),
  debtors:   () => request("/customers/debtors"),
  /** `value` bo'sh bo'lsa do'kon standartiga qaytadi. */
  setCreditLimit: (id, value) =>
    request(`/customers/${id}/credit-limit${value == null || value === "" ? "" : `?value=${value}`}`,
            { method: "PATCH" }),

  getAll:  (shopId)    => request(`/customers${shopId ? `?shopId=${shopId}` : ""}`),
  getById: (id)        => request(`/customers/${id}`),
  create:  (data)      => request("/customers",      { method: "POST", body: JSON.stringify(data) }),
  update:  (id, data)  => request(`/customers/${id}`, { method: "PUT",  body: JSON.stringify(data) }),
  delete:  (id)        => request(`/customers/${id}`, { method: "DELETE" }),
};

// ─── Sotuvlar ─────────────────────────────────────────────────
export const saleApi = {
  getAll:  (shopId) => request(`/sales${shopId ? `?shopId=${shopId}` : ""}`),
  getById: (id)          => request(`/sales/${id}`),
  create:  (data)        => request("/sales",       { method: "POST",  body: JSON.stringify(data) }),
  cancel:  (id)          => request(`/sales/${id}/cancel`, { method: "PATCH" }),
  /** Qaytarish — tanlangan qatorlar bo'yicha. Bekor qilishdan BOSHQA amal:
      bu yerda tovar javonga qaytadi va qoldiq tiklanadi. */
  returnSale: (id, data) => request(`/sales/${id}/return`, { method: "POST", body: JSON.stringify(data) }),
};


// ─── Do'kon profili va foydalanuvchilar (Shop admin) ───
export const shopApi = {
  getProfile: () => request("/shop/profile"),
  /** Faoliyat turi — tayyor katalog va kassa ekrani standartini belgilaydi. */
  setBusinessType: (type) => request(`/shop/business-type?type=${type}`, { method: "PATCH" }),
  /** Kamomad chegarasi — faqat egasi. */
  setCashTolerance: (value) => request(`/shop/cash-tolerance?value=${value}`, { method: "PATCH" }),
  /** Do'kon bo'yicha eng katta chegirma foizi. */
  setDiscountLimit: (percent) => request(`/shop/discount-limit?percent=${percent}`, { method: "PATCH" }),
  /** Qaytarish muddati (kun). 0 — har safar rahbar tasdig'i. */
  setReturnDays: (days) => request(`/shop/return-days?days=${days}`, { method: "PATCH" }),
  /** Nasiya chegarasi — do'kon standarti. */
  setCreditLimit: (value) => request(`/shop/credit-limit?value=${value}`, { method: "PATCH" }),
  getUsers:   (shopId) => request(`/shop/users${shopId ? `?shopId=${shopId}` : ""}`),
  createUser: (data, shopId) => request(`/shop/users${shopId ? `?shopId=${shopId}` : ""}`, { method: "POST", body: JSON.stringify(data) }),
  updateUser: (userId, data, shopId) => request(`/shop/users/${userId}${shopId ? `?shopId=${shopId}` : ""}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (userId, shopId) => request(`/shop/users/${userId}${shopId ? `?shopId=${shopId}` : ""}`, { method: "DELETE" }),
  toggleBlockUser: (userId, shopId) => request(`/shop/users/${userId}/toggle-block${shopId ? `?shopId=${shopId}` : ""}`, { method: "PATCH" }),
  /**
   * Xodimning SHAXSIY chegirma chegarasi. `percent` bo'sh bo'lsa chegara
   * olib tashlanadi va do'kon chegarasi ishlaydi — shuning uchun `0` bilan
   * adashtirmaslik kerak: `0` = "bu xodim umuman chegirma bera olmaydi".
   */
  setUserDiscountLimit: (userId, percent, shopId) => {
    const p = new URLSearchParams();
    if (shopId) p.set("shopId", shopId);
    if (percent !== null && percent !== "") p.set("percent", percent);
    const q = p.toString();
    return request(`/shop/users/${userId}/discount-limit${q ? `?${q}` : ""}`, { method: "PATCH" });
  },
  
  getBranches: () => request("/shop/branches"),
  createBranch: (data) => request("/shop/branches", { method: "POST", body: JSON.stringify(data) }),
  updateBranch: (id, data) => request(`/shop/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};
