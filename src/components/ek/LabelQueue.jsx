import { useEffect, useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi, productApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { Empty, SearchBar } from "../ui";
import Select from "./Select";
import Modal from "../Modal";
import { productCode } from "../../lib/ek-code";
import { rankItems } from "../../lib/ek-search";
import { money } from "../../lib/ek-format";
import { printHtml } from "../../lib/ek-receipt-pdf";
import { printPriceLabels } from "../../lib/ek-hardware";
import { isDesktop } from "../../lib/ek-desktop";
import { buildPrintDoc, pendingItems, sheetFor, PAGES } from "../../lib/ek-label-print";

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
  const [via, setVia]         = useState("sheet"); // sheet | tape

  const templateId = job?.templateId ?? null;
  const template = templates.find((x) => x.id === templateId) || null;

  useEffect(() => {
    if (!templateId && templates.length && job?.id) save({ templateId: templates[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templates.length, job?.id]);

  const byId = useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const pending = useMemo(() => pendingItems(job, byId), [job, byId]);
  const sheet   = useMemo(() => (template ? sheetFor(template, PAGES.A4) : null), [template]);

  const pendingLabels = pending.reduce((s, x) => s + x.quantity, 0);
  const startPosition = Math.max(1, Number(job?.startPosition) || 1);
  const pageCount = sheet
    ? Math.ceil((pendingLabels + startPosition - 1) / sheet.perPage) : 0;

  /* ⚠ OGOHLANTIRISHLAR OLDINDAN. Sig'masligini qog'ozdan keyin
     bilish — 40 ta yorliqni qayta chiqarish demak. */
  const preview = useMemo(() => {
    if (!template || !pending.length) return null;
    try {
      return buildPrintDoc(template, pending, { startPosition, ctx: shopCtx() });
    } catch {
      return null;
    }
  }, [template, pending, startPosition]);

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
  const tapeOn = isDesktop();
  const blocked =
    !pending.length      ? t("lbl.blockEmpty")
    : via === "tape"     ? (tapeOn ? null : t("lbl.blockTape"))
    : !template          ? t("lbl.blockNoTemplate")
    : !sheet             ? t("lbl.blockTooBig", { w: Number(template.widthMm),
                                                  h: Number(template.heightMm) })
    : startPosition > (sheet?.perPage || 1) ? t("lbl.blockStart", { n: sheet.perPage })
    : null;

  const wrap = async (fn) => {
    setBusy(true);
    try { const r = await fn(); onChange?.(r?.data); return r; }
    catch (err) { toast?.error(err.message); }
    finally { setBusy(false); }
  };

  const save = (body) => wrap(() => labelApi.saveJob(job.id, body));

  const add = () => {
    const body = {
      source,
      productIds: source === "PRODUCTS" ? (pick ? [pick] : []) : null,
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
  const withBarcodes = async (items) => {
    const spec = typeof template.spec === "string"
      ? JSON.parse(template.spec) : (template.spec || {});
    const drawsBarcode = (spec.fields || [])
      .some((f) => f.key === "barcode" && f.visible !== false);
    if (!drawsBarcode) return items;

    const out = [];
    for (const it of items) {
      if (it.product?.barcode || !it.product?.id) { out.push(it); continue; }
      try {
        const fresh = await productApi.generateCode(it.product.id);
        out.push({ ...it, product: { ...it.product, barcode: fresh?.data?.barcode || null } });
      } catch {
        /* ⚠ Bitta tovarga kod berilmasa qolganlari to'xtamaydi:
           o'sha yorliqda barkod o'rni bo'sh qoladi, odam o'qiydigan
           raqam esa baribir turadi. */
        out.push(it);
      }
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
      } else {
        const doc = buildPrintDoc(template, ready, { startPosition, ctx: shopCtx() });
        /* ⚠ HUJJAT NOMI = SAQLANGAN PDF NING NOMI. Brauzerning chop
           etish oynasida «PDF ga saqlash» tanlansa, fayl aynan shu
           nom bilan tushadi. «Yorliqlar.pdf» degan o'nta fayl bir
           papkada yotsa, ularni ajratib bo'lmasdi. */
        await printHtml(doc.html, docTitle(job), doc.css, "width=980,height=800");
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

  if (!job) return <Empty icon="fa-list-check" text={t("lbl.noJob")} />;

  const lines = job.lines || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Qayerga chiqadi ────────────────────────────────────── */}
      <div className="cat-tabs" role="group">
        <button type="button" className={`cat-tab ${via === "sheet" ? "active" : ""}`}
                aria-pressed={via === "sheet"} onClick={() => setVia("sheet")}>
          <i className="fa-solid fa-file-lines" /> {t("lbl.viaSheet")}
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

      {/* ── Shablon va boshlanish o'rni ─────────────────────────── */}
      {via === "sheet" && (
      <div className="lbl-row">
        <div style={{ flex: "1 1 220px" }}>
          <label className="form-label" htmlFor="lq-tpl">{t("lbl.template")}</label>
          <Select id="lq-tpl" block variant="field" ariaLabel={t("lbl.template")}
                  value={templateId} onChange={(v) => save({ templateId: v })}
                  options={templates.map((x) => ({
                    value: x.id, label: x.name,
                    hint: `${Number(x.widthMm)}×${Number(x.heightMm)}`,
                  }))} />
        </div>
        {/* ⚠ YARIM ISHLATILGAN VARAQ TASHLANMASIN: birinchi N katak
            ataylab bo'sh qoldiriladi. */}
        <div style={{ flex: "0 0 150px" }}>
          <label className="form-label" htmlFor="lq-start">{t("lbl.startPos")}</label>
          <input id="lq-start" className="input" type="number" min={1}
                 max={sheet?.perPage || 1} value={startPosition}
                 onChange={(e) => save({ startPosition: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
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
              <SearchBar value={search} onChange={setSearch}
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
                  onClick={add}>
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
          {via === "tape"
            ? t("lbl.summaryTape", { n: pendingLabels })
            : t("lbl.summary", { n: pendingLabels, p: pageCount })}
          {job.totalLabels > pendingLabels && (
            <span className="text-muted">
              {" · "}{t("lbl.alreadyPrinted", { n: job.totalLabels - pendingLabels })}
            </span>
          )}
        </div>
        {via === "sheet" && warnings.map((w) => (
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
      <div className="form-hint">{t("lbl.calWhy")}</div>

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
