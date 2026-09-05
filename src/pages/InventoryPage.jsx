import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { inventoryApi, shopApi } from "../api";
import { BranchSelector, Modal } from "../components";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, SearchBar } from "../components/ui";
import FacetFilter from "../components/ek/FacetFilter";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import VariantMatrixModal from "../components/VariantMatrixModal";
import Select from "../components/ek/Select";
import { useAuth } from "../hooks/useAuth";
import { useBadge } from "../context/BadgeProvider";
import { money, quantity as fmtQty } from "../utils";
import { shortDate } from "../lib/ek-format";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { NumField, DateField } from "../components/ek/EkFields";
import { DEFAULT_NEAR_EXPIRY_DAYS, daysLeft } from "../lib/ek-expiry";
import { printExpiryLabels } from "../lib/ek-hardware";
import { rankItems } from "../lib/ek-search";

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

/* Jonli yangilanish qadami. 15 soniya — kassadagi sotuv omborda deyarli
   darhol ko'rinadi, lekin server bekorga band bo'lmaydi. */
const LIVE_REFRESH_MS = 15_000;

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
      /* Kiyim atributlari (V57) — partiyalar bitta tovarniki, shuning
         uchun birinchisiniki hammasiga yetadi. Filtr ham, jadvaldagi
         «M / qora» yozuvi ham shulardan. */
      brand: f.brand,
      targetGroup: f.targetGroup,
      sizeLabel: f.sizeLabel,
      sizeSort: f.sizeSort,
      colorName: f.colorName,
      colorHex: f.colorHex,
      season: f.season,
      variantGroupId: f.variantGroupId,
      variantGroupName: f.variantGroupName,
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
  const navigate = useNavigate();
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
  /* Kirim narxi — PARTIYAGA yoziladi (V53). Bo'sh qoldirilsa tovarning
     joriy tan narxi olinadi, ya'ni eski xatti-harakat. */
  const [costPrice, setCostPrice] = useState("");
  /* Serverdan kelgan narx tavsiyasi — kirimdan keyin ko'rsatiladi.
     ⚠ Hech narsani MAJBURLAMAYDI: bozor narxi tan narxga har doim ham
     ergashavermaydi va buni faqat do'kon egasi biladi. */
  const [advice, setAdvice] = useState(null);
  /* Chiqit turkumi — faqat to'g'irlashda va faqat qoldiq kamayganda. */
  const [woReason, setWoReason] = useState("");
  /* Markirovkali tovar kirimida skanerlangan yorliqlar. Miqdor shu
     ro'yxatdan kelib chiqadi — qo'lda yozilmaydi. */
  const [markCodes, setMarkCodes] = useState([]);
  const [markScan, setMarkScan]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [branchId, setBranchId] = useState(null);
  /* ⚠ ILGARI QATOR JOYIDA OCHILARDI (`expanded` — ochilgan `productId` lar).

     Partiyalar asosiy qatorning ostiga qo'shimcha qator bo'lib chiqardi va
     jadvalning qolgan qismi pastga surilib ketardi: omborchi qaragan
     tovar ko'zdan qochardi, ikkitasi ochilsa esa jadvalni umuman
     o'qib bo'lmasdi. Ustun sarlavhalari ham partiya qatorlariga
     to'g'ri kelmasdi — bitta jadvalda ikki xil ma'noli qator turardi.

     Endi tafsilot MODAL oynada: jadval qimirlamaydi, partiyalar esa
     o'z sarlavhalari bilan, kengroq joyda ko'rinadi. */
  /* ⚠ OBYEKT EMAS, ID saqlanadi. Guruh har chizishda `rows` dan qaytadan
     olinadi, ya'ni to'g'irlashdan yoki kirimdan keyin oyna YANGI raqamni
     ko'rsatadi. Obyekt saqlansa, omborchi qaytib kelganda o'zi hozirgina
     o'zgartirgan sonni eskisicha ko'rardi. */
  const [detailId, setDetailId] = useState(null);
  /* Qaysi mahsulot tafsilotidan chiqilgan — «Orqaga» shu yerga qaytaradi.
     Jadvaldan to'g'ridan-to'g'ri ochilganda `null` va tugma ko'rinmaydi. */
  const [backTo, setBackTo] = useState(null);
  /* Bo'shab qolgan partiyalarni ko'rsatishmi. */
  const [showEmptyBatches, setShowEmptyBatches] = useState(false);
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

  /**
   * `silent` — FON yangilanishi.
   *
   * ⚠ Fonda skeleton chizilmaydi va xato ko'rsatilmaydi. Sabab: bu
   * yangilanishni kassir SO'RAMAGAN. Har 15 soniyada jadval miltillab
   * tursa ishlab bo'lmaydi; tarmoq bir lahzaga uzilganda esa hech kim
   * bosmagan tugma uchun qizil xabar chiqishi bundan ham yomon —
   * ekrandagi ma'lumot baribir joyida qoladi va keyingi urinishda
   * yangilanadi.
   */
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await inventoryApi.getAll(branchId);
      setItems(res.data || []);
    } catch (err) {
      if (!silent) toast.error(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ⚠ Modal ochiq bo'lsa fon yangilanishi TO'XTAYDI. Kirim yoki
     to'g'irlash oynasi ochiq turganda jadval qayta chizilsa, qatorlar
     omborchining qo'li ostida siljib ketardi. Eskirgan jadval bundan
     yaxshiroq: oyna yopilishi bilan baribir yangilanadi.

     Ref ishlatilgan, holat emas — aks holda har modal ochilib-yopilganda
     taymer noldan boshlanardi va uzoq ishlaganda yangilanish umuman
     kechikib ketishi mumkin edi. */
  /* ══ KIYIM FILTRI VA MODEL JADVALI (V57) ═══════════════════════════ */
  const [clothFilter, setClothFilter] = useState({});
  const [filterOpen, setFilterOpen]   = useState(false);
  /* Ochilgan model guruhi — `null` bo'lsa jadval yopiq. */
  const [matrixGroup, setMatrixGroup] = useState(null);

  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = modal !== null || correct !== null || markScan;
  }, [modal, correct, markScan]);

  /* Jonli yangilanish. Qoldiq shu sahifada emas, KASSADA o'zgaradi —
     boshqa kassir sotgani ham, ikkinchi terminaldagi kirim ham bu yerda
     ko'rinishi kerak edi, lekin jadval faqat sahifa ochilganda yuklanardi.

     ⚠ Sahifa KO'RINMASA so'rov yuborilmaydi. Ombor tabi kun bo'yi orqada
     ochiq turadi — uni har 15 soniyada so'rovga tutish serverni ham,
     tarmoqni ham bekorga band qilardi. Tabga qaytilganda esa darhol
     yangilanadi: odam aynan o'sha lahzada ekranga qaraydi. */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || pausedRef.current) return;
      loadData({ silent: true });
    };
    const timer = setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadData]);

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

  /* Ochilgan tafsilot — HOZIRGI ma'lumotdan. Mahsulot ro'yxatdan
     yo'qolsa (filial almashdi, o'chirildi) oyna o'zi yopiladi. */
  const detail = detailId == null ? null : (rows.find((r) => r.g.productId === detailId)?.g || null);

  /* ⚠ Raqamlar QIDIRUVDAN OLDINGI ro'yxatdan olinadi: ogohlantirish
     do'kondagi haqiqiy holatni aytishi kerak, qidiruv maydonida nima
     yozilganini emas. */
  /* ⚠ «Kam qolgan» = KAM + TUGAGAN. Yozuvda ikkalasi ajratiladi (tugagan
     tovarni «kam qoldi» deb atash yolg'on), lekin FILTR bo'yicha ular bir
     xil ish talab qiladi: buyurtma berish. Ajratganda tugagan tovar
     ro'yxatdan butunlay tushib qolardi — ya'ni eng shoshilinchi tovar
     ko'rinmay qolardi. */
  const needsOrder = (f) => f.low || f.out;

  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═════════════════════════════════
     Do'kon egasi: «ekranda ko'ringan har bir ustun bilan filtr qila
     olsin». Ro'yxat AYNAN jadval sarlavhalariga mos: filtrda bor-u
     jadvalda yo'q ustun natijani tushuntirib bo'lmas qilardi va
     aksincha.

     ⚠ `get` — jadvalda ko'rinadigan QIYMATNI beradi, xom yozuvni
     emas: omborchi ekranda «71 dona» ni ko'rib turib, «qoldiq > 50»
     deb filtrlaydi va javob shu songa mos kelishi kerak. */
  const COLS = useMemo(() => [
    { key: "name",   label: t("products.col"),        type: "text",   get: ({ g }) => g.productName },
    { key: "code",   label: t("products.barcode"),    type: "text",   get: ({ g }) => g.barcode },
    /* ⚠ `sellable`, xom `quantity` EMAS: jadvalda ham SOTILADIGAN
       qoldiq turadi (muddati o'tgan partiya undan chiqarilgan).
       Xom qoldiq olinsa, «qoldiq > 0» filtri sotib bo'lmaydigan
       tovarni ham qaytarardi va omborchi uni javonda deb o'ylardi. */
    { key: "qty",    label: t("inv.stock"),           type: "number", get: ({ g }) => g.sellable },
    { key: "cost",   label: t("products.costPrice"),  type: "number", get: ({ g }) => g.costPrice },
    { key: "price",  label: t("products.salePrice"),  type: "number", get: ({ g }) => g.salePrice },
    /* `nearest` — qoldig'i BOR partiyalardan eng yaqin muddat; aynan
       shu sana jadvalda ko'rinadi. */
    { key: "expiry", label: t("inv.expiry"),          type: "date",   get: ({ g }) => g.nearest },
    /* Holat — hisoblanadigan ustun: ekranda yozuv bo'lib turadi. */
    { key: "state",  label: t("common.status"),       type: "enum",
      options: [
        { value: "expired", label: t("enum.inventory.EXPIRED") },
        { value: "near",    label: t("inv.fltNear") },
        { value: "low",     label: t("inv.fltLow") },
        { value: "out",     label: t("enum.inventory.OUT_OF_STOCK") },
        { value: "ok",      label: t("enum.inventory.ACTIVE") },
      ],
      get: ({ f }) => (f.expired ? "expired" : f.near ? "near"
                      : f.out ? "out" : f.low ? "low" : "ok") },
  ], []);
  const colFlt = useDataFilter(COLS, "inv");

  const counts = useMemo(() => ({
    expired: rows.filter((r) => r.f.expired).length,
    near:    rows.filter((r) => r.f.near).length,
    low:     rows.filter((r) => needsOrder(r.f)).length,
  }), [rows]);

  /* Panelning segmentlari — ekrandagi tartibda. `tone` FAQAT songa
     beriladi: butun tugmani bo'yash panelni yana «sariq devor» ga
     aylantirardi. */
  /* ⚠ «Tugagan» ALOHIDA segment EMAS — u «kam qolgan» ichida
     (`needsOrder`, yuqoridagi izoh): ikkalasi bir xil ish talab
     qiladi — buyurtma berish, va ajratilganda eng shoshilinchi tovar
     ikkinchi ro'yxatga tushib ko'rinmay qolardi. */
  const STATES = [
    { key: "all",     icon: "",                    n: rows.length,    tone: "" },
    { key: "expired", icon: "fa-hourglass-end",    n: counts.expired, tone: "danger" },
    { key: "near",    icon: "fa-clock",            n: counts.near,    tone: "warn" },
    { key: "low",     icon: "fa-arrow-trend-down", n: counts.low,     tone: "danger" },
  ];
  /* Ogohlantirish TONI — faqat haqiqiy muammo bo'lganda. */
  const alerting = counts.expired + counts.near + counts.low > 0;

  /* ── MUDDAT STIKERLARI (V48) ──────────────────────────────────────
     ⚠ NEGA KERAK. Muddati yaqin tovarni ro'yxatda ko'rish yetmaydi:
     u JAVONDA turibdi va sotuvchi ham, xaridor ham ro'yxatni emas,
     javonni ko'radi. Xodim shu stikerlarni bosib chiqadi va tovarga
     yopishtirib chiqadi — shundan keyin «muddati yaqin» ombor
     hisoboti emas, javondagi ko'rinadigan belgi bo'ladi.

     ⚠ Chiqadigan ro'yxat — EKRANDAGISI (`filtered`), hammasi emas:
     omborchi «Muddati yaqin» filtrini bosib, aynan o'sha tovarlarga
     stiker chiqaradi. Butun omborni stikerlash hech kimga kerak emas
     va bir dasta qog'ozni yeydi. */
  const [labeling, setLabeling] = useState(false);
  const printLabels = async (list) => {
    const items = list
      .filter(({ g }) => g.nearest)          // muddatsiz tovarga stiker yo'q
      .map(({ g, f }) => ({
        name: g.productName,
        expiryDate: g.nearest,
        daysLeft: f.left,
        salePrice: g.salePrice,
        barcode: g.barcode,
      }));
    if (!items.length) { toast?.error(t("label.nothing")); return; }
    setLabeling(true);
    try {
      await printExpiryLabels(items, { shopName: localStorage.getItem("ek_shopName") || "" });
      toast?.success(t("label.sent", { n: items.length }));
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLabeling(false);
    }
  };

  /* ══ KIYIM FILTRI (V57) ═══════════════════════════════════════════════
     ⚠ MIJOZ TOMONIDA, serverda emas. Ombor jadvali qoldiqlar bo'yicha
     KELIB BO'LGAN (`inventoryApi.getAll`) va u allaqachon xotirada.
     Serverga qayta murojaat qilish javobni kutishni va jonli
     yangilanish bilan poygani qo'shardi — natija esa AYNAN o'sha.

     ⚠ Katakchalar ham SHU RO'YXATDAN olinadi: sanoq omborchi
     ko'rayotgan jadvalga to'g'ri keladi. Server `facets` i butun
     katalogni sanardi va «Zara (40)» deb turgan katakcha bosilganda
     omborda 3 tasi chiqib, omborchi tizimni buzuq deb o'ylardi. */
  const invFacets = useMemo(() => {
    const bucket = { brands: new Map(), sizes: new Map(), colors: new Map(),
                     targets: new Map(), seasons: new Map() };
    const add = (map, value, label, hex, ord) => {
      if (!value) return;
      const cur = map.get(value) || { value, label: label || value, count: 0, hex, ord };
      cur.count++;
      map.set(value, cur);
    };
    for (const { g } of rows) {
      add(bucket.brands,  g.brand, g.brand, null, 0);
      add(bucket.sizes,   g.sizeLabel, g.sizeLabel, null, g.sizeSort ?? 9999);
      add(bucket.colors,  g.colorName, g.colorName, g.colorHex, 0);
      add(bucket.targets, g.targetGroup, t(`target.${(g.targetGroup || "").toLowerCase()}`), null, 0);
      add(bucket.seasons, g.season, t(`season.${(g.season || "").toLowerCase()}`), null, 0);
    }
    const out = (map, byOrd) => {
      const list = [...map.values()];
      /* O'lchamlar TARTIB RAQAMI bo'yicha — alifboda «L, M, S» chiqardi. */
      list.sort((a, b) => (byOrd ? a.ord - b.ord : 0) || a.label.localeCompare(b.label));
      return list;
    };
    return {
      categories: [],
      brands: out(bucket.brands), sizes: out(bucket.sizes, true),
      colors: out(bucket.colors), targets: out(bucket.targets),
      seasons: out(bucket.seasons),
    };
  }, [rows]);

  /**
   * Filtr umuman kerakmi — kiyimsiz omborda tugma ham chiqmaydi.
   *
   * ⚠ `Boolean(...)` SHART, yalang'och `||` zanjiri EMAS. Zanjirning
   * qiymati oxirgi `.length`, ya'ni RAQAM: kiyim atributi yo'q
   * omborda u `0` bo'ladi va `{shart && <tugma/>}` da React nolning
   * O'ZINI ekranga chizadi — qidiruv yonida sababsiz «0» paydo
   * bo'lardi (do'kon egasi rasm bilan ko'rsatdi). Xato jimgina:
   * konsolda ham, qurilishda ham hech narsa chiqmaydi.
   */
  const hasClothing = Boolean(invFacets.brands.length || invFacets.sizes.length
    || invFacets.colors.length || invFacets.targets.length || invFacets.seasons.length);

  const filterCount = useMemo(
    () => Object.values(clothFilter).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0),
    [clothFilter],
  );

  /* ⚠ Avval HOLAT bo'yicha filtrlanadi, keyin qidiruv REYTINGLAYDI.
     Tartib muhim: qidiruv natijani mosligiga qarab saralaydi va
     undan keyin filtrlash saralashni buzardi. Algoritm kassadagi
     bilan bir xil (`lib/ek-search.js`). */
  const byState = rows.filter(({ f, g }) => {
    if (flt === "expired" && !f.expired) return false;
    if (flt === "near"    && !f.near)    return false;
    if (flt === "low"     && !needsOrder(f)) return false;

    /* ⚠ HAR O'Q ICHIDA «YOKI», O'QLAR ORASIDA «VA». «M + L» ikkala
       o'lchamni ham beradi, «M + qora» esa faqat qora M ni. Boshqacha
       bo'lsa filtr toraytirmasdi, kengaytirardi — checkbox dan
       kutiladigan narsa esa aynan toraytirish. */
    const ok = (sel, v) => !sel?.length || sel.includes(v);
    return ok(clothFilter.brands,  g.brand)
        && ok(clothFilter.sizes,   g.sizeLabel)
        && ok(clothFilter.colors,  g.colorName)
        && ok(clothFilter.targets, g.targetGroup)
        && ok(clothFilter.seasons, g.season);
  });
  /* ⚠ TARTIB: tez filtr (chiplar) → USTUN FILTRI → qidiruv. Qidiruv
     oxirida, chunki u natijani MOSLIK bo'yicha saralaydi; ustun
     saralashi esa qidiruvsiz ishlaydi. */
  const filtered = rankItems(colFlt.apply(byState), search, {
    codes: ({ g }) => [g.barcode],
    texts: ({ g }) => [g.productName],
  });


  /**
   * Tafsilotdan chaqirilgan oynadan ORQAGA.
   *
   * ⚠ Har oyna uchun bir xil: kirim ham, to'g'irlash ham tafsilotdan
   * ochiladi va ikkalasidan ham qaytish yo'li bo'lishi kerak. Ilgari
   * to'g'irlash oynasi ochilganda tafsilot yopilib ketardi va omborchi
   * qolgan partiyalarni ko'rish uchun jadvaldan qaytadan qidirardi.
   */
  const goBack = () => {
    setModal(null);
    setCorrect(null);
    setDetailId(backTo);
    setBackTo(null);
  };

  /** Tafsilotdan boshqa oynaga o'tish — qaytish nuqtasini eslab qolib. */
  const fromDetail = (open) => {
    setBackTo(detailId);
    setDetailId(null);
    open();
  };

  const openModal = (group) => {
    setModal(group);
    setQty("");
    setExpiryDate("");
    setReason("");
    setMarkCodes([]);
    /* ⚠ Tan narx OLDINDAN to'ldirilmaydi. Ilgari to'ldirilsa omborchi
       uni o'zgartirmasdan o'taverar va har kirim «narx o'zgarmadi»
       bo'lib qolardi — ya'ni partiya tannarxi hech qachon yangilanmasdi.
       Bo'sh maydon savol beradi: «bu partiya qanchaga tushdi?» */
    setCostPrice("");
    setAdvice(null);
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
        modal.productId, amount, expiryDate || null, reason,
        marked ? markCodes : null, costPrice);
      toast.success(res?.message
        || `${fmtQty(amount, unitDecimals(modal.unit))} ${unitLabel(modal.unit)} kirim qilindi`);
      /* ⚠ Muvaffaqiyatdan keyin ham TAFSILOTGA qaytiladi (agar undan
         kelingan bo'lsa): omborchi kiritgan miqdorining partiyalar
         ro'yxatida paydo bo'lganini o'sha zahoti ko'radi. */
      /* ⚠ TAVSIYA BO'LSA OYNA YOPILMAYDI. Aks holda omborchi
         «tan narx sotuv narxidan oshib ketdi» degan eng muhim xabarni
         ko'rmay qolardi: toast bir necha soniyada yo'qoladi va uni
         qaytarib bo'lmasdi. */
      const adv = res?.data?.priceAdvice || null;
      if (adv) {
        setAdvice(adv);
      } else if (backTo != null) { goBack(); } else { setModal(null); }
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
      if (backTo != null) goBack(); else setCorrect(null);
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

      {/* ── OMBOR HOLAT PANELI (V68 da qayta ishlangan) ────────────────
          Do'kon egasi: «2-rasmdagi oynani ham nimadir qilish kerak
          yoqmayapti, balki filtrni shunga joylarsan — bu yaxshi g'oya».

          ═══ ILGARI NIMA NOTO'G'RI EDI ═══════════════════════════════

          1. Panel MUAMMO BO'LMASA UMUMAN CHIZILMASDI. Ya'ni omborda
             hammasi joyida bo'lgan kunlari «Tugagan» yoki «Hammasi»
             bo'yicha ajratib ko'rishning YO'LI QOLMASDI — holat
             tanlagichi ogohlantirish bilan bir taqdirni bo'lishardi,
             holbuki u oddiy ko'rish vositasi.
          2. Butun blok SARIQ edi: sarlavha, izoh va tugmalar bir xil
             ogohlantirish rangida. Har kuni yonib turgan ogohlantirish
             bir haftada ko'rinmas bo'lib qoladi.
          3. Uch qator joy egallardi (sarlavha + izoh + chiplar), va u
             `sticky` — ya'ni bu joy jadvaldan DOIM o'g'irlangan.

          ═══ ENDI ════════════════════════════════════════════════════

          BITTA qator: chapda holat segmentlari, o'ngda batafsil filtr
          va stiker. Panel HAR DOIM turadi, lekin ogohlantirish TONI
          faqat haqiqiy muammo bo'lganda yoqiladi (chap chekkadagi
          rangli chiziq + izoh). Rang endi FAQAT sondan chiqadi:
          «muddati o'tgan 7» qizil, «kam qolgan 3» sariq, qolgani
          betaraf.

          ⚠ Segment faqat SONI BOR holat uchun chiziladi (+ «Hammasi»
          doim): nol turgan tugma bosilsa bo'sh ro'yxat chiqib,
          omborchi «yuklanmadimi?» deb o'ylardi. Tanlangan holat esa
          nolga tushsa ham qoladi — aks holda tovar tuzatilgach tugma
          yo'qolib, filtrdan chiqish yo'li ham yo'qolardi. */}
      {!showHistory && (
        <div className={`inv-bar${alerting ? " inv-bar--warn" : ""}`}
             role={alerting ? "status" : undefined}>
          <div className="inv-bar__states" role="tablist" aria-label={t("common.status")}>
            {STATES.map(({ key, icon, n, tone }) => (
              (key === "all" || n > 0 || flt === key) && (
                <button key={key} type="button" role="tab" aria-selected={flt === key}
                        className={`inv-seg${flt === key ? " is-on" : ""}`}
                        onClick={() => setFlt(key)}>
                  {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
                  <span>{key === "all" ? t("common.all")
                        : key === "expired" ? t("enum.inventory.EXPIRED")
                        : key === "near" ? t("inv.fltNear")
                        : t("inv.fltLow")}</span>
                  <span className={`inv-seg__n${tone ? ` is-${tone}` : ""}`}>{n}</span>
                </button>
              )
            ))}
          </div>

          <div className="inv-bar__tools">
            {/* ⚠ USTUN FILTRI SHU YERDA (do'kon egasining g'oyasi). Tez
                holatlar va batafsil filtr bitta ish qiladi —
                ro'yxatni toraytiradi; ularni sahifaning ikki
                burchagiga bo'lish omborchini qidirishga majburlardi. */}
            {/* ⚠ `compact` EMAS: qisqa ko'rinishda faol shartlar CHIPI
                chizilmaydi va «nega ro'yxat qisqa?» degan savol javobsiz
                qolardi — tugmadagi son shartning O'ZINI aytmaydi.
                Chiplar panelda o'z qatoriga o'tadi (flex-wrap). */}
            <DataFilter cols={COLS} flt={colFlt} />
            {/* ⚠ Stiker tugmasi shu yerda: omborchi «Muddati yaqin» ni
                bosadi va darhol shu qatordan stikerni chiqaradi. */}
            {counts.near > 0 && (
              <button type="button" className="btn btn-sm btn-outline" disabled={labeling}
                      onClick={() => printLabels(rows.filter(({ f }) => f.near))}
                      title={t("label.expiryHint")}>
                <i className="fa-solid fa-tag" aria-hidden="true" /> {t("label.expiryPrint")}
              </button>
            )}
          </div>

          {/* Izoh FAQAT ogohlantirish paytida: tinch kunda u bitta
              qatorni bekorga egallardi. */}
          {alerting && (
            <div className="inv-bar__hint">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              {t("inv.alertHint", { n: nearDays })}
            </div>
          )}
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
            {/* ⚠ Filtr tugmasi FAQAT kiyim atributlari bo'lsa. Oziq-ovqat
                omborida u bosilganda bo'sh oyna ochilardi va omborchi
                nimadir yuklanmagan deb o'ylardi. */}
            {!showHistory && hasClothing && (
              <button className={`btn btn-sm btn-outline filter-btn ${filterCount > 0 ? "is-on" : ""}`}
                      onClick={() => setFilterOpen(true)}>
                <i className="fa-solid fa-filter" /> {t("common.filter")}
                {filterCount > 0 && <span className="facet__badge ek-num">{filterCount}</span>}
              </button>
            )}
            <button
              className={`btn btn-sm ${showHistory ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <i className="fa-solid fa-clock-rotate-left" /> {t("inv.history")}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => (showHistory ? loadMovements() : loadData())} title={t("products.refreshTitle")}>
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
                      <td>{m.expiryDate ? shortDate(m.expiryDate) : "-"}</td>
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
              {/* ⚠ SARLAVHA BOSILSA — SARALASH (V68): o'sish → kamayish →
                  tartibsiz. Uchinchi bosish tartibni BEKOR qiladi, aks
                  holda dastlabki tartibga qaytish yo'li qolmasdi. */}
              <thead>
                <tr>
                  <SortTh flt={colFlt} col="name">{t("products.col")}</SortTh>
                  <SortTh flt={colFlt} col="code">{t("products.barcode")}</SortTh>
                  <SortTh flt={colFlt} col="qty">{t("inv.stock")}</SortTh>
                  <SortTh flt={colFlt} col="cost">{t("products.costPrice")}</SortTh>
                  <SortTh flt={colFlt} col="price">{t("products.salePrice")}</SortTh>
                  <SortTh flt={colFlt} col="expiry">{t("inv.expiry")}</SortTh>
                  <SortTh flt={colFlt} col="state">{t("common.status")}</SortTh>
                  {!branchId && <th className="text-end">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ g, f }) => {
                  const multi = g.batches.length > 1;
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
                      style={{ cursor: "pointer" }}
                      /* ⚠ MODAL EMAS, SAHIFA (V60). Partiyalar uchta
                         bo'limga bo'lindi (faol, muddati o'tgan, arxiv) va
                         modal ichida ular oynani scrolga majbur qilardi.
                         Sahifada havola bo'ladi, brauzerning «orqaga»
                         tugmasi ishlaydi va omborchi uni ochiq qoldirib
                         boshqa ishga o'ta oladi. */
                      onClick={() => navigate(`/inventory/${g.productId}`)}
                      title={t("inv.openDetails")}
                    >
                      <td>
                        <div className="fw-700" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <i className="fa-solid fa-chevron-right"
                             style={{ fontSize: 11, opacity: 0.55, width: 12 }} aria-hidden="true" />
                          {g.productName}
                          {/* ⚠ MODEL JADVALI TUGMASI (V57) — «qaysi
                              o'lchamdan qancha qoldi?». Ilgari omborchi
                              variantlarni jadvaldan ko'z bilan yig'ardi:
                              «Ko'ylak — S», «Ko'ylak — M» … alohida
                              qatorlarda sochilib yotardi.

                              ⚠ `stopPropagation`: qator bosilganda
                              tafsilot ochiladi va usiz ikkala oyna
                              birdan ochilardi. */}
                          {g.variantGroupId && (
                            <button type="button" className="btn-icon btn-icon--xs"
                                    title={t("clothing.matrix")}
                                    aria-label={t("clothing.matrix")}
                                    onClick={(e) => { e.stopPropagation(); setMatrixGroup(g.variantGroupId); }}>
                              <i className="fa-solid fa-table-cells" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        {/* O'lcham va rang — nom ostida, kichik yozuvda:
                            ular qatorni ajratadigan YAGONA belgi. */}
                        {(g.sizeLabel || g.colorName) && (
                          <div className="inv-attrs">
                            {g.sizeLabel && <span className="inv-attrs__size">{g.sizeLabel}</span>}
                            {g.colorName && (
                              <span className="inv-attrs__color">
                                {g.colorHex && <span className="facet__dot" style={{ background: g.colorHex }} aria-hidden="true" />}
                                {g.colorName}
                              </span>
                            )}
                          </div>
                        )}
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
                          ? <span className="text-muted">{t("inv.batchCount", { n: g.batches.length })}{g.nearest ? ` · ${shortDate(g.nearest)}` : ""}</span>
                          : (single.expiryDate ? shortDate(single.expiryDate) : t("inv.noExpiry"))}
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
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Mahsulot tafsiloti ──────────────────────────────────────────
          Jadvaldagi qator bosilganda ochiladi. Jadval o'z o'rnida qoladi:
          omborchi oynani yopgach nigohi qayerda qolgan bo'lsa, o'sha
          yerdan davom etadi. */}
      {detail && (() => {
        /* ⚠ BO'SHAB QOLGAN PARTIYALAR YASHIRILADI (o'chirilmaydi).

           Savol o'rinli edi: qoldig'i nol partiyani nega ko'rsatamiz?
           Javob — uni BAZADAN o'chirib bo'lmaydi: har kirim-chiqim
           yozuvi o'sha partiyaga ishora qiladi (kim, qachon, qaysi
           muddatli tovarni sotdi/chiqitga chiqardi). Partiyani
           o'chirish jurnalni ham, chiqit hisobotini ham uzib qo'yardi —
           ya'ni nazoratning o'zini.

           Lekin EKRANDA ular kerak emas: sotiladigan narsa yo'q. Shuning
           uchun yashiriladi, kerak bo'lsa bir bosishda ochiladi. */
        const empties = detail.batches.filter((b) => !(Number(b.quantity) > 0));
        const shown = showEmptyBatches
          ? detail.batches
          : detail.batches.filter((b) => Number(b.quantity) > 0);
        /* Hech narsa qolmagan mahsulotda bittasini ko'rsatamiz —
           bo'sh ro'yxat «ma'lumot yuklanmadi» degan taassurot berardi. */
        const list = shown.length ? shown : detail.batches.slice(0, 1);

        return (
        <Modal
          title={detail.productName}
          onClose={() => setDetailId(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setDetailId(null)}>
                {t("common.close")}
              </button>
              {!branchId && (
                <button className="btn btn-green btn-sm"
                        onClick={() => fromDetail(() => openModal(detail))}>
                  <i className="fa-solid fa-plus" /> {t("inv.receive")}
                </button>
              )}
            </>
          }
        >
          <div className="inv-detail">
            {/* ⚠ Yorliq va qiymat BIR QATORDA. Ustma-ust turganda oyna
                enига keng bo'lsa ham behuda cho'zilardi: to'rtta maydon
                sakkiz qator joy olardi, partiyalar esa pastga tushib
                ko'rinmay qolardi. */}
            <div className="inv-detail__grid">
              <div>
                <span className="inv-detail__label">{t("products.barcode")}</span>
                <span className="inv-detail__value mono">{detail.barcode || "-"}</span>
              </div>
              <div>
                <span className="inv-detail__label">{t("inv.stock")}</span>
                <span className="inv-detail__value ek-num">
                  {fmtQty(detail.sellable, unitDecimals(detail.unit))} {unitLabel(detail.unit)}
                </span>
              </div>
              <div>
                <span className="inv-detail__label">{t("products.costPrice")}</span>
                <span className="inv-detail__value ek-num">{money(detail.costPrice)}</span>
              </div>
              <div>
                <span className="inv-detail__label">{t("products.salePrice")}</span>
                <span className="inv-detail__value ek-num">{money(detail.salePrice)}</span>
              </div>
            </div>

            <div className="inv-detail__head">
              <span>
                <i className="fa-solid fa-layer-group" aria-hidden="true" />{" "}
                {t("inv.batchCount", { n: list.length })}
              </span>
              {empties.length > 0 && (
                <button type="button" className="inv-detail__toggle"
                        onClick={() => setShowEmptyBatches((v) => !v)}>
                  {showEmptyBatches
                    ? t("inv.hideEmptyBatches")
                    : t("inv.showEmptyBatches", { n: empties.length })}
                </button>
              )}
            </div>

            {/* ⚠ Partiya HOLATI bilan: guruh sariq bo'lsayu ichida bittasi
                allaqachon o'tgan bo'lsa, aynan o'shasi ko'rinib turishi
                kerak — omborchi shu qatorni chiqarib tashlaydi. */}
            <div className="inv-detail__batches">
              {list.map((b) => (
                <div key={b.inventoryId ?? "empty"} className={`inv-batch ${rowClass(batchFlags(b))}`}>
                  <div className="inv-batch__main">
                    <span className="inv-batch__qty ek-num">
                      {fmtQty(b.quantity, unitDecimals(detail.unit))} {unitLabel(detail.unit)}
                    </span>
                    <span className="inv-batch__exp">
                      {b.expiryDate ? `${t("inv.expiry")}: ${shortDate(b.expiryDate)}` : t("inv.noExpiry")}
                    </span>
                  </div>
                  <div className="inv-batch__side">
                    {stateBadges(batchFlags(b))}
                    {/* ⚠ `inventoryId == null` — hali kirim olmagan tovar:
                        server uni nol qoldiqli qator qilib YASAB beradi,
                        bazada partiya yo'q. To'g'irlash partiyaga tegishli
                        amal, shuning uchun bunda ko'rsatilmaydi. */}
                    {!branchId && b.inventoryId != null && (
                      <button className="btn btn-outline btn-sm"
                              onClick={() => fromDetail(() => openCorrect(b))}
                              title={t("inv.correctHint")}>
                        <i className="fa-solid fa-sliders" /> {t("inv.correctAction")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
        );
      })()}

      {/* ── Kirim Modal ── */}
      {modal && (
        <Modal
          title={`${t("inv.receive")} — ${modal.productName}`}
          onClose={() => (backTo != null ? goBack() : setModal(null))}
          footer={
            <>
              {/* Tafsilotdan kelingan bo'lsa — «Orqaga», aks holda «Bekor».
                  Amal bir xil (saqlamasdan yopish), lekin nomi qayerga
                  tushishini aytadi. */}
              <button className="btn btn-outline btn-sm" onClick={() => (backTo != null ? goBack() : setModal(null))}>
                {backTo != null
                  ? <><i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("common.back")}</>
                  : t("common.cancel")}
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
              <NumField kind="qty" unit={modal.unit}
                className="form-input ek-num"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="masalan: 50"
                autoFocus
              />
            </div>
          )}

          {/* ⚠ KIRIM NARXI (V53) — PARTIYAGA yoziladi, tovarga emas.
              Ilgari tan narx faqat tovarda turardi: yangi kirim narxi
              ko'tarilsa javondagi ESKI arzon tovar ham qimmat tannarxda
              sotilgan deb hisoblanardi va hisobotdagi foyda haqiqiy emas edi. */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("inv.costPrice")}</label>
            <NumField kind="money" className="form-input ek-num"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder={modal.costPrice != null ? String(modal.costPrice) : "0"} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {t("inv.costPriceHint")}
            </div>
          </div>

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

      {/* ══ NARX TAVSIYASI (V53) ══════════════════════════════════════
          Kirimda tan narx o'zgargan bo'lsa chiqadi.

          ⚠ HECH NARSANI MAJBURLAMAYDI va hech narsani o'zgartirmaydi:
          bozor narxi tan narxga har doim ham ergashavermaydi va buni
          faqat do'kon egasi biladi. Shuning uchun bu yerda «qo'llash»
          tugmasi ham YO'Q — narx Katalogdan, bajik bilan o'zgaradi.

          ⚠ TOAST BILAN KO'RSATILMAYDI: «sotuv narxi tan narxdan past
          bo'lib qoldi» degan xabar bir necha soniyada yo'qolib ketsa,
          omborchi uni ko'rmay qolardi va do'kon har sotuvda zarar
          ko'raverardi. */}
      {advice && (
        <Modal
          title={t("inv.priceAdvice")}
          onClose={() => { setAdvice(null); if (backTo != null) goBack(); else setModal(null); }}
          maxWidth={420}
          footer={
            <button className="btn btn-primary btn-sm"
                    onClick={() => { setAdvice(null); if (backTo != null) goBack(); else setModal(null); }}>
              <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.ok")}
            </button>
          }
        >
          {advice.belowCost && (
            <div className="ek-note ek-note--warn" style={{ marginBottom: 12 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <div>{t("inv.adviceBelowCost")}</div>
            </div>
          )}

          <div className="inv-detail__row">
            <span className="inv-detail__label">{t("products.costPrice")}</span>
            <span className="inv-detail__value ek-num">
              {money(advice.oldCost)} → <b>{money(advice.newCost)}</b>
            </span>
          </div>
          <div className="inv-detail__row">
            <span className="inv-detail__label">{t("products.salePrice")}</span>
            <span className="inv-detail__value ek-num">{money(advice.salePrice)}</span>
          </div>
          <div className="inv-detail__row">
            <span className="inv-detail__label">{t("inv.adviceMargin")}</span>
            <span className="inv-detail__value ek-num"
                  style={{ color: advice.belowCost ? "var(--fg-danger)" : undefined }}>
              {advice.marginPercent == null ? "—" : `${Number(advice.marginPercent).toFixed(1)}%`}
            </span>
          </div>
          {advice.recommendedSale != null && (
            <div className="inv-detail__row">
              <span className="inv-detail__label">{t("inv.adviceRecommend")}</span>
              <span className="inv-detail__value ek-num fw-800 text-blue">
                {money(advice.recommendedSale)}
              </span>
            </div>
          )}
        </Modal>
      )}

      {/* ── To'g'irlash Modal ── */}
      {correct && (
        <Modal
          title={`${t("inv.correctTitle")} — ${correct.productName}`}
          onClose={() => (backTo != null ? goBack() : setCorrect(null))}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => (backTo != null ? goBack() : setCorrect(null))}>
                {backTo != null
                  ? <><i className="fa-solid fa-arrow-left" aria-hidden="true" /> {t("common.back")}</>
                  : t("common.cancel")}
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
              {correct.expiryDate ? ` · ${shortDate(correct.expiryDate)}` : ` · ${t("inv.noExpiry")}`}
            </span>
            <span className="mono fw-800" style={{ fontSize: 16 }}>
              {fmtQty(correct.quantity, unitDecimals(correct.unit))} {unitLabel(correct.unit)}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">{`${t("inv.correctQty")} *`}</label>
            <NumField kind="qty" unit={correct.unit}
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

      {filterOpen && (
        <FacetFilter
          facets={invFacets}
          value={clothFilter}
          onChange={setClothFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {/* ⚠ MODEL JADVALI — «qaysi o'lchamdan qancha qoldi?». Ilgari
          omborchi variantlarni jadvaldan ko'z bilan yig'ardi. */}
      {matrixGroup && (
        <VariantMatrixModal
          groupId={matrixGroup}
          shopId={branchId}
          toast={toast}
          onClose={() => setMatrixGroup(null)}
        />
      )}
    </div>
  );
}
