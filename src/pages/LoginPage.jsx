import { useState, useEffect, useRef } from "react";
import { API_BASE, LOGO_URL, LOGO_DARK_URL, getDeviceId } from "../config";
import { useT, getLang } from "../lib/ek-i18n";
import { Spinner } from "../components/ek/Loading";
import LangSelect from "../components/ek/LangSelect";
import ThemeSelect from "../components/ek/ThemeSelect";
import { CodeField, UsernameField } from "../components/ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   Kirish — ILOVA ICHIDA (desktop)

   Brauzer versiyasida kirish alohida originda (`auth.e-kassam.uz`) va token
   yo'naltirish parametrida keladi. Desktop'da bunday qilib bo'lmaydi va
   KERAK ham emas:

     · `.exe` ichida tashqi brauzer ochish kassirni ilovadan chiqarib
       yuboradi — smena o'rtasida bu chalkashlik;
     · originlararo uzatishning butun murakkabligi (deviceId ni parametrda
       tashish, `?lang=`, `localStorage` bo'linmasligi) bu yerda ma'nosiz:
       origin BITTA.

   Shu sababli forma to'g'ridan-to'g'ri `/auth/login` ga murojaat qiladi.

   ⚠ ADMIN KIRISHI ATAYLAB YO'Q. Bu ilova kassa uchun; superadmin paneli —
   `admin.e-kassam.uz`. Ikkalasini bitta oynaga tiqish kassirning ekranida
   unga tegishli bo'lmagan tugmalarni ko'rsatardi.

   Ko'rinish `auth.e-kassam.uz` bilan AYNAN bir xil (`.auth*` sinflari
   `styles.css` ga ko'chirilgan): kassir uchun ilova o'zgargandek tuyulmasin.
   ══════════════════════════════════════════════════════════════════════════ */

async function post(path, body, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Accept-Language": getLang(), ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || `Xatolik ${res.status}`);
  return json;
}

async function get(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Accept-Language": getLang(), Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Xatolik ${res.status}`);
  return json;
}

export default function LoginPage({ onLogin }) {
  const { t } = useT();
  const [form, setForm]         = useState({ shopCode: "", username: "", password: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(0);
  const [showPass, setShowPass] = useState(false);

  const firstFieldRef = useRef(null);

  // Kassir sichqonchaga tegmasin — birinchi maydon darhol fokusda
  useEffect(() => { firstFieldRef.current?.focus(); }, []);

  const set = (k) => (e) => { setError(""); setForm((p) => ({ ...p, [k]: e.target.value })); };
  const fail = (msg) => { setError(msg); setShake((n) => n + 1); setLoading(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.shopCode.trim()) return fail(t("login.needShopCode"));
    if (!form.username.trim()) return fail(t("login.needUsername"));
    if (!form.password)        return fail(t("login.needPassword"));

    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const r = await post("/auth/login",
        { shopCode: form.shopCode.trim(), username: form.username.trim(), password: form.password },
        { "X-Device-Id": deviceId });

      // `/auth/me` — ism va rollar uchun. Yiqilsa kirish TO'XTAMAYDI:
      // token allaqachon olingan va kassir savdo qila oladi; ism esa
      // keyingi ochilishda to'g'rilanadi.
      let me = {};
      try { me = (await get("/auth/me", r.data.accessToken)).data || {}; } catch (_) {}

      const roles = me.roles || r.data?.roles || [];
      const roleStr = roles.map((x) => x?.type || x?.name || String(x || "")).filter(Boolean).join(",");

      onLogin({
        token:    r.data.accessToken,
        refresh:  r.data.refreshToken,
        deviceId,
        username: me.username || form.username.trim(),
        fullName: me.fullName || me.username || form.username.trim(),
        role:     roleStr,
        shopCode: form.shopCode.trim(),
      });
    } catch (err) {
      fail(err.message);
    }
  };

  return (
    <div className="auth">
      {/* Til va tema kirishdan OLDIN tanlanadi: forma tushunarsiz tilda
          bo'lsa kassir uni to'ldira olmaydi, kechqurun esa yorug' ekran
          charchatadi. */}
      <div className="auth__theme">
        <LangSelect />
        <ThemeSelect />
      </div>

      <div className="auth__form-side">
        <form className="auth__form" onSubmit={handleSubmit}>
          <img src={LOGO_URL} alt="e-Kassam" className="auth__logo logo--light ek-in-fade"
               onError={(e) => { e.target.style.display = "none"; }} />
          <img src={LOGO_DARK_URL} alt="" aria-hidden="true" className="auth__logo logo--dark ek-in-fade"
               onError={(e) => { e.target.style.display = "none"; }} />

          <h1 className="auth__title ek-in-up">{t("login.welcome")}</h1>
          <p className="auth__sub ek-in-up" style={{ animationDelay: "120ms" }}>{t("login.subtitle")}</p>

          {error && (
            /* `key` har xatoda o'zgaradi → silkinish BIR MARTA takrorlanadi.
               Doimiy sinf bo'lsa animatsiya faqat birinchi xatoda ishlardi. */
            <div className="auth__error ek-shake" key={shake} role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="auth__field">
            <label className="auth__label" htmlFor="shopCode">{t("login.shopCode")}</label>
            <CodeField id="shopCode" ref={firstFieldRef} className="auth__input mono"
                   placeholder="shop-code"
                   value={form.shopCode} onChange={set("shopCode")}
                   aria-invalid={error ? "true" : undefined} />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="username">{t("common.username")}</label>
            <UsernameField id="username" className="auth__input"
                   value={form.username} onChange={set("username")}
                   aria-invalid={error ? "true" : undefined} />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="password">{t("common.password")}</label>
            <div className="auth__input-wrap">
              <input id="password" className="auth__input auth__input--pass"
                     type={showPass ? "text" : "password"} autoComplete="current-password"
                     value={form.password} onChange={set("password")}
                     aria-invalid={error ? "true" : undefined} />
              <button type="button" className="auth__eye" onClick={() => setShowPass((v) => !v)}
                      aria-label={t(showPass ? "login.hidePassword" : "login.showPassword")}>
                <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tugma o'lchami yuklanishda O'ZGARMAYDI — layout sakramasin */}
          <button className="auth__submit" type="submit" disabled={loading}>
            {loading ? <Spinner /> : <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />}
            {loading ? t("common.checking") : t("login.submit")}
          </button>

          <div className="auth__foot">© {new Date().getFullYear()} e-Kassam.uz</div>
        </form>
      </div>

      {/* ⚠ Bu panel `auth.e-kassam.uz` dagi bilan AYNAN bir xil — matn,
          raqamlar va ikonkalargacha. Kassir uchun `.exe` dagi kirish
          brauzerdagidan farq qilmasligi kerak. O'zgartirsangiz — ikkala
          faylda ham o'zgartiring. */}
      <aside className="auth__brand-side" aria-hidden="true">
        <div className="auth__brand-inner">
          <div className="auth__brand-eyebrow">e-Kassam</div>
          <div className="auth__brand-title">{t("login.brandTitle")}</div>

          <div className="auth__receipt ek-tear ek-in-up" style={{ animationDelay: "180ms" }}>
            <div className="auth__receipt-head">
              <span>{t("login.receiptToday")} · 14:32</span>
              <span>{t("login.receiptRegister")}</span>
            </div>
            <div className="auth__receipt-label">{t("login.receiptLabel")}</div>
            <div className="auth__receipt-total">4 218 000</div>
            <div className="auth__receipt-row"><span>{t("login.receiptSales")}</span><b>128</b></div>
            <div className="auth__receipt-row"><span>{t("login.receiptAvg")}</span><b>32 950</b></div>
            <div className="auth__receipt-row"><span>{t("login.receiptSplit")}</span><b>61% / 39%</b></div>
          </div>

          <ul className="auth__points">
            <li><i className="fa-solid fa-wifi" aria-hidden="true" />{t("login.point1")}</li>
            <li><i className="fa-solid fa-boxes-stacked" aria-hidden="true" />{t("login.point2")}</li>
            <li><i className="fa-solid fa-lock" aria-hidden="true" />{t("login.point3")}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
