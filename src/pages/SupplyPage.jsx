/* ══════════════════════════════════════════════════════════════════════════
   Kirim va yetkazib beruvchilar

   Ilgari kirim faqat tovar bo'yicha bittalab kiritilardi va "bugun kim nima
   olib keldi, qancha turdi, qancha qarzim qoldi" degan savolga javob yo'q
   edi. Nasiya (mijoz qarzi) qurilgan-u, uning ko'zgusi — yetkazib
   beruvchiga qarz — yo'q edi.

   ⚠ Hujjatda «naqd to'landi» ko'rsatilsa, pul smena kassasidan CHIQADI —
   mijoz qarzini to'lashning teskarisi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { supplyApi, productApi, shopApi } from "../api";
import { Modal } from "../components";
import { Empty, Field, FormGroup } from "../components/ui";
import Select from "../components/ek/Select";
import MixedPay from "../components/ek/MixedPay";
import { enteredTotal, enteredParts } from "../lib/ek-payment";
import { money } from "../lib/ek-format";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { NumField, DateField } from "../components/ek/EkFields";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { NoTh, NoTd, NO_COL } from "../components/ek/RowNo";
import { returnReasonOptions, supplierReturnReason } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";

const today = () => new Date().toISOString().slice(0, 10);

/* ⚠ QARZNI KAMAYTIRADIGAN JURNAL TURLARI.
   Ilgari faqat `PAYMENT` minus bilan chizilardi. `RETURN` qo'shilgach
   (V138) u «+450 000» bo'lib ko'rinardi — ya'ni qarzni OSHIRGANDEK,
   holbuki balans aynan shu qatordan KAMAYADI. Jurnal bilan balans
   qarama-qarshi gapirishi eng chalkash holat bo'lardi. */
const DEBT_DOWN = ["PAYMENT", "RETURN"];

/* ⚠ BO'SH KARTOCHKA BITTA JOYDA. Ilgari forma `{ name: "", phone: "" }`
   deb IKKI joyda yozilardi (tugma va «ta'minotchi yo'q» yo'li) va uchinchi
   maydon qo'shilganda biri unutilardi — o'shanda forma `undefined` qiymat
   bilan ochilib, React «controlled → uncontrolled» deb ogohlantirardi. */
const EMPTY_SUPPLIER = {
  id: null,
  name: "", phone: "", note: "",
  tin: "", tinType: "", address: "",
  bankAccount: "", bankMfo: "", bankName: "",
  contactPerson: "", phone2: "", email: "", telegram: "",
  paymentDays: "", creditLimit: "", managerId: "",
};

/* Serverdagi kartochkani formaga keltiradi: `null` → bo'sh matn, aks
   holda React nazoratsiz maydonga o'tib ketadi. */
const toForm = (x) => ({
  id: x.id,
  name: x.name || "", phone: x.phone || "", note: x.note || "",
  tin: x.tin || "", tinType: x.tinType || "", address: x.address || "",
  bankAccount: x.bankAccount || "", bankMfo: x.bankMfo || "", bankName: x.bankName || "",
  contactPerson: x.contactPerson || "", phone2: x.phone2 || "",
  email: x.email || "", telegram: x.telegram || "",
  paymentDays: x.paymentDays ?? "", creditLimit: x.creditLimit ?? "",
  managerId: x.managerId ? String(x.managerId) : "",
});

