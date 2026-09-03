import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { inventoryApi, shopApi } from "../api";
import { Empty } from "../components/ui";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { money, quantity as fmtQty } from "../utils";
import { shortDate } from "../lib/ek-format";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { DEFAULT_NEAR_EXPIRY_DAYS, daysLeft } from "../lib/ek-expiry";
import BatchCorrectModal from "../components/BatchCorrectModal";

/* ══════════════════════════════════════════════════════════════════════════
   PARTIYALAR — SAHIFA (V60)

   ═══ NEGA MODAL EMAS, SAHIFA ═══════════════════════════════════════════

   Do'kon egasining savoli: «shunga o'xshash oynalarni modaldan ko'ra page
   sifatida qilgan maqulmi?». Bu yerda — ha, va sabablari aniq:

     · partiyalar UCHTA bo'limga bo'linadi (faol, muddati o'tgan, arxiv)
       va modal ichida bo'limlar oynani balandlatib, scrol chaqiradi;
     · sahifaga havola bo'ladi: omborchi uni ochiq qoldirib, boshqa ishga
       o'tib, keyin «orqaga» bilan qaytadi — modalda bu yo'q;
     · brauzerning «orqaga» tugmasi ishlaydi. Modalda u BUTUN ilovani
       tark etardi.

   ⚠ ESKI MODAL OLIB TASHLANDI, ikkovi qoldirilmadi. Bitta ish uchun ikki
   yo'l — o'sha eski chalkashlik: qaysi biri yangilanadi, qaysi birida
   arxiv tugmasi bor degan savol tug'iladi.

   ═══ NEGA UCHTA BO'LIM ════════════════════════════════════════════════

   «arxiv, muddati o'tgan, faol kabi narsalar bo'lishi kerak» — do'kon
   egasining so'zi. Har bo'limning o'z savoli bor:

     Faol          — javonda hozir nima bor?
     Muddati o'tgan— nimani hisobdan chiqarish kerak?
     Arxiv         — nima bo'lgan edi? (tarix, tegilmaydi)

   ⚠ MUDDATI O'TGANLAR OCHIQ KO'RINMAYDI (talab: «ko'rsatilmaydigan
   qilish kerak, uni biror tugma bilan ko'ra olsin, lekin yaqqol
   ogohlantirish berib tursin»). Ular alohida bo'limda va bo'lim
   ochilganda ekranning tepasida qizil ogohlantirish turadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Muddati o'tganmi — ombor sahifasidagi qoida bilan bir xil. */
const isExpired = (b) => b.status === "EXPIRED" || b.expired;

/** Bo'shab qolgan partiya — faqat shundaylarini arxivlash mumkin. */
const isEmpty = (b) => (Number(b.quantity) || 0) <= 0;

