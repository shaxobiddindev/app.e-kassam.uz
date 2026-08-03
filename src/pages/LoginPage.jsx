import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { authApi } from "../api";
import { LOGO_URL, DEVICE_ID } from "../utils";
import { Spinner } from "../components/ek/Loading";

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
            { key: "admin", icon: "fa-shield-halved", label: t("login.tabAdmin") },
            { key: "user",  icon: "fa-user",          label: t("login.tabUser") },
          /* ⚠ Parametr `tb` — `t` bo'lsa u importdagi tarjima funksiyasini
             soyalaydi va `t.label` ichidagi `t("...")` yiqilardi. */
          ].map((tb) => (
            <button
              key={tb.key}
              type="button"
              className={`login-tab ${tab === tb.key ? "active" : ""}`}
              onClick={() => setTab(tb.key)}
            >
              <i className={`fa-solid ${tb.icon}`} style={{ marginRight: 6 }} aria-hidden="true" />{tb.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "user" && (
            <div className="form-group">
              <label className="form-label">{t("login.shopCode")}</label>
              <input className="form-input mono" placeholder="shop-code" value={form.shopCode} onChange={setField("shopCode")} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t("common.username")}</label>
            <input className="form-input" placeholder="username" value={form.username} onChange={setField("username")} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">{t("common.password")}</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={setField("password")} required />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <Spinner /> : <i className="fa-solid fa-right-to-bracket" />}
            {loading ? t("common.checking") : t("login.submit")}
          </button>
        </form>

        <div className="login-copy">© 2025 e-Kassam.uz — CRM Tizimi</div>
      </div>
    </div>
  );
}
