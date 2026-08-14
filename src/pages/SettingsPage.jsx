import React, { useEffect, useState } from "react";
import { useT } from "../lib/ek-i18n";
import { roleLabel } from "../lib/ek-labels";
import { roleSet } from "../lib/ek-roles";
import ThemeSelect from "../components/ek/ThemeSelect";
import LangSelect from "../components/ek/LangSelect";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import FiscalPanel from "../components/FiscalPanel";
import TelegramPanel from "../components/TelegramPanel";
import HardwareSettings from "../components/HardwareSettings";
import Select from "../components/ek/Select";
import { Field } from "../components/ui";
import { shopApi } from "../api";
import { getTouchMode, setTouchMode } from "../lib/ek-touch";
import { appVersion } from "../lib/ek-update";

/* ══════════════════════════════════════════════════════════════════════════
   Sozlamalar — BARCHA sozlamalar uchun YAGONA joy.

   Ilgari tema tanlagichi yon menyu tagida turardi va til umuman yo'q edi.
   Endi bitta ekran: mavzu, til, interfeys, hisob.

   ⚠ Til FAQAT INTERFEYSGA ta'sir qiladi. Tovar nomi, mijoz ismi, kategoriya
   — bularning hammasi bazadagi ma'lumot va tarjima qilinmaydi.

   Sahifa HAMMA rolga ochiq: mavzu va til xodimning shaxsiy tanlovi,
   do'kon sozlamasi emas — kassirdan ham olib qo'yish asossiz bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ Yorliq maydon bilan BOG'LANGAN bo'lishi kerak: ilgari u shunchaki
   yonidagi `<div>` edi va ekran o'quvchi maydonni «nomsiz matn maydoni»
   deb o'qirdi (axe: «Form elements must have labels»). `aria-label`
   avtomatik uzatiladi — har satrda qo'lda yozish esdan chiqardi. */
