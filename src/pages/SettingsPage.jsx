import React, { useEffect, useState } from "react";
import { useT } from "../lib/ek-i18n";
import { roleLabel } from "../lib/ek-labels";
import { roleSet } from "../lib/ek-roles";
import ThemeSelect from "../components/ek/ThemeSelect";
import LangSelect from "../components/ek/LangSelect";
import { useConfirm } from "../context/ConfirmProvider";
import { useAuth } from "../hooks/useAuth";
import FiscalPanel from "../components/FiscalPanel";
import UpdatePanel from "../components/UpdatePanel";
import TelegramPanel from "../components/TelegramPanel";
import HardwareSettings from "../components/HardwareSettings";
import ScaleSettings from "../components/ScaleSettings";
import Select from "../components/ek/Select";
import { DEFAULT_NEAR_EXPIRY_DAYS } from "../lib/ek-expiry";
import { Field } from "../components/ui";
import { shopApi } from "../api";
import { getTouchMode, setTouchMode } from "../lib/ek-touch";
import { appVersion } from "../lib/ek-update";
import { useShopFeatures } from "../hooks/useShopFeatures";

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
  /* ══ MODULI YO'Q SOZLAMA KO'RSATILMAYDI (V49) ══════════════════════
     ⚠ Bu bezak emas. Yopilgan modulning sozlamasini server ham
     to'sadi (403), ya'ni tugmani bosgan ega tushunarsiz xato olardi:
     «nega nasiyani yoqolmayapman?». Sozlama modul bilan birga
     yo'qolishi kerak — shunda savolning o'zi tug'ilmaydi. */
  const { has: hasFeature } = useShopFeatures();
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
  /* ── Chegirma siyosati (V53) ────────────────────────────────────────
     Foiz NIMADAN hisoblanishi va pul birligidagi shift. Ikkalasi
     bitta so'rov bilan saqlanadi (`/shop/discount-limit`), chunki ular
     BITTA qoidaning qismlari va alohida saqlanganda oraliq holat
     yuzaga kelardi: foiz yangi, baza esa hali eski. */
  const [discountBasis, setDiscountBasis]   = useState("PROFIT");
  const [discountAmount, setDiscountAmount] = useState("");
  const [lossSale, setLossSale]             = useState(false);
  const [returnDays, setReturnDays] = useState("");
  /* Nasiya yoqilganmi (V46) — chegaraning o'rniga. */
  const [creditOn, setCreditOn] = useState(false);
  /* Muddat qaysi kundan sanaladi (V46): "EACH" · "FIRST". */
  const [creditDueMode, setCreditDueMode] = useState("EACH");
  /* Qarzni mijoz ham tasdiqlaydimi (V46). */
  const [creditConfirm, setCreditConfirm] = useState(false);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  /* Nasiya muddati (V43), kunlarda. "0" — muddatsiz. */
  const [creditDueDays, setCreditDueDays] = useState("0");
  /* Mijozga qarz eslatmasi (V44). */
  const [creditRemind, setCreditRemind] = useState(false);
  /* Bazaviy keshbek foizi (V45). "0" — keshbek yopiq. */
  const [baseCashback, setBaseCashback] = useState("0");
  const [nonCashTolerance, setNonCashTolerance] = useState("");
  const [stockTolerance, setStockTolerance] = useState("");
  const [nearExpiry, setNearExpiry] = useState("");
  useEffect(() => {
    if (!isOwner) return;
    shopApi.getProfile()
      .then((r) => {
        setTolerance(String(r?.data?.cashDiffTolerance ?? 0));
        setDiscountLimit(String(r?.data?.maxDiscountPercent ?? 0));
        setDiscountBasis(r?.data?.discountBasis || "PROFIT");
        setDiscountAmount(r?.data?.maxDiscountAmount == null ? "" : String(r.data.maxDiscountAmount));
        setLossSale(Boolean(r?.data?.allowLossSale));
        setReturnDays(String(r?.data?.returnDays ?? 0));
        setCreditOn(Boolean(r?.data?.creditEnabled));
        setCreditDueMode(r?.data?.creditDueMode || "EACH");
        setCreditConfirm(Boolean(r?.data?.creditConfirmEnabled));
        setPickupEnabled(Boolean(r?.data?.pickupEnabled));
        setCreditDueDays(String(r?.data?.creditDueDays ?? 0));
        setCreditRemind(Boolean(r?.data?.creditRemindEnabled));
        setBaseCashback(String(r?.data?.baseCashbackPercent ?? 0));
        setNonCashTolerance(String(r?.data?.nonCashDiffTolerance ?? 0));
        setStockTolerance(String(r?.data?.stockDiffTolerance ?? 0));
        /* ⚠ Bo'sh ustun — STANDART (7 kun), nol emas. Nol ko'rsatilsa egasi
           «ogohlantirish o'chiq» deb o'ylardi va u hech qachon o'chirilmagan. */
        setNearExpiry(String(r?.data?.nearExpiryDays ?? DEFAULT_NEAR_EXPIRY_DAYS));
      })
      .catch(() => {});
  }, [isOwner]);

  /* Har uchala sozlama bir xil yo'l bilan saqlanadi: maydondan chiqilganda.
     Alohida «Saqlash» tugmasi qo'yilmadi — bitta raqam uchun tugma bosish
     ortiqcha qadam, va u bosilmay qolsa sozlama jimgina yo'qolardi. */
  /**
   * Eslatmani yoqish/o'chirish (V44).
   *
   * ⚠ YOQISHDA TASDIQ SO'RALADI. Bu do'kon nomidan MIJOZLARGA boradigan
   * xabar: xato yoqilsa ertaga ertalab yuzlab odam «qarzingiz bor»
   * degan xabarni oladi va uni uzr bilan qaytarib bo'lmaydi.
   */
  const toggleCreditRemind = async () => {
    const next = !creditRemind;
    if (next) {
      const ok = await confirm({
        title: t("settings.creditRemind"),
        message: t("settings.creditRemindConfirm"),
        type: "warning",
      });
      if (!ok) return;
    }
    try {
      await shopApi.setCreditRemind(next);
      setCreditRemind(next);
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  /**
   * Tugma/tanlov sozlamasi — saqlanmasa AVVALGI holatga qaytadi.
   *
   * ⚠ Ekranni oldin o'zgartirib, keyin saqlash noto'g'ri bo'lardi:
   * server rad etsa (masalan huquq yo'q) ekranda yoqilgan, serverda esa
   * o'chiq holat qolardi va egasi buni sezmasdi.
   */
  const saveToggle = async (fn, value, set) => {
    try {
      await fn(value);
      set(value);
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  /**
   * Mijoz tasdig'ini yoqish — TASDIQ SO'RALADI.
   *
   * ⚠ Yoqilgan ondan boshlab do'kon nomidan MIJOZLARGA xabar keta
   * boshlaydi. Buni bilmay yoqib qo'yish do'konning obro'siga tegadi.
   */
  const toggleCreditConfirm = async () => {
    const next = !creditConfirm;
    if (next) {
      const ok = await confirm({
        title: t("settings.creditConfirm"),
        message: t("settings.creditConfirmAsk"),
        type: "warning",
      });
      if (!ok) return;
    }
    saveToggle(shopApi.setCreditConfirm, next, setCreditConfirm);
  };

  /* Ombordan berib yuborish (V48) — tasdiq so'ralmaydi: bu ichki
     tashkiliy sozlama, mijozga hech qanday xabar yubormaydi. */
  const togglePickup = () =>
    saveToggle(shopApi.setPickupEnabled, !pickupEnabled, setPickupEnabled);

  const saveField = (fn, value, fallback = 0) => async () => {
    try {
      await fn(Number(value) || fallback);
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    }
  };
  const saveTolerance = saveField(shopApi.setCashTolerance, tolerance);

  /**
   * Chegirma siyosati — UCHALA qiymat BIRGA saqlanadi.
   *
   * ⚠ Alohida saqlanganda oraliq holat yuzaga kelardi: foiz yangi
   * qiymatda, baza esa hali eski — ya'ni bir necha soniya davomida
   * chegara mutlaqo boshqa narsani anglatardi va o'sha paytda o'tgan
   * chek noto'g'ri tekshirilardi.
   *
   * `basisNow` — Select `onChange` da holat hali yangilanmagan bo'ladi.
   */
  const saveDiscount = async (basisNow) => {
    try {
      await shopApi.setDiscountLimit(
        Number(discountLimit) || 0,
        basisNow || discountBasis,
        /* Bo'sh maydon — «shiftni olib tashla». Server buni manfiy
           qiymatdan biladi: `null` yuborilsa «tegilmasin» degani
           bo'lardi va shiftni o'chirishning yo'li qolmasdi. */
        discountAmount === "" ? -1 : Number(discountAmount) || 0,
      );
      toast?.success(t("common.saved"));
    } catch (err) {
      toast?.error(err.message);
    }
  };
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
                        {/* Sanoq chegarasi — inventarizatsiya moduli bilan birga */}
            {hasFeature("STOCK_TAKE") && (
<Row label={t("settings.stockTolerance")} hint={t("settings.stockToleranceHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={stockTolerance}
                     onChange={(e) => setStockTolerance(e.target.value)}
                     onBlur={saveField(shopApi.setStockTolerance, stockTolerance)} />
            </Row>
            )}
            {/* «Muddati yaqin» oynasi (V41) — chegaralar yonida, chunki u
                ham do'kon bo'ylab ishlaydigan va faqat egasi qo'yadigan
                raqam. Sut do'koniga 7 kun uzoq, dorixonaga qisqa. */}
                        {/* «Muddati yaqin» oynasi — muddat nazorati moduli bilan birga */}
            {hasFeature("EXPIRY") && (
<Row label={t("settings.nearExpiry")} hint={t("settings.nearExpiryHint")}>
              <Field kind="int" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={nearExpiry}
                     onChange={(e) => setNearExpiry(e.target.value)}
                     onBlur={saveField(shopApi.setNearExpiryDays, nearExpiry, DEFAULT_NEAR_EXPIRY_DAYS)} />
            </Row>
            )}
            <Row label={t("settings.discountLimit")} hint={t("settings.discountLimitHint")}>
              <Field kind="percent" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={discountLimit}
                     onChange={(e) => setDiscountLimit(e.target.value)}
                     onBlur={() => saveDiscount()} />
            </Row>

            {/* ⚠ FOIZ NIMADAN (V53). Ilgari chegara faqat NARXDAN
                hisoblanardi va bu noto'g'ri o'lchov edi: 10% chegirma
                marjasi 50% bo'lgan tovarda arzimas, marjasi 8%
                bo'lganida esa do'konni ZARARGA olib kirardi — bitta
                foiz ikki tovarda ikki xil ma'no anglatardi. */}
            <Row label={t("settings.discountBasis")} hint={t("settings.basisHint")}>
              <Select
                value={discountBasis}
                onChange={(v) => { setDiscountBasis(v); saveDiscount(v); }}
                variant="field"
                ariaLabel={t("settings.discountBasis")}
                options={[
                  { value: "PROFIT", icon: "fa-arrow-trend-up", label: t("settings.basisProfit") },
                  { value: "PRICE",  icon: "fa-tag",            label: t("settings.basisPrice") },
                ]}
              />
            </Row>

            <Row label={t("settings.discountAmount")} hint={t("settings.discountAmountHint")}>
              <Field kind="money" className="form-input ek-num"
                     wrapStyle={{ width: 180 }}
                     value={discountAmount}
                     onChange={(e) => setDiscountAmount(e.target.value)}
                     onBlur={() => saveDiscount()} />
            </Row>

            {/* ⚠ ZARARIGA SOTISH (V53). Yoqilganda ham har bunday chek
                rahbar bajigi bilan o'tadi va hisobotda alohida «zarar»
                qatorida ko'rinadi — bu sozlama uni YASHIRMAYDI, faqat
                MUMKIN qiladi. */}
            <Row label={t("settings.lossSale")} hint={t("settings.lossSaleHint")}>
              <button
                type="button"
                role="switch"
                aria-checked={lossSale}
                className={`ek-switch ${lossSale ? "on" : ""}`}
                onClick={() => saveToggle(shopApi.setLossSale, !lossSale, setLossSale)}
              >
                <span className="ek-switch__knob" />
                <span className="ek-switch__text">
                  {lossSale ? t("common.yes") : t("common.no")}
                </span>
              </button>
            </Row>
            <Row label={t("settings.returnDays")} hint={t("settings.returnDaysHint")}>
              <Field kind="int" className="form-input ek-num"
                     wrapStyle={{ width: 160 }}
                     value={returnDays}
                     onChange={(e) => setReturnDays(e.target.value)}
                     onBlur={saveField(shopApi.setReturnDays, returnDays)} />
            </Row>
            {/* ⚠ CHEGARA O'RNIGA YOQISH TUGMASI (V46). Ilgari nasiyani
                ikkita raqam cheklardi (do'kon standarti va mijozniki),
                lekin do'koncha qarzni raqamga qarab emas, ODAMGA qarab
                beradi: qo'shnisiga million, notanishga umuman yo'q.
                Chegara esa har safar yo'lni to'sib, uni oshirib
                qo'yishga majburlardi — himoya emas, ortiqcha qadam edi.

                O'chirish ESKI QARZNI TEGMAYDI: to'lovlar qabul
                qilinaveradi, faqat yangi nasiya to'siladi. */}
                        {/* Nasiya sozlamalari — nasiya moduli bilan birga */}
            {hasFeature("CREDIT") && (
<Row label={t("settings.creditEnabled")} hint={t("settings.creditEnabledHint")}>
              <button
                type="button"
                role="switch"
                aria-checked={creditOn}
                className={`ek-switch ${creditOn ? "on" : ""}`}
                onClick={() => saveToggle(shopApi.setCreditEnabled, !creditOn, setCreditOn)}
              >
                <span className="ek-switch__knob" />
                <span className="ek-switch__text">
                  {creditOn ? t("common.yes") : t("common.no")}
                </span>
              </button>
            </Row>
            )}
            {/* ⚠ Muddat SAVDONI TO'SMAYDI — to'sish chegaraning ishi.
                Muddat faqat «muddati o'tgan qarz» ko'rsatkichini yoqadi:
                qarzdorlar ro'yxatida va bosh sahifada. Ikkalasini
                aralashtirsak, kechikkan bitta chek butun mijozga savdoni
                yopib qo'yardi va do'kon buni kutmasdi. */}
                        {/*  */}
            {hasFeature("CREDIT") && (
<Row label={t("settings.creditDueDays")} hint={t("settings.creditDueDaysHint")}>
              <Field kind="int" className="form-input ek-num"
                     wrapStyle={{ width: 100 }}
                     value={creditDueDays}
                     onChange={(e) => setCreditDueDays(e.target.value)}
                     onBlur={saveField(shopApi.setCreditDueDays, creditDueDays)} />
            </Row>
            )}
            {/* ⚠ MUDDAT QAYSI KUNDAN SANALADI (V46). Do'konlar qarzni ikki
                xil boshqaradi va ikkalasi ham to'g'ri: mahalla do'koni
                «oyning oxirida hisoblashamiz» deydi (qarz bitta hisob),
                ulgurji sotuvchi esa har yuk uchun alohida muddat beradi.
                Bittasini majburlash ikkinchisiga yolg'on ko'rsatkich
                berardi. */}
                        {/*  */}
            {hasFeature("CREDIT") && (
<Row label={t("settings.creditDueMode")} hint={t(`settings.creditDueMode.${creditDueMode}`)}>
              <Select
                value={creditDueMode}
                onChange={(v) => saveToggle(shopApi.setCreditDueMode, v, setCreditDueMode)}
                options={[
                  { value: "EACH",  label: t("settings.creditDueMode.eachLabel"),  icon: "fa-layer-group" },
                  { value: "FIRST", label: t("settings.creditDueMode.firstLabel"), icon: "fa-hourglass-start" },
                ]}
              />
            </Row>
            )}
            {/* ⚠⚠ MIJOZ TASDIG'I (V46) — KASSANI TO'SMAYDI. Chek darhol
                yakunlanadi, so'rov esa mijozga keyin boradi (ilova ·
                Telegram · SMS). Aks holda navbat mijozning telefoniga
                bog'liq bo'lib qolardi. Tasdiq — DALIL, ruxsat emas. */}
                        {/*  */}
            {hasFeature("CREDIT") && (
<Row label={t("settings.creditConfirm")} hint={t("settings.creditConfirmHint")}>
              <button
                type="button"
                role="switch"
                aria-checked={creditConfirm}
                className={`ek-switch ${creditConfirm ? "on" : ""}`}
                onClick={toggleCreditConfirm}
              >
                <span className="ek-switch__knob" />
                <span className="ek-switch__text">
                  {creditConfirm ? t("common.yes") : t("common.no")}
                </span>
              </button>
            </Row>
            )}
            {/* ⚠⚠ OMBORDAN BERIB YUBORISH (V48). Mijoz kassaga to'laydi,
                tovar esa kassadan uzoqda — omborda yoki hovlida.
                Yoqilganda «ombordan beriladi» deb belgilangan tovarli
                chek omborchining ekraniga tushadi.

                ⚠ Qaysi tovar — TOVARNING o'zida belgilanadi: bitta
                do'konda ham javondagi saqich, ham hovlidagi sement
                bo'ladi va ikkinchisi uchun yoqilgan tizim birinchisini
                ham navbatga tashlab, kassani sekinlashtirardi. */}
                        {/* Ombordan berish — o'z moduli bilan birga */}
            {hasFeature("PICKUP") && (
<Row label={t("settings.pickup")} hint={t("settings.pickupHint")}>
              <button
                type="button"
                role="switch"
                aria-checked={pickupEnabled}
                className={`ek-switch ${pickupEnabled ? "on" : ""}`}
                onClick={togglePickup}
              >
                <span className="ek-switch__knob" />
                <span className="ek-switch__text">
                  {pickupEnabled ? t("common.yes") : t("common.no")}
                </span>
              </button>
            </Row>
            )}
            {/* ⚠ ALOHIDA SOZLAMA, muddatning davomi emas. Muddat do'konning
                ichki qoidasi, bu esa do'kon nomidan MIJOZGA boradigan
                xabar — uni ongli ravishda yoqish kerak. Izohda mijoz
                aynan nima olishi yozilgan: egasi nomidan ketadigan
                matnni ko'rmasdan yoqishi to'g'ri bo'lmasdi. */}
            {/* ⚠ BAZAVIY keshbek (V45) — sodiqlik darajasidan MUSTAQIL.
                Ilgari keshbek faqat daraja jadvali orqali berilardi va
                «hamma xaridga 1%» degan eng oddiy istak uchun ham do'kon
                `minSpent = 0` li qator qo'shishi kerak edi — aksariyati
                buni qilmasdi. Daraja bo'lsa ikkisining KATTAROG'I
                olinadi: daraja faqat oshiradi. */}
                        {/* Bazaviy keshbek — sodiqlik moduli bilan birga */}
            {hasFeature("LOYALTY") && (
<Row label={t("settings.baseCashback")} hint={t("settings.baseCashbackHint")}>
              <Field kind="percent" className="form-input ek-num"
                     wrapStyle={{ width: 100 }}
                     value={baseCashback}
                     onChange={(e) => setBaseCashback(e.target.value)}
                     onBlur={saveField(shopApi.setBaseCashback, baseCashback)} />
            </Row>
            )}
                        {/*  */}
            {hasFeature("CREDIT") && (
<Row label={t("settings.creditRemind")} hint={t("settings.creditRemindHint")}>
              <button
                type="button"
                role="switch"
                aria-checked={creditRemind}
                className={`ek-switch ${creditRemind ? "on" : ""}`}
                onClick={toggleCreditRemind}
              >
                <span className="ek-switch__knob" />
                <span className="ek-switch__text">
                  {creditRemind ? t("common.yes") : t("common.no")}
                </span>
              </button>
            </Row>
            )}
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

      {/* Tarozi formati — faqat EGAGA: server ham shu yo'lni egaga
          cheklaydi (`/shop/scale`), bo'limni kassirga ko'rsatib qo'yish
          esa faqat umid uyg'otib, keyin 403 bilan tugardi. */}
      {/* ⚠ Tarozi sozlamasi ham MODULGA bog'liq (V49): kiyim
          do'konida bu blokning mavjudligi noto'g'ri taassurot
          beradi — «demak bu yerda tarozi ishlaydi». */}
      {isOwner && hasFeature("SCALE") && <ScaleSettings toast={toast} />}

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

      {/* ⚠ YANGILANISH BO'LIMI (2026-08-17). Ilgari yangilanish faqat
          avtomatik oyna orqali taklif qilinardi va u tasodifan yopilsa
          ikki soatga uxlab qolardi — odamda uni qayta chaqirish yo'li
          yo'q edi (ilovani o'chirib-yoqishdan boshqa). */}
      <Section icon="fa-cloud-arrow-down" title={t("update.section")}
               hint={t("update.sectionHint")}>
        <UpdatePanel version={version} toast={toast} />
      </Section>

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
