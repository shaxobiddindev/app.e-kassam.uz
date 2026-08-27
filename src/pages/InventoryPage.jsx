import { useEffect, useState, useCallback, useMemo } from "react";
import { t } from "../lib/ek-i18n";
import { inventoryApi, shopApi } from "../api";
import { BranchSelector, Modal } from "../components";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { useAuth } from "../hooks/useAuth";
import { useBadge } from "../context/BadgeProvider";
import { money, quantity as fmtQty } from "../utils";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { NumField, DateField } from "../components/ek/EkFields";
import { DEFAULT_NEAR_EXPIRY_DAYS, daysLeft } from "../lib/ek-expiry";

/* Jurnal turlari — rang bilan: kirim yashil, chiqim qizil, to'g'irlash sariq.
   Omborchi ro'yxatga qarab o'qimasdan ham manzarani ko'rsin. */
const MOV_BADGE = {
  IN:         "badge-green",
  SALE:       "badge-red",
  EXPIRED:    "badge-red",
  CORRECTION: "badge-yellow",
  /* Ko'chirish — ko'k: bu na kirim, na yo'qotish. Tovar do'kondan chiqdi
     yoki kirdi, lekin sotilmadi va yo'qolmadi ham. */
  TRANSFER_OUT: "badge-blue",
  TRANSFER_IN:  "badge-blue",
};

const isBatchExpired = (b) => b.status === "EXPIRED" || b.expired;

/* ══════════════════════════════════════════════════════════════════════════
   MUDDAT VA KAM QOLDIQ — QATOR RANGI (2026-08-20)

   Ilgari omborchi faqat QOLDIQ USTUNIDAGI kichkina qizil sonni ko'rardi:
   yuz qatorli jadvalda uni ko'z ilg'amasdi. Muddat esa umuman rangsiz edi —
   muddati o'tgan tovarni topish uchun har qatorning sanasini o'qish kerak
   bo'lgan.

   Endi butun qator bo'yaladi:
     · muddati o'tgan   → QIZIL   (chiqit qilinishi kerak)
     · muddati yaqin    → SARIQ   (sotish yoki chegirma vaqti)
     · kam qolgan       → och qizil (buyurtma berish vaqti)

   ⚠ RANG YAGONA BELGI EMAS. Har qator o'z holatini YOZUV bilan ham aytadi
   (`badge`) — rang ko'rmaydigan odam va qora-oq chop etishda ma'no
   yo'qolmasin. Bu 02-DESIGN-SYSTEM.md qoidasi.

   ⚠ Ustunlik tartibi: o'tgan > yaqin > kam. Bir tovar uchalasi ham bo'lishi
   mumkin (muddati o'tgan va qoldig'i ham kam) — fon eng jiddiysini
   ko'rsatadi, yozuvlar esa HAMMASINI.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Qatorning holati.
 *
 * ⚠ `left < 0` ham MUDDATI O'TGAN deb hisoblanadi. Partiyaning `EXPIRED`
 * holatini server qo'yadi va u fon vazifasi bilan keladi — sana kecha
 * o'tgan bo'lsayu holat hali almashmagan bo'lsa, tovar ikkala filtrdan
 * ham tushib qolardi.
 */
function flagsOf(g, nearDays) {
  const left = daysLeft(g.nearest);
  const expired = g.hasExpired || (left !== null && left < 0);
  /* ⚠ TUGAGAN ≠ KAM QOLGAN. Ilgari ikkalasi ham `low` edi: qoldig'i NOL
     tovar ham «Kam qoldi» deb yozilardi, omborchi esa buni "hali bor,
     lekin ozaygan" deb o'qib buyurtmani ertaga qoldirardi. Nol qoldiq
     boshqa gap — tovar UMUMAN sotilmayapti, buyurtma bugun kerak. */
  const out = g.sellable <= 0;
  return {
    expired,
    /* Muddati o'tgan tovarda «yaqin» yozuvi chiqmaydi — u endi ortiqcha */
    near: !expired && left !== null && left <= nearDays,
    out,
    low: !out && g.sellable <= g.minQ,
    left,
  };
}

/* Chiqit turkumlari — qoldiq KAMAYGANDA so'raladi.
   Ro'yxat serverdagi `WriteOffReason` bilan bir xil tartibda. */
