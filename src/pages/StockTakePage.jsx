/* ══════════════════════════════════════════════════════════════════════════
   Inventarizatsiya — TOVAR sanog'i

   Naqd (V10) va naqdsiz (V13) sanog'i bilan bir xil qoida:
   ⚠ KUTILGAN QOLDIQ SANASHDAN OLDIN KO'RSATILMAYDI. Server uni omborchiga
   `null` qilib qaytaradi; bu sahifa ham hech qayerda tizim raqamini
   chiqarmaydi. Ko'rsatilsa xodim javonni sanash o'rniga ekrandagi raqamni
   ko'chirib yozardi va butun sanoqning ma'nosi qolmasdi.

   Sanoq davomida SOTUV TO'XTAMAYDI: farq yopilishda delta sifatida
   qo'llanadi, ya'ni oradagi sotuvlar bekor bo'lmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { inventoryApi, productApi } from "../api";
import { Modal } from "../components";
import { Empty, Field } from "../components/ui";
import { money, quantity as qtyFmt } from "../lib/ek-format";
import { useConfirm } from "../context/ConfirmProvider";
import { useBadge } from "../context/BadgeProvider";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";

const fmtT = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function StockTakePage({ toast }) {
  const confirm = useConfirm();
  const { guard } = useBadge();
  const [session, setSession] = useState(undefined);  // undefined=yuklanmoqda, null=yo'q
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);
  const [busyAct, setBusyAct] = useState(false);
  /* { product, quantity } — skanerlangan tovar uchun miqdor oynasi.
     Miqdor alohida so'raladi: skaner faqat qaysi tovar ekanini biladi,
     javondagi sonni odam sanaydi. */
  const [countFor, setCountFor] = useState(null);
  const [code, setCode] = useState("");
  const codeRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, his] = await Promise.all([
        inventoryApi.stockTake.current(),
        inventoryApi.stockTake.history().catch(() => ({ data: [] })),
      ]);
      setSession(cur.data || null);
      setHistory(his.data || []);
    } catch (err) {
      toast?.error(err.message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  // Skaner maydoni doim fokusda: omborchining qo'li skanerda, sichqonchada emas.
  useEffect(() => { if (session) codeRef.current?.focus(); }, [session, countFor]);

  const doOpen = async () => {
    setBusyAct(true);
    try {
      const r = await inventoryApi.stockTake.open(null);
      toast?.success(r.message);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusyAct(false);
    }
  };

  /* Barkod → tovar. `scan` mahsulot, qadoq va tarozi barkodini ham
     hal qiladi, shuning uchun bu yerda alohida mantiq yozilmaydi. */
  const submitCode = async (raw) => {
    const value = (raw ?? code).trim();
    if (!value) return;
    setCode("");
    try {
      const r = await productApi.scan(value);
      const p = r?.data?.product;
      if (!p) { toast?.error(t("common.notFound")); return; }
      setCountFor({ product: p, quantity: "" });
    } catch (err) {
      toast?.error(err.message);
    }
  };

  const submitCount = async () => {
    setBusyAct(true);
    try {
      await inventoryApi.stockTake.count(countFor.product.id, countFor.quantity);
      setCountFor(null);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusyAct(false);
    }
  };

  const doClose = async () => {
    const ok = await confirm({
      title: t("stocktake.closeTitle"),
      message: t("stocktake.closeConfirm"),
      type: "warning",
      confirmText: t("stocktake.close"),
    });
    if (!ok) return;
    setBusyAct(true);
    try {
      // Kamomad chegaradan oshsa server 428 qaytaradi — `guard` bajik
      // oynasini ochib, tasdiqdan keyin amalni O'ZI qayta yuboradi.
      const r = await guard(() => inventoryApi.stockTake.close());
      toast?.success(r.message);
      await load();
    } catch (err) {
      if (!err?.cancelled) toast?.error(err.message);
    } finally {
      setBusyAct(false);
    }
  };

  const doCancel = async () => {
    const ok = await confirm({
      title: t("stocktake.cancelTitle"),
      message: t("stocktake.cancelConfirm"),
      type: "danger",
      confirmText: t("common.yes"),
    });
    if (!ok) return;
    setBusyAct(true);
    try {
      const r = await inventoryApi.stockTake.cancel();
      toast?.success(r.message);
      await load();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusyAct(false);
    }
  };

  const removeLine = async (line) => {
    try {
      await inventoryApi.stockTake.removeLine(line.id);
      await load();
    } catch (err) {
      toast?.error(err.message);
    }
  };

  if (session === undefined || busy) {
    return <div><h2 className="page-title">{t("stocktake.title")}</h2><SkeletonTable rows={6} cols={["wide", "num", "num", "narrow"]} /></div>;
  }

  const lines = session?.lines || [];
  // Kutilgan qiymat kelgan bo'lsa — foydalanuvchi rahbar (yoki sanoq
  // yopilgan). Ustunlarni shunga qarab chizamiz.
  const reveal = lines.some((l) => l.expectedQuantity != null);

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 className="page-title">{t("stocktake.title")}</h2>
        {session ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={doCancel} disabled={busyAct}>
              <i className="fa-solid fa-xmark" /> {t("common.cancel")}
            </button>
            <button className="btn btn-primary btn-sm" onClick={doClose} disabled={busyAct || !lines.length}>
              {busyAct ? <Spinner /> : <i className="fa-solid fa-check" />} {t("stocktake.close")}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={doOpen} disabled={busyAct}>
            <i className="fa-solid fa-clipboard-list" /> {t("stocktake.start")}
          </button>
        )}
      </div>

      {session ? (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-body">
              <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>{t("stocktake.hint")}</p>
              <input
                ref={codeRef}
                className="form-input mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCode()}
                placeholder={t("stocktake.scanPlaceholder")}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-list-check text-blue" /> {t("stocktake.counted")} ({lines.length})
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("products.col")}</th>
                    <th>{t("stocktake.countedQty")}</th>
                    {/* ⚠ Bu ikkala ustun omborchiga UMUMAN chizilmaydi */}
                    {reveal && <th>{t("stocktake.expected")}</th>}
                    {reveal && <th>{t("stocktake.difference")}</th>}
                    <th>{t("sales.colCashier")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length ? lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="fw-700">{l.productName}</div>
                        <div className="text-muted mono" style={{ fontSize: 12 }}>{l.barcode}</div>
                      </td>
                      <td className="mono fw-700">{qtyFmt(l.countedQuantity)}</td>
                      {reveal && <td className="mono">{qtyFmt(l.expectedQuantity)}</td>}
                      {reveal && (
                        <td className="mono fw-800"
                            style={Number(l.difference) !== 0 ? { color: "var(--fg-danger)" } : undefined}>
                          {Number(l.difference) > 0 ? "+" : ""}{qtyFmt(l.difference)}
                        </td>
                      )}
                      <td className="text-muted" style={{ fontSize: 12 }}>{l.countedBy}</td>
                      <td>
                        <button className="btn-icon danger" title={t("common.delete")} onClick={() => removeLine(l)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={reveal ? 6 : 4}><Empty icon="fa-barcode" text={t("stocktake.nothingCounted")} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa-solid fa-clock-rotate-left text-blue" /> {t("stocktake.history")}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("common.status")}</th>
                  <th>{t("sec.openedAt")}</th>
                  <th>{t("shift.closedAt")}</th>
                  <th>{t("stocktake.shortage")}</th>
                  <th>{t("stocktake.surplus")}</th>
                </tr>
              </thead>
              <tbody>
                {history.length ? history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono">{h.id}</td>
                    <td>
                      <span className={`badge badge-${h.status === "CLOSED" ? "green" : h.status === "OPEN" ? "blue" : "red"}`}>
                        {t(`stocktake.status.${h.status}`)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{fmtT(h.openedAt)}</td>
                    <td style={{ fontSize: 13 }}>{fmtT(h.closedAt)}</td>
                    <td className="mono fw-700" style={Number(h.shortageValue) > 0 ? { color: "var(--fg-danger)" } : undefined}>
                      {h.shortageValue == null ? "—" : money(h.shortageValue)}
                    </td>
                    <td className="mono">{h.surplusValue == null ? "—" : money(h.surplusValue)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6}><Empty icon="fa-clipboard-list" text={t("stocktake.noHistory")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Miqdor oynasi ──────────────────────────────────────────────── */}
      {countFor && (
        <Modal
          title={countFor.product.name}
          onClose={() => setCountFor(null)}
          maxWidth={420}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCountFor(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary btn-sm" onClick={submitCount}
                      disabled={busyAct || countFor.quantity === ""}>
                <i className="fa-solid fa-check" /> {t("common.save")}
              </button>
            </>
          }
        >
          <label className="form-label">{t("stocktake.countedQty")}</label>
          <Field kind="qty" unit={countFor.product?.unit}
                 className="form-input ek-num" autoFocus
                 value={countFor.quantity}
                 onKeyDown={(e) => e.key === "Enter" && countFor.quantity !== "" && submitCount()}
                 onChange={(e) => setCountFor({ ...countFor, quantity: e.target.value })} />
          {/* ⚠ Bu yerda tizim qoldig'i ATAYLAB ko'rsatilmaydi. */}
          <p className="form-hint">{t("stocktake.countHint")}</p>
        </Modal>
      )}
    </div>
  );
}
