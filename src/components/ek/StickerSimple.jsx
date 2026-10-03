import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi, productApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { Empty } from "../ui";
import Modal from "../Modal";
import { SkeletonList, Spinner } from "./Loading";
import LabelGallery from "./LabelGallery";
import StickerSetup from "./StickerSetup";
import { isDesktop } from "../../lib/ek-desktop";
import { getSettings } from "../../lib/ek-hw-settings";
import { money } from "../../lib/ek-format";
import { productCode, findByCode } from "../../lib/ek-code";
import { rankItems, looksLikeCode } from "../../lib/ek-search";
import { renderLabel } from "../../lib/ek-label-render";
import { pendingItems, rollFor } from "../../lib/ek-label-print";
import { blocking, validateOutput } from "../../lib/ek-label-validate";
import { drawsBarcode, withPreviewBarcode } from "../../lib/ek-label-codes";
import { prettyStoreCode, storeCodeOf } from "../../lib/ek-store-code";
import { templateName } from "../../lib/ek-label-name";
import {
  designsFor, lastTemplateId, pickTemplate, printerErrorKey, rememberTemplate, setupDone,
} from "../../lib/ek-sticker-auto";
import { routeOf, sendLabels, withCodes } from "../../lib/ek-label-send";
import { useLabelOutput } from "../../hooks/useLabelOutput";
import { useScanner } from "../../hooks/useScanner";
import { useConfirm } from "../../context/ConfirmProvider";
import { useLayerCount } from "../../hooks/useLayerCount";

/* ══════════════════════════════════════════════════════════════════════════
   STIKER CHIQARISH — ODDIY EKRAN (2026-10-03)

   Egasining talabi: «bu bo'lim juda murakkab, nima qilayotganimni umuman
   bilmayapman — juda sodda, ko'p narsani avto qiladigan qilib tayyorla».

   Ilgari stiker chiqarish uchun: «Navbat» bo'limiga o'tish → «Yangi navbat»
   → manba tanlash (tovarlar / bo'lim / narxi o'zgarganlar…) → son qoidasi
   → shablon → qo'shish → yo'l (varaq/lenta) → chop etish → «qaysi tovargacha
   chiqdi?» savoli. To'qqiz qadam, ularning yarmi texnik so'z.

   Endi ish uch harakat:
       1. tovarni SKANERLANG (yoki nomini yozing) — ro'yxatga tushadi;
       2. kerak bo'lsa sonini −/+ bilan o'zgartiring;
       3. «Chop etish».
   Printer, qog'oz va dizayn bir marta sozlanadi (`StickerSetup`), dizayn
   qog'ozga qarab avtomatik tanlanadi, barkodsiz tovarga kod o'zi beriladi.

   ⚠ ICHKARIDA O'SHA NAVBAT. Ro'yxat serverdagi chop etish navbatida
   saqlanadi (sahifa yopilsa yo'qolmaydi) va «chiqarildi» belgisi yoziladi —
   «narxi o'zgargan stikerlar» hisobi shunga tayanadi. Faqat do'konchi
   navbat so'zini ko'rmaydi.

   ⚠ KENGAYTIRILGAN REJIM YO'QOLMADI: dizayn tahrirlagich, javon yorlig'i,
   A4 varaq, navbatlar ro'yxati — pastdagi havola orqali.
   ══════════════════════════════════════════════════════════════════════════ */

const shopCtx = () => ({ shopName: localStorage.getItem("ek_shopName") || "" });
const sizeText = (r) => (r ? `${Number(r.labelWidthMm)} × ${Number(r.labelHeightMm)}` : "");

