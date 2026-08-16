import { useEffect, useRef, useState } from "react";
import { appApi, setAppToken } from "./customerApi";
import { LOGO_URL, LOGO_DARK_URL } from "../config";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ KIRISHI — Telegram orqali (V37)

   Oqim: tugma → bot ochiladi → mijoz «Telefon yuborish» ni bosadi →
   ilova sessiyani O'ZI oladi (polling). Mijoz hech qanday kod
   ko'chirmaydi — SMS kutishdan ham tez.

   ⚠ NEGA SMS EMAS: provayder hali ulanmagan. Telegram esa tasdiqlangan
   raqamni bepul beradi. SMS ulanganda bu ekranga ikkinchi tugma
   qo'shiladi, oqimning qolgani o'zgarmaydi.

   ⚠ «Do'kon xodimiman» — pastda, kichik. Mijoz uni ko'radi-yu e'tibor
   bermaydi (unga ma'nosiz), do'kon egasi esa hech narsa eslab qolmasdan
   bosadi. Yashirin kod yoki «7 marta bosish» kabi hiyla kerak emas:
   egasi ham oddiy odam.
   ══════════════════════════════════════════════════════════════════════════ */
export default function CustomerLogin({ onLoggedIn, onStaffLogin }) {
  const [phase, setPhase] = useState("idle");   // idle | waiting | error
  const [error, setError] = useState("");
  const poller = useRef(null);
  const stopAt = useRef(0);

  useEffect(() => () => clearInterval(poller.current), []);

  const start = async () => {
    setError("");
    setPhase("waiting");
    try {
      const { code, link } = await appApi.loginStart();

      /* Botni ochamiz. Telefonda bu Telegram ilovasini ishga tushiradi,
         brauzerda esa web-telegram. */
      window.open(link, "_blank", "noopener");

      /* ⚠ Polling 10 daqiqada to'xtaydi — kod ham shuncha yashaydi.
         Cheksiz so'rov yuborish telefon batareyasini yeb qo'yardi. */
      stopAt.current = Date.now() + 10 * 60 * 1000;
      clearInterval(poller.current);
      poller.current = setInterval(async () => {
        if (Date.now() > stopAt.current) {
          clearInterval(poller.current);
          setPhase("idle");
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
          setPhase("idle");
          setError(e.message || "Kirish bekor qilindi");
        }
      }, 2500);
    } catch (e) {
      setPhase("idle");
      setError(e.message || "Havola olinmadi");
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

      {phase === "waiting" ? (
        <div className="cu-waiting">
          <i className="fa-brands fa-telegram cu-waiting__icon" aria-hidden="true" />
          <p><b>Telegram ochildi</b></p>
          <p className="cu-muted">
            «📱 Telefon raqamimni yuborish» tugmasini bosing — bu yerga o'zi qaytadi.
          </p>
          <button className="cu-btn cu-btn--ghost" onClick={() => { clearInterval(poller.current); setPhase("idle"); }}>
            Bekor qilish
          </button>
        </div>
      ) : (
        <button className="cu-btn cu-btn--tg" onClick={start}>
          <i className="fa-brands fa-telegram" aria-hidden="true" /> Telegram bilan kirish
        </button>
      )}

      {/* Xodimlar uchun — kichik, lekin yashirin emas */}
      <button className="cu-staff" onClick={onStaffLogin}>
        Do'kon xodimiman
      </button>
    </div>
  );
}
