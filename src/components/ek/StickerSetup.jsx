import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { isDesktop } from "../../lib/ek-desktop";
import { listPrinters } from "../../lib/ek-hardware";
import { getSettings, saveSettings } from "../../lib/ek-hw-settings";
import { SkeletonList, Spinner } from "./Loading";
import { announceLabelOutput } from "../../hooks/useLabelOutput";
import {
  DESKTOP_URL, MAIN_SIZES, autoPrinter, lastTemplateId, mediaFor, pickTemplate,
  printerErrorKey, profileFor, sheetMedia, sortPrinters, stickerMedias,
} from "../../lib/ek-sticker-auto";
import { calibrate, routeOf, sendLabels } from "../../lib/ek-label-send";

/* ══════════════════════════════════════════════════════════════════════════
   STIKER PRINTERINI SOZLASH — BIR MARTA, UCH QADAM (2026-10-03)

   Egasining talabi: «nima qilayotganimni bilmayapman — ko'p narsani avto
   qiladigan qilib, men qiladigan ishlar aniq va juda sodda bo'lsin».

   Ilgari bu yerda besh qadamli sehrgar bor edi: printer MODELI (TSPL/ZPL),
   Windows navbati, qog'oz profili, kalibrlash, zichlik va siljish mm da.
   Do'konchi ularning birortasini tushunmasdi. Endi undan faqat ikkita
   savol so'raladi, ikkalasiga ham javob ko'z bilan topiladi:

     1. «Stiker qaysi printerdan chiqadi?» — ro'yxat, stiker printeri
        allaqachon belgilangan (desktopda; brauzerda bu qadam yo'q);
     2. «Bitta stiker o'lchami qancha?» — katta rasmli tugmalar.

   Printer tili, dizayn, kalibrlash — avtomatik (`ek-sticker-auto.js`).

   ⚠ ZICHLIK VA SILJISH SO'RALMAYDI — MUAMMO SO'RALADI. Sinov stikeridan
   keyin «to'g'ri chiqdimi?» deb so'raladi va javoblar oddiy so'z bilan:
   «qora fonda chiqdi», «surilib ketdi», «juda och». Har biri o'zi
   tuzatadi va yana bitta sinov chiqaradi. «Zichlikni 8 dan 11 ga
   ko'taring» degan gapni hech kim tushunmasdi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Sinov uchun namuna — haqiqiy tovarga kod berib yubormaslik uchun soxta. */
const demoProduct = (name) => ({
  name, nameShort: name, nameRu: name,
  salePrice: 12500, barcode: "4780000000007", searchCode: "142",
});

const sizeOf = (m) => (!m ? "" : String(m.mediaType) === "VARAQ"
  ? `${Number(m.pageWidthMm) || 210} × ${Number(m.pageHeightMm) || 297}`
  : `${Number(m.labelWidthMm)} × ${Number(m.labelHeightMm)}`);

/* ⚠ JAVON YORLIG'I UCHUN BOSHQA SO'ZLAR (2026-10-04): oqim bir xil, lekin
   «stiker» so'zi narx yorlig'iga to'g'ri kelmaydi va A4 varaq varianti bor.
   Faqat farq qiladigan matnlar `shf.*` da, qolgani umumiy `stk.*`. */
const SHELF_TEXT = new Set(["qPrinter", "qSize", "qSizeHint", "qTest", "printTest", "testTitle",
  "qOk", "testBytes", "testDriver", "pBlank", "howto1", "demoName", "step_size"]);

