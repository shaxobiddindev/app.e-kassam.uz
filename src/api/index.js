import { API_BASE, LOGIN_URL, getDeviceId } from "../config";

// Refresh qilish jarayonida loop oldini olish
let _isRefreshing = false;
let _refreshFailed = false;

async function tryRefreshToken() {
  if (_isRefreshing || _refreshFailed) return false;
  _isRefreshing = true;
  try {
    const refresh = localStorage.getItem("ek_refresh");
    const deviceId = getDeviceId();
    if (!refresh) return false;

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
      },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!res.ok) {
      _refreshFailed = true;
      return false;
    }

    const json = await res.json();
    const newToken   = json?.data?.accessToken;
    const newRefresh = json?.data?.refreshToken;
    if (!newToken) { _refreshFailed = true; return false; }

    localStorage.setItem("ek_token",   newToken);
    localStorage.setItem("ek_refresh", newRefresh || refresh);
    return true;
  } catch (_) {
    _refreshFailed = true;
    return false;
  } finally {
    _isRefreshing = false;
  }
}

async function request(path, options = {}, _retry = false) {
  const token    = localStorage.getItem("ek_token");
  const { headers: extraHeaders, ...restOptions } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type":    "application/json",
      "Accept-Language": "uz",
      "X-Device-Id":     getDeviceId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders || {}),
    },
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
      localStorage.clear();
      window.location.replace(`${LOGIN_URL}?logged_out=1`);
      return {};
    }
  }

  // 2-urinishda ham 401 — login ga
  if (res.status === 401 && _retry) {
    localStorage.clear();
    window.location.replace(`${LOGIN_URL}?logged_out=1`);
    return {};
  }

  const json = await res.json().catch(() => ({}));
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
  daily:   () => request("/reports/daily"),
  weekly:  () => request("/reports/weekly"),
  monthly: () => request("/reports/monthly"),
  custom:  (from, to) => request(`/reports/custom?from=${from}&to=${to}`),
};

// ─── Mahsulotlar ──────────────────────────────────────────────
export const productApi = {
  getAll:       ()         => request("/products"),
  search:       (q = "", page = 0, size = 30) =>
                  request(`/products/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`),
  getById:      (id)       => request(`/products/${id}`),
  create:       (data)     => request("/products",     { method: "POST",   body: JSON.stringify(data) }),
  update:       (id, data) => request(`/products/${id}`, { method: "PUT",  body: JSON.stringify(data) }),
  delete:       (id)       => request(`/products/${id}`, { method: "DELETE" }),
  toggleActive: (id)       => request(`/products/${id}/toggle-active`, { method: "PATCH" }),

  getCategories:  ()         => request("/products/categories"),
  createCategory: (data)     => request(`/products/categories?name=${encodeURIComponent(data.name || data)}`, { method: "POST" }),
  updateCategory: (id, data) => request(`/products/categories/${id}?name=${encodeURIComponent(data.name || data)}`, { method: "PUT" }),
  deleteCategory: (id)       => request(`/products/categories/${id}`, { method: "DELETE" }),
};

// ─── Ombor ────────────────────────────────────────────────────
export const inventoryApi = {
  getAll: () => request("/inventory"),
  getLow: () => request("/inventory/low-stock"),
  addStock: (productId, qty, expiryDate) =>
    request(`/inventory/product/${productId}/add`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: Number(qty), expiryDate }),
    }),
  correct: (productId, qty) =>
    request(`/inventory/product/${productId}/correct`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: Number(qty) }),
    }),
};

// ─── Mijozlar ─────────────────────────────────────────────────
export const customerApi = {
  getAll:  ()          => request("/customers"),
  getById: (id)        => request(`/customers/${id}`),
  create:  (data)      => request("/customers",      { method: "POST", body: JSON.stringify(data) }),
  update:  (id, data)  => request(`/customers/${id}`, { method: "PUT",  body: JSON.stringify(data) }),
  delete:  (id)        => request(`/customers/${id}`, { method: "DELETE" }),
};

// ─── Sotuvlar ─────────────────────────────────────────────────
export const saleApi = {
  getAll:  (params = "") => request(`/sales?${params}`),
  getById: (id)          => request(`/sales/${id}`),
  create:  (data)        => request("/sales",       { method: "POST",  body: JSON.stringify(data) }),
  cancel:  (id)          => request(`/sales/${id}/cancel`, { method: "PATCH" }),
};

// ─── Superadmin: Do'konlar ────────────────────────────────────
export const shopAdminApi = {
  getAll:      ()               => request("/superadmin/shops"),
  getById:     (id)             => request(`/superadmin/shops/${id}`),
  create:      (data)           => request("/superadmin/shops",       { method: "POST",   body: JSON.stringify(data) }),
  update:      (id, data)       => request(`/superadmin/shops/${id}`, { method: "PUT",    body: JSON.stringify(data) }),
  delete:      (id)             => request(`/superadmin/shops/${id}`, { method: "DELETE" }),
  getUsers:    (shopId)         => request(`/superadmin/shops/${shopId}/users`),
  createUser:  (shopId, data)   => request(`/superadmin/shops/${shopId}/users`, { method: "POST", body: JSON.stringify(data) }),
  toggleBlock: (shopId, userId) => request(`/superadmin/shops/${shopId}/users/${userId}/toggle-block`, { method: "PATCH" }),
};

// ─── Do'kon profili va foydalanuvchilar (Shop admin) ───
export const shopApi = {
  getProfile: () => request("/shop/profile"),
  getUsers:   () => request("/shop/users"),
  createUser: (data) => request("/shop/users", { method: "POST", body: JSON.stringify(data) }),
  toggleBlockUser: (userId) => request(`/shop/users/${userId}/toggle-block`, { method: "PATCH" }),
};
