import { useState } from "react";
import { useT } from "../lib/ek-i18n";
import { getSettings, saveSettings } from "../lib/ek-hw-settings";
import { SFX, config, muted, preview } from "../lib/ek-sound";

/* ══════════════════════════════════════════════════════════════════════════
   OVOZLI BILDIRISHNOMA — SOZLAMA (V89)

   ⚠ BU SOZLAMA SERVERGA YUBORILMAYDI va bu apparat sozlamalari bilan
   bir xil sabab: ovoz balandligi SHU QURILMAGA tegishli. Bir do'konning
   zaldagi kassasi shovqinli joyda, ofisdagisi jim xonada turadi.

   ⚠ APPARATLAR BO'LIMIDA EMAS: u bo'lim `.exe` bilan cheklangan
   (`off = !desktop`), ovoz esa BRAUZERDA HAM ishlaydi. Sozlamani
   o'sha yerga qo'yish uni brauzerdagi kassirdan yashirardi.

   ⚠ «SINAB KO'RISH» MAJBURIY. Ovoz jimgina yo'qolishi mumkin
   (brauzer rad etdi, qurilma ovozsiz, karnay o'chiq) va bu holat
   ekranda hech qanday iz qoldirmaydi. Tugmasiz egasi nosozlikni
   umuman aniqlay olmasdi.
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

/* ⚠ Voqealar tartibi QAT'IY va kod tartibiga bog'liq emas: kassir
   ro'yxatni har ochganda bir xil ko'rishi kerak, aks holda u
   «qayerda edi?» deb qidiradi. Muhimlari tepada. */
const ORDER = ["SALE_DONE", "ERROR", "WARN", "SCAN_MISS", "OFFLINE",
               "OK", "INFO", "CART_ADD", "SYNCED"];

export default function SoundSettings() {
  const { t } = useT();
  const [s, setS] = useState(() => getSettings().sound || {});
  const cfg = config(s);

  const set = (patch) => {
    const next = { ...getSettings().sound, ...s, ...patch };
    saveSettings({ sound: next });
    setS(next);
    return next;
  };

  /* ⚠ Har o'zgarishda DARHOL eshittiriladi: «yoqdim — eshitdim»
     zanjiri uzilmasligi kerak, aks holda egasi tugmani bosib,
     natijani bilmasdan ketardi. */
  const toggle = (event) => {
    const on = muted(event, cfg);          // hozir jim → yoqamiz
    const next = set({ events: { ...cfg.events, [event]: on } });
    if (on) preview(event, next);
  };

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-volume-high" aria-hidden="true" /> {t("sfx.title")}
        </span>
      </div>
      <p className="set-card__hint">{t("sfx.hint")}</p>
      <div className="set-list">
        <Row label={t("sfx.on")} hint={t("sfx.onHint")}>
          <button type="button" role="switch" aria-checked={cfg.on}
                  className={`ek-switch ${cfg.on ? "on" : ""}`}
                  onClick={() => { const n = set({ on: !cfg.on }); if (n.on) preview("SALE_DONE", n); }}>
            <span className="ek-switch__knob" />
            <span className="ek-switch__text">{cfg.on ? t("common.yes") : t("common.no")}</span>
          </button>
        </Row>

        {cfg.on && (
          <>
            <Row label={t("sfx.volume")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* ⚠ Slayder, raqam maydoni EMAS: «0.7» degan raqam
                    kassirga hech narsa aytmaydi, uni eshitib tanlash
                    kerak. Qo'yib yuborilganda darhol eshittiriladi. */}
                <input type="range" min="0" max="100" step="5"
                       aria-label={t("sfx.volume")}
                       value={Math.round(cfg.volume * 100)}
                       onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
                       onMouseUp={() => preview("SALE_DONE")}
                       onTouchEnd={() => preview("SALE_DONE")} />
                <span className="ek-num" style={{ width: 42, textAlign: "right", fontWeight: 700 }}>
                  {Math.round(cfg.volume * 100)}%
                </span>
              </div>
            </Row>

            {ORDER.filter((e) => SFX[e]).map((event) => (
              <Row key={event} label={t(`sfx.e.${event}`)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Eshitib ko'rish — yoqilgan-yoqilmaganidan qat'i nazar. */}
                  <button type="button" className="btn btn-outline btn-sm"
                          aria-label={`${t("sfx.play")}: ${t(`sfx.e.${event}`)}`}
                          onClick={() => preview(event, s)}>
                    <i className="fa-solid fa-play" aria-hidden="true" />
                  </button>
                  <button type="button" role="switch" aria-checked={!muted(event, cfg)}
                          className={`ek-switch ${!muted(event, cfg) ? "on" : ""}`}
                          onClick={() => toggle(event)}>
                    <span className="ek-switch__knob" />
                    <span className="ek-switch__text">
                      {muted(event, cfg) ? t("common.no") : t("common.yes")}
                    </span>
                  </button>
                </div>
              </Row>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
