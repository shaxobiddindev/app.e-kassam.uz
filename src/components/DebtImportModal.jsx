import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { PhoneField, NumField } from "./ek/EkFields";
import { Spinner } from "./ek/Loading";
import { t } from "../lib/ek-i18n";
import { money } from "../config";
import { phoneInput } from "../lib/ek-input";
import { asArray } from "../lib/ek-array";
import { customerApi } from "../api";
import {
  MAX_ROWS, daysAgo, isBlank, normName, parseDate, parsePaste, rowErrors, showDay, toPayload,
} from "../lib/ek-debt-import";

/* ══════════════════════════════════════════════════════════════════════════
   DAFTARDAN KO'CHIRISH (2026-10-04)

   Egasi: «ba'zi do'konlarda qarzlar daftarga yozilgan — shuni tizimga
   ko'chirish imkoni qo'sh». Qarori: telefonsiz ham; jadvalga ketma-ket
   yozish VA Excel'dan nusxalab qo'yish.

   ⚠ ILGARI bitta-bitta oyna edi (V48): har qarzdor uchun oynani ochib,
   telefonini MAJBURIY yozib, saqlab, yana ochish. Daftarda 60 yozuv
   bo'lsa — 60 marta, va telefoni yo'qlarini umuman kiritib bo'lmasdi.
   Endi bitta jadval: Enter — keyingi qator, Ctrl+V — butun Excel ustuni.

   ⚠ SAQLASH — BITTA SO'ROV, HAMMASI YOKI HECH NARSA (server shunday).
   Xato qator bo'lsa hech narsa yozilmaydi va xato o'sha qatorda
   ko'rsatiladi. Yarim ko'chirilgan daftar eng yomoni: qaysi qatorlar
   tushgani ko'rinmaydi, qayta bosilsa esa qarz IKKI MARTA yoziladi.

   ⚠ QORALAMA SAQLANADI (do'kon bo'yicha). 80 qatorni yozib bo'lgach
   oyna tasodifan yopilsa yoki chiroq o'chsa — ish yo'qolmasin.
   ══════════════════════════════════════════════════════════════════════════ */

let seq = 0;
const blank = () => ({ id: ++seq, name: "", phone: "", amount: "", date: "", note: "" });
/* Oxirida DOIM bitta bo'sh qator: «qator qo'shish» tugmasini qidirib
   o'tirmasdan yozishda davom etiladi.
   ⚠ O'rtadagi bo'sh qator O'CHIRILMAYDI: odam ismni qaytadan yozish
   uchun o'chirsa, qator ko'z oldida yo'qolib, kursor boshqa joyga
   sakrardi. Bo'sh qatorlar saqlashda shunchaki e'tiborga olinmaydi. */
const withTail = (rows) =>
  rows.length && isBlank(rows[rows.length - 1]) ? rows : [...rows, blank()];

const DAYS = [0, 30, 90, 180, 365];
const draftKey = () => {
  try { return `ek_debt_draft_${localStorage.getItem("ek_shopCode") || ""}`; } catch { return null; }
};
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (!d || !Array.isArray(d.rows)) return null;
    const rows = d.rows.map((r) => ({ ...blank(), ...r, id: ++seq })).filter((r) => !isBlank(r));
    return rows.length ? { rows, days: DAYS.includes(d.days) ? d.days : 0 } : null;
  } catch { return null; }
}
const phoneText = (p) => (p ? `+998 ${phoneInput(p).display}` : "");