export default function StickerSimple({ toast, productIds = null, compact = false,
                                        onPrinted, onAdvanced }) {
  const desktop = isDesktop();
  const { outputs, loaded } = useLabelOutput();
  const out = outputs.STICKER || {};
  const media = out.media || null;
  const printer = out.printer || null;
  const queue = (getSettings().labelPrinterName || "").trim();
  const ready = setupDone(out, { desktop, queue });

  const [booting, setBooting] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [job, setJob] = useState(null);
  const [stale, setStale] = useState(0);
  const [chosenId, setChosenId] = useState(() => lastTemplateId());
  const [search, setSearch] = useState("");
  const [rule, setRule] = useState("ONE");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ask, setAsk] = useState(null);         // drayver yo'lida: «chiqdimi?»
  const [setupOpen, setSetupOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const inputRef = useRef(null);
  const confirm = useConfirm();

  /* ⚠ SOZLASH OXIRIGACHA OCHIQ TURADI. 2-qadamda sozlama saqlanadi va
     `ready` darhol `true` bo'ladi — shunga qarab chizilsa, sinov stikeri
     qadami ko'rinmasdan sozlash yopilib qolardi. Shuning uchun «sozlash
     boshlandi» alohida eslab qolinadi va faqat `onDone` da tugaydi. */
  const [inSetup, setInSetup] = useState(false);
  useEffect(() => { if (loaded && !ready) setInSetup(true); }, [loaded, ready]);

  /* ⚠ NAVBAT BITTA MARTA YARATILADI: tez ketma-ket skanerlashda ikki so'rov
     bir vaqtda «navbat yo'q» deb ikkita navbat ochardi va tovarlar ikkiga
     bo'linib, birinchisi chop etilmay qolardi. */
  const jobRef = useRef(null);
  const creating = useRef(null);

  const template = useMemo(() => pickTemplate(templates, media, chosenId),
    [templates, media, chosenId]);

  const byId = useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const refreshStale = useCallback(async () => {
    try { setStale(Number((await labelApi.stale(1)).data?.count) || 0); }
    catch { setStale(0); }
  }, []);

  const putJob = (j) => { jobRef.current = j; setJob(j); };

  const boot = useCallback(async () => {
    setBooting(true);
    try {
      const [tRes, pRes, cRes] = await Promise.all([
        labelApi.templates("STICKER"), productApi.getAll(), productApi.getCategories(),
      ]);
      setTemplates(asArray(tRes.data));
      setProducts(asArray(pRes.data));
      setCategories(asArray(cRes.data));

      if (productIds?.length) {
        /* Tovarlar sahifasidan: tanlanganlar bilan YANGI ro'yxat. */
        const created = (await labelApi.newJob({ startPosition: 1 })).data;
        const added = (await labelApi.addToJob(created.id, {
          source: "PRODUCTS", productIds, quantityRule: "ONE",
        })).data;
        putJob(added);
      } else {
        /* ⚠ FAQAT «DRAFT» — ya'ni bitta ham qatori chiqarilmagan navbat.
           Yarim chiqarilganiga qo'shilgan tovar chiqarilgan qatorga
           qo'shilib, chop etilmay qolishi mumkin edi (server soni
           qo'shadi, belgini tozalamaydi). */
        const jobs = asArray((await labelApi.jobs()).data);
        putJob(jobs.find((j) => j.status === "DRAFT") || null);
      }
    } catch (err) { toast?.error(err.message); }
    finally { setBooting(false); }
    if (!compact) refreshStale();
  }, [productIds, compact, toast, refreshStale]);

  useEffect(() => { boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureJob = async () => {
    if (jobRef.current) return jobRef.current;
    if (!creating.current) {
      creating.current = labelApi.newJob({ templateId: template?.id ?? null, startPosition: 1 })
        .then((r) => { putJob(r.data); return r.data; })
        .finally(() => { creating.current = null; });
    }
    return creating.current;
  };

  const addBody = async (body, okText) => {
    setError(null);
    try {
      const j = await ensureJob();
      const r = await labelApi.addToJob(j.id, { quantityRule: rule, ...body });
      putJob(r.data);
      if (okText) toast?.success(okText);
      return r.data;
    } catch (err) { toast?.error(err.message); return null; }
  };

  const addProduct = async (id) => {
    setSearch("");
    const j = await addBody({ source: "PRODUCTS", productIds: [id] });
    if (j) setSelected(id);
    inputRef.current?.focus();
  };

  /* Skaner yoki kod bilan Enter — tovar darhol ro'yxatga. */
  const addByCode = async (raw) => {
    const code = String(raw ?? "").trim();
    if (!code) return;
    setSearch("");
    let p = findByCode(products, code);
    if (!p && looksLikeCode(code)) {
      try {
        const r = await productApi.scan(code);
        const id = r?.data?.product?.id;
        p = products.find((x) => x.id === id) || (id ? { id } : null);
      } catch { p = null; }
    }
    if (p?.id) addProduct(p.id);
    else toast?.error(t("scan.codeNotFound", { code }));
  };

  const results = useMemo(() => {
    if (!search.trim()) return [];
    return rankItems(products, search, {
      codes: (p) => [p.barcode, productCode(p)],
      texts: (p) => [p.name],
    }).filter((p) => p.type !== "SERVICE").slice(0, 6);
  }, [products, search]);

  const onKey = (e) => {
    if (e.key !== "Enter") return;
    const v = e.currentTarget.value.trim();
    if (!v) return;
    e.preventDefault();
    if (looksLikeCode(v) || v.startsWith("*")) { addByCode(v); return; }
    if (results[0]) addProduct(results[0].id);
  };

  const openLayers = useLayerCount();
  /* ⚠ OYNA ICHIDA (tovarlar sahifasi) bitta qatlam — oynaning o'zi. */
  useScanner(addByCode, { enabled: ready && !booting && openLayers <= (compact ? 1 : 0) });

  const setQty = async (line, q) => {
    const n = Math.min(999, Math.max(1, q));
    if (n === line.quantity) return;
    try { putJob((await labelApi.setQty(job.id, line.id, n)).data); }
    catch (err) { toast?.error(err.message); }
  };
  const drop = async (line) => {
    try { putJob((await labelApi.dropLine(job.id, line.id)).data); }
    catch (err) { toast?.error(err.message); }
  };
  const clearAll = async () => {
    if (!job) return;
    const ok = await confirm({ title: t("stk.clearConfirm"), type: "danger" });
    if (!ok) return;
    try { await labelApi.dropJob(job.id); } catch { /* bo'lmasa ham ro'yxat yangidan */ }
    putJob(null);
  };

  const lines = (job?.lines || []).filter((l) => !l.printedAt);
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const roll = template ? rollFor(template, media) : null;
  const route = ready ? routeOf(media, printer) : null;

  const issues = useMemo(() => {
    if (!template || !media) return [];
    const p = route === "bytes" ? printer : printer && { ...printer, lang: "DRAYVER" };
    return blocking(validateOutput(media, p, template));
  }, [template, media, printer, route]);

  /* ⚠ KOD BERIB BO'LMAYDIGAN TOVAR — CHOP ETISHDAN OLDIN aytiladi.
     Maxsus kodi yo'q tovarga server barkod yasay olmaydi; ilgari bu faqat
     «Chop etish» bosilgandan keyin xato bo'lib chiqardi. Endi ro'yxatning
     o'zida ko'rinadi va bitta tugma bilan olib tashlanadi. */
  const noCode = template && drawsBarcode(template)
    ? lines.filter((l) => {
      const p = byId[l.productId] || { barcode: l.barcode, searchCode: l.code };
      return !p.barcode && !storeCodeOf(p.searchCode);
    })
    : [];
  const dropNoCode = async () => {
    try {
      let j = job;
      for (const l of noCode) j = (await labelApi.dropLine(j.id, l.id)).data;
      putJob(j);
    } catch (err) { toast?.error(err.message); }
  };

  /* ⚠ GALEREYADA FAQAT SHU RULON O'LCHAMI (V142): 127 ta stikerdan
     do'konchiga kerakligi — o'z rulonidagi 14 ta ko'rinish. Qolganlari
     boshqa rulonniki va baribir sig'maydi yoki mitti chiqadi. */
  const designs = useMemo(() => designsFor(templates, media), [templates, media]);

  const previewProduct = byId[selected] || byId[lines[lines.length - 1]?.productId] || null;
  const previewSvg = useMemo(() => {
    if (!template || !previewProduct) return "";
    try { return renderLabel(template, withPreviewBarcode(previewProduct), shopCtx()).svg; }
    catch { return ""; }
  }, [template, previewProduct]);

  const friendly = (err) => {
    const key = printerErrorKey(err?.message);
    return key ? { text: t(key), detail: err.message } : { text: err?.message || "" };
  };

  const markDone = async (items) => {
    const ids = items.map((x) => x.lineId).filter(Boolean);
    if (ids.length) await labelApi.markPrinted(job.id, ids);
    toast?.success(t("stk.printed", { n: items.reduce((s, x) => s + (x.quantity || 1), 0) }));
    putJob(null);
    setSelected(null);
    if (!compact) refreshStale();
    onPrinted?.();
  };

  const print = async () => {
    if (!job || !lines.length || !template) return;
    setBusy(true); setError(null);
    try {
      if (job.templateId !== template.id) {
        putJob((await labelApi.saveJob(job.id, { templateId: template.id })).data);
      }
      /* ⚠ BARKODSIZ TOVARGA KOD — shu yerda, va berilmasa TO'XTAYDI. */
      const ready2 = await withCodes(pendingItems(job, byId), template);
      /* Yangi kodlar ro'yxatda darhol ko'rinsin. */
      const fresh = new Map(ready2.filter((x) => x.product?.id).map((x) => [x.product.id, x.product.barcode]));
      setProducts((ps) => ps.map((p) => (fresh.get(p.id) && !p.barcode ? { ...p, barcode: fresh.get(p.id) } : p)));

      const mode = await sendLabels({ template, items: ready2, media, printer,
        title: t("stk.docTitle", { n: total }), ctx: shopCtx() });
      /* ⚠ BAYT YO'LIDA YETIB BORGANI ANIQ — so'ralmaydi. Brauzer oynasi
         esa «chiqdimi» ni bilmaydi: bekor qilinganda ham qaytadi. */
      if (mode === "bytes") await markDone(ready2);
      else setAsk({ items: ready2 });
    } catch (err) { setError(friendly(err)); }
    finally { setBusy(false); }
  };

  /* ══ CHIZISH ════════════════════════════════════════════════════════ */

  const header = !compact && (
    <div className="page-header" style={{ marginBottom: 14 }}>
      <h2 className="page-title">{t("stk.title")}</h2>
    </div>
  );

  if (!loaded || booting) {
    return <div>{header}<div className="card"><SkeletonList rows={4} avatar={false} /></div></div>;
  }

  if (!ready || inSetup) {
    return (
      <div>
        {header}
        <div className="card stk-card">
          <div className="stk-intro">
            <i className="fa-solid fa-tags" aria-hidden="true" />
            <div>
              <div className="stk-intro__title">{t("stk.introTitle")}</div>
              <div className="stk-hint">{t("stk.introText")}</div>
            </div>
          </div>
          <StickerSetup toast={toast} onDone={() => setInSetup(false)} />
        </div>
        {!compact && onAdvanced && <AdvancedLink onAdvanced={onAdvanced} />}
      </div>
    );
  }

  return (
    <div className="stk">
      {header}

      {!compact && stale > 0 && (
        <div className="stk-banner">
          <i className="fa-solid fa-tag" aria-hidden="true" />
          <span>{t("stk.staleBanner", { n: stale })}</span>
          <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => addBody({ source: "PRICE_CHANGED", quantityRule: "ONE" },
                    t("stk.addedStale"))}>
            <i className="fa-solid fa-plus" /> {t("stk.addThem")}
          </button>
        </div>
      )}

      <div className={`stk-grid ${compact ? "stk-grid--compact" : ""}`}>
        <div className="card stk-card stk-main">
          {/* ── 1. Qo'shish ─────────────────────────────────────────── */}
          <label className="stk-q stk-q--sm" htmlFor="stk-scan">
            <span className="stk-num" aria-hidden="true">1</span> {t("stk.step1")}
          </label>
          <div className="stk-scan">
            <i className="fa-solid fa-barcode stk-scan__icon" aria-hidden="true" />
            <input id="stk-scan" ref={inputRef} className="form-input stk-scan__input"
                   autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)}
                   onKeyDown={onKey} placeholder={t("stk.scanPlaceholder")} />
          </div>
          {results.length > 0 && (
            <ul className="stk-results" aria-label={t("stk.results")}>
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className="stk-result" onClick={() => addProduct(p.id)}>
                    <span className="stk-result__name">{p.name}</span>
                    <span className="stk-result__meta ek-num">
                      {productCode(p) ? `*${productCode(p)} · ` : ""}{money(p.salePrice, { withUnit: true })}
                    </span>
                    <i className="fa-solid fa-plus" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!compact && (
            <div className="stk-quick">
              <button type="button" className="stk-chip"
                      onClick={() => addBody({ source: "NEVER_PRINTED" }, t("stk.addedNever"))}>
                <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {t("stk.addNever")}
              </button>
              {categories.length > 0 && (
                <button type="button" className="stk-chip" onClick={() => setCatOpen(true)}>
                  <i className="fa-solid fa-layer-group" aria-hidden="true" /> {t("stk.addCategory")}
                </button>
              )}
            </div>
          )}

          <div className="stk-rule" role="group" aria-label={t("stk.ruleTitle")}>
            <span className="stk-rule__label">{t("stk.ruleTitle")}</span>
            {[["ONE", "stk.ruleOne"], ["STOCK", "stk.ruleStock"]].map(([v, key]) => (
              <button key={v} type="button" className={`cat-tab ${rule === v ? "active" : ""}`}
                      aria-pressed={rule === v} onClick={() => setRule(v)}>
                {t(key)}
              </button>
            ))}
          </div>

          {/* ── 2. Ro'yxat ──────────────────────────────────────────── */}
          <div className="stk-listhead">
            <span className="stk-q stk-q--sm">
              <span className="stk-num" aria-hidden="true">2</span> {t("stk.step2")}
            </span>
            {lines.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
                <i className="fa-solid fa-broom" /> {t("stk.clear")}
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <Empty icon="fa-barcode" text={t("stk.empty")} />
          ) : (
            <ul className="stk-lines">
              {lines.map((l) => {
                const p = byId[l.productId] || { name: l.productName, barcode: l.barcode, searchCode: l.code };
                const future = !p.barcode ? storeCodeOf(p.searchCode) : null;
                const on = (selected ?? lines[lines.length - 1]?.productId) === l.productId;
                return (
                  <li key={l.id} className={`stk-line ${on ? "is-on" : ""}`}>
                    <button type="button" className="stk-line__main" onClick={() => setSelected(l.productId)}
                            aria-pressed={on}>
                      <span className="stk-line__name">{p.name || l.productName}</span>
                      <span className="stk-line__meta">
                        {p.barcode ? (
                          <span className="ek-num"><i className="fa-solid fa-barcode" aria-hidden="true" /> {p.barcode}</span>
                        ) : future ? (
                          <span className="stk-line__new">
                            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                            {t("stk.codeNew")} <span className="ek-num">{prettyStoreCode(future)}</span>
                          </span>
                        ) : (
                          <span className="stk-line__bad">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("stk.codeNone")}
                          </span>
                        )}
                        <span className="ek-num">{money(p.salePrice ?? l.salePrice, { withUnit: true })}</span>
                      </span>
                    </button>
                    <div className="qty-ctrl">
                      <button type="button" className="qty-btn" aria-label={t("stk.less")}
                              disabled={l.quantity <= 1} onClick={() => setQty(l, l.quantity - 1)}>−</button>
                      <span className="qty-num ek-num" aria-label={t("stk.count")}>{l.quantity}</span>
                      <button type="button" className="qty-btn" aria-label={t("stk.more")}
                              onClick={() => setQty(l, l.quantity + 1)}>+</button>
                    </div>
                    <button type="button" className="btn-icon danger" aria-label={t("common.delete")}
                            onClick={() => drop(l)}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── O'ng: ko'rinish va printer ───────────────────────────── */}
        <div className="stk-side">
          <div className="card stk-card">
            <div className="stk-q stk-q--sm">{t("stk.preview")}</div>
            <div className="stk-preview">
              {previewSvg ? (
                /* eslint-disable-next-line react/no-danger */
                <div className="stk-preview__paper" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="stk-hint">{t("stk.previewEmpty")}</div>
              )}
            </div>
            {template && (
              <div className="stk-design">
                <span>{t("stk.design")}: <b>{templateName(template)}</b></span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDesignOpen(true)}>
                  <i className="fa-solid fa-palette" /> {t("stk.changeDesign", { n: designs.length })}
                </button>
              </div>
            )}
          </div>

          <div className="card stk-card stk-status">
            <i className={`fa-solid ${route === "bytes" ? "fa-bolt" : "fa-print"}`} aria-hidden="true" />
            <div className="stk-status__text">
              <div className="stk-status__name">{desktop ? queue : t("stk.printerInDialog")}</div>
              <div className="stk-hint">
                <span className="ek-num">{sizeText(roll)}</span> {t("stk.mm")} ·{" "}
                {route === "bytes" ? t("stk.routeDirect") : t("stk.routeDialog")}
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSetupOpen(true)}>
              <i className="fa-solid fa-gear" /> {t("stk.settings")}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Chop etish ─────────────────────────────────────────────── */}
      <div className="stk-bar">
        {error && (
          <div className="stk-alert" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <div>
              <div>{error.text}</div>
              {error.detail && <div className="stk-alert__detail">{error.detail}</div>}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSetupOpen(true)}>
              <i className="fa-solid fa-gear" /> {t("stk.settings")}
            </button>
          </div>
        )}
        {noCode.length > 0 && (
          <div className="stk-alert" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <div>{t("stk.noCodeWarn", { n: noCode.length })}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={dropNoCode}>
              <i className="fa-solid fa-xmark" /> {t("stk.removeThem")}
            </button>
          </div>
        )}
        {issues.length > 0 && (
          <div className="stk-alert" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <div>{issues[0].text}</div>
          </div>
        )}
        <div className="stk-bar__row">
          <div className="stk-bar__total">
            {total > 0
              ? <>{t("stk.totalA")} <b className="ek-num">{total}</b> {t("stk.totalB")}</>
              : t("stk.totalNone")}
          </div>
          <button type="button" className="btn btn-green stk-big"
                  disabled={busy || !total || !template || issues.length > 0 || noCode.length > 0}
                  onClick={print}>
            {busy ? <Spinner small /> : <i className="fa-solid fa-print" />}{" "}
            {t("stk.print")}
          </button>
        </div>
      </div>

      {!compact && onAdvanced && <AdvancedLink onAdvanced={onAdvanced} />}

      {ask && (
        <Modal title={t("stk.askTitle")} onClose={() => setAsk(null)} maxWidth={440}>
          <p className="stk-hint" style={{ marginTop: 0 }}>{t("stk.askHint")}</p>
          <div className="stk-ask__btns">
            <button type="button" className="btn btn-green stk-big"
                    onClick={async () => { const it = ask.items; setAsk(null); try { await markDone(it); } catch (e) { toast?.error(e.message); } }}>
              <i className="fa-solid fa-circle-check" /> {t("stk.askYes")}
            </button>
            <button type="button" className="btn btn-outline stk-big"
                    onClick={() => { setAsk(null); setError({ text: t("stk.askNoHint") }); }}>
              <i className="fa-solid fa-xmark" /> {t("stk.askNo")}
            </button>
          </div>
        </Modal>
      )}

      {setupOpen && (
        <Modal title={t("stk.setupTitle")} onClose={() => setSetupOpen(false)} maxWidth={720}>
          <StickerSetup toast={toast} onDone={() => setSetupOpen(false)} />
        </Modal>
      )}

      {catOpen && (
        <Modal title={t("stk.addCategory")} onClose={() => setCatOpen(false)} maxWidth={520}>
          <p className="stk-hint" style={{ marginTop: 0 }}>{t("stk.catHint")}</p>
          <div className="stk-choices">
            {categories.map((c) => (
              <button key={c.id} type="button" className="stk-choice"
                      onClick={() => { setCatOpen(false);
                        addBody({ source: "CATEGORY", categoryId: c.id }, t("stk.addedCategory")); }}>
                <i className="fa-solid fa-layer-group" aria-hidden="true" />
                <span className="stk-choice__name">{c.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {designOpen && (
        <Modal title={t("stk.designTitle")} onClose={() => setDesignOpen(false)} maxWidth={860}>
          <p className="stk-hint" style={{ marginTop: 0 }}>{t("stk.designHint")}</p>
          <LabelGallery
            templates={designs.length ? designs : templates}
            product={previewProduct ? withPreviewBarcode(previewProduct) : null}
            media={media} selectedId={template?.id}
            onPick={(tpl) => { rememberTemplate(tpl.id); setChosenId(tpl.id); setDesignOpen(false); }}
            onOpen={(tpl) => { rememberTemplate(tpl.id); setChosenId(tpl.id); setDesignOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
}

function AdvancedLink({ onAdvanced }) {
  return (
    <div className="stk-adv">
      <button type="button" className="btn btn-outline btn-sm" onClick={onAdvanced}>
        <i className="fa-solid fa-sliders" /> {t("stk.advanced")}
      </button>
      <span className="stk-hint">{t("stk.advancedHint")}</span>
    </div>
  );
}
