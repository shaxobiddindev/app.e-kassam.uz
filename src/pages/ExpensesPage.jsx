/* ══════════════════════════════════════════════════════════════════════════
   Xarajatlar

   Nega kerak: hisobotdagi foyda `tushum − tovar tannarxi` edi, ya'ni ijara,
   oylik, transport va kommunal UMUMAN hisobga olinmasdi. Panel
   ko'rsatayotgan raqam haqiqiy foydadan katta chiqardi — zarar ko'rilayotgan
   oy foydali bo'lib ko'rinishi mumkin edi.

   ⚠ «Kassadan to'landi» belgilansa, server naqd harakati (WITHDRAWAL)
   yaratadi va smenaning kutilgan naqdi kamayadi. Aks holda kassadan pul
   chiqib ketardi-yu, smena yopilishida sababsiz kamomad chiqardi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { expenseApi } from "../api";
import { Modal } from "../components";
import { Empty, Field, FormGroup } from "../components/ui";
import Select from "../components/ek/Select";
import { money } from "../lib/ek-format";
import { useConfirm } from "../context/ConfirmProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { DateField } from "../components/ek/EkFields";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";

/** Oyning birinchi kuni va bugun — `YYYY-MM-DD`. */
const monthRange = () => {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return [
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`,
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
  ];
};

export default function ExpensesPage({ toast }) {
  const confirm = useConfirm();
  const [range, setRange] = useState(monthRange);
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);      // { categoryId, amount, spentAt, note, fromRegister }
  const [newCat, setNewCat] = useState(null);  // { name }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, c] = await Promise.all([
        expenseApi.list(range[0], range[1]),
        expenseApi.categories(),
      ]);
      setData(list.data);
      setCats(c.data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    const active = cats.filter((c) => c.active);
    setForm({
      categoryId: active[0]?.id ?? "",
      amount: "",
      spentAt: range[1],
      note: "",
      fromRegister: false,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await expenseApi.create({
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        spentAt: form.spentAt,
        note: form.note || null,
        fromRegister: form.fromRegister,
      });
      toast?.success(t("common.saved"));
      setForm(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCat = async () => {
    setSaving(true);
    try {
      await expenseApi.createCategory(newCat.name.trim());
      setNewCat(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e) => {
    const ok = await confirm({
      title: t("expense.deleteTitle"),
      // Kassadan to'langan bo'lsa naqd harakati ham qaytariladi — buni
      // aytib qo'yamiz, aks holda kassa raqamining o'zgarishi kutilmagan
      // bo'lardi.
      message: e.fromRegister ? t("expense.deleteFromRegister") : t("expense.deleteConfirm"),
      type: "danger",
    });
    if (!ok) return;
    try {
      await expenseApi.delete(e.id);
      await load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═════════════════════════════════
     «Manba» — RO'YXAT (kassadan / tashqaridan): bu ikkitadan biri va
     matn qidiruvi bunda ortiqcha ish bo'lardi. */
  const COLS = useMemo(() => [
    { key: "date", label: t("common.date"),      type: "date",   get: (e) => e.spentAt },
    { key: "cat",  label: t("expense.category"), type: "text",   get: (e) => e.categoryName },
    { key: "sum",  label: t("common.sum"),       type: "number", get: (e) => e.amount },
    { key: "src",  label: t("expense.source"),   type: "enum",
      options: [{ value: "reg", label: t("expense.fromRegister") },
                { value: "out", label: t("expense.fromOutside") }],
      get: (e) => (e.fromRegister ? "reg" : "out") },
    { key: "note", label: t("inv.reason"),       type: "text",   get: (e) => e.note },
  ], []);
  const colFlt = useDataFilter(COLS, "expenses");
  const items = colFlt.apply(data?.items || []);

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("expense.title")}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <DateField className="form-input ek-num" style={{ width: 150 }}
                 value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} />
          <span className="text-muted">—</span>
          <DateField className="form-input ek-num" style={{ width: 150 }}
                 value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} />
          <button className="btn btn-outline btn-sm" onClick={() => setNewCat({ name: "" })}>
            <i className="fa-solid fa-tag" /> {t("expense.newCategory")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> {t("expense.add")}
          </button>
        </div>
      </div>

      {busy ? <SkeletonTable rows={6} cols={["text", "wide", "num", "narrow"]} /> : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-chart-pie text-blue" /> {t("expense.byCategory")}
              </span>
              <span className="mono fw-800">{money(data?.total)}</span>
            </div>
            <div className="card-body">
              {data?.byCategory?.length ? data.byCategory.map((c) => (
                <div key={c.categoryName} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="fw-700" style={{ fontSize: 13 }}>{c.categoryName}</span>
                  <span className="mono fw-700">{money(c.amount)}</span>
                </div>
              )) : <Empty text={t("expense.none")} />}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-list text-blue" /> {t("expense.title")}
                <span className="text-muted" style={{ marginLeft: 8, fontWeight: 600 }}>
                  {items.length}
                </span>
              </span>
              <DataFilter cols={COLS} flt={colFlt} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortTh flt={colFlt} col="date">{t("common.date")}</SortTh>
                    <SortTh flt={colFlt} col="cat">{t("expense.category")}</SortTh>
                    <SortTh flt={colFlt} col="sum">{t("common.sum")}</SortTh>
                    <SortTh flt={colFlt} col="src">{t("expense.source")}</SortTh>
                    <SortTh flt={colFlt} col="note">{t("inv.reason")}</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? items.map((e) => (
                    <tr key={e.id}>
                      <td className="mono" style={{ fontSize: 13 }}>{e.spentAt}</td>
                      <td className="fw-700">{e.categoryName}</td>
                      <td className="mono fw-700">{money(e.amount)}</td>
                      <td>
                        <span className={`badge badge-${e.fromRegister ? "orange" : "blue"}`}>
                          {e.fromRegister ? t("expense.fromRegister") : t("expense.fromOutside")}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: 13 }}>{e.note || "—"}</td>
                      <td>
                        <button className="btn-icon danger" onClick={() => remove(e)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}><Empty icon="fa-receipt" text={t("expense.none")} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Yangi xarajat ──────────────────────────────────────────────── */}
      {form && (
        <Modal
          title={t("expense.add")}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={save}
                      disabled={saving || !form.categoryId || !(Number(form.amount) > 0)}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={t("expense.category")}>
            <Select block variant="field" ariaLabel={t("expense.category")}
                    searchable searchPlaceholder={t("common.searchShort")}
                    value={String(form.categoryId)}
                    onChange={(v) => setForm({ ...form, categoryId: v })}
                    options={cats.filter((c) => c.active)
                      .map((c) => ({ value: String(c.id), label: c.name, icon: "fa-tag" }))} />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label={t("common.sum")}>
              <Field kind="money" className="form-input ek-num" autoFocus
                     value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </FormGroup>
            <FormGroup label={t("common.date")}>
              {/* Xarajat SANASI — yozilgan vaqt emas: kecha to'langan
                  ijarani ertalab kiritish odatiy hol. */}
              <DateField className="form-input ek-num"
                     value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} />
            </FormGroup>
          </div>
          <FormGroup label={t("inv.reason")}>
            <Field maxLength={500} className="form-input" value={form.note}
                   onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </FormGroup>
          {/* ⚠ Bu belgi kassaga TA'SIR QILADI — shuning uchun izohi bilan. */}
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={form.fromRegister} style={{ marginTop: 3 }}
                   onChange={(e) => setForm({ ...form, fromRegister: e.target.checked })} />
            <span>
              <span className="fw-700">{t("expense.fromRegister")}</span>
              <span className="text-muted" style={{ display: "block", fontSize: 12 }}>
                {t("expense.fromRegisterHint")}
              </span>
            </span>
          </label>
        </Modal>
      )}

      {/* ── Yangi turkum ───────────────────────────────────────────────── */}
      {newCat && (
        <Modal
          title={t("expense.newCategory")}
          onClose={() => setNewCat(null)}
          maxWidth={400}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setNewCat(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={saveCat} disabled={saving || !newCat.name.trim()}>
                <i className="fa-solid fa-check" /> {t("common.save")}
              </button>
            </>
          }
        >
          <Field className="form-input" autoFocus value={newCat.name}
                 placeholder={t("expense.categoryPlaceholder")}
                 onKeyDown={(e) => e.key === "Enter" && newCat.name.trim() && saveCat()}
                 onChange={(e) => setNewCat({ name: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}
