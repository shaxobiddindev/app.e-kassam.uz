import { useCallback, useEffect, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { breezzApi } from "../../api";
import { Modal } from "../../components";
import { useConfirm } from "../../context/ConfirmProvider";
import { SkeletonCards } from "../../components/ek/Loading";
import { useLoading } from "../../lib/use-loading";
import { dateTime } from "../../lib/ek-format";
import { asArray } from "../../lib/ek-array";

/* ══════════════════════════════════════════════════════════════════════════
   BREEZZ ULANISHI — «Boshqaruv → Breezz» (V140, E2′)

   Breezz — yetkazish ilovasi. U filial tovarlarini, narxi va qoldig'ini
   o'zida ko'rsatadi. Egasining qarori (umumiy hujjat §12): filialni
   Breezz ADMINI so'raydi, bu yerda EGASI tasdiqlaydi.

   ⚠ FAQAT EGASI (menyu ham, server ham): tasdiq — egalikning isboti, u
   do'konning butun katalogini boshqa platformaga ochadi.

   ⚠ BOSH DO'KON VA FILIALLAR BIRGA. Egasining hisobi bosh do'konda,
   Breezz esa filial bo'yicha ulanadi — har kartochka o'z ID si, so'rovlari
   va ulanishi bilan.

   ⚠ ID (`shopRef`) MAXFIY EMAS — u mijoz QR idagi ochiq havolaning o'zi.
   Egasi uni Breezz adminiga aytadi; tasdiqsiz u hech narsa bermaydi.
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY = { shops: [], pendingCount: 0 };

const fromResponse = (res) => ({
  shops: asArray(res?.data?.shops),
  pendingCount: Number(res?.data?.pendingCount) || 0,
});

export default function BreezzPage({ toast }) {
  const [state, setState]         = useState(EMPTY);
  const [loading, setLoading]     = useState(true);
  const busy                      = useLoading(loading);
  const [working, setWorking]     = useState(null);   // bajarilayotgan so'rov ID si
  const [rejecting, setRejecting] = useState(null);   // { request }
  const [reason, setReason]       = useState("");
  const confirm                   = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(fromResponse(await breezzApi.state()));
    } catch (err) {
      toast.error(err.message || t("breezz.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* Har amal oynaning YANGI holatini qaytaradi (server) — alohida so'rov yo'q.
     Xatoda esa holat qayta o'qiladi: so'rov shu orada Breezz tomonidan
     bekor qilingan yoki muddati o'tgan bo'lishi mumkin. */
  const run = async (requestId, call, okText) => {
    setWorking(requestId);
    try {
      setState(fromResponse(await call()));
      toast.success(okText);
      return true;
    } catch (err) {
      toast.error(err.message || t("common.unknownError"));
      load();
      return false;
    } finally {
      setWorking(null);
    }
  };

  const copy = async (ref) => {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.unknownError"));
    }
  };

  const approve = async (shop, req) => {
    const replaces = shop.link && shop.link.merchantName;
    const ok = await confirm({
      title: t("breezz.approveTitle"),
      message: t("breezz.approveMsg", { name: req.merchantName, shop: shop.shopName })
        + (replaces ? " " + t("breezz.approveReplaces", { old: shop.link.merchantName }) : ""),
      type: "warning",
      confirmText: t("breezz.approve"),
    });
    if (ok) run(req.requestId, () => breezzApi.approve(req.requestId), t("breezz.approved"));
  };

  const revoke = async (shop) => {
    const ok = await confirm({
      title: t("breezz.revokeTitle"),
      message: t("breezz.revokeMsg", { name: shop.link.merchantName }),
      type: "danger",
      confirmText: t("breezz.revoke"),
    });
    if (ok) run(shop.link.requestId, () => breezzApi.revoke(shop.link.requestId), t("breezz.revoked"));
  };

  const openReject = (req) => {
    setReason("");
    setRejecting({ request: req });
  };

  const doReject = async () => {
    const req = rejecting.request;
    const done = await run(req.requestId, () => breezzApi.reject(req.requestId, reason.trim()), t("breezz.rejected"));
    if (done) setRejecting(null);
  };

  return (
    <div>
      <div className="page-header breezz-head">
        <div>
          <h2 className="page-title">{t("breezz.title")}</h2>
          <p className="breezz-lead">{t("breezz.lead")}</p>
        </div>
        <button className="btn btn-outline" onClick={load}>
          <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
        </button>
      </div>

      {busy ? <SkeletonCards count={2} className="breezz-grid" /> : (
        <div className="breezz-grid">
          {state.shops.map((s) => (
            <ShopCard key={s.shopId} shop={s} working={working}
                      onCopy={copy} onApprove={approve} onReject={openReject} onRevoke={revoke} />
          ))}
        </div>
      )}

      {rejecting && (
        <Modal
          title={t("breezz.rejectTitle")}
          onClose={() => setRejecting(null)}
          maxWidth={440}
          footer={
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", width: "100%" }}>
              <button className="btn btn-outline" onClick={() => setRejecting(null)}>{t("common.cancel")}</button>
              <button className="btn btn-danger" onClick={doReject}
                      disabled={working === rejecting.request.requestId}>
                {t("breezz.reject")}
              </button>
            </div>
          }
        >
          <p className="breezz-meta" style={{ marginTop: 0 }}>{rejecting.request.merchantName}</p>
          <label className="breezz-label" htmlFor="breezz-reason">{t("breezz.rejectReason")}</label>
          <textarea id="breezz-reason" className="form-input" rows={3} maxLength={300}
                    value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder={t("breezz.rejectReasonPlaceholder")} />
        </Modal>
      )}
    </div>
  );
}

