import { useState } from "react";
import { useT } from "../lib/ek-i18n";
import { roleLabel } from "../lib/ek-labels";
import ThemeSelect from "../components/ek/ThemeSelect";
import LangSelect from "../components/ek/LangSelect";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";

/* ══════════════════════════════════════════════════════════════════════════
   Sozlamalar — BARCHA sozlamalar uchun YAGONA joy.

   Ilgari tema tanlagichi yon menyu tagida turardi va til umuman yo'q edi.
   Endi bitta ekran: mavzu, til, interfeys, hisob.

   ⚠ Til FAQAT INTERFEYSGA ta'sir qiladi. Tovar nomi, mijoz ismi, kategoriya
   — bularning hammasi bazadagi ma'lumot va tarjima qilinmaydi.

   Sahifa HAMMA rolga ochiq: mavzu va til xodimning shaxsiy tanlovi,
   do'kon sozlamasi emas — kassirdan ham olib qo'yish asossiz bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-row__text">
        <div className="set-row__label">{label}</div>
        {hint && <div className="set-row__hint">{hint}</div>}
      </div>
      <div className="set-row__control">{children}</div>
    </div>
  );
}

function Section({ icon, title, hint, children }) {
  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className={`fa-solid ${icon}`} aria-hidden="true" /> {title}
        </span>
      </div>
      {hint && <p className="set-card__hint">{hint}</p>}
      <div className="set-list">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useT();
  const confirm = useConfirm();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sb_collapsed") === "1"
  );

  const toggleCollapsed = (next) => {
    setCollapsed(next);
    localStorage.setItem("sb_collapsed", next ? "1" : "0");
    // Layout localStorage'ni kuzatmaydi — o'zgarishni hodisa bilan aytamiz.
    window.dispatchEvent(new Event("ek:sidebar"));
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: t("layout.logout"),
      message: t("layout.logoutConfirm"),
      type: "warning",
      confirmText: t("layout.logout"),
      cancelText: t("common.cancel"),
    });
    if (ok) logout();
  };

  return (
    <div className="set-page">
      <h2 className="page-title">{t("settings.title")}</h2>

      <Section
        icon="fa-palette"
        title={t("settings.appearance")}
        hint={t("settings.appearanceHint")}
      >
        <Row label={t("settings.theme")} hint={t("settings.themeHint")}>
          <ThemeSelect />
        </Row>
        <Row label={t("settings.language")} hint={t("settings.languageHint")}>
          <LangSelect />
        </Row>
      </Section>

      <Section icon="fa-sliders" title={t("settings.interface")}>
        <Row label={t("settings.sidebarCollapsed")} hint={t("settings.sidebarHint")}>
          {/* Holat IKKITA — bu yerda tugma to'g'ri. Uch holatli narsa
              (mavzu) uchun `Select` ishlatiladi. */}
          <button
            type="button"
            role="switch"
            aria-checked={collapsed}
            className={`ek-switch ${collapsed ? "on" : ""}`}
            onClick={() => toggleCollapsed(!collapsed)}
          >
            <span className="ek-switch__knob" />
            <span className="ek-switch__text">
              {collapsed ? t("common.yes") : t("common.no")}
            </span>
          </button>
        </Row>
      </Section>

      <Section
        icon="fa-user"
        title={t("settings.account")}
        hint={t("settings.accountHint")}
      >
        <Row label={t("common.fullName")}>
          <span className="set-value">{user?.fullName || "—"}</span>
        </Row>
        <Row label={t("common.username")}>
          <span className="set-value ek-num">@{user?.username || "—"}</span>
        </Row>
        <Row label={t("common.role")}>
          <span className="set-value">{roleLabel(user?.role)}</span>
        </Row>
        <Row label={t("settings.shopCode")}>
          <span className="set-value ek-num">{user?.shopCode || "—"}</span>
        </Row>
        <Row label={t("settings.session")}>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            {t("settings.logoutAll")}
          </button>
        </Row>
      </Section>

      <Section icon="fa-circle-info" title={t("settings.about")}>
        <Row label="e-Kassam">
          <span className="set-value ek-num">app.e-kassam.uz</span>
        </Row>
      </Section>
    </div>
  );
}
