/* ══════════════════════════════════════════════════════════════════════════
   Filiallararo ko'chirish (V22)

   Filial — alohida do'kon: o'z tovarlari, o'z ombori. Ilgari tovarni
   filialga berish degan amal umuman yo'q edi va omborchi buni ikkita
   bog'lanmagan yozuv bilan qilardi: bir tomonda chiqit, ikkinchi tomonda
   kirim. Yo'lda yo'qolgani esa hech qayerda ko'rinmasdi.

   ⚠ IKKI QADAM. Yuborishda tovar jo'natuvchidan CHIQADI, qabul qilishda
   qabul qiluvchiga KIRADI. Orasidagi vaqt — «yo'lda»: tovar mashinada va
   uni hech kim sota olmaydi. Bu chalkashlik emas, haqiqat.
   ══════════════════════════════════════════════════════════════════════════ */

import { Fragment, useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { transferApi, productApi } from "../api";
import { Modal } from "../components";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, Field, FormGroup, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { money, shortDate } from "../lib/ek-format";
import { transferStatus, unitLabel } from "../lib/ek-labels";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

const TONE_COLOR = { success: "green", danger: "red", warning: "yellow", info: "blue", neutral: "gray" };

/* Chiqit turkumlari — yetishmovchilikda so'raladi. Ro'yxat `InventoryPage`
   dagi bilan bir xil tartibda: xodim ikkala joyda bir xil narsani ko'rsin.
   ⚠ RECOUNT bu yerda YO'Q: yo'lda yo'qolgan tovar hisob xatosi emas. */
const SHORTAGE_REASONS = [
  { value: "BREAKAGE",        icon: "fa-hammer" },
  { value: "SPOILAGE",        icon: "fa-triangle-exclamation" },
  { value: "THEFT",           icon: "fa-user-secret" },
  { value: "EXPIRY",          icon: "fa-hourglass-end" },
  { value: "OTHER",           icon: "fa-ellipsis" },
];

const num = (v) => (v == null || v === "" ? 0 : Number(v));

export default function TransfersPage({ toast }) {
  const [tab, setTab] = useState("incoming");     // incoming | outgoing
  const [targets, setTargets] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(null);         // yangi ko'chirish
  const [search, setSearch] = useState("");
  const [found, setFound] = useState([]);
  const [accept, setAccept] = useState(null);     // { transfer, lines: {...} }
  /* Yorliq skanerlash oynasi. `{ product, mode, onDone }` — yuborishda ham,
     qabul qilishda ham bitta komponent ishlaydi (mode="receive": kodlar
     to'planadi, tekshiruvni server bajaradi). */
  const [scan, setScan] = useState(null);
  const [cancel, setCancel] = useState(null);     // { transfer, reason }
  const [view, setView] = useState(null);         // yopilgan hujjat tafsiloti

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tg, out, inc] = await Promise.all([
        transferApi.targets(), transferApi.outgoing(), transferApi.incoming(),
      ]);
      setTargets(tg.data || []);
      setOutgoing(out.data || []);
      setIncoming(inc.data || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* ── Yangi ko'chirish ─────────────────────────────────────────────── */

  const openNew = () => {
    if (!targets.length) return;
    setForm({ toShopId: String(targets[0].id), note: "", lines: [] });
    setSearch("");
    setFound([]);
  };

  /* Qidiruv barkodni ham qamraydi — skaner bilan ham, qo'lda ham ishlaydi. */
  const runSearch = async (q) => {
    setSearch(q);
    if (q.trim().length < 2) { setFound([]); return; }
    try {
      const r = await productApi.search(q.trim(), 0, 12);
      setFound(r.data || []);
    } catch (_) { setFound([]); }
  };

  const addLine = (p) => {
    setSearch("");
    setFound([]);
    setForm((f) => {
      // Bir tovar ikki marta qo'shilmasin: server ularni baribir
      // birlashtiradi, lekin ekranda ikkita qator chalkashtirardi.
      if (f.lines.some((l) => l.productId === p.id)) return f;
      return { ...f, lines: [...f.lines, {
        productId: p.id, productName: p.name, unit: p.unit, quantity: "1",
        markingGroup: p.markingGroup || null, codes: null,
      }] };
    });
    /* ⚠ Markirovkali tovarda miqdor QO'LDA yozilmaydi — u skanerlangan
       yorliqlar sonidan chiqadi. Shuning uchun tovar qo'shilishi bilan
       skaner oynasi ochiladi: aks holda omborchi "20" deb yozib, keyin
       nega saqlanmadi deb qolardi. */
    if (p.markingGroup) {
      setScan({
        product: p,
        onDone: (codes) => {
          setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.productId === p.id
            ? { ...l, codes, quantity: String(codes.length) } : l)) }));
          setScan(null);
        },
      });
    }
  };

  const setLine = (i, value) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, quantity: value } : l)) }));
  const dropLine = (i) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const send = async () => {
    setSaving(true);
    try {
      await transferApi.create({
        toShopId: Number(form.toShopId),
        note: form.note || null,
        lines: form.lines.map((l) => ({
          productId: l.productId,
          quantity: num(l.quantity),
          markingCodes: l.codes || null,
        })),
      });
      toast?.success(t("transfer.saved"));
      setForm(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Qabul qilish ─────────────────────────────────────────────────── */

  const openAccept = (tr) => {
    setAccept({
      transfer: tr,
      note: "",
      // Standart — TO'LIQ qabul: eng ko'p uchraydigan hol bir bosishda
      // yopilishi kerak, aks holda raqamlarni o'qimasdan bosish odat bo'ladi.
      lines: Object.fromEntries(tr.lines.map((l) => [l.id, {
        received: String(l.quantity), reason: "", note: "",
      }])),
    });
  };

  const setAcceptLine = (lineId, key, value) =>
    setAccept((a) => ({ ...a, lines: { ...a.lines, [lineId]: { ...a.lines[lineId], [key]: value } } }));

  /**
   * Markirovkali tovarda kelgan yorliqlar TOVAR bo'yicha skanerlanadi.
   *
   * ⚠ Qatorlar partiya (muddat) bo'yicha bo'lingan, kod esa qaysi
   * partiyadan ekanini bilmaydi. Shuning uchun skanerlangan miqdor
   * qatorlar bo'ylab FEFO tartibida taqsimlanadi — server ham AYNAN
   * shunday qiladi, ikkalasi bir xil natija bermasa ekrandagi raqam
   * yolg'on bo'lardi.
   */
  const applyScannedCodes = (productId, codes) =>
    setAccept((a) => {
      let left = codes.length;
      const lines = { ...a.lines };
      for (const l of a.transfer.lines) {
        if (l.productId !== productId) continue;
        const take = Math.min(left, num(l.quantity));
        left -= take;
        lines[l.id] = { ...lines[l.id], received: String(take), codes: null };
      }
      // Kodlarning o'zi TOVARNING birinchi qatoriga yoziladi — server
      // ularni baribir tovar bo'yicha birlashtiradi.
      const first = a.transfer.lines.find((l) => l.productId === productId);
      if (first) lines[first.id] = { ...lines[first.id], codes };
      return { ...a, lines };
    });

  /** Shu tovar bo'yicha skanerlangan yorliqlar soni (`null` — skanerlanmagan). */
  const scannedCount = (productId) => {
    const first = accept?.transfer?.lines?.find((l) => l.productId === productId);
    const codes = first && accept.lines[first.id]?.codes;
    return codes ? codes.length : null;
  };

  const acceptShortage = (line) => {
    const row = accept?.lines?.[line.id];
    return Math.max(0, num(line.quantity) - num(row?.received));
  };

  const acceptBlocked = accept?.transfer?.lines?.some((l) => {
    const row = accept.lines[l.id];
    const received = num(row?.received);
    if (received < 0 || received > num(l.quantity)) return true;
    if (received < num(l.quantity) && !row?.reason) return true;
    if (row?.reason === "OTHER" && !row?.note?.trim()) return true;
    return false;
  });

  const submitAccept = async () => {
    setSaving(true);
    try {
      await transferApi.accept(accept.transfer.id, {
        note: accept.note || null,
        lines: accept.transfer.lines.map((l) => {
          const row = accept.lines[l.id];
          return {
            lineId: l.id,
            receivedQuantity: num(row.received),
            writeOffReason: row.reason || null,
            note: row.note || null,
            markingCodes: row.codes || null,
          };
        }),
      });
      toast?.success(t("transfer.accepted"));
      setAccept(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async () => {
    setSaving(true);
    try {
      await transferApi.cancel(cancel.transfer.id, cancel.reason);
      toast?.success(t("transfer.cancelled"));
      setCancel(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Ko'rinish ────────────────────────────────────────────────────── */

  const StatusBadge = ({ value }) => {
    const e = transferStatus(value);
    return (
      <span className={`badge badge-${TONE_COLOR[e.tone] || "blue"}`}>
        <i className={`fa-solid ${e.icon}`} aria-hidden="true" /> {e.label}
      </span>
    );
  };

  const rows = tab === "incoming" ? incoming : outgoing;

  const table = (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>{t("common.date")}</th>
          <th>{tab === "incoming" ? t("transfer.from") : t("transfer.to")}</th>
          <th>{t("transfer.lines")}</th>
          <th>{t("transfer.value")}</th>
          <th>{t("common.status")}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((r) => (
          <tr key={r.id}>
            <td className="mono">{r.id}</td>
            <td className="mono" style={{ fontSize: 13 }}>{(r.sentAt || "").slice(0, 10)}</td>
            <td className="fw-700">{tab === "incoming" ? r.fromShopName : r.toShopName}</td>
            <td className="mono">{r.lines?.length || 0}</td>
            <td className="mono fw-700">
              {money(r.totalCost)}
              {/* Yetishmovchilik — jo'natuvchining yo'qotishi, shuning uchun
                  jamining yonida va ogohlantirish rangida. */}
              {num(r.shortageCost) > 0 && (
                <div style={{ fontSize: 12, color: "var(--fg-danger)" }}>
                  −{money(r.shortageCost)} {t("transfer.shortage").toLowerCase()}
                </div>
              )}
            </td>
            <td><StatusBadge value={r.status} /></td>
            <td style={{ whiteSpace: "nowrap" }}>
              {r.status === "SENT" && tab === "incoming" && (
                <button className="btn btn-primary btn-sm" onClick={() => openAccept(r)}>
                  <i className="fa-solid fa-inbox" /> {t("transfer.accept")}
                </button>
              )}
              {r.status === "SENT" && (
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 6 }}
                        onClick={() => setCancel({ transfer: r, reason: "" })}>
                  <i className="fa-solid fa-rotate-left" /> {t("transfer.cancelDoc")}
                </button>
              )}
              {r.status !== "SENT" && (
                <button className="btn-icon" title={t("common.details")} onClick={() => setView(r)}>
                  <i className="fa-solid fa-eye" />
                </button>
              )}
            </td>
          </tr>
        )) : (
          <tr><td colSpan={7}>
            <Empty icon="fa-truck-fast"
                   text={tab === "incoming" ? t("transfer.noneIn") : t("transfer.noneOut")} />
          </td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("transfer.title")}</h2>
        {targets.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <i className="fa-solid fa-plus" /> {t("transfer.new")}
          </button>
        )}
      </div>

      {/* Filialsiz do'konda bo'lim bo'sh jadval bo'lib turmasin — nima
          qilish kerakligi aytiladi. */}
      {!busy && !targets.length ? (
        <div className="card" style={{ padding: 20 }}>
          <Empty icon="fa-store" text={t("transfer.noBranches")} />
        </div>
      ) : (
        <>
          <div className="cat-tabs" role="tablist" style={{ marginBottom: 14 }}>
            {[["incoming", t("transfer.incoming")], ["outgoing", t("transfer.outgoing")]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k}
                      className={`cat-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
                {label}
                {k === "incoming" && incoming.some((x) => x.status === "SENT") && (
                  <span className="badge badge-yellow" style={{ marginLeft: 6 }}>
                    {incoming.filter((x) => x.status === "SENT").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {busy
            ? <SkeletonTable rows={6} cols={["narrow", "text", "wide", "num", "num", "text"]} />
            : <div className="card"><div className="table-wrap">{table}</div></div>}
        </>
      )}

      {/* ── Yangi ko'chirish ───────────────────────────────────────────── */}
      {form && (
        <Modal
          title={t("transfer.new")}
          onClose={() => setForm(null)}
          maxWidth={720}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              {/* Markirovkali qatorda yorliq skanerlanmagan bo'lsa ham
                  saqlash yopiq: server baribir rad etadi, lekin xato
                  tugma bosilgandan keyin emas, oldin ko'rinsin. */}
              <button className="btn btn-primary btn-sm" onClick={send}
                      disabled={saving || !form.lines.length
                                || form.lines.some((l) => !(num(l.quantity) > 0)
                                                          || (l.markingGroup && !l.codes?.length))}>
                {saving ? <Spinner /> : <i className="fa-solid fa-truck-fast" />} {t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={t("transfer.to")}>
            <Select block variant="field" ariaLabel={t("transfer.to")}
                    value={form.toShopId}
                    onChange={(v) => setForm({ ...form, toShopId: v })}
                    options={targets.map((s) => ({ value: String(s.id), label: s.name, icon: "fa-store" }))} />
          </FormGroup>

          <FormGroup label={t("products.search")}>
            <SearchBar value={search} onChange={runSearch} placeholder={t("products.search")} />
            {found.length > 0 && (
              <div className="card" style={{ marginTop: 6, maxHeight: 220, overflowY: "auto" }}>
                {found.map((p) => (
                  <button key={p.id} type="button" className="list-row"
                          onClick={() => addLine(p)}
                          style={{ display: "flex", justifyContent: "space-between", width: "100%",
                                   minHeight: 44, padding: "8px 12px", background: "none",
                                   border: "none", borderBottom: "1px solid var(--border-subtle)",
                                   cursor: "pointer", font: "inherit", textAlign: "left" }}>
                    <span>{p.name}</span>
                    {/* Qoldiq ko'rsatiladi: omborchi qancha yuborishi
                        mumkinligini shu yerda ko'rmasa, formani yuborib
                        «yetmaydi» xatosiga urilardi. */}
                    <span className="mono text-muted">{p.stockQuantity ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </FormGroup>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th style={{ width: 150 }}>{t("transfer.qty")}</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.length ? form.lines.map((l, i) => (
                  <tr key={l.productId}>
                    <td className="fw-700">{l.productName}</td>
                    <td>
                      {/* Markirovkada miqdor yorliqlardan chiqadi — maydon
                          yopiq, o'rniga qayta skanerlash tugmasi. */}
                      {l.markingGroup ? (
                        <button className="btn btn-outline btn-sm"
                                onClick={() => setScan({
                                  product: { id: l.productId, name: l.productName, markingGroup: l.markingGroup },
                                  onDone: (codes) => {
                                    setForm((f) => ({ ...f, lines: f.lines.map((x) => (x.productId === l.productId
                                      ? { ...x, codes, quantity: String(codes.length) } : x)) }));
                                    setScan(null);
                                  },
                                })}>
                          <i className="fa-solid fa-barcode" /> {l.codes?.length || 0} {t("marking.pcs")}
                        </button>
                      ) : (
                        <Field className="form-input mono" kind="qty" unit={l.unit}
                               value={l.quantity} onChange={(e) => setLine(i, e.target.value)} />
                      )}
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => dropLine(i)} title={t("common.delete")}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3}><Empty icon="fa-box" text={t("transfer.emptyLines")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <FormGroup label={t("common.note")}>
            <Field maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </FormGroup>
        </Modal>
      )}

      {/* ── Qabul qilish ──────────────────────────────────────────────── */}
      {accept && (
        <Modal
          title={`${t("transfer.acceptTitle")} #${accept.transfer.id}`}
          onClose={() => setAccept(null)}
          maxWidth={760}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setAccept(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={submitAccept} disabled={saving || acceptBlocked}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />} {t("transfer.accept")}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ marginTop: 0 }}>{t("transfer.acceptHint")}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("inv.expiry")}</th>
                  <th>{t("transfer.sentQty")}</th>
                  <th style={{ width: 130 }}>{t("transfer.receivedQty")}</th>
                </tr>
              </thead>
              <tbody>
                {accept.transfer.lines.map((l) => {
                  const row = accept.lines[l.id];
                  const missing = acceptShortage(l);
                  return (
                    <Fragment key={l.id}>
                      <tr>
                        <td className="fw-700">
                          {l.productName}
                          <div className="text-muted" style={{ fontSize: 12 }}>{unitLabel(l.unit)}</div>
                        </td>
                        <td className="mono" style={{ fontSize: 13 }}>{shortDate(l.expiryDate)}</td>
                        <td className="mono">{l.quantity}</td>
                        <td>
                          {/* Markirovkada miqdor qo'lda yozilmaydi: qabul
                              qiluvchi yetib kelgan yorliqlarni skanerlaydi
                              va son shu ro'yxatdan chiqadi. */}
                          {l.markingGroup ? (
                            <button className="btn btn-outline btn-sm"
                                    onClick={() => setScan({
                                      product: { id: l.productId, name: l.productName, markingGroup: l.markingGroup },
                                      onDone: (codes) => { applyScannedCodes(l.productId, codes); setScan(null); },
                                    })}>
                              <i className="fa-solid fa-barcode" />{" "}
                              {scannedCount(l.productId) == null
                                ? t("marking.scanArrived")
                                : `${row.received} ${t("marking.pcs")}`}
                            </button>
                          ) : (
                            <Field className="form-input mono" kind="qty" unit={l.unit}
                                   max={String(l.quantity)}
                                   value={row.received}
                                   onChange={(e) => setAcceptLine(l.id, "received", e.target.value)} />
                          )}
                        </td>
                      </tr>
                      {/* Turkum faqat KAMROQ kelganda so'raladi — har qatorda
                          turaversa, to'liq qabulda ham to'ldirish kerakday
                          ko'rinardi. */}
                      {missing > 0 && (
                        <tr>
                          <td colSpan={4} style={{ background: "var(--bg-warning-subtle)" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="fw-700" style={{ color: "var(--fg-warning)" }}>
                                <i className="fa-solid fa-triangle-exclamation" /> {t("transfer.shortage")}: {missing}
                              </span>
                              <Select variant="field" ariaLabel={t("transfer.shortage")}
                                      value={row.reason}
                                      onChange={(v) => setAcceptLine(l.id, "reason", v)}
                                      options={SHORTAGE_REASONS.map((r) => ({
                                        value: r.value, icon: r.icon, label: t(`enum.writeOff.${r.value}`),
                                      }))} />
                              <Field style={{ flex: 1, minWidth: 180 }}
                                     placeholder={t("inv.reason")}
                                     value={row.note}
                                     onChange={(e) => setAcceptLine(l.id, "note", e.target.value)} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <FormGroup label={t("common.note")}>
            <Field maxLength={500} value={accept.note} onChange={(e) => setAccept({ ...accept, note: e.target.value })} />
          </FormGroup>
        </Modal>
      )}

      {/* ── Bekor qilish ──────────────────────────────────────────────── */}
      {cancel && (
        <Modal
          title={`${t("transfer.cancelTitle")} #${cancel.transfer.id}`}
          onClose={() => setCancel(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCancel(null)}>{t("common.cancel")}</button>
              <button className="btn btn-danger btn-sm" onClick={submitCancel} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-rotate-left" />} {t("transfer.cancelDoc")}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ marginTop: 0 }}>{t("transfer.cancelHint")}</p>
          <FormGroup label={t("transfer.cancelReason")}>
            <Field maxLength={500} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} />
          </FormGroup>
        </Modal>
      )}

      {/* ── Yorliq skanerlash ─────────────────────────────────────────── */}
      {scan && (
        <MarkingScanModal
          product={scan.product}
          mode="receive"
          onDone={scan.onDone}
          onClose={() => setScan(null)}
        />
      )}

      {/* ── Yopilgan hujjat ───────────────────────────────────────────── */}
      {view && (
        <Modal title={`#${view.id} · ${view.fromShopName} → ${view.toShopName}`}
               onClose={() => setView(null)} maxWidth={720}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("inv.expiry")}</th>
                  <th>{t("transfer.sentQty")}</th>
                  <th>{t("transfer.receivedQty")}</th>
                  <th>{t("inv.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {view.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="fw-700">{l.productName}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{shortDate(l.expiryDate)}</td>
                    <td className="mono">{l.quantity}</td>
                    <td className="mono">{l.receivedQuantity ?? "—"}</td>
                    <td className="text-muted">
                      {l.writeOffReason && (
                        <span className="badge badge-yellow" style={{ marginRight: 6 }}>
                          {t(`enum.writeOff.${l.writeOffReason}`)}
                        </span>
                      )}
                      {l.note || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.note && <p className="text-muted">{view.note}</p>}
        </Modal>
      )}
    </div>
  );
}