const WRITE_OFF_REASONS = [
  { value: "BREAKAGE",        icon: "fa-hammer" },
  { value: "SPOILAGE",        icon: "fa-triangle-exclamation" },
  { value: "EXPIRY",          icon: "fa-hourglass-end" },
  { value: "THEFT",           icon: "fa-user-secret" },
  { value: "SUPPLIER_RETURN", icon: "fa-truck-arrow-right" },
  { value: "OWN_USE",         icon: "fa-store" },
  { value: "RECOUNT",         icon: "fa-calculator" },
  { value: "OTHER",           icon: "fa-ellipsis" },
];

/**
 * Partiyalarni MAHSULOT bo'yicha guruhlash.
 *
 * ⚠ Jadval mahsulotga BITTA qator ko'rsatadi. Backend har xil muddatli
 * kirimni alohida partiya qilib saqlaydi (FEFO uchun shart) va ilgari har
 * partiya alohida qator edi — ikkinchi kirimdan keyin omborchi "mahsulot
 * ikkita bo'lib qoldi" deb ko'rardi. Endi asosiy qatorda jami sotiladigan
 * qoldiq, partiyalar esa chevron bilan ochiladi.
 */
function groupByProduct(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.productId)) map.set(item.productId, []);
    map.get(item.productId).push(item);
  }
  return [...map.values()].map((batches) => {
    // FEFO tartibi: muddati yaqin birinchi, muddatsiz eng oxirida
    const sorted = [...batches].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    });
    const valid = sorted.filter((b) => !isBatchExpired(b));
    const sellable = valid.reduce((s, b) => s + (b.quantity || 0), 0);
    const minQ = Math.min(...sorted.map((b) => b.minQuantity ?? 5));
    // "Chirigan" — sotiladigan qoldiq yo'g'u, chirigan qoldiq BOR bo'lsa.
    // Shunchaki tugagan mahsulot chirigan emas.
    const expiredAll = sellable === 0 &&
      sorted.some((b) => isBatchExpired(b) && (b.quantity || 0) > 0);
    /* ⚠ `expiredAll` — tovar BUTUNLAY o'lgan (sotiladigani qolmagan).
       `hasExpired` esa YUMSHOQROQ: sotiladigan qoldiq bor-u, omborda
       muddati o'tgan partiya ham yotibdi. Aynan shunisi ko'rinmasdi —
       chiqit qilinmagan tovar jimgina qoldiqda turaverardi. */
    const hasExpired = sorted.some((b) => isBatchExpired(b) && (b.quantity || 0) > 0);
    /* ⚠ Muddat ogohlantirishi faqat QOLDIG'I BOR partiyadan olinadi.
       Ilgari bo'shab qolgan partiya ham hisobga olinardi: qoldig'i nol
       tovarda «Yaroqlilik: 4 kun qoldi» va «Tugagan» yonma-yon turardi.
       Sotiladigan narsa qolmagan bo'lsa, uning muddati ham ma'nosiz. */
    const nearest = valid.find((b) => b.expiryDate && (b.quantity || 0) > 0)?.expiryDate || null;
    const f = sorted[0];
    return {
      productId: f.productId,
      productName: f.productName,
      barcode: f.barcode,
      markingGroup: f.markingGroup,
      costPrice: f.costPrice,
      salePrice: f.salePrice,
      /* Birlik — «Kam qoldi: 3 dona» yozuvi uchun. Partiyalar bitta
         mahsulotniki, shuning uchun birinchisiniki hammasiga yetadi. */
      unit: f.unit,
      batches: sorted,
      sellable,
      minQ,
      nearest,
      expiredAll,
      hasExpired,
    };
  });
}

