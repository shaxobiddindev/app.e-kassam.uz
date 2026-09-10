import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { labelApi, productApi } from "../api";
import { asArray } from "../lib/ek-array";
import { Empty, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { SkeletonList } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import LabelPreview from "../components/ek/LabelPreview";
import LabelTemplateEditor from "../components/ek/LabelTemplateEditor";
import LabelQueue from "../components/ek/LabelQueue";
import { calibrationDoc } from "../lib/ek-label-calibrate";
import { printHtml } from "../lib/ek-receipt-pdf";
import Modal from "../components/Modal";
import { useConfirm } from "../context/ConfirmProvider";
import { productCode } from "../lib/ek-code";
import { rankItems } from "../lib/ek-search";
import { money } from "../lib/ek-format";
import { templateName } from "../lib/ek-label-name";

/* ══════════════════════════════════════════════════════════════════════════
   YORLIQLAR — KO'RISH VA NAVBAT (F3 + F5)

   Ikki bo'lim: KO'RISH (shablon, tovar, haqiqiy o'lcham, sig'maslik)
   va NAVBAT (kun bo'yi to'ldiriladigan, saqlanadigan, uzilsa
   davom etadigan chop etish ro'yxati).

   ⚠ KO'RISHDA HAQIQIY TOVAR MA'LUMOTI. «Lorem ipsum» bilan hamma
   narsa chiroyli sig'adi; muammo esa aynan haqiqiy nomlarda chiqadi.
   Shuning uchun standart — birinchi tovar, va alohida tugma
   «eng uzun nomli tovarni ko'rsat»: sig'maslik muammosi aynan
   shunda ko'rinadi.
   ══════════════════════════════════════════════════════════════════════════ */

const KINDS = [
  { value: "SHELF",   labelKey: "lbl.kindShelf" },
  { value: "STICKER", labelKey: "lbl.kindSticker" },
];

export default function LabelsPage({ toast }) {
  const confirm = useConfirm();
  /* ⚠ MANZILDAN O'QILADI: bosh sahifadagi belgi «/labels?tab=stale»
     ga olib keladi va o'sha bo'lim DARHOL ochilishi kerak. Belgini
     bosgan odam yana bir marta bo'lim tanlashi — belgining ma'nosini
     yo'qotardi. */
  const [tab, setTab] = useState(() => {
    const want = new URLSearchParams(window.location.search).get("tab");
    return want === "queue" || want === "stale" ? want : "preview";
  });
  const [jobs, setJobs]           = useState([]);
  const [jobId, setJobId]         = useState(null);
  const [job, setJob]             = useState(null);
  const [categories, setCategories] = useState([]);
  const [stale, setStale] = useState(null);   // null = hali so'ralmadi
  const [editing, setEditing]     = useState(null); // null | {template|null}
  const [saving, setSaving]       = useState(false);
  const [kind, setKind]           = useState("SHELF");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [products, setProducts]   = useState([]);
  const [productId, setProductId] = useState(null);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const busy = useLoading(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, pRes, cRes] = await Promise.all([
        labelApi.templates(kind),
        productApi.getAll(),
        productApi.getCategories(),
      ]);
      setCategories(asArray(cRes.data));
      const list = asArray(tRes.data);
      setTemplates(list);
      setTemplateId((cur) => (list.some((x) => x.id === cur) ? cur : list[0]?.id ?? null));
      const prods = asArray(pRes.data);
      setProducts(prods);
      setProductId((cur) => (prods.some((p) => p.id === cur) ? cur : prods[0]?.id ?? null));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [kind, toast]);

  useEffect(() => { load(); }, [load]);

  /* ⚠ NAVBAT ALOHIDA YUKLANADI: shablon turi almashtirilganda
     (javon ↔ stiker) navbat qayta o'qilishi shart emas — u
     shablonga bog'liq emas. */
  const loadJobs = useCallback(async () => {
    try {
      const list = asArray((await labelApi.jobs()).data);
      setJobs(list);
      setJobId((cur) => (list.some((x) => x.id === cur) ? cur : list[0]?.id ?? null));
    } catch (err) { toast.error(err.message); }
  }, [toast]);

  useEffect(() => { if (tab === "queue") loadJobs(); }, [tab, loadJobs]);

  const loadStale = useCallback(async () => {
    try { setStale((await labelApi.stale(200)).data); }
    catch (err) { toast.error(err.message); }
  }, [toast]);

  useEffect(() => { if (tab === "stale") loadStale(); }, [tab, loadStale]);

  /**
   * Hammasini bir bosishda navbatga.
   *
   * ⚠ NAVBAT SAHIFASIGA O'TILADI. «Qo'shildi» degan xabar bilan
   * cheklanish do'konchini «endi qayerga bosay?» degan holatda
   * qoldirardi — ish esa hali qilinmagan: yorliq chiqarilmagan.
   */
  const queueStale = async () => {
    try {
      await labelApi.queueStale();
      toast.success(t("common.saved"));
      await loadJobs();
      await loadStale();
      setTab("queue");
    } catch (err) { toast.error(err.message); }
  };
  useEffect(() => { setJob(jobs.find((x) => x.id === jobId) || null); }, [jobs, jobId]);

  const newJob = async () => {
    try {
      const r = await labelApi.newJob({ templateId, startPosition: 1 });
      await loadJobs();
      setJobId(r.data.id);
    } catch (err) { toast.error(err.message); }
  };

  const removeJob = async (id) => {
    const okToDelete = await confirm({
      title: t("lbl.deleteJobConfirm"), type: "danger",
    });
    if (!okToDelete) return;
    try {
      await labelApi.dropJob(id);
      toast.success(t("common.deleted"));
      setJobId(null);
      loadJobs();
    } catch (err) { toast.error(err.message); }
  };

  const template = templates.find((x) => x.id === templateId) || null;
  const product  = products.find((p) => p.id === productId) || null;

  /* ⚠ ENG UZUN NOM — sig'maslik aynan shunda chiqadi. */
  const longest = useMemo(() => {
    let best = null;
    for (const p of products) {
      if (!best || String(p.name || "").length > String(best.name || "").length) best = p;
    }
    return best;
  }, [products]);

  const save = async (body) => {
    setSaving(true);
    try {
      if (editing?.template?.id) await labelApi.update(editing.template.id, body);
      else await labelApi.create(body);
      toast.success(t("common.saved"));
      setEditing(null);
      load();
    } catch (err) {
      /* ⚠ Server xatosi TO'LIQ ko'rsatiladi: u aynan qaysi maydon va
         necha mm ekanini aytadi. Uni «saqlanmadi» ga almashtirish
         do'konchini taxmin qilishga majbur qilardi. */
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyTemplate = async (id) => {
    try {
      const r = await labelApi.copy(id);
      toast.success(t("common.saved"));
      await load();
      setEditing({ template: r.data });
    } catch (err) { toast.error(err.message); }
  };

  const removeTemplate = async (tpl) => {
    const okToDelete = await confirm({
      title: t("lbl.deleteConfirm"), message: templateName(tpl), type: "danger",
    });
    if (!okToDelete) return;
    try {
      await labelApi.remove(tpl.id);
      toast.success(t("common.deleted"));
      load();
    } catch (err) { toast.error(err.message); }
  };

  /**
   * SINOV VARAG'I (F7).
   *
   * ⚠ SAHIFA SARLAVHASIDA, navbat ichida emas. U aynan «yorliqlarim
   * noto'g'ri o'lchamda chiqyapti» deganda kerak bo'ladi, va o'sha
   * paytda navbat umuman bo'lmasligi mumkin. Tugma navbat ichida
   * tursa, muammoga duch kelgan odam uni topa olmasdi.
   */
  const calibrate = async () => {
    try {
      const doc = calibrationDoc({
        dpi: Number(template?.dpi) || 203,
        labels: {
          title: t("lbl.calTitle"),
          subtitle: t("lbl.calSubtitle"),
          hint: t("lbl.calHint"),
          dpi: t("lbl.calDpi"),
        },
      });
      await printHtml(doc.html, t("lbl.calTitle"), doc.css, "width=980,height=800");
    } catch (err) { toast.error(err.message); }
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

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <h2 className="page-title">{t("lbl.title")}</h2>
        <div className="cat-tabs" role="group">
          <button type="button" className={`cat-tab ${tab === "preview" ? "active" : ""}`}
                  aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>
            <i className="fa-solid fa-eye" /> {t("lbl.tabPreview")}
          </button>
          <button type="button" className={`cat-tab ${tab === "queue" ? "active" : ""}`}
                  aria-pressed={tab === "queue"} onClick={() => setTab("queue")}>
            <i className="fa-solid fa-list-check" /> {t("lbl.tabQueue")}
          </button>
          {/* ⚠ SON TUGMADA: «qayta chop etish kerak» bo'limiga kirmasdan
              turib ham ish borligi ko'rinsin. */}
          <button type="button" className={`cat-tab ${tab === "stale" ? "active" : ""}`}
                  aria-pressed={tab === "stale"} onClick={() => setTab("stale")}>
            <i className="fa-solid fa-tag" /> {t("lbl.tabStale")}
            {stale?.count > 0 && (
              <span className="alr__chip" data-tone="warning"
                    style={{ marginInlineStart: 6 }}>{stale.count}</span>
            )}
          </button>
        </div>
        {/* ⚠ HAR BO'LIMDA KO'RINADI: chop etish o'lchami muammosi
            navbat bor-yo'qligiga bog'liq emas. */}
        <button type="button" className="btn btn-outline btn-sm" onClick={calibrate}>
          <i className="fa-solid fa-ruler" /> {t("lbl.calPrint")}
        </button>
      </div>

      {tab === "stale" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-tag text-blue" /> {t("lbl.tabStale")}
            </span>
            {stale?.count > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={queueStale}>
                <i className="fa-solid fa-list-check" />
                {" "}{t("lbl.queueAllStale", { n: stale.count })}
              </button>
            )}
          </div>

          {/* ⚠ SABABI YOZILADI, ro'yxatning o'zi yetarli emas: nega bu
              tovarlar bu yerda turibdi va nima qilish kerakligi
              ko'rinib tursin. */}
          <p className="set-card__hint">{t("lbl.staleHint")}</p>

          {!stale ? <SkeletonList rows={4} avatar={false} />
            : stale.count === 0 ? (
              <Empty icon="fa-circle-check" text={t("lbl.staleNone")} />
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("products.name")}</th>
                        <th className="ek-num">{t("lbl.code")}</th>
                        <th className="ek-num">{t("lbl.onShelf")}</th>
                        <th className="ek-num">{t("lbl.atTill")}</th>
                        <th className="ek-num">{t("lbl.diff")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stale.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.name}</td>
                          <td className="ek-num">{it.code || "—"}</td>
                          {/* ⚠ JAVONDAGI narx chizib tashlanadi: u endi
                              to'g'ri emas va buni bir qarashda ko'rish kerak. */}
                          <td className="ek-num"><s>{money(it.printedPrice, { withUnit: true })}</s></td>
                          <td className="ek-num"><b>{money(it.salePrice, { withUnit: true })}</b></td>
                          <td className="ek-num" style={{
                            color: Number(it.diff) > 0 ? "var(--fg-danger)" : "var(--fg-success)",
                          }}>
                            {Number(it.diff) > 0 ? "+" : ""}{money(it.diff, { withUnit: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {stale.count > stale.shown && (
                  <div className="form-hint">
                    {t("lbl.staleMore", { n: stale.count - stale.shown })}
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {tab === "queue" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-list-check text-blue" /> {t("lbl.tabQueue")}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {jobs.length > 0 && (
                <Select
                  variant="field" ariaLabel={t("lbl.job")}
                  value={jobId} onChange={setJobId}
                  options={jobs.map((j) => ({
                    value: j.id,
                    label: t(`lbl.status.${j.status}`) + " · " + t("lbl.jobN", { id: j.id }),
                    hint: String(j.remainingLabels),
                  }))}
                />
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={newJob}>
                <i className="fa-solid fa-plus" /> {t("lbl.newJob")}
              </button>
              {job && (
                <button type="button" className="btn-icon danger"
                        aria-label={t("common.delete")}
                        onClick={() => removeJob(job.id)}>
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>
          </div>

          {job ? (
            <LabelQueue
              job={job} templates={templates} products={products}
              categories={categories} toast={toast}
              onChange={(next) => {
                if (!next) { loadJobs(); return; }
                setJob(next);
                setJobs((list) => list.map((x) => (x.id === next.id ? next : x)));
              }}
            />
          ) : (
            <Empty icon="fa-list-check" text={t("lbl.noJob")} />
          )}
        </div>
      )}

      {tab === "preview" && (
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-tag text-blue" /> {t("lbl.preview")}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                className={`btn btn-sm ${kind === k.value ? "btn-primary" : "btn-outline"}`}
                onClick={() => setKind(k.value)}
              >
                {t(k.labelKey)}
              </button>
            ))}
            <button type="button" className="btn btn-primary btn-sm"
                    onClick={() => setEditing({ template: null })}>
              <i className="fa-solid fa-plus" /> {t("lbl.newTemplate")}
            </button>
          </div>
        </div>

        {busy ? <SkeletonList rows={4} avatar={false} /> : templates.length === 0 ? (
          <Empty icon="fa-tag" text={t("lbl.noTemplates")} />
        ) : (
          <div className="lbl-layout">
            <div className="lbl-side">
              <label className="form-label" htmlFor="lbl-tpl">{t("lbl.template")}</label>
              <Select
                id="lbl-tpl" block variant="field" ariaLabel={t("lbl.template")}
                value={templateId} onChange={setTemplateId}
                options={templates.map((x) => ({
                  value: x.id,
                  label: templateName(x),
                  hint: `${Number(x.widthMm)}×${Number(x.heightMm)}`,
                }))}
              />

              <label className="form-label" style={{ marginTop: 12 }}>{t("lbl.product")}</label>
              <SearchBar value={search} onChange={setSearch}
                         placeholder={t("products.search")} />
              <div style={{ marginTop: 6 }}>
                <Select
                  block variant="field" ariaLabel={t("lbl.product")}
                  value={productId} onChange={setProductId} options={options}
                />
              </div>

              {/* ⚠ TIZIM SHABLONIDA «tahrirlash» KO'RSATILMAYDI — bosib
                  bo'lmaydigan tugma o'rniga sababi va chiqish yo'li. */}
              {template && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {template.system ? (
                    <button type="button" className="btn btn-outline btn-sm"
                            onClick={() => copyTemplate(template.id)}>
                      <i className="fa-solid fa-copy" /> {t("lbl.copyEdit")}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn btn-outline btn-sm"
                              onClick={() => setEditing({ template })}>
                        <i className="fa-solid fa-pen" /> {t("lbl.edit")}
                      </button>
                      <button type="button" className="btn-icon danger"
                              aria-label={t("common.delete")}
                              onClick={() => removeTemplate(template)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {template?.system && (
                <div className="form-hint">{t("lbl.systemReadonly")}</div>
              )}

              {/* ⚠ Sig'maslik muammosi aynan eng uzun nomda chiqadi. */}
              {longest && (
                <button type="button" className="btn btn-outline btn-sm"
                        style={{ marginTop: 10, width: "100%" }}
                        onClick={() => setProductId(longest.id)}>
                  <i className="fa-solid fa-text-width" /> {t("lbl.showLongest")}
                </button>
              )}
            </div>

            <div className="lbl-main">
              {product ? (
                <LabelPreview template={template} product={product} />
              ) : (
                <Empty icon="fa-box-open" text={t("lbl.noProducts")} />
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {editing && (
        <Modal
          title={editing.template ? t("lbl.editTemplate") : t("lbl.newTemplate")}
          onClose={() => setEditing(null)}
          maxWidth={1040}
        >
          <LabelTemplateEditor
            template={editing.template}
            product={product}
            saving={saving}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}