import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import Modal from "../Modal";
import Select from "./Select";
import { SkeletonList } from "./Loading";
import { isDesktop } from "../../lib/ek-desktop";
import { printRawLabel } from "../../lib/ek-hardware";
import { calibrationCommand, supportsBytes, toBytes } from "../../lib/ek-label-bytes";
import { layoutLabel } from "../../lib/ek-label-render";
import { templateName } from "../../lib/ek-label-name";

/* ══════════════════════════════════════════════════════════════════════════
   PRINTERNI SOZLASH SEHRGARI (G4)

   ⚠ QO'LLAB-QUVVATLASHNING №1 MUAMMOSI SHU YERDA HAL BO'LADI.
   Yorliq printeri bilan ishlagan har bir do'kon aynan uchtasiga
   duch keladi va uchalasining ham yechimi bir tugma:

     · «yorliq qiyshiq chiqyapti / bo'sh yorliq ketyapti»
         → MEDIA KALIBRLASH (printer qog'oz oralig'ini o'lchaydi)
     · «barkod och chiqyapti, skaner o'qimayapti»
         → ZICHLIK
     · «yozuv 2 mm pastga surilgan»
         → SILJISH TUZATISHI

   Ular sozlamalar ichiga tarqatib yuborilsa, muammoga duch kelgan
   odam ularni topa olmasdi. Shuning uchun bitta ketma-ketlik.

   ⚠ QADAMLAR MAJBURIY EMAS, LEKIN TARTIBLI: kalibrlashsiz ham
   saqlash mumkin (brauzer yo'lida u umuman kerak emas), ammo
   tartib do'konchiga nimadan boshlashni ko'rsatadi.
   ══════════════════════════════════════════════════════════════════════════ */

const STEPS = ["printer", "media", "calibrate", "test", "density"];