export default function BatchesPage({ toast }) {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [live, setLive] = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [tab, setTab] = useState("active");
  const [nearDays, setNearDays] = useState(DEFAULT_NEAR_EXPIRY_DAYS);
  const [correct, setCorrect] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /* ⚠ Ikkala ro'yxat ham BIRGA olinadi: bo'limlar orasida yurganda
         har safar kutib turish omborchini charchatardi va bo'limlar
         soni ham darhol ko'rinishi kerak. */
      const [a, b] = await Promise.all([
        inventoryApi.batches(productId, false),
        inventoryApi.batches(productId, true),
      ]);
      setLive(a?.data || []);
      setArchived(b?.data || []);
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    shopApi.getProfile()
      .then((r) => setNearDays(Number(r?.data?.nearExpiryDays) || DEFAULT_NEAR_EXPIRY_DAYS))
      .catch(() => {});
  }, []);

  /* Bo'limlarga ajratish — server tartibi (yangilar yuqorida) SAQLANADI. */
  const active  = useMemo(() => live.filter((b) => !isExpired(b)), [live]);
  const expired = useMemo(() => live.filter((b) =>  isExpired(b)), [live]);
  const rows    = tab === "archived" ? archived : tab === "expired" ? expired : active;

  const product = live[0] || archived[0] || null;
  const unit = product?.unit;
  const emptyCount = active.filter(isEmpty).length;

  /* Javonda hozir nima bor — muddati o'tgani ham, arxivi ham sanalmaydi. */
  const onShelf = active.reduce((s, b) => s + (Number(b.quantity) || 0), 0);

  const act = async (fn, id) => {
    setBusy(id);
    try {
      const r = await fn();
      toast?.success(r?.message || t("common.saved"));
      await load();
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const TABS = [
    { id: "active",   icon: "fa-box-open",             label: t("batch.tabActive"),   n: active.length },
    { id: "expired",  icon: "fa-triangle-exclamation", label: t("batch.tabExpired"),  n: expired.length },
    { id: "archived", icon: "fa-box-archive",          label: t("batch.tabArchived"), n: archived.length },
  ];

  return (
    <div className="page">
      <div className="page-head">
        {/* ⚠ Orqaga — HAVOLA, brauzer tarixi bilan. Modalda bunday
            imkoniyat umuman yo'q edi. */}
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/inventory")}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("nav.inventory")}
        </button>
        <div style={{ marginLeft: 12, minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {product?.productName || t("batch.title")}
          </h1>
          {product?.barcode && (
            <div className="ek-num" style={{ fontSize: 12, color: "var(--fg-secondary)" }}>
              {product.barcode}
            </div>
          )}
        </div>
      </div>

      {/* Javondagi jami — bo'limlardan mustaqil, chunki savol bitta:
          «hozir sotishga nima bor?». */}
      <div className="batch-summary">
        <div>
          <div className="batch-summary__label">{t("batch.onShelf")}</div>
          <div className="batch-summary__value ek-num">
            {fmtQty(onShelf, unitDecimals(unit))} {unitLabel(unit)}
          </div>
        </div>
        {emptyCount > 0 && tab === "active" && (
          /* ⚠ Ommaviy arxivlash. Bir yildan keyin ko'p sotiladigan
             tovarda o'nlab bo'sh partiya yig'iladi va ularni bittalab
             arxivlash omborchini bu ishdan voz kechishga majbur qilardi. */
          <button className="btn btn-outline btn-sm" disabled={busy === "bulk"}
                  onClick={() => act(() => inventoryApi.archiveEmpty(productId), "bulk")}>
            {busy === "bulk" ? <Spinner /> : <i className="fa-solid fa-box-archive" aria-hidden="true" />}
            {" "}{t("batch.archiveEmpty", { n: emptyCount })}
          </button>
        )}
      </div>

      <div className="batch-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id}
                  className={`batch-tab ${tab === x.id ? "is-on" : ""} ${x.id === "expired" && x.n > 0 ? "has-warn" : ""}`}
                  onClick={() => setTab(x.id)}>
            <i className={`fa-solid ${x.icon}`} aria-hidden="true" /> {x.label}
            {/* Son har doim ko'rinadi: bo'limni ochmasdan ham u yerda
                nima borligi bilinsin. */}
            <span className="batch-tab__n ek-num">{x.n}</span>
          </button>
        ))}
      </div>

      {/* ⚠ YAQQOL OGOHLANTIRISH (do'kon egasining talabi). Muddati o'tgan
          bo'lim ochilganda u birinchi navbatda ko'rinadi va nima qilish
          kerakligini AYTADI — «diqqat» deyish yetarli emas. */}
      {tab === "expired" && expired.length > 0 && (
        <div className="batch-warn" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <span>{t("batch.expiredWarn")}</span>
        </div>
      )}

      {tab === "archived" && (
        <div className="batch-note">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          <span>{t("batch.archivedNote")}</span>
        </div>
      )}

      {loading ? <SkeletonTable rows={4} /> : rows.length === 0 ? (
        <Empty icon={TABS.find((x) => x.id === tab)?.icon.replace("fa-", "")}
               title={t(`batch.none.${tab}`)} />
      ) : (
        <div className="batch-list">
          {rows.map((b) => {
            const left = daysLeft(b.expiryDate);
            const gone = isExpired(b);
            const empty = isEmpty(b);
            const near = !gone && !empty && left !== null && left <= nearDays;
            return (
              <div key={b.inventoryId} className={`batch-row ${gone ? "is-expired" : ""} ${empty ? "is-empty" : ""}`}>
                <div className="batch-row__main">
                  <div className="batch-row__qty ek-num">
                    {fmtQty(b.quantity, unitDecimals(b.unit))} {unitLabel(b.unit)}
                  </div>
                  <div className="batch-row__meta">
                    {/* ⚠ HAR SANA O'ZI NIMA EKANINI AYTADI. Ikonka
                        yolg'iz yetarli emas: yonma-yon turgan ikki sanani
                        («kelgan» va «muddat») ikonkaga qarab ajratish
                        uchun avval ikonkaning ma'nosini bilish kerak.
                        Kirim sanasi bu yerda «yangilar yuqorida»
                        tartibining ko'rinadigan asosi hamdir. */}
                    <span>
                      <i className="fa-solid fa-arrow-down-to-line" aria-hidden="true" />{" "}
                      {t("batch.received")}: <b>{b.createdAt ? shortDate(b.createdAt) : "—"}</b>
                    </span>
                    <span>
                      <i className="fa-solid fa-hourglass-half" aria-hidden="true" />{" "}
                      {t("batch.expiry")}:{" "}
                      <b>{b.expiryDate ? shortDate(b.expiryDate) : t("batch.noExpiry")}</b>
                    </span>
                    {b.archivedAt && (
                      <span>
                        <i className="fa-solid fa-box-archive" aria-hidden="true" />{" "}
                        {t("batch.archivedAt")}: <b>{shortDate(b.archivedAt)}</b>
                      </span>
                    )}
                  </div>
                </div>

                <div className="batch-row__flags">
                  {gone && <span className="badge badge-red">{t("enum.inventory.EXPIRED")}</span>}
                  {near && (
                    <span className="badge badge-yellow">
                      {left === 0 ? t("inv.nearToday") : t("inv.nearDays", { n: left })}
                    </span>
                  )}
                  {empty && !gone && <span className="badge badge-grey">{t("batch.empty")}</span>}
                </div>

                <div className="batch-row__act">
                  {tab === "archived" ? (
                    <button className="btn btn-outline btn-sm" disabled={busy === b.inventoryId}
                            onClick={() => act(() => inventoryApi.unarchiveBatch(b.inventoryId), b.inventoryId)}>
                      {busy === b.inventoryId ? <Spinner /> : <i className="fa-solid fa-rotate-left" aria-hidden="true" />}
                      {" "}{t("batch.restore")}
                    </button>
                  ) : empty ? (
                    <button className="btn btn-outline btn-sm" disabled={busy === b.inventoryId}
                            onClick={() => act(() => inventoryApi.archiveBatch(b.inventoryId), b.inventoryId)}>
                      {busy === b.inventoryId ? <Spinner /> : <i className="fa-solid fa-box-archive" aria-hidden="true" />}
                      {" "}{t("batch.archive")}
                    </button>
                  ) : (
                    /* ⚠ Qoldig'i bor partiyada ARXIV tugmasi umuman
                       chiqmaydi: server ham rad etadi, lekin bo'lmaydigan
                       tugmani ko'rsatib, keyin xato berish — kassirni
                       aldash. O'rniga aynan kerakli amal turadi —
                       qoldiqni to'g'irlash (hisobdan chiqarish). */
                    <button className="btn btn-outline btn-sm" onClick={() => setCorrect(b)}>
                      <i className="fa-solid fa-pen-to-square" aria-hidden="true" />{" "}
                      {t("inv.correctAction")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {correct && (
        <BatchCorrectModal batch={correct} toast={toast}
                           onClose={() => setCorrect(null)} onSaved={load} />
      )}
    </div>
  );
}
