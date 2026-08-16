import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/ek-i18n";
import { qrSvg, totpNow, secondsLeft } from "../lib/ek-qr";
import { shopQrApi } from "../api";
import { printQrPoster } from "./QrPoster";
import CodeZoom from "./CodeZoom";

/* ══════════════════════════════════════════════════════════════════════════
   DO'KON QR — TO'LIQ PANEL uchun (Sozlamalar sahifasi)

   ⚠ NEGA IKKI JOYDA. QR ni MIJOZ so'raydi va uni KASSIR ko'rsatadi —
   ya'ni u kassa ekranida bo'lishi shart. Ilgari QR faqat telefondagi
   nazorat panelida edi: serverda kassirga ruxsat berilgan, lekin
   tugmaning o'zi yo'q edi va kassir uni umuman topa olmasdi.

   Mantiq `mobile/MobileShopQr.jsx` bilan bir xil (TOTP ilovada
   hisoblanadi, internetsiz ham ishlaydi) — bu yerda faqat ko'rinishi
   kassa uslubiga moslangan.
   ══════════════════════════════════════════════════════════════════════════ */
export default function ShopQrPanel({ toast, canManage }) {
  const { t } = useT();
  const [cfg, setCfg]       = useState(null);
  const [svg, setSvg]       = useState("");
  const [left, setLeft]     = useState(30);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom]     = useState(false);
  const timer = useRef(null);

  const shopName = localStorage.getItem("ek_shopName")
                || localStorage.getItem("ek_shopCode") || "";

  useEffect(() => {
    shopQrApi.config()
      .then((r) => setCfg(r.data))
      .catch((e) => setError(e.message || "QR sozlamasini olib bo'lmadi"));
  }, []);

  useEffect(() => {
    if (!cfg?.secret || !cfg?.joinEnabled) return;
    let stopped = false;

    const draw = async () => {
      try {
        const code = await totpNow(cfg.secret, cfg.periodSeconds || 30);
        if (stopped) return;
        setSvg(qrSvg(`${cfg.joinUrl}?r=${encodeURIComponent(cfg.publicRef)}&c=${code}`,
                     { size: 240, margin: 1 }));
      } catch (e) {
        if (!stopped) setError("QR yasalmadi");
      }
    };

    draw();
    timer.current = setInterval(() => {
      const s = secondsLeft(cfg.periodSeconds || 30);
      setLeft(s);
      if (s === (cfg.periodSeconds || 30)) draw();
    }, 1000);

    return () => { stopped = true; clearInterval(timer.current); };
  }, [cfg]);

  const call = async (fn, okMsg) => {
    setSaving(true);
    try {
      const r = await fn();
      setCfg(r.data);
      toast?.success?.(okMsg);
    } catch (e) {
      toast?.error?.(e.message || "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-muted">{error}</p>;
  if (!cfg)  return <p className="text-muted">…</p>;

  return (
    <div className="qrp">
      {!cfg.joinEnabled ? (
        <>
          <p className="text-muted qrp__hint">{t("qr.offHint")}</p>
          {canManage && (
            <button className="btn btn-primary" disabled={saving}
                    onClick={() => call(() => shopQrApi.setEnabled(true), t("qr.enabled"))}>
              <i className="fa-solid fa-qrcode" aria-hidden="true" /> {t("qr.enable")}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="qrp__code">
            {/* Oq fon SHART: qorong'i temada teskari rangdagi QR ni ko'p
                telefon kamerasi umuman o'qimaydi. */}
            {/* Bosilsa butun ekranda va maksimal yorug'likda — mijoz uni
                o'z telefoni bilan o'qiydi, kassir esa ekranni unga
                cho'zib turadi. */}
            <button type="button" className="qrp__box ek-code-btn"
                    onClick={() => setZoom(true)} aria-label={t("qr.title")}
                    dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="qrp__timer">
              <span className="qrp__bar"
                    style={{ width: `${(left / (cfg.periodSeconds || 30)) * 100}%` }} />
            </div>
            <p className="qrp__hint">{t("qr.hint")}</p>
            <p className="text-muted" style={{ fontSize: 13 }}>{t("qr.refresh", { n: left })}</p>
          </div>

          {canManage && (
            <div className="qrp__actions">
              {cfg.posterEnabled && cfg.posterUrl && (
                <button className="btn btn-outline btn-sm"
                        onClick={() => {
                          try { printQrPoster({ url: cfg.posterUrl, shopName }); }
                          catch (e) { toast?.error?.(e.message); }
                        }}>
                  <i className="fa-solid fa-print" aria-hidden="true" /> {t("qr.posterPrint")}
                </button>
              )}
              <button className="btn btn-outline btn-sm" disabled={saving}
                      onClick={() => call(() => shopQrApi.setPoster(!cfg.posterEnabled),
                                          cfg.posterEnabled ? t("qr.disabled") : t("qr.enabled"))}>
                {cfg.posterEnabled ? t("qr.posterOff") : t("qr.posterOn")}
              </button>
              <button className="btn btn-outline btn-sm" disabled={saving}
                      onClick={() => call(() => shopQrApi.setEnabled(false), t("qr.disabled"))}>
                {t("qr.disable")}
              </button>
            </div>
          )}
          {canManage && <p className="text-muted qrp__note">{t("qr.posterHint")}</p>}

          {/* ⚠ Tayyor SVG: kod har 30 soniyada yangilanadi va
              kattalashtirilgani ham u bilan birga aylanadi. */}
          {zoom && <CodeZoom kind="qr" svg={svg} onClose={() => setZoom(false)} />}
        </>
      )}
    </div>
  );
}
