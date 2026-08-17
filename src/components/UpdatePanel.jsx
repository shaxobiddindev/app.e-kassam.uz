import { useState } from "react";
import { t } from "../lib/ek-i18n";
import { checkUpdate, installUpdate } from "../lib/ek-update";
import { isDesktop, isMobileApp } from "../lib/ek-desktop";

/* ══════════════════════════════════════════════════════════════════════════
   SOZLAMALARDAGI «YANGILANISH» BO'LIMI (2026-08-17)

   ⚠ NEGA KERAK: yangilanish faqat AVTOMATIK oyna orqali taklif qilinardi.
   U tasodifan yopilsa (yoki «Keyinroq» bosilsa) ikki soatga uxlab qolardi
   va odamda uni QAYTA CHAQIRISH yo'li YO'Q edi — ilovani o'chirib-yoqishdan
   boshqa. Endi yangilanishni istalgan payt shu yerdan tekshirish va
   o'rnatish mumkin.

   Uch xil qurilma, uch xil xatti-harakat:
     · `.exe` (kassa) — o'zi tekshiradi, yuklab oladi va qayta ishga
       tushadi;
     · Android — ilova o'zini almashtira olmaydi (Play tashqarisidagi APK),
       shuning uchun yuklab olish sahifasi ochiladi;
     · brauzer — versiya tushunchasi yo'q, sahifani yangilash kifoya.
   ══════════════════════════════════════════════════════════════════════════ */

/** Landingdagi doimiy havola — reliz almashsa ham o'zgarmaydi. */
const APK_URL = "https://github.com/shaxobiddindev/app.e-kassam.uz/releases/download/android-latest/e-kassam.apk";

export default function UpdatePanel({ version, toast }) {
  /* idle | checking | found | none | busy */
  const [state, setState] = useState("idle");
  const [found, setFound] = useState(null);
  const [percent, setPercent] = useState(null);

  const look = async () => {
    setState("checking");
    const u = await checkUpdate();
    setFound(u);
    setState(u ? "found" : "none");
  };

  const install = async () => {
    setState("busy");
    setPercent(null);
    try {
      // Qaytmaydi: o'rnatishdan keyin ilova qayta ishga tushadi.
      await installUpdate(found, setPercent);
    } catch (err) {
      setState("found");
      toast?.error?.(`${t("update.failed")}: ${err?.message || err}`);
    }
  };

  /* ── Android: ilova o'zini almashtira olmaydi ── */
  if (isMobileApp()) {
    return (
      <>
        <p className="set-card__hint">{t("update.apkHint")}</p>
        <button className="btn btn-primary btn-sm"
                onClick={() => window.open(APK_URL, "_blank", "noopener")}>
          <i className="fa-solid fa-download" aria-hidden="true" /> {t("update.apkDownload")}
        </button>
      </>
    );
  }

  /* ── Brauzer: versiya yo'q, qayta yuklash yetarli ── */
  if (!isDesktop()) {
    return (
      <>
        <p className="set-card__hint">{t("update.webHint")}</p>
        <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>
          <i className="fa-solid fa-rotate" aria-hidden="true" /> {t("update.reload")}
        </button>
      </>
    );
  }

  /* ── `.exe`: to'liq oqim ── */
  return (
    <>
      <p className="set-card__hint">
        {version ? t("update.current").replace("{v}", version) : ""}
      </p>

      {state === "busy" ? (
        <p>{percent == null ? t("update.downloading") : `${t("update.downloading")} ${percent}%`}</p>
      ) : state === "found" ? (
        <>
          <p style={{ marginBottom: 8 }}>
            {t("update.available")
              .replace("{v}", found?.version || "")
              .replace("{cur}", found?.currentVersion || version || "")}
          </p>
          <button className="btn btn-primary btn-sm" onClick={install}>
            <i className="fa-solid fa-download" aria-hidden="true" /> {t("update.now")}
          </button>
        </>
      ) : (
        <>
          {state === "none" && <p style={{ marginBottom: 8 }}>{t("update.upToDate")}</p>}
          <button className="btn btn-outline btn-sm" onClick={look} disabled={state === "checking"}>
            <i className="fa-solid fa-rotate" aria-hidden="true" />{" "}
            {state === "checking" ? t("common.checking") : t("update.check")}
          </button>
        </>
      )}
    </>
  );
}
