import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/ek-i18n";
import { qrSvg, totpNow, secondsLeft } from "../lib/ek-qr";
import { shopQrApi } from "../api";

/* ══════════════════════════════════════════════════════════════════════════
   DO'KON QR KODI — mijozni ro'yxatdan o'tkazish uchun (V34)

   Xodim shu ekranni ochib mijozga ko'rsatadi, mijoz esa telefon kamerasi
   bilan o'qiydi va o'zini ro'yxatdan o'tkazadi.

   ⚠ QR HAR 30 SONIYADA YANGILANADI. Sabab: QR rasmini olib internetga
   tashlab yuborish oson. O'zgarmas QR bo'lsa, do'konga hech qachon
   kelmagan odam ham «mijoz» bo'lib yozilaverardi va ballar begonalarga
   ketardi. Aylanuvchi kod esa ro'yxatdan o'tish uchun odam SHU PAYT
   ekran oldida turishini talab qiladi.

   ⚠ KOD ILOVADA HISOBLANADI, serverdan so'ralmaydi: do'konda internet
   uzilishi odatiy hol. Sir bir marta olinadi (`/shop-qr`), keyin QR
   internetsiz ham yangilanaveradi — server esa o'sha kodni qayta
   hisoblab tekshiradi (TOTP, RFC 6238).
   ══════════════════════════════════════════════════════════════════════════ */
export default function MobileShopQr({ toast, onClose }) {
  const { t } = useT();
  const [cfg, setCfg]     = useState(null);
  const [svg, setSvg]     = useState("");
  const [left, setLeft]   = useState(30);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  // 1. Sozlamani bir marta olamiz (sir + havola)
  useEffect(() => {
    shopQrApi.config()
      .then((r) => setCfg(r.data))
      .catch((e) => setError(e.message || "QR sozlamasini olib bo'lmadi"));
  }, []);

  // 2. Har soniyada: orqa hisob, qadam almashganda — yangi QR
  useEffect(() => {
    if (!cfg?.secret) return;
    let stopped = false;

    const draw = async () => {
      try {
        const code = await totpNow(cfg.secret, cfg.periodSeconds || 30);
        if (stopped) return;
        const url = `${cfg.joinUrl}?r=${encodeURIComponent(cfg.publicRef)}&c=${code}`;
        setSvg(qrSvg(url, { size: 260, margin: 1 }));
      } catch (e) {
        if (!stopped) setError("QR yasalmadi: " + (e.message || ""));
      }
    };

    draw();
    timer.current = setInterval(() => {
      const s = secondsLeft(cfg.periodSeconds || 30);
      setLeft(s);
      // Qadam aynan almashgan lahzada qayta chizamiz
      if (s === (cfg.periodSeconds || 30)) draw();
    }, 1000);

    return () => { stopped = true; clearInterval(timer.current); };
  }, [cfg]);

  const toggle = async () => {
    setSaving(true);
    try {
      const r = await shopQrApi.setEnabled(!cfg.joinEnabled);
      setCfg(r.data);
      toast?.(r.data.joinEnabled ? t("qr.enabled") : t("qr.disabled"), "success");
    } catch (e) {
      toast?.(e.message || "Xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="m-screen">
      <header className="m-head m-head--back">
        <button className="m-back" onClick={onClose} aria-label={t("common.back")}>
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <h1 className="m-head__title">{t("qr.title")}</h1>
      </header>

      {error && <div className="m-card m-alert">{error}</div>}

      {cfg && !cfg.joinEnabled && (
        <div className="m-card">
          <p className="text-muted" style={{ marginBottom: 10 }}>{t("qr.offHint")}</p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={toggle} disabled={saving}>
            <i className="fa-solid fa-qrcode" aria-hidden="true" /> {t("qr.enable")}
          </button>
        </div>
      )}

      {cfg?.joinEnabled && (
        <>
          <section className="m-card m-qr">
            {/* Kod yangilanganda QR sakramasligi uchun o'lcham qat'iy */}
            <div className="m-qr__box" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="m-qr__timer">
              <span className="m-qr__bar" style={{ width: `${(left / (cfg.periodSeconds || 30)) * 100}%` }} />
            </div>
            <p className="m-qr__hint">{t("qr.hint")}</p>
            <p className="text-muted" style={{ fontSize: 13, textAlign: "center" }}>
              {t("qr.refresh", { n: left })}
            </p>
          </section>

          <button className="btn btn-outline" style={{ width: "100%" }} onClick={toggle} disabled={saving}>
            {t("qr.disable")}
          </button>
        </>
      )}
    </div>
  );
}
