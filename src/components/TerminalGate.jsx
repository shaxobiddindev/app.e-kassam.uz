import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useShopFeatures } from "../hooks/useShopFeatures";
import { idleSeconds, isTerminal, LOCK_EVENT, watchIdle } from "../lib/ek-terminal";
import TerminalLock from "./TerminalLock";

/* ══════════════════════════════════════════════════════════════════════════
   ZAL TERMINALI — QULF NAZORATCHISI (3-bosqich D1)

   Faqat zal terminali deb belgilangan qurilmada va restoran modulida
   (`TABLES`) ishlaydi. Ilova ochilganda ekran QULFLI boshlanadi: terminal
   oldida turgan odam oldingi xodimning sessiyasida ishlab ketmasin.

   ⚠ Qulflanish ham, ochilish ham sahifani qayta yuklamaydi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function TerminalGate({ login, logout }) {
  const { has, ready } = useShopFeatures();
  const on = isTerminal() && ready && has("TABLES");
  const [locked, setLocked] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const idle = idleSeconds();

  useEffect(() => {
    if (!on) return undefined;
    const lock = () => setLocked(true);
    window.addEventListener(LOCK_EVENT, lock);
    return () => window.removeEventListener(LOCK_EVENT, lock);
  }, [on]);

  useEffect(() => {
    if (!on || locked) return undefined;
    const w = watchIdle(idle, () => setLocked(true));
    return () => w.stop();
  }, [on, locked, idle]);

  const unlocked = useCallback((d) => {
    if (d.accessToken) {
      login({ token: d.accessToken, refresh: d.refreshToken, shopCode: d.shopCode,
              username: d.username, fullName: d.fullName, role: d.role });
    }
    setLocked(false);
    if (!location.pathname.startsWith("/restaurant")) navigate("/restaurant");
  }, [login, navigate, location.pathname]);

  if (!on || !locked) return null;
  return <TerminalLock idle={idle} onUnlocked={unlocked} onManager={logout} />;
}
