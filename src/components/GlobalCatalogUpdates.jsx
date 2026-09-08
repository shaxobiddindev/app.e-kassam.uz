import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { catalogApi } from "../api";
import Modal from "./Modal";
import { Spinner } from "./ek/Loading";
import { Empty } from "./ui";
import { asArray } from "../lib/ek-array";

/* ══════════════════════════════════════════════════════════════════════════
   UMUMIY BAZADAGI YANGILANISH (V93)

   ═══ MUAMMO ══════════════════════════════════════════════════════════

   Import — BIR MARTALIK nusxa. Admin ertaga umumiy bazadagi nomni
   tuzatsa («Coca cola 0.5» → «Coca-Cola 0,5 l»), uni allaqachon olgan
   do'konda ESKI nom qoladi. Ya'ni umumiy baza faqat birinchi kuni
   foyda beradi, keyin esa asta-sekin ajralib boradi.

   ═══ NEGA «TAKLIF», «AVTOMATIK» EMAS ═════════════════════════════════

   Avtomatik tarqatish xavfli: do'kon nomni ATAYLAB o'zgartirgan
   bo'lishi mumkin («Kola katta») va uni bir kechada qaytarib qo'yish
   do'kon egasi uchun tushunarsiz yo'qotish. Bu yerda esa u ro'yxatni
   ko'radi va HAR BIRIGA O'ZI qaror qiladi.

   ⚠ «ZIDDIYAT» BELGISI — eng muhim tafsilot. U «bu maydonni siz o'zingiz
   o'zgartirgansiz» degani va qabul qilish sizning tahringizni
   yo'qotadi. Belgisiz do'kon buni bilmasdan bosardi.

   ⚠ «MENIKI QOLSIN» HAM QAROR: u ham serverga yuboriladi va shu taklif
   boshqa chiqmaydi. Aks holda rad etilgan taklif ertaga yana
   ko'rinardi va bir hafta ichida do'kon ro'yxatga umuman qaramay
   qo'yardi.
   ══════════════════════════════════════════════════════════════════════════ */

export default function GlobalCatalogUpdates({ onClose, onDone, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  /* Har tovar uchun tanlangan maydonlar: { productId: Set(field) } */
  const [picked, setPicked] = useState({});
  const [applied, setApplied] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = asArray((await catalogApi.globalUpdates()).data);
      setRows(list);
      /* ⚠ ZIDDIYATSIZ maydonlar OLDINDAN belgilanadi, ziddiyatlilari
         YO'Q. Sabab: birinchisida yo'qotadigan narsa yo'q (do'kon
         maydonga tegmagan), ikkinchisida esa do'konning tahriri
         o'chib ketardi va bu qaror u BILIB bosishi kerak. */
      const next = {};
      for (const r of list) {
        next[r.productId] = new Set(
          (r.fields || []).filter((f) => !f.conflict).map((f) => f.field));
      }
      setPicked(next);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (productId, field) => {
    setPicked((prev) => {
      const set = new Set(prev[productId] || []);
      if (set.has(field)) set.delete(field); else set.add(field);
      return { ...prev, [productId]: set };
    });
  };

  const decide = async (row) => {
    setBusy(row.productId);
    try {
      await catalogApi.applyGlobalUpdate(row.productId, [...(picked[row.productId] || [])]);
      setRows((prev) => prev.filter((r) => r.productId !== row.productId));
      setApplied((n) => n + 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const close = () => { if (applied > 0) onDone(); else onClose(); };

  return (
    <Modal title={t("gcat.updTitle")} onClose={close} maxWidth={700}
           footer={
             <button className="btn btn-primary btn-sm" onClick={close}>
               <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.close")}
             </button>
           }>
      <div className="ek-note" style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" /> {t("gcat.updHint")}
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="fa-circle-check" text={t("gcat.updNone")} />
      ) : (
        <div className="gcat-upd">
          {rows.map((row) => (
            <div className="gcat-upd__item" key={row.productId}>
              <div className="gcat-upd__head">
                <div style={{ minWidth: 0 }}>
                  <div className="gcat-upd__name">{row.productName}</div>
                  <div className="gcat-upd__code ek-num">{row.barcode}</div>
                </div>
                <button className="btn btn-sm btn-primary" disabled={busy === row.productId}
                        onClick={() => decide(row)}>
                  {busy === row.productId ? <Spinner /> : <i className="fa-solid fa-check" aria-hidden="true" />}
                  {t("gcat.updApply")}
                </button>
              </div>

              {(row.fields || []).map((f) => {
                const on = (picked[row.productId] || new Set()).has(f.field);
                return (
                  <label key={f.field} className={`gcat-upd__field ${on ? "on" : ""}`}>
                    <input type="checkbox" checked={on}
                           onChange={() => toggle(row.productId, f.field)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="gcat-upd__label">
                        {t(f.field === "brand" ? "clothing.brand" : "products.name")}
                        {/* ⚠ «Siz o'zgartirgansiz» — qabul qilish sizning
                            tahringizni yo'qotadi degani. */}
                        {f.conflict && (
                          <span className="gcat-upd__conflict">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                            {t("gcat.updConflict")}
                          </span>
                        )}
                      </div>
                      <div className="gcat-upd__diff">
                        <span className="gcat-upd__old">{f.mine || "—"}</span>
                        <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                        <span className="gcat-upd__new">{f.incoming || "—"}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
