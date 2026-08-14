import { useT } from "../lib/ek-i18n";
import LangSelect from "../components/ek/LangSelect";
import ThemeSelect from "../components/ek/ThemeSelect";
import TelegramPanel from "../components/TelegramPanel";
import { registerPushIfPossible } from "../lib/ek-push";
import { useConfirm } from "../context/ConfirmProvider";
import { useEffect, useState } from "react";

/* Sozlamalar: Telegram, push holati, til/tema, to'liq panel, chiqish.
   Kassa sozlamalari (chegaralar, fiskal, apparat) ATAYLAB yo'q —
   ular do'kondagi ishlar, telefondan sozlanmaydi. */
export default function MobileSettings({ toast, user, logout }) {
  const { t } = useT();
  const confirm = useConfirm();
  const [pushState, setPushState] = useState("unknown"); // unknown|on|off|unsupported

  useEffect(() => {
    registerPushIfPossible().then(setPushState).catch(() => setPushState("off"));
  }, []);

  /* Chiqish — TASDIQ bilan: telefonda tugma barmoq ostida, bexosdan
     bosilsa sessiya yo'qolib, kod bilan qayta kirishga to'g'ri kelardi. */
  const handleLogout = async () => {
    const ok = await confirm({
      title: t("layout.logout"),
      message: t("layout.logoutConfirm"),
      type: "warning",
    });
    if (ok) logout();
  };

  /* To'liq panel — kassa/ombor/mijozlar daraxti (App.jsx bayroqni o'qiydi).
     Qaytish tugmasi to'liq rejim topbar'ida. */
  const openFullPanel = () => {
    localStorage.setItem("ek_mobileFull", "1");
    window.location.reload();
  };

  return (
    <div className="m-screen">
      <header className="m-head">
        <h1 className="m-head__title">{t("m.tab.settings")}</h1>
      </header>

      <section className="m-card">
        <div className="m-row">
          <span><i className="fa-solid fa-user" aria-hidden="true" /> {user?.fullName || user?.username}</span>
          <small className="text-muted">{user?.shopCode}</small>
        </div>
        <div className="m-row">
          <span><i className="fa-solid fa-bell" aria-hidden="true" /> {t("m.push")}</span>
          <b className={pushState === "on" ? "m-pos" : ""}>
            {pushState === "on" ? t("m.pushOn")
              : pushState === "unsupported" ? t("m.pushUnsupported")
              : t("m.pushOff")}
          </b>
        </div>
        <div className="m-row">
          <span>{t("settings.language")}</span>
          <LangSelect />
        </div>
        <div className="m-row">
          <span>{t("settings.theme")}</span>
          <ThemeSelect />
        </div>
      </section>

      <TelegramPanel toast={toast} />

      {/* To'liq panel: kassa, ombor, mijozlar va boshqa barcha bo'limlar */}
      <section className="m-card">
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={openFullPanel}>
          <i className="fa-solid fa-table-columns" aria-hidden="true" /> {t("m.fullPanel")}
        </button>
        <p className="text-muted" style={{ marginTop: 8, fontSize: 13, textAlign: "center" }}>
          {t("m.fullPanelHint")}
        </p>
      </section>

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={handleLogout}>
        <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> {t("layout.logout")}
      </button>
    </div>
  );
}
