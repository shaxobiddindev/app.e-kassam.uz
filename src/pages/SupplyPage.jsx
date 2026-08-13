/* ══════════════════════════════════════════════════════════════════════════
   Kirim va yetkazib beruvchilar

   Ilgari kirim faqat tovar bo'yicha bittalab kiritilardi va "bugun kim nima
   olib keldi, qancha turdi, qancha qarzim qoldi" degan savolga javob yo'q
   edi. Nasiya (mijoz qarzi) qurilgan-u, uning ko'zgusi — yetkazib
   beruvchiga qarz — yo'q edi.

   ⚠ Hujjatda «naqd to'landi» ko'rsatilsa, pul smena kassasidan CHIQADI —
   mijoz qarzini to'lashning teskarisi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { supplyApi, productApi } from "../api";
import { Modal } from "../components";
import { Empty, Field, FormGroup } from "../components/ui";
import Select from "../components/ek/Select";
import { money } from "../lib/ek-format";
import { paymentLabel } from "../lib/ek-labels";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { NumField } from "../components/ek/EkFields";

const today = () => new Date().toISOString().slice(0, 10);

export default function SupplyPage({ toast }) {
  const [tab, setTab] = useState("receipts");     // receipts | suppliers
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);         // yangi hujjat
  const [newSup, setNewSup] = useState(null);     // yangi yetkazib beruvchi
  const [pay, setPay] = useState(null);           // { supplier, amount, method, ledger }
  const [view, setView] = useState(null);         // hujjat tafsiloti

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([supplyApi.receipts(), supplyApi.suppliers()]);
      setReceipts(r.data || []);
      setSuppliers(s.data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* ── Hujjat ───────────────────────────────────────────────────────── */

  const openNew = () => {
    const active = suppliers.filter((s) => s.active);
    if (!active.length) { setNewSup({ name: "", phone: "" }); return; }
    setForm({
      supplierId: String(active[0].id),
      docNumber: "",
      receivedAt: today(),
      note: "",
      paidNow: "",
      paymentMethod: "CASH",
      lines: [],
      code: "",
    });
  };

  /* Barkod → tovar. `scan` qadoq va tarozi barkodini ham hal qiladi. */
  const addLine = async () => {
    const code = form.code.trim();
    if (!code) return;
    try {
      const r = await productApi.scan(code);
      const p = r?.data?.product;
      if (!p) { toast?.error(t("common.notFound")); return; }
      setForm((f) => ({
        ...f,
        code: "",
        lines: [...f.lines, {
          productId: p.id, productName: p.name,
          quantity: "1",
          // Tannarx oxirgi ma'lum qiymatdan boshlanadi — ko'p hollarda
          // o'zgarmaydi va har safar qayta yozish ortiqcha ish bo'lardi.
          costPrice: p.costPrice != null ? String(p.costPrice) : "",
          expiryDate: "",
        }],
      }));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const setLine = (i, key, value) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }));
  const dropLine = (i) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const formTotal = (form?.lines || []).reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.costPrice) || 0), 0);

  const saveReceipt = async () => {
    setSaving(true);
    try {
      await supplyApi.createReceipt({
        supplierId: Number(form.supplierId),
        docNumber: form.docNumber || null,
        receivedAt: form.receivedAt,
        note: form.note || null,
        paidNow: Number(form.paidNow) || 0,
        paymentMethod: form.paymentMethod,
        lines: form.lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          costPrice: Number(l.costPrice),
          expiryDate: l.expiryDate || null,
        })),
      });
      toast?.success(t("supply.saved"));
      setForm(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Yetkazib beruvchi ────────────────────────────────────────────── */

  const saveSupplier = async () => {
    setSaving(true);
    try {
      await supplyApi.createSupplier({ name: newSup.name.trim(), phone: newSup.phone || null });
      setNewSup(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPay = async (s) => {
    setPay({ supplier: s, amount: "", method: "CASH", ledger: null });
    try {
      const r = await supplyApi.ledger(s.id);
      setPay((p) => (p && p.supplier.id === s.id ? { ...p, ledger: r.data || [] } : p));
    } catch (_) { /* jurnal kelmasa ham to'lov qabul qilinaveradi */ }
  };

  const submitPay = async () => {
    setSaving(true);
    try {
      const r = await supplyApi.pay(pay.supplier.id, {
        amount: Number(pay.amount), method: pay.method, reason: null,
      });
      toast?.success(`${t("supply.debtLeft")}: ${money(r.data)}`);
      setPay(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("supply.title")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setNewSup({ name: "", phone: "" })}>
            <i className="fa-solid fa-truck" /> {t("supply.newSupplier")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <i className="fa-solid fa-plus" /> {t("supply.newReceipt")}
          </button>
        </div>
      </div>

      <div className="cat-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {[["receipts", t("supply.receipts")], ["suppliers", t("supply.suppliers")]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k}
                  className={`cat-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {busy ? <SkeletonTable rows={6} cols={["text", "wide", "num", "narrow"]} /> : (
        <div className="card">
          <div className="table-wrap">
            {tab === "receipts" ? (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("common.date")}</th>
                    <th>{t("supply.supplier")}</th>
                    <th>{t("supply.docNumber")}</th>
                    <th>{t("common.sum")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length ? receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td className="mono" style={{ fontSize: 13 }}>{r.receivedAt}</td>
                      <td className="fw-700">{r.supplierName}</td>
                      <td className="mono text-muted" style={{ fontSize: 13 }}>{r.docNumber || "—"}</td>
                      <td className="mono fw-700">{money(r.totalAmount)}</td>
                      <td>
                        <button className="btn-icon" title={t("common.details")} onClick={() => setView(r)}>
                          <i className="fa-solid fa-eye" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}><Empty icon="fa-truck-ramp-box" text={t("supply.noReceipts")} /></td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("supply.supplier")}</th>
                    <th>{t("common.phone")}</th>
                    <th>{t("supply.debt")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length ? suppliers.map((s) => (
                    <tr key={s.id} style={s.active ? undefined : { opacity: 0.5 }}>
                      <td className="fw-700">{s.name}</td>
                      <td className="mono" style={{ fontSize: 13 }}>{s.phone || "—"}</td>
                      {/* Qarz MUSBAT bo'lsa qizil: bu bizning to'lanmagan
                          majburiyatimiz va ko'zga tashlanishi kerak. */}
                      <td>
                        {Number(s.balance) > 0
                          ? <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(s.balance)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        {Number(s.balance) > 0 && (
                          <button className="btn btn-outline btn-sm" onClick={() => openPay(s)}>
                            <i className="fa-solid fa-money-bill-transfer" /> {t("supply.pay")}
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}><Empty icon="fa-truck" text={t("supply.noSuppliers")} /></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Yangi hujjat ───────────────────────────────────────────────── */}
      {form && (
        <Modal
          title={t("supply.newReceipt")}
          onClose={() => setForm(null)}
          maxWidth={760}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={saveReceipt}
                      disabled={saving || !form.lines.length
                                || form.lines.some((l) => !(Number(l.quantity) > 0) || l.costPrice === "")}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("common.save")}
              </button>
            </>
          }
        >
          <div className="grid-2">
            <FormGroup label={t("supply.supplier")}>
              <Select block variant="field" ariaLabel={t("supply.supplier")}
                      value={form.supplierId}
                      onChange={(v) => setForm({ ...form, supplierId: v })}
                      options={suppliers.filter((s) => s.active)
                        .map((s) => ({ value: String(s.id), label: s.name, icon: "fa-truck" }))} />
            </FormGroup>
            <FormGroup label={t("supply.docNumber")}>
              <Field className="form-input mono" value={form.docNumber}
                     onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
            </FormGroup>
          </div>
          <FormGroup label={t("common.date")}>
            <input type="date" className="form-input" value={form.receivedAt}
                   onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
          </FormGroup>

          <FormGroup label={t("supply.scanToAdd")}>
            <input className="form-input mono" value={form.code} autoFocus
                   placeholder={t("stocktake.scanPlaceholder")}
                   onChange={(e) => setForm({ ...form, code: e.target.value })}
                   onKeyDown={(e) => e.key === "Enter" && addLine()} />
          </FormGroup>

          <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("common.count")}</th>
                  <th>{t("dash.costPrice")}</th>
                  <th>{t("inv.expiry")}</th>
                  <th>{t("common.sum")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.length ? form.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="fw-700" style={{ fontSize: 13 }}>{l.productName}</td>
                    <td><NumField kind="qty" className="form-input ek-num" style={{ width: 90 }}
                               value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} /></td>
                    <td><NumField kind="money" className="form-input ek-num" style={{ width: 120 }}
                               value={l.costPrice} onChange={(e) => setLine(i, "costPrice", e.target.value)} /></td>
                    <td><input type="date" className="form-input" style={{ width: 150 }}
                               value={l.expiryDate} onChange={(e) => setLine(i, "expiryDate", e.target.value)} /></td>
                    <td className="mono fw-700">{money((Number(l.quantity) || 0) * (Number(l.costPrice) || 0))}</td>
                    <td>
                      <button className="btn-icon danger" onClick={() => dropLine(i)}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6}><Empty text={t("supply.scanHint")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, marginBottom: 10 }}>
            <span className="fw-800">{t("common.total")}</span>
            <span className="mono fw-800">{money(formTotal)}</span>
          </div>

          <div className="grid-2">
            <FormGroup label={t("supply.paidNow")}>
              <Field kind="money" className="form-input ek-num"
                     value={form.paidNow} onChange={(e) => setForm({ ...form, paidNow: e.target.value })} />
            </FormGroup>
            <FormGroup label={t("credit.method")}>
              <Select block variant="field" ariaLabel={t("credit.method")}
                      value={form.paymentMethod}
                      onChange={(v) => setForm({ ...form, paymentMethod: v })}
                      options={["CASH", "CARD"].map((k) => ({ value: k, label: paymentLabel(k), icon: "fa-wallet" }))} />
            </FormGroup>
          </div>
          {/* ⚠ Naqd to'lov kassaga TA'SIR QILADI — aytib qo'yamiz. */}
          <p className="form-hint">{t("supply.paidHint")}</p>
        </Modal>
      )}

      {/* ── Yangi yetkazib beruvchi ────────────────────────────────────── */}
      {newSup && (
        <Modal
          title={t("supply.newSupplier")}
          onClose={() => setNewSup(null)}
          maxWidth={420}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setNewSup(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={saveSupplier} disabled={saving || !newSup.name.trim()}>
                <i className="fa-solid fa-check" /> {t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={t("common.fullName")}>
            <Field className="form-input" autoFocus value={newSup.name}
                   onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} />
          </FormGroup>
          <FormGroup label={t("common.phone")}>
            <Field className="form-input mono ek-num" kind="phone" value={newSup.phone}
                   onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} />
          </FormGroup>
        </Modal>
      )}

      {/* ── Qarz to'lash ───────────────────────────────────────────────── */}
      {pay && (
        <Modal
          title={`${t("supply.pay")} — ${pay.supplier.name}`}
          onClose={() => setPay(null)}
          maxWidth={520}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setPay(null)}>{t("common.close")}</button>
              <button className="btn btn-primary btn-sm" onClick={submitPay}
                      disabled={saving || !(Number(pay.amount) > 0)}>
                <i className="fa-solid fa-money-bill-transfer" /> {t("supply.pay")}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="fw-700">{t("supply.debt")}</span>
            <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(pay.supplier.balance)}</span>
          </div>
          <label className="form-label">{t("credit.payAmount")}</label>
          <Field kind="money" max={pay.supplier.balance}
                 className="form-input ek-num" autoFocus value={pay.amount}
                 onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <label className="form-label" style={{ marginTop: 10 }}>{t("credit.method")}</label>
          <div className="cat-tabs" role="tablist">
            {["CASH", "CARD"].map((k) => (
              <button key={k} type="button" role="tab" aria-selected={pay.method === k}
                      className={`cat-tab ${pay.method === k ? "active" : ""}`}
                      onClick={() => setPay({ ...pay, method: k })}>
                {paymentLabel(k)}
              </button>
            ))}
          </div>
          <p className="form-hint">{t("supply.paidHint")}</p>

          <div className="form-label" style={{ marginTop: 14 }}>{t("credit.ledger")}</div>
          <div className="table-wrap" style={{ maxHeight: 200, overflowY: "auto" }}>
            <table>
              <tbody>
                {(pay.ledger || []).map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{t(`credit.type.${l.type}`)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{l.receiptId ? `#${l.receiptId}` : (l.reason || "—")}</td>
                    <td className="mono fw-700"
                        style={{ color: l.type === "PAYMENT" ? "var(--fg-success)" : "var(--fg-danger)" }}>
                      {l.type === "PAYMENT" ? "-" : "+"}{money(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ── Hujjat tafsiloti ───────────────────────────────────────────── */}
      {view && (
        <Modal title={`${t("supply.receipt")} #${view.id}`} onClose={() => setView(null)} maxWidth={640}
               footer={<button className="btn btn-outline btn-sm" onClick={() => setView(null)}>{t("common.close")}</button>}>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">{t("supply.supplier")}</span><span className="fw-700">{view.supplierName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">{t("common.date")}</span><span className="mono">{view.receivedAt}</span>
            </div>
            {view.docNumber && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">{t("supply.docNumber")}</span><span className="mono">{view.docNumber}</span>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("products.col")}</th><th>{t("common.count")}</th><th>{t("dash.costPrice")}</th><th>{t("common.sum")}</th></tr>
              </thead>
              <tbody>
                {view.lines?.map((l) => (
                  <tr key={l.id}>
                    <td className="fw-700" style={{ fontSize: 13 }}>{l.productName}</td>
                    <td className="mono">{l.quantity}</td>
                    <td className="mono">{money(l.costPrice)}</td>
                    <td className="mono fw-700">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <span className="fw-800">{t("common.total")}</span>
            <span className="mono fw-800">{money(view.totalAmount)}</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