export default function StickerSetup({ toast, onDone, kind = "STICKER" }) {
  const desktop = isDesktop();
  const tk = (key, vars) => t((kind === "SHELF" && SHELF_TEXT.has(key) ? "shf." : "stk.") + key, vars);
  /* ⚠ JAVON YORLIG'IDA AVVAL QOG'OZ: A4 tanlansa printer so'ralmaydi (oddiy
     printer chop etish oynasida tanlanadi). Stikerda — avval printer. */
  const [step, setStep] = useState(kind === "STICKER" && desktop ? "printer" : "size");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [medias, setMedias] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [current, setCurrent] = useState(null); // {media, printer} — saqlangan tanlov
  const [queues, setQueues] = useState([]);
  const [queuesLoaded, setQueuesLoaded] = useState(false);
  const [queue, setQueue] = useState(() => getSettings().labelPrinterName || "");
  const [mediaId, setMediaId] = useState(null);
  const [more, setMore] = useState(false);
  const [printer, setPrinter] = useState(null);  // saqlangan printer profili
  const [asked, setAsked] = useState(false);     // «to'g'ri chiqdimi?» ochiqmi
  const [note, setNote] = useState(null);        // nima qilindi — odam tilida
  const [error, setError] = useState(null);
  const [fix, setFix] = useState(null);          // null | "shift" | "nothing" | "driver"
  const [measured, setMeasured] = useState(false); // printer qog'ozni o'lchadimi

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes, oRes, tRes] = await Promise.all([
        labelApi.printerList(), labelApi.mediaList(), labelApi.outputList(),
        labelApi.templates(kind),
      ]);
      const ps = asArray(pRes.data), ms = asArray(mRes.data);
      setProfiles(ps); setMedias(ms); setTemplates(asArray(tRes.data));
      const mine = asArray(oRes.data).find((x) => x.kind === kind);
      const media = ms.find((m) => m.id === mine?.mediaProfileId) || null;
      const prof = ps.find((p) => p.id === mine?.printerProfileId) || null;
      setCurrent({ media, printer: prof });
      setPrinter(prof);
      setMediaId(media?.id ?? null);
    } catch (err) { toast?.error(err.message); }
    finally { setLoading(false); }
  }, [toast, kind]);

  useEffect(() => { boot(); }, [boot]);

  const receiptName = getSettings().printerName || "";
  const loadQueues = useCallback(() => {
    if (!desktop) return;
    setQueuesLoaded(false);
    listPrinters()
      .then((list) => {
        const names = list || [];
        setQueues(names);
        /* ⚠ AVTOMATIK TANLOV FAQAT BITTA STIKER PRINTERI BO'LSA: ikkitadan
           birini taxmin qilsak, stiker boshqa printerdan chiqishi mumkin. */
        setQueue((q) => (q && names.includes(q) ? q : autoPrinter(names, receiptName) || ""));
      })
      .catch(() => setQueues([]))
      .finally(() => setQueuesLoaded(true));
  }, [desktop, receiptName]);
  useEffect(() => { loadQueues(); }, [loadQueues]);

  const sorted = useMemo(() => sortPrinters(queues, receiptName), [queues, receiptName]);
  const rolls = useMemo(() => stickerMedias(medias), [medias]);
  const main = useMemo(() => MAIN_SIZES.map(([w, h]) => mediaFor(w, h, rolls)).filter(Boolean),
    [rolls]);
  const others = useMemo(() => rolls.filter((m) => !main.some((x) => x.id === m.id)), [rolls, main]);
  const media = medias.find((m) => m.id === mediaId) || null;
  const route = media ? routeOf(media, printer) : null;
  const a4 = useMemo(() => (kind === "SHELF" ? sheetMedia(medias) : null), [kind, medias]);
  const sheet = String(media?.mediaType) === "VARAQ";
  const preSteps = kind === "SHELF"
    ? (media && !sheet && desktop ? ["size", "printer"] : ["size"])
    : (desktop ? ["printer", "size"] : ["size"]);
  const steps = [...preSteps, "test"];

  const friendly = (err) => {
    const key = printerErrorKey(err?.message);
    return key ? { text: t(key), detail: err.message } : { text: err?.message || "" };
  };

  /* ── 2-qadamdan keyin: hammasi avtomatik saqlanadi ─────────────────── */
  const save = async () => {
    if (!media) return;
    setBusy(true); setError(null);
    try {
      /* ⚠ PRINTER TILI NOMDAN: «Xprinter XP-365B» → TSPL, «Zebra» → ZPL,
         noma'lum → drayver (oyna). Brauzerda printer noma'lum — oldingi
         tanlov qoladi, u ham yo'q bo'lsa eng keng tarqalgani. */
      /* A4 — oddiy printer, drayver yo'li (profil «A4 lazer»). */
      let prof = sheet ? profileFor("", profiles)
        : desktop ? profileFor(queue, profiles)
        : current?.printer || profileFor("xprinter", profiles);
      /* ⚠ SOZLANGAN NUSXA YO'QOLMASIN: do'konchi avval zichlikni tuzatgan
         bo'lsa (do'konning o'z nusxasi), xuddi shu tildagi printer
         qayta tanlanganda o'sha nusxa qoladi. */
      if (!sheet && current?.printer && !current.printer.system && prof
          && current.printer.lang === prof.lang) prof = current.printer;
      await labelApi.saveOutput(kind, {
        mediaProfileId: media.id, printerProfileId: prof?.id ?? null, calibrated: false,
      });
      if (desktop && !sheet) saveSettings({ labelPrinterName: queue });
      setPrinter(prof);
      setCurrent({ media, printer: prof });
      announceLabelOutput();
      setAsked(false); setNote(null); setFix(null);
      setStep("test");
    } catch (err) { setError(friendly(err)); }
    finally { setBusy(false); }
  };

  /**
   * Sinov stikeri.
   *
   * ⚠ BIRINCHI MARTA PRINTER QOG'OZNI O'LCHAYDI (bayt yo'lida): yangi
   * rulonda printer stiker qayerda tugashini bilmaydi va yozuv ikki
   * stikerning o'rtasiga tushadi — «surilib ketdi» shikoyatining №1 sababi.
   */
  const runTest = async ({ p = printer, measure = false } = {}) => {
    setBusy(true); setError(null);
    try {
      if ((measure || !measured) && routeOf(media, p) === "bytes") {
        await calibrate(p);
        setMeasured(true);
      }
      const tpl = pickTemplate(templates, media, lastTemplateId(), kind);
      if (!tpl) throw new Error(t("lbl.noTemplates"));
      await sendLabels({ template: tpl, items: [{ product: demoProduct(tk("demoName")), quantity: 1 }],
        media, printer: p, title: tk("testTitle") });
      setAsked(true);
    } catch (err) { setError(friendly(err)); }
    finally { setBusy(false); }
  };

  /** Zichlik/siljish — do'konning o'z nusxasiga (tayyor profil hammaga bitta). */
  const tune = async (patch) => {
    let target = printer;
    if (!target) return null;
    if (target.system) target = (await labelApi.copyPrinter(target.id)).data;
    const body = {
      density: patch.density ?? (Number(target.density) || 8),
      offsetXMm: patch.offsetXMm ?? (Number(target.offsetXMm) || 0),
      offsetYMm: patch.offsetYMm ?? (Number(target.offsetYMm) || 0),
    };
    const r = await labelApi.tunePrinter(target.id, body);
    const next = { ...target, ...body, ...(r?.data || {}) };
    await labelApi.saveOutput(kind, {
      mediaProfileId: media.id, printerProfileId: next.id, calibrated: false,
    });
    setPrinter(next);
    announceLabelOutput();
    return next;
  };

  /* ── «To'g'ri chiqmadi» — har javob o'zi tuzatadi ───────────────────── */
  const onProblem = async (problem) => {
    setNote(null); setError(null);
    const bytes = route === "bytes";
    if (!bytes && problem !== "nothing") { setFix("driver"); return; }
    try {
      if (problem === "inverted") {
        saveSettings({ labelInvert: !getSettings().labelInvert });
        setNote(tk("fixedInverted"));
        await runTest();
      } else if (problem === "shift" || problem === "blank") {
        /* Birinchi javob — qog'ozni qayta o'lchash; yana surilsa — strelkalar. */
        if (problem === "shift" && fix === "shift-measured") { setFix("shift"); return; }
        setNote(tk("fixedMeasured"));
        await runTest({ measure: true });
        if (problem === "shift") setFix("shift-measured");
      } else if (problem === "light" || problem === "dark") {
        const d = Math.max(1, Math.min(15, (Number(printer?.density) || 8) + (problem === "light" ? 3 : -3)));
        setBusy(true);
        const p = await tune({ density: d });
        setNote(t(problem === "light" ? "stk.fixedDarker" : "stk.fixedLighter"));
        await runTest({ p });
      } else if (problem === "nothing") {
        setFix("nothing");
      }
    } catch (err) { setError(friendly(err)); setBusy(false); }
  };

  const nudge = async (dx, dy) => {
    setError(null);
    try {
      setBusy(true);
      const p = await tune({
        offsetXMm: (Number(printer?.offsetXMm) || 0) + dx,
        offsetYMm: (Number(printer?.offsetYMm) || 0) + dy,
      });
      setNote(tk("fixedMoved"));
      await runTest({ p });
    } catch (err) { setError(friendly(err)); setBusy(false); }
  };

  const finish = async () => {
    try {
      await labelApi.saveOutput(kind, {
        mediaProfileId: media.id, printerProfileId: printer?.id ?? null, calibrated: true,
      });
      announceLabelOutput();
    } catch { /* belgi muhim emas — sozlama allaqachon saqlangan */ }
    onDone?.();
  };

  /** Keyingi qadam: sinovdan oldingi oxirgi qadamda — saqlash. */
  const goNext = () => {
    const i = preSteps.indexOf(step);
    if (i === preSteps.length - 1) save();
    else setStep(preSteps[i + 1]);
  };
  const goBack = () => {
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
  };

  if (loading) return <SkeletonList rows={3} avatar={false} />;

  const idx = steps.indexOf(step);

  return (
    <div className="stk-setup">
      {/* ⚠ QADAMLAR KO'RINIB TURADI: qayerdaligini va nechta qolganini bilsin. */}
      <ol className="stk-steps">
        {steps.map((s, i) => (
          <li key={s} className={`stk-step ${i === idx ? "is-on" : ""} ${i < idx ? "is-done" : ""}`}
              aria-current={i === idx ? "step" : undefined}>
            <span className="stk-step__num ek-num" aria-hidden="true">
              {i < idx ? <i className="fa-solid fa-check" /> : i + 1}
            </span>
            {tk(`step_${s}`)}
          </li>
        ))}
      </ol>

      {error && (
        <div className="stk-alert" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <div>
            <div>{error.text}</div>
            {error.detail && <div className="stk-alert__detail">{error.detail}</div>}
          </div>
        </div>
      )}

      {step === "printer" && (
        <section>
          <h3 className="stk-q">{tk("qPrinter")}</h3>
          <p className="stk-hint">{tk("qPrinterHint")}</p>
          {!queuesLoaded ? <SkeletonList rows={3} avatar={false} />
            : sorted.length === 0 ? (
              <div className="stk-alert">
                <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" />
                <div>{tk("noPrinters")}</div>
              </div>
            ) : (
              <div className="stk-choices" role="radiogroup" aria-label={tk("qPrinter")}>
                {sorted.map((p) => {
                  const on = p.name === queue;
                  return (
                    <button key={p.name} type="button" role="radio" aria-checked={on}
                            className={`stk-choice ${on ? "is-on" : ""}`}
                            onClick={() => setQueue(p.name)}>
                      <i className={`fa-solid ${p.label ? "fa-tags" : p.kind === "receipt" ? "fa-receipt" : "fa-print"}`}
                         aria-hidden="true" />
                      <span className="stk-choice__name">{p.name}</span>
                      {p.label && <span className="stk-tag">{tk("tagLabel")}</span>}
                      {p.kind === "receipt" && <span className="stk-tag stk-tag--muted">{tk("tagReceipt")}</span>}
                      {on && <i className="fa-solid fa-circle-check stk-choice__on" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          {queue && sorted.find((p) => p.name === queue)?.kind === "receipt" && (
            <div className="form-hint form-hint--warn">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {tk("receiptWarn")}
            </div>
          )}
          <div className="stk-actions">
            <button type="button" className="btn btn-outline" onClick={loadQueues}>
              <i className="fa-solid fa-rotate" /> {tk("searchAgain")}
            </button>
            <button type="button" className="btn btn-primary stk-next" disabled={!queue || busy}
                    onClick={goNext}>
              {tk("next")} <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </section>
      )}

      {step === "size" && (
        <section>
          <h3 className="stk-q">{tk("qSize")}</h3>
          <p className="stk-hint">{tk("qSizeHint")}</p>
          {!desktop && (
            <p className="stk-hint">
              <i className="fa-solid fa-circle-info" aria-hidden="true" /> {tk("webNote")}
            </p>
          )}
          <div className="stk-sizes" role="radiogroup" aria-label={tk("qSize")}>
            {a4 && (
              /* ⚠ A4 — FAQAT JAVON YORLIG'IDA: stikerda A4 so'ralmagan (egasi:
                 «menga A4 umuman kerak emas»), narx yorlig'ini esa ko'p do'kon
                 oddiy printerda varaqqa chiqarib, qaychi bilan kesadi. */
              <button type="button" role="radio" aria-checked={a4.id === mediaId}
                      className={`stk-size ${a4.id === mediaId ? "is-on" : ""}`} onClick={() => setMediaId(a4.id)}>
                <span className="stk-size__art" aria-hidden="true">
                  <span className="stk-size__paper stk-size__paper--a4" />
                </span>
                <span className="stk-size__num">{t("shf.a4")}</span>
                <span className="stk-size__unit">{t("shf.a4Hint")}</span>
                {a4.id === mediaId && <i className="fa-solid fa-circle-check stk-choice__on" aria-hidden="true" />}
              </button>
            )}
            {main.map((m) => {
              const on = m.id === mediaId;
              const w = Number(m.labelWidthMm), h = Number(m.labelHeightMm);
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on}
                        className={`stk-size ${on ? "is-on" : ""}`} onClick={() => setMediaId(m.id)}>
                  {/* ⚠ RASM HAQIQIY NISBATDA: 58×40 va 30×20 ni raqamsiz ham
                      ajratib bo'lsin — qo'ldagi rulon bilan solishtiriladi. */}
                  <span className="stk-size__art" aria-hidden="true">
                    <span className="stk-size__paper" style={{ width: w * 1.6, height: h * 1.6 }} />
                  </span>
                  <span className="stk-size__num ek-num">{w} × {h}</span>
                  <span className="stk-size__unit">{tk("mm")}</span>
                  {on && <i className="fa-solid fa-circle-check stk-choice__on" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button type="button" className="btn btn-outline btn-sm stk-more"
                  aria-expanded={more} onClick={() => setMore((v) => !v)}>
            <i className={`fa-solid ${more ? "fa-chevron-up" : "fa-chevron-down"}`} /> {tk("otherSize")}
          </button>
          {more && (
            <div className="stk-choices stk-choices--wrap" role="radiogroup" aria-label={tk("otherSize")}>
              {others.map((m) => {
                const on = m.id === mediaId;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on}
                          className={`stk-choice ${on ? "is-on" : ""}`} onClick={() => setMediaId(m.id)}>
                    <span className="stk-choice__name ek-num">{sizeOf(m)} {tk("mm")}</span>
                    {Number(m.across) > 1 && (
                      <span className="stk-tag stk-tag--muted">{tk("across", { n: Number(m.across) })}</span>
                    )}
                    {on && <i className="fa-solid fa-circle-check stk-choice__on" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="stk-actions">
            {steps.indexOf("size") > 0 && (
              <button type="button" className="btn btn-outline" onClick={goBack}>
                <i className="fa-solid fa-arrow-left" /> {tk("back")}
              </button>
            )}
            <button type="button" className="btn btn-primary stk-next" disabled={!media || busy}
                    onClick={goNext}>
              {busy ? <Spinner small /> : null} {tk("next")} <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </section>
      )}

      {step === "test" && (
        <section>
          <h3 className="stk-q">{tk("qTest")}</h3>
          <p className="stk-hint">
            {route === "bytes"
              ? tk("testBytes", { queue, size: sizeOf(media) })
              : sheet ? t("shf.testSheet")
              : tk("testDriver", { size: sizeOf(media) })}
          </p>

          <button type="button" className="btn btn-green stk-big" disabled={busy}
                  onClick={() => runTest()}>
            {busy ? <Spinner small /> : <i className="fa-solid fa-print" />} {tk("printTest")}
          </button>

          {note && (
            <div className="stk-note" role="status">
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {note}
            </div>
          )}

          {asked && (
            <div className="stk-ask">
              <h4 className="stk-q stk-q--sm">{tk("qOk")}</h4>
              <button type="button" className="btn btn-green stk-big" disabled={busy} onClick={finish}>
                <i className="fa-solid fa-circle-check" /> {tk("okYes")}
              </button>
              <p className="stk-hint">{tk("okNoHint")}</p>
              <div className="stk-fixes">
                {route === "bytes" && (
                  <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("inverted")}>
                    <span className="stk-fix__art stk-fix__art--inv" aria-hidden="true"><i className="fa-solid fa-font" /></span>
                    {tk("pInverted")}
                  </button>
                )}
                <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("shift")}>
                  <i className="fa-solid fa-up-down-left-right" aria-hidden="true" /> {tk("pShift")}
                </button>
                {route === "bytes" && (
                  <>
                    <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("light")}>
                      <i className="fa-regular fa-sun" aria-hidden="true" /> {tk("pLight")}
                    </button>
                    <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("dark")}>
                      <i className="fa-solid fa-droplet" aria-hidden="true" /> {tk("pDark")}
                    </button>
                    <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("blank")}>
                      <i className="fa-regular fa-note-sticky" aria-hidden="true" /> {tk("pBlank")}
                    </button>
                  </>
                )}
                <button type="button" className="stk-fix" disabled={busy} onClick={() => onProblem("nothing")}>
                  <i className="fa-solid fa-ban" aria-hidden="true" /> {tk("pNothing")}
                </button>
              </div>

              {fix === "shift" && (
                <div className="stk-pad">
                  <p className="stk-hint">{tk("padHint")}</p>
                  {/* ⚠ HAR BOSISH 1 MM VA DARHOL SINOV: «siljish, mm» degan
                      maydon o'rniga yozuvni qayoqqa surish kerakligini
                      ko'rsatadigan strelkalar. */}
                  <div className="stk-pad__grid">
                    <span />
                    <button type="button" className="btn btn-outline" disabled={busy}
                            aria-label={tk("moveUp")} onClick={() => nudge(0, -1)}>
                      <i className="fa-solid fa-arrow-up" />
                    </button>
                    <span />
                    <button type="button" className="btn btn-outline" disabled={busy}
                            aria-label={tk("moveLeft")} onClick={() => nudge(-1, 0)}>
                      <i className="fa-solid fa-arrow-left" />
                    </button>
                    <span className="stk-pad__mid" aria-hidden="true"><i className="fa-solid fa-tag" /></span>
                    <button type="button" className="btn btn-outline" disabled={busy}
                            aria-label={tk("moveRight")} onClick={() => nudge(1, 0)}>
                      <i className="fa-solid fa-arrow-right" />
                    </button>
                    <span />
                    <button type="button" className="btn btn-outline" disabled={busy}
                            aria-label={tk("moveDown")} onClick={() => nudge(0, 1)}>
                      <i className="fa-solid fa-arrow-down" />
                    </button>
                    <span />
                  </div>
                </div>
              )}

              {fix === "driver" && (
                <div className="stk-howto">
                  <h4 className="stk-q stk-q--sm">{tk("howtoTitle")}</h4>
                  <ol>
                    <li>{tk("howto1")}</li>
                    <li>{tk("howto2", { size: sizeOf(media) })}</li>
                    <li>{tk("howto3")}</li>
                    <li>{tk("howto4")}</li>
                  </ol>
                  {!desktop && (
                    <p className="stk-hint">
                      {tk("desktopTip")}{" "}
                      <a href={DESKTOP_URL} target="_blank" rel="noopener noreferrer">{tk("desktopLink")}</a>
                    </p>
                  )}
                </div>
              )}

              {fix === "nothing" && (
                <div className="stk-howto">
                  <h4 className="stk-q stk-q--sm">{tk("nothingTitle")}</h4>
                  <ol>
                    <li>{tk("nothing1")}</li>
                    <li>{tk("nothing2")}</li>
                    {desktop ? <li>{tk("nothing3")}</li> : <li>{tk("howto1")}</li>}
                  </ol>
                  {desktop && steps.includes("printer") && (
                    <button type="button" className="btn btn-outline" onClick={() => setStep("printer")}>
                      <i className="fa-solid fa-print" /> {tk("choosePrinterAgain")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="stk-actions">
            <button type="button" className="btn btn-outline" onClick={goBack}>
              <i className="fa-solid fa-arrow-left" /> {tk("back")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
