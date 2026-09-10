import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { labelApi, productApi } from "../api";
import { asArray } from "../lib/ek-array";
import { Empty, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { SkeletonList } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import LabelPreview from "../components/ek/LabelPreview";
import { productCode } from "../lib/ek-code";
import { rankItems } from "../lib/ek-search";

/* ══════════════════════════════════════════════════════════════════════════
   YORLIQLAR — KO'RISH (F3)

   Bu bosqichda faqat KO'RISH: shablonni tanlash, tovarni tanlash,
   yorliqni haqiqiy o'lchamda ko'rish va sig'maslikni bilish. Navbat
   va chop etish F5 da.

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
      const [tRes, pRes] = await Promise.all([
        labelApi.templates(kind),
        productApi.getAll(),
      ]);
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
      </div>

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
                  label: x.name,
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
    </div>
  );
}
