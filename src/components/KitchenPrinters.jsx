import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { isDesktop } from "../lib/ek-desktop";
import { getSettings, saveSettings, listPrinters, printKitchen } from "../lib/ek-hardware";
import { productApi } from "../api";
import { asArray } from "../lib/ek-array";
import Select from "./ek/Select";
import { Field } from "./ui";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   OSHXONA PRINTERLARI — Sozlamalar (R4, docs/22-RESTORAN.md)

   Har bo'lim («Oshxona», «Bar») uchun shu kompyuterdan qaysi printerga
   chiqishi. Bo'lim nomlari TOIFALARDAN olinadi — ro'yxatda faqat haqiqatan
   ishlatilayotgan bo'limlar turadi, aks holda egasi «Bar» ga printer tanlab
   qo'yib, birorta toifaga yozmaganini sezmasdi.

   ⚠ Sozlama SERVERGA ketmaydi (`ek_hw`): printer kompyuterga tegishli.
   ══════════════════════════════════════════════════════════════════════════ */
export default function KitchenPrinters({ toast }) {
  const desktop = isDesktop();
  const [stations, setStations] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [map, setMap] = useState(() => getSettings().stations || {});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    productApi.getCategories()
      .then((r) => {
        if (!alive) return;
        const names = [];
        for (const c of asArray(r?.data)) {
          const s = String(c?.station || "").trim();
          if (s && !names.includes(s)) names.push(s);
        }
        setStations(names);
      })
      .catch(() => {});
    if (desktop) listPrinters().then((l) => alive && setPrinters(l || [])).catch(() => {});
    return () => { alive = false; };
  }, [desktop]);

  const put = (station, patch) => {
    const next = { ...map, [station]: { ...(map[station] || {}), ...patch } };
    setMap(next);
    saveSettings({ stations: next });
  };

  const test = async (station) => {
    setBusy(station);
    try {
      const r = await printKitchen([{ station, lines: [{ name: t("kit.testDish"), qty: 1, unitDecimals: 0, mods: [t("kit.testMod")] }] }],
        { orderNo: "TEST", at: new Date() });
      if (r.sent.length) toast?.success?.(t("kit.testSent", { name: station }));
      else if (r.missing.length) toast?.error?.(t("kit.noPrinter", { name: station }));
      else toast?.error?.(r.failed[0]?.error || t("kit.noPrinter", { name: station }));
    } finally { setBusy(""); }
  };

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-fire-burner" aria-hidden="true" /> {t("kit.title")}
        </span>
      </div>
      <p className="set-card__hint">{desktop ? t("kit.hint") : t("hw.onlyDesktop")}</p>

      {stations.length === 0 ? (
        <p className="set-card__hint">{t("kit.noStations")}</p>
      ) : (
        <div className="set-list">
          {stations.map((st) => {
            const cfg = map[st] || {};
            const value = cfg.transport === "tcp" ? "__tcp" : (cfg.printerName || "");
            return (
              <div className="set-row" key={st}>
                <div className="set-row__text">
                  <div className="set-row__label">{st}</div>
                  <div className="set-row__hint">{value ? t("kit.willPrint") : t("kit.wontPrint")}</div>
                </div>
                <div className="set-row__control kit-ctl">
                  <Select block variant="field" ariaLabel={t("kit.printerFor", { name: st })} disabled={!desktop}
                          value={value}
                          onChange={(v) => put(st, v === "__tcp"
                            ? { transport: "tcp" }
                            : { transport: "windows", printerName: v })}
                          options={[
                            { value: "", label: t("kit.none"), icon: "fa-ban" },
                            ...printers.map((p) => ({ value: p, label: p, icon: "fa-print" })),
                            { value: "__tcp", label: t("kit.network"), icon: "fa-network-wired" },
                          ]} />
                  {cfg.transport === "tcp" && (
                    <Field className="form-input ek-num" placeholder="192.168.1.50" aria-label={t("kit.ip")}
                           value={cfg.host || ""} onChange={(e) => put(st, { host: e.target.value.trim() })} />
                  )}
                  <Select variant="field" ariaLabel={t("kit.width")} disabled={!desktop}
                          value={String(cfg.width || 80)} onChange={(v) => put(st, { width: Number(v) })}
                          options={[{ value: "80", label: "80 mm" }, { value: "58", label: "58 mm" }]} />
                  <button type="button" className="btn btn-outline btn-sm" disabled={!desktop || !value || busy === st}
                          onClick={() => test(st)}>
                    {busy === st ? <Spinner /> : <i className="fa-solid fa-receipt" aria-hidden="true" />} {t("kit.test")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
