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
import { getSettings, saveSettings } from "../../lib/ek-hw-settings";
import { listPrinters } from "../../lib/ek-hardware";
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
  autoPrinter, designsFor, lastTemplateId, pickTemplate, printerErrorKey, rememberTemplate, setupDone,
} from "../../lib/ek-sticker-auto";
import { routeOf, sendLabels, withCodes } from "../../lib/ek-label-send";
import { useLabelOutput } from "../../hooks/useLabelOutput";
import { useScanner } from "../../hooks/useScanner";
import { useConfirm } from "../../context/ConfirmProvider";
import { useLayerCount } from "../../hooks/useLayerCount";
import { isWeighed } from "../../lib/ek-weight-label";

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

/* ⚠ JAVON YORLIG'I — O'SHA EKRAN, BOSHQA SO'ZLAR (2026-10-04). Oqim bir xil
   (skanerla → son → chop et), farqi so'zlarda: «stiker» narx yorlig'iga
   to'g'ri kelmaydi. Faqat farq qiladigan matnlar `shf.*` da. */
const SHELF_TEXT = new Set(["title", "introTitle", "introText", "step2", "preview", "totalB",
  "totalNone", "printed", "docTitle", "addNever", "addedNever", "askTitle", "designTitle",
  "staleBanner"]);
const sizeText = (r) => (r ? `${Number(r.labelWidthMm)} × ${Number(r.labelHeightMm)}` : "");

