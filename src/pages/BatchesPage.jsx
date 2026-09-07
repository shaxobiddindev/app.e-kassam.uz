import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { inventoryApi, shopApi } from "../api";
import { Empty } from "../components/ui";
import DataFilter, { useDataFilter, SortTh, FilterChips } from "../components/ek/DataFilter";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { money, quantity as fmtQty } from "../utils";
import { shortDate, dateTime } from "../lib/ek-format";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { DEFAULT_NEAR_EXPIRY_DAYS, daysLeft } from "../lib/ek-expiry";
import BatchCorrectModal from "../components/BatchCorrectModal";
import { asArray } from "../lib/ek-array";

/* ══════════════════════════════════════════════════════════════════════════
   PARTIYALAR — SAHIFA (V60, jadval V76)

   ═══ NEGA MODAL EMAS, SAHIFA ═══════════════════════════════════════════

   Do'kon egasining savoli: «shunga o'xshash oynalarni modaldan ko'ra page
   sifatida qilgan maqulmi?». Bu yerda — ha, va sabablari aniq:

     · partiyalar UCHTA bo'limga bo'linadi (faol, muddati o'tgan, arxiv)
       va modal ichida bo'limlar oynani balandlatib, scrol chaqiradi;
     · sahifaga havola bo'ladi: omborchi uni ochiq qoldirib, boshqa ishga
       o'tib, keyin «orqaga» bilan qaytadi — modalda bu yo'q;
     · brauzerning «orqaga» tugmasi ishlaydi. Modalda u BUTUN ilovani
       tark etardi.

   ═══ NEGA KARTOCHKA EMAS, JADVAL (V76) ════════════════════════════════

   Do'kon egasining talabi: «omborda ham partiyalarni jadval va filterli
   ko'rinishga keltir». Ilgari har partiya alohida kartochka edi va bu
   ombor bo'limidagi YAGONA joy bo'lib qolgandi — qolgan hamma ro'yxat
   jadval, ustunlari saralanadigan va filtrlanadigan.

   Kartochka bir necha narsani UMUMAN bermasdi:

     · SARALASH. Kartochkalar server tartibida yotardi — «eng katta
       qoldiq qaysi partiyada?» degan savolga ko'z bilan javob berish
       kerak edi.
     · SOLISHTIRISH. Tannarx har kartochkaning ichida, turli joyda
       turardi; ustunda esa ular bir chiziqda va farq darrov ko'rinadi.
     · FILTR. «Qoldig'i bor, muddatiga 10 kundan kam qolganlari» —
       o'ttizta kartochkani ko'z bilan saralashdan boshqa yo'l yo'q edi.
     · PUL. Endi alohida ustun bor: qoldiq × tannarx. Aynan shu son
       «bu partiyada qancha pul yotibdi?» degan savolga javob beradi va
       jadvalning ostida FILTRLANGAN yig'indi turadi.

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

   ⚠ FILTR BO'LIMNI ALMASHTIRMAYDI. Bo'lim — «qaysi savolga javob
   qidiryapman», filtr esa — «shu javobning ichida nimani ko'ray».
   Filtrga «arxivlangan» sharti qo'yilganda bo'limlarning ma'nosi
   yo'qolardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Muddati o'tganmi — ombor sahifasidagi qoida bilan bir xil. */
const isExpired = (b) => b.status === "EXPIRED" || b.expired;

/** Bo'shab qolgan partiya — faqat shundaylarini arxivlash mumkin. */
const isEmpty = (b) => (Number(b.quantity) || 0) <= 0;

/**
 * Yakuniy blokdagi bitta katak: yorliq, soni, qoldig'i va puli.
 *
 * ⚠ UCHALA RAQAM HAM: partiyalar soni «nechta yozuv bor», qoldiq
 * «qancha tovar bor», qiymat «qancha pul bor» degan UCH XIL savolga
 * javob beradi va ularning birortasi qolganini almashtira olmaydi.
 */