export default function LabelSetupWizard({ kind, template, product, onClose, toast, onSaved }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [medias, setMedias] = useState([]);
  const [printerId, setPrinterId] = useState(null);
  const [mediaId, setMediaId] = useState(null);
  const [density, setDensity] = useState(8);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  /* ⚠ SAQLANGAN QOG'OZ ALOHIDA ESLAB QOLINADI: server media
     almashganda kalibrlashni bekor qiladi, va buni EKRANDA aytish
     kerak. Aytilmasa, do'konchi eski kalibrlash bilan chop etadi
     va yorliq surilib chiqadi. */
  const [savedMediaId, setSavedMediaId] = useState(null);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes, oRes] = await Promise.all([
        labelApi.printerList(), labelApi.mediaList(), labelApi.outputList(),
      ]);
      const ps = asArray(pRes.data), ms = asArray(mRes.data);
      setPrinters(ps); setMedias(ms);
      const mine = asArray(oRes.data).find((x) => x.kind === kind);
      setPrinterId(mine?.printerProfileId ?? ps[0]?.id ?? null);
      setMediaId(mine?.mediaProfileId ?? ms[0]?.id ?? null);
      setSavedMediaId(mine?.mediaProfileId ?? null);
    } catch (err) { toast?.error(err.message); }
    finally { setLoading(false); }
  }, [kind, toast]);

  useEffect(() => { boot(); }, [boot]);

  const printer = printers.find((p) => p.id === printerId) || null;
  const media = medias.find((m) => m.id === mediaId) || null;

  useEffect(() => {
    if (!printer) return;
    setDensity(Number(printer.density) || 8);
    setOffsetX(Number(printer.offsetXMm) || 0);
    setOffsetY(Number(printer.offsetYMm) || 0);
  }, [printerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const desktop = isDesktop();
  const bytes = printer ? supportsBytes(printer.lang) : false;

  /* ⚠ BLOKLANGAN QADAMNING SABABI YOZILADI. Brauzerdan printerga
     buyruq yuborib bo'lmaydi va bu do'konchining aybi emas —
     shuning uchun tugma hira turganda YONIDA sabab bo'lishi kerak. */
  const blockReason = !desktop ? t("lbl.needDesktop")
    : !bytes ? t("lbl.langNoBytes")
    : null;

  const calibrate = async () => {
    const cmd = calibrationCommand(printer?.lang);
    if (!cmd) return;
    setBusy(true);
    try {
      await printRawLabel(cmd);
      toast?.success(t("lbl.calibrateDone"));
    } catch (err) { toast?.error(err.message); }
    finally { setBusy(false); }
  };

  const testLabel = async () => {
    if (!template || !product) return;
    setBusy(true);
    try {
      const layout = layoutLabel(template, product, {});
      const text = toBytes(printer?.lang, layout, {
        dpi: Number(printer?.dpi) || 203,
        media, printer: { ...printer, density, offsetXMm: offsetX, offsetYMm: offsetY },
      });
      if (!text) throw new Error(t("lbl.langNoBytes"));
      await printRawLabel(text);
    } catch (err) { toast?.error(err.message); }
    finally { setBusy(false); }
  };

  /**
   * ⚠ ZICHLIK DO'KONNING O'Z NUSXASIGA YOZILADI. Tayyor profil
   * hamma do'konga bitta: uni o'zgartirish boshqalarning
   * yorliqlarini ham qorayтirardi. Nusxa avtomatik olinadi —
   * do'konchidan «avval nusxa oling» deb talab qilish ortiqcha
   * qadam bo'lardi.
   */
  const save = async () => {
    setBusy(true);
    try {
      let target = printer;
      if (target && target.system) {
        target = (await labelApi.copyPrinter(target.id)).data;
      }
      if (target) {
        await labelApi.tunePrinter(target.id, {
          density: Number(density) || 8,
          offsetXMm: Number(offsetX) || 0,
          offsetYMm: Number(offsetY) || 0,
        });
      }
      await labelApi.saveOutput(kind, {
        mediaProfileId: mediaId,
        printerProfileId: target?.id ?? null,
        calibrated: desktop && bytes,
      });
      toast?.success(t("common.saved"));
      onSaved?.();
      onClose?.();
    } catch (err) { toast?.error(err.message); }
    finally { setBusy(false); }
  };

  const mediaLabel = (m) =>
    `${Number(m.labelWidthMm)}×${m.labelHeightMm ? Number(m.labelHeightMm) : "?"}`
    + (m.across > 1 ? ` · ${m.across}` : "");

  const body = () => {
    if (loading) return <SkeletonList rows={3} avatar={false} />;
    const name = STEPS[step];

    if (name === "printer") return (
      <div>
        <label className="form-label" htmlFor="lw-printer">{t("lbl.printerLabel")}</label>
        <Select id="lw-printer" block variant="field" ariaLabel={t("lbl.printerLabel")}
                value={printerId} onChange={setPrinterId}
                options={printers.map((p) => ({
                  value: p.id, label: p.name, hint: `${p.lang} · ${Number(p.printWidthMm)}`,
                }))} />
        {printer && !bytes && <div className="form-hint">{t("lbl.langNoBytes")}</div>}
      </div>
    );

    if (name === "media") return (
      <div>
        <label className="form-label" htmlFor="lw-media">{t("lbl.mediaLabel")}</label>
        <Select id="lw-media" block variant="field" ariaLabel={t("lbl.mediaLabel")}
                value={mediaId} onChange={setMediaId}
                options={medias.map((m) => ({
                  value: m.id, label: m.name, hint: mediaLabel(m),
                }))} />
        {savedMediaId !== null && mediaId !== savedMediaId && (
          <div className="form-hint form-hint--warn">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            {" "}{t("lbl.mediaChanged")}
          </div>
        )}
      </div>
    );

    if (name === "calibrate") return (
      <div>
        <p className="set-card__hint" style={{ marginTop: 0 }}>{t("lbl.calibrateWhy")}</p>
        <button type="button" className="btn btn-primary" disabled={busy || !!blockReason}
                onClick={calibrate}>
          <i className="fa-solid fa-ruler-combined" /> {t("lbl.calibrateNow")}
        </button>
        {blockReason && <div className="form-hint form-hint--warn">{blockReason}</div>}
      </div>
    );

    if (name === "test") return (
      <div>
        <p className="set-card__hint" style={{ marginTop: 0 }}>
          {template ? templateName(template) : ""}
        </p>
        <button type="button" className="btn btn-primary" disabled={busy || !!blockReason}
                onClick={testLabel}>
          <i className="fa-solid fa-print" /> {t("lbl.testLabel")}
        </button>
        {blockReason && <div className="form-hint form-hint--warn">{blockReason}</div>}
      </div>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="form-label" htmlFor="lw-density">{t("lbl.densityLabel")}</label>
          <input id="lw-density" className="input" type="number" min={1} max={15}
                 style={{ width: 110 }} value={density}
                 onChange={(e) => setDensity(e.target.value)} />
          <div className="form-hint">{t("lbl.densityWhy")}</div>
        </div>
        <div className="lbl-row">
          <div style={{ flex: "0 0 150px" }}>
            <label className="form-label" htmlFor="lw-ox">{t("lbl.offsetX")}</label>
            <input id="lw-ox" className="input" type="number" step="0.5" min={-20} max={20}
                   value={offsetX} onChange={(e) => setOffsetX(e.target.value)} />
          </div>
          <div style={{ flex: "0 0 150px" }}>
            <label className="form-label" htmlFor="lw-oy">{t("lbl.offsetY")}</label>
            <input id="lw-oy" className="input" type="number" step="0.5" min={-20} max={20}
                   value={offsetY} onChange={(e) => setOffsetY(e.target.value)} />
          </div>
        </div>
        <div className="form-hint">{t("lbl.offsetWhy")}</div>
      </div>
    );
  };

  const last = step === STEPS.length - 1;

  return (
    <Modal title={t("lbl.setupTitle")} onClose={onClose} maxWidth={640}
           footer={(
             <>
               <button className="btn btn-outline" disabled={busy || step === 0}
                       onClick={() => setStep((n) => Math.max(0, n - 1))}>
                 {t("common.back")}
               </button>
               {last ? (
                 <button className="btn btn-green" disabled={busy} onClick={save}>
                   <i className="fa-solid fa-check" /> {t("lbl.setupSave")}
                 </button>
               ) : (
                 <button className="btn btn-primary" disabled={busy}
                         onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}>
                   {t("common.next")}
                 </button>
               )}
             </>
           )}>
      <p className="set-card__hint" style={{ marginTop: 0 }}>{t("lbl.setupWhy")}</p>

      {/* ⚠ QADAMLAR KO'RINIB TURSIN: do'konchi qayerdaligini va
          nechta qadam qolganini bilsin. */}
      <div className="cat-tabs" role="group" style={{ marginBottom: 14 }}>
        {STEPS.map((s, i) => (
          <button key={s} type="button" className={`cat-tab ${i === step ? "active" : ""}`}
                  aria-pressed={i === step} onClick={() => setStep(i)}>
            {i + 1}. {t(`lbl.step${s[0].toUpperCase()}${s.slice(1)}`)}
          </button>
        ))}
      </div>

      {body()}
    </Modal>
  );
}