export default function SupplyPage({ toast }) {
  const [tab, setTab] = useState("receipts");     // receipts | returns | suppliers
  const [receipts, setReceipts] = useState([]);
  const [returns, setReturns] = useState([]);     // ta'minotchiga qaytarish (V138)
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);         // yangi hujjat
  const [newSup, setNewSup] = useState(null);     // kartochka: yangi yoki tahrir
  /* ⚠ XODIMLAR FAQAT FORMA OCHILGANDA so'raladi. Sahifa ochilishida
     yuklash har kirimda bekorga so'rov bo'lardi — ro'yxat faqat
     «mas'ul xodim» tanlagichida kerak. */
  const [staff, setStaff] = useState([]);
  const [pay, setPay] = useState(null);           // { supplier, amount, method, ledger }
  const [view, setView] = useState(null);         // hujjat tafsiloti
  const [retForm, setRetForm] = useState(null);   // yangi qaytarish
  const [retView, setRetView] = useState(null);   // qaytarish tafsiloti

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([supplyApi.receipts(), supplyApi.suppliers()]);
      setReceipts(asArray(r.data));
      setSuppliers(asArray(s.data));
      /* ⚠ QAYTARISHLAR ALOHIDA SO'RALADI VA XATOSI JIM YUTILADI.
         Ular `Promise.all` ichida bo'lganida, eski serverda
         (`/supply/returns` hali yo'q) butun sahifa — kirimlar ham,
         ta'minotchilar ham — bo'sh qolardi. Ya'ni yangi bo'lim eski
         ishlayotgan ikkitasini o'ldirardi. */
      try {
        const q = await supplyApi.returns();
        setReturns(asArray(q.data));
      } catch (_) { setReturns([]); }
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
    if (!active.length) { openSupplier(); return; }
    setForm({
      supplierId: String(active[0].id),
      docNumber: "",
      receivedAt: today(),
      note: "",
      /* ⚠ ARALASH TO'LOV (V96): «darhol to'langan» qism ham bo'linishi
         mumkin. Ilgari bitta summa + bitta usul edi, usullar esa
         faqat naqd va karta — Click/Payme orqali o'tkazish oddiy hol
         bo'lsa ham ro'yxatda yo'q edi. */
      paidEntered: {},
      paidFocus: "CASH",
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
          /* Miqdor maydoni birlikni bilishi kerak: DONA tovarga 0.5
             yozib bo'lmasin (`NumField` izohiga qarang). */
          unit: p.unit,
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
        paidNow: enteredTotal(form.paidEntered),
        /* `paymentMethod` HAM yuboriladi — eski server uchun. */
        paymentMethod: enteredParts(form.paidEntered).length === 1
          ? enteredParts(form.paidEntered)[0].type : "MIXED",
        payments: enteredParts(form.paidEntered),
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

  /* ── Qaytarish (V138) ─────────────────────────────────────────────── */

  /**
   * TA'MINOTCHIGA QAYTARISH — kirimning ko'zgusi.
   *
   * ⚠ ILGARI BU YO'L YARIM EDI VA JIM YOLG'ON GAPIRARDI: buzuq mol
   * chiqit qilinardi, «Ta'minotchiga qaytarildi» sababi tanlanardi —
   * qarz esa bir tiyin ham kamaymasdi. Do'kon egasi ishni bajardim
   * deb o'ylardi, zarar do'konning hisobida qolardi.
   */
  const openReturn = () => {
    const active = suppliers.filter((x) => x.active);
    if (!active.length) { openSupplier(); return; }
    setRetForm({
      supplierId: String(active[0].id),
      returnedAt: today(),
      reason: "DEFECT",
      note: "",
      lines: [],
      code: "",
    });
  };

  const addRetLine = async () => {
    const code = retForm.code.trim();
    if (!code) return;
    try {
      const r = await productApi.scan(code);
      const p = r?.data?.product;
      if (!p) { toast?.error(t("common.notFound")); return; }
      setRetForm((f) => ({
        ...f,
        code: "",
        lines: [...f.lines, {
          productId: p.id, productName: p.name, unit: p.unit, quantity: "1",
        }],
      }));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const setRetLine = (i, value) =>
    setRetForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, quantity: value } : l)) }));
  const dropRetLine = (i) =>
    setRetForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const saveReturn = async () => {
    setSaving(true);
    try {
      /* ⚠ NARX YUBORILMAYDI. U partiyadan olinadi: qaytarilgan dona
         qaysi partiyadan chiqqan bo'lsa, unga qancha to'langan
         bo'lsa — qarz shuncha kamayadi. Qo'lda kiritilsa, qarzni
         o'ylab topilgan songa kamaytirib bo'lardi. */
      await supplyApi.createReturn({
        supplierId: Number(retForm.supplierId),
        returnedAt: retForm.returnedAt,
        reason: retForm.reason,
        note: retForm.note.trim() || null,
        lines: retForm.lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      });
      toast?.success(t("supply.returnSaved"));
      setRetForm(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Yetkazib beruvchi ────────────────────────────────────────────── */

  /**
   * Kartochkani ochadi — yangi yoki mavjudini TAHRIRLASH uchun.
   *
   * ⚠ TAHRIRLASH ILGARI UMUMAN YO'Q EDI: telefon xato terilgan bo'lsa,
   * yagona yo'l arxivlab yangisini yaratish edi va o'shanda butun
   * hisob-kitob tarixi eskisida qolardi.
   */
  const openSupplier = (row) => {
    setNewSup(row ? toForm(row) : EMPTY_SUPPLIER);
    /* Xatosi JIM yutiladi: mas'ul xodim — ixtiyoriy maydon va uning
       ro'yxati kelmagani butun formani to'sib qo'ymasligi kerak. */
    shopApi.getUsers().then((r) => setStaff(asArray(r.data))).catch(() => setStaff([]));
  };

  const saveSupplier = async () => {
    setSaving(true);
    try {
      /* ⚠ BO'SH MATN → `null`. Server uchun «» va «yo'q» bir xil emas:
         bo'sh satr bazaga tushib, keyin ekranda bo'sh katak bo'lib
         ko'rinardi va uni «kiritilmagan» dan ajratib bo'lmasdi. */
      const v = (x) => { const t2 = String(x ?? "").trim(); return t2 === "" ? null : t2; };
      const body = {
        name: newSup.name.trim(),
        phone: v(newSup.phone), note: v(newSup.note),
        tin: v(newSup.tin), tinType: v(newSup.tinType), address: v(newSup.address),
        bankAccount: v(newSup.bankAccount), bankMfo: v(newSup.bankMfo),
        bankName: v(newSup.bankName),
        contactPerson: v(newSup.contactPerson), phone2: v(newSup.phone2),
        email: v(newSup.email), telegram: v(newSup.telegram),
        paymentDays: newSup.paymentDays === "" ? null : Number(newSup.paymentDays),
        creditLimit: newSup.creditLimit === "" ? null : Number(newSup.creditLimit),
        managerId: newSup.managerId ? Number(newSup.managerId) : null,
      };
      if (newSup.id) await supplyApi.updateSupplier(newSup.id, body);
      else await supplyApi.createSupplier(body);
      setNewSup(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Arxivlash va tiklash.
   *
   * ⚠ ARXIVLASH — O'CHIRISH EMAS: hujjatlar egasiz qolmasin. Tiklash
   * ham shu sababdan kerak: xato arxivlangan ta'minotchi bilan yangi
   * hujjat yaratib bo'lmasdi va yagona yo'l dublikat yaratish edi —
   * o'shanda hisob-kitob ikkiga bo'linardi.
   */
  const toggleArchive = async (row) => {
    try {
      if (row.active) await supplyApi.archiveSupplier(row.id);
      else await supplyApi.restoreSupplier(row.id);
      await load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const openPay = async (s) => {
    /* ⚠ ARALASH TO'LOV (V96): bitta `amount`+`method` o'rniga
       kiritilganlar xaritasi — ta'minotchiga to'lovning yarmi naqd,
       yarmi kartadan bo'lishi kassadagidan kam uchramaydi. */
    setPay({ supplier: s, entered: {}, focus: "CASH", ledger: null });
    try {
      const r = await supplyApi.ledger(s.id);
      setPay((p) => (p && p.supplier.id === s.id ? { ...p, ledger: asArray(r.data) } : p));
    } catch (_) { /* jurnal kelmasa ham to'lov qabul qilinaveradi */ }
  };

  const submitPay = async () => {
    setSaving(true);
    try {
      const parts = enteredParts(pay.entered);
      /* `method` HAM yuboriladi — eski server uchun (sabab
         `CustomersPage.submitDebt` izohida). */
      const r = await supplyApi.pay(pay.supplier.id, {
        amount: enteredTotal(pay.entered),
        method: parts.length === 1 ? parts[0].type : "MIXED",
        payments: parts, reason: null,
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

  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═════════════════════════════════
     ⚠ IKKI JADVAL — IKKI FILTR. Kirimlar va yetkazib beruvchilar
     BOSHQA-BOSHQA ustunlarga ega; bitta filtr ikkalasiga ishlaganda
     «qarz > 0» sharti kirimlar jadvalida ma'nosiz turib qolardi. */
  const RCPT_COLS = useMemo(() => [
    /* ⚠ ICHKI `id` O'RNIGA HUJJAT RAQAMI: `id` butun baza bo'ylab
       o'sadi va egasi uchun ma'nosiz («#8471» deb aytilmaydi).
       Eski saqlangan filtr `id` ga ishora qilsa, `useDataFilter` uni
       jimgina tashlaydi — ustun endi yo'q. */
    NO_COL,
    { key: "date", label: t("common.date"),       type: "date",   get: (r) => r.receivedAt },
    { key: "sup",  label: t("supply.supplier"),   type: "text",   get: (r) => r.supplierName },
    { key: "doc",  label: t("supply.docNumber"),  type: "text",   get: (r) => r.docNumber },
    { key: "sum",  label: t("common.sum"),        type: "number", get: (r) => r.totalAmount },
  ], []);
  const rcptFlt = useDataFilter(RCPT_COLS, "supply-rcpt");
  const shownReceipts = rcptFlt.apply(receipts);

  /* ⚠ QAYTARISHDA «HUJJAT RAQAMI» USTUNI YO'Q: kirimda u
     TA'MINOTCHINING nakladnoysi edi, qaytarishni esa do'konning
     o'zi yozadi — tashqi raqam yo'q. O'rniga SABAB turadi, chunki
     ta'minotchi bilan gaplashganda birinchi shu so'raladi. */
  const RET_COLS = useMemo(() => [
    NO_COL,
    { key: "date", label: t("common.date"),         type: "date",   get: (r) => r.returnedAt },
    { key: "sup",  label: t("supply.supplier"),     type: "text",   get: (r) => r.supplierName },
    { key: "why",  label: t("supply.returnReason"), type: "text",
      get: (r) => supplierReturnReason(r.reason).label },
    { key: "sum",  label: t("common.sum"),          type: "number", get: (r) => r.totalAmount },
  ], []);
  const retFlt = useDataFilter(RET_COLS, "supply-ret");
  const shownReturns = retFlt.apply(returns);

  const SUP_COLS = useMemo(() => [
    NO_COL,
    { key: "name",  label: t("supply.supplier"), type: "text",   get: (x) => x.name },
    { key: "phone", label: t("common.phone"),    type: "text",   get: (x) => x.phone },
    { key: "debt",  label: t("supply.debt"),     type: "number", get: (x) => x.balance },
    /* ⚠ MUDDAT SON EMAS, SANA: «14 kundan keyin» deb filtrlash
       kerak bo'lganda son bo'yicha filtr javob bera olmasdi. */
    { key: "due",   label: t("supply.dueCol"),   type: "date",   get: (x) => x.nextDueDate },
  ], []);
  const supFlt = useDataFilter(SUP_COLS, "supply-sup");
  const shownSuppliers = supFlt.apply(suppliers);

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("supply.title")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => openSupplier()}>
            <i className="fa-solid fa-truck" /> {t("supply.newSupplier")}
          </button>
          {/* ⚠ QAYTARISH TUGMASI ASOSIY EMAS: kundalik ish — kirim.
              Qaytarish esa oyda bir necha marta bo'ladi. */}
          <button className="btn btn-outline btn-sm" onClick={openReturn}>
            <i className="fa-solid fa-rotate-left" /> {t("supply.newReturn")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <i className="fa-solid fa-plus" /> {t("supply.newReceipt")}
          </button>
        </div>
      </div>

      <div className="cat-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {[["receipts", t("supply.receipts")],
          ["returns", t("supply.returns")],
          ["suppliers", t("supply.suppliers")]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k}
                  className={`cat-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {busy ? <SkeletonTable rows={6} cols={["text", "wide", "num", "narrow"]} /> : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {t(`supply.${tab}`)}
              <span className="text-muted" style={{ marginLeft: 8, fontWeight: 600 }}>
                {tab === "receipts" ? shownReceipts.length
                  : tab === "returns" ? shownReturns.length : shownSuppliers.length}
              </span>
            </span>
            {tab === "receipts" ? <DataFilter cols={RCPT_COLS} flt={rcptFlt} />
              : tab === "returns" ? <DataFilter cols={RET_COLS} flt={retFlt} />
              : <DataFilter cols={SUP_COLS} flt={supFlt} />}
          </div>
          <div className="table-wrap">
            {tab === "receipts" ? (
              <table>
                <thead>
                  <tr>
                    <NoTh flt={rcptFlt} />
                    <SortTh flt={rcptFlt} col="date">{t("common.date")}</SortTh>
                    <SortTh flt={rcptFlt} col="sup">{t("supply.supplier")}</SortTh>
                    <SortTh flt={rcptFlt} col="doc">{t("supply.docNumber")}</SortTh>
                    <SortTh flt={rcptFlt} col="sum">{t("common.sum")}</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shownReceipts.length ? shownReceipts.map((r, i) => (
                    <tr key={r.id}>
                      <NoTd seq={i + 1} no={r.docNo} />
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
            ) : tab === "returns" ? (
              <table>
                <thead>
                  <tr>
                    <NoTh flt={retFlt} />
                    <SortTh flt={retFlt} col="date">{t("common.date")}</SortTh>
                    <SortTh flt={retFlt} col="sup">{t("supply.supplier")}</SortTh>
                    <SortTh flt={retFlt} col="why">{t("supply.returnReason")}</SortTh>
                    <SortTh flt={retFlt} col="sum">{t("common.sum")}</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shownReturns.length ? shownReturns.map((r, i) => (
                    <tr key={r.id}>
                      <NoTd seq={i + 1} no={r.docNo} />
                      <td className="ek-num" style={{ fontSize: 13 }}>{r.returnedAt}</td>
                      <td className="fw-700">{r.supplierName}</td>
                      {/* ⚠ Sabab RANG BILAN EMAS, ikonka va YOZUV bilan
                          (qoida №6): «buzuq» va «muddati o'tgan» ni
                          rang farqi bilan ajratib bo'lmasdi. */}
                      <td style={{ fontSize: 13 }}>
                        <i className={`fa-solid ${supplierReturnReason(r.reason).icon}`} aria-hidden="true" />
                        {" "}{supplierReturnReason(r.reason).label}
                      </td>
                      {/* ⚠ MINUS BILAN: bu qator QARZNI KAMAYTIRADI.
                          Kirim jadvalidagi son bilan bir xil ko'rinsa,
                          ikkalasi qarzni oshiradigandek tuyulardi. */}
                      <td className="ek-num fw-700" style={{ color: "var(--fg-success)" }}>
                        -{money(r.totalAmount)}
                      </td>
                      <td>
                        <button className="btn-icon" title={t("common.details")} onClick={() => setRetView(r)}>
                          <i className="fa-solid fa-eye" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}><Empty icon="fa-rotate-left" text={t("supply.noReturns")} /></td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <NoTh flt={supFlt} />
                    <SortTh flt={supFlt} col="name">{t("supply.supplier")}</SortTh>
                    <SortTh flt={supFlt} col="phone">{t("common.phone")}</SortTh>
                    <SortTh flt={supFlt} col="debt">{t("supply.debt")}</SortTh>
                    <SortTh flt={supFlt} col="due">{t("supply.dueCol")}</SortTh>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shownSuppliers.length ? shownSuppliers.map((s, i) => (
                    <tr key={s.id} style={s.active ? undefined : { opacity: 0.5 }}>
                      <NoTd seq={i + 1} no={s.docNo} />
                      <td className="fw-700">{s.name}</td>
                      <td className="mono" style={{ fontSize: 13 }}>{s.phone || "—"}</td>
                      {/* Qarz MUSBAT bo'lsa qizil: bu bizning to'lanmagan
                          majburiyatimiz va ko'zga tashlanishi kerak. */}
                      <td>
                        {Number(s.balance) > 0 ? (
                          <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(s.balance)}</span>
                        ) : Number(s.balance) < 0 ? (
                          /* ⚠ MANFIY = TA'MINOTCHI BIZGA QARZDOR (V138).
                             Ilgari bu yerda «—» turardi va qaytarilgan
                             mol qarzdan ko'p bo'lsa, do'kon bergan pul
                             HECH QAYERDA ko'rinmasdi. Rang yolg'iz
                             signal emas — yozuv ham bor (qoida №6). */
                          <span className="badge badge-green" title={t("supply.owesUsHint")}>
                            {t("supply.owesUs")}:{" "}
                            <span className="ek-num">{money(Math.abs(Number(s.balance)))}</span>
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      {/* ⚠ MUDDAT USTUNI — QARZNING YARMI SHU YERDA.
                          Ilgari tizim «12 mln qarzdormiz» derdi-yu,
                          QACHON to'lash kerakligini bilmasdi: egasi
                          kechikkanini faqat ta'minotchi qo'ng'iroq
                          qilganda bilardi.

                          ⚠ Muddati o'tgani RANG BILAN EMAS, YOZUV
                          bilan ham ajratiladi (qoida №6). */}
                      <td>
                        {Number(s.overdueAmount) > 0 ? (
                          <span className="badge badge-red" title={t("supply.overdueHint")}>
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                            {" "}{t("supply.overdue")}: <span className="ek-num">{money(s.overdueAmount)}</span>
                          </span>
                        ) : s.nextDueDate ? (
                          <span className="ek-num">{s.nextDueDate}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {Number(s.balance) > 0 && (
                            <button className="btn btn-outline btn-sm" onClick={() => openPay(s)}>
                              <i className="fa-solid fa-money-bill-transfer" /> {t("supply.pay")}
                            </button>
                          )}
                          <button className="btn-icon" onClick={() => openSupplier(s)}
                                  aria-label={t("common.edit")} title={t("common.edit")}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          {/* ⚠ Arxivlangan qatorda tugma TIKLASHGA aylanadi,
                              yo'qolmaydi: yo'qolgan tugma «bu qatorni
                              qaytarib bo'lmaydi» degan ma'no berardi. */}
                          <button className={`btn-icon ${s.active ? "danger" : ""}`}
                                  onClick={() => toggleArchive(s)}
                                  aria-label={t(s.active ? "supply.archive" : "products.restore")}
                                  title={t(s.active ? "supply.archive" : "products.restore")}>
                            <i className={`fa-solid ${s.active ? "fa-box-archive" : "fa-rotate-left"}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6}><Empty icon="fa-truck" text={t("supply.noSuppliers")} /></td></tr>
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
                      searchable searchPlaceholder={t("common.searchShort")}
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
            <DateField className="form-input ek-num" value={form.receivedAt}
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
                    <td><NumField kind="qty" unit={l.unit} className="form-input ek-num" style={{ width: 90 }}
                               value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} /></td>
                    <td><NumField kind="money" className="form-input ek-num" style={{ width: 120 }}
                               value={l.costPrice} onChange={(e) => setLine(i, "costPrice", e.target.value)} /></td>
                    <td><DateField className="form-input ek-num" style={{ width: 150 }}
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

          {/* ══ DARHOL TO'LANADIGAN QISM — ARALASH (V96) ══════════════
              ⚠ `cap` — HUJJAT JAMI: undan ortiq to'lash ma'nosiz va
              server ham rad etadi (`receipt.paid.exceeds`). Chegara
              JAMIGA qo'yiladi, bitta maydonga emas. */}
          <div className="form-label" style={{ marginTop: 4 }}>{t("supply.paidNow")}</div>
          <MixedPay entered={form.paidEntered}
                    onChange={(paidEntered) => setForm({ ...form, paidEntered })}
                    focus={form.paidFocus}
                    onFocus={(paidFocus) => setForm({ ...form, paidFocus })}
                    cap={formTotal || null}
                    inputId="receipt-paid-amount"
                    disabled={saving} />
          {/* ⚠ Naqd to'lov kassaga TA'SIR QILADI — aytib qo'yamiz. */}
          <p className="form-hint">{t("supply.paidHint")}</p>
        </Modal>
      )}

      {/* ── Qaytarish hujjati (V138) ───────────────────────────────────── */}
      {retForm && (
        <Modal
          title={t("supply.newReturn")}
          onClose={() => setRetForm(null)}
          maxWidth={680}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setRetForm(null)}>{t("common.cancel")}</button>
              {/* ⚠ «Boshqa» sababda izohsiz saqlash TO'SILADI — server ham
                  rad etadi. Xatoni saqlashdan KEYIN ko'rsatish omborchini
                  bekorga ish qildirardi. */}
              <button className="btn btn-primary btn-sm" onClick={saveReturn}
                      disabled={saving || !retForm.lines.length
                                || retForm.lines.some((l) => !(Number(l.quantity) > 0))
                                || (retForm.reason === "OTHER" && !retForm.note.trim())}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("common.save")}
              </button>
            </>
          }
        >
          <p className="form-hint" style={{ marginTop: 0 }}>{t("supply.returnHint")}</p>

          <div className="grid-2">
            <FormGroup label={t("supply.supplier")}>
              <Select block variant="field" ariaLabel={t("supply.supplier")}
                      searchable searchPlaceholder={t("common.searchShort")}
                      value={retForm.supplierId}
                      onChange={(v) => setRetForm({ ...retForm, supplierId: v })}
                      options={suppliers.filter((x) => x.active)
                        .map((x) => ({ value: String(x.id), label: x.name, icon: "fa-truck" }))} />
            </FormGroup>
            <FormGroup label={t("common.date")}>
              <DateField className="form-input ek-num" value={retForm.returnedAt}
                         onChange={(e) => setRetForm({ ...retForm, returnedAt: e.target.value })} />
            </FormGroup>
          </div>

          <FormGroup label={t("supply.returnReason")}>
            <Select block variant="field" ariaLabel={t("supply.returnReason")}
                    value={retForm.reason}
                    onChange={(v) => setRetForm({ ...retForm, reason: v })}
                    options={returnReasonOptions()} />
          </FormGroup>

          <FormGroup label={t("supply.returnNote")}>
            <Field className="form-input" value={retForm.note}
                   onChange={(e) => setRetForm({ ...retForm, note: e.target.value })} />
          </FormGroup>
          {retForm.reason === "OTHER" && !retForm.note.trim() && (
            <p className="form-hint">{t("supply.returnNoteRequired")}</p>
          )}

          <FormGroup label={t("supply.scanToAdd")}>
            <input className="form-input mono" value={retForm.code} autoFocus
                   placeholder={t("stocktake.scanPlaceholder")}
                   onChange={(e) => setRetForm({ ...retForm, code: e.target.value })}
                   onKeyDown={(e) => e.key === "Enter" && addRetLine()} />
          </FormGroup>

          <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}>
            <table>
              <thead>
                <tr><th>{t("products.col")}</th><th>{t("common.count")}</th><th></th></tr>
              </thead>
              <tbody>
                {retForm.lines.length ? retForm.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="fw-700" style={{ fontSize: 13 }}>{l.productName}</td>
                    <td><NumField kind="qty" unit={l.unit} className="form-input ek-num" style={{ width: 90 }}
                                  value={l.quantity} onChange={(e) => setRetLine(i, e.target.value)} /></td>
                    <td>
                      <button className="btn-icon danger" onClick={() => dropRetLine(i)}
                              aria-label={t("common.delete")} title={t("common.delete")}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}><Empty text={t("supply.scanHint")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ⚠ FORMADA JAMI KO'RSATILMAYDI va bu ataylab: summa
              PARTIYADAN hisoblanadi (qaysi partiyaga qancha to'langan
              bo'lsa). Bu yerda taxminiy son ko'rsatilsa, u saqlangandan
              keyingi haqiqiy sondan farq qilardi — do'kon egasi esa
              birinchisiga ishonib qolardi. */}
          <p className="form-hint">{t("supply.returnPriceHint")}</p>
        </Modal>
      )}

      {/* ── Qaytarish tafsiloti ────────────────────────────────────────── */}
      {retView && (
        <Modal title={`${t("supply.return")} №${retView.docNo ?? retView.id}`}
               onClose={() => setRetView(null)} maxWidth={640}
               footer={<button className="btn btn-outline btn-sm" onClick={() => setRetView(null)}>{t("common.close")}</button>}>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">{t("supply.supplier")}</span>
              <span className="fw-700">{retView.supplierName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">{t("common.date")}</span>
              <span className="ek-num">{retView.returnedAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted">{t("supply.returnReason")}</span>
              <span>
                <i className={`fa-solid ${supplierReturnReason(retView.reason).icon}`} aria-hidden="true" />
                {" "}{supplierReturnReason(retView.reason).label}
              </span>
            </div>
            {retView.note && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-muted">{t("supply.returnNote")}</span>
                <span>{retView.note}</span>
              </div>
            )}
            {retView.createdByName && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">{t("supply.returnBy")}</span>
                <span>{retView.createdByName}</span>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("products.col")}</th><th>{t("common.count")}</th><th>{t("dash.costPrice")}</th><th>{t("common.sum")}</th></tr>
              </thead>
              <tbody>
                {retView.lines?.map((l) => (
                  <tr key={l.id}>
                    <td className="fw-700" style={{ fontSize: 13 }}>{l.productName}</td>
                    <td className="ek-num">{l.quantity}</td>
                    <td className="ek-num">{money(l.costPrice)}</td>
                    <td className="ek-num fw-700">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* ⚠ PASTDA «JAMI» EMAS, «QARZ SHUNCHAGA KAMAYDI»: hujjatning
              butun ma'nosi shu va uni oddiy yig'indi qilib ko'rsatish
              qaytarishni kirimdan farqsiz qilardi. */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <span className="fw-800">{t("supply.debt")}</span>
            <span className="ek-num fw-800" style={{ color: "var(--fg-success)" }}>
              -{money(retView.totalAmount)}
            </span>
          </div>
        </Modal>
      )}

      {/* ── Yangi yetkazib beruvchi ────────────────────────────────────── */}
      {newSup && (
        <Modal
          title={newSup.id ? t("supply.editSupplier") : t("supply.newSupplier")}
          onClose={() => setNewSup(null)}
          maxWidth={640}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setNewSup(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={saveSupplier} disabled={saving || !newSup.name.trim()}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("common.save")}
              </button>
            </>
          }
        >
          {/* ⚠ TO'RT BO'LIM, BITTA UZUN RO'YXAT EMAS. Kundalik ish
              (nom, telefon) birinchi bo'limda tugaydi; bank va
              rekvizitlar yiliga bir marta to'ldiriladi va ular
              kundalik maydonlarni pastga surib yuborishi kerak emas.
              Tovar formasidagi bilan bir xil qoida. */}
          <div className="sup-form">
            <div className="sup-form__sec">{t("supply.secMain")}</div>
            {/* ⚠ «Nomi», «Ism familiya» EMAS: ta'minotchi ko'pincha
                TASHKILOT («Oqtepa Savdo MChJ»), odam emas. Eski yorliq
                kartochkaga qaragan odamni jismoniy shaxs deb
                o'ylashga majbur qilardi. */}
            <FormGroup label={t("common.name")}>
              <Field className="form-input" autoFocus value={newSup.name}
                     onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} />
            </FormGroup>
            <div className="sup-form__row">
              <FormGroup label={t("common.phone")}>
                <Field className="form-input mono ek-num" kind="phone" value={newSup.phone}
                       onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("supply.phone2")}>
                <Field className="form-input mono ek-num" kind="phone" value={newSup.phone2}
                       onChange={(e) => setNewSup({ ...newSup, phone2: e.target.value })} />
              </FormGroup>
            </div>
            <div className="sup-form__row">
              <FormGroup label={t("supply.contactPerson")}>
                <Field className="form-input" value={newSup.contactPerson}
                       onChange={(e) => setNewSup({ ...newSup, contactPerson: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("supply.manager")}>
                <Select block variant="field" value={newSup.managerId}
                        placeholder={t("supply.managerNone")}
                        onChange={(v) => setNewSup({ ...newSup, managerId: v })}
                        options={[{ value: "", label: t("supply.managerNone") },
                                  ...staff.map((u) => ({ value: String(u.id), label: u.fullName || u.username }))]} />
              </FormGroup>
            </div>
            <div className="sup-form__row">
              <FormGroup label={t("supply.email")}>
                <Field className="form-input" value={newSup.email}
                       onChange={(e) => setNewSup({ ...newSup, email: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("supply.telegram")}>
                <Field className="form-input" value={newSup.telegram}
                       onChange={(e) => setNewSup({ ...newSup, telegram: e.target.value })} />
              </FormGroup>
            </div>
            <FormGroup label={t("supply.address")}>
              <Field className="form-input" value={newSup.address}
                     onChange={(e) => setNewSup({ ...newSup, address: e.target.value })} />
            </FormGroup>

            <div className="sup-form__sec">{t("supply.secTerms")}</div>
            {/* ⚠ MUDDAT — STANDART, MAJBURIYAT EMAS. Har hujjatda uni
                o'zgartirish mumkin va yozuv shuni aytadi, aks holda
                egasi «nega bu hujjatda boshqa sana?» deb o'ylardi. */}
            <div className="sup-form__row">
              <FormGroup label={t("supply.paymentDays")}>
                <NumField className="form-input ek-num" value={newSup.paymentDays}
                          onChange={(e) => setNewSup({ ...newSup, paymentDays: e.target.value })} />
                {/* ⚠ IZOH MAYDON OSTIDA, `FormGroup` ichida emas: u
                    `hint` ni bilmaydi va berilgani JIMGINA yo'qolardi —
                    kalit lug'atda «ishlatilgan» bo'lib turib, ekranda
                    hech qachon chiqmasdi. */}
                <div className="form-hint">{t("supply.paymentDaysHint")}</div>
              </FormGroup>
              <FormGroup label={t("supply.creditLimit")}>
                <NumField className="form-input ek-num" value={newSup.creditLimit}
                          onChange={(e) => setNewSup({ ...newSup, creditLimit: e.target.value })} />
              </FormGroup>
            </div>

            <div className="sup-form__sec">{t("supply.secOfficial")}</div>
            <div className="sup-form__row">
              <FormGroup label={t("supply.tinType")}>
                <Select block variant="field" value={newSup.tinType}
                        placeholder={t("supply.tinTypeNone")}
                        onChange={(v) => setNewSup({ ...newSup, tinType: v })}
                        options={[{ value: "", label: t("supply.tinTypeNone") },
                                  { value: "LEGAL", label: t("supply.tinLegal") },
                                  { value: "INDIVIDUAL", label: t("supply.tinIndividual") }]} />
              </FormGroup>
              <FormGroup label={t("supply.tin")}>
                <Field className="form-input mono ek-num" value={newSup.tin}
                       onChange={(e) => setNewSup({ ...newSup, tin: e.target.value })} />
              </FormGroup>
            </div>

            <div className="sup-form__sec">{t("supply.secBank")}</div>
            <FormGroup label={t("supply.bankAccount")}>
              <Field className="form-input mono ek-num" value={newSup.bankAccount}
                     onChange={(e) => setNewSup({ ...newSup, bankAccount: e.target.value })} />
            </FormGroup>
            <div className="sup-form__row">
              <FormGroup label={t("supply.bankMfo")}>
                <Field className="form-input mono ek-num" value={newSup.bankMfo}
                       onChange={(e) => setNewSup({ ...newSup, bankMfo: e.target.value })} />
              </FormGroup>
              <FormGroup label={t("supply.bankName")}>
                <Field className="form-input" value={newSup.bankName}
                       onChange={(e) => setNewSup({ ...newSup, bankName: e.target.value })} />
              </FormGroup>
            </div>

            <FormGroup label={t("common.details")}>
              <Field className="form-input" value={newSup.note}
                     onChange={(e) => setNewSup({ ...newSup, note: e.target.value })} />
            </FormGroup>
          </div>
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
                      disabled={saving || !(enteredTotal(pay.entered) > 0)}>
                <i className="fa-solid fa-money-bill-transfer" /> {t("supply.pay")}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="fw-700">{t("supply.debt")}</span>
            <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(pay.supplier.balance)}</span>
          </div>
          {/* ══ ARALASH TO'LOV (V96) — kassadagi bilan bir xil ko'rinish.
              ⚠ USULLAR HAM KO'PAYDI: ilgari faqat naqd va karta bor
              edi, holbuki ta'minotchiga Click/Payme orqali o'tkazish
              oddiy hol. Ro'yxat qisqaligi imkoniyat emas, kamchilik
              edi.
              ⚠ `cap` — ta'minotchining qarzi: undan ortiq to'lash
              ma'nosiz va server ham rad etadi
              (`supplier.payment.exceeds`). */}
          <MixedPay entered={pay.entered}
                    onChange={(entered) => setPay({ ...pay, entered })}
                    focus={pay.focus}
                    onFocus={(focus) => setPay({ ...pay, focus })}
                    cap={Number(pay.supplier.balance) || null}
                    inputId="supplier-pay-amount"
                    autoFocus
                    disabled={saving} />
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
                        style={{ color: DEBT_DOWN.includes(l.type) ? "var(--fg-success)" : "var(--fg-danger)" }}>
                      {DEBT_DOWN.includes(l.type) ? "-" : "+"}{money(l.amount)}
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
