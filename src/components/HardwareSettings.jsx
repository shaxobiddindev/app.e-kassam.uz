import { useState, useEffect } from "react";
import { useT } from "../lib/ek-i18n";
import { isDesktop } from "../lib/ek-desktop";
import { getSettings, saveSettings, listPrinters, testPrint, openDrawer } from "../lib/ek-hardware";
import Select from "./ek/Select";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   Kassa apparatlari — Sozlamalar ekranining bo'limi

   ⚠ Bu sozlamalar SERVERGA yuborilmaydi. Printer shu KOMPYUTERGA tegishli,
   hisobga emas: bir do'konda ikkita kassa bo'lsa, har biri o'z printerini
   ko'rsatadi va bir xil hisob bilan kirishadi.

   Brauzerda bo'lim ochiladi, lekin faqat tushuntirish bilan: apparatga
   to'g'ridan-to'g'ri kirish `.exe` da bor. Bo'limni butunlay yashirish
   noto'g'ri bo'lardi — kassir "sozlama qayerda?" deb qidirib qolardi.
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

function Switch({ checked, onChange, yes, no }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
            className={`ek-switch ${checked ? "on" : ""}`}
            onClick={() => onChange(!checked)}>
      <span className="ek-switch__knob" />
      <span className="ek-switch__text">{checked ? yes : no}</span>
    </button>
  );
}

export default function HardwareSettings({ toast }) {
  const { t } = useT();
  const [s, setS]           = useState(getSettings);
  const [printers, setPrinters] = useState([]);
  const [busy, setBusy]     = useState(false);
  const desktop = isDesktop();

  const load = () => { listPrinters().then(setPrinters).catch(() => setPrinters([])); };
  useEffect(() => { if (desktop) load(); }, [desktop]);

  const set = (patch) => setS(saveSettings(patch));

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast?.success?.(okMsg); }
    catch (err) { toast?.error?.(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-cash-register" aria-hidden="true" /> {t("hw.title")}
        </span>
      </div>
      <p className="set-card__hint">{desktop ? t("hw.subtitle") : t("hw.onlyDesktop")}</p>

      <div className="set-list" style={desktop ? undefined : { opacity: .55, pointerEvents: "none" }}>
        <Row label={t("hw.transport")}>
          {/* ⚠ «Brauzer» varianti desktop'da YO'Q. U `window.open` ga
              tayanadi, Tauri oynasida esa bu bo'sh OS oynasini ochadi —
              ekranda oq oyna qoladi va chek umuman chiqmaydi. Brauzer
              versiyasida esa tanlash shart emas: u yagona yo'l. */}
          <Select
            value={s.transport === "browser" ? "windows" : s.transport}
            onChange={(v) => set({ transport: v })}
            options={[
              { value: "windows", label: t("hw.transportWindows") },
              { value: "tcp",     label: t("hw.transportTcp") },
            ]}
          />
        </Row>

        {s.transport === "windows" && (
          <Row label={t("hw.printer")}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Select
                value={s.printerName}
                onChange={(v) => set({ printerName: v })}
                options={[
                  { value: "", label: t("hw.defaultPrinter") },
                  ...printers.map((p) => ({ value: p, label: p })),
                ]}
              />
              {/* Printer ilova ochiq turganda ulanishi mumkin — ro'yxatni
                  qayta o'qish uchun ilovani yopish shart emas. */}
              <button className="btn btn-outline btn-sm" onClick={load} title={t("hw.refresh")}>
                <i className="fa-solid fa-rotate" aria-hidden="true" />
              </button>
            </div>
          </Row>
        )}

        {s.transport === "tcp" && (
          <>
            <Row label={t("hw.host")}>
              <input className="form-input mono" style={{ maxWidth: 180 }}
                     value={s.host} placeholder="192.168.1.50"
                     onChange={(e) => set({ host: e.target.value.trim() })} />
            </Row>
            <Row label={t("hw.port")}>
              <NumField className="form-input mono" kind="int" max={65535} style={{ maxWidth: 100 }}
                     value={s.port}
                     onChange={(e) => set({ port: Number(e.target.value) || 9100 })} />
            </Row>
          </>
        )}

        <Row label={t("hw.width")}>
          <Select
            value={String(s.width)}
            onChange={(v) => set({ width: Number(v) })}
            options={[{ value: "80", label: "80 mm" }, { value: "58", label: "58 mm" }]}
          />
        </Row>

        <Row label={t("hw.autoPrint")}>
          <Switch checked={s.autoPrint} onChange={(v) => set({ autoPrint: v })}
                  yes={t("common.yes")} no={t("common.no")} />
        </Row>

        <Row label={t("hw.openDrawerSetting")}>
          <Switch checked={s.openDrawer} onChange={(v) => set({ openDrawer: v })}
                  yes={t("common.yes")} no={t("common.no")} />
        </Row>

        <Row label={t("hw.scannerSetting")} hint={t("hw.scannerHint")}>
          <Switch checked={s.scanner} onChange={(v) => set({ scanner: v })}
                  yes={t("common.yes")} no={t("common.no")} />
        </Row>

        {/* Sinov — sozlash oxiridagi yagona savolga javob beradi:
            "chindan ham ishlayaptimi?" */}
        <Row label={t("hw.test")}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => run(testPrint, t("hw.testSent"))}>
              {busy ? <Spinner small /> : <i className="fa-solid fa-print" aria-hidden="true" />}
              {t("hw.test")}
            </button>
            <button className="btn btn-outline btn-sm" disabled={busy}
                    onClick={() => run(openDrawer, t("hw.openDrawer"))}>
              <i className="fa-solid fa-box-open" aria-hidden="true" /> {t("hw.openDrawer")}
            </button>
          </div>
        </Row>
      </div>
    </div>
  );
}
