import Modal from "./Modal";
import { t } from "../lib/ek-i18n";
import { unitLabel } from "../lib/ek-labels";

/* ══════════════════════════════════════════════════════════════════════════
   SKANERLANGAN TOVAR OYNASI (2026-10-01) — Katalog va Ombor uchun BITTA

   Holat `lib/ek-scan-result.js` da hal qilinadi, amallar esa sahifaning
   o'zidan keladi: har sahifa o'z ishini biladi (Katalog — tahrirlash,
   yorliq, sotuvdan olish…; Ombor — kirim, to'g'irlash, partiyalar…).
   Shuning uchun bu yerda hech qanday so'rov yo'q — faqat chizish.

   ⚠ Amal tugmalari ≥ 48px va ikonka bilan MATN (3- va 6-qoida): oyna
   ko'pincha qo'lda skaner bilan, tik turib ishlatiladi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @param outcome   `scanOutcome(...)` natijasi; `null` — oyna yopiq
 * @param actions   topilgan tovar uchun `{ key, icon, label, onClick, danger?, busy? }`
 * @param extra     sahifa ko'rsatadigan qo'shimcha ma'lumot (narx, qoldiq…)
 * @param onCopy    `(suggestion, code, verified)` — faqat Katalogda
 * @param onCreate  `(code)` — yangi tovar formasi; yo'q bo'lsa tugma ham yo'q
 * @param onRestore `(archivedMatch)` — arxivdan tiklash; yo'q bo'lsa tugma ham yo'q
 */
export default function ScanResultModal({
  outcome, actions = [], extra = null, onClose, onCopy, onCreate, onRestore,
}) {
  if (!outcome) return null;
  const { kind, code } = outcome;

  if (kind === "found") {
    const p = outcome.product;
    return (
      <Modal title={p.name} onClose={onClose} maxWidth={560}>
        <div className="scan-sum">
          <div className="scan-sum__row">
            <span className="scan-sum__label">{t("products.barcode")}</span>
            <span className="ek-num">{code}</span>
          </div>
          {outcome.packLabel && (
            <div className="scan-sum__note">
              <i className="fa-solid fa-box" aria-hidden="true" /> {t("scan.pack", { label: outcome.packLabel })}
            </div>
          )}
        </div>
        {extra}
        {actions.length > 0 && (
          <div className="scan-acts">
            {actions.map((a) => (
              <button key={a.key} type="button" onClick={a.onClick} disabled={a.busy}
                      className={`scan-act${a.danger ? " scan-act--danger" : ""}`}>
                <i className={`fa-solid ${a.icon}`} aria-hidden="true" />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    );
  }

  if (kind === "archived") {
    const a = outcome.archived;
    return (
      <Modal title={t("scan.archivedTitle")} onClose={onClose}
             footer={onRestore && a.canRestore && (
               <button className="btn btn-primary" onClick={() => onRestore(a)}>
                 <i className="fa-solid fa-rotate-left" aria-hidden="true" /> {t("products.restore")}
               </button>
             )}>
        <p className="scan-text">{t("scan.archived", { name: a.name })}</p>
        <p className="scan-text ek-num">{code}</p>
      </Modal>
    );
  }

  if (kind === "otherBranch") {
    return (
      <Modal title={t("scan.otherBranchTitle")} onClose={onClose}>
        <p className="scan-text">{t("scan.otherBranch", { shop: outcome.shopName })}</p>
        <p className="scan-text ek-num">{code}</p>
      </Modal>
    );
  }

  if (kind === "suggest") {
    const s = outcome.suggestion;
    const img = s.thumbUrl || s.imageUrl;
    return (
      <Modal title={t("scan.notHereTitle")} onClose={onClose} maxWidth={560}
             footer={
               <>
                 {onCreate && (
                   <button className="btn btn-outline" onClick={() => onCreate(code)}>{t("scan.ownEntry")}</button>
                 )}
                 <button className="btn btn-primary" onClick={() => onCopy(s, code, outcome.verified)}>
                   <i className="fa-solid fa-copy" aria-hidden="true" /> {t("scan.copy")}
                 </button>
               </>
             }>
        <div className="scan-sug">
          {img
            ? <img className="scan-sug__img" src={img} alt="" />
            : <div className="scan-sug__img"><i className="fa-solid fa-box" aria-hidden="true" /></div>}
          <div>
            <div className="scan-sug__name">{s.name}</div>
            <div className="scan-sug__meta">
              <span className="ek-num">{code}</span> · {unitLabel(s.unit)}{s.brand ? ` · ${s.brand}` : ""}
            </div>
            {outcome.verified ? (
              <span className="scan-flag scan-flag--ok">
                <i className="fa-solid fa-circle-check" aria-hidden="true" /> {t("scan.verified")}
              </span>
            ) : (
              <span className="scan-flag scan-flag--warn">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("scan.unverified")}
              </span>
            )}
          </div>
        </div>
        <p className="scan-note">
          <i className="fa-solid fa-lock" aria-hidden="true" /> {t("scan.privacy")}
        </p>
      </Modal>
    );
  }

  /* `none` — Katalogda yangi tovar taklifi bilan, Omborda faqat xabar. */
  return (
    <Modal title={t("scan.notHereTitle")} onClose={onClose}
           footer={onCreate && (
             <button className="btn btn-primary" onClick={() => onCreate(code)}>
               <i className="fa-solid fa-plus" aria-hidden="true" /> {t("scan.createNew")}
             </button>
           )}>
      <p className="scan-text">{onCreate ? t("scan.nowhere") : t("scan.notInShop")}</p>
      <p className="scan-text ek-num">{code}</p>
    </Modal>
  );
}
