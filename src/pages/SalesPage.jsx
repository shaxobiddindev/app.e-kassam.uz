import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { saleApi, shopApi } from "../api";
import { money, fmtMoney } from "../utils";
import { BranchSelector, Modal } from "../components";
import { Empty, SearchBar, Badge, Field } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useBadge } from "../context/BadgeProvider";
import { useAuth } from "../hooks/useAuth";
import { PAYMENT_TYPE, SALE_STATUS, paymentEntry, saleStatus,
         dispositionOptions, writeOffOptions,
         RETURN_WRITE_OFF_EXCLUDE } from "../lib/ek-labels";
import { asArray } from "../lib/ek-array";
import { PERIODS, periodRange, isoInstant } from "../lib/ek-period";
// ⚠ `Spinner` HAM shu yerdan. U chek chiqarish va bekor qilish tugmalarida
// FAQAT amal davomida chiziladi — shuning uchun import unutilgani sahifa
// ochilganda bilinmasdi, tugma bosilgan zahoti esa render'da
// `ReferenceError` bo'lib butun ilovani bo'sh oynaga aylantirardi.
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { printReceipt } from "../lib/ek-hardware";
import SaleDetailModal from "../components/SaleDetailModal";
import SaleCorrectionModal from "../components/SaleCorrectionModal";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import Select from "../components/ek/Select";
import { topRole } from "../lib/ek-roles";
import { useScanner } from "../hooks/useScanner";
import { useOnline } from "../hooks/useOnline";
import { parseSaleCode } from "../lib/ek-barcode";
import { rankItems } from "../lib/ek-search";
import { refundFor, refundSuggestion } from "../lib/ek-refund";
import { saleRow, salesTotals } from "../lib/ek-sales-row";
import { downloadXlsx } from "../lib/ek-xlsx";

/* ── Chekni qayta chiqarish ────────────────────────────────────────────────
   Kassa ekranidagi Ctrl+P faqat OXIRGI chekni chiqaradi. Amalda esa mijoz
   yarim soatdan keyin qaytib kelib chek so'raydi — o'shanda uni tarixdan
   topib chiqarish kerak bo'ladi.

   Tarixdagi yozuv Kassa savatidan BOSHQA shaklda keladi
   (`productName`/`quantity`/`price`), shuning uchun chek quruvchi kutgan
   shaklga o'giriladi. */
function saleToReceipt(sale) {
  return {
    saleId: `A-${sale.id}`,
    // Tarixdan qayta chiqarilgan chekda ham barkod bo'lsin.
    serverSaleId: sale.id,
    cart: (sale.items || []).map((i) => ({
      name:      i.productName,
      qty:       i.quantity,
      salePrice: i.price,
      /* ⚠ QATOR CHEGIRMASI SERVERDAN OLINADI (V48). Server chek
         chegirmasini ham, kassir tushirgan narxni ham qatorga yozib
         qo'ygan — qayta chop etilgan chek dastlabkisi bilan bir xil
         chiqishi uchun aynan shu raqam kerak. */
      discount:  Number(i.discountAmount) || 0,
    })),
    total:    sale.totalAmount,
    // Chegirmalar qatorlarda turadi, shuning uchun «Jami» ni hisoblab
    // chiqarmasdan serverdagi qiymatni olamiz.
    subtotal: sale.subtotalAmount,
    payType:  sale.paymentType,
    /* Qismlar (V66): qayta chop etilgan chekda ham «Naqd · Mijoz jamg'armasi». */
    payments: sale.payments || [],
    customer: sale.customerName ? { fullName: sale.customerName } : null,
    shopName: localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode") || "",
    cashier:  sale.cashierName || "",
    /* ⚠ CHEK TURI (V85). Qayta chop etishda u SERVERDAN olinishi shart:
       bo'nak yoki bo'lib to'lash chekida fiskal belgi CHIQMASLIGI
       kerak va standart `"SALE"` bu qoidani jimgina buzardi. */
    saleType: sale.type || "SALE",
  };
}

/* Sotuv holati — lug'atdan. `tone` Badge rang nomiga o'giriladi. */
const TONE_COLOR = { success: "green", danger: "red", warning: "yellow", info: "blue", neutral: "gray" };
const statusBadge = (v) => {
  const e = saleStatus(v);
  return { label: e.label, color: TONE_COLOR[e.tone] || "blue" };
};
/* To'lov turi yorlig'i — CLICK va PAYME ham qamrab olinadi.
   Ilgari bu yerda uchta qiymatli mahalliy jadval bor edi va Click/Payme
   sotuvlarida xom `CLICK` matni chiqardi. */
function PayLabel({ type }) {
  const p = paymentEntry(type);
  return <><i className={`fa-solid ${p.icon || "fa-wallet"}`} style={{ color: p.color }} aria-hidden="true" /> {p.label}</>;
}