export default function DebtImportModal({ onClose, onDone, toast }) {
  const draft = useMemo(readDraft, []);
  const [rows, setRowsRaw] = useState(() => withTail(draft?.rows || []));
  const [days, setDays] = useState(draft?.days ?? 0);
  const [restored, setRestored] = useState(!!draft);
  const [askClear, setAskClear] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const [serverErr, setServerErr] = useState({});
  const [askConfirm, setAskConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [known, setKnown] = useState([]);
  const nameRefs = useRef({});
  const [focusId, setFocusId] = useState(null);

  const setRows = (fn) => setRowsRaw((prev) => withTail(typeof fn === "function" ? fn(prev) : fn));
  const patch = (id, k, v) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
    if (serverErr[id]) setServerErr((e) => ({ ...e, [id]: undefined }));
  };

  /* Mavjud mijozlar — ism bo'yicha ogohlantirish uchun. Yuklanmasa ham
     oyna ishlaydi: bu faqat maslahat. */
  useEffect(() => {
    customerApi.getAll().then((r) => setKnown(asArray(r.data))).catch(() => {});
  }, []);

  useEffect(() => {
    const key = draftKey();
    if (!key) return;
    try {
      const body = rows.filter((r) => !isBlank(r)).map(({ id, ...r }) => r);
      if (body.length) localStorage.setItem(key, JSON.stringify({ rows: body, days }));
      else localStorage.removeItem(key);
    } catch { /* xotira to'la yoki yopiq — qoralamasiz ishlaydi */ }
  }, [rows, days]);

  useEffect(() => {
    if (focusId != null) { nameRefs.current[focusId]?.focus(); setFocusId(null); }
  }, [focusId, rows]);

  const today = daysAgo(0);
  const defaultDate = daysAgo(days);
  const filled = rows.filter((r) => !isBlank(r));
  const errs = useMemo(() => Object.fromEntries(filled.map((r) => [r.id, rowErrors(r)])), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const badRows = filled.filter((r) => Object.keys(errs[r.id] || {}).length || serverErr[r.id]);
  const total = filled.reduce((s, r) => s + (errs[r.id]?.amount ? 0 : toPayload(r, defaultDate).amount), 0);

  /* Ism → mavjud mijozlar. Telefonsiz qator telefonli mijoz nomiga mos
     kelsa — server ularni BIRLASHTIRMAYDI (boshqa odam bo'lishi mumkin),
     shuning uchun bu yerda ogohlantirib, bir bosishda telefonni qo'yamiz. */
  const byName = useMemo(() => {
    const m = new Map();
    for (const c of known) {
      const k = normName(c.fullName);
      if (k) m.set(k, [...(m.get(k) || []), c]);
    }
    return m;
  }, [known]);
  const byPhone = useMemo(() => new Set(known.map((c) => c.phone).filter(Boolean)), [known]);

  function hintOf(r, index) {
    if (isBlank(r) || !r.name.trim()) return null;
    const phone = r.phone && phoneInput(r.phone).valid ? phoneInput(r.phone).raw : "";
    if (phone) return byPhone.has(phone) ? { kind: "info", text: t("dimp.existing") } : null;
    const k = normName(r.name);
    const same = byName.get(k) || [];
    /* ⚠ Shu jadvaldagi telefonli qator ham hisob: daftarda «Ali aka»
       bir joyda telefoni bilan, boshqa joyda telefonsiz yozilgan bo'lsa,
       server ularni IKKI mijoz qilardi. */
    const twin = rows.find((o) => o.id !== r.id && normName(o.name) === k && phoneInput(o.phone || "").valid);
    const withPhone = same.find((c) => c.phone) || (twin && { phone: phoneInput(twin.phone).raw });
    if (withPhone) return { kind: "warn", text: t("dimp.sameName", { phone: phoneText(withPhone.phone) }), phone: withPhone.phone };
    if (same.length) return { kind: "info", text: t("dimp.existing") };
    if (rows.slice(0, index).some((o) => !o.phone && normName(o.name) === k)) return { kind: "info", text: t("dimp.repeat") };
    return null;
  }

  /* ── Qo'yish ─────────────────────────────────────────────────────── */
  function insert(text, atId) {
    const { rows: got } = parsePaste(text);
    if (!got.length) { toast?.error(t("dimp.pasteNone")); return false; }
    const fresh = got.map((r) => ({ ...blank(), ...r }));
    setRows((rs) => {
      const i = atId == null ? -1 : rs.findIndex((r) => r.id === atId);
      if (i < 0) return [...rs.filter((r) => !isBlank(r)), ...fresh];
      const next = [...rs];
      next.splice(i, isBlank(rs[i]) ? 1 : 0, ...fresh);
      return next;
    });
    /* Qo'yilgan qatorlarni do'koncha O'ZI yozmagan — xatolarini darhol
       ko'rsin, saqlash tugmasini bosguncha kutmasin. */
    setShowErr(true);
    toast?.success(t("dimp.pasted", { n: fresh.length }));
    return true;
  }

  /* Katakka bir nechta katak/qator qo'yilsa — jadvalga tarqatiladi.
     Bitta qiymat (masalan, faqat telefon) — oddiy qo'yish. */
  function onGridPaste(e) {
    const text = e.clipboardData?.getData("text") || "";
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const rowEl = e.target.closest?.("[data-row]");
    insert(text, rowEl ? Number(rowEl.dataset.row) : null);
  }

  /* Enter — keyingi qatorning ismi (daftardan yozayotgan odam qo'lini
     klaviaturadan olmaydi). */
  function onKeyDown(e, id) {
    if (e.key !== "Enter" || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    const i = rows.findIndex((r) => r.id === id);
    const next = rows[i + 1];
    if (next) setFocusId(next.id);
  }

  function remove(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function clearAll() {
    setRows([]);
    setRestored(false);
    setAskClear(false);
    setShowErr(false);
    setServerErr({});
  }

  /* ── Saqlash ─────────────────────────────────────────────────────── */
  async function save() {
    if (saving || !filled.length) return;
    setShowErr(true);
    if (filled.length > MAX_ROWS) { toast?.error(t("dimp.tooMany", { n: MAX_ROWS })); return; }
    const bad = filled.filter((r) => Object.keys(errs[r.id] || {}).length);
    if (bad.length) {
      toast?.error(t("dimp.fixRows", { n: bad.length }));
      nameRefs.current[bad[0].id]?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = filled.map((r) => ({ ...toPayload(r, defaultDate), askConfirm }));
      const res = await customerApi.addManualDebtBatch(payload);
      const errors = asArray(res?.data?.errors);
      if (errors.length) {
        setServerErr(Object.fromEntries(errors.map((e) => [filled[e.index]?.id, e.message])));
        toast?.error(res?.message || t("dimp.fixRows", { n: errors.length }));
        return;
      }
      try { localStorage.removeItem(draftKey()); } catch { /* yopiq xotira */ }
      toast?.success(res?.message || t("common.saved"));
      onDone?.(res?.data);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t("dimp.title")}
      onClose={onClose}
      maxWidth={1040}
      footer={
        <>
          <span className="dimp-sum">
            <b>{t("dimp.total", { n: filled.length })}</b>
            {total > 0 && <span>{t("dimp.totalSum")}: <b className="ek-num">{money(total)}</b></span>}
          </span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !filled.length}>
            {saving ? <Spinner /> : <i className="fa-solid fa-file-import" aria-hidden="true" />}
            {saving ? t("dimp.saving") : t("dimp.save")}
          </button>
        </>
      }
    >
      <p className="dimp-hint">{t("dimp.hint")}</p>

      {restored && (
        <div className="dimp-note" role="status">
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          <span>{t("dimp.draft")}</span>
          {askClear ? (
            <button className="btn btn-danger btn-sm" onClick={clearAll}>{t("dimp.clearYes")}</button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => setAskClear(true)}>{t("dimp.clear")}</button>
          )}
        </div>
      )}

      {/* ⚠ Alohida qo'yish maydoni: Ctrl+V ni katakka bosish kerakligini
          hamma ham bilmaydi — bu yerda ko'rinib turadi. */}
      <textarea
        className="dimp-paste"
        rows={2}
        value=""
        aria-label={t("dimp.pasteHere")}
        placeholder={t("dimp.pasteHere")}
        onPaste={(e) => { e.preventDefault(); insert(e.clipboardData?.getData("text") || "", null); }}
        onChange={(e) => { if (e.target.value.trim()) insert(e.target.value, null); }}
      />

      <div className="dimp-dates">
        <span className="dimp-dates__l">{t("dimp.defaultDate")}</span>
        <div className="seg" role="group" aria-label={t("dimp.defaultDate")}>
          {DAYS.map((d) => (
            <button key={d} type="button" className={`seg__b${days === d ? " is-on" : ""}`}
                    aria-pressed={days === d} onClick={() => setDays(d)}>
              {t(`dimp.d${d}`)}
            </button>
          ))}
        </div>
        <span className="dimp-dates__v ek-num">{showDay(defaultDate)}</span>
      </div>

      <div className="dimp-grid" onPaste={onGridPaste}>
        <div className="dimp-row dimp-row--head" aria-hidden="true">
          <span>№</span>
          <span>{t("dimp.colName")} *</span>
          <span>{t("dimp.colPhone")} <i>({t("dimp.optional")})</i></span>
          <span>{t("dimp.colAmount")} *</span>
          <span>{t("dimp.colDate")}</span>
          <span>{t("dimp.colNote")}</span>
          <span />
        </div>

        {rows.map((r, i) => {
          const last = i === rows.length - 1 && isBlank(r);
          const e = showErr && !last ? errs[r.id] || {} : {};
          const srv = serverErr[r.id];
          const hint = hintOf(r, i);
          const msgs = [...new Set(Object.values(e))].map((k) => t(k));
          const n = i + 1;
          return (
            <div key={r.id} className={`dimp-row${last ? " dimp-row--new" : ""}`} data-row={r.id}>
              <span className="dimp-n ek-num">{n}</span>
              <input
                ref={(el) => { nameRefs.current[r.id] = el; }}
                className={`form-input dimp-name${e.name ? " form-input--error" : ""}`}
                value={r.name}
                maxLength={150}
                autoFocus={i === 0 && !draft}
                aria-label={`${t("dimp.colName")} · ${t("dimp.rowN", { n })}`}
                aria-invalid={!!e.name}
                placeholder={last ? t("dimp.namePh") : t("dimp.colName")}
                onChange={(ev) => patch(r.id, "name", ev.target.value)}
                onKeyDown={(ev) => onKeyDown(ev, r.id)}
              />
              <PhoneField
                className={`form-input ek-num${e.phone ? " form-input--error" : ""}`}
                value={r.phone}
                aria-label={`${t("dimp.colPhone")} · ${t("dimp.rowN", { n })}`}
                aria-invalid={!!e.phone}
                onChange={(ev) => patch(r.id, "phone", ev.target.value)}
                onKeyDown={(ev) => onKeyDown(ev, r.id)}
              />
              <NumField
                kind="money"
                className={`form-input ek-num${e.amount ? " form-input--error" : ""}`}
                value={r.amount}
                placeholder={t("dimp.colAmount")}
                aria-label={`${t("dimp.colAmount")} · ${t("dimp.rowN", { n })}`}
                aria-invalid={!!e.amount}
                onChange={(ev) => patch(r.id, "amount", ev.target.value)}
                onKeyDown={(ev) => onKeyDown(ev, r.id)}
              />
              <input
                className={`form-input ek-num${e.date ? " form-input--error" : ""}`}
                value={r.date}
                inputMode="numeric"
                maxLength={10}
                placeholder={last ? t("dimp.datePh") : showDay(defaultDate)}
                aria-label={`${t("dimp.colDate")} · ${t("dimp.rowN", { n })}`}
                aria-invalid={!!e.date}
                onChange={(ev) => patch(r.id, "date", ev.target.value.replace(/[^\d./-]/g, ""))}
                /* «4.9» → «04.09.2026»: qanday yozilgani emas, nima tushunilgani ko'rinsin. */
                onBlur={() => {
                  const d = parseDate(r.date, { loose: true });
                  if (d && d <= today) patch(r.id, "date", showDay(d));
                }}
                onKeyDown={(ev) => onKeyDown(ev, r.id)}
              />
              <input
                className="form-input"
                value={r.note}
                maxLength={500}
                placeholder={t("dimp.colNote")}
                aria-label={`${t("dimp.colNote")} · ${t("dimp.rowN", { n })}`}
                onChange={(ev) => patch(r.id, "note", ev.target.value)}
                onKeyDown={(ev) => onKeyDown(ev, r.id)}
              />
              {last ? <span /> : (
                <button type="button" className="btn-icon dimp-x" onClick={() => remove(r.id)}
                        aria-label={`${t("dimp.removeRow")} · ${t("dimp.rowN", { n })}`}
                        title={t("dimp.removeRow")}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
              {(msgs.length > 0 || srv) && (
                <p className="dimp-msg dimp-msg--err" role="alert">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>{[...msgs, srv].filter(Boolean).join(" · ")}</span>
                </p>
              )}
              {!msgs.length && !srv && hint && (
                <p className={`dimp-msg dimp-msg--${hint.kind}`}>
                  <i className={`fa-solid ${hint.kind === "warn" ? "fa-triangle-exclamation" : "fa-circle-info"}`}
                     aria-hidden="true" />
                  <span>{hint.text}</span>
                  {hint.phone && (
                    <button type="button" className="btn btn-outline btn-sm"
                            onClick={() => patch(r.id, "phone", hint.phone)}>
                      {t("dimp.useIt")}
                    </button>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="dimp-keys">{t("dimp.enterHint")}</p>

      {/* ⚠ Bu belgi MIJOZGA xabar yuboradi — odatda o'chiq: daftar
          ko'chirilayotganda o'nlab odamga bir vaqtda so'rov ketardi. */}
      <label className="dimp-confirm">
        <input type="checkbox" checked={askConfirm} onChange={(e) => setAskConfirm(e.target.checked)} />
        <span>
          <span className="fw-700">{t("credit.askConfirm")}</span>
          <span className="dimp-confirm__h">{t("credit.askConfirmHint")}</span>
        </span>
      </label>

      {badRows.length > 0 && showErr && (
        <p className="dimp-msg dimp-msg--err" role="status">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>{t("dimp.fixRows", { n: badRows.length })}</span>
        </p>
      )}
    </Modal>
  );
}
