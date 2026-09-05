/* ══════════════════════════════════════════════════════════════════════════
   Narxlar — ommaviy o'zgartirish va tarix

   «Marja nega tushdi?» — eng ko'p beriladigan savol va unga javob yo'q edi:
   tovarda faqat joriy narx turardi. Endi har o'zgarish (qo'lda tahrir,
   kirim hujjati, ommaviy amal) kim va qachon qilgani bilan yoziladi.

   ⚠ Ommaviy o'zgartirish ORTGA QAYTARILMAYDI, shuning uchun oldin
   «Ko'rish» (dryRun) — hech narsa o'zgarmasdan natija ko'rsatiladi.
   "+5%" deb yozib butun katalogni o'zgartirib qo'yish juda oson.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { productApi } from "../api";
import { Empty, Field, FormGroup } from "../components/ui";
import Select from "../components/ek/Select";
import { money } from "../lib/ek-format";
import { useConfirm } from "../context/ConfirmProvider";
import { useOnline } from "../hooks/useOnline";
import { useBadge } from "../context/BadgeProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";

const fmtT = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function PricesPage({ toast }) {
  const confirm = useConfirm();
  const { guard } = useBadge();
  const online = useOnline();
  const [cats, setCats] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ categoryId: "", mode: "percent", value: "", roundTo: "100" });
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, h] = await Promise.all([
        productApi.getCategories().catch(() => ({ data: [] })),
        productApi.shopPriceHistory(),
      ]);
      setCats(c.data || []);
      setHistory(h.data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const payload = (dryRun) => ({
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    percent: form.mode === "percent" ? Number(form.value) : null,
    amount: form.mode === "amount" ? Number(form.value) : null,
    roundTo: form.roundTo ? Number(form.roundTo) : null,
    dryRun,
  });

  const doPreview = async () => {
    setSaving(true);
    try {
      const r = await productApi.bulkPrice(payload(true));
      setPreview(r.data);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    /* ⚠ OFLAYNDA TAQIQ: narx o'zgarishi butun do'konga va boshqa
       kassalarga tegadi. Oflaynda uni "keyin yuborish" ham mumkin emas —
       shu orada sotuvlar ESKI narxda o'tib ketardi va oxirida qaysi chek
       qaysi narxda ekani chalkashardi. */
    if (!online) { toast?.error(t("offline.actionBlocked")); return; }
    const ok = await confirm({
      title: t("price.applyTitle"),
      message: t("price.applyConfirm").replace("{n}", preview.count),
      type: "warning",
      confirmText: t("price.apply"),
    });
    if (!ok) return;
    setSaving(true);
    try {
      // Bajik BIR MARTA — butun amal uchun; server 428 qaytarsa `guard`
      // oynani ochib, tasdiqdan keyin so'rovni o'zi qayta yuboradi.
      const r = await guard(() => productApi.bulkPrice(payload(false)));
      toast?.success(r.message);
      setPreview(null);
      await load();
    } catch (err) {
      if (!err?.cancelled) toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const valid = form.value !== "" && Number(form.value) !== 0;

  /* ══ USTUNLAR BO'YICHA FILTR (V68) — narx tarixi ══════════════════
     ⚠ Narx ustunlari YANGI qiymat bo'yicha filtrlanadi: «kim narxni
     100 mingdan oshirdi?» degan savol yangi narx haqida. Eskisi
     ekranda yonida turadi va uni alohida ustun qilish jadvalni
     ikki barobar kengaytirardi. */
  const HCOLS = useMemo(() => [
    { key: "date",  label: t("common.date"),        type: "date",   get: (h) => h.createdAt },
    { key: "prod",  label: t("products.col"),       type: "text",   get: (h) => h.productName },
    { key: "price", label: t("price.salePrice"),    type: "number", get: (h) => h.newSalePrice },
    { key: "cost",  label: t("dash.costPrice"),     type: "number", get: (h) => h.newCostPrice },
    { key: "why",   label: t("inv.reason"),         type: "text",   get: (h) => h.reason },
    { key: "who",   label: t("sales.colCashier"),   type: "text",   get: (h) => h.changedBy },
  ], []);
  const hFlt = useDataFilter(HCOLS, "prices");
  const shownHistory = hFlt.apply(history);

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 18 }}>{t("price.title")}</h2>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-tags text-blue" /> {t("price.bulkTitle")}
          </span>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <FormGroup label={t("price.scope")}>
              <Select block variant="field" ariaLabel={t("price.scope")}
                      searchable searchPlaceholder={t("common.searchShort")}
                      value={form.categoryId}
                      onChange={(v) => { setForm({ ...form, categoryId: v }); setPreview(null); }}
                      options={[{ value: "", label: t("price.allProducts"), icon: "fa-boxes-stacked" },
                        ...cats.map((c) => ({ value: String(c.id), label: c.name, icon: "fa-tag" }))]} />
            </FormGroup>
            <FormGroup label={t("price.changeType")}>
              <Select block variant="field" ariaLabel={t("price.changeType")}
                      value={form.mode}
                      onChange={(v) => { setForm({ ...form, mode: v }); setPreview(null); }}
                      options={[
                        { value: "percent", label: t("price.byPercent"), icon: "fa-percent" },
                        { value: "amount", label: t("price.byAmount"), icon: "fa-coins" },
                      ]} />
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label={form.mode === "percent" ? t("price.percentValue") : t("price.amountValue")}>
              {/* Manfiy qiymat ham to'g'ri: "-10%" chegirma mavsumida
                  kerak bo'ladi, shuning uchun `min` qo'yilmagan. */}
              <Field kind="signed" className="form-input ek-num"
                     value={form.value}
                     onChange={(e) => { setForm({ ...form, value: e.target.value }); setPreview(null); }} />
            </FormGroup>
            <FormGroup label={t("price.roundTo")}>
              <Field kind="int" className="form-input ek-num"
                     value={form.roundTo}
                     onChange={(e) => { setForm({ ...form, roundTo: e.target.value }); setPreview(null); }} />
            </FormGroup>
          </div>
          <p className="form-hint" style={{ marginTop: 0 }}>{t("price.previewHint")}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={doPreview} disabled={saving || !valid}>
              {saving ? <Spinner /> : <i className="fa-solid fa-eye" />} {t("price.preview")}
            </button>
            <button className="btn btn-primary btn-sm" onClick={apply}
                    disabled={saving || !preview || preview.count <= (preview.blockedCount || 0)}>
              <i className="fa-solid fa-check" /> {t("price.apply")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Oldindan ko'rish ────────────────────────────────────────────── */}
      {preview && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-eye text-blue" /> {t("price.preview")} ({preview.count})
            </span>
          </div>
          {/* ⚠ O'TKAZIB YUBORILGAN TOVARLAR (V53). Yangi narx tan yoki
              optom narxdan past bo'lib qolsa, o'sha tovar O'ZGARMAYDI.
              Buni JIMGINA qilish mumkin emas edi: do'kon egasi
              «hammasiga −20%» deb qo'yib, bir necha tovar o'zgarmaganini
              faqat oy oxirida bilib qolardi. */}
          {preview.blockedCount > 0 && (
            <div className="ek-note ek-note--warn" style={{ margin: "0 16px 12px" }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <div>{t("price.blockedCount").replace("{n}", preview.blockedCount)}</div>
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("price.oldPrice")}</th>
                  <th>{t("price.newPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => (
                  <tr key={l.productId} style={l.blocked ? { opacity: .65 } : undefined}>
                    <td className="fw-700">{l.productName}</td>
                    <td className="mono text-muted">{money(l.oldPrice)}</td>
                    {l.blocked ? (
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        <i className="fa-solid fa-ban" aria-hidden="true" />{" "}
                        {l.blockReason || t("price.blocked")}
                      </td>
                    ) : (
                      <td className="mono fw-800"
                          style={{ color: Number(l.newPrice) >= Number(l.oldPrice) ? "var(--fg-success)" : "var(--fg-danger)" }}>
                        {money(l.newPrice)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tarix ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa-solid fa-clock-rotate-left text-blue" /> {t("price.history")}
          </span>
          <DataFilter cols={HCOLS} flt={hFlt} />
        </div>
        <div className="table-wrap">
          {busy ? <SkeletonTable rows={6} cols={["wide", "num", "num", "text"]} /> : (
            <table>
              <thead>
                <tr>
                  <SortTh flt={hFlt} col="date">{t("common.date")}</SortTh>
                  <SortTh flt={hFlt} col="prod">{t("products.col")}</SortTh>
                  <SortTh flt={hFlt} col="price">{t("price.salePrice")}</SortTh>
                  <SortTh flt={hFlt} col="cost">{t("dash.costPrice")}</SortTh>
                  <SortTh flt={hFlt} col="why">{t("inv.reason")}</SortTh>
                  <SortTh flt={hFlt} col="who">{t("sales.colCashier")}</SortTh>
                </tr>
              </thead>
              <tbody>
                {shownHistory.length ? shownHistory.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 13 }}>{fmtT(h.createdAt)}</td>
                    <td className="fw-700">{h.productName}</td>
                    {/* Faqat HAQIQATAN o'zgargan narx ko'rsatiladi: ikkalasi
                        ham chizilsa, o'zgarmagani ham "o'zgardi" bo'lib
                        ko'rinardi. */}
                    <td className="mono">
                      {String(h.oldSalePrice) !== String(h.newSalePrice)
                        ? <><span className="text-muted">{money(h.oldSalePrice)}</span>
                            {" → "}<span className="fw-800">{money(h.newSalePrice)}</span></>
                        : "—"}
                    </td>
                    <td className="mono">
                      {String(h.oldCostPrice) !== String(h.newCostPrice)
                        ? <><span className="text-muted">{money(h.oldCostPrice)}</span>
                            {" → "}<span className="fw-800">{money(h.newCostPrice)}</span></>
                        : "—"}
                    </td>
                    <td className="text-muted" style={{ fontSize: 13 }}>{h.reason || "—"}</td>
                    <td className="mono text-muted" style={{ fontSize: 13 }}>{h.changedBy}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6}><Empty icon="fa-tags" text={t("price.noHistory")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
