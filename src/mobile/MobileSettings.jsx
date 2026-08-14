import { useT } from "../lib/ek-i18n";
import LangSelect from "../components/ek/LangSelect";
import ThemeSelect from "../components/ek/ThemeSelect";
import TelegramPanel from "../components/TelegramPanel";
import { registerPushIfPossible } from "../lib/ek-push";
import { useEffect, useState } from "react";

/* Sozlamalar: Telegram, push holati, til/tema, chiqish.
   Kassa sozlamalari (chegaralar, fiskal, apparat) ATAYLAB yo'q —
   ular do'kondagi ishlar, telefondan sozlanmaydi. */
export default function MobileSettings({ toast, user, logout }) {
  const { t } = useT();
  const [pushState, setPushState] = useState("unknown"); // unknown|on|off|unsupported

  useEffect(() => {
    registerPushIfPossible().then(setPushState).catch(() => setPushState("off"));
  }, []);

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

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={logout}>
        <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> {t("layout.logout")}
      </button>
    </div>
  );
}
