import { useEffect, useRef, useState } from "react";
import { appApi, setAppToken } from "./customerApi";
import { LOGO_URL, LOGO_DARK_URL } from "../config";
import { isNativeShell } from "../lib/ek-desktop";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ KIRISHI (V37 · V40)

   To'rtta yo'l, bittasi asosiy:
     1. TELEGRAM BOTI (standart) — tugma → TELEGRAM ILOVASI ochiladi
        (`tg://`, brauzersiz) → mijoz «Telefon yuborish» ni bosadi →
        ilova sessiyani O'ZI oladi (polling) va odam orqaga qaytishi
        bilan kirgan bo'ladi. Hech qanday kod ko'chirilmaydi.
     2. TELEGRAM BILAN KIRISH (OIDC) — FAQAT BRAUZERDA. Bu veb oqim:
        `oauth.telegram.org` sahifasi ochiladi. ⚠ Telefon ilovasida bu
        tugma KO'RSATILMAYDI — u yerda Chrome ochilib, qaytishda ham
        Chrome'da qolib ketardi (foydalanuvchi shikoyati, 2026-08-17).
        Ilovada 1-yo'lning o'zi «ilovadan → Telegramga → ilovaga» beradi.
     3. SMS kodi — telefon raqamini O'ZI tasdiqlaydi, ya'ni yangi hisob
        ham shu yerda ochiladi.
     4. POCHTA kodi — faqat MAVJUD hisobga kirish uchun (pochta profilda,
        telefon tasdiqlangandan keyin qo'shiladi).

   ⚠ Ro'yxat SERVERDAN keladi (`/app/auth/methods`): SMS provayderi yoki
   Telegram OIDC siri sozlanmagan bo'lsa, tugma UMUMAN chizilmaydi.
   Ishlamaydigan tugma odamni bekorga urintiradi.

   ⚠⚠ NEGA POCHTA BILAN YANGI HISOB OCHILMAYDI: do'kondagi karta va
   ballar TELEFON bo'yicha bog'lanadi. Tasdiqlanmagan raqamli hisob
   mijozga begonaning ballarini ko'rsatib qo'yishi mumkin edi.

   ⚠ «Do'kon xodimiman» — pastda, kichik. Mijoz uni ko'radi-yu e'tibor
   bermaydi (unga ma'nosiz), do'kon egasi esa hech narsa eslab qolmasdan
   bosadi. Yashirin kod yoki «7 marta bosish» kabi hiyla kerak emas.
   ══════════════════════════════════════════════════════════════════════════ */

const OIDC_STATE_KEY = "ek_app_oidc";

export default function CustomerLogin({ onLoggedIn, onStaffLogin }) {
  /* idle | waiting (bot) | email | sms — oxirgi ikkisida kod so'raladi */
  const [mode, setMode]   = useState("idle");
  const [error, setError] = useState("");
  const [methods, setMethods] = useState({ telegramBot: true });
  /* Telegram ilovasi o'rnatilmagan bo'lsa — brauzerdagi zaxira havola */
  const [webLink, setWebLink] = useState("");
  const poller = useRef(null);
  const stopAt = useRef(0);

  useEffect(() => {
    appApi.methods().then(setMethods).catch(() => {});
    return () => clearInterval(poller.current);
  }, []);

  /* ── 1. Bot orqali ────────────────────────────────────────────────── */
  const startBot = async () => {
    setError("");
    setMode("waiting");
    try {
      const { code, link, appLink } = await appApi.loginStart();
      setWebLink(link);

      /* ⚠⚠ TELEFON ILOVASIDA `tg://` SXEMASI (2026-08-17, foydalanuvchi
         shikoyati). `https://t.me/…` ishlatilganda Android avval CHROME ni
         ochib, keyin uni Telegramga o'tkazardi — qaytishda esa odam
         Chrome'da qolib ketardi. `tg://resolve?...` esa Telegram ilovasini
         TO'G'RIDAN-TO'G'RI ochadi: brauzer umuman aralashmaydi.

         ⚠ `location.href`, `window.open` EMAS: nostandart sxemani
         Capacitor WebView'i Intent qilib uzatadi, `window.open` esa uni
         yangi «oyna» deb hisoblab, baribir brauzerga berardi. */
      if (isNativeShell() && appLink) window.location.href = appLink;
      else window.open(link, "_blank", "noopener");

      /* ⚠ Polling 10 daqiqada to'xtaydi — kod ham shuncha yashaydi.
         Cheksiz so'rov yuborish telefon batareyasini yeb qo'yardi. */
      stopAt.current = Date.now() + 10 * 60 * 1000;
      clearInterval(poller.current);
      poller.current = setInterval(async () => {
        if (Date.now() > stopAt.current) {
          clearInterval(poller.current);
          setMode("idle");
          setError("Vaqt tugadi — qaytadan urinib ko'ring");
          return;
        }
        try {
          const r = await appApi.loginPoll(code);
          if (r?.token) {
            clearInterval(poller.current);
            setAppToken(r.token);
            onLoggedIn();
          }
        } catch (e) {
          clearInterval(poller.current);
          setMode("idle");
          setError(e.message || "Kirish bekor qilindi");
        }
      }, 2500);
    } catch (e) {
      setMode("idle");
      setError(e.message || "Havola olinmadi");
    }
  };

  /* ── 2. Telegram OIDC ─────────────────────────────────────────────── */
  const startOidc = async () => {
    setError("");
    try {
      const { url } = await appApi.oidcStart();
      /* ⚠ Yangi oyna EMAS, o'sha oynada: Telegram qaytish manzilini
         ro'yxatdan tekshiradi va pop-up brauzerlarda to'silib qoladi. */
      sessionStorage.setItem(OIDC_STATE_KEY, "1");
      window.location.href = url;
    } catch (e) {
      setError(e.message || "Telegram sahifasi ochilmadi");
    }
  };

  return (
    <div className="cu-login">
      <div className="cu-login__top">
        <img src={LOGO_URL} alt="e-Kassam" className="cu-logo logo--light"
             onError={(e) => { e.target.style.display = "none"; }} />
        <img src={LOGO_DARK_URL} alt="" aria-hidden="true" className="cu-logo logo--dark"
             onError={(e) => { e.target.style.display = "none"; }} />

        <h1 className="cu-login__title">Xaridlaringiz — bir joyda</h1>
        <p className="cu-login__lead">
          Do'konlardagi ballaringiz, cheklaringiz va kartangiz shu ilovada.
          Ro'yxatdan o'tish bir daqiqa oladi.
        </p>

        <ul className="cu-login__points">
          <li><i className="fa-solid fa-percent" aria-hidden="true" /> Har xariddan ball</li>
          <li><i className="fa-solid fa-receipt" aria-hidden="true" /> Barcha cheklar telefoningizda</li>
          <li><i className="fa-solid fa-store" aria-hidden="true" /> Bir nechta do'kon — bitta karta</li>
        </ul>
      </div>

      {error && <div className="cu-error" role="alert">{error}</div>}

      {mode === "waiting" && (
        <div className="cu-waiting">
          <i className="fa-brands fa-telegram cu-waiting__icon" aria-hidden="true" />
          <p><b>Telegram ochildi</b></p>
          <p className="cu-muted">
            «📱 Telefon raqamimni yuborish» tugmasini bosing — bu yerga o'zi qaytadi.
          </p>
          {/* Telegram o'rnatilmagan qurilma uchun — brauzerdagi web-telegram */}
          {webLink && (
            <button className="cu-btn cu-btn--ghost"
                    onClick={() => window.open(webLink, "_blank", "noopener")}>
              Telegram ochilmadimi? Brauzerda ochish
            </button>
          )}
          <button className="cu-btn cu-btn--ghost"
                  onClick={() => { clearInterval(poller.current); setMode("idle"); }}>
            Bekor qilish
          </button>
        </div>
      )}

      {mode === "email" && (
        <OtpForm
          kind="email"
          onBack={() => setMode("idle")}
          onDone={(token) => { setAppToken(token); onLoggedIn(); }} />
      )}

      {mode === "sms" && (
        <OtpForm
          kind="sms"
          onBack={() => setMode("idle")}
          onDone={(token) => { setAppToken(token); onLoggedIn(); }} />
      )}

      {mode === "idle" && (
        <div className="cu-methods">
          <button className="cu-btn cu-btn--tg" onClick={startBot}>
            <i className="fa-brands fa-telegram" aria-hidden="true" /> Telegram bilan kirish
          </button>

          {/* ⚠ OIDC — VEB oqim (oauth.telegram.org sahifasi). Ilovada uni
              ko'rsatish Chrome ochilishiga olib keladi, foydalanuvchi esa
              aynan shuni istamadi: ilovadan → Telegramga → ilovaga.
              Yuqoridagi bot tugmasi shu yo'lni beradi. */}
          {methods.telegramOidc && !isNativeShell() && (
            <button className="cu-btn cu-btn--ghost" onClick={startOidc}>
              <i className="fa-brands fa-telegram" aria-hidden="true" /> Telegram hisobim bilan (botsiz)
            </button>
          )}

          {methods.sms && (
            <button className="cu-btn cu-btn--ghost" onClick={() => { setError(""); setMode("sms"); }}>
              <i className="fa-solid fa-comment-sms" aria-hidden="true" /> SMS kodi bilan
            </button>
          )}

          {methods.email && (
            <button className="cu-btn cu-btn--ghost" onClick={() => { setError(""); setMode("email"); }}>
              <i className="fa-solid fa-envelope" aria-hidden="true" /> Pochta orqali
            </button>
          )}
        </div>
      )}

      {/* Xodimlar uchun — kichik, lekin yashirin emas */}
      <button className="cu-staff" onClick={onStaffLogin}>
        Do'kon xodimiman
      </button>
    </div>
  );
}

/* ── Kod bilan kirish (pochta va SMS uchun bitta forma) ──────────────────
   ⚠ Ikkala kanal uchun BITTA komponent: oqim aynan bir xil (manzil →
   kod → sessiya) va uni ikki marta yozish ikki xil xatoga olib borardi. */

function OtpForm({ kind, onBack, onDone }) {
  const [target, setTarget] = useState("");
  const [code, setCode]     = useState("");
  const [sent, setSent]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");

  const isEmail = kind === "email";

  const send = async () => {
    setError("");
    setBusy(true);
    try {
      if (isEmail) await appApi.emailStart(target.trim());
      else         await appApi.smsStart(target.trim());
      setSent(true);
    } catch (e) {
      setError(e.message || "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError("");
    setBusy(true);
    try {
      const r = isEmail
        ? await appApi.emailVerify(target.trim(), code.trim())
        : await appApi.smsVerify(target.trim(), code.trim());
      onDone(r.token);
    } catch (e) {
      setError(e.message || "Kod noto'g'ri");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cu-otp">
      <label className="cu-label" htmlFor="cu-otp-target">
        {isEmail ? "Pochta manzilingiz" : "Telefon raqamingiz"}
      </label>
      {isEmail ? (
        <input id="cu-otp-target" className="cu-input" type="email" inputMode="email"
               autoComplete="email" placeholder="ism@pochta.uz" value={target}
               disabled={sent}
               onChange={(e) => setTarget(e.target.value)} />
      ) : (
        /* ⚠ `+998` maydon ICHIDA emas, yonida: kod ichida bo'lsa odam
           to'liq raqam yozadi va u abonent raqami bo'lib tushadi. */
        <div className="pt-phone">
          <span className="pt-phone__cc">+998</span>
          <input id="cu-otp-target" className="cu-input" type="tel" inputMode="tel"
                 autoComplete="tel" placeholder="90 123 45 67" value={target}
                 disabled={sent}
                 onChange={(e) => setTarget(e.target.value)} />
        </div>
      )}

      {sent && (
        <>
          <label className="cu-label" htmlFor="cu-otp-code">Kelgan kod</label>
          <input id="cu-otp-code" className="cu-input" inputMode="numeric"
                 autoComplete="one-time-code" maxLength={6} placeholder="123456"
                 value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <p className="cu-muted">
            {isEmail
              ? "Kod pochtangizga yuborildi. Agar bu manzil hech qanday hisobga bog'lanmagan bo'lsa, xat kelmaydi."
              : "Kod SMS orqali yuborildi."}
          </p>
        </>
      )}

      {error && <div className="cu-error" role="alert">{error}</div>}

      <button className="cu-btn" disabled={busy || (!sent ? !target.trim() : code.length < 4)}
              onClick={sent ? verify : send}>
        {busy ? "Kutilmoqda…" : sent ? "Kirish" : "Kod yuborish"}
      </button>
      <button className="cu-btn cu-btn--ghost" onClick={onBack}>Orqaga</button>
    </div>
  );
}