export default function InventoryPage({ toast }) {
  const { user } = useAuth();
  const { guard } = useBadge();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null); // null | {productId,...}  (kirim)
  const [correct, setCorrect] = useState(null); // null | batch            (to'g'irlash)
  const [qty, setQty]         = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason]   = useState("");
  /* Chiqit turkumi — faqat to'g'irlashda va faqat qoldiq kamayganda. */
  const [woReason, setWoReason] = useState("");
  /* Markirovkali tovar kirimida skanerlangan yorliqlar. Miqdor shu
     ro'yxatdan kelib chiqadi — qo'lda yozilmaydi. */
  const [markCodes, setMarkCodes] = useState([]);
  const [markScan, setMarkScan]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [branchId, setBranchId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set()); // productId'lar
  /* Ogohlantirish filtri: "all" | "expired" | "near" | "low".
     Ogohlantirish blokidagi raqamlarning O'ZI filtr tugmasi — alohida
     boshqaruv qatori qo'shilsa, ekranda ikkita bir xil ro'yxat turardi. */
  const [flt, setFlt] = useState("all");
  /* «Muddati yaqin» oynasi — DO'KON sozlamasi (V41). Ustun bo'sh bo'lsa
     standart 7 kun; profil yuklanmaguncha ham shu qiymat ishlaydi, ya'ni
     jadval hech qachon chegarasiz qolmaydi. */
  const [nearDays, setNearDays] = useState(DEFAULT_NEAR_EXPIRY_DAYS);

  /* ⚠ `GET /shop/profile` HAR ROLGA ochiq (SecurityConfig'da `/shop/**`
     `.authenticated()`) — omborchi ham, kassir ham chegarani o'qiy oladi.
     Yozish esa faqat egasida. */
  useEffect(() => {
    shopApi.getProfile()
      .then((r) => {
        const v = Number(r?.data?.nearExpiryDays);
        if (Number.isFinite(v) && v > 0) setNearDays(v);
      })
      .catch(() => { /* o'qib bo'lmadi — standart qiymat qoladi */ });
  }, []);

  // Kirim-chiqim jurnali — alohida ko'rinish (jadval o'rnida)
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getAll(branchId);
      setItems(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const res = await inventoryApi.getMovements();
      setMovements(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMovLoading(false);
    }
  }, []);

  useEffect(() => { if (showHistory) loadMovements(); }, [showHistory, loadMovements]);

  const groups = useMemo(() => groupByProduct(items), [items]);

  /* Har qatorning holati bir marta hisoblanadi: u ham rang, ham yozuv,
     ham filtr, ham ogohlantirishdagi raqam uchun kerak. */
  const rows = useMemo(() => groups.map((g) => ({ g, f: flagsOf(g, nearDays) })), [groups, nearDays]);

  /* ⚠ Raqamlar QIDIRUVDAN OLDINGI ro'yxatdan olinadi: ogohlantirish
     do'kondagi haqiqiy holatni aytishi kerak, qidiruv maydonida nima
     yozilganini emas. */
  /* ⚠ «Kam qolgan» = KAM + TUGAGAN. Yozuvda ikkalasi ajratiladi (tugagan
     tovarni «kam qoldi» deb atash yolg'on), lekin FILTR bo'yicha ular bir
     xil ish talab qiladi: buyurtma berish. Ajratganda tugagan tovar
     ro'yxatdan butunlay tushib qolardi — ya'ni eng shoshilinchi tovar
     ko'rinmay qolardi. */
  const needsOrder = (f) => f.low || f.out;

  const counts = useMemo(() => ({
    expired: rows.filter((r) => r.f.expired).length,
    near:    rows.filter((r) => r.f.near).length,
    low:     rows.filter((r) => needsOrder(r.f)).length,
  }), [rows]);

  const filtered = rows.filter(({ g, f }) => {
    const q = search.toLowerCase();
    const hit = g.productName?.toLowerCase().includes(q) || (g.barcode || "").includes(search);
    if (!hit) return false;
    if (flt === "expired") return f.expired;
    if (flt === "near")    return f.near;
    if (flt === "low")     return needsOrder(f);
    return true;
  });

  const toggleExpand = (productId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const openModal = (group) => {
    setModal(group);
    setQty("");
    setExpiryDate("");
    setReason("");
    setMarkCodes([]);
  };

  const openCorrect = (batch) => {
    setCorrect(batch);
    setQty(String(batch.quantity ?? ""));
    setReason("");
    setWoReason("");
  };

  // Mahsulot bir marta muddat bilan kiritilgan bo'lsa — MUDDATLI: keyingi
  // kirimlarda muddat majburiy (backend ham xuddi shuni tekshiradi). Sut
  // kabi tovarda muddat unutilsa, o'sha partiya nazoratsiz qolardi.
  const productHasExpiry = (g) =>
    items.some((i) => i.productId === g.productId && i.expiryDate);

  const handleAddStock = async () => {
    const marked = !!modal.markingGroup;

    // Markirovkali tovarda miqdor yorliqlar sonidan keladi: "50" deb yozib
    // 48 ta yorliq skanerlansa, ikki dona kodsiz qolardi va ular kassada
    // umuman sotilmasdi.
    if (marked && markCodes.length === 0) {
      toast.error(t("marking.required"));
      return;
    }
    if (!marked && (!qty || Number(qty) <= 0)) {
      toast.error(t("inv.needQty"));
      return;
    }
    if (!expiryDate && productHasExpiry(modal)) {
      toast.error(t("inv.needExpiry"));
      return;
    }
    setSaving(true);
    try {
      const amount = marked ? markCodes.length : Number(qty);
      const res = await inventoryApi.addStock(
        modal.productId, amount, expiryDate || null, reason, marked ? markCodes : null);
      toast.success(res?.message
        || `${fmtQty(amount, unitDecimals(modal.unit))} ${unitLabel(modal.unit)} kirim qilindi`);
      setModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Qoldiq KAMAYAYAPTIMI — turkum faqat shunda so'raladi. Topilgan tovar
     (qoldiq oshishi) yo'qotish emas va undan turkum so'rash omborchini
     ma'nosiz tanlovga majburlardi. */
  const isDecrease = correct != null && qty !== ""
    && Number(qty) < Number(correct.quantity ?? 0);

  const handleCorrect = async () => {
    if (qty === "" || Number(qty) < 0) {
      toast.error(t("inv.needQty"));
      return;
    }
    // To'g'irlashda sabab MAJBURIY: jurnal "nima sababdan" degan savolga
    // javob berishi kerak — sababsiz to'g'irlash nazoratni yo'qqa chiqaradi.
    if (!reason.trim()) {
      toast.error(t("inv.correctNeedReason"));
      return;
    }
    /* Qoldiq kamaysa TURKUM ham majburiy — server bilan bir xil qoida.
       Bu yerda ham tekshiriladi, chunki xatoni yuborishdan oldin
       ko'rsatish tugmani bosib, kutib, so'ng xato olishdan yaxshiroq. */
    if (isDecrease && !woReason) {
      toast.error(t("inv.needWriteOffReason"));
      return;
    }
    setSaving(true);
    try {
      await guard(() => inventoryApi.correctBatch(
        correct.inventoryId, Number(qty), reason.trim(), isDecrease ? woReason : null));
      toast.success(t("inv.correctTitle"));
      setCorrect(null);
      loadData();
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtWhen = (iso) => {
    try { return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }); }
    catch (_) { return iso; }
  };

  const statusBadge = (expired) => (
    <span className={`badge ${expired ? "badge-red" : "badge-green"}`}>
      {expired ? t("enum.inventory.EXPIRED") : t("enum.shopStatus.ACTIVE")}
    </span>
  );

  /* Holat ustuni — RANGNING YOZUVDAGI nusxasi. Rang tez o'qiladi, yozuv
     esa aniq aytadi; ikkalasi ham kerak (rang ko'rmaydigan odam, qora-oq
     chop etish). Bir tovarda bir nechta yozuv bo'lishi mumkin.

     ⚠ HAR YOZUV O'ZI NIMA HAQIDALIGINI AYTADI. Ilgari shu ustunda yonma-yon
     «4 kun qoldi» va «Kam qoldi» turardi — birinchisi MUDDAT haqida,
     ikkinchisi MIQDOR haqida, lekin ikkalasi bir xil ko'rinardi va
     «4 kun qoldi» ni "4 dona qoldi" deb o'qish hech narsa bilan
     to'silmasdi. Endi muddat yozuvi «Yaroqlilik:» bilan boshlanadi,
     qoldiq yozuvi esa SONNI o'zi bilan olib yuradi. */
  const stateBadges = (f, g) => {
    if (!f.expired && !f.near && !f.low && !f.out) return statusBadge(false);
    /* `g` faqat MAHSULOT qatorida bo'ladi; partiya qatorida «kam qoldi» va
       «tugagan» yozuvlari umuman chiqmaydi, shuning uchun miqdor ham
       kerak emas. Guruhsiz chaqiruvda yiqilmasin. */
    const qty = g ? `${fmtQty(g.sellable, unitDecimals(g.unit))} ${unitLabel(g.unit)}` : "";
    return (
      <div className="inv-flags">
        {f.expired && <span className="badge badge-red">{t("enum.inventory.EXPIRED")}</span>}
        {f.near && (
          <span className="badge badge-yellow">
            {f.left === 0 ? t("inv.nearToday") : t("inv.nearDays", { n: f.left })}
          </span>
        )}
        {f.out && <span className="badge badge-red">{t("inv.outBadge")}</span>}
        {f.low && <span className="badge badge-red">{t("inv.lowBadge", { qty })}</span>}
      </div>
    );
  };

  /* Partiyaning holati. ⚠ Bu yerda "kam qoldiq" YO'Q: minimal qoldiq
     mahsulotga qo'yiladi, alohida partiyaga emas — ikkita yarim partiya
     birgalikda yetarli bo'lsa ham ikkalasi "kam" bo'lib qizarardi. */
  const batchFlags = (b) => {
    /* ⚠ Bo'shab qolgan partiya «Faol» EMAS. Ilgari `out` doim yolg'on edi
       va qoldig'i nol partiya yashil «Faol» bo'lib turardi — ro'yxatga
       qaragan odam u yerda tovar bor deb o'ylardi.

       Muddat ogohlantirishi ham berilmaydi: chirishi mumkin bo'lgan narsa
       qolmagan. Shu sababli `out` boshqa hamma narsani bosadi. */
    const out = (Number(b.quantity) || 0) <= 0;
    const left = daysLeft(b.expiryDate);
    const expired = !out && (isBatchExpired(b) || (left !== null && left < 0));
    return {
      expired,
      near: !out && !expired && left !== null && left <= nearDays,
      low: false,
      out,
      left,
    };
  };

  /* Fon sinfi — eng jiddiy holat bo'yicha (o'tgan > yaqin > tugagan > kam).
     Tugagan tovar kam qolgandan jiddiyroq, shuning uchun u oldinroq
     tekshiriladi; ikkalasi ham bir xil «och qizil» fonni ishlatadi. */
  const rowClass = (f) =>
    f.expired ? "inv-row--expired"
      : f.near ? "inv-row--near"
      : (f.out || f.low) ? "inv-row--low"
      : "";

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("inv.title")}</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      {/* ── PIN QILINGAN OGOHLANTIRISH ──────────────────────────────────
          Jadval bilan birga sirg'almaydi: `position: sticky` bilan topbar
          ostida turib qoladi. Sabab — muammoli tovar ro'yxatning O'RTASIDA
          bo'lishi mumkin va pastga tushgan omborchi ogohlantirishni ko'rmay
          qolardi.

          Raqamlarning o'zi FILTR tugmasi: «7 ta muddati o'tgan» ni bosgan
          odam aynan o'shalarni ko'radi. Alohida filtr paneli qo'shilsa,
          ekranda bir xil ma'noli ikkita boshqaruv turardi.

          ⚠ Blok muammo yo'q paytda UMUMAN chizilmaydi — har kuni bekorga
          yonib turgan ogohlantirish bir haftada ko'rinmas bo'lib qoladi
          (bosh sahifadagi «E'tibor talab qiladi» bloki bilan bir qoida).
          Filtr yoqilgan bo'lsa esa qoladi: aks holda tovarlar tuzatilgach
          blok yo'qolib, filtrni o'chirish tugmasi ham yo'qolardi. */}
      {!showHistory && (counts.expired + counts.near + counts.low > 0 || flt !== "all") && (
        <div className="inv-alert" role="status">
          <div className="inv-alert__head">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <b>{t("inv.alertTitle")}</b>
            <span className="text-muted inv-alert__hint">
              {t("inv.alertHint", { n: nearDays })}
            </span>
          </div>
          <div className="inv-alert__chips">
            <button type="button"
                    className={`btn btn-sm ${flt === "all" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setFlt("all")}>
              {t("common.all")} <span className="badge tab-badge">{rows.length}</span>
            </button>
            {counts.expired > 0 && (
              <button type="button"
                      className={`btn btn-sm ${flt === "expired" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setFlt("expired")}>
                <i className="fa-solid fa-hourglass-end" aria-hidden="true" /> {t("enum.inventory.EXPIRED")}
                <span className="badge badge-red tab-badge">{counts.expired}</span>
              </button>
            )}
            {counts.near > 0 && (
              <button type="button"
                      className={`btn btn-sm ${flt === "near" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setFlt("near")}>
                <i className="fa-solid fa-clock" aria-hidden="true" /> {t("inv.fltNear")}
                <span className="badge badge-yellow tab-badge">{counts.near}</span>
              </button>
            )}
            {counts.low > 0 && (
              <button type="button"
                      className={`btn btn-sm ${flt === "low" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setFlt("low")}>
                {/* ⚠ `arrow-down-short-wide` EMAS. Unda o'q pastga qaraydi,
                    ustunlar esa pastga qarab O'SADI — ikkita qarama-qarshi
                    ishora bitta ikonkada. `arrow-trend-down` bir narsani
                    aytadi: kamayish. */}
                <i className="fa-solid fa-arrow-trend-down" aria-hidden="true" /> {t("inv.fltLow")}
                <span className="badge badge-red tab-badge">{counts.low}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("products.search")}
            style={{ width: 320 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`btn btn-sm ${showHistory ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <i className="fa-solid fa-clock-rotate-left" /> {t("inv.history")}
            </button>
            <button className="btn btn-outline btn-sm" onClick={showHistory ? loadMovements : loadData} title={t("products.refreshTitle")}>
              <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          {showHistory ? (
            /* ── Kirim-chiqim jurnali ── */
            movLoading ? (
              <SkeletonTable rows={8} cols={["text", "wide", "num", "text", "text"]} />
            ) : movements.length === 0 ? (
              <Empty text={t("inv.histEmpty")} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("inv.histWhen")}</th>
                    <th>{t("products.col")}</th>
                    <th>{t("inv.histType")}</th>
                    <th>{t("inv.histDelta")}</th>
                    <th>{t("inv.expiry")}</th>
                    <th>{t("inv.histWho")}</th>
                    <th>{t("inv.reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtWhen(m.createdAt)}</td>
                      <td><div className="fw-700">{m.productName}</div></td>
                      <td>
                        <span className={`badge ${MOV_BADGE[m.type] || "badge-green"}`}>
                          {t(`mov.${m.type}`)}
                        </span>
                      </td>
                      <td className="mono fw-700" style={{ color: m.delta < 0 ? "var(--red, #dc2626)" : "var(--green, #16a34a)" }}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td>{m.expiryDate || "-"}</td>
                      <td>{m.performedBy}</td>
                      {/* Turkum izohning O'RNIGA emas, oldida: turkum
                          «nima bo'ldi», izoh «aynan qanday bo'ldi». */}
                      <td className="text-muted" style={{ maxWidth: 260 }}>
                        {m.writeOffReason && (
                          <span className="badge badge-yellow" style={{ marginRight: 6 }}>
                            {t(`enum.writeOff.${m.writeOffReason}`)}
                          </span>
                        )}
                        {m.reason || (m.writeOffReason ? "" : "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : busy ? (
            <SkeletonTable rows={8} cols={["wide", "num", "num", "text"]} />
          ) : filtered.length === 0 ? (
            /* Filtr yoqiqda "omborda topilmadi" degan xabar yolg'on bo'lardi:
               tovar bor, faqat shu filtrga tushmaydi. */
            <Empty text={t(flt === "all" ? "inv.notFound" : "inv.noMatch")} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("products.barcode")}</th>
                  <th>{t("inv.stock")}</th>
                  <th>{t("products.costPrice")}</th>
                  <th>{t("products.salePrice")}</th>
                  <th>{t("inv.expiry")}</th>
                  <th>{t("common.status")}</th>
                  {!branchId && <th className="text-end">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ g, f }) => {
                  const multi = g.batches.length > 1;
                  const isOpen = expanded.has(g.productId);
                  const single = g.batches[0];
                  return [
                    /* ── Asosiy qator: mahsulot bo'yicha JAMI ── */
                    /* ⚠ `opacity: .6` OLIB TASHLANDI. U matn kontrastini ham
                       tushirardi va aynan shu naqsh 09-CHETLANISHLAR §10ĝ da
                       taqiqlangan: "o'chganday" ko'rsatish uchun shaffoflik
                       ishlatilmaydi. Endi ma'noni fon rangi va yozuv beradi. */
                    <tr
                      key={`p-${g.productId}`}
                      className={rowClass(f)}
                      style={multi ? { cursor: "pointer" } : undefined}
                      onClick={multi ? () => toggleExpand(g.productId) : undefined}
                    >
                      <td>
                        <div className="fw-700" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {multi && (
                            <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"}`}
                               style={{ fontSize: 11, opacity: 0.55, width: 12 }} aria-hidden="true" />
                          )}
                          {g.productName}
                        </div>
                      </td>
                      <td><code className="mono">{g.barcode || "-"}</code></td>
                      <td>
                        {/* ⚠ Yalang'och son emas, BIRLIGI bilan: «0 dona»,
                            «1.5 kg». Ilgari ustunda faqat raqam turardi va
                            tarozili tovarda «1.5» nimani — kilonimi, donanimi
                            bildirishini jadvalga qarab bilib bo'lmasdi. */}
                        <span className={`badge ${(f.out || f.low) ? "badge-red" : "badge-green"}`}>
                          {fmtQty(g.sellable, unitDecimals(g.unit))} {unitLabel(g.unit)}
                        </span>
                      </td>
                      <td>{money(g.costPrice)}</td>
                      <td>{money(g.salePrice)}</td>
                      <td>
                        {multi
                          ? <span className="text-muted">{t("inv.batchCount", { n: g.batches.length })}{g.nearest ? ` · ${g.nearest}` : ""}</span>
                          : (single.expiryDate || t("inv.noExpiry"))}
                      </td>
                      <td>{stateBadges(f, g)}</td>
                      {!branchId && (
                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-primary btn-sm" onClick={() => openModal(g)}>
                            <i className="fa-solid fa-plus" /> {t("inv.receive")}
                          </button>{" "}
                          {/* Bitta partiyada to'g'irlash shu yerda; ko'p
                              partiyada QAYSI birini — ochib tanlanadi.

                              ⚠ `inventoryId == null` — hali kirim olmagan
                              tovar: server uni nol qoldiqli qator qilib
                              YASAB beradi, bazada partiya yo'q. To'g'irlash
                              partiyaga tegishli amal, shuning uchun bunda u
                              ko'rsatilmaydi — «Kirim» esa ishlaydi va
                              birinchi partiyani o'zi ochadi. */}
                          {!multi && single.inventoryId != null && (
                            <button className="btn btn-outline btn-sm" onClick={() => openCorrect(single)} title={t("inv.correctHint")}>
                              <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>,
                    /* ── Partiya qatorlari (ochilganda) ── */
                    ...(multi && isOpen
                      ? g.batches.map((b) => (
                          /* Partiya qatori ham o'z holatida bo'yaladi: guruh
                             sariq bo'lsayu ichida bittasi allaqachon o'tgan
                             bo'lsa, ochilgan ro'yxatda o'sha darrov ko'rinadi. */
                          <tr key={`b-${b.inventoryId}`}
                              className={`inv-row--batch ${rowClass(batchFlags(b))}`}>
                            <td colSpan={2}>
                              <div className="text-muted" style={{ paddingLeft: 26, fontSize: 12.5 }}>
                                <i className="fa-solid fa-layer-group" style={{ marginRight: 6, fontSize: 11 }} aria-hidden="true" />
                                {b.expiryDate || t("inv.noExpiry")}
                              </div>
                            </td>
                            <td><span className="mono fw-700">{b.quantity}</span></td>
                            <td colSpan={2}></td>
                            <td>{b.expiryDate || t("inv.noExpiry")}</td>
                            <td>{stateBadges(batchFlags(b))}</td>
                            {!branchId && (
                              <td className="text-end">
                                <button className="btn btn-outline btn-sm" onClick={() => openCorrect(b)} title={t("inv.correctHint")}>
                                  <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      : []),
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Kirim Modal ── */}
      {modal && (
        <Modal
          title={`${t("inv.receive")} — ${modal.productName}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-green btn-sm"
                onClick={handleAddStock}
                /* Markirovkali tovarda miqdor maydoni umuman yo'q — shart
                   yorliqlar soniga qaraydi, aks holda tugma doim o'chiq
                   qolardi. */
                disabled={saving || (modal.markingGroup ? markCodes.length === 0 : !qty)}
              >
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("inv.receiveAction")}
              </button>
            </>
          }
        >
          {/* Muddati o'tgan ogohlantirish */}
          {modal.expiredAll && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
                fontSize: 13,
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              ⚠️ {t("inv.expiredWarn")}
            </div>
          )}

          {/* Hozirgi sotiladigan qoldiq (jami) */}
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
              {t("inv.currentQty")}
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {fmtQty(modal.sellable, unitDecimals(modal.unit))} {unitLabel(modal.unit)}
            </span>
          </div>

          {/* ── Markirovkali tovar: miqdor YORLIQLARDAN ────────────────
              Bu yerda miqdor maydoni umuman ko'rsatilmaydi. Aks holda
              omborchi "50" deb yozib, 48 ta yorliq skanerlashi mumkin edi —
              ikki dona kodsiz qolib, kassada umuman sotilmasdi. */}
          {modal.markingGroup ? (
            <div className="form-group">
              <label className="form-label">{`${t("marking.receiveTitle")} *`}</label>
              <div className="ek-note ek-note--warn" style={{ marginBottom: 10 }}>
                <i className="fa-solid fa-barcode" aria-hidden="true" />
                <div>{t("marking.required")}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setMarkScan(true)}>
                <i className="fa-solid fa-qrcode" /> {t("marking.scanTitle")}
              </button>
              {markCodes.length > 0 && (
                <div className="form-hint" style={{ marginTop: 8 }}>
                  <i className="fa-solid fa-circle-check" style={{ color: "var(--fg-success)" }} />{" "}
                  {t("marking.received", { n: markCodes.length })}
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">{`${t("inv.receiveQty")} *`}</label>
              <NumField kind="qty"
                className="form-input ek-num"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="masalan: 50"
                autoFocus
              />
            </div>
          )}

          {/* Muddat: mahsulot ilgari muddat bilan kiritilgan bo'lsa MAJBURIY
              (yulduzcha + hint yo'q), aks holda ixtiyoriy — muddatsiz
              tovarlar (idish, kanstovar) uchun bo'sh qoldiriladi. */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">
              {t("inv.expiry")}{productHasExpiry(modal) ? " *" : ""}
            </label>
            <DateField
              className="form-input ek-num"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            {!productHasExpiry(modal) && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("inv.expiryOptional")}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("inv.reason")}</label>
            <input
              className="form-input"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("inv.reasonPh")}
              onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
            />
          </div>
        </Modal>
      )}

      {/* ── Markirovka yorliqlarini skanerlash ── */}
      {markScan && modal && (
        <MarkingScanModal
          product={{ id: modal.productId, name: modal.productName, markingGroup: modal.markingGroup }}
          mode="receive"
          onDone={(codes) => { setMarkCodes(codes); setMarkScan(false); }}
          onClose={() => setMarkScan(false)}
        />
      )}

      {/* ── To'g'irlash Modal ── */}
      {correct && (
        <Modal
          title={`${t("inv.correctTitle")} — ${correct.productName}`}
          onClose={() => setCorrect(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setCorrect(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCorrect}
                disabled={saving || qty === "" || !reason.trim() || (isDecrease && !woReason)}
              >
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("inv.correctAction")}
              </button>
            </>
          }
        >
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
              {t("inv.currentQty")}
              {correct.expiryDate ? ` · ${correct.expiryDate}` : ` · ${t("inv.noExpiry")}`}
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {fmtQty(correct.quantity, unitDecimals(correct.unit))} {unitLabel(correct.unit)}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">{`${t("inv.correctQty")} *`}</label>
            <NumField kind="qty"
              className="form-input ek-num"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {t("inv.correctHint")}
            </div>
          </div>

          {/* ⚠ Turkum faqat KAMAYISHDA. Ilgari sabab faqat erkin matn edi
              va «sindi», «sinib qoldi», «tushib ketdi» bitta hodisani uch
              xil nomlardi — «shu oy sinishga qancha ketdi» degan savolga
              javob yo'q edi. */}
          {isDecrease && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">{`${t("inv.writeOffReason")} *`}</label>
              <Select
                value={woReason}
                onChange={setWoReason}
                block
                variant="field"
                invalid={!woReason}
                placeholder={t("inv.writeOffReasonPh")}
                ariaLabel={t("inv.writeOffReason")}
                options={WRITE_OFF_REASONS.map((r) => ({
                  value: r.value, icon: r.icon, label: t(`enum.writeOff.${r.value}`),
                }))}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("inv.writeOffHint")}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{`${t("inv.reason")} *`}</label>
            <input
              className="form-input"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("inv.correctReasonPh")}
              onKeyDown={(e) => e.key === "Enter" && handleCorrect()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
