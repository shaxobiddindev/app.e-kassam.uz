import { useState } from "react";
import { authApi } from "../api";
import { LOGO_URL, DEVICE_ID } from "../utils";

export default function LoginPage({ onLogin, toast }) {
  const [tab, setTab]         = useState("admin");
  const [form, setForm]       = useState({ username: "", password: "", shopCode: "" });
  const [loading, setLoading] = useState(false);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "admin") {
        const res = await authApi.adminLogin({ username: form.username, password: form.password });
        onLogin({ token: res.data.accessToken, username: form.username, type: "admin" });
      } else {
        const res = await authApi.userLogin(
          { username: form.username, password: form.password, shopCode: form.shopCode },
          DEVICE_ID
        );
        onLogin({ token: res.data.accessToken, username: form.username, type: "user" });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={LOGO_URL} alt="e-Kassam" onError={(e) => (e.target.style.display = "none")} />
        </div>

        <div className="login-tabs">
          {[
            { key: "admin", icon: "fa-shield-halved", label: "Admin" },
            { key: "user",  icon: "fa-user",          label: "Do'kon" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`login-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }} />{t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "user" && (
            <div className="form-group">
              <label className="form-label">Do'kon kodi</label>
              <input className="form-input mono" placeholder="shop-code" value={form.shopCode} onChange={setField("shopCode")} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Foydalanuvchi nomi</label>
            <input className="form-input" placeholder="username" value={form.username} onChange={setField("username")} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Parol</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={setField("password")} required />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-right-to-bracket"}`} />
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>

        <div className="login-copy">© 2025 e-Kassam.uz — CRM Tizimi</div>
      </div>
    </div>
  );
}