export default function StickerSimple({ toast, productIds = null, compact = false,
                                        onPrinted, onAdvanced, kind = "STICKER",
                                        showHeader = true, onWeighed = null }) {
  const desktop = isDesktop();
  const tk = (key, vars) => t((kind === "SHELF" && SHELF_TEXT.has(key) ? "shf." : "stk.") + key, vars);
  const { outputs, loaded } = useLabelOutput();
  const out = outputs[kind] || {};
  const media = out.media || null;
  const printer = out.printer || null;
  /* `healedQueue` — shu ekranda o'zi topilgan nom: saqlangach qayta chizish uchun. */
  const [healedQueue, setHealedQueue] = useState("");
  const queue = (getSettings().labelPrinterName || healedQueue || "").trim();

  /* ⚠ PRINTER NOMI YO'QOLSA — O'ZI TOPADI (2026-10-04). Egasi: «har safar
     ilova yangilanganda stiker chiqarishni qayta sozlash kerak bo'lyapti».
     Qog'oz va printer turi SERVERDA, Windows printerining nomi esa shu
     kompyuterda (`ek_hw`). Nom yo'qolsa (sessiya tozalanishi —
     `ek-session.js`, yoki boshqa kompyuter) server sozlamasi joyida bo'lsa
     ham ekran BUTUN sozlashni qaytadan ochardi. Endi kompyuterda BITTA
     stiker printeri bo'lsa — jimgina qayta yoziladi; ikkita bo'lsa yoki
     birortasi bo'lmasa — odam tanlaydi (taxmin qilinmaydi, `autoPrinter`). */
  const rollMedia = loaded && desktop && !!media && String(media.mediaType) !== "VARAQ";
  const needsQueue = rollMedia && !queue;
  const [healed, setHealed] = useState(false);
  /* ⚠ SAQLANGAN PRINTER KOMPYUTERDA YO'Q BO'LSA HAM (2026-10-04): printer
     qayta o'rnatilsa Windows uni «Xprinter XP-365B (Copy 1)» deb nomlaydi
     va eski nomga yuborilgan stiker «printer ochilmadi» bilan qaytardi.
     Endi har ochilishda nom tekshiriladi; topilmasa — yagona stiker
     printeriga o'zi o'tadi. Printer o'chiq bo'lsa (ro'yxatda hech narsa
     yo'q) eski nom tegilmaydi. */
  useEffect(() => {
    if (!rollMedia || healed) return undefined;
    let alive = true;
    listPrinters().then((names) => {
      if (!alive) return;
      const list = names || [];
      const cur = (getSettings().labelPrinterName || "").trim();
      if (!cur || !list.includes(cur)) {
        const pick = autoPrinter(list, getSettings().printerName || "");
        if (pick && pick !== cur) { saveSettings({ labelPrinterName: pick }); setHealedQueue(pick); }
      }
      setHealed(true);
    });
    return () => { alive = false; };
  }, [rollMedia, healed]);
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
  /* Printer nomi qidirilayotganda sozlash OCHILMAYDI — topilsa, umuman kerak emas. */
  useEffect(() => {
    if (loaded && !ready && (!needsQueue || healed)) setInSetup(true);
  }, [loaded, ready, needsQueue, healed]);

  /* ⚠ NAVBAT BITTA MARTA YARATILADI: tez ketma-ket skanerlashda ikki so'rov
     bir vaqtda «navbat yo'q» deb ikkita navbat ochardi va tovarlar ikkiga
     bo'linib, birinchisi chop etilmay qolardi. */
  const jobRef = useRef(null);
  const creating = useRef(null);

  const template = useMemo(() => pickTemplate(templates, media, chosenId, kind),
    [templates, media, chosenId, kind]);
  const sheet = String(media?.mediaType) === "VARAQ";

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
        labelApi.templates(kind), productApi.getAll(), productApi.getCategories(),
      ]);
      const tpls = asArray(tRes.data);
      setTemplates(tpls);
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
        /* ⚠ HAR TURNING O'Z RO'YXATI: navbat shabloni bo'yicha ajratiladi.
           Aks holda stikerga qo'shilgan tovarlar narx yorlig'i ro'yxatida
           ham chiqib, javonga stiker o'lchamida chop etilardi. Shablonsiz
           navbat (tovarlar sahifasidan) — stikerniki. */
        const ids = new Set(tpls.map((x) => x.id));
        const mine = (j) => (j.templateId == null ? kind === "STICKER" : ids.has(j.templateId));
        const jobs = asArray((await labelApi.jobs()).data);
        putJob(jobs.find((j) => j.status === "DRAFT" && mine(j)) || null);
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
    const ok = await confirm({ title: tk("clearConfirm"), type: "danger" });
    if (!ok) return;
    try { await labelApi.dropJob(job.id); } catch { /* bo'lmasa ham ro'yxat yangidan */ }
    putJob(null);
  };

  const lines = (job?.lines || []).filter((l) => !l.printedAt);
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const roll = template ? rollFor(template, media) : null;
  const route = ready ? routeOf(media, printer) : null;

  const issues = useMemo(() => {
    /* ⚠ A4 DA TEKSHIRILMAYDI: varaq profilidagi 50×30 — katak namunasi,
       to'r esa dizayndan hisoblanadi. Tekshirilganda «dizayn 70 mm, qog'oz
       50 mm» deb chop etish to'silardi (navbatdagi qoida ham shunday). */
    if (!template || !media || sheet) return [];
    const p = route === "bytes" ? printer : printer && { ...printer, lang: "DRAYVER" };
    return blocking(validateOutput(media, p, template));
  }, [template, media, printer, route, sheet]);

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
     boshqa rulonniki va baribir sig'maydi yoki mitti chiqadi.
     ⚠ A4 VARAQDA O'LCHAM ERKIN: har yorliq sig'adi, shuning uchun galereya
     ustida o'lcham tugmalari (`gallerySize`), boshlang'ichi — joriy dizayn. */
  const [gallerySize, setGallerySize] = useState(null);
  const sizeKey = (x) => `${Number(x.widthMm)}x${Number(x.heightMm)}`;
  const sheetSizes = useMemo(() => (sheet ? [...new Map(templates.map((x) =>
    [sizeKey(x), Number(x.widthMm) * Number(x.heightMm)])).entries()]
    .sort((a, b) => a[1] - b[1]).map(([k]) => k) : []), [sheet, templates]);
  const activeSize = gallerySize || (template ? sizeKey(template) : sheetSizes[0]);
  const designs = useMemo(() => {
    if (!sheet) return designsFor(templates, media, kind);
    const [w, h] = String(activeSize || "").split("x").map(Number);
    return designsFor(templates, { labelWidthMm: w, labelHeightMm: h }, kind);
  }, [templates, media, kind, sheet, activeSize]);

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
    toast?.success(tk("printed", { n: items.reduce((s, x) => s + (x.quantity || 1), 0) }));
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
        title: tk("docTitle", { n: total }), ctx: shopCtx() });
      /* ⚠ BAYT YO'LIDA YETIB BORGANI ANIQ — so'ralmaydi. Brauzer oynasi
         esa «chiqdimi» ni bilmaydi: bekor qilinganda ham qaytadi. */
      if (mode === "bytes") await markDone(ready2);
      else setAsk({ items: ready2 });
    } catch (err) { setError(friendly(err)); }
    finally { setBusy(false); }
  };

  /* ══ CHIZISH ════════════════════════════════════════════════════════ */

  const header = !compact && showHeader && (
    <div className="page-header" style={{ marginBottom: 14 }}>
      <h2 className="page-title">{tk("title")}</h2>
    </div>
  );

  /* ⚠ Printer nomi qidirilayotganda ham skelet: aks holda sozlash bir lahza
     ko'rinib, printer topilgach yo'qolardi — «yana sozlash kerakmi?» degan
     tuyg'u aynan shundan. */
  if (!loaded || booting || (needsQueue && !healed)) {
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
              <div className="stk-intro__title">{tk("introTitle")}</div>
              <div className="stk-hint">{tk("introText")}</div>
            </div>
          </div>
          <StickerSetup toast={toast} kind={kind} onDone={() => setInSetup(false)} />
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
          <span>{tk("staleBanner", { n: stale })}</span>
          <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => addBody({ source: "PRICE_CHANGED", quantityRule: "ONE" },
                    tk("addedStale"))}>
            <i className="fa-solid fa-plus" /> {tk("addThem")}
          </button>
        </div>
      )}

      <div className={`stk-grid ${compact ? "stk-grid--compact" : ""}`}>
        <div className="card stk-card stk-main">
          {/* ── 1. Qo'shish ─────────────────────────────────────────── */}
          <label className="stk-q stk-q--sm" htmlFor="stk-scan">
            <span className="stk-num" aria-hidden="true">1</span> {tk("step1")}
          </label>
          <div className="stk-scan">
            <i className="fa-solid fa-barcode stk-scan__icon" aria-hidden="true" />
            <input id="stk-scan" ref={inputRef} className="form-input stk-scan__input"
                   autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)}
                   onKeyDown={onKey} placeholder={tk("scanPlaceholder")} />
          </div>
          {results.length > 0 && (
            <ul className="stk-results" aria-label={tk("results")}>
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
                      onClick={() => addBody({ source: "NEVER_PRINTED" }, tk("addedNever"))}>
                <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {tk("addNever")}
              </button>
              {categories.length > 0 && (
                <button type="button" className="stk-chip" onClick={() => setCatOpen(true)}>
                  <i className="fa-solid fa-layer-group" aria-hidden="true" /> {tk("addCategory")}
                </button>
              )}
            </div>
          )}

          {/* ⚠ JAVON YORLIG'IDA SON QOIDASI YO'Q: javonga har tovardan bitta
              yorliq qo'yiladi, «qoldiq soniga teng» u yerda ma'nosiz. */}
          {kind === "STICKER" && (
          <div className="stk-rule" role="group" aria-label={tk("ruleTitle")}>
            <span className="stk-rule__label">{tk("ruleTitle")}</span>
            {[["ONE", "stk.ruleOne"], ["STOCK", "stk.ruleStock"]].map(([v, key]) => (
              <button key={v} type="button" className={`cat-tab ${rule === v ? "active" : ""}`}
                      aria-pressed={rule === v} onClick={() => setRule(v)}>
                {t(key)}
              </button>
            ))}
          </div>
          )}

          {/* ── 2. Ro'yxat ──────────────────────────────────────────── */}
          <div className="stk-listhead">
            <span className="stk-q stk-q--sm">
              <span className="stk-num" aria-hidden="true">2</span> {tk("step2")}
            </span>
            {lines.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
                <i className="fa-solid fa-broom" /> {tk("clear")}
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <Empty icon="fa-barcode" text={tk("empty")} />
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
                        {/* ⚠ JAVON YORLIG'IDA BARKOD YO'Q (G1) — qatorda kassada
                            teriladigan kod ko'rsatiladi, «barkod beriladi» emas. */}
                        {kind === "SHELF" ? (
                          <span className="ek-num">{productCode(p) || l.code ? `*${productCode(p) || l.code}` : "—"}</span>
                        ) : p.barcode ? (
                          <span className="ek-num"><i className="fa-solid fa-barcode" aria-hidden="true" /> {p.barcode}</span>
                        ) : future ? (
                          <span className="stk-line__new">
                            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                            {tk("codeNew")} <span className="ek-num">{prettyStoreCode(future)}</span>
                          </span>
                        ) : (
                          <span className="stk-line__bad">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {tk("codeNone")}
                          </span>
                        )}
                        <span className="ek-num">{money(p.salePrice ?? l.salePrice, { withUnit: true })}</span>
                      </span>
                    </button>
                    <div className="qty-ctrl">
                      <button type="button" className="qty-btn" aria-label={tk("less")}
                              disabled={l.quantity <= 1} onClick={() => setQty(l, l.quantity - 1)}>−</button>
                      <span className="qty-num ek-num" aria-label={tk("count")}>{l.quantity}</span>
                      <button type="button" className="qty-btn" aria-label={tk("more")}
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

          {/* ⚠ TAROZILI TOVAR (2026-10-06). Egasi: «og'irliksiz ham stiker chiqara
              olsin, skanerlanganda taroziga qo'yish so'ralsin». Bu yerdagi stiker
              og'irliksiz (tovar kodi) — kassa uni skanerlaganda og'irlik so'raydi.
              Og'irlik bilan kerak bo'lsa — bitta tugma «Tarozi yorlig'i» ni shu
              tovar tanlangan holda ochadi (ilgari bu ikki yo'l bir-birini
              bilmasdi va egasi og'irlikli stikerni topa olmadi). */}
          {kind === "STICKER" && (() => {
            const w = lines.filter((l) => isWeighed(byId[l.productId] || {}));
            if (!w.length) return null;
            return (
              <div className="stk-note stk-weighed" role="note">
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                <div className="stk-weighed__body">
                  <div>{tk("weighedHint")}</div>
                  {onWeighed && (
                    <button type="button" className="btn btn-outline btn-sm"
                            onClick={() => onWeighed(w[w.length - 1].productId)}>
                      <i className="fa-solid fa-weight-scale" aria-hidden="true" /> {tk("weighedGo")}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── O'ng: ko'rinish va printer ───────────────────────────── */}
        <div className="stk-side">
          <div className="card stk-card">
            <div className="stk-q stk-q--sm">{tk("preview")}</div>
            <div className="stk-preview">
              {previewSvg ? (
                /* eslint-disable-next-line react/no-danger */
                <div className="stk-preview__paper" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="stk-hint">{tk("previewEmpty")}</div>
              )}
            </div>
            {template && (
              <div className="stk-design">
                <span>{tk("design")}: <b>{templateName(template)}</b></span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDesignOpen(true)}>
                  <i className="fa-solid fa-palette" /> {tk("changeDesign", { n: designs.length })}
                </button>
              </div>
            )}
          </div>

          <div className="card stk-card stk-status">
            <i className={`fa-solid ${route === "bytes" ? "fa-bolt" : "fa-print"}`} aria-hidden="true" />
            <div className="stk-status__text">
              <div className="stk-status__name">{desktop && !sheet ? queue : tk("printerInDialog")}</div>
              <div className="stk-hint">
                {sheet ? t("shf.a4") : <><span className="ek-num">{sizeText(roll)}</span> {tk("mm")}</>} ·{" "}
                {/* ⚠ «Bir qatorda 2 ta» KO'RINIB TURADI (2026-10-05): rulon bir ustunli
                    bo'lsa-yu, profil ikki qatorli bo'lsa, har ikkinchi stiker chiqmaydi —
                    do'konchi buni shu yozuvdan biladi va sozlashda bir marta o'zgartiradi. */}
                {!sheet && roll?.across > 1 && <>{tk("acrossN", { n: roll.across })} · </>}
                {route === "bytes" ? tk("routeDirect") : tk("routeDialog")}
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSetupOpen(true)}>
              <i className="fa-solid fa-gear" /> {tk("settings")}
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
              <i className="fa-solid fa-gear" /> {tk("settings")}
            </button>
          </div>
        )}
        {noCode.length > 0 && (
          <div className="stk-alert" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <div>{tk("noCodeWarn", { n: noCode.length })}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={dropNoCode}>
              <i className="fa-solid fa-xmark" /> {tk("removeThem")}
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
              ? <>{tk("totalA")} <b className="ek-num">{total}</b> {tk("totalB")}</>
              : tk("totalNone")}
          </div>
          <button type="button" className="btn btn-green stk-big"
                  disabled={busy || !total || !template || issues.length > 0 || noCode.length > 0}
                  onClick={print}>
            {busy ? <Spinner small /> : <i className="fa-solid fa-print" />}{" "}
            {tk("print")}
          </button>
        </div>
      </div>

      {!compact && onAdvanced && <AdvancedLink onAdvanced={onAdvanced} />}

      {ask && (
        <Modal title={tk("askTitle")} onClose={() => setAsk(null)} maxWidth={440}>
          <p className="stk-hint" style={{ marginTop: 0 }}>{tk("askHint")}</p>
          <div className="stk-ask__btns">
            <button type="button" className="btn btn-green stk-big"
                    onClick={async () => { const it = ask.items; setAsk(null); try { await markDone(it); } catch (e) { toast?.error(e.message); } }}>
              <i className="fa-solid fa-circle-check" /> {tk("askYes")}
            </button>
            <button type="button" className="btn btn-outline stk-big"
                    onClick={() => { setAsk(null); setError({ text: tk("askNoHint") }); }}>
              <i className="fa-solid fa-xmark" /> {tk("askNo")}
            </button>
          </div>
        </Modal>
      )}

      {setupOpen && (
        <Modal title={tk("setupTitle")} onClose={() => setSetupOpen(false)} maxWidth={720}>
          <StickerSetup toast={toast} kind={kind} onDone={() => setSetupOpen(false)} />
        </Modal>
      )}

      {catOpen && (
        <Modal title={tk("addCategory")} onClose={() => setCatOpen(false)} maxWidth={520}>
          <p className="stk-hint" style={{ marginTop: 0 }}>{tk("catHint")}</p>
          <div className="stk-choices">
            {categories.map((c) => (
              <button key={c.id} type="button" className="stk-choice"
                      onClick={() => { setCatOpen(false);
                        addBody({ source: "CATEGORY", categoryId: c.id }, tk("addedCategory")); }}>
                <i className="fa-solid fa-layer-group" aria-hidden="true" />
                <span className="stk-choice__name">{c.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {designOpen && (
        <Modal title={tk("designTitle")} onClose={() => setDesignOpen(false)} maxWidth={860}>
          <p className="stk-hint" style={{ marginTop: 0 }}>
            {sheet ? t("shf.designHintSheet") : tk("designHint")}
          </p>
          {sheet && sheetSizes.length > 1 && (
            <div className="cat-tabs lbl-sizes" role="group" aria-label={t("lbl.sizeFilter")}
                 style={{ padding: "0 0 10px" }}>
              {sheetSizes.map((k) => (
                <button key={k} type="button" className={`cat-tab ek-num ${activeSize === k ? "active" : ""}`}
                        aria-pressed={activeSize === k} onClick={() => setGallerySize(k)}>
                  {k.replace("x", "×")}
                </button>
              ))}
            </div>
          )}
          <LabelGallery
            templates={designs.length ? designs : templates}
            product={previewProduct ? withPreviewBarcode(previewProduct) : null}
            media={sheet ? null : media} selectedId={template?.id}
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
