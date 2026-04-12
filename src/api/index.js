import { API_BASE, LOGIN_URL, getDeviceId } from "../config";

let refreshPromise = null;

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = (async () => {
    try {
      const refresh = localStorage.getItem("ek_refresh");
      const deviceId = getDeviceId();
      if (!refresh) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
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
      throw new Error("AUTH_FAILED");
    }
  }

  // 2-urinishda ham 401 — login ga
  if (res.status === 401 && _retry) {
    localStorage.clear();
    window.location.replace(`${LOGIN_URL}?logged_out=1`);
    throw new Error("AUTH_FAILED");
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
  daily:   (shopId)        => request(`/reports/daily${shopId ? `?shopId=${shopId}` : ""}`),
  weekly:  (shopId)        => request(`/reports/weekly${shopId ? `?shopId=${shopId}` : ""}`),
  monthly: (shopId)        => request(`/reports/monthly${shopId ? `?shopId=${shopId}` : ""}`),
  custom:  (from, to, shopId) => request(`/reports/custom?from=${from}&to=${to}${shopId ? `&shopId=${shopId}` : ""}`),
};

// ─── Mahsulotlar ──────────────────────────────────────────────
export const productApi = {
  getAll:       (shopId)   => request(`/products${shopId ? `?shopId=${shopId}` : ""}`),
  search:       (q = "", page = 0, size = 30, shopId) =>
                  request(`/products/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}${shopId ? `&shopId=${shopId}` : ""}`),
  getById:      (id)       => request(`/products/${id}`),
  create:       (data)     => request("/products",     { method: "POST",   body: JSON.stringify(data) }),
  update:       (id, data) => request(`/products/${id}`, { method: "PUT",  body: JSON.stringify(data) }),
  delete:       (id)       => request(`/products/${id}`, { method: "DELETE" }),
  toggleActive: (id)       => request(`/products/${id}/toggle-active`, { method: "PATCH" }),

  getCategories:  (shopId)   => request(`/products/categories${shopId ? `?shopId=${shopId}` : ""}`),
  createCategory: (data, shopId)     => request(`/products/categories?name=${encodeURIComponent(data.name || data)}${shopId ? `&shopId=${shopId}` : ""}`, { method: "POST" }),
  updateCategory: (id, data, shopId) => request(`/products/categories/${id}?name=${encodeURIComponent(data.name || data)}${shopId ? `&shopId=${shopId}` : ""}`, { method: "PUT" }),
  deleteCategory: (id, shopId)       => request(`/products/categories/${id}${shopId ? `?shopId=${shopId}` : ""}`, { method: "DELETE" }),
};

// ─── Ombor ────────────────────────────────────────────────────
export const inventoryApi = {
  getAll: (shopId) => request(`/inventory${shopId ? `?shopId=${shopId}` : ""}`),
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
};


// ─── Do'kon profili va foydalanuvchilar (Shop admin) ───
export const shopApi = {
  getProfile: () => request("/shop/profile"),
  getUsers:   (shopId) => request(`/shop/users${shopId ? `?shopId=${shopId}` : ""}`),
  createUser: (data, shopId) => request(`/shop/users${shopId ? `?shopId=${shopId}` : ""}`, { method: "POST", body: JSON.stringify(data) }),
  updateUser: (userId, data, shopId) => request(`/shop/users/${userId}${shopId ? `?shopId=${shopId}` : ""}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (userId, shopId) => request(`/shop/users/${userId}${shopId ? `?shopId=${shopId}` : ""}`, { method: "DELETE" }),
  toggleBlockUser: (userId, shopId) => request(`/shop/users/${userId}/toggle-block${shopId ? `?shopId=${shopId}` : ""}`, { method: "PATCH" }),
  
  getBranches: () => request("/shop/branches"),
  createBranch: (data) => request("/shop/branches", { method: "POST", body: JSON.stringify(data) }),
};