function Row({ label, hint, children }) {
  const labelled = typeof label === "string"
    ? React.Children.map(children, (c) =>
        React.isValidElement(c) && !c.props["aria-label"] && !c.props.id
          ? React.cloneElement(c, { "aria-label": label })
          : c)
    : children;
  return (
    <div className="set-row">
      <div className="set-row__text">
        <div className="set-row__label">{label}</div>
        {hint && <div className="set-row__hint">{hint}</div>}
      </div>
      <div className="set-row__control">{labelled}</div>
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
  /* Nazorat chegaralari — FAQAT EGASIGA (backend ham shu cheklovni qo'yadi).
     Do'kon administratori ham xodim: o'zini qo'riqlaydigan raqamni o'zi
     qo'ya olsa, chegara ikkovi kelishib oladigan narsaga aylanardi. */
  const isOwner = roleSet(user?.role).has("OWNER");
  // Teginish rejimi QURILMAGA tegishli (localStorage), hisobga emas.
  const [touchMode, setTouch] = useState(() => getTouchMode());
  // Kamomad chegarasi — do'kon profilidan keladi (server saqlaydi).
  const [tolerance, setTolerance] = useState("");
  const [discountLimit, setDiscountLimit] = useState("");
  const [returnDays, setReturnDays] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [nonCashTolerance, setNonCashTolerance] = useState("");
  const [stockTolerance, setStockTolerance] = useState("");
  useEffect(() => {
    if (!isOwner) return;
    shopApi.getProfile()
      .then((r) => {
        setTolerance(String(r?.data?.cashDiffTolerance ?? 0));
        setDiscountLimit(String(r?.data?.maxDiscountPercent ?? 0));
        setReturnDays(String(r?.data?.returnDays ?? 0));
        setCreditLimit(String(r?.data?.defaultCreditLimit ?? 0));
        setNonCashTolerance(String(r?.data?.nonCashDiffTolerance ?? 0));
        setStockTolerance(String(r?.data?.stockDiffTolerance ?? 0));
      })
      .catch(() => {});
  }, [isOwner]);

  /* Har uchala sozlama bir xil yo'l bilan saqlanadi: maydondan chiqilganda.
     Alohida «Saqlash» tugmasi qo'yilmadi — bitta raqam uchun tugma bosish
     ortiqcha qadam, va u bosilmay qolsa sozlama jimgina yo'qolardi. */
  const saveField = (fn, value, fallback = 0) => async () => {
    try {
      await fn(Number(value) || fallback);
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    }
  };
  const saveTolerance = saveField(shopApi.setCashTolerance, tolerance);
  // Ilova versiyasi — faqat `.exe` da bor (brauzerda `null` qaytadi).
  const [version, setVersion] = useState(null);
  useEffect(() => { appVersion().then(setVersion).catch(() => {}); }, []);

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
        {/* Nazorat chegaralari — FAQAT EGASIGA. Xodim (kassir ham, do'kon
            admini ham) o'zini qo'riqlaydigan raqamni o'zgartira olsa,
            nazorat mexanizmining ma'nosi qolmasdi. */}
        {isOwner && (
          <>
            <Row label={t("settings.cashTolerance")} hint={t("settings.cashToleranceHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={tolerance}
                     onChange={(e) => setTolerance(e.target.value)}
                     onBlur={saveTolerance} />
            </Row>
            {/* Naqdsiz farq chegarasi naqdnikidan ALOHIDA va standarti 0:
                naqdni odam sanaydi, naqdsizda esa ikkala raqam ham
                mashinadan keladi — farq bo'lsa demak biror narsa noto'g'ri. */}
            <Row label={t("settings.nonCashTolerance")} hint={t("settings.nonCashToleranceHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={nonCashTolerance}
                     onChange={(e) => setNonCashTolerance(e.target.value)}
                     onBlur={saveField(shopApi.setNonCashTolerance, nonCashTolerance)} />
            </Row>
            {/* Inventarizatsiya kamomadi — SO'MDA (tannarx bo'yicha), donada
                emas: 3 dona konfet va 3 dona muzlatgich bir xil ko'rinsa,
                chegara ma'nosini yo'qotardi. */}
            <Row label={t("settings.stockTolerance")} hint={t("settings.stockToleranceHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={stockTolerance}
                     onChange={(e) => setStockTolerance(e.target.value)}
                     onBlur={saveField(shopApi.setStockTolerance, stockTolerance)} />
            </Row>
            <Row label={t("settings.discountLimit")} hint={t("settings.discountLimitHint")}>
              <Field kind="percent" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={discountLimit}
                     onChange={(e) => setDiscountLimit(e.target.value)}
                     onBlur={saveField(shopApi.setDiscountLimit, discountLimit)} />
            </Row>
            <Row label={t("settings.returnDays")} hint={t("settings.returnDaysHint")}>
              <Field kind="int" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={returnDays}
                     onChange={(e) => setReturnDays(e.target.value)}
                     onBlur={saveField(shopApi.setReturnDays, returnDays)} />
            </Row>
            {/* Nasiya chegarasi — do'kon STANDARTI. Har bir mijozga alohida
                qiymat Mijozlar sahifasida qo'yiladi va u shu raqamdan
                ustun turadi. */}
            <Row label={t("settings.creditLimit")} hint={t("settings.creditLimitHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={creditLimit}
                     onChange={(e) => setCreditLimit(e.target.value)}
                     onBlur={saveField(shopApi.setCreditLimit, creditLimit)} />
            </Row>
          </>
        )}
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

      {/* Telegram hisobot boti (V32) — kunlik PUL hisoboti, faqat rahbarga */}
      {isManager && <TelegramPanel toast={toast} />}

      <Section icon="fa-circle-info" title={t("settings.about")}>
        <Row label="e-Kassam">
          <span className="set-value ek-num">app.e-kassam.uz</span>
        </Row>
        {/* ⚠ Versiya KO'RINISHI SHART. Ilgari u hech qayerda yozilmagan edi
            va "ilova yangilandimi yoki yo'qmi" degan savolga javob berishning
            yo'li yo'q edi — na kassirda, na qo'ng'iroq qilganda.
            Brauzerda versiya yo'q (u doim oxirgisi), shuning uchun qator
            faqat `.exe` da chiziladi. */}
        {version && (
          <Row label={t("settings.version")}>
            <span className="set-value ek-num">{version}</span>
          </Row>
        )}
      </Section>
    </div>
  );
}