/* ── Bitta filial kartochkasi ────────────────────────────────────────── */
function ShopCard({ shop, working, onCopy, onApprove, onReject, onRevoke }) {
  const link = shop.link;
  const pending = asArray(shop.pending);
  const titleId = `breezz-shop-${shop.shopId}`;

  return (
    <section className="card breezz-card" aria-labelledby={titleId}>
      <header className="breezz-card__head">
        <h3 id={titleId} className="breezz-card__title">{shop.shopName}</h3>
        <span className="badge badge-blue">{t(shop.branch ? "breezz.branch" : "breezz.main")}</span>
      </header>

      <div className="breezz-ref">
        <div>
          <div className="breezz-label">{t("breezz.ref")}</div>
          <code className="ek-num breezz-ref__value">{shop.shopRef || "—"}</code>
        </div>
        {shop.shopRef && (
          <button className="btn btn-outline" onClick={() => onCopy(shop.shopRef)}>
            <i className="fa-solid fa-copy" aria-hidden="true" /> {t("common.copy")}
          </button>
        )}
      </div>
      <p className="breezz-hint">{t("breezz.refHint")}</p>

      {/* ⚠ Holat RANG bilan emas, MATN va ikonka bilan ham (6-qoida). */}
      <div className={`breezz-status${link ? " is-linked" : ""}`}>
        {link ? (
          <>
            <div className="breezz-status__line">
              <i className="fa-solid fa-link" aria-hidden="true" /> <strong>{t("breezz.linked")}:</strong> {link.merchantName}
            </div>
            {link.merchantAddress && <div className="breezz-meta">{link.merchantAddress}</div>}
            <div className="breezz-meta">
              {t("breezz.approvedBy")}: {link.approvedBy || "—"} · <span className="ek-num">{dateTime(link.approvedAt)}</span>
            </div>
            <div className="breezz-meta">
              {link.lastUsedAt
                ? <>{t("breezz.lastSync")}: <span className="ek-num">{dateTime(link.lastUsedAt)}</span></>
                : t("breezz.noSyncYet")}
            </div>
            <button className="btn btn-danger" onClick={() => onRevoke(shop)} disabled={working === link.requestId}>
              <i className="fa-solid fa-link-slash" aria-hidden="true" /> {t("breezz.revoke")}
            </button>
          </>
        ) : (
          <div className="breezz-status__line">
            <i className="fa-solid fa-circle-minus" aria-hidden="true" /> {t("breezz.notLinked")}
          </div>
        )}
      </div>

      {pending.length > 0 ? (
        <div className="breezz-pending">
          <h4 className="breezz-label">{t("breezz.pending")} (<span className="ek-num">{pending.length}</span>)</h4>
          {pending.map((r) => (
            <div key={r.requestId} className="breezz-req">
              <div className="breezz-status__line">
                <i className="fa-solid fa-store" aria-hidden="true" /> <strong>{r.merchantName}</strong>
              </div>
              {r.merchantAddress && <div className="breezz-meta">{r.merchantAddress}</div>}
              {r.requestedBy && <div className="breezz-meta">{t("breezz.requestedBy")}: {r.requestedBy}</div>}
              <div className="breezz-meta">
                {t("breezz.requestedAt")}: <span className="ek-num">{dateTime(r.createdAt)}</span>
                {" · "}{t("breezz.expiresAt")}: <span className="ek-num">{dateTime(r.expiresAt)}</span>
              </div>
              {link && (
                <div className="breezz-warn">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("breezz.replaceWarn", { old: link.merchantName })}
                </div>
              )}
              <div className="breezz-req__actions">
                <button className="btn btn-primary" onClick={() => onApprove(shop, r)} disabled={working === r.requestId}>
                  <i className="fa-solid fa-check" aria-hidden="true" /> {t("breezz.approve")}
                </button>
                <button className="btn btn-outline" onClick={() => onReject(r)} disabled={working === r.requestId}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" /> {t("breezz.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !link && (
        <p className="breezz-hint">{t("breezz.empty")}</p>
      )}
    </section>
  );
}