export default function SalesPage({ toast }) {
  const confirm                   = useConfirm();
  // ⚠ `guard` — QAYTARISHDA server 428 qaytarsa bajik modalini ochadi va
  // tasdiqdan keyin so'rovni o'zi qayta yuboradi.
  const { guard }                 = useBadge();
  const online                    = useOnline();
  const { user }                  = useAuth();
  /* ⚠ ENG YUQORI rol bo'yicha, "CASHIER bormi" bo'yicha EMAS.
     Xodimda bir nechta rol bo'lishi mumkin va sessiyada ular vergul bilan
     saqlanadi. Ilgari bu yerda `roleSet(...).has("CASHIER")` turardi va
     EGASI ham "kassir" deb hisoblanardi: eski hisoblarda `getRoles()`
     qo'shimchali edi (OWNER → hamma rol, shu jumladan CASHIER), shuning
     uchun egaga faqat BUGUNGI sotuvlar ko'rinardi va tarix "yo'q" bo'lib
     qolardi. Endi:
       OWNER + CASHIER      → OWNER      → hamma sotuv
       SHOP_ADMIN + CASHIER → SHOP_ADMIN → hamma sotuv
       faqat CASHIER        → CASHIER    → bugungi (ataylab shunday) */
  const isCashier                 = topRole(user?.role) === "CASHIER";
  /* ══ TUZATUVCHI CHEK (V86) ═══════════════════════════════════════════
     ⚠ FAQAT FISKAL REJIMDA VA FAQAT RAHBARGA. Ikkala shart ham kerak:

       · fiskal rejimsiz do'kon soliqqa hech narsa yubormagan, ya'ni
         tuzatadigan narsaning O'ZI yo'q — server ham rad etadi, tugma
         esa umuman chizilmaydi. Bugungi do'konlar uchun bu qator
         mavjud emasdek;
       · kassirga ko'rinmaydi: bu tizimdagi yagona joy, bir kishi
         hisobotdagi tushumni o'zi yozgan raqamga o'zgartira oladi. */
  const [fiscalOn, setFiscalOn]   = useState(false);
  const [corr, setCorr]           = useState(null);
  const [printing, setPrinting]   = useState(null);
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]       = useState("");
  // Holat bo'yicha saralash. Standart — BARCHASI: tarix to'liq ko'rinishi
  // kerak, filtrni foydalanuvchi o'zi tanlaydi.
  const [status, setStatus]       = useState("ALL");
  const [detail, setDetail]       = useState(null);
  /* Qaytarish oynasi: { sale, lines: { [saleItemId]: miqdor }, reason } */
  const [ret, setRet] = useState(null);
  const [returning, setReturning] = useState(false);
  const [branchId, setBranchId]   = useState(null);

  /* ══ DAVR (V100) ═══════════════════════════════════════════════════
     Ilgari sahifa do'konning BUTUN tarixini yuklardi va javob hech
     qachon kichraymasdi — u faqat o'sardi. Kuniga 200 chek qiladigan
     do'kon bir yilda 73 000 qatorga yetadi va monoblokdagi brauzer
     bunday javobni ochib ulgurmasdi.

     ⚠ DAVR KO'RINIB TURADI. Serverda jimgina oyna qo'yish oson
     bo'lardi-yu, do'kon egasi «sotuvlarim yo'qolibdi» deb o'ylardi.
     Endi u qaysi davrni ko'rayotganini biladi va o'zi kengaytira
     oladi.

     ⚠ Standart — JORIY OY. «Bugun» juda tor (kechagi chekni qidirish
     ko'p uchraydi), «yil» esa yana o'sha muammoni qaytarardi. */
  const [period, setPeriod] = useState("month");
  const range = useMemo(() => periodRange(period, new Date()), [period]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saleApi.getAll(branchId, isoInstant(range.from), isoInstant(range.to));
      // Teskari tartib: yangi sotuvlar yuqorida
      const sorted = (asArray(res.data)).sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
      });
      setSales(sorted);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, range.from, range.to]);

  useEffect(() => { loadSales(); }, [loadSales]);

  /* Do'kon fiskal rejimda ishlayaptimi (V86).

     ⚠ XATO JIMGINA YUTILADI va bu ataylab: bu so'rov sotuvlar
     tarixining ishlashi uchun KERAK EMAS. U yiqilsa tugma
     chizilmaydi — ya'ni sahifa bugungi holatiga qaytadi, xato
     xabari bilan kassirni bezovta qilmaydi. */
  useEffect(() => {
    if (isCashier) return;
    let alive = true;
    shopApi.getProfile()
      .then((r) => { if (alive) setFiscalOn(Boolean(r?.data?.fiscalEnabled)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isCashier]);

  // CASHIER uchun faqat bugungi sotuvlar
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  /**
   * Tarixdagi sotuvning chekini qayta chiqaradi.
   *
   * ⚠ BEKOR QILINGAN sotuv uchun chek CHIQARILMAYDI. Chek — xarid dalili;
   * bekor qilingan sotuvga haqiqiy ko'rinishdagi chek berish mijoz qo'lida
   * yaroqli hujjat qoldirardi.
   */
  const handleReprint = async (sale) => {
    if (sale.status === "CANCELLED") return;
    setPrinting(sale.id);
    try {
      await printReceipt(saleToReceipt(sale));
      toast.success(t("kassa.reprint"));
    } catch (err) {
      toast.error(`${t("hw.printFailed")}: ${err.message}`);
    } finally {
      setPrinting(null);
    }
  };

  /* ⚠ OFLAYNDA TAQIQ. Oflayn navbat faqat SOTUVNI saqlaydi; bekor qilish
     va qaytarish esa server holatiga tayanadi (qaysi chek, qaysi qator,
     qancha qoldiq). Ilgari ular oflaynda shunchaki tarmoq xatosi bilan
     yiqilardi va kassir sababini bilmasdi.
     Sabab `useOnline` izohida — bu kafolat emas, tushunarli ogohlantirish. */
  const requireOnline = () => {
    if (online) return true;
    toast.error(t("offline.actionBlocked"));
    return false;
  };

  // Holat filtri qidiruvdan OLDIN qo'llanadi, shunda chiplardagi sonlar
  // qidiruvga bog'liq bo'lmay, "shu do'konda nechta bekor qilingan sotuv
  // bor" degan savolga javob beradi.
  const byPeriod = sales.filter((s) => {
    // CASHIER bo'lsa faqat bugungi
    if (isCashier && s.createdAt) {
      const saleDate = new Date(s.createdAt);
      if (saleDate < todayStart) return false;
    }
    return true;
  });
  const counts = {
    ALL:       byPeriod.length,
    PAID:      byPeriod.filter((s) => s.status === "PAID").length,
    CREDIT:    byPeriod.filter((s) => s.status === "CREDIT").length,
    CANCELLED: byPeriod.filter((s) => s.status === "CANCELLED").length,
  };

  /* ── Chek barkodini skanerlash ────────────────────────────────────
     Kassir mijoz olib kelgan chekni skanerlaydi va kerakli sotuv darhol
     topiladi. Usiz u sana va summa bo'yicha qidirardi — bir kunda 200 ta
     chek bo'lsa bu sekin va xato qilishga ochiq.

     ⚠ Tovar barkodi bu yerda E'TIBORSIZ qoldiriladi: `parseSaleCode`
     faqat `S-` prefiksli kodni tanidi. Aks holda kassir tovarni
     skanerlaganda tushunarsiz "topilmadi" xatosi chiqardi. */
  useScanner((code) => {
    const id = parseSaleCode(code);
    if (id == null) return;
    const sale = sales.find((x) => x.id === id);
    if (!sale) { toast.error(`${t("ret.notFound")}: ${code}`); return; }
    if (sale.type === "RETURN" || sale.status === "CANCELLED") {
      toast.error(t("ret.notReturnable"));
      return;
    }
    setRet({ sale, lines: {}, reason: "" });
  });

  /**
   * Qaytarish.
   *
   * ⚠ Bekor qilishdan BOSHQA amal: bu yerda tovar javonga qaytadi va
   * qoldiq tiklanadi. Shuning uchun alohida tugma va alohida oyna —
   * kassir ikkalasini adashtirmasligi kerak.
   */
  const submitReturn = async () => {
    if (!requireOnline()) return;
    const items = Object.entries(ret.lines)
      .map(([saleItemId, quantity]) => ({ saleItemId: Number(saleItemId), quantity: Number(quantity) }))
      .filter((x) => x.quantity > 0);
    if (!items.length) return;

    /* ⚠ QAYERGA KETADI (V103). Do'kon egasi: «qaytarilgan tovar qayta
       sotuvga chiqarilishi yoki hisobdan chiqarilishi kerak».

       ⚠ `RESALE` da MAYDON UMUMAN YUBORILMAYDI: server bo'sh qiymatni
       ilgarigidek tushunadi va shu bilan oflayn navbatdagi eski
       so'rovlar bilan bir xil yo'ldan yuradi — ikkita xatti-harakat
       o'rniga bitta. */
    for (const it of items) {
      const d = ret.disp?.[it.saleItemId];
      if (d !== "WRITE_OFF") continue;
      it.disposition = "WRITE_OFF";
      it.writeOffReason = ret.woReason?.[it.saleItemId] || null;
    }

    /* ⚠ SUMMA FAQAT KASSIR O'ZI TAKLIFNI BOSGANDA YUBORILADI.

       Bo'sh qoldirilsa server muzlatilgan taqsimotdan hisoblaydi va bu
       ASOSIY yo'l: qaytariladigan pul mijoz to'lagan puldir, uni tizim
       ham, ekran ham o'zgartirmaydi. Kassir «Tavsiyani qo'llash» ni
       bosgandagina bu yerda son paydo bo'ladi — va o'sha farq serverda
       jurnalga tushadi. */
    if (ret.adjust) {
      const cut = Object.entries(ret.adjust);
      for (const it of items) {
        const found = cut.find(([id]) => Number(id) === it.saleItemId);
        if (found && found[1] !== "" && found[1] != null) it.amount = Number(found[1]);
      }
    }

    /* ⚠ SABAB TANLANMAGAN BO'LSA TO'XTATILADI. Server ham rad etadi,
       lekin kassir buni «Qaytarish» ni bosgandan KEYIN emas, OLDIN
       bilishi kerak — mijoz kassa oldida turibdi. */
    const noReason = items.find((it) => it.disposition === "WRITE_OFF" && !it.writeOffReason);
    if (noReason) { toast.error(t("ret.writeOffReasonRequired")); return; }

    setReturning(true);
    try {
      await guard(() => saleApi.returnSale(ret.sale.id, { items, reason: ret.reason }));
      toast.success(t("ret.done"));
      setRet(null);
      loadSales();
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
    } finally {
      setReturning(false);
    }
  };

  /* ══ QAYTARILADIGAN SUMMA (V80) ══════════════════════════════════════

     ⚠ SERVERDAGI QOIDANING NUSXASI. Summa sotuv paytida muzlatilgan
     taqsimotdan chiqadi (`RefundAllocation.java` → `ek-refund.js`) va
     kassir uni tugmani bosishdan OLDIN ko'rishi kerak: mijozga aytilgan
     raqam bilan kassadan chiqadigan pul bir xil bo'lishi shart.

     `retTotal` — muzlatilgan (haqiqiy) summa;
     `retPay`   — kassir to'laydigan summa. Ikkalasi FAQAT kassir
                  tavsiyani bosgan bo'lsa farq qiladi. */
  const retExact = useMemo(() => {
    if (!ret) return {};
    const out = {};
    for (const it of ret.sale.items || []) {
      const left = Number(it.quantity || 0) - Number(it.returnedQuantity || 0);
      const back = Math.min(Number(ret.lines[it.id]) || 0, left);
      if (back <= 0) continue;
      const paid = Number(it.price || 0) * Number(it.quantity || 0)
                 - Number(it.discountAmount || 0);
      out[it.id] = refundFor(paid, it.quantity, it.returnedQuantity, back);
    }
    return out;
  }, [ret]);

  const retTotal = useMemo(
    () => Math.round(Object.values(retExact).reduce((s2, v) => s2 + v, 0) * 100) / 100,
    [retExact],
  );

  /* Kassir tavsiyani bosgan bo'lsa — o'zgartirilgan summa, aks holda
     muzlatilganining o'zi. */
  const retPay = useMemo(() => {
    if (!ret?.adjust) return retTotal;
    let sum = 0;
    for (const [id, exact] of Object.entries(retExact)) {
      /* ⚠ Maydon XOM SATR beradi («3300»), `applyTip` ham shunday
         yozadi — bitta shakl, bitta o'qish joyi. */
      const v = ret.adjust[id];
      sum += v == null || v === "" ? exact : Number(v);
    }
    return Math.round(sum * 100) / 100;
  }, [ret, retExact, retTotal]);

  const retTip = useMemo(() => refundSuggestion(retTotal), [retTotal]);

  /**
   * Tavsiyani qo'llash.
   *
   * ⚠ KESIM ENG KATTA QATORDAN olinadi va yetmasa keyingisiga
   * o'tadi. Hamma qatorga ulushga bo'lib tarqatish jamini yana
   * yaxlit bo'lmagan songa aylantirardi — ya'ni butun tavsifning
   * ma'nosini yo'qotardi. Kassirga esa aynan JAMI kerak: kassadan
   * chiqadigan pul o'sha.
   */
  /**
   * Qatorning summasini QO'LDA yozish.
   *
   * ⚠ BO'SH MAYDON — «TEGILMAGAN». Kalit o'chiriladi va serverga bu
   * qator uchun `amount` UMUMAN yuborilmaydi: server o'zining
   * muzlatilgan suratidan hisoblaydi. Bo'sh maydonni «0 qaytar» deb
   * o'qish mijozni puldan qilardi, muzlatilgan summani maydonga
   * QIYMAT qilib qo'yish esa har qaytarishni «qo'lda o'zgartirilgan»
   * bo'lib jurnalga tushirardi.
   *
   * ⚠ Hamma maydon bo'shatilsa `adjust` butunlay `null` bo'ladi —
   * shundagina tavsiya tugmasi qaytadi va «qo'lda kamaytirildi»
   * belgisi yo'qoladi. Bo'sh obyekt qolsa, ikkalasi ham noto'g'ri
   * holatda qotib qolardi.
   *
   * Yuqori chegara maydonning O'ZIDA (`max`): kassir to'langandan
   * ko'p yoza olmaydi. Server ham tekshiradi, lekin kassir buni
   * tugmani bosishdan OLDIN bilishi kerak.
   */
  const setAmount = (id, raw) => {
    const next = { ...(ret.adjust || {}) };
    if (raw === "" || raw == null) delete next[id];
    else next[id] = raw;
    setRet({ ...ret, adjust: Object.keys(next).length ? next : null });
  };

  const applyTip = () => {
    if (!retTip) return;
    const rows = Object.entries(retExact).sort((a, b) => b[1] - a[1]);
    const adjust = {};
    /* ⚠ KESIM TAVSIYA SUMMASIDAN OLINADI, `retTip.cut` DAN EMAS.

       Taklif YAXLITLANGAN jamidan hisoblanadi (3 333.33 → 3 333 →
       3 300, kesim 33), lekin qatordan AYNAN o'sha 33 ayirilsa
       3 300.33 chiqadi: ekranda «3 300» ko'rinardi (`money` yaxlitlaydi),
       serverga esa 3 300.33 ketardi va kassirdan 33 tiyin talab
       qilinardi — ya'ni butun tavsiyaning ma'nosi yo'qolardi. Bu
       xatoni `scripts/check-ret.mjs` yuborilgan so'rovni o'qib
       ushladi, ekrandan esa u KO'RINMASDI. */
    let left = Math.round((retTotal - retTip.amount) * 100) / 100;
    for (const [id, exact] of rows) {
      if (left <= 0) break;
      const cut = Math.min(left, exact);
      adjust[id] = String(Math.round((exact - cut) * 100) / 100);
      left = Math.round((left - cut) * 100) / 100;
    }
    setRet({ ...ret, adjust });
  };

  /* ⚠ Avval HOLAT, keyin qidiruv: qidiruv natijani mosligiga qarab
     saralaydi va undan keyin filtrlash saralashni buzardi. */
  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═══════════════════════════════════
     Jadvaldagi HAR BIR ustun — filtrda ham, saralashda ham. Do'kon
     egasi kunni «kim nima sotdi, qaysi usulda, qancha?» degan savol
     bilan yopadi va bu savollarning har biri boshqa ustun.

     ⚠ `#` — SON: chek raqamini «> 500» deb kesish tabiiy, matn
     qoidasida esa «71» «500» dan katta chiqardi. */
  const COLS = useMemo(() => [
    { key: "id",    label: "#",                     type: "number", get: (s) => s.id },
    { key: "cash",  label: t("sales.colCashier"),   type: "text",   get: (s) => s.cashierName },
    { key: "cust",  label: t("cust.col"),           type: "text",   get: (s) => s.customerName },
    { key: "sum",   label: t("common.sum"),         type: "number", get: (s) => s.totalAmount },
    /* ⚠ Chegirma va qarz ham FILTRLANADIGAN ustun (V97): egasi
       «chegirmasi 50 000 dan katta cheklar» yoki «qarzi qolganlar»
       deb so'raydi va uni ko'z bilan qidirish minglab chekda
       imkonsiz. */
    { key: "disc",  label: t("sales.colDiscount"),  type: "number", get: (s) => saleRow(s).discount },
    { key: "debt",  label: t("sales.colCredit"),    type: "number", get: (s) => saleRow(s).credit },
    { key: "pay",   label: t("sales.colPayment"),   type: "enum",   get: (s) => s.paymentType,
      options: Object.keys(PAYMENT_TYPE).map((k) => ({ value: k, label: paymentEntry(k).label })) },
    { key: "st",    label: t("common.status"),      type: "enum",   get: (s) => s.status,
      options: Object.keys(SALE_STATUS).map((k) => ({ value: k, label: saleStatus(k).label })) },
    { key: "date",  label: t("common.date"),        type: "date",   get: (s) => s.createdAt },
  ], []);
  const colFlt = useDataFilter(COLS, "sales");

  const byStatus = byPeriod.filter((s) => status === "ALL" || s.status === status);
  /* Chek raqami RAQAMLI maydon sifatida: do'koncha «…347» deb oxirgi
     raqamlarni eslaydi, to'liq raqamni emas — matn qoidasi bunda
     ishlamasdi. */
  const filtered = rankItems(colFlt.apply(byStatus), search, {
    /* ⚠ SHTRIX-KOD ham RAQAM sifatida (V97). Do'kon egasining ish
       oqimi: qaytarib kelingan tovarni skanerlaydi va «bu qaysi
       chekdan chiqqan?» degan savolga javob oladi — ilgari buni
       faqat cheklarni birma-bir ochib topsa bo'lardi. */
    digits: (s) => [String(s.id), ...(s.items || []).map((i) => i.barcode).filter(Boolean)],
    /* ⚠ NOM YETMAYDI: bir do'konda bir xil nomli o'nlab tovar bo'ladi
       («Futbolka»), SKU esa yagona. */
    texts:  (s) => [s.customerName, s.cashierName,
                    ...(s.items || []).flatMap((i) => [i.productName, i.sku])].filter(Boolean),
  });

  /* ⚠ KPI KO'RINGAN RO'YXATDAN hisoblanadi, alohida so'rovdan EMAS.
     Egasi filtrni o'zgartirsa raqamlar ham o'zgarishi kerak — aks
     holda ekranda bir-biriga zid ikkita haqiqat turardi. */
  const kpi = useMemo(() => salesTotals(filtered), [filtered]);

  /**
   * KO'RINGAN RO'YXATNI Excel'ga chiqaradi.
   *
   * ⚠ Aynan `filtered` — filtr va qidiruvdan O'TGANI. Butun ro'yxatni
   * chiqarish osonroq bo'lardi, lekin egasi ekranda ko'rgan narsasini
   * kutadi: «shu uchta kassirning shu haftadagi cheklarini ber»
   * degani, «hamma narsani» degani emas.
   *
   * ⚠ SUMMALAR SON bo'lib ketadi, matn bo'lib emas: Excel'da ular
   * ustidan yig'indi olinadi. Matn bo'lsa, ustunni qo'lda qayta
   * terish kerak bo'lardi.
   */
  const exportXlsx = () => {
    const head = (...cols) => cols.map((v) => ({ v, bold: true }));
    const rows = filtered.map((s) => {
      const r = saleRow(s);
      return [
        s.id,
        s.createdAt ? new Date(s.createdAt).toLocaleString("uz-UZ") : "",
        s.cashierName || "",
        s.customerName || "",
        Number(s.totalAmount) || 0,
        r.discount,
        r.paid,
        r.credit,
        paymentEntry(s.paymentType).label,
        saleStatus(s.status).label,
        r.returned === "full" ? t("sales.retFull")
          : r.returned === "partial" ? t("sales.retPartial") : "",
        /* Chekdagi tovarlar — bitta katakda. Alohida varaq qilish
           mumkin edi, lekin egasi odatda «shu chekda nima bor edi»
           deb qaraydi, tovar bo'yicha tahlil esa Hisobotlarda. */
        (s.items || []).map((i) => `${i.productName} × ${i.quantity}`).join("; "),
      ];
    });
    downloadXlsx(`sotuvlar-${new Date().toISOString().slice(0, 10)}`, [{
      name: t("sales.title"),
      rows: [
        head("#", t("common.date"), t("sales.colCashier"), t("cust.col"),
             t("common.sum"), t("sales.colDiscount"), t("sales.colPaid"),
             t("sales.colCredit"), t("sales.colPayment"), t("common.status"),
             t("sales.colReturned"), t("products.col")),
        ...rows,
      ],
    }]);
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("sales.title")}</h2>
        </div>
        <div className="sales-head">
          {/* ⚠ «custom» YO'Q: u ikkita sana maydonini talab qiladi va
              bu yerda joy yo'q. Tayyor davrlar kassirning kundalik
              savoliga («kechagi chek qani?») yetarli; kengroq tahlil
              Hisobot bo'limida. */}
          <div className="rpt-bar__periods" role="tablist" aria-label={t("rpt2.period")}>
            {PERIODS.filter((x) => x !== "custom").map((x) => (
              <button key={x} type="button" role="tab" aria-selected={period === x}
                      className={`rpt-seg${period === x ? " is-on" : ""}`}
                      onClick={() => setPeriod(x)}>
                {t(`rpt2.p.${x}`)}
              </button>
            ))}
          </div>
          <BranchSelector selectedId={branchId} onSelect={setBranchId} />
        </div>
      </div>

      {/* ══ KPI — KO'RINGAN RO'YXAT BO'YICHA (V97) ═════════════════════
          Do'kon egasi ro'yxat ustida jamlamani so'radi. Raqamlar
          alohida so'rovdan EMAS, aynan ekrandagi cheklardan
          hisoblanadi: filtr o'zgarsa jamlama ham o'zgaradi va ekranda
          bir-biriga zid ikkita haqiqat qolmaydi.

          ⚠ QAYTARISH MUSBAT ko'rsatiladi, lekin sofdan AYIRILGAN
          (`salesTotals`). Manfiy son bilan ko'rsatish «−1 200 000»
          ni ustunga qo'yar va o'qishni qiyinlashtirardi.

          ⚠ Bo'sh ro'yxatda panel CHIZILMAYDI: to'rtta nol egasiga
          hech narsa aytmaydi va faqat joy egallaydi. */}
      {filtered.length > 0 && (
        <div className="sales-kpi">
          <div className="sales-kpi__item">
            <span className="sales-kpi__label">{t("sales.kpiSales")}</span>
            <b className="ek-num">{money(kpi.sales)}</b>
            <small className="text-muted">{t("sales.kpiCount", { n: kpi.count })}</small>
          </div>
          <div className="sales-kpi__item sales-kpi__item--ret">
            <span className="sales-kpi__label">{t("sales.kpiReturns")}</span>
            <b className="ek-num">{money(kpi.returns)}</b>
            <small className="text-muted">{t("sales.kpiCount", { n: kpi.returnCount })}</small>
          </div>
          <div className="sales-kpi__item sales-kpi__item--net">
            <span className="sales-kpi__label">{t("sales.kpiNet")}</span>
            <b className="ek-num">{money(kpi.net)}</b>
            <small className="text-muted">{t("sales.kpiNetHint")}</small>
          </div>
          <div className="sales-kpi__item sales-kpi__item--debt">
            <span className="sales-kpi__label">{t("sales.kpiCredit")}</span>
            <b className="ek-num">{money(kpi.credit)}</b>
            <small className="text-muted">{t("sales.kpiPaid")}: {money(kpi.paid)}</small>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t("sales.search")} style={{ width: 280 }} />
            {/* ⚠ Faqat KO'RINGAN cheklar bor bo'lganda: bo'sh faylni
                yuklab olish foydasiz va tugma «ishlamadi» degan
                taassurot berardi. */}
            {filtered.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={exportXlsx}
                      title={t("sales.exportHint", { n: filtered.length })}>
                <i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel
              </button>
            )}
            {isCashier && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", background: "var(--blue-l)", padding: "5px 12px", borderRadius: 20 }}>
                <i className="fa-solid fa-calendar-day" style={{ marginRight: 5 }} />
                Bugungi sotuvlar ({counts.ALL})
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <DataFilter cols={COLS} flt={colFlt} />
            <button className="btn btn-outline btn-sm" onClick={loadSales}>
              <i className="fa-solid fa-rotate-right" /> {t("common.refresh")}
            </button>
          </div>
        </div>

        {/* Holat filtri. Bekor qilingan sotuvlar endi ro'yxatda turadi —
            ularni ajratib ko'rish uchun shu qator kerak. Chipdagi son
            qidiruvga bog'liq emas: u davr bo'yicha JAMI holatni ko'rsatadi.

            ⚠ `paddingTop: 0` YARAMAYDI: ustidagi sarlavhaning pastki chizig'i
            aynan shu yerda tugaydi va chiplar unga yopishib qolardi. */}
        <div className="card-header" style={{ paddingTop: 11 }}>
          <div className="cat-tabs" role="tablist" aria-label={t("common.status")}>
            {[
              { key: "ALL",       label: t("common.all") },
              { key: "PAID",      label: saleStatus("PAID").label },
              /* ⚠ Nasiya ALOHIDA filtr (V46): do'kon egasi kunni «kimga
                 qarz berdik?» degan savol bilan yopadi va bu ro'yxatni
                 to'langan cheklar orasidan izlashi kerak emas. */
              { key: "CREDIT",    label: saleStatus("CREDIT").label },
              { key: "CANCELLED", label: saleStatus("CANCELLED").label },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={status === f.key}
                className={`cat-tab ${status === f.key ? "active" : ""}`}
                onClick={() => setStatus(f.key)}
              >
                {f.label} <span className="mono">({counts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          {busy ? <SkeletonTable rows={8} cols={["narrow", "text", "text", "num", "num", "num", "text", "text", "text"]} /> : (
            <table>
              <thead>
                <tr>
                  <SortTh flt={colFlt} col="id">#</SortTh>
                  <SortTh flt={colFlt} col="cash">{t("sales.colCashier")}</SortTh>
                  <SortTh flt={colFlt} col="cust">{t("cust.col")}</SortTh>
                  <SortTh flt={colFlt} col="sum">{t("common.sum")}</SortTh>
                  <SortTh flt={colFlt} col="disc">{t("sales.colDiscount")}</SortTh>
                  <SortTh flt={colFlt} col="debt">{t("sales.colPaidCredit")}</SortTh>
                  <SortTh flt={colFlt} col="pay">{t("sales.colPayment")}</SortTh>
                  <SortTh flt={colFlt} col="st">{t("common.status")}</SortTh>
                  <SortTh flt={colFlt} col="date">{t("common.date")}</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((sale) => {
                  const st = statusBadge(sale.status);
                  const row = saleRow(sale);
                  return (
                    <tr key={sale.id}>
                      <td className="mono fw-800 text-muted">#{sale.id}</td>
                      <td className="fw-700">{sale.cashierName || "—"}</td>
                      <td>{sale.customerName || <span className="text-muted">—</span>}</td>
                      <td><span className="mono fw-700 text-blue">{money(sale.totalAmount)}</span></td>
                      {/* ⚠ NOL — «—», nol EMAS. Chegirmasiz chekda «0»
                          ko'z uchun shovqin: ustun raqamlar bilan
                          to'lib ketar va haqiqiy chegirma ular orasida
                          yo'qolardi. */}
                      <td className="mono" style={{ fontSize: 13 }}>
                        {row.discount > 0
                          ? <span style={{ color: "var(--fg-warning)" }}>{money(row.discount)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      {/* ⚠ TO'LANGAN va QARZGA — BITTA katakda, ikki
                          qator. Alohida ustun qilinsa jadval sakkizdan
                          o'nga chiqar va telefon ekranida o'qib
                          bo'lmasdi. Qarzi bo'lmagan chekda ikkinchi
                          qator umuman chizilmaydi. */}
                      <td className="mono" style={{ fontSize: 13, lineHeight: 1.3 }}>
                        <div className="fw-700">{money(row.paid)}</div>
                        {row.credit > 0 && (
                          <div style={{ color: "var(--fg-danger)", fontSize: 12 }}>
                            {t("sales.creditShort")}: {money(row.credit)}
                          </div>
                        )}
                      </td>
                      {/* Aralash chekda qismlar sichqoncha ostida (V66). */}
                      <td><span style={{ fontSize: 13 }}
                                title={(sale.payments || []).length > 1
                                  ? sale.payments.map((p) => `${paymentEntry(p.type).label}: ${money(p.amount)}`).join(" · ")
                                  : undefined}><PayLabel type={sale.paymentType} /></span></td>
                      {/* ⚠ QAYTARILGANLIK — STATUS EMAS, alohida belgi.
                          `SaleStatus` da `RETURNED` yo'q va bo'lmasligi
                          ham kerak: qaytarish ALOHIDA chek
                          (`CustomerReceiptService` izohi), asl chek esa
                          «bu savdo qanday bo'lgan» ni saqlaydi. Shu
                          sababdan belgi status yonida turadi, uning
                          o'rnida emas. */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <Badge color={st.color}>{st.label}</Badge>
                          {row.returned !== "none" && (
                            <Badge color={row.returned === "full" ? "danger" : "warning"}>
                              {row.returned === "full" ? t("sales.retFull") : t("sales.retPartial")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleString("uz-UZ") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn-icon" title={t("sales.details")} onClick={() => setDetail(sale)}>
                            <i className="fa-solid fa-eye" />
                          </button>
                          {/* Chek — bekor qilinmagan sotuvlar uchun. Mijoz
                              keyinroq qaytib kelib chek so'raganda kerak. */}
                          {sale.status !== "CANCELLED" && (
                            <button
                              className="btn-icon"
                              title={t("kassa.reprint")}
                              onClick={() => handleReprint(sale)}
                              disabled={printing === sale.id}
                            >
                              {printing === sale.id ? <Spinner small /> : <i className="fa-solid fa-print" />}
                            </button>
                          )}
                          {/* Qaytarish — faqat SOTUV chekida (qaytarish
                              chekini qaytarib bo'lmaydi). */}
                          {sale.status !== "CANCELLED" && sale.type !== "RETURN" && (
                            <button
                              className="btn-icon"
                              title={t("ret.title")}
                              onClick={() => setRet({ sale, lines: {}, reason: "" })}
                            >
                              <i className="fa-solid fa-rotate-left" />
                            </button>
                          )}
                          {/* ⚠ TUZATUVCHI CHEK — QAYTARISHDAN BOSHQA AMAL
                              va tugmasi ham boshqa (qalam, aylanma
                              strelka emas). Ikkalasi bir xil ko'rinsa,
                              kassir tovar qaytmagan holatda ham
                              qaytarishni bosardi va qoldiq sababsiz
                              tiklanardi.

                              Faqat FISKAL hujjatda: bo'nak va bo'lib
                              to'lash cheklari soliqqa umuman ketmaydi,
                              ya'ni ularda tuzatadigan narsa yo'q. */}
                          {fiscalOn && sale.status !== "CANCELLED"
                            && sale.type !== "RETURN" && sale.type !== "CORRECTION" && (
                            <button
                              className="btn-icon"
                              title={t("corr.title")}
                              onClick={() => setCorr(sale)}
                            >
                              <i className="fa-solid fa-file-pen" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={10}><Empty icon="fa-receipt" text={t("sales.notFound")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {/* ⚠ Umumiy komponent (V47): AYNAN shu oyna qarz jurnalidan ham
          ochiladi. Ikki nusxa bo'lsa, ular vaqt o'tib bir-biridan
          ajralib ketardi. */}
      <SaleDetailModal sale={detail} onClose={() => setDetail(null)}
                       onReprint={handleReprint} printing={printing === detail?.id} />

      {/* ── Tuzatuvchi chek (V86) ── */}
      {corr && (
        <SaleCorrectionModal
          sale={corr}
          toast={toast}
          onClose={() => setCorr(null)}
          onDone={() => { setCorr(null); toast.success(t("corr.done")); loadSales(); }}
        />
      )}

      {/* ── Qaytarish oynasi ─────────────────────────────────────────────
          Kassir QAYSI tovarni va NECHTASINI qaytarayotganini tanlaydi.
          Har qatorda qolgan miqdor ko'rsatiladi — ilgari qaytarilgani
          hisobga olinadi va undan oshirib bo'lmaydi. */}
      {ret && (
        <Modal
          title={`${t("ret.title")} — #${ret.sale.id}`}
          onClose={() => setRet(null)}
          maxWidth={560}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setRet(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={submitReturn}
                disabled={returning || !ret.reason.trim()
                          || !Object.values(ret.lines).some((v) => Number(v) > 0)}
              >
                {returning ? <Spinner small /> : <i className="fa-solid fa-rotate-left" />}
                {t("ret.submit")}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>{t("ret.pick")}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("products.col")}</th>
                  <th>{t("ret.left")}</th>
                  <th>{t("ret.qty")}</th>
                  {/* ⚠ SUMMA USTUNI (V80) — kassir mijozga aytadigan
                      raqam. Ilgari u faqat qaytarish BAJARILGANDAN
                      keyin ma'lum bo'lardi: chegirma bilan sotilgan
                      chekda kassir e'lon narxini aytib qo'yib, keyin
                      kamroq pul berardi. */}
                  {/* ⚠ QAYERGA KETADI (V103) — do'kon egasining talabi.
                      Ilgari HAR qaytarish qoldiqni tiklardi va tizim
                      uchun ochilgan qadoq ham sotiladigan tovar edi:
                      qoldiq bor-u, javonda yo'q. */}
                  <th>{t("ret.disposition")}</th>
                  <th className="ta-right">{t("ret.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {(ret.sale.items || []).map((it) => {
                  const left = Number(it.quantity || 0) - Number(it.returnedQuantity || 0);
                  const back = Math.min(Number(ret.lines[it.id]) || 0, left);
                  const paid = Number(it.price || 0) * Number(it.quantity || 0)
                             - Number(it.discountAmount || 0);
                  /* ⚠ SERVERDAGI QOIDANING NUSXASI (`ek-refund.js` →
                     `RefundAllocation.java`). Ikkalasi ajralib ketsa,
                     kassir mijozga bir summani aytib, kassa
                     boshqasini berardi. */
                  const sum = refundFor(paid, it.quantity, it.returnedQuantity, back);
                  /* Kassir yozgan summa — yozmagan bo'lsa `null`. */
                  const typed = ret.adjust?.[it.id] ?? null;
                  return (
                    <tr key={it.id}>
                      <td className="fw-700">
                        {it.productName}
                        {/* Bir donaning summasi — «nechtasini
                            qaytaray?» degan savolga javob. */}
                        {it.refundUnitAmount > 0 && (
                          <div className="text-muted ek-num" style={{ fontSize: 11 }}>
                            {money(it.refundUnitAmount)} / {t("ret.perUnit")}
                          </div>
                        )}
                      </td>
                      <td><Badge color={left > 0 ? "blue" : "gray"}>{left}</Badge></td>
                      <td style={{ width: 150 }}>
                        <Field
                          kind="qty" unit={it.unit} max={left}
                          className="form-input ek-num"
                          disabled={left <= 0}
                          value={ret.lines[it.id] ?? ""}
                          onChange={(e) => setRet({ ...ret, lines: { ...ret.lines, [it.id]: e.target.value },
                                                    adjust: null })}
                        />
                      </td>
                      {/* ══ SUMMANI QO'LDA O'ZGARTIRISH (V80) ═══════
                          ⚠ MAYDON BO'SH TURADI, ichida esa muzlatilgan
                          summa TURTKI (placeholder) bo'lib ko'rinadi.
                          Bu ataylab: bo'sh maydon «tegilmagan» degani
                          va serverga `amount` UMUMAN yuborilmaydi —
                          server o'z suratidan hisoblaydi. Maydonga
                          muzlatilgan summani QIYMAT qilib qo'ysak,
                          har qaytarish «qo'lda o'zgartirilgan» bo'lib
                          jurnalga tushardi va 3 333.33 ni 3 333 deb
                          ko'rsatgani uchun 33 tiyin JIMGINA yo'qolardi.

                          ⚠ Faqat PASAYTIRISH. Oshirish — tovarni
                          qaytarib, to'langandan ko'p pul olish, ya'ni
                          kassadan pul chiqarishning eng oson yo'li.
                          Server ham rad etadi, lekin kassir buni
                          tugmani bosishdan OLDIN bilishi kerak. */}
                      {/* ⚠ FAQAT MIQDOR KIRITILGANDA ma'noli: qaytarilmayotgan
                          qatorda «qayerga?» degan savol yo'q va tanlov
                          kassirni bo'sh qarorga majburlardi. */}
                      <td style={{ width: 190 }}>
                        {back > 0 ? (
                          <>
                            <Select
                              value={ret.disp?.[it.id] || "RESALE"}
                              onChange={(v) => setRet({
                                ...ret,
                                disp: { ...(ret.disp || {}), [it.id]: v },
                                /* Javonga qaytarilsa chiqit sababi
                                   ma'nosini yo'qotadi — u bilan birga
                                   tozalanadi, aks holda keyingi
                                   almashtirishda eski sabab qayta
                                   paydo bo'lardi. */
                                woReason: v === "WRITE_OFF"
                                  ? (ret.woReason || {})
                                  : { ...(ret.woReason || {}), [it.id]: undefined },
                              })}
                              options={dispositionOptions()}
                            />
                            {ret.disp?.[it.id] === "WRITE_OFF" && (
                              /* ⚠ TURKUM MAJBURIY (server ham talab
                                 qiladi): usiz «shu oy qaytarishdan
                                 qancha va NEGA yo'qotdik?» degan savol
                                 javobsiz qolardi. */
                              <div style={{ marginTop: 6 }}>
                                <Select
                                  value={ret.woReason?.[it.id] || ""}
                                  placeholder={t("ret.writeOffReason")}
                                  onChange={(v) => setRet({
                                    ...ret,
                                    woReason: { ...(ret.woReason || {}), [it.id]: v },
                                  })}
                                  options={writeOffOptions({ exclude: RETURN_WRITE_OFF_EXCLUDE })}
                                />
                              </div>
                            )}
                          </>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td style={{ width: 140 }}>
                        {sum > 0 ? (
                          <Field
                            kind="money" max={sum}
                            className="form-input ek-num ret-amt"
                            placeholder={fmtMoney(sum)}
                            title={`${t("ret.amountMax")}: ${money(sum)}`}
                            value={typed ?? ""}
                            onChange={(e) => setAmount(it.id, e.target.value)}
                          />
                        ) : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ══ QAYTARILADIGAN JAMI VA TAVSIYA (V80) ═══════════════════

              ⚠ TIZIM SUMMANI O'ZI O'ZGARTIRMAYDI — bu qat'iy qoida.
              Qaytariladigan pul mijoz TO'LAGAN puldir; uni jimgina
              yaxlitlash mijozning chekidagi raqamdan chetga chiqish
              bo'lardi. Shuning uchun bu yerdan faqat TAVSIYA chiqadi
              va u alohida tugma bilan qo'llanadi.

              ⚠ Tavsiya ikki tomondan bo'g'ilgan: 1 000 so'mdan va
              summaning 2% idan oshmaydi (`ek-refund.js`). 14 833 ni
              14 000 ga tushirish ham «yaxlit», lekin bu mijozning
              833 so'mi. */}
          {retTotal > 0 && (
            <div className="ret-sum">
              <div className="ret-sum__row">
                <span>{t("ret.total")}</span>
                <b className="ek-num">{money(retPay)}</b>
              </div>
              {retTip && !ret.adjust && (
                <button type="button" className="ret-sum__tip" onClick={applyTip}>
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                  <span>
                    {t("ret.suggest")}: <b className="ek-num">{money(retTip.amount)}</b>
                    {" "}<span className="ret-sum__cut ek-num">−{money(retTip.cut)}</span>
                  </span>
                  <span className="ret-sum__apply">{t("ret.applySuggest")}</span>
                </button>
              )}
              {ret.adjust && (
                <button type="button" className="ret-sum__tip is-on"
                        onClick={() => setRet({ ...ret, adjust: null })}>
                  <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                  <span>{t("ret.adjusted")}: <b className="ek-num">−{money(retTotal - retPay)}</b></span>
                  <span className="ret-sum__apply">{t("common.cancel")}</span>
                </button>
              )}
            </div>
          )}

          <label className="form-label" style={{ marginTop: 12 }}>{t("ret.reason")}</label>
          <Field
            className="form-input"
            maxLength={500}
            value={ret.reason}
            onChange={(e) => setRet({ ...ret, reason: e.target.value })}
          />
        </Modal>
      )}
    </div>
  );
}
