import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { labelApi, productApi, shopApi } from "../../api";
import { asArray } from "../../lib/ek-array";
import { isDesktop } from "../../lib/ek-desktop";
import { getSettings } from "../../lib/ek-hw-settings";
import { money } from "../../lib/ek-format";
import { rankItems } from "../../lib/ek-search";
import { findByCode, productCode } from "../../lib/ek-code";
import { canonicalPlu } from "../../lib/ek-catalog";
import { renderLabel } from "../../lib/ek-label-render";
import { templateName } from "../../lib/ek-label-name";
import { designsFor, pickTemplate, printerErrorKey, setupDone } from "../../lib/ek-sticker-auto";
import { routeOf, sendLabels } from "../../lib/ek-label-send";
import { isWeighed, normScale, stamp, totalOf, weighedProduct, weightText } from "../../lib/ek-weight-label";
import { subscribe as scaleSubscribe, resume as scaleResume } from "../../lib/ek-scale-live";
import { useLabelOutput } from "../../hooks/useLabelOutput";
import { useScanner } from "../../hooks/useScanner";
import { NumField } from "./EkFields";
import { SkeletonList, Spinner } from "./Loading";
import StickerSetup from "./StickerSetup";

/* ══════════════════════════════════════════════════════════════════════════
   TAROZI YORLIG'I — TORTIB CHIQARISH (2026-10-04)

   Egasi (do'kondagi tarozi stikerining surati bilan): «bu stikerlardan
   shablon ol», qarori — tortib chiqarish. Do'konda «smart tarozi bor,
   lekin stiker chiqarmaydi» (V111) — endi stikerni e-Kassam chiqaradi.

   Oqim — tarozi-printerdagidek: tovar tanlanadi → tovar taroziga
   qo'yiladi → og'irlik o'zi o'qiladi → «Chop etish». Xohlasa, og'irlik
   barqaror bo'lganda o'zi chiqadi va keyingisi uchun tovar olinadi.
   Tarozi ulanmagan bo'lsa — og'irlik qo'lda yoziladi.

   ⚠ BARKOD DO'KONNING TAROZI FORMATIDA (`ek-weight-label.js`): kassa uni
   og'irligi bilan taniydi. Printer va rulon — stikerniki (o'sha sozlama).
   ══════════════════════════════════════════════════════════════════════════ */

const TPL_KEY = "ek_scale_tpl";
const AUTO_KEY = "ek_scale_auto";
const readLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* yopiq xotira */ } };

/** Tarozi bo'shatildi deb hisoblanadigan og'irlik (avtomatik chop etish yana tayyor turadi). */
const EMPTY_KG = 0.005;