function Stat({ label, s, unit, big = false, tone, muted = false }) {
  return (
    <div className={`batch-stat${big ? " batch-stat--big" : ""}${muted ? " batch-stat--muted" : ""}`}
         data-tone={s.n > 0 ? tone : undefined}>
      <div className="batch-stat__l">
        {label}
        {/* ⚠ Partiyalar soni yorliq YONIDA, alohida qatorda emas: u
            qo'shimcha ma'lumot, asosiysi esa qoldiq va pul. */}
        <span className="batch-stat__n ek-num">{s.n}</span>
      </div>
      <div className="batch-stat__q ek-num">
        {fmtQty(s.qty, unitDecimals(unit))} {unitLabel(unit)}
      </div>
      <div className="batch-stat__v ek-num">{money(s.value)}</div>
    </div>
  );
}

/** Partiyada yotgan pul: qoldiq × tannarx. */
const stockValue = (b) => (Number(b.quantity) || 0) * (Number(b.costPrice) || 0);

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
      setLive(asArray(a?.data));
      setArchived(asArray(b?.data));
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
  const activeRows  = useMemo(() => live.filter((b) => !isExpired(b)), [live]);
  const expiredRows = useMemo(() => live.filter((b) =>  isExpired(b)), [live]);

  /* ⚠ «BARCHASI» — bo'limlarning YIG'INDISI, to'rtinchi ro'yxat emas.
     Omborchining ba'zi savollari bo'limga sig'maydi: «shu tovarning
     butun tarixi qanday?» yoki «qaysi partiya qachon kelib, qachon
     tugagan?». Ular uchun uch bo'lim orasida yurish kerak bo'lardi va
     solishtirish ko'z bilan qilinardi. */
  const allRows = useMemo(
    () => [...activeRows, ...expiredRows, ...archived],
    [activeRows, expiredRows, archived]);

  const base = tab === "all" ? allRows
             : tab === "archived" ? archived
             : tab === "expired" ? expiredRows
             : activeRows;

  const product = live[0] || archived[0] || null;
  const unit = product?.unit;
  const emptyCount = activeRows.filter(isEmpty).length;

  /* ══════════════════════════════════════════════════════════════════
     YAKUNIY RAQAMLAR

     ⚠ AVVAL JAMI, KEYIN BO'LIMLAR (do'kon egasining talabi). Ilgari bu
     yerda faqat «javonda bor» turardi — ya'ni FAQAT ochiq bo'limning
     soni. Undan «bu tovarda umuman qancha bor?» degan savolga javob
     topib bo'lmasdi: muddati o'tgani va arxivi ko'rinmasdi, ular esa
     ham tovar, ham pul.

     ⚠ FILTRDAN MUSTAQIL. Bu raqamlar tovarning HOLATI haqida va
     ekranda nima ko'rsatilayotganiga bog'liq emas. Filtrlangan
     yig'indi alohida qatorda turadi.
     ══════════════════════════════════════════════════════════════════ */
  const sumOf = (list) => ({
    n: list.length,
    qty: list.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
    value: list.reduce((s, b) => s + stockValue(b), 0),
  });

  const stats = useMemo(() => ({
    all:      sumOf(allRows),
    active:   sumOf(activeRows),
    expired:  sumOf(expiredRows),
    archived: sumOf(archived),
  }), [allRows, activeRows, expiredRows, archived]);

  /* ══════════════════════════════════════════════════════════════════
     USTUNLAR

     ⚠ `qty` ustuni XOM qoldiq (`quantity`), ombor jadvalidagi kabi
     «sotiladigan» emas: bu yerda har qator BITTA partiya va uning
     sotilishi holat ustunida aytilgan. Xom son bo'lmasa «muddati
     o'tgan partiyada 12 dona yotibdi» degan holat ko'rinmay qolardi —
     aynan shuni hisobdan chiqarish kerak.
     ══════════════════════════════════════════════════════════════════ */
  const COLS_BASE = useMemo(() => [
    { key: "qty",      label: t("inv.stock"),            type: "number", get: (b) => Number(b.quantity) || 0 },
    { key: "cost",     label: t("products.costPrice"),   type: "number", get: (b) => b.costPrice },
    { key: "value",    label: t("batch.value"),          type: "number", get: stockValue },
    { key: "received", label: t("batch.received"),       type: "date",   get: (b) => b.createdAt },
    { key: "expiry",   label: t("batch.expiry"),         type: "date",   get: (b) => b.expiryDate },
    /* ⚠ «Kun qoldi» ALOHIDA ustun, muddat sanasi bo'lgani holda ham:
       omborchining savoli «sanasi nima?» emas, «necha kun qoldi?».
       Sana ustunida buni filtrlash uchun bugungi kunni qo'lda hisoblab
       yozish kerak bo'lardi. Muddatsiz partiyada bo'sh — u hech qachon
       «kam qolgan» ro'yxatiga tushmaydi. */
    { key: "left",     label: t("batch.daysLeft"),       type: "number", get: (b) => daysLeft(b.expiryDate) },
  ], []);

  const stateCol = useMemo(() => ({
    key: "state", label: t("common.status"), type: "enum",
    options: [
      { value: "expired", label: t("enum.inventory.EXPIRED") },
      { value: "near",    label: t("inv.fltNear") },
      { value: "empty",   label: t("batch.empty") },
      { value: "ok",      label: t("enum.inventory.ACTIVE") },
    ],
    get: (b) => {
      if (isExpired(b)) return "expired";
      if (isEmpty(b)) return "empty";
      const l = daysLeft(b.expiryDate);
      return l !== null && l <= nearDays ? "near" : "ok";
    },
  }), [nearDays]);

  /* ⚠ «Barchasi» da holat ustuniga ARXIV ham qo'shiladi: aks holda
     arxivdagi partiya faol qatorlar orasida farqsiz turardi va
     ro'yxat yolg'on ko'rinardi («javonda bor» deb o'qilardi). Arxiv
     bo'limining O'ZIDA bu qiymat yo'q — u yerda hamma qator arxiv va
     ustun bekorga takrorlanardi. */
  const stateColAll = useMemo(() => ({
    ...stateCol,
    options: [{ value: "archived", label: t("batch.tabArchived") }, ...stateCol.options],
    get: (b) => (b.archivedAt ? "archived" : stateCol.get(b)),
  }), [stateCol]);

  const archivedCol = useMemo(
    () => ({ key: "archived", label: t("batch.archivedAt"), type: "date", get: (b) => b.archivedAt }),
    []);

  const COLS     = useMemo(() => [...COLS_BASE, stateCol], [COLS_BASE, stateCol]);
  const COLS_ARC = useMemo(() => [...COLS_BASE, archivedCol, stateCol],
    [COLS_BASE, archivedCol, stateCol]);
  const COLS_ALL = useMemo(() => [...COLS_BASE, archivedCol, stateColAll],
    [COLS_BASE, archivedCol, stateColAll]);

  /* ⚠ IKKALA ILGAK HAM SHARTSIZ chaqiriladi va tanlov keyin qilinadi:
     shart ichidagi ilgak React ning 310-xatosini beradi.

     ⚠ ARXIV O'Z FILTRINI saqlaydi. Uning ustunlari boshqa
     («arxivlangan» qo'shiladi) va savoli ham boshqa — faol ro'yxatga
     qo'yilgan shart arxivga o'tganda ma'nosini yo'qotardi. */
  const fltLive = useDataFilter(COLS,     "batch");
  const fltArc  = useDataFilter(COLS_ARC, "batchArc");
  const fltAll  = useDataFilter(COLS_ALL, "batchAll");
  const flt  = tab === "all" ? fltAll : tab === "archived" ? fltArc  : fltLive;
  const cols = tab === "all" ? COLS_ALL : tab === "archived" ? COLS_ARC : COLS;

  /* Arxiv ustuni ikkita bo'limda ko'rinadi. */
  const showArchivedCol = tab === "archived" || tab === "all";

  const rows = useMemo(() => flt.apply(base), [flt, base]);

  /* ⚠ Yig'indi FILTRLANGAN qatorlar bo'yicha: «muddatiga 10 kundan kam
     qolganlarida qancha pul yotibdi?» degan savolga javob aynan shu
     yerda ko'rinadi. Butun bo'lim bo'yicha yig'indi bergan bo'lsak,
     filtr qo'yilgandan keyin ostidagi son o'zgarmay turardi va uni
     hech kim tushunmasdi. */
  const sum = useMemo(() => ({
    qty:   rows.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
    value: rows.reduce((s, b) => s + stockValue(b), 0),
  }), [rows]);

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
    /* ⚠ «Barchasi» BIRINCHI, lekin STANDART EMAS: kunlik savol —
       «javonda hozir nima bor?», ya'ni faol bo'lim. Barchasi kamdan-kam
       kerak bo'ladi (tarix, tekshiruv) va uni standart qilish har
       ochilishda ortiqcha qatorlarni ko'rsatardi. */
    { id: "all",      icon: "fa-layer-group",          label: t("batch.tabAll"),      n: allRows.length },
    { id: "active",   icon: "fa-box-open",             label: t("batch.tabActive"),   n: activeRows.length },
    { id: "expired",  icon: "fa-triangle-exclamation", label: t("batch.tabExpired"),  n: expiredRows.length },
    { id: "archived", icon: "fa-box-archive",          label: t("batch.tabArchived"), n: archived.length },
  ];

  const qtyCell = (b) => `${fmtQty(b.quantity, unitDecimals(b.unit))} ${unitLabel(b.unit)}`;

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

      {/* ══ YAKUN — BITTA BLOK ═══════════════════════════════════════
          ⚠ Ilgari raqamlar IKKI joyda edi: tepada «javonda bor», pastda
          jadval ostidagi qator. Ular bir-birini takrorlar, lekin
          boshqa-boshqa narsani sanardi va qaysi biri nimani anglatishi
          faqat yozuvdan bilinardi — ikkalasini bir qarashda
          solishtirib bo'lmasdi. Endi hammasi bitta qatorda: avval
          JAMI, keyin bo'limlar. */}
      <div className="batch-summary">
        <div className="batch-stats">
          <Stat label={t("batch.allTotal")} s={stats.all} unit={unit} big />
          <Stat label={t("batch.tabActive")}   s={stats.active}   unit={unit} />
          <Stat label={t("batch.tabExpired")}  s={stats.expired}  unit={unit} tone="bad" />
          <Stat label={t("batch.tabArchived")} s={stats.archived} unit={unit} muted />
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
      {tab === "expired" && expiredRows.length > 0 && (
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

      <div className="card">
        <div className="card-header batch-bar">
          {/* ⚠ Filtr tugmasi jadvalning USTIDA, ombor bo'limidagi kabi:
              ikkala ekranda bir xil joyda turishi kerak, aks holda
              omborchi har safar uni qidirardi. */}
          <DataFilter cols={cols} flt={flt} chips={false} />
          {/* Nechta qator ko'rinayotgani — filtrdan keyin. */}
          {/* ⚠ FILTRLANGAN YIG'INDI SHU YERDA, jadval ostida emas:
              u filtr tugmasining yonida turgani ma'qul — «nega
              ro'yxat qisqa?» degan savol aynan shu yerda tug'iladi.
              Jadval ostidagi qator esa uzun ro'yxatda ko'rinmay
              qolardi. */}
          <span className="batch-bar__n ek-num">
            {t("batch.shown", { n: rows.length, all: base.length })}
          </span>
          {rows.length !== base.length && (
            <span className="batch-bar__sum ek-num">
              {fmtQty(sum.qty, unitDecimals(unit))} {unitLabel(unit)} · {money(sum.value)}
            </span>
          )}
          <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }}
                  onClick={load} title={t("products.refreshTitle")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("common.refresh")}
          </button>
        </div>

        {/* Faol shartlar — TO'LIQ kenglikdagi o'z qatorida. */}
        <div className="batch-chips"><FilterChips cols={cols} flt={flt} /></div>

        <div className="table-wrap">
          {loading ? <SkeletonTable rows={4} cols={["num", "num", "num", "text", "text", "num", "text"]} />
           : base.length === 0 ? (
            /* ⚠ `text`, `title` EMAS va ikonka TO'LIQ nomi bilan.
               Ilgari bu yerda `title={...}` va `icon="box-open"`
               turardi: `Empty` da bunday xossa yo'q, shuning uchun
               yozuv HECH QACHON ko'rinmagan (standart «Ma'lumot yo'q»
               chiqardi), ikonka esa umuman chizilmagan. */
            <Empty icon={TABS.find((x) => x.id === tab)?.icon}
                   text={t(`batch.none.${tab}`)} />
          ) : rows.length === 0 ? (
            /* ⚠ «Bo'lim bo'sh» va «filtr hech narsa topmadi» BOSHQA-BOSHQA
               holat. Bir xil yozuv bilan omborchi partiyalar yo'q deb
               o'ylab, filtrni tozalash kerakligini bilmasdi. */
            <Empty icon="fa-filter" text={t("filter.noMatch")}
                   action={<button className="btn btn-outline btn-sm" onClick={flt.clear}>
                             <i className="fa-solid fa-xmark" aria-hidden="true" /> {t("filter.clear")}
                           </button>} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <SortTh flt={flt} col="qty">{t("inv.stock")}</SortTh>
                  <SortTh flt={flt} col="cost">{t("products.costPrice")}</SortTh>
                  <SortTh flt={flt} col="value">{t("batch.value")}</SortTh>
                  <SortTh flt={flt} col="received">{t("batch.received")}</SortTh>
                  <SortTh flt={flt} col="expiry">{t("batch.expiry")}</SortTh>
                  <SortTh flt={flt} col="left">{t("batch.daysLeft")}</SortTh>
                  {showArchivedCol &&
                    <SortTh flt={flt} col="archived">{t("batch.archivedAt")}</SortTh>}
                  <SortTh flt={flt} col="state">{t("common.status")}</SortTh>
                  <th className="text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const left = daysLeft(b.expiryDate);
                  const gone = isExpired(b);
                  const empty = isEmpty(b);
                  const near = !gone && !empty && left !== null && left <= nearDays;
                  return (
                    <tr key={b.inventoryId} className={gone ? "row-danger" : ""}>
                      {/* ⚠ Yalang'och son emas, BIRLIGI bilan: tarozili
                          tovarda «1.5» nimani — kilonimi, donanimi
                          bildirishini jadvalga qarab bilib bo'lmasdi. */}
                      <td>
                        <span className={`badge ${gone ? "badge-red" : empty ? "badge-grey" : "badge-green"}`}>
                          {qtyCell(b)}
                        </span>
                      </td>
                      <td className="mono">{b.costPrice != null ? money(b.costPrice) : "—"}</td>
                      <td className="mono fw-700">{money(stockValue(b))}</td>
                      {/* ⚠ SANA + VAQT: `createdAt` — LAHZA va bir kunda
                          bir necha partiya kelishi mumkin. FEFO tartibida
                          «qaysi biri oldin keldi?» degan savolga faqat
                          sanadan javob topib bo'lmasdi. */}
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {b.createdAt ? dateTime(b.createdAt) : "—"}
                      </td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>
                        {b.expiryDate ? shortDate(b.expiryDate) : t("batch.noExpiry")}
                      </td>
                      <td className="mono">
                        {left === null ? "—"
                         : left < 0 ? <span className="batch-late">{t("batch.lateDays", { n: -left })}</span>
                         : left}
                      </td>
                      {showArchivedCol && (
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {b.archivedAt ? dateTime(b.archivedAt) : "—"}
                        </td>
                      )}
                      <td>
                        {/* ⚠ «BARCHASI» da ARXIV birinchi tekshiriladi va
                            bu sinovda topilgan nomuvofiqlik: filtr
                            («Holat = Arxiv») arxivdagi qatorni tanlar,
                            ekrandagi belgi esa «Tugagan» deb turardi.
                            Ikki xil javob bir ustunda — ro'yxatga
                            ishonchni yo'qotadigan xato.

                            Boshqa bo'limlarda bu qiymat ko'rsatilmaydi:
                            arxiv bo'limida hamma qator arxiv va belgi
                            bekorga takrorlanardi. */}
                        {tab === "all" && b.archivedAt
                         ? <span className="badge badge-grey">{t("batch.tabArchived")}</span>
                         : gone ? <span className="badge badge-red">{t("enum.inventory.EXPIRED")}</span>
                         : near ? (
                           <span className="badge badge-yellow">
                             {left === 0 ? t("inv.nearToday") : t("inv.nearDays", { n: left })}
                           </span>
                         ) : empty ? <span className="badge badge-grey">{t("batch.empty")}</span>
                         : <span className="badge badge-green">{t("enum.inventory.ACTIVE")}</span>}
                      </td>
                      <td className="text-end">
                        {/* ⚠ AMAL QATORNING O'ZIGA qarab tanlanadi,
                            BO'LIMGA emas. «Barchasi» da ikkala tur
                            yonma-yon turadi va bo'limga qarab
                            tanlanganda arxivdagi partiyaga «Arxivga»
                            tugmasi chiqardi — server rad etadigan,
                            ma'nosiz amal. */}
                        {b.archivedAt ? (
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {correct && (
        <BatchCorrectModal batch={correct} toast={toast}
                           onClose={() => setCorrect(null)} onSaved={load} />
      )}
    </div>
  );
}
