import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { authApi } from "../api";
import { asArray } from "../lib/ek-array";
import { roleLabel } from "../lib/ek-labels";
import { weekdayDate } from "../lib/ek-format";
import PinPad from "./ek/PinPad";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL TERMINALI — QULF EKRANI (3-bosqich D1, prototip 1-ekran)

   Umumiy monitorda doim shu turadi: soat, smenadagi xodimlar va PIN
   klaviaturasi. Ism tanlash SHART EMAS — kod xodimni o'zi aniqlaydi
   (ism bosilsa faqat sarlavha shaxsiylashadi).

   ⚠ ILOVA HOLATI YO'QOLMAYDI: bu qoplama, sahifa emas. Savat, ochiq stol,
   printer va tarozi ulanishi ostida turadi; PIN to'g'ri bo'lsa sessiya
   `login()` bilan almashadi (sahifa qayta yuklanmaydi).

   ⚠ XODIM O'ZI QAYTA OCHSA tokenlar kelmaydi (server: «allaqachon faol») —
   ekran shunchaki ochiladi, yangi sessiya ochilmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function clock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TerminalLock({ onUnlocked, onManager, idle }) {
  const length = Number(localStorage.getItem("ek_pinLength")) === 6 ? 6 : 4;
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [picked, setPicked] = useState(null);
  const [now, setNow] = useState(clock());
  const sending = useRef(false);

  useEffect(() => {
    authApi.pinStaff().then((r) => setStaff(asArray(r?.data))).catch(() => {});
    const id = setInterval(() => setNow(clock()), 10000);
    return () => clearInterval(id);
  }, []);

  const submit = useCallback(async (value) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await authApi.pinUnlock(value);
      onUnlocked(res?.data || {});
    } catch (err) {
      setPin("");
      setError(err?.message || t("pin.invalid"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, [onUnlocked]);

  useEffect(() => { if (pin.length === length) submit(pin); }, [pin, length, submit]);

  const who = staff.find((s) => s.id === picked) || null;

  return (
    <div className="term-lock" role="dialog" aria-modal="true" aria-label={t("term.lockTitle")}>
      <section className="term-lock__side">
        <div className="term-lock__brand">
          <span className="term-lock__logo" aria-hidden="true"><i className="fa-solid fa-utensils" /></span>
          <span>
            <b>e-Kassam <span className="term-lock__accent">Restaurant</span></b>
            <small>{t("term.device")}</small>
          </span>
        </div>
        <div className="term-lock__clock">
          <span className="ek-num">{now}</span>
          <small>{weekdayDate()}</small>
        </div>
        <div className="term-lock__staff">
          <h2>{t("term.staff")}</h2>
          {staff.length === 0 ? (
            <p className="term-lock__muted">{t("term.noStaff")}</p>
          ) : (
            <div className="term-lock__grid">
              {staff.map((s) => (
                <button key={s.id} type="button"
                        className={`term-staff${picked === s.id ? " is-on" : ""}`}
                        onClick={() => { setPicked(s.id); setPin(""); setError(""); }}>
                  <span className="term-staff__ava" aria-hidden="true">{initials(s.fullName)}</span>
                  <span className="term-staff__txt">
                    <b>{s.fullName}</b>
                    <small>{roleLabel(s.role)}{s.onShift ? ` · ${t("term.onShift")}` : ""}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="term-lock__note">
          <i className="fa-solid fa-lock" aria-hidden="true" /> {t("term.autoLock", { n: idle })}
        </p>
      </section>

      <section className="term-lock__pad">
        <div className="term-lock__head">
          <h1>{who ? who.fullName : t("term.enterPin")}</h1>
          <p>{who ? t("term.pinFor", { role: roleLabel(who.role) }) : t("term.pinHint")}</p>
        </div>
        {error && <div className="ek-note ek-note--warning term-lock__err" role="alert">{error}</div>}
        <PinPad length={length} value={pin} disabled={busy} onChange={(v) => { setError(""); setPin(v); }} />
        <button type="button" className="btn btn-outline term-lock__mgr" onClick={onManager}>
          <i className="fa-solid fa-key" aria-hidden="true" /> {t("term.manager")}
        </button>
      </section>
    </div>
  );
}
