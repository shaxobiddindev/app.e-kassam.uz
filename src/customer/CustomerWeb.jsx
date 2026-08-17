import { useEffect, useState } from "react";
import { appApi, getAppToken, setAppToken, clearAppToken } from "./customerApi";
import CustomerApp from "./CustomerApp";
import CustomerLogin from "./CustomerLogin";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ ILOVASI BRAUZERDA (V40)

   Telefon ilovasidagi daraxtning O'ZI, faqat brauzerda: kompyuterdan
   yoki telefonning brauzeridan ham o'z kartasi, ballari va cheklarini
   ko'rish mumkin.

   ⚠ `/kirish/telegram` — Telegram OIDC ning QAYTISH manzili. Telegram bu
   yerga `?code=&state=` bilan qaytaradi; ularni serverga uzatib sessiya
   olamiz va manzil qatorini DARHOL tozalaymiz — kod bir martalik bo'lsa
   ham, uni tarixda va havolada qoldirish yaxshi odat emas.

   ⚠ Xodim daraxti (`/`, `/sale`, …) bu yerga UMUMAN aralashmaydi:
   `App.jsx` shu yo'llarni eng boshida ajratib oladi.
   ══════════════════════════════════════════════════════════════════════════ */

export default function CustomerWeb() {
  const [token, setToken] = useState(() => getAppToken());
  /* idle | exchanging | error — OIDC dan qaytish holati */
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;

    setPhase("exchanging");
    appApi.oidcFinish(code, state)
      .then((r) => {
        setAppToken(r.token);
        setToken(r.token);
        setPhase("idle");
      })
      .catch((e) => {
        setPhase("error");
        setError(e.message || "Kirish yakunlanmadi");
      })
      .finally(() => window.history.replaceState({}, "", "/mening"));
  }, []);

  if (phase === "exchanging") {
    return (
      <div className="cu-wrap">
        <div className="cu-card cu-center">Telegram javobi tekshirilmoqda…</div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="cu-wrap">
        <div className="cu-card cu-center">
          <i className="fa-solid fa-circle-exclamation cu-big-icon" aria-hidden="true" />
          <p><b>Kirib bo'lmadi</b></p>
          <p className="cu-muted">{error}</p>
          <button className="cu-btn" onClick={() => { setPhase("idle"); setError(""); }}>
            Qaytadan urinish
          </button>
        </div>
      </div>
    );
  }

  if (token) {
    return (
      <CustomerApp onLoggedOut={() => { clearAppToken(); setToken(""); }} />
    );
  }

  /* Brauzerda «Do'kon xodimiman» kerak emas: xodim kirishi alohida
     domenda (`auth.e-kassam.uz`) va uni bu yerda takrorlash chalkashtiradi. */
  return <CustomerLogin onLoggedIn={() => setToken(getAppToken())} onStaffLogin={() => {}} />;
}
