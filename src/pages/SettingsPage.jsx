import { useState } from "react";
import { useT } from "../lib/ek-i18n";
import { roleLabel } from "../lib/ek-labels";
import { roleSet } from "../lib/ek-roles";
import ThemeSelect from "../components/ek/ThemeSelect";
import LangSelect from "../components/ek/LangSelect";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import FiscalPanel from "../components/FiscalPanel";
import HardwareSettings from "../components/HardwareSettings";
import Select from "../components/ek/Select";
import { getTouchMode, setTouchMode } from "../lib/ek-touch";

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

export default function SettingsPage({ toast }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  // Fiskal panel — egasi va do'kon administratoriga.
  const isManager = [...roleSet(user?.role)].some((r) => r === "OWNER" || r === "SHOP_ADMIN");
  // Teginish rejimi QURILMAGA tegishli (localStorage), hisobga emas.
  const [touchMode, setTouch] = useState(() => getTouchMode());

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
        {/* Uch holat — shuning uchun `Select`, tugma emas: "avtomatik"
            ham to'la huquqli holat va uni tugma bilan ifodalab bo'lmaydi. */}
        <Row label={t("touch.label")} hint={t("touch.hint")}>
          <Select
            value={touchMode}
            onChange={(v) => { setTouch(v); setTouchMode(v); }}
            options={[
              { value: "auto", label: t("touch.auto"), icon: "fa-wand-magic-sparkles" },
              { value: "on",   label: t("touch.on"),   icon: "fa-hand-pointer" },
              { value: "off",  label: t("touch.off"),  icon: "fa-computer-mouse" },
            ]}
          />
        </Row>
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

      {/* Apparatlar — hisobdan OLDIN: kassir bu ekranga aynan printer
          ishlamay qolganda keladi, "hisob" bo'limiga esa deyarli hech qachon. */}
      <HardwareSettings toast={toast} />

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
          {/* Bir nechta rol bo'lsa hammasi ko'rsatiladi — bu ma'lumot
              ekrani, yorliq emas. */}
          <span className="set-value">
            {[...roleSet(user?.role)].map(roleLabel).join(", ") || "—"}
          </span>
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

      {/* Fiskal holat — FAQAT rahbarga: kassirning bu yerda qiladigan
          ishi yo'q va backend ham uni bu yo'lga qo'ymaydi. */}
      {isManager && <FiscalPanel toast={toast} />}

      <Section icon="fa-circle-info" title={t("settings.about")}>
        <Row label="e-Kassam">
          <span className="set-value ek-num">app.e-kassam.uz</span>
        </Row>
      </Section>
    </div>
  );
}
