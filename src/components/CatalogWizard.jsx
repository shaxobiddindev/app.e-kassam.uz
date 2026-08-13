import { useState, useEffect } from "react";
import { t, getLang } from "../lib/ek-i18n";
import { catalogApi, shopApi } from "../api";
import { BUSINESS_TYPE, businessType as btEntry } from "../lib/ek-labels";
import Modal from "./Modal";
import { Spinner } from "./ek/Loading";
import { NumField } from "./ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   Tayyor katalog ustasi.

   MUAMMO: yangi mijoz uchun eng katta to'siq — bo'sh baza. 500 ta tovarni
   qo'lda kiritish bir necha kunlik ish va ko'p do'kon aynan shu bosqichda
   tashlab ketadi.

   YECHIM: faoliyat turini tanlaydi → tayyor kategoriya daraxti va tipik
   tovarlar ro'yxati chiqadi → keraksizini belgidan chiqarib, bir bosishda
   qo'shadi.

   ⚠ IKKI QARORNI EGASI QABUL QILADI, biz taxmin qilmaymiz:
     1. QQS stavkasi — soliq rejimiga bog'liq, shablonda yozib qo'yish
        noto'g'ri fiskal chekka olib boradi;
     2. NARX — shablonda umuman yo'q, tovarlar narxsiz qo'shiladi.
   ══════════════════════════════════════════════════════════════════════════ */

export default function CatalogWizard({ onClose, onDone, toast }) {
  const lang = getLang();
  const [step, setStep] = useState("business");   // business → items → done
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState(null); // to'liq shablon
  const [selected, setSelected] = useState(new Set());
  const [vat, setVat] = useState("12");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    catalogApi.templates()
      .then((r) => setTemplates(r.data || []))
      .catch((e) => toast.error(e.message));
  }, []);

  const name = (obj, fallback) => (obj && (obj[lang] || obj.uz)) || fallback;

  const pickTemplate = async (row) => {
    setBusy(true);
    try {
      const res = await catalogApi.template(row.key);
      const full = res.data;
      setTemplate(full);
      // Standart — HAMMASI belgilangan. Do'kon egasi keraksizini olib
      // tashlaydi; teskarisi (bo'shdan boshlab 300 ta katakcha belgilash)
      // ro'yxatni qo'lda kiritishdan ko'ra ko'proq vaqt olardi.
      const all = new Set();
      (full.categories || []).forEach((c) =>
        (c.items || []).forEach((i) => all.add(`${full.key}:${c.key}:${i.key}`)));
      setSelected(all);
      // Faoliyat turini ham eslab qo'yamiz: keyin mahsulot formasi va kassa
      // ekrani shunga moslashadi.
      if (row.businessType) shopApi.setBusinessType(row.businessType).catch(() => {});
      setStep("items");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat) => {
    const keys = (cat.items || []).map((i) => `${template.key}:${cat.key}:${i.key}`);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const apply = async () => {
    setBusy(true);
    try {
      const res = await catalogApi.apply({
        templateKey: template.key,
        itemKeys: [...selected],
        defaultVatRate: vat === "" ? null : Number(vat),
      });
      const d = res.data || {};
      toast.success(t("catalog.applied", { products: d.productsCreated, categories: d.categoriesCreated }));
      if (d.skipped) toast.info(t("catalog.skipped", { n: d.skipped }));
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ── 1-qadam: faoliyat turi ── */
  if (step === "business") {
    return (
      <Modal title={t("catalog.title")} onClose={onClose}>
        <p className="form-hint" style={{ marginBottom: 14 }}>{t("catalog.businessHint")}</p>
        <div className="biz-grid">
          {templates.map((row) => {
            const e = btEntry(row.businessType);
            return (
              <button key={row.key} type="button" className="biz-card" onClick={() => pickTemplate(row)} disabled={busy}>
                <i className={`fa-solid ${e.icon || "fa-store"}`} aria-hidden="true" />
                <span className="biz-card__name">{name(row.name, row.key)}</span>
                <span className="biz-card__meta">
                  {t("catalog.categories", { n: row.categoryCount })} · {t("catalog.items", { n: row.itemCount })}
                </span>
              </button>
            );
          })}
          {templates.length === 0 && <Spinner />}
        </div>
      </Modal>
    );
  }

  /* ── 2-qadam: tovarlarni belgilash ── */
  return (
    <Modal
      title={name(template.name, template.key)}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={() => setStep("business")} disabled={busy}>
            <i className="fa-solid fa-arrow-left" /> {t("common.back")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={apply} disabled={busy || selected.size === 0}>
            {busy ? <Spinner /> : <i className="fa-solid fa-check" />}
            {busy ? t("catalog.applying") : `${t("catalog.apply")} (${selected.size})`}
          </button>
        </>
      }
    >
      <div className="ek-note" style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" /> {t("catalog.priceNote")}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="cat-vat">{t("catalog.vatQuestion")}</label>
        <NumField id="cat-vat" kind="percent" className="form-input ek-num"
               value={vat} onChange={(e) => setVat(e.target.value)} style={{ maxWidth: 140 }} />
        <div className="form-hint">{t("catalog.vatHint")}</div>
      </div>

      <div className="cat-tree">
        {(template.categories || []).map((c) => {
          const keys = (c.items || []).map((i) => `${template.key}:${c.key}:${i.key}`);
          const on = keys.filter((k) => selected.has(k)).length;
          return (
            <div key={c.key} className="cat-tree__group">
              <button type="button" className="cat-tree__head" onClick={() => toggleCategory(c)}>
                <i className={`fa-solid ${on === keys.length ? "fa-square-check" : on ? "fa-square-minus" : "fa-square"}`}
                   aria-hidden="true" />
                {c.icon && <i className={`fa-solid ${c.icon}`} aria-hidden="true" />}
                <span>{name(c.name, c.key)}</span>
                <span className="ek-num cat-tree__count">{on}/{keys.length}</span>
              </button>

              <div className="cat-tree__items">
                {(c.items || []).map((i) => {
                  const key = `${template.key}:${c.key}:${i.key}`;
                  const checked = selected.has(key);
                  return (
                    <label key={key} className={`cat-chip ${checked ? "on" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} />
                      {name(i.name, i.key)}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
