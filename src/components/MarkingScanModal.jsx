import { useState, useEffect, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { markingApi } from "../api";
import { markingGroup } from "../lib/ek-labels";
import { Spinner } from "./ek/Loading";

/* ══════════════════════════════════════════════════════════════════════════
   Markirovka yorliqlarini skanerlash — kassada ham, omborda ham.

   ⚠ HAR DONA ALOHIDA. Markirovkada miqdor "3" degan raqam emas, uchta
   ANIQ dona: har birining o'z kodi bor va u faqat bir marta sotiladi.
   Shuning uchun bu oyna miqdor so'ramaydi — miqdor skanerlangan yorliqlar
   sonidan KELIB CHIQADI.

   Ikki rejim:
     mode="sale"    — har kod darhol serverda tekshiriladi (bormi, sotilganmi,
                      shu tovarnikimi). Kassir noto'g'ri yorliqni mijoz
                      ketguncha bilishi kerak.
     mode="receive" — kirim: kodlar to'planadi, tekshiruvni server qabul
                      paytida bajaradi va rad etilganlar ro'yxatini qaytaradi.

   Skaner klaviatura sifatida ishlaydi va kodni Enter bilan yakunlaydi —
   shuning uchun bitta fokusli maydon yetarli, alohista "Qo'shish" tugmasi
   kerak emas (lekin qo'lda kiritish uchun u ham bor).
   ══════════════════════════════════════════════════════════════════════════ */

export default function MarkingScanModal({ product, mode = "sale", onDone, onClose }) {
  const [codes, setCodes] = useState([]);      // [{ code, ok, reason }]
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const accepted = codes.filter((c) => c.ok !== false);

  const add = async (raw) => {
    const code = (raw || "").trim();
    if (!code) return;
    setValue("");

    // Bitta yorliqni ikki marta skanerlash — kassirning qo'l xatosi.
    // Uni jimgina qo'shib qo'ymaymiz: aks holda savatda ikkita dona
    // paydo bo'lib, aslida bittasi sotilardi.
    if (codes.some((c) => c.code === code)) {
      setCodes((prev) => prev.map((c) => (c.code === code ? { ...c, flash: Date.now() } : c)));
      return;
    }

    if (mode !== "sale") {
      setCodes((prev) => [...prev, { code, ok: null }]);
      return;
    }

    setChecking(true);
    try {
      const res = await markingApi.check(code);
      const r = res.data || {};
      const wrongProduct = r.productId && product?.id && r.productId !== product.id;
      setCodes((prev) => [...prev, {
        code,
        ok: r.ok && !wrongProduct,
        reason: wrongProduct ? t("marking.otherProduct") : r.reason,
      }]);
    } catch (err) {
      setCodes((prev) => [...prev, { code, ok: false, reason: err.message }]);
    } finally {
      setChecking(false);
      inputRef.current?.focus();
    }
  };

  const remove = (code) => setCodes((prev) => prev.filter((c) => c.code !== code));

  const finish = () => {
    if (accepted.length === 0) return;
    onDone(accepted.map((c) => c.code));
  };

  return (
    <div className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
         aria-label={t("marking.scanTitle")}
         onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
      <div className="ek-dialog mark-modal">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-barcode" aria-hidden="true" />
            {t("marking.scanTitle")}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="mark-modal__body">
          <div className="mark-modal__product">
            {product?.name}
            {product?.markingGroup && (
              <span className="badge badge-amber" style={{ marginLeft: 8 }}>
                {markingGroup(product.markingGroup).label}
              </span>
            )}
          </div>
          <div className="form-hint">{t("marking.scanHint")}</div>

          <div className="bc-field" style={{ marginTop: 12 }}>
            <i className="fa-solid fa-qrcode" aria-hidden="true" />
            <input
              ref={inputRef}
              autoComplete="off"
              placeholder={t("marking.scanPlaceholder")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                add(e.currentTarget.value);
              }}
            />
            {checking && <Spinner small />}
          </div>

          <div className="mark-modal__list">
            {codes.length === 0 && (
              <div className="form-hint" style={{ textAlign: "center", padding: "18px 0" }}>
                {t("marking.noneScanned")}
              </div>
            )}
            {codes.map((c) => (
              <div key={c.code} className={`mark-row ${c.ok === false ? "is-bad" : ""}`}>
                <i className={`fa-solid ${c.ok === false ? "fa-triangle-exclamation" : "fa-circle-check"}`}
                   aria-hidden="true" />
                <span className="mark-row__code ek-num">{c.code}</span>
                {c.ok === false && <span className="mark-row__reason">{c.reason}</span>}
                <button className="btn-icon danger" onClick={() => remove(c.code)}
                        aria-label={t("common.delete")}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pay-modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-green btn-pos" onClick={finish} disabled={accepted.length === 0}>
            <i className="fa-solid fa-check" aria-hidden="true" />
            {t("marking.confirmCount", { n: accepted.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