export default function ScaleLabel({ toast, onAdvanced }) {
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
  const [scale, setScale] = useState(normScale({}));
  const [shopName, setShopName] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState(null);
  const [live, setLive] = useState(null);           // tarozi holati: {kg, stable} | null
  const [manual, setManual] = useState(false);
  const [manualKg, setManualKg] = useState("");
  const [copies, setCopies] = useState(1);
  const [tplId, setTplId] = useState(() => Number(readLS(TPL_KEY)) || null);
  const [auto, setAuto] = useState(() => readLS(AUTO_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null);
  const [inSetup, setInSetup] = useState(false);
  const armed = useRef(true);
  const inputRef = useRef(null);

  useEffect(() => { if (loaded && !ready) setInSetup(true); }, [loaded, ready]);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, pRes, sRes] = await Promise.all([
          labelApi.templates("STICKER"), productApi.getAll(), shopApi.getProfile().catch(() => null),
        ]);
        setTemplates(asArray(tRes.data));
        const list = asArray(pRes.data).filter(isWeighed);
        setProducts(list);
        /* Stiker ekranidagi «Og'irlik bilan» tugmasidan kelindi — tovar tayyor tanlangan. */
        let pickId = null;
        try { pickId = sessionStorage.getItem("ek_scale_pick"); sessionStorage.removeItem("ek_scale_pick"); } catch { /* yopiq */ }
        const pre = pickId && list.find((x) => String(x.id) === pickId);
        if (pre) setProduct(pre);
        const d = sRes?.data || {};
        setScale(normScale(d));
        setShopName(d.name || readLS("ek_shopName") || "");
      } catch (err) { toast?.error(err.message); }
      finally { setBooting(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Jonli tarozi — kassadagi bilan bir xil manba (`ek-scale-live`). */
  useEffect(() => {
    scaleResume();
    return scaleSubscribe((st) => setLive(st.on ? st : null));
  }, []);

  const fromScale = Boolean(live) && !manual;
  const kg = fromScale ? Number(live?.kg) || 0 : Number(manualKg) || 0;
  const stable = fromScale ? Boolean(live?.stable) : kg > 0;

  const designs = useMemo(() => designsFor(templates, media, "SCALE"), [templates, media]);
  const template = useMemo(() => pickTemplate(templates, media, tplId, "SCALE"), [templates, media, tplId]);

  const weighed = useMemo(() => (product && kg > 0 ? weighedProduct(product, kg, scale) : null), [product, kg, scale]);
  const previewSvg = useMemo(() => {
    if (!template) return null;
    const sample = weighed?.product || (product
      ? { ...product, weightText: weightText(0), total: 0, pluText: product.plu }
      : null);
    if (!sample) return null;
    try { return renderLabel(template, sample, { printedAt: stamp(), shopName }).svg; } catch { return null; }
  }, [template, weighed, product, shopName]);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    return rankItems(products, search, {
      codes: (p) => [p.barcode, productCode(p), p.plu],
      texts: (p) => [p.name],
    }).slice(0, 6);
  }, [products, search]);

  const choose = (p) => {
    setProduct(p); setSearch(""); setError(null); armed.current = true;
  };

  const byCode = (raw) => {
    const code = String(raw ?? "").trim();
    if (!code) return;
    const p = findByCode(products, code)
      || products.find((x) => canonicalPlu(x.plu) && canonicalPlu(x.plu) === canonicalPlu(code));
    if (p) choose(p);
    else toast?.error(t("wl.notFound", { code }));
  };
  useScanner(byCode, { enabled: ready && !booting && !inSetup });

  const friendly = (err) => {
    const key = printerErrorKey(err?.message);
    return key ? { text: t(key), detail: err.message } : { text: err?.message || "" };
  };

  /* ⚠ PLU YO'Q — O'ZI BERILADI (2026-10-06). Egasi: «tarozili mahsulotlarga
     ham kodli stiker chiqarib bo'lsin». Og'irlik barkodi tovarni PLU orqali
     topadi; ilgari PLU'siz tovarda «PLU kod yo'q» deb to'xtardi va do'konchi
     mahsulot kartasini ochib, PLU nima ekanini o'rganishi kerak edi. Endi
     server *kodni (band bo'lsa birinchi bo'sh raqamni) PLU qiladi —
     `POST /products/{id}/plu/auto`. Huquqi yo'q xodimda eski xabar qoladi. */
  const withPlu = async (p) => {
    if (String(p?.plu ?? "").trim()) return p;
    const fresh = (await productApi.autoPlu(p.id))?.data;
    if (!fresh?.plu) return p;
    const next = { ...p, plu: fresh.plu };
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, plu: fresh.plu } : x)));
    setProduct((cur) => (cur?.id === p.id ? next : cur));
    return next;
  };

  const print = async (atKg = kg) => {
    if (!product || busy) return;
    setError(null);
    let item = product;
    try { item = await withPlu(product); } catch { /* huquq yo'q — pastda «PLU yo'q» */ }
    const r = weighedProduct(item, atKg, scale);
    if (r.error) { setError({ text: t(r.error) }); return; }
    if (!template) { setError({ text: t("wl.noTemplate") }); return; }
    setBusy(true);
    try {
      await sendLabels({
        template, items: [{ product: r.product, quantity: Math.max(1, Number(copies) || 1) }],
        media, printer, title: t("wl.docTitle"), ctx: { printedAt: stamp(), shopName },
      });
      setLast({ name: product.name, kg: atKg, total: r.product.total });
    } catch (err) { setError(friendly(err)); }
    finally { setBusy(false); }
  };

  /* ⚠ AVTOMATIK CHOP ETISH — BIR TORTISHGA BIR STIKER: barqaror og'irlikda
     chiqadi va tarozi bo'shatilguncha (≈0 kg) qayta chiqmaydi. Aks holda
     tovar tarozida turgan har soniyada yangi stiker chiqardi. */
  useEffect(() => {
    if (!fromScale) return;
    if (kg < EMPTY_KG) { armed.current = true; return; }
    if (auto && armed.current && stable && product && !busy) {
      armed.current = false;
      print(kg);
    }
  }, [kg, stable, auto, fromScale, product]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (results[0]) choose(results[0]);
    else byCode(search);
  };

  if (!loaded || booting) return <div className="card"><SkeletonList rows={4} avatar={false} /></div>;

  if (!ready || inSetup) {
    return (
      <div className="card stk-card">
        <div className="stk-intro">
          <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
          <div>
            <div className="stk-intro__title">{t("stk.introTitle")}</div>
            <div className="stk-hint">{t("stk.introText")}</div>
          </div>
        </div>
        <StickerSetup toast={toast} kind="STICKER" onDone={() => setInSetup(false)} />
      </div>
    );
  }

  const total = product ? totalOf(product.salePrice, kg, product.unit) : 0;
  const route = media ? routeOf(media, printer) : null;

  return (
    <div className="stk">
      <div className="stk-grid">
        <div className="card stk-card stk-main wl-main">
          {/* ── 1. Tovar ─────────────────────────────────────────────── */}
          <label className="stk-q stk-q--sm" htmlFor="wl-scan">
            <span className="stk-num" aria-hidden="true">1</span> {t("wl.step1")}
          </label>
          {product ? (
            <div className="wl-product">
              <div className="wl-product__text">
                <div className="wl-product__name">{product.name}</div>
                <div className="stk-hint ek-num">
                  {product.plu ? `PLU ${product.plu} · ` : ""}{t("wl.perKg", { price: money(product.salePrice, { withUnit: true }) })}
                </div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setProduct(null); setTimeout(() => inputRef.current?.focus(), 0); }}>
                <i className="fa-solid fa-rotate" aria-hidden="true" /> {t("wl.change")}
              </button>
            </div>
          ) : (
            <>
              <div className="stk-scan">
                <i className="fa-solid fa-barcode stk-scan__icon" aria-hidden="true" />
                <input id="wl-scan" ref={inputRef} className="form-input stk-scan__input" autoComplete="off"
                       value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onKey}
                       placeholder={t("wl.scanPh")} autoFocus />
              </div>
              {results.length > 0 && (
                <ul className="stk-results" aria-label={t("wl.step1")}>
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="stk-result" onClick={() => choose(p)}>
                        <span className="stk-result__name">{p.name}</span>
                        <span className="stk-result__meta ek-num">
                          {p.plu ? `PLU ${p.plu} · ` : ""}{money(p.salePrice, { withUnit: true })}
                        </span>
                        <i className="fa-solid fa-check" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {products.length === 0 && <p className="stk-hint">{t("wl.noWeighed")}</p>}
            </>
          )}

          {/* ── 2. Og'irlik ───────────────────────────────────────────── */}
          <div className="stk-q stk-q--sm">
            <span className="stk-num" aria-hidden="true">2</span> {t("wl.step2")}
          </div>
          <div className={`wl-weight${fromScale ? " is-live" : ""}`} data-stable={stable ? "1" : "0"}>
            {fromScale ? (
              <>
                <span className="wl-weight__kg ek-num">{(Number(live?.kg) || 0).toFixed(3).replace(".", ",")}</span>
                <span className="wl-weight__unit">{t("wl.kg")}</span>
                <span className="wl-weight__state" role="status">
                  <i className={`fa-solid ${stable ? "fa-circle-check" : "fa-wave-square"}`} aria-hidden="true" />
                  {stable ? t("wl.stable") : t("wl.unstable")}
                </span>
              </>
            ) : (
              <>
                <NumField kind="qty" className="form-input ek-num wl-weight__input" value={manualKg}
                          aria-label={t("wl.weight")} placeholder="0.000"
                          onChange={(e) => setManualKg(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") print(); }} />
                <span className="wl-weight__unit">{t("wl.kg")}</span>
              </>
            )}
          </div>
          <div className="wl-src">
            {live ? (
              <button type="button" className="stk-manual" onClick={() => setManual((v) => !v)}>
                <i className={`fa-solid ${manual ? "fa-scale-balanced" : "fa-keyboard"}`} aria-hidden="true" />
                {manual ? t("wl.useScale") : t("wl.typeManual")}
              </button>
            ) : (
              <span className="stk-hint"><i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" /> {t("wl.noScale")}</span>
            )}
          </div>

          {/* ── 3. Jami va chop etish ─────────────────────────────────── */}
          <div className="wl-total">
            <span className="wl-total__l">{t("wl.total")}</span>
            <span className="wl-total__v ek-num">{money(total, { withUnit: true })}</span>
          </div>
          <div className="wl-go">
            <label className="wl-copies">
              <span>{t("wl.copies")}</span>
              <NumField kind="int" className="form-input ek-num" min={1} max={99} value={copies}
                        aria-label={t("wl.copies")} onChange={(e) => setCopies(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary wl-print" disabled={!product || kg <= 0 || busy}
                    onClick={() => print()}>
              {busy ? <Spinner small /> : <i className="fa-solid fa-print" aria-hidden="true" />} {t("wl.print")}
            </button>
          </div>
          {live && (
            <label className="wl-auto">
              <input type="checkbox" checked={auto}
                     onChange={(e) => { setAuto(e.target.checked); writeLS(AUTO_KEY, e.target.checked ? "1" : "0"); }} />
              <span>
                <span className="fw-700">{t("wl.auto")}</span>
                <span className="stk-hint wl-auto__h">{t("wl.autoHint")}</span>
              </span>
            </label>
          )}

          {error && (
            <div className="stk-alert" role="alert">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <div>
                <div>{error.text}</div>
                {error.detail && <div className="stk-alert__detail">{error.detail}</div>}
              </div>
            </div>
          )}
          {last && !error && (
            <div className="stk-note" role="status">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
              {t("wl.printed", { name: last.name, kg: weightText(last.kg), total: money(last.total, { withUnit: true }) })}
            </div>
          )}
        </div>

        {/* ── O'ng: ko'rinish, dizayn, printer ─────────────────────────── */}
        <div className="stk-side">
          <div className="card stk-card">
            <div className="stk-q stk-q--sm">{t("wl.preview")}</div>
            <div className="stk-preview">
              {previewSvg ? (
                /* eslint-disable-next-line react/no-danger */
                <div className="stk-preview__paper" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="stk-hint">{template ? t("wl.pickFirst") : t("wl.noTemplate")}</div>
              )}
            </div>
            {designs.length > 1 && (
              <div className="wl-designs" role="radiogroup" aria-label={t("wl.design")}>
                {designs.map((d) => (
                  <button key={d.id} type="button" role="radio" aria-checked={template?.id === d.id}
                          className={`stk-chip${template?.id === d.id ? " is-on" : ""}`}
                          onClick={() => { setTplId(d.id); writeLS(TPL_KEY, String(d.id)); }}>
                    {templateName(d)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="card stk-card stk-status">
            <i className={`fa-solid ${route === "bytes" ? "fa-bolt" : "fa-print"}`} aria-hidden="true" />
            <div className="stk-status__text">
              <div className="stk-status__name">{desktop ? queue : t("stk.printerInDialog")}</div>
              <div className="stk-hint">
                <span className="ek-num">{media ? `${Number(media.labelWidthMm)} × ${Number(media.labelHeightMm)}` : ""}</span> {t("stk.mm")}
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setInSetup(true)}>
              <i className="fa-solid fa-gear" aria-hidden="true" /> {t("stk.settings")}
            </button>
          </div>
          {onAdvanced && (
            <button type="button" className="stk-manual" onClick={onAdvanced}>
              <i className="fa-solid fa-sliders" aria-hidden="true" /> {t("stk.advanced")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
