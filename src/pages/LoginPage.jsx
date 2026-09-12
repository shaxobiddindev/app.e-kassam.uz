import { useState, useEffect, useRef } from "react";
import { API_BASE, LOGO_URL, LOGO_DARK_URL, getDeviceId } from "../config";
import { useT, getLang } from "../lib/ek-i18n";
import { Spinner } from "../components/ek/Loading";
import LangSelect from "../components/ek/LangSelect";
import ThemeSelect from "../components/ek/ThemeSelect";
import { UsernameField, OtpField } from "../components/ek/EkFields";
import { isMobileApp } from "../lib/ek-desktop";
import EkIntro from "../components/EkIntro";
import { asArray } from "../lib/ek-array";

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

/* Intro ilova SOVUQ ochilishida BIR MARTA ko'rsatiladi: modul darajasidagi
   bayroq JS konteksti bilan yashaydi — chiqib qayta kirishda takrorlanmaydi,
   ilova qayta ochilganda esa yana ko'rinadi. Vestibulyar buzilishda umuman
   chizilmaydi (landing bilan bir xil qoida). */
let introShown = false;
const REDUCED = typeof matchMedia !== "undefined"
  && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function post(path, body, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "Accept-Language": getLang(), ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const e = new Error(json.message || `Xatolik ${res.status}`);
    /* ⚠ Javob tanasi ham ilova qilinadi: 428 da `deviceConfirmationRequired`
       (V29) keladi va uni XATO deb ko'rsatib bo'lmaydi — bu «kod maydonini
       oching» degan signal (auth.e-kassam.uz bilan bir xil qoida). */
    e.data = json;
    throw e;
  }
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
  const [form, setForm]         = useState({ username: "", password: "", deviceCode: "" });

  /* ⚠ QURILMA OXIRGI KIRISHNI ESLAB QOLADI (V98 — auth'dagi bilan bir xil).
     Saqlanadigan narsa: do'kon kodi, do'kon NOMI va login. PAROL HECH
     QACHON saqlanmaydi.

     Nega kerak: kassa bitta qurilmada, bitta do'konda turadi va kassir
     har smenada bir xil kodni qayta terardi. Brauzer versiyasida bu
     allaqachon olib tashlangan edi, `.exe` esa eski holicha qolgan —
     ya'ni bitta kassir ikki joyda ikki xil ish qilardi. */
  const [last] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ek_lastLogin") || "null");
      return v && v.username ? v : null;
    } catch (_) { return null; }
  });
  /* ⚠ DO'KON KODI MAYDONI UMUMAN YO'Q (2026-09-12).
     Server do'konni FOYDALANUVCHI NOMIDAN topadi (`AuthService`:
     `shop = user.getShop()`), ya'ni kod oddiy kirishda hech qachon
     kerak emas edi — u faqat kassirga qo'shimcha maydon bo'lib
     turardi va har smenada qayta terilardi.

     ⚠ BITTA HOLAT QOLADI: bazada faqat harf registri bilan farq
     qiladigan ikkita bir xil login bo'lsa (eski «Kassir» va
     «kassir»), server kirishni rad etadi. Bunday hisob uchun yo'l —
     brauzer versiyasi (`auth.e-kassam.uz`), u yerda kod maydoni
     havola ostida turibdi. Bu holat eski bazalarda uchraydi va
     kassaning kundalik ishiga tegmaydi. */
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [notice, setNotice]     = useState("");
  const [shake, setShake]       = useState(0);
  const [showPass, setShowPass] = useState(false);
  /* Parol to'g'ri, lekin qurilma YANGI — pochtadagi kod kerak (V29, 428). */
  const [deviceConfirm, setDeviceConfirm] = useState(false);
  /* Brend introsi — faqat telefon ilovasida, ochilishda bir marta. */
  const [intro, setIntro] = useState(() => isMobileApp() && !REDUCED && !introShown);

  const firstFieldRef = useRef(null);
  const deviceRef     = useRef(null);

  // Kassir sichqonchaga tegmasin — birinchi maydon darhol fokusda.
  // ⚠ TELEFONDA EMAS: avto-fokus ekran klaviaturasini ilova ochilishi
  // bilanoq chiqarib yuboradi.
  useEffect(() => { if (!isMobileApp()) firstFieldRef.current?.focus(); }, []);

  const set = (k) => (e) => { setError(""); setForm((p) => ({ ...p, [k]: e.target.value })); };
  const fail = (msg) => { setError(msg); setShake((n) => n + 1); setLoading(false); };

  /* ⚠ FAQAT LOGIN tushadi, do'kon kodi TUSHMAYDI: kod o'zgargan
     bo'lishi mumkin va eskisini jimgina qayta yuborish xato beradi.
     Kod kerak bo'lsa, server 4xx qaytaradi va maydon ochiladi. */
  useEffect(() => {
    if (last?.username) setForm((p) => ({ ...p, username: last.username }));
  }, [last]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username.trim()) return fail(t("login.needUsername"));
    if (!form.password)        return fail(t("login.needPassword"));

    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const r = await post("/auth/login",
        {
          username: form.username.trim(), password: form.password,
          deviceCode: form.deviceCode.trim() || undefined,
        },
        { "X-Device-Id": deviceId });

      // `/auth/me` — ism va rollar uchun. Yiqilsa kirish TO'XTAMAYDI:
      // token allaqachon olingan va kassir savdo qila oladi; ism esa
      // keyingi ochilishda to'g'rilanadi.
      let me = {};
      try { me = (await get("/auth/me", r.data.accessToken)).data || {}; } catch (_) {}

      const roles = me.roles || asArray(r.data?.roles);
      const roleStr = roles.map((x) => x?.type || x?.name || String(x || "")).filter(Boolean).join(",");

      /* ⚠ Do'kon NOMI serverdan keladi — kassir kodni emas, nomni
         biladi. Parol saqlanmaydi. */
      try {
        localStorage.setItem("ek_lastLogin", JSON.stringify({
          /* Kod endi faqat SERVERDAN keladi — formada u yo'q. */
          shopCode: r.data.shopCode || "",
          shopName: r.data.shopName || "",
          username: me.username || form.username.trim(),
        }));
      } catch (_) { /* xotira yo'q — qulaylik yo'qoladi, kirish ishlayveradi */ }

      onLogin({
        token:    r.data.accessToken,
        refresh:  r.data.refreshToken,
        deviceId,
        username: me.username || form.username.trim(),
        fullName: me.fullName || me.username || form.username.trim(),
        role:     roleStr,
        shopCode: r.data.shopCode || "",
      });
    } catch (err) {
      /* 428 — XATO EMAS: parol to'g'ri, endi pochtadagi kod kerak (V29). */
      if (err.data?.deviceConfirmationRequired) {
        setDeviceConfirm(true);
        setLoading(false);
        setNotice(err.data.message || t("login.deviceHint"));
        setTimeout(() => deviceRef.current?.focus(), 30);
        return;
      }
      fail(err.message);
    }
  };

  /* Intro paytida forma UMUMAN chizilmaydi. Overlay usulida forma bir
     kadr OLDIN bo'yalib, intro ustiga kech kelardi — «login yalt etib
     ko'rinib ketyapti» shikoyati. Intro yopilgach forma o'z kirish
     animatsiyalari bilan birinchi marta paydo bo'ladi. */
  if (intro) {
    return <EkIntro onDone={() => { introShown = true; setIntro(false); }} />;
  }

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

          {/* ⚠ ESLAB QOLINGAN DO'KON — kod emas, NOM ko'rsatiladi.
              Kassir do'kon kodini yodda saqlamaydi, nomini biladi. */}
          {last?.shopName && (
            <div className="auth__remembered">
              <i className="fa-solid fa-store" aria-hidden="true" /> {last.shopName}
            </div>
          )}

          <div className="auth__field">
            <label className="auth__label" htmlFor="username">{t("common.username")}</label>
            <UsernameField id="username" ref={firstFieldRef} className="auth__input"
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

          {/* Yangi qurilma kodi (V29) — faqat server so'raganda (428) */}
          {deviceConfirm && (
            <div className="auth__field">
              <label className="auth__label" htmlFor="deviceCode">{t("login.deviceCode")}</label>
              <OtpField id="deviceCode" ref={deviceRef} className="auth__input ek-num"
                        value={form.deviceCode} onChange={set("deviceCode")}
                        placeholder="123456" />
              <p className="auth__foot" style={{ marginTop: 6, textAlign: "left" }}>
                {t("login.deviceHint")}
              </p>
            </div>
          )}

          {notice && (
            <div className="auth__note" role="status" aria-live="polite">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

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
