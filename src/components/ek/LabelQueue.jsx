import { useEffect, useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi, productApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { Empty, SearchBar } from "../ui";
import Select from "./Select";
import Modal from "../Modal";
import { productCode, findByCode } from "../../lib/ek-code";
import { rankItems, looksLikeCode } from "../../lib/ek-search";
import { money } from "../../lib/ek-format";
import { templateName } from "../../lib/ek-label-name";
import { printHtml } from "../../lib/ek-receipt-pdf";
import { printPriceLabels, printRawLabel } from "../../lib/ek-hardware";
import { getSettings } from "../../lib/ek-hw-settings";
import { isDesktop } from "../../lib/ek-desktop";
import {
  buildPrintDoc, buildRollBytes, buildRollDoc, outputMode, pageOf, pendingItems,
  rollFor, sheetFor,
} from "../../lib/ek-label-print";
import { rasterizeSvg } from "../../lib/ek-label-raster";
import { blocking, validateOutput } from "../../lib/ek-label-validate";
import { useScanner } from "../../hooks/useScanner";
import { useLayerCount } from "../../hooks/useLayerCount";
import { useLabelOutput } from "../../hooks/useLabelOutput";
import { ensureBarcodes, withPreviewBarcode } from "../../lib/ek-label-codes";

/* ══════════════════════════════════════════════════════════════════════════
   CHOP ETISH NAVBATI (F5)

   ⚠ NAVBAT — BITTA JOY. Ilgari yorliq ikki xil oynadan chiqarilardi
   (tovarlar sahifasidan va to'qnashuv hisobotidan) va ikkalasi
   boshqacha ishlardi. Endi ikkalasi ham SHU komponentga keladi:
   bitta joylashtiruvchi, bitta chizuvchi, bitta «chiqarildi» yozuvi.

   ⚠ CHOP ETISHDAN KEYIN SAVOL BERILADI. Brauzer «chiqdimi yoki
   yo'qmi» degan savolga javob bera olmaydi: `onafterprint` qog'oz
   qotib qolganda ham ishlaydi. Yolg'on «tugadi» yozib qo'yishdan
   ko'ra, so'rash to'g'ri: qaysi tovargacha chiqqani belgilanadi va
   qolgani navbatda qoladi.
   ══════════════════════════════════════════════════════════════════════════ */

const SOURCES = [
  { value: "PRODUCTS",      labelKey: "lbl.srcProducts" },
  { value: "CATEGORY",      labelKey: "lbl.srcCategory" },
  { value: "PRICE_CHANGED", labelKey: "lbl.srcPriceChanged" },
  { value: "NEVER_PRINTED", labelKey: "lbl.srcNeverPrinted" },
];

/**
 * Chop etish hujjatining nomi — PDF ga saqlanganda FAYL NOMI ham shu.
 *
 * ⚠ NAVBAT RAQAMI VA SANA bilan: «Yorliqlar.pdf» degan o'nta fayl
 * bir papkada yotsa, ularni ochmasdan ajratib bo'lmasdi.
 */
function docTitle(job) {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${t("lbl.sheetTitle")} №${job?.id ?? "?"} `
    + `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** ⚠ KOMPONENTDAN TASHQARIDA: holatga bog'liq emas va har chizishda
    qayta yasalishi shart emas. */
function shopCtx() {
  return { shopName: localStorage.getItem("ek_shopName") || "" };
}

/* ⚠ OXIRGI TANLANGAN DIZAYN ESLAB QOLINADI (shu kompyuterda): tovarlar
   sahifasidan tez chop etishda har safar javon yorlig'i chiqib, stiker
   chiqaradigan do'kon uni har gal qayta tanlashi kerak edi. */
const LAST_TPL = "ek_lbl_last_tpl";
export const lastTemplateId = () => {
  try { return Number(localStorage.getItem(LAST_TPL)) || null; } catch { return null; }
};
const rememberTemplate = (id) => {
  try { localStorage.setItem(LAST_TPL, String(id)); } catch { /* to'la yoki yopiq */ }
};

/** «58×40» — qog'oz yoki dizayn o'lchami. */
const sizeText = (w, h) => `${Number(w)}×${Number(h)}`;

const RULES = [
  { value: "ONE",    labelKey: "lbl.ruleOne" },
  { value: "STOCK",  labelKey: "lbl.ruleStock" },
  { value: "MANUAL", labelKey: "lbl.ruleManual" },
];

export default function LabelQueue({
  job, templates, products, categories = [], toast, onChange, compact = false,
}) {
  const [busy, setBusy]       = useState(false);
  const [source, setSource]   = useState("PRODUCTS");
  const [rule, setRule]       = useState("ONE");
  const [manualQty, setManualQty] = useState(1);
  const [pick, setPick]       = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch]   = useState("");
  const [finish, setFinish]   = useState(null); // chop etilgandan keyingi savol
  const [via, setVia]         = useState("label"); // label | tape

  const templateId = job?.templateId ?? null;
  const template = templates.find((x) => x.id === templateId) || null;

  useEffect(() => {
    if (!templateId && templates.length && job?.id) {
      const last = lastTemplateId();
      save({ templateId: templates.some((x) => x.id === last) ? last : templates[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templates.length, job?.id]);

  /* ══ QAYERGA CHIQADI (2026-10-03) ═══════════════════════════════════
     ⚠ ILGARI BU YERDA `PAGES.A4` QATTIQ YOZILGAN EDI va sehrgarda
     tanlangan rulon ham, printer ham o'qilmasdi. Endi dizayn TURI
     (javon/stiker) bo'yicha do'konning o'z tanlovi olinadi. */
  const { outputs } = useLabelOutput();
  const out = outputs[template?.kind] || {};
  const media = out.media || null;
  const lprinter = out.printer || null;
  const tapeOn = isDesktop();
  const queue = (getSettings().labelPrinterName || "").trim();
  const mode = outputMode(media, lprinter, { desktop: tapeOn, queue });
  const page = useMemo(() => (mode === "sheet" ? pageOf(media) : null), [mode, media]);
  const roll = useMemo(() => (template ? rollFor(template, media) : null), [template, media]);

  const byId = useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const pending = useMemo(() => pendingItems(job, byId), [job, byId]);
  const sheet   = useMemo(() => (template && page ? sheetFor(template, page) : null),
    [template, page]);

  const pendingLabels = pending.reduce((s, x) => s + x.quantity, 0);
  /* ⚠ BOSHLANISH O'RNI FAQAT VARAQDA: rulonda «yarim ishlatilgan
     varaq» yo'q va u yerda bo'sh yorliq chiqarish shunchaki isrof. */
  const startPosition = mode === "sheet" ? Math.max(1, Number(job?.startPosition) || 1) : 1;
  const pageCount = sheet
    ? Math.ceil((pendingLabels + startPosition - 1) / sheet.perPage) : 0;

  /* ⚠ OGOHLANTIRISHLAR OLDINDAN. Sig'masligini qog'ozdan keyin
     bilish — 40 ta yorliqni qayta chiqarish demak. */
  const preview = useMemo(() => {
    if (!template || !pending.length) return null;
    /* ⚠ OLDINDAN TEKSHIRUV CHIQADIGAN KOD BILAN: barkodsiz tovarga chop
       etishda do'kon kodi beriladi, shuning uchun «barkod yo'q» degan
       ogohlantirish yolg'on bo'lardi; kodning o'zi esa sig'ishi kerak. */
    const items = pending.map((it) => ({ ...it, product: withPreviewBarcode(it.product) }));
    try {
      return mode === "sheet"
        ? buildPrintDoc(template, items, { startPosition, ctx: shopCtx(), page })
        : buildRollDoc(template, items, media, { ctx: shopCtx(), printer: lprinter });
    } catch {
      return null;
    }
  }, [template, pending, startPosition, mode, page, media, lprinter]);

  /* ⚠ QOG'OZGA FIZIK SIG'MASLIK — chop etishdan OLDIN (G7 qoidalari).
     Varaqda tekshirilmaydi: u yerda to'r dizayndan hisoblanadi.
     Drayver yo'lida dpi qoidasi o'tkazib yuboriladi — u faqat bayt
     yo'liga tegishli (`validateOutput`, 5-qoida). */
  const outIssues = useMemo(() => {
    if (mode === "sheet" || !template) return [];
    const p = mode === "bytes" ? lprinter : lprinter && { ...lprinter, lang: "DRAYVER" };
    return blocking(validateOutput(media, p, template));
  }, [mode, media, lprinter, template]);

  const warnings = useMemo(() => {
    const seen = new Map();
    for (const w of preview?.warnings || []) {
      if (!seen.has(w.text)) seen.set(w.text, w);
    }
    return [...seen.values()];
  }, [preview]);

  /* ── Bloklash SABABI ────────────────────────────────────────────
     ⚠ Hira tugma sababini aytishi shart: aks holda do'konchi nima
     qilishni bilmay, xuddi shu tugmani qayta-qayta bosadi. */
  const blocked =
    !pending.length      ? t("lbl.blockEmpty")
    : via === "tape"     ? (tapeOn ? null : t("lbl.blockTape"))
    : !template          ? t("lbl.blockNoTemplate")
    : mode === "sheet"   ? (
        !sheet ? t("lbl.blockTooBig", { w: Number(template.widthMm),
                                        h: Number(template.heightMm) })
        : startPosition > (sheet?.perPage || 1) ? t("lbl.blockStart", { n: sheet.perPage })
        : null)
    : outIssues.length   ? outIssues[0].text
    : null;

  /* ⚠ YO'L EKRANDA AYTILADI: chop etish oynasi ochiladimi yoki
     yorliq to'g'ridan-to'g'ri printerdan chiqadimi — do'konchi
     tugmani bosishdan oldin bilsin. Ilgari bu yerda hech narsa
     yozilmasdi va A4 oynasi kutilmaganda ochilardi. */
  const size = roll ? sizeText(roll.labelWidthMm, roll.labelHeightMm) : "";
  const route =
    mode === "sheet" ? t("lbl.routeSheet", { page: page?.label || "A4" })
    : mode === "bytes" ? t("lbl.routeBytes", { size, queue })
    : !media ? t("lbl.routeNoMedia", { size })
    : t("lbl.routeDriver", { size });
  const needQueue = mode === "driver" && tapeOn && !queue
    && ["TSPL", "ZPL"].includes(String(lprinter?.lang || "").toUpperCase());

  const wrap = async (fn) => {
    setBusy(true);
    try { const r = await fn(); onChange?.(r?.data); return r; }
    catch (err) { toast?.error(err.message); }
    finally { setBusy(false); }
  };

  const save = (body) => wrap(() => labelApi.saveJob(job.id, body));

  /* `id` — skaner yoki Enter'dan (pastda): tanlagichni kutmasdan. */
  const add = (id = pick) => {
    const body = {
      source,
      productIds: source === "PRODUCTS" ? (id ? [id] : []) : null,
      categoryId: source === "CATEGORY" ? categoryId : null,
      quantityRule: rule,
      manualQuantity: rule === "MANUAL" ? Math.max(1, Number(manualQty) || 1) : null,
    };
    return wrap(() => labelApi.addToJob(job.id, body));
  };

  /**
   * BARKODSIZ TOVARGA SERVERDAN KOD.
   *
   * ⚠ MAHALLIY QURILMAYDI. Bu yerda barkodni hisoblab chizish oson,
   * lekin o'shanda yorliqdagi barkod HECH QAYERDA saqlanmaydi va
   * kassada skanerlanganda «topilmadi» chiqadi — ya'ni javondagi
   * qog'ozning skanerlanadigan qismi ishlamaydi.
   */
  /* ⚠ KOD BERILMAGAN TOVAR — CHOP ETISH TO'XTAYDI (2026-10-03).
     Ilgari xato yutilardi va stiker jimgina barkodsiz chiqardi: u
     kassada skanerlanmaydi va buni faqat javonda bilish mumkin edi.
     Egasining talabi — stikerda barkod BO'LISHI SHART. */
  const withBarcodes = async (items) => {
    const { items: out, failed } = await ensureBarcodes(items, template,
      (id) => productApi.generateCode(id));
    if (failed.length) {
      const list = failed.slice(0, 5)
        .map((f) => `${f.product.name}${f.message ? ` (${f.message})` : ""}`).join("; ");
      throw new Error(t("lbl.codeFailed", { n: failed.length, list }));
    }
    return out;
  };

  const print = async () => {
    if (blocked) return;
    setBusy(true);
    try {
      const ready = await withBarcodes(pending);
      if (via === "tape") {
        /* ⚠ LENTA — CHIZUVCHI EMAS, TASHUVCHI. Chek printeri SVG
           qabul qilmaydi: u ESC/POS baytlari bilan ishlaydi va
           shablonning mm o'lchamlari u yerda ma'nosiz. Shuning
           uchun bu yo'lda shablon TALAB QILINMAYDI. */
        await printPriceLabels(ready.map((it) => ({
          name: it.product?.name,
          salePrice: it.product?.salePrice,
          barcode: it.product?.barcode,
          shortCode: productCode(it.product),
        })), { copies: 1, shopName: shopCtx().shopName });
      } else if (mode === "bytes") {
        /* ⚠ OYNA OCHILMAYDI: baytlar sehrgarda tanlangan Windows
           navbatiga to'g'ridan-to'g'ri ketadi. Brauzer masshtabi,
           «sahifaga moslash», A4 — bularning hech biri bu yo'lda yo'q. */
        const bytes = await buildRollBytes(template, ready, media, lprinter,
          { ctx: shopCtx(), raster: rasterizeSvg });
        await printRawLabel(bytes);
      } else {
        const doc = mode === "sheet"
          ? buildPrintDoc(template, ready, { startPosition, ctx: shopCtx(), page })
          : buildRollDoc(template, ready, media, { ctx: shopCtx(), printer: lprinter });
        /* ⚠ HUJJAT NOMI = SAQLANGAN PDF NING NOMI. Brauzerning chop
           etish oynasida «PDF ga saqlash» tanlansa, fayl aynan shu
           nom bilan tushadi. «Yorliqlar.pdf» degan o'nta fayl bir
           papkada yotsa, ularni ajratib bo'lmasdi. */
        await printHtml(doc.html, docTitle(job), doc.css, "width=980,height=800",
          mode === "sheet" ? page : doc.page);
      }
      setFinish({ items: ready });
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  /** Chop etilgan qatorlarni belgilaydi (`upto` — shu qatorgacha). */
  const confirmPrinted = async (upto) => {
    const items = finish?.items || [];
    const ids = (upto == null ? items : items.slice(0, upto + 1)).map((x) => x.lineId);
    setFinish(null);
    if (!ids.length) return;
    const r = await wrap(() => labelApi.markPrinted(job.id, ids));
    if (r) toast?.success(t("lbl.marked", { n: ids.length }));
  };

  const options = useMemo(() => {
    const list = search ? rankItems(products, search, {
      codes: (p) => [p.barcode, productCode(p)],
      texts: (p) => [p.name],
    }) : products;
    return list.slice(0, 200).map((p) => ({
      value: p.id, label: p.name, hint: productCode(p) || undefined,
    }));
  }, [products, search]);

  /* ══ SKANER VA ENTER (2026-10-01) ══════════════════════════════════════
     Javondagi tovarlarni ketma-ket skanerlab navbatga qo'shish: aniq kod
     tovarni DARHOL navbatga qo'shadi, tanlagich va tugmani kutmaydi.
     Ilgari kod qidiruv maydoniga yozilib, keyingisi uning DAVOMIGA
     tushardi. Nom bilan Enter esa faqat TANLAYDI — nom noaniq, qo'shishni
     odam tasdiqlaydi. */
  const addByCode = async (raw) => {
    const code = String(raw ?? "").trim();
    if (!code) return;
    setSearch("");
    let p = findByCode(products, code);
    // Qadoq va tarozi barkodi ro'yxatda yo'q — ularni server hal qiladi.
    if (!p && looksLikeCode(code)) {
      try {
        const r = await productApi.scan(code);
        const id = r?.data?.product?.id;
        p = products.find((x) => x.id === id) || null;
      } catch (_) { p = null; }
    }
    if (!p) { toast?.error(t("scan.codeNotFound", { code })); return; }
    setPick(p.id);
    add(p.id);
  };

  const onSearchEnter = (e) => {
    if (e.key !== "Enter") return;
    const v = e.currentTarget.value.trim();
    if (!v) return;
    e.preventDefault();
    if (looksLikeCode(v) || v.startsWith("*")) { addByCode(v); return; }
    if (!options.length) { e.currentTarget.select(); return; }
    setPick(options[0].value);
    setSearch("");
  };

  /* ⚠ `compact` — chop etish oynasi ichida (tovarlar sahifasi, kod
     to'qnashuvi): u yerda qo'shish bo'limi umuman chizilmaydi. */
  const openLayers = useLayerCount();
  useScanner(addByCode, {
    enabled: !!job && !compact && source === "PRODUCTS" && openLayers === 0,
  });

  if (!job) return <Empty icon="fa-list-check" text={t("lbl.noJob")} />;

  const lines = job.lines || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Qayerga chiqadi ────────────────────────────────────── */}
      <div className="cat-tabs" role="group">
        {/* ⚠ NOMI TANLOVGA QARAB: ilgari bu tugma doim «Varaqqa (A4)»
            edi va rulon sozlagan do'konchi boshqa yo'l yo'q deb o'ylardi. */}
        <button type="button" className={`cat-tab ${via === "label" ? "active" : ""}`}
                aria-pressed={via === "label"} onClick={() => setVia("label")}>
          <i className={`fa-solid ${mode === "sheet" ? "fa-file-lines" : "fa-tags"}`} />
          {" "}{mode === "sheet" ? t("lbl.viaSheet") : t("lbl.viaLabel", { size })}
        </button>
        {/* ⚠ O'CHIQ TUGMA YASHIRILMAYDI, SABABI AYTILADI: ilgari u
            umuman ko'rinmasdi va brauzerdagi do'kon «bu imkoniyat
            yo'q» deb o'ylardi. */}
        <button type="button" className={`cat-tab ${via === "tape" ? "active" : ""}`}
                aria-pressed={via === "tape"} disabled={!tapeOn}
                title={tapeOn ? "" : t("lbl.blockTape")}
                onClick={() => setVia("tape")}>
          <i className="fa-solid fa-receipt" /> {t("lbl.viaTape")}
        </button>
      </div>
      {!tapeOn && <div className="form-hint">{t("lbl.blockTape")}</div>}

      {via === "label" && (
        <div className="form-hint">
          <i className={`fa-solid ${mode === "bytes" ? "fa-bolt" : "fa-circle-info"}`}
             aria-hidden="true" /> {route}
        </div>
      )}
      {via === "label" && needQueue && (
        <div className="form-hint form-hint--warn">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {" "}{t("lbl.routeNoQueue")}
        </div>
      )}

      {/* ── Shablon va boshlanish o'rni ─────────────────────────── */}
      {via === "label" && (
      <div className="lbl-row">
        <div style={{ flex: "1 1 220px" }}>
          <label className="form-label" htmlFor="lq-tpl">{t("lbl.template")}</label>
          {/* ⚠ TUR HINTDA: ro'yxatda javon va stiker dizaynlari birga,
              ilgari esa faqat javonnikilar edi — stiker umuman
              tanlanmasdi. */}
          <Select id="lq-tpl" block variant="field" ariaLabel={t("lbl.template")}
                  value={templateId}
                  onChange={(v) => { rememberTemplate(v); save({ templateId: v }); }}
                  options={templates.map((x) => ({
                    value: x.id, label: templateName(x),
                    hint: `${x.kind === "STICKER" ? t("lbl.kindSticker") : t("lbl.kindShelf")}`
                      + ` · ${sizeText(x.widthMm, x.heightMm)}`,
                  }))} />
        </div>
        {/* ⚠ YARIM ISHLATILGAN VARAQ TASHLANMASIN: birinchi N katak
            ataylab bo'sh qoldiriladi. */}
        {mode === "sheet" && (
        <div style={{ flex: "0 0 150px" }}>
          <label className="form-label" htmlFor="lq-start">{t("lbl.startPos")}</label>
          <input id="lq-start" className="input" type="number" min={1}
                 max={sheet?.perPage || 1} value={startPosition}
                 onChange={(e) => save({ startPosition: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        )}
      </div>
      )}

      {/* ── Navbatga qo'shish ───────────────────────────────────── */}
      {!compact && (
        <div className="lbl-add">
          <div className="lbl-row">
            <div style={{ flex: "1 1 200px" }}>
              <label className="form-label" htmlFor="lq-src">{t("lbl.source")}</label>
              <Select id="lq-src" block variant="field" ariaLabel={t("lbl.source")}
                      value={source} onChange={setSource}
                      options={SOURCES.map((s) => ({ value: s.value, label: t(s.labelKey) }))} />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <label className="form-label" htmlFor="lq-rule">{t("lbl.quantityRule")}</label>
              <Select id="lq-rule" block variant="field" ariaLabel={t("lbl.quantityRule")}
                      value={rule} onChange={setRule}
                      options={RULES.map((s) => ({ value: s.value, label: t(s.labelKey) }))} />
            </div>
            {rule === "MANUAL" && (
              <div style={{ flex: "0 0 120px" }}>
                <label className="form-label" htmlFor="lq-qty">{t("lbl.quantity")}</label>
                <input id="lq-qty" className="input" type="number" min={1} max={999}
                       value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
              </div>
            )}
          </div>

          {source === "PRODUCTS" && (
            <div style={{ marginTop: 8 }}>
              <SearchBar value={search} onChange={setSearch} onKeyDown={onSearchEnter}
                         placeholder={t("products.search")} />
              <div style={{ marginTop: 6 }}>
                <Select block variant="field" ariaLabel={t("lbl.product")}
                        value={pick} onChange={setPick} options={options} />
              </div>
            </div>
          )}

          {source === "CATEGORY" && (
            <div style={{ marginTop: 8 }}>
              <Select block variant="field" ariaLabel={t("lbl.srcCategory")}
                      value={categoryId} onChange={setCategoryId}
                      options={categories.map((c) => ({
                        value: c.id, label: c.name, hint: c.code || undefined,
                      }))} />
            </div>
          )}

          <button type="button" className="btn btn-outline btn-sm"
                  style={{ marginTop: 10 }} disabled={busy}
                  onClick={() => add()}>
            <i className="fa-solid fa-plus" /> {t("lbl.addToQueue")}
          </button>
        </div>
      )}

      {/* ── Qatorlar ────────────────────────────────────────────── */}
      {lines.length === 0 ? (
        <Empty icon="fa-list-check" text={t("lbl.queueEmpty")} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("products.name")}</th>
                <th className="ek-num">{t("lbl.code")}</th>
                <th className="ek-num">{t("products.salePrice")}</th>
                <th className="ek-num">{t("lbl.quantity")}</th>
                <th>{t("lbl.printedAt")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className={l.printedAt ? "lbl-line--done" : ""}>
                  <td>{l.productName}</td>
                  <td className="ek-num">{l.code || "—"}</td>
                  <td className="ek-num">{money(l.salePrice, { withUnit: true })}</td>
                  <td className="ek-num">
                    <input className="input" type="number" min={1} max={999}
                           aria-label={t("lbl.quantity")}
                           style={{ width: 84 }} value={l.quantity} disabled={busy}
                           onChange={(e) => wrap(() =>
                             labelApi.setQty(job.id, l.id,
                               Math.min(999, Math.max(1, Number(e.target.value) || 1))))} />
                  </td>
                  <td>{l.printedAt
                    ? <span className="badge badge-green">{t("lbl.printed")}</span>
                    : <span className="text-muted">—</span>}</td>
                  <td>
                    <button type="button" className="btn-icon danger" disabled={busy}
                            aria-label={t("common.delete")}
                            onClick={() => wrap(() => labelApi.dropLine(job.id, l.id))}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Hisob va ogohlantirishlar ───────────────────────────── */}
      <div className="lbl-summary">
        <div>
          {via === "tape" || mode !== "sheet"
            ? t("lbl.summaryTape", { n: pendingLabels })
            : t("lbl.summary", { n: pendingLabels, p: pageCount })}
          {job.totalLabels > pendingLabels && (
            <span className="text-muted">
              {" · "}{t("lbl.alreadyPrinted", { n: job.totalLabels - pendingLabels })}
            </span>
          )}
        </div>
        {via === "label" && warnings.map((w) => (
          <div key={w.text} className="form-hint form-hint--warn">
            <i className="fa-solid fa-triangle-exclamation" /> {w.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-green" disabled={busy || !!blocked}
                title={blocked || ""} onClick={print}>
          <i className="fa-solid fa-print" /> {t("lbl.printNow")}
        </button>
        {/* ⚠ SABAB TUGMA YONIDA: uni ko'rish uchun sichqonchani
            ushlab turish kerak bo'lmasin. */}
        {blocked && <span className="form-hint form-hint--warn">{blocked}</span>}
      </div>

      {/* ⚠ KOD BU SOZLAMANI KO'RA OLMAYDI. Brauzer chop etish
          oynasidagi «Masshtab» ni JavaScript'ga bermaydi — shuning
          uchun yagona yo'l aytib qo'yish va o'lchab tekshirish.
          Sinov varag'i tugmasi sahifa sarlavhasida: u navbat
          bo'lmaganda ham kerak bo'ladi. */}
      {/* ⚠ BAYT YO'LIDA VA LENTADA BU MASLAHAT YOLG'ON: u yerda brauzer
          masshtabi umuman yo'q. */}
      {via === "label" && mode !== "bytes" && (
        <div className="form-hint">{t("lbl.calWhy")}</div>
      )}

      {/* ── Chop etilgandan keyingi savol ───────────────────────── */}
      {finish && (
        <Modal title={t("lbl.finishTitle")} onClose={() => setFinish(null)} maxWidth={520}>
          <p className="text-muted" style={{ marginTop: 0 }}>{t("lbl.finishHint")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" className="btn btn-green"
                    onClick={() => confirmPrinted(null)}>
              <i className="fa-solid fa-check" /> {t("lbl.finishAll")}
            </button>
            <div>
              <label className="form-label" htmlFor="lq-upto">{t("lbl.finishUpto")}</label>
              <Select id="lq-upto" block variant="field" ariaLabel={t("lbl.finishUpto")}
                      value={null} onChange={(v) => confirmPrinted(Number(v))}
                      options={(finish.items || []).map((it, i) => ({
                        value: i, label: it.product?.name,
                        hint: productCode(it.product) || undefined,
                      }))} />
            </div>
            <button type="button" className="btn btn-outline"
                    onClick={() => setFinish(null)}>
              <i className="fa-solid fa-xmark" /> {t("lbl.finishNone")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
