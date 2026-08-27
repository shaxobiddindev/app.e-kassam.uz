import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, customerApi, saleApi, securityApi, shopApi, mediaApi, fiscalApi, loyaltyApi } from "../api";
import { useBadge } from "../context/BadgeProvider";
import { useConfirm } from "../context/ConfirmProvider";
import { money, quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import ProductTile from "../components/ProductTile";
import QuantityModal from "../components/QuantityModal";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, ClearButton } from "../components/ui";
import { useKeyboard } from "../context/KeyboardProvider";
import { clear as clearField } from "../lib/ek-keys";
import { isTouch } from "../lib/ek-touch";
import { FinishOverlay, SkeletonTiles, Spinner } from "../components/ek/Loading";
import OfflineBar from "../components/OfflineBar";
import ShiftBar from "../components/ShiftBar";
import * as queue from "../lib/ek-offline";
import * as cartStore from "../lib/ek-cart-store";
import { PAYMENT_TYPE, paymentLabel } from "../lib/ek-labels";
import { useLoading } from "../lib/use-loading";
import Select from "../components/ek/Select";
import { printReceipt, openDrawer } from "../lib/ek-hardware";
import { useScanner } from "../hooks/useScanner";
import { isDesktop } from "../lib/ek-desktop";
import { NumField } from "../components/ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   Kassir paneli — 06-APP-KASSIR.md

   Asosiy stsenariy 3 ta harakat:  skaner → to'lov turi → yakunlash (F9).
   Sichqoncha ixtiyoriy; hamma narsa klaviatura bilan ishlaydi.

   Klaviatura yorliqlari (hujjatdagi jadval; F2 ikki joyda ko'rsatilgan edi —
   bu yerda F1/F2/F3 to'lov turlari uchun, yangi sotuv esa Esc bilan savatni
   tozalash orqali boshlanadi):
     F1 / F2 / F3   Naqd / Karta / Aralash
     F9             To'lovni qabul qilish
     Esc            Savatni tozalash (tasdiq so'raydi) / modalni yopish
     /              Tovar qidiruvi
     Ctrl+B         Barkod maydoniga qaytish
     Ctrl+P         Oxirgi chekni qayta chop etish
   ══════════════════════════════════════════════════════════════════════════ */

/* To'lov usullari — nom, ikonka va rang YAGONA lug'atdan (ek-labels.js).
   Ilgari ular shu faylda qo'lda yozilgan edi va sotuvlar tarixida Click/Payme
   tarjimasiz chiqardi. Klaviatura yorliqlari faqat shu ekranga tegishli,
   shuning uchun ular bu yerda qo'shiladi. */
const PAY_KBD = { CASH: "F1", CARD: "F2", MIXED: "F3" };
const payItem = (key) => {
  const p = PAYMENT_TYPE[key];
  return { key, label: p.label, icon: p.icon, color: p.color, kbd: PAY_KBD[key] };
};
/* ⚠ Nasiya ro'yxatning OXIRIDA: u eng kam ishlatiladigan va eng
   e'tibor talab qiladigan tur. Boshida tursa kassir tasodifan bosib,
   pulni olmasdan tovar berib yuborardi. */
const PAY_METHODS  = ["CASH", "CARD", "CLICK", "PAYME", "MIXED", "CREDIT"].map(payItem);
const MIXED_SECOND = ["CARD", "CLICK", "PAYME"].map(payItem);

const REFOCUS_MS = 3000;   // fokus yo'qolsa shuncha vaqtdan keyin qaytadi
const UNDO_MS    = 5000;   // o'chirishni bekor qilish oynasi

/* ⚠ CHEK CHIQARISH BU YERDAN OLIB TASHLANDI → `lib/ek-hardware.js`.
   Ikki sabab:

   1. Bu yerdagi shablon BUZUQ edi. U oddiy satr bo'la turib ichida
      `{t("kassa.receiptTotal")}` yozilgan edi — JSX emas, ya'ni tarjima
      hech qachon chaqirilmagan va MIJOZNING CHEKIGA aynan shu matn
      bosilib chiqqan. Prod'da ishlab turgan xato edi.

   2. Desktop'da chek `window.print()` bilan emas, printerga TO'G'RIDAN-
      TO'G'RI ESC/POS baytlari sifatida yuboriladi: dialogsiz, qog'ozni
      kesib, naqd to'lovda pul yashigini ochib. Ikkala yo'l bitta joyda
      turishi kerak, aks holda ular ajralib ketardi. */

/* Jonli qoldiq qadami — ombor sahifasi bilan bir xil. Kassir bir ilovada
   ikki xil tezlikka ko'nikmasligi kerak. */
const LIVE_REFRESH_MS = 15_000;

/** Qoldig'i o'zgargan katakcha shuncha vaqt belgilanib turadi. */
const FLASH_MS = 1600;

/* Savat ustunining eng kichik va eng katta kengligi.
   ⚠ Pastki chegara ATAYLAB 300: undan tor bo'lsa savat qatoridagi
   «− 2 +» tugmalari nom ustiga chiqib ketardi. Yuqori chegara esa
   katakchalar uchun joy qoldirish uchun — ustunni butun ekranga
   cho'zib qo'yish mahsulot tanlashni imkonsiz qilardi. */
const MIN_RIGHT_W = 300;
const MAX_RIGHT_W = 620;
const clampRight = (w, layoutW) =>
  Math.round(Math.max(MIN_RIGHT_W, Math.min(w, MAX_RIGHT_W, layoutW * 0.6)));

/** Oflayn chek raqami — server raqami bilan chalkashmasligi uchun OFF- prefiksli. */
function nextOfflineNo() {
  const n = (Number(localStorage.getItem("ek_offline_seq")) || 0) + 1;
  localStorage.setItem("ek_offline_seq", String(n));
  return `OFF-${String(n).padStart(4, "0")}`;
}

// ─── KassaPage ───────────────────────────────────────────────
export default function KassaPage({ toast, refreshLowStock }) {
  const { guard } = useBadge();
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);

  /* ══ BIR NECHTA SAVAT ═══════════════════════════════════════════════
     ⚠ MUAMMO. Kassada bitta savat bor edi. Mijoz «yodimdan chiqibdi»
     deb tuz olib kelgani ketsa, orqasidagi navbat kutib turardi:
     kassirning terilgan savatni qo'yib turadigan joyi yo'q edi. Yagona
     chora savatni tozalab, keyin qaytadan terish bo'lardi — bu esa
     mijozning ham, navbatning ham vaqti.

     ⚠ NEGA MASSIV, nega ikkinchi `useState` emas. Savat soni oldindan
     ma'lum emas va har biri BIR XIL huquqqa ega: qaysi biri «asosiy»
     ekanini kod bilishi shart emas, faqat qaysi biri OCHIQ ekanini
     bilishi kerak.

     ⚠ HAR SAVAT O'Z MIJOZI BILAN. Aks holda ikkinchi mijozga o'tganda
     birinchisining sodiqlik kartasi chekka tushib qolardi — ball
     boshqa odamning balansidan yechilardi.

     ⚠ `cart` va `setCart` NOMLARI SAQLANDI. Sahifada yigirmadan ortiq
     joyda ishlatiladi; ularni ochiq savatga yo'naltirish o'sha joylarni
     o'zgartirmasdan bir xil ishlashini ta'minlaydi. `setCart` chizish
     paytidagi savat raqamini YOPIB OLADI: bajik so'ralayotganda kassir
     boshqa tabga o'tsa ham, o'chirish o'sha savatdan bo'ladi. */
  const [carts, setCarts]           = useState(() => [cartStore.blank(1)]);
  const [activeId, setActiveId]     = useState(1);
  const cartSeq                     = useRef(1);

  const active = carts.find((c) => c.id === activeId) || carts[0];
  const cart   = active.items;

  /* Uzoq davom etadigan amallar (bajik so'rovi) uchun HOZIRGI holat.
     `await` dan keyin chizish paytidagi nusxa eskirgan bo'lishi mumkin. */
  const cartsRef = useRef(carts);
  const activeIdRef = useRef(activeId);
  useEffect(() => { cartsRef.current = carts; activeIdRef.current = activeId; }, [carts, activeId]);

  const patchCart = (id, patch) =>
    setCarts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const setCart = (updater) =>
    setCarts((prev) => prev.map((c) => (c.id === active.id
      ? { ...c, items: typeof updater === "function" ? updater(c.items) : updater }
      : c)));
  const [search, setSearch]         = useState("");
  const [searching, setSearching]   = useState(true);   // birinchi yuklash
  const tilesBusy = useLoading(searching);
  const [payType, setPayType]       = useState("CASH");
  const [cashGiven, setCashGiven]   = useState("");     // naqdda berilgan summa
  const [cashAmount, setCashAmount] = useState("");     // aralash: naqd qismi
  const [cardAmount, setCardAmount] = useState("");     // aralash: ikkinchi qism
  const customer = active.customer;
  const setCustomer = (c) => patchCart(active.id, { customer: c });
  /* Mijozning sodiqlik darajasi — faqat KO'RSATISH uchun. Chegirmani
     server chek yozilganda o'zi hisoblaydi; bu yerdagi raqam hisobga
     ta'sir qilmaydi va shunday bo'lishi ham kerak: front hisoblagan
     chegirma kassir tomonidan o'zgartirilishi mumkin bo'lardi. */
  const [tier, setTier]             = useState(null);
  /* Ball: kassir kiritgan summa + do'kon chegarasi (foizda). */
  const [bonusUse, setBonusUse]     = useState("");
  const [bonusMaxPercent, setBonusMaxPercent] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [branchId]                  = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [mixedSecondType, setMixedSecondType] = useState("CARD");
  const [finish, setFinish]         = useState(null);   // { phase, total, receiptNo }
  const [undo, setUndo]             = useState(null);   // { item, index }
  const [bcWarn, setBcWarn]         = useState(false);  // fokus yo'qolgani
  /* Barkod maydoni boshqarilmaydi (skaner unga to'g'ridan-to'g'ri yozadi va
     Enter'da o'zi tozalanadi). «×» tugmasi esa qiymat BORLIGINI bilishi
     kerak — shuning uchun faqat shu bayroq holatda saqlanadi. */
  const [bcValue, setBcValue]       = useState("");
  /* Chek chegirmasi — SUMMA. Kassir foizni emas, summani kiritadi:
     "5 000 so'm chegirma" mijoz bilan gaplashishda tabiiyroq va chekda
     ham summa turadi. Server chegarani foizga aylantirib tekshiradi. */
  const [discount, setDiscount]     = useState("");
  const keyboard                    = useKeyboard();
  const touchOn                     = isTouch();
  const confirm                     = useConfirm();

  /* ── Katalog ko'rinishi ────────────────────────────────────────
     Kategoriya tabi va ikki ko'rinish (rasmli / zich). Ko'rinish
     QURILMADA saqlanadi: bitta do'konda kassa va omborchining
     ekranlari har xil bo'lishi mumkin, va tanlov har kirishda
     qaytadan qilinmasin. */
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);   // null = hammasi
  const [favOnly, setFavOnly]       = useState(false);
  const [view, setView]             = useState(() => localStorage.getItem("ek_kassaView") || "");
  /* ══ USTUNLAR KENGLIGI ═══════════════════════════════════════════════
     ⚠ Kassa 360px lik qat'iy savat ustuni bilan kelardi. Bitta do'konda
     tovar nomlari uzun (kiyim, kosmetika) va savat kengroq bo'lishi
     kerak; boshqasida kassir katakchalarni ko'proq ko'rishni xohlaydi.
     Ikkalasiga bir vaqtda to'g'ri keladigan raqam yo'q, shuning uchun
     chegarani KASSIR suradi.

     ⚠ QURILMADA saqlanadi, hisobda emas: bu ekranning o'lchamiga
     bog'liq tanlov. Bitta hisob bilan kirilgan kassa monitori va
     noutbukda bir xil bo'lishi shart emas. */
  const [rightW, setRightW] = useState(() => {
    const saved = Number(localStorage.getItem("ek_kassaRightW"));
    return Number.isFinite(saved) && saved >= MIN_RIGHT_W ? saved : 360;
  });
  const layoutRef = useRef(null);

  /** Chegarani surish. Piksel emas, CHETDAN masofa hisoblanadi. */
  const dragSplit = (e) => {
    const box = layoutRef.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      /* Sichqoncha oynadan chiqib ketsa ham hisob buzilmasin —
         `clientX` chegaralanadi. */
      const w = clampRight(box.right - ev.clientX, box.width);
      setRightW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      /* Saqlash FAQAT qo'yib yuborilganda: har piksel harakatda
         `localStorage` ga yozish diskni bekorga charxlaydi. */
      setRightW((w) => { localStorage.setItem("ek_kassaRightW", String(w)); return w; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Klaviatura bilan ham: sichqonchasiz kassa terminallari bor. */
  const nudgeSplit = (e) => {
    const step = e.shiftKey ? 60 : 20;
    let d = 0;
    if (e.key === "ArrowLeft")  d = +step;   // savat kengayadi
    if (e.key === "ArrowRight") d = -step;
    if (!d) return;
    e.preventDefault();
    const box = layoutRef.current?.getBoundingClientRect();
    setRightW((w) => {
      const next = clampRight(w + d, box?.width || 1200);
      localStorage.setItem("ek_kassaRightW", String(next));
      return next;
    });
  };
  const [qtyModal, setQtyModal]     = useState(null);   // { product, initial }
  const [markModal, setMarkModal]   = useState(null);   // { product } — DataMatrix

  const barcodeRef  = useRef(null);
  const searchRef   = useRef(null);
  const debounceRef = useRef(null);
  const refocusRef  = useRef(null);
  const undoRef     = useRef(null);
  const lastSale    = useRef(null);   // Ctrl+P uchun
  /* Savatni tozalash so'ralganmi. Escape modal ochiq turganda yana bosilsa
     ikkinchi so'rov ochilib ketmasligi kerak. */
  const clearAsk    = useRef(false);

  // Chek sarlavhasi va imzosi. Sessiyadan olinadi — chek uchun alohida
  // so'rov yubormaymiz: kassa ekrani oflaynda ham ishlashi kerak.
  const shopName = localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode") || "";
  const cashier  = localStorage.getItem("ek_fullName") || localStorage.getItem("ek_username") || "";

  /* ── Mijozlar ─────────────────────────────────────────────── */
  useEffect(() => {
    customerApi.getAll(branchId).then((r) => setCustomers(r.data || [])).catch(() => {});
  }, [branchId]);

  /* Tanlangan mijozning darajasi. Xatosi JIM yutiladi: daraja — qo'shimcha
     ma'lumot, uning yo'qligi sotuvga xalaqit bermasligi kerak. */
  useEffect(() => {
    if (!customer?.id) { setTier(null); setBonusUse(""); return; }
    let alive = true;
    loyaltyApi.customerTier(customer.id)
      .then((r) => { if (alive) setTier(r.data || null); })
      .catch(() => { if (alive) setTier(null); });
    // Mijoz almashsa kiritilgan ball tozalanadi: oldingi mijozning
    // balansiga qarab yozilgan raqam yangisiga to'g'ri kelmaydi.
    setBonusUse("");
    return () => { alive = false; };
  }, [customer?.id]);


  /* ── Kategoriyalar va standart ko'rinish ───────────────────────
     Ko'rinish tanlanmagan bo'lsa faoliyat turidan olinadi: oziq-ovqatda
     zich ro'yxat (tovar barkod bilan tanlanadi va ekranga ko'proq
     sig'ishi kerak), kiyim/kosmetikada rasmli katakcha (tovar KO'RIB
     tanlanadi). Bu — standart, majburiyat emas. */
  useEffect(() => {
    productApi.getCategories(branchId)
      .then((r) => setCategories((r.data || []).filter((c) => c.productCount > 0)))
      .catch(() => {});
  }, [branchId]);

  /* Do'kon profili — BIR MARTA va bitta so'rovda: kassa ko'rinishi ham,
     ball chegarasi ham shundan olinadi.

     ⚠ Ilgari bu yerda faqat ko'rinish olinardi; ball qo'shilganda ikkinchi
     `getProfile()` yozilgan edi va kassa ochilishida bir xil so'rov ikki
     marta ketardi. `setView` funksional shaklda — kassir allaqachon
     tanlagan ko'rinish ustidan yozilmasin. */
  useEffect(() => {
    shopApi.getProfile()
      .then((r) => {
        setBonusMaxPercent(Number(r?.data?.bonusMaxPercent) || 0);
        const bt = r?.data?.businessType;
        const auto = ["CLOTHING", "COSMETICS", "SERVICE", "ELECTRONICS"].includes(bt) ? "tiles" : "list";
        setView((cur) => cur || auto);
      })
      .catch(() => {
        setBonusMaxPercent(0);
        setView((cur) => cur || "list");
      });
  }, []);

  const setViewMode = (mode) => {
    setView(mode);
    localStorage.setItem("ek_kassaView", mode);
  };

  /* ── Server qidiruvi (debounce 350ms) ─────────────────────── */
  /* Filtrsiz ro'yxat — KESHDA.

     ⚠ NEGA. Savatga qo'shilgandan keyin qidiruv maydoni tozalanadi va
     katakchalar to'liq ro'yxatga qaytishi kerak. Ilgari buning uchun har
     safar SERVERGA so'rov ketardi — ya'ni har skanerlangan tovar uchun
     bittadan. Yigirma dona tovarli chekda bu yigirmata keraksiz so'rov:
     sekin tarmoqda katakchalar miltillab turardi, oflaynda esa har biri
     kutib qolardi. Ro'yxat esa o'sha-o'sha edi. */
  const baseProducts = useRef(null);

  /* ══ «BOSHQA KASSADA SOTILDI» BELGISI ═══════════════════════════════
     ⚠ Jonli yangilanish JIM edi: son o'zgarardi-yu, kassir buni ko'rmasdi.
     Ekranda 40 ta katakcha turibdi va ulardan bittasining raqami 5 dan
     4 ga tushganini payqash — imkonsiz ish. Natijada jonli yangilanish
     bor edi, foydasi esa yo'q.

     Endi o'zgargan katakcha bir silkinib qo'yadi. Silkinish qisqa
     (1.6 s) va faqat SONI O'ZGARGANLARIDA — hammasi qimirlasa u ogohlik
     emas, bezovtalikka aylanardi.

     ⚠ Harakatni kamaytirish rejimida (`prefers-reduced-motion`) animatsiya
     o'zi o'chadi — `ek-motion.css` dagi umumiy qoida. */
  const [flash, setFlash] = useState(() => new Set());
  const flashTimer = useRef(null);
  const productsRef = useRef([]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const flagChanges = useCallback((list) => {
    const before = new Map(productsRef.current.map((p) => [p.id, p.stockQuantity]));
    const moved = list
      .filter((p) => before.has(p.id) && Number(before.get(p.id)) !== Number(p.stockQuantity))
      .map((p) => p.id);
    if (moved.length === 0) return;
    setFlash(new Set(moved));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(new Set()), FLASH_MS);
  }, []);

  /**
   * `silent` — FON yangilanishi.
   *
   * ⚠ Fonda «Qidirilmoqda…» spinneri chizilmaydi: bu yangilanishni kassir
   * so'ramagan va har 15 soniyada miltillab turgan yozuv ish maydonini
   * bezovta qilardi. Xato ham ko'rsatilmaydi — katalog eskicha qoladi
   * (oflayn uchun allaqachon shunday edi).
   */
  const doSearch = useCallback(async (q, { silent = false } = {}) => {
    if (!silent) setSearching(true);
    try {
      const res = await productApi.search(q, 0, 60, branchId,
        { categoryId, favorites: favOnly });
      const list = res.data || [];
      if (!q) baseProducts.current = list;
      /* ⚠ FAQAT FON yangilanishida belgilanadi. Kassirning o'z sotuvidan
         keyin ham qoldiq o'zgaradi, lekin uni kassir allaqachon biladi —
         har chekdan keyin yarim ekran silkinishi shovqindan boshqa narsa
         emas. Belgi BOSHQA odam qilgan o'zgarish uchun. */
      if (silent) flagChanges(list);
      setProducts(list);
    } catch (_) { /* oflaynda katalog eskicha qoladi */ }
    finally { if (!silent) setSearching(false); }
  }, [branchId, categoryId, favOnly, flagChanges]);

  /* Kategoriya yoki filial almashsa kesh yaroqsiz — ro'yxat boshqa. */
  useEffect(() => { baseProducts.current = null; }, [branchId, categoryId, favOnly]);

  /* ══ JONLI QOLDIQ ══════════════════════════════════════════
     Katakchadagi son boshqa kassadagi sotuvdan ham o'zgaradi, lekin
     ro'yxat faqat qidiruvda va sotuvdan keyin yangilanardi. Ikkinchi
     kassir oxirgi donani sotib yuborsa, bu kassada u hamon «bor» bo'lib
     turardi va kassir buni faqat to'lovda bilardi.

     ⚠ FAQAT KASSIR BO'SH TURGANDA. Kassa — eng band ekran: to'lov oynasi,
     miqdor oynasi, yorliq skaneri ochiq bo'lsa yoki qidiruvga biror narsa
     yozilgan bo'lsa, jadval QIMIRLAMAYDI. Kassirning qo'li ostida
     katakchalar o'rin almashishi xato bosishga olib kelardi — mijoz
     oldida bu eng yomon vaqt.

     ⚠ Sahifa ko'rinmasa ham so'rov yuborilmaydi; tabga qaytilganda
     darhol yangilanadi. Ombor sahifasi bilan bir xil qoida. */
  const kassaBusy = useRef(false);
  useEffect(() => {
    kassaBusy.current = Boolean(
      showPayModal || finish || qtyModal || markModal || processing || search
    );
  }, [showPayModal, finish, qtyModal, markModal, processing, search]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || kassaBusy.current) return;
      doSearch("", { silent: true });
    };
    const timer = setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [doSearch]);

  /**
   * Qidiruvni tozalash — savatga qo'shilgandan keyin.
   *
   * Kesh bo'lsa serverga BORMAYDI. Katakchadagi son baribir to'g'ri
   * qoladi: u savatni hisobga olib chiziladi (`available`), sotuvdan
   * keyin esa ro'yxat serverdan qayta o'qiladi.
   */
  const resetSearch = useCallback(() => {
    setSearch("");
    clearTimeout(debounceRef.current);
    if (baseProducts.current) setProducts(baseProducts.current);
    else doSearch("");
  }, [doSearch]);

  useEffect(() => { doSearch(search); }, [doSearch]);   // kategoriya almashsa ham

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  /* ══ SAVATNI SAQLASH ═══════════════════════════════════════
     ⚠ NEGA. Savatdan o'chirish bajik bilan qo'riqlanadi va jurnalga
     yoziladi, lekin savatning o'zi `useState` da edi — bitta F5 uni izsiz
     yo'q qilardi. Ya'ni qo'riqlashni aylanib o'tish uchun tugmani ham
     bosish shart emasdi. Endi savat saqlanadi va F5 uni yo'qotmaydi.

     ⚠ BU DEVOR EMAS: brauzer kassirning qo'lida. Bu qatlam tasodifiy va
     beparvo chetlab o'tishni yopadi, ataylab qilinganini esa KO'RINADIGAN
     qiladi. Haqiqiy devor bitta — savat serverda yashashi. */
  /* ⚠ ANIQ BIR MARTA. Bog'liqlik ro'yxati bo'sh bo'lsa ham React
     StrictMode ni ishlab chiqishda effektni IKKI MARTA chaqiradi, shuning
     uchun qo'riqlagich `ref` da. Busiz xabar ikki marta chiqardi. */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const found = cartStore.take();
    if (!found) return;

    if (!found.stale) {
      setCarts(found.carts);
      setActiveId(found.activeId);
      cartSeq.current = Math.max(...found.carts.map((c) => c.id));
      const items = cartStore.flatten(found.carts);
      toast.info(found.carts.length > 1
        ? t("kassa.cartsRestored", { c: found.carts.length, n: items.length })
        : t("kassa.cartRestored", { n: items.length }));
      return;
    }

    /* Eskirgan savat TIKLANMAYDI — mijoz ketib bo'lgan, narx o'zgargan
       bo'lishi mumkin. Lekin izsiz ham qolmaydi: kim, qachon va nimani
       to'lamasdan qoldirgani jurnalga tushadi. */
    const abandoned = cartStore.flatten(found.carts);
    securityApi.cartAbandoned({
      itemCount: abandoned.length,
      total: cartStore.totalOf(abandoned),
      note: cartStore.describe(abandoned),
    }).catch(() => { /* jurnal yozilmasa ham kassa ishlaydi */ });
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
       ATAYLAB bo'sh: bu ochilishdagi BIR MARTALIK amal, `toast` esa
       bog'liqlikka qo'yilganda halqa hosil qilardi. */
  }, []);

  /* Har o'zgarishda saqlanadi. Hamma savat bo'sh bo'lsa yozuv o'chadi. */
  useEffect(() => { cartStore.save(carts, activeId); }, [carts, activeId]);

  /* ══ SAVATLARNI BOSHQARISH ══════════════════════════════════════════ */

  /** Yangi bo'sh savat ochadi va unga o'tadi. */
  const addCart = () => {
    if (carts.length >= cartStore.MAX_CARTS) {
      toast.error(t("kassa.cartsMax", { n: cartStore.MAX_CARTS }));
      return;
    }
    const id = ++cartSeq.current;
    setCarts((prev) => [...prev, cartStore.blank(id)]);
    setActiveId(id);
    focusBarcode();
  };

  /**
   * Savatni yopadi.
   *
   * ⚠ TOVARI BOR SAVAT — bajik bilan. Yopish `handleClearCart` bilan bir
   * xil amal: chekka tushmagan tovarlar yo'q bo'ladi. Tab bo'ylab uni
   * qo'riqlanmagan qoldirish butun nazoratni ochiq eshikka aylantirardi.
   *
   * ⚠ OXIRGI SAVAT YO'QOLMAYDI, faqat bo'shaydi: kassada doim bitta
   * ochiq savat turishi kerak, aks holda ekranda nima ko'rsatiladi?
   */
  const dropCart = async (id) => {
    const victim = carts.find((c) => c.id === id);
    if (!victim) return;

    if (victim.items.length) {
      try {
        await guard(() => securityApi.confirm({
          action: "CART_ITEM_REMOVE",
          targetType: "CART",
          targetId: null,
          note: `${t("kassa.clearNote")}: ${victim.items.length} x = ${money(cartStore.totalOf(victim.items))}`,
        }));
      } catch (err) {
        if (!err?.cancelled) toast.error(err.message);
        return;
      }
    }

    /* ⚠ Ro'yxat `cartsRef` dan o'qiladi, chizish paytidagi `carts` dan
       emas: bajik oynasi ochiq turganda skaner boshqa savatga tovar
       qo'shib qo'yishi mumkin va eski nusxani qaytarib yozish o'sha
       tovarni yo'q qilardi. */
    const list = cartsRef.current;
    if (list.length === 1) { setCarts([cartStore.blank(id)]); return; }
    const idx = list.findIndex((c) => c.id === id);
    const rest = list.filter((c) => c.id !== id);
    setCarts(rest);
    if (id === activeIdRef.current) setActiveId(rest[Math.min(idx, rest.length - 1)].id);
  };

  /** Keyingi savatga o'tish (F3) — oxirgisidan keyin boshiga qaytadi. */
  const nextCart = () => {
    if (carts.length < 2) return;
    const i = carts.findIndex((c) => c.id === activeId);
    setActiveId(carts[(i + 1) % carts.length].id);
    focusBarcode();
  };

  const switchCart = (id) => { setActiveId(id); focusBarcode(); };

  /* ── Oflayn navbat: yuborish funksiyasini ulaymiz ─────────── */
  useEffect(() => {
    queue.setSender((payload) => saleApi.create(payload));
    queue.startSync();
  }, []);

  /* ══ BARKOD MAYDONI — ekranning eng muhim detali ═══════════
     Sahifa ochilganda va har sotuvdan keyin avtomatik fokusda.
     Boshqa joyni bosganda 3 soniyadan keyin fokus qaytadi —
     lekin modal ochiq bo'lsa yoki foydalanuvchi boshqa maydonga
     yozayotgan bo'lsa TEGILMAYDI (aks holda yozib bo'lmaydi). */
  const focusBarcode = useCallback(() => {
    barcodeRef.current?.focus();
    setBcWarn(false);
  }, []);

  useEffect(() => {
    if (showPayModal || finish || qtyModal || markModal) return;
    focusBarcode();
  }, [showPayModal, finish, qtyModal, markModal, focusBarcode]);

  useEffect(() => {
    const onFocusOut = () => {
      clearTimeout(refocusRef.current);
      refocusRef.current = setTimeout(() => {
        const el = document.activeElement;
        const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
        if (showPayModal || finish || qtyModal || markModal || typing) { setBcWarn(!typing); return; }
        focusBarcode();
      }, REFOCUS_MS);
    };
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusout", onFocusOut); clearTimeout(refocusRef.current); };
  }, [showPayModal, finish, qtyModal, markModal, focusBarcode]);

  /* ── Skanerlangan kod ──────────────────────────────────────────
     Butun mantiq SERVERDA (`/products/scan`): oddiy barkod, qadoq
     barkodi (quti = 12 dona), tarozi barkodi (ichida og'irlik) va
     "do'konda yo'q, lekin umumiy bazada bor" holati.

     ⚠ Ilgari kassa barkodni o'zi qidirardi va faqat AYNAN mos
     keladiganini topa olardi — quti barkodi ham, tarozi barkodi ham
     "topilmadi" bo'lib chiqardi.

     Oflaynda server yo'q: shunda avval yuklangan ro'yxatdan qidiramiz,
     ya'ni oddiy barkod baribir ishlaydi. */
  /* ── MIJOZ KARTASI (V34) ───────────────────────────────────────
     Karta shtrixi `EKC-` prefiksi bilan kodlangan — aynan shu bilan u
     tovar barkodidan ajraladi. Prefikssiz ajratib bo'lmasdi: karta kodi
     ham, artikul ham harf-raqamli bo'lishi mumkin va kassir mijozning
     kartasini skanerlaganda tizim uni "topilmagan tovar" deb hisoblardi.

     ⚠ Prefiks SERVER bilan bir xil (`CustomerService.CARD_PREFIX`). */
  const CARD_PREFIX = "EKC-";

  const attachCustomerByCard = async (raw) => {
    try {
      const r = await customerApi.byCard(raw);
      const c = r.data;
      if (!c?.id) throw new Error("not found");
      setCustomer(c);
      toast.success(t("kassa.cardAttached", { name: c.fullName || c.phone || "" }));
    } catch (_) {
      // Karta bor, lekin bu do'konga tegishli emas yoki o'chirilgan.
      toast.info(t("kassa.cardNotFound"));
    }
  };

  const addByBarcode = async (code) => {
    /* ⚠ Kartani TOVARDAN OLDIN tekshiramiz: aks holda kod avval
       `/products/scan` ga ketib, "topilmadi" xabari chiqardi. */
    if (String(code).toUpperCase().startsWith(CARD_PREFIX)) {
      await attachCustomerByCard(code);
      return;
    }

    try {
      const res = await productApi.scan(code, branchId);
      const r = res.data || {};

      // Markirovkali tovarda oddiy barkod YETARLI EMAS: har dona uchun
      // DataMatrix skanerlanishi shart, aks holda sotuv serverda rad
      // etilardi va kassir sababni to'lov oynasida bilib olardi.
      if (r.source === "PRODUCT" && r.product?.markingGroup) {
        setMarkModal({ product: r.product });
        return;
      }
      if (r.source === "PACK" && r.product?.markingGroup) {
        setMarkModal({ product: r.product });
        return;
      }
      if (r.source === "PRODUCT") { addToCart(r.product, 1); return; }

      if (r.source === "PACK") {
        addToCart(r.product, Number(r.quantity) || 1);
        toast.info(t("kassa.packAdded", {
          label: r.packLabel || t("products.packBarcodes"),
          qty: fmtQty(r.quantity, r.product.unitDecimals),
          unit: unitLabel(r.product.unit),
        }));
        return;
      }

      if (r.source === "WEIGHT") {
        // Tarozi formati do'konga qarab farq qiladi, shuning uchun
        // o'qilgan og'irlik JIMGINA qabul qilinmaydi — kassir tasdiqlaydi.
        setQtyModal({ product: r.product, initial: Number(r.quantity) });
        toast.info(t("kassa.weightScanned", {
          qty: fmtQty(r.quantity, r.product.unitDecimals),
          unit: unitLabel(r.product.unit),
        }));
        return;
      }

      if (r.source === "GLOBAL") {
        // Do'konda yo'q, lekin umumiy bazada bor: kassir uni yaratmaydi
        // (narx qo'yish — egasining ishi), lekin nomi aytiladi, aks holda
        // "topilmadi" xabari hech narsa tushuntirmasdi.
        toast.info(`${t("catalog.globalFound")}: ${r.suggestion?.name}`);
        return;
      }
    } catch (_) {
      // Oflayn — yuklangan ro'yxatdan qidiramiz.
      const local = products.find((p) => p.barcode === code);
      if (local) { addToCart(local, 1); return; }
    }

    // Xato ovozi emas, taklif (06-APP-KASSIR.md).
    toast.info(t("kassa.barcodeNotFound", { code, section: t("products.title") }));
  };

  /* ── Skaner: butun oyna bo'ylab ────────────────────────────────
     Ilgari barkod FAQAT o'z maydoni fokusda bo'lganda o'qilardi. Amalda
     kassir mijoz oynasini ochib qo'yadi yoki sichqoncha bilan boshqa joyni
     bosadi — va skanerlangan kod yo'qoladi yoki tovar nomi maydoniga
     yozilib qoladi. Endi u qayerda bo'lishidan qat'i nazar savatga tushadi.

     To'lov oynasi ochiq bo'lganda O'CHADI: u yerda summa kiritiladi va
     tasodifiy skanerlash summani buzib yuborardi. */
  useScanner(addByBarcode, { enabled: !showPayModal && !finish && !qtyModal && !markModal });

  /* ── Savat ────────────────────────────────────────────────── */

  /** Bo'linadigan birlik (kg, litr, metr) — "+" bilan yig'ib bo'lmaydi. */
  const isDivisible = (product) => (product?.unitDecimals ?? 0) > 0;

  /** Savatda shu tovardan ALLAQACHON nechta bor. */
  const inCart = (id) => cart.find((i) => i.id === id)?.qty ?? 0;

  /**
   * BOSHQA ochiq savatlarda turgan miqdor.
   *
   * ⚠ NEGA HISOBGA OLINADI. Omborda 3 dona bor, birinchi savatga 2 tasi
   * terilgan. Ikkinchi mijozga ham 2 tasini terib bo'lardi — chek
   * yozilganda esa server ikkinchisini rad etardi va kassir mijoz
   * oldida sababini tushuntira olmasdi. Bu — bitta terminal ichidagi
   * o'ziga o'zi qo'ygan tuzoq, uni yopish arzon.
   *
   * ⚠ Bu SERVERDA joy band qilish EMAS. Boshqa kassadagi kassir baribir
   * shu tovarni sotib yuborishi mumkin va oxirgi so'z serverniki
   * qoladi — bu yerdagi hisob faqat SHU EKRANdagi savatlarni biladi.
   */
  const parked = (id) => carts.reduce(
    (sum, c) => (c.id === active.id ? sum : sum + (c.items.find((i) => i.id === id)?.qty ?? 0)), 0);

  /** Boshqa savatlar hisobga olingan, sotish mumkin bo'lgan qoldiq. */
  const freeStock = (product) => (product?.stockQuantity == null
    ? null
    : round3(Number(product.stockQuantity) - parked(product.id)));

  /**
   * Qoldiq yetadimi — SAVATDAGI JAMI miqdorga qarab.
   *
   * ⚠ Ilgari faqat `stockQuantity <= 0` tekshirilardi, ya'ni "umuman
   * qolmaganmi". Omborda 4 dona bo'lsa, kassir 6 marta bosardi va har
   * safar tekshiruv o'tardi (4 > 0) — savatga 6 dona tushardi. Xato
   * faqat TO'LOV bosqichida, serverdan chiqardi va u qaysi tovar
   * yetishmayotganini aytmasdi: kassir mijoz oldida savatni birma-bir
   * qarab chiqishga majbur bo'lardi.
   *
   * Yetsa `null`, aks holda kassirga ko'rsatiladigan matn qaytadi.
   */
  const stockError = (product, wanted) => {
    // Xizmatda (`stockQuantity` yo'q) qoldiq tushunchasi yo'q — doim sotiladi.
    if (product?.stockQuantity == null) return null;
    const held = parked(product.id);
    const left = round3(Number(product.stockQuantity) - held);
    if (wanted <= left) return null;
    const unit = unitLabel(product.unit);
    /* Sabab AYTILADI: «omborda 1 ta» degan xabar kassirni omborga
       yugurtirardi, holbuki tovar shu yerda — qo'shni savatda turibdi. */
    if (held > 0) {
      return t("kassa.stockShortParked", {
        name: product.name,
        qty: `${fmtQty(Math.max(0, left), product.unitDecimals)} ${unit}`,
        held: `${fmtQty(held, product.unitDecimals)} ${unit}`,
      });
    }
    return t("kassa.stockShort", {
      name: product.name,
      qty: `${fmtQty(left, product.unitDecimals)} ${unit}`,
    });
  };

  /**
   * Katakcha bosildi. Bo'linadigan tovarda avval miqdor so'raladi:
   * 0.350 kg ni "+" tugmasi bilan kiritishning iloji yo'q.
   */
  const pickProduct = (product) => {
    if (product.salePrice == null) { toast.error(`${product.name} — ${t("kassa.noPriceWarn")}`); return; }
    // Markirovkali tovarda miqdorni kassir yozmaydi — u har donaning
    // yorlig'ini skanerlaydi va miqdor shundan kelib chiqadi.
    if (product.markingGroup) { setMarkModal({ product }); return; }
    if (isDivisible(product)) { setQtyModal({ product, initial: null }); return; }
    addToCart(product, 1);
  };

  /** Skanerlangan yorliqlar savatga qo'shiladi (miqdor = kodlar soni). */
  const applyMarkingCodes = (codes) => {
    const { product } = markModal;
    setMarkModal(null);
    if (!codes.length) return;
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        // Kodlar BIRLASHTIRILADI, almashtirilmaydi: kassir ikkinchi
        // marta skanerlab yana bitta quti qo'shishi mumkin.
        const merged = [...new Set([...(exists.markingCodes || []), ...codes])];
        return prev.map((i) => (i.id === product.id
          ? { ...i, qty: merged.length, markingCodes: merged, _pulse: Date.now() }
          : i));
      }
      return [...prev, { ...product, qty: codes.length, markingCodes: codes, _added: Date.now() }];
    });
    resetSearch();
  };

  const addToCart = (product, amount = 1) => {
    if (product.expired) { toast.error(`${product.name} — muddati o'tgan, sotib bo'lmaydi!`); return; }
    if (product.salePrice == null) { toast.error(`${product.name} — ${t("kassa.noPriceWarn")}`); return; }
    // Qoldiq FAQAT ombor yuritiladigan tovarda tekshiriladi: xizmatda
    // `stockQuantity` umuman bo'lmaydi va u har doim sotiladi.
    if (product.stockQuantity != null && Number(product.stockQuantity) <= 0) {
      toast.error(`${product.name} — omborda qolmagan!`); return;
    }
    /* Boshqa savatlar hammasini olib bo'lgan bo'lsa ham shu yerda
       to'xtaydi — quyidagi `stockError` sababini aytadi. */
    /* Savatdagi miqdor bilan QO'SHIB tekshiriladi — bittalab bosib
       qoldiqdan oshirib yuborishning yo'li yopiladi. */
    const shortage = stockError(product, round3(inCart(product.id) + amount));
    if (shortage) { toast.error(shortage); return; }
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      // Bir xil tovar ikkinchi marta → miqdor oshadi, yangi satr yaratilmaydi
      if (exists) {
        return prev.map((i) => (i.id === product.id
          ? { ...i, qty: round3(i.qty + amount), _pulse: Date.now() }
          : i));
      }
      return [...prev, { ...product, qty: round3(amount), _added: Date.now() }];
    });
    resetSearch();
  };

  /** Kasrli qo'shishda 0.1 + 0.2 = 0.30000000000000004 bo'lmasin. */
  const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

  /* ⚠ «−» OXIRGI donani olib tashlasa, bu X tugmasi bilan AYNI amal —
     demak u ham bajik so'rashi shart. Ilgari bu yerda `.filter(qty > 0)`
     turardi va tovar jimgina yo'q bo'lardi: kassir X ni bosmasdan, «−» ni
     bir necha marta bosib qo'riqlovni butunlay aylanib o'tardi va jurnalda
     hech qanday iz qolmasdi.

     Endi miqdor 0 ga TUSHMAYDI — 1 dan pastga urinish qo'riqlanadigan
     `removeFromCart` ga yo'naltiriladi. Shu bilan savatdan chiqishning
     YAGONA yo'li qoladi va uni yopib qo'yish yetarli. */
  const updateQty = (id, delta) => {
    const item = cart.find((i) => i.id === id);
    if (!item) return;

    /* Markirovkali tovarda miqdorni "+" bilan oshirib bo'lmaydi: har dona
       o'z yorlig'iga bog'langan. "+" yangi yorliq skanerlashni ochadi,
       "−" esa oxirgi skanerlangan yorliqni olib tashlaydi. */
    if (item.markingGroup) {
      if (delta > 0) { setMarkModal({ product: item }); return; }
      const rest = (item.markingCodes || []).slice(0, -1);
      if (rest.length === 0) { removeFromCart(id); return; }
      setCart((prev) => prev.map((i) => (i.id === id
        ? { ...i, markingCodes: rest, qty: rest.length } : i)));
      return;
    }

    // Tarozili tovarda "+" bir kilogramm qo'shishi mantiqsiz — miqdor
    // oynasi ochiladi va kassir aniq qiymat kiritadi.
    if (isDivisible(item)) { setQtyModal({ product: item, initial: item.qty }); return; }

    const next = round3(item.qty + delta);
    if (next <= 0) { removeFromCart(id); return; }
    const shortage = stockError(item, next);
    if (shortage) { toast.error(shortage); return; }
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: next } : i)));
  };

  /**
   * Savat qatoridagi SONGA bosildi — miqdorni yozib kiritish.
   *
   * ⚠ Markirovkali tovar bundan MUSTASNO: uning miqdori skanerlangan
   * yorliqlar sonidan kelib chiqadi va uni qo'lda yozish yorliq bilan
   * dona o'rtasidagi bog'lanishni buzardi.
   */
  const editQty = (item) => {
    if (item.markingGroup) return;
    setQtyModal({ product: item, initial: item.qty });
  };

  /** Miqdor oynasi tasdiqlandi: savatdagi satr YANGILANADI, qo'shilmaydi. */
  const applyQuantity = (value) => {
    const { product } = qtyModal;
    setQtyModal(null);
    /* Bu yerda miqdor ALMASHTIRILADI (qo'shilmaydi), shuning uchun
       kiritilgan qiymatning o'zi qoldiq bilan solishtiriladi. Ilgari bu
       yo'lda umuman tekshiruv yo'q edi: kassir 2 kg qolgan tovarga
       500 yozib yuborsa ham savat qabul qilardi. */
    const shortage = stockError(product, round3(value));
    if (shortage) { toast.error(shortage); return; }
    const exists = cart.find((i) => i.id === product.id);
    if (exists) {
      setCart((prev) => prev.map((i) => (i.id === product.id
        ? { ...i, qty: round3(value), _pulse: Date.now() } : i)));
      return;
    }
    addToCart(product, value);
  };

  /* Savat serverda YO'Q (brauzer holati) — shuning uchun o'chirish avval
     `/security/confirm` ga yozdiriladi: bajik amalni to'smaydi, IZ qoldiradi.
     Kassir chekni kichraytirib pulni olib qolmoqchi bo'lsa, har o'chirish
     jurnalda "kim, qachon, nima" bilan turadi. Server 428 qaytarsa
     `guard` skanerlash modalini ochadi va tasdiqdan keyin o'zi davom etadi.
     Nusxa `setCart` yangilagichidan TASHQARIDA olinadi: React yangilagichni
     ikki marta chaqirishi mumkin, yon ta'sir esa bir marta bo'lishi kerak. */
  const removeFromCart = async (id) => {
    const index = cart.findIndex((i) => i.id === id);
    if (index < 0) return;
    const item = cart[index];

    try {
      await guard(() => securityApi.confirm({
        action: "CART_ITEM_REMOVE",
        targetType: "PRODUCT",
        targetId: item.id,
        note: `${item.name} x${item.qty} = ${money(item.salePrice * item.qty)}`,
      }));
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
      return;   // tasdiqsiz o'chirilmaydi
    }

    setCart((prev) => prev.filter((i) => i.id !== id));

    clearTimeout(undoRef.current);
    setUndo({ item, index });
    undoRef.current = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const restoreUndo = () => {
    if (!undo) return;
    setCart((prev) => {
      const next = [...prev];
      next.splice(Math.min(undo.index, next.length), 0, { ...undo.item, _added: Date.now() });
      return next;
    });
    clearTimeout(undoRef.current);
    setUndo(null);
  };

  /* ⚠ FAQAT ichki foydalanish (sotuvdan keyingi avtomatik tozalash) —
     u pul harakati emas, bajik so'ralmaydi. Foydalanuvchi bosadigan
     tozalash `handleClearCart` orqali: butun savatni o'chirish ham xuddi
     bitta tovarni o'chirishdek izli bo'lishi kerak — chekni kichraytirish
     o'rniga sotuvni umuman o'tkazmaslik o'sha suiiste'molning o'zi. */
  const clearCart = () => setCart([]);

  /**
   * Sotuvdan keyin savatni yopadi.
   *
   * Bittagina savat qolgan bo'lsa u BO'SHAYDI — kassada doim ochiq savat
   * turishi kerak. Bir nechtasi bo'lsa sotilgani ro'yxatdan CHIQADI va
   * kassir keyingi mijozning savatiga tushadi: bo'sh tab qoldirilsa
   * kassir «qaysi biri sotildi?» deb tekshirishga majbur bo'lardi.
   *
   * Mijoz ham shu yerda tozalanadi (`blank` uni `null` qiladi) — usiz
   * keyingi chekka oldingi mijozning kartasi tushib qolardi.
   */
  const closeSoldCart = () => {
    const id = active.id;
    const idx = carts.findIndex((c) => c.id === id);
    if (carts.length === 1) { setCarts([cartStore.blank(id)]); return; }
    const rest = carts.filter((c) => c.id !== id);
    setCarts(rest);
    setActiveId(rest[Math.min(idx, rest.length - 1)].id);
  };

  const subtotal = cart.reduce((sum, i) => sum + i.salePrice * i.qty, 0);
  /* Chegirma savat jamidan oshib keta olmaydi — aks holda chek manfiy
     summaga aylanardi. Server ham buni rad etadi; bu yerdagi cheklov
     kassirga darhol ko'rinadigan javob berish uchun. */
  const discountNum = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const afterDiscount = subtotal - discountNum;

  /* ── Ball ─────────────────────────────────────────────────────────────
     ⚠ Chegara SERVERDA hisoblanadi va shu yerdagi raqam faqat kassirga
     darhol ko'rsatish uchun. Server yuborilgan summani qayta tekshiradi
     va oshib ketsa RAD ETADI (jimgina kamaytirmaydi: kassir mijozga
     aytgan raqam bilan chekdagi raqam boshqa bo'lib qolardi).

     Sodiqlik chegirmasi bu yerda HISOBGA OLINMAYDI: uni ham server
     qo'yadi va front uni oldindan bilmaydi. Ya'ni ko'rsatilgan
     «eng ko'pi» biroz yuqoriroq bo'lishi mumkin — server aniqrog'ini
     aytadi. */
  const bonusCap = Math.floor(afterDiscount * (Number(bonusMaxPercent) || 0) / 100);
  const bonusAvail = Math.min(Number(tier?.bonusBalance) || 0, bonusCap);
  const bonusNum = Math.max(0, Math.min(Number(bonusUse) || 0, bonusAvail));

  const total    = afterDiscount - bonusNum;
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  const handleClearCart = async () => {
    if (!cart.length) return;
    try {
      await guard(() => securityApi.confirm({
        action: "CART_ITEM_REMOVE",
        targetType: "CART",
        targetId: null,
        note: `${t("kassa.clearNote")}: ${cart.length} x = ${money(total)}`,
      }));
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
      return;
    }
    clearCart();
  };

  /* ── To'lov ───────────────────────────────────────────────── */
  const handlePayTypeChange = (type) => {
    setPayType(type);
    if (type === "MIXED") {
      const half = Math.round(total / 2);
      setCashAmount(String(half));
      setCardAmount(String(total - half));
      setMixedSecondType("CARD");
    } else {
      setCashAmount(""); setCardAmount("");
    }
  };

  const openPayModal = () => {
    if (!cart.length) return;
    setPayType("CASH");
    setCashGiven(""); setCashAmount(""); setCardAmount(""); setDiscount("");
    setMixedSecondType("CARD");
    setShowPayModal(true);
  };
  const closePayModal = () => setShowPayModal(false);

  const change      = Math.max(0, (Number(cashGiven) || 0) - total);
  const mixedSum    = (Number(cashAmount) || 0) + (Number(cardAmount) || 0);
  const mixedOk     = payType !== "MIXED" || mixedSum === total;
  /* Nasiya — MIJOZGA beriladigan qarz. Kimga berilganini bilmasdan yozib
     bo'lmaydi: server ham rad etadi, lekin kassir buni to'lov tugmasini
     bosishdan OLDIN ko'rishi kerak. */
  const creditOk    = payType !== "CREDIT" || !!customer;
  const cashOk      = payType !== "CASH"  || !cashGiven || Number(cashGiven) >= total;
  const canSubmit   = cart.length > 0 && !processing && mixedOk && cashOk && creditOk;

  /* ── Sotuvni yakunlash ────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setProcessing(true);

    const payload = {
      idempotencyKey: queue.newIdempotencyKey(),
      customerId: customer?.id || null,
      items: cart.map((i) => ({
        productId: i.id,
        quantity: i.qty,
        // Markirovkasiz tovarda maydon umuman yuborilmaydi.
        ...(i.markingCodes?.length ? { markingCodes: i.markingCodes } : {}),
      })),
      paymentType: payType,
      discountAmount: discountNum,
      // ⚠ Ball — chegirma, to'lov turi emas: `cashAmount` allaqachon
      // balldan KEYINGI summani ko'rsatadi va kassaga aynan shu tushadi.
      bonusAmount: bonusNum,
      mixedSecondType: payType === "MIXED" ? mixedSecondType : undefined,
      cashAmount: payType === "CASH" ? total : payType === "MIXED" ? Number(cashAmount) || 0 : 0,
      cardAmount: ["CARD", "CLICK", "PAYME"].includes(payType) ? total
                : payType === "MIXED" ? Number(cardAmount) || 0 : 0,
    };
    /* Chekka chegirma ham tushadi: mijoz "qancha chegirma oldim" degan
       savolga qog'ozdan javob topishi kerak, aks holda faqat yakuniy
       summa ko'rinib, chegirma ko'rinmay qolardi. */
    const snapshot = { cart: [...cart], total, subtotal, discount: discountNum, payType, customer };

    setShowPayModal(false);
    setFinish({ phase: "printing", total: money(total) });

    let receiptNo = null;
    let offline   = false;
    let res_saleId = null;
    let receiptUrl = null;

    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      const res = await saleApi.create(payload);
      res_saleId = res?.data?.id ?? null;
      receiptNo = res_saleId != null ? `A-${res_saleId}` : null;
      /* Elektron chek havolasi (V34) — chekka QR bo'lib bosiladi.
         ⚠ Havolani SERVER beradi (imzo siri faqat u yerda), front uni
         o'zi yasay olmaydi. Eski serverda maydon yo'q — QR chizilmaydi. */
      receiptUrl = res?.data?.receiptUrl || null;
    } catch (err) {
      // Tarmoq xatosi yoki oflayn → navbatga. Boshqa xato (masalan qoldiq
      // yetmasligi) esa haqiqiy xato: sotuv qayd etilmaydi.
      const networkish = err?.message === "OFFLINE" || !navigator.onLine ||
                         /Failed to fetch|NetworkError|ulanib/i.test(err?.message || "");
      if (!networkish) {
        setFinish(null);
        setProcessing(false);
        setShowPayModal(true);
        toast.error(err.message);
        return;
      }
      await queue.enqueue(payload, { itemCount: cart.length, total });
      receiptNo = nextOfflineNo();
      offline = true;
    }

    /* ── Fiskal belgi ────────────────────────────────────────────────
       Chek fiskal modulga sotuv yozilgandan KEYIN yuboriladi, shuning
       uchun belgi sotuv javobida bo'lmaydi. Uni bir marta so'raymiz va
       KUTIB QOLMAYMIZ: kelmasa chek belgisiz chiqadi va keyin Ctrl+P
       bilan qayta chop etiladi. Kassa hech qachon fiskal modulni
       kutib turmaydi. */
    let fiscal = null;
    if (!offline && res_saleId) {
      try {
        const fr = await fiscalApi.bySale(res_saleId);
        if (fr?.data?.fiscalSign) fiscal = fr.data;
      } catch (_) { /* fiskal yo'q — chek baribir chiqadi */ }
    }

    lastSale.current = { ...snapshot, saleId: receiptNo, serverSaleId: res_saleId, offline, fiscal, receiptUrl };
    // Chek va pul yashigi — BITTA amalda, kassirdan qo'shimcha bosish
    // talab qilmasdan. Xatosi yutilmaydi, lekin SOTUVNI to'xtatmaydi:
    // sotuv allaqachon qayd etilgan va printer nosozligi uni bekor
    // qilmasligi kerak — kassir chekni Ctrl+P bilan qayta chiqaradi.
    /* `serverSaleId` — chekdagi barkod uchun. Oflayn sotuvda `null`:
       serverda bunday sotuv hali yo'q va barkodni skanerlash hech narsa
       topmasdi. */
    printReceipt({ saleId: receiptNo, serverSaleId: res_saleId, ...snapshot, offline, shopName, cashier, fiscal, receiptUrl })
      .catch((err) => toast.error(`${t("hw.printFailed")}: ${err.message}`));

    setFinish({ phase: "done", total: money(snapshot.total), receiptNo });
    if (refreshLowStock) refreshLowStock();
    /* ⚠ Katakchalar ham QAYTA O'QILADI. Ilgari faqat yon paneldagi «kam
       qolgan» belgisi yangilanardi, mahsulot katakchalari esa oxirgi
       qidiruvdan qolgan eski qoldiqni ko'rsatib turaverardi — kassir
       sahifani qo'lda yangilamaguncha son o'zgarmasdi. */
    doSearch(search);

    closeSoldCart();
    setCashGiven(""); setCashAmount(""); setCardAmount(""); setDiscount("");
    /* ⚠ Ball ham tozalanadi. Usiz keyingi mijozning chekiga oldingi
       mijozning ball summasi tushib qolardi — va u boshqa odamning
       balansidan yechilardi. */
    setBonusUse("");
    setPayType("CASH");
    setProcessing(false);

    setTimeout(() => { setFinish(null); focusBarcode(); }, 2200);
  };

  const reprint = () => {
    if (!lastSale.current) { toast.info(t("kassa.noReceipt")); return; }
    printReceipt({ ...lastSale.current, shopName, cashier })
      .catch((err) => toast.error(`${t("hw.printFailed")}: ${err.message}`));
  };

  /** Pul yashigi — sotuvsiz ham ochiladi: qaytim berish, smena boshi.
      Avval bajik bilan tasdiqlanadi (server yozadi), keyin apparat ochiladi:
      naqd pulga to'g'ridan-to'g'ri kirish izsiz qolmasligi kerak. */
  const kickDrawer = async () => {
    try {
      await guard(() => securityApi.confirm({
        action: "DRAWER_OPEN", targetType: null, targetId: null, note: null,
      }));
    } catch (err) {
      if (!err?.cancelled) toast.error(err.message);
      return;
    }
    openDrawer().catch((err) => toast.error(`${t("hw.drawerFailed")}: ${err.message}`));
  };

  /* ══ KLAVIATURA YORLIQLARI ════════════════════════════════ */
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT";

      if (e.ctrlKey && (e.key === "b" || e.key === "B")) { e.preventDefault(); focusBarcode(); return; }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) { e.preventDefault(); reprint(); return; }

      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); return; }

      if (e.key === "Escape") {
        if (finish)       { setFinish(null); focusBarcode(); return; }
        if (qtyModal)     { setQtyModal(null); focusBarcode(); return; }
        if (markModal)    { setMarkModal(null); focusBarcode(); return; }
        if (showPayModal) { closePayModal(); return; }
        /* ⚠ `window.confirm` EMAS: brauzerning o'z oynasi ilova temasidan
           tashqarida chiqadi va `.exe` da butun oynani bloklaydi. */
        if (cart.length && !clearAsk.current) {
          clearAsk.current = true;
          confirm({
            title: t("kassa.clear"),
            message: t("kassa.clearConfirm"),
            type: "danger",
            confirmText: t("kassa.clear"),
          }).then((ok) => {
            clearAsk.current = false;
            if (ok) handleClearCart();
            focusBarcode();
          });
        }
        return;
      }

      /* F2 / F3 — savatlar. To'lov oynasi ochiq bo'lganda ular to'lov
         turini tanlaydi, shuning uchun faqat kassa ekranida ishlaydi.
         ⚠ Ctrl+1..9 EMAS: brauzerda u varaqlarni almashtiradi va
         kassirning kassasi ko'zdan g'oyib bo'lardi. */
      if (!showPayModal && !finish && !qtyModal && !markModal) {
        if (e.key === "F2") { e.preventDefault(); addCart();  return; }
        if (e.key === "F3") { e.preventDefault(); nextCart(); return; }
      }

      if (e.key === "F9") {
        e.preventDefault();
        if (showPayModal) handleSubmit(); else openPayModal();
        return;
      }

      if (showPayModal) {
        if (e.key === "F1") { e.preventDefault(); handlePayTypeChange("CASH");  return; }
        if (e.key === "F2") { e.preventDefault(); handlePayTypeChange("CARD");  return; }
        if (e.key === "F3") { e.preventDefault(); handlePayTypeChange("MIXED"); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });   // har renderda yangilanadi — yopilmalar (cart, total) yangi bo'lishi shart

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: "calc(100vh - var(--sh) - 40px)", display: "flex", flexDirection: "column" }}>
      {/* ⚠ SAHIFA SARLAVHASI VA SMENA BELGISI OLIB TASHLANDI (2026-08-27).

          Ular butun kenglikni egallab, PASTDAGI IKKALA USTUNni ham
          pastga surardi — jumladan savatni, ya'ni kassaning eng ko'p
          ishlatiladigan qismini. Evaziga bergan foydasi esa yo'q edi:

            · «Savdo (Kassa)» sarlavhasi — yon menyuda o'sha bo'lim
              allaqachon yoritilgan holda turibdi;
            · «Smena ochiq» belgisi — smena panelining O'ZIDA aniqroq
              yozilgan («09:12 dan ochiq»), ya'ni bir xil ma'lumot ikki
              joyda takrorlanardi;
            · apparat tugmalari — pastda, qidiruv qatorining yoniga
              ko'chdi va endi hech qanday qo'shimcha balandlik olmaydi.

          ⚠ SMENA VA OFLAYN PANELLARI CHAP USTUNGA ko'chdi. Ular ogohlik,
          shuning uchun ko'rinib turishi kerak — lekin savat ustunidan
          balandlik o'g'irlashi shart emas. Endi savat ekranning to'liq
          balandligini egallaydi. */}
      <div className="kassa-layout" ref={layoutRef}
           style={{ "--kassa-right-w": `${rightW}px` }}>
        {/* ════ CHAP: Barkod + Mahsulotlar ════ */}
        <div className="kassa-left">
          <OfflineBar />
          <ShiftBar toast={toast} />
          {/* Barkod maydoni — doim fokusda, monoshriftda (bu raqam) */}
          <div className="bc-field" data-unfocused={bcWarn}>
            <i className="fa-solid fa-barcode" aria-hidden="true" />
            <label htmlFor="bc" className="ek-sr-only">{t("kassa.scanTitle")}</label>
            <input
              id="bc"
              ref={barcodeRef}
              data-scanner="true"
              /* ⚠ Ekran klaviaturasi bu maydonda O'ZI OCHILMAYDI. Maydon
                 doim fokusda turadi (skaner shu yerga yozadi), demak
                 avtomatik ochilsa klaviatura Kassa ekranidan hech qachon
                 ketmasdi. Kerak bo'lganda yonidagi tugma bilan ochiladi. */
              data-osk="off"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("kassa.scanHint")}
              onChange={(e) => setBcValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const code = e.currentTarget.value.trim();
                e.currentTarget.value = "";       // skanerdan keyin maydon tozalanadi
                setBcValue("");
                if (code.length > 2) addByBarcode(code);
              }}
            />
            {bcValue && (
              <ClearButton
                label={t("osk.clear")}
                onClear={() => {
                  if (barcodeRef.current) clearField(barcodeRef.current);
                  setBcValue("");
                }}
              />
            )}
            {touchOn && (
              <button
                type="button"
                className="bc-field__pad"
                title={t("osk.title")}
                aria-label={t("osk.title")}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => keyboard.open(barcodeRef.current)}
              >
                <i className="fa-solid fa-calculator" aria-hidden="true" />
              </button>
            )}
            <span className="kbd" title={t("kassa.backToBarcode")}>Ctrl+B</span>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0,
                          display: "flex", alignItems: "center", gap: 8 }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 0 }}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  ref={searchRef}
                  placeholder={t("kassa.searchByName")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && products.length === 1) addToCart(products[0]); }}
                />
                {search && <ClearButton label={t("osk.clear")} onClear={() => handleSearchChange("")} />}
                <span className="kbd">/</span>
              </div>

              {/* Apparat tugmalari FAQAT desktop'da. Brauzerda ular bosilganda
                  hech nima qilmasdi va kassirni chalg'itardi.
                  ⚠ Faqat BELGI qoldi, matn yo'q: qidiruv qatori ustunning
                  eng muhim elementi va uni ikkita yozuv bilan qisqartirish
                  bir muammoni ikkinchisi bilan almashtirish bo'lardi. */}
              {/* ⚠ «Yangi savat» SHU YERDA, tablar yonida emas. Savat
                  ustuni tor va uning har piksel balandligi ro'yxatga
                  kerak — tugmani o'sha yerga qo'yish tablarni siqib,
                  ularni suriladigan qilib qo'yardi. Bu yerda esa joy
                  bor va tugma kassirning ko'z o'ngida turadi. */}
              <button type="button" className="btn btn-outline btn-sm" onClick={addCart}
                      disabled={carts.length >= cartStore.MAX_CARTS}
                      title={t("kassa.newCart")}>
                <i className="fa-solid fa-cart-plus" aria-hidden="true" />
                <span className="kbd">F2</span>
              </button>

              {isDesktop() && (
                <>
                  <button type="button" className="btn-icon" onClick={kickDrawer}
                          title={t("hw.openDrawerHint")} aria-label={t("hw.openDrawer")}>
                    <i className="fa-solid fa-cash-register" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon" onClick={reprint}
                          title={`${t("kassa.reprint")} (Ctrl+P)`} aria-label={t("kassa.reprint")}>
                    <i className="fa-solid fa-print" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {/* Birinchi yuklanishda katakcha shaklidagi skeleton — kelayotgan
                to'r aynan shu shaklda, shuning uchun sakrash bo'lmaydi.
                Keyingi qidiruvlarda esa mavjud natijalar joyida qoladi va
                yuqorida faqat kichik holat ko'rsatiladi. */}
            {/* ── Kategoriya tabi + ko'rinish tanlovi ──────────────────
                Bo'sh kategoriya ko'rsatilmaydi (`productCount > 0`):
                bosilganda bo'sh ro'yxat chiqadigan tab kassirga faqat
                xalaqit beradi. */}
            <div className="cat-bar">
              <div className="cat-tabs" role="tablist" aria-label={t("products.category")}>
                <button type="button" role="tab" aria-selected={!categoryId && !favOnly}
                        className={`cat-tab ${!categoryId && !favOnly ? "active" : ""}`}
                        onClick={() => { setCategoryId(null); setFavOnly(false); }}>
                  <i className="fa-solid fa-grip" aria-hidden="true" /> {t("kassa.allProducts")}
                </button>

                <button type="button" role="tab" aria-selected={favOnly}
                        className={`cat-tab ${favOnly ? "active" : ""}`}
                        onClick={() => { setFavOnly(true); setCategoryId(null); }}>
                  <i className="fa-solid fa-star" aria-hidden="true" /> {t("kassa.favorites")}
                </button>

                {categories.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={categoryId === c.id}
                          className={`cat-tab ${categoryId === c.id ? "active" : ""}`}
                          data-color={c.color || "brand"}
                          onClick={() => { setCategoryId(c.id); setFavOnly(false); }}>
                    {c.icon && <i className={`fa-solid ${c.icon}`} aria-hidden="true" />} {c.name}
                  </button>
                ))}
              </div>

              <div className="view-switch" role="group" aria-label={t("kassa.viewTiles")}>
                <button type="button" className={view === "tiles" ? "active" : ""}
                        aria-pressed={view === "tiles"} title={t("kassa.viewTiles")}
                        onClick={() => setViewMode("tiles")}>
                  <i className="fa-solid fa-table-cells-large" aria-hidden="true" />
                </button>
                <button type="button" className={view === "list" ? "active" : ""}
                        aria-pressed={view === "list"} title={t("kassa.viewList")}
                        onClick={() => setViewMode("list")}>
                  <i className="fa-solid fa-list" aria-hidden="true" />
                </button>
              </div>
            </div>

            {tilesBusy && products.length === 0 ? (
              <SkeletonTiles count={12} />
            ) : (
            <div className={`product-grid ${view === "list" ? "product-grid--list" : ""}`}
                 style={{ position: "relative" }}>
              {searching && products.length > 0 && (
                <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, fontSize: 11, color: "var(--fg-brand)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Spinner small /> Qidirilmoqda…
                </div>
              )}
              {products.map((p) => (
                /* Katakchadagi son SAVATNI hisobga oladi: 38 dona bordi,
                   3 tasi savatda — katakchada 35 turadi. Ilgari u ombor
                   qoldig'ini ko'rsatib turaverardi va kassir savatga
                   qancha olganini faqat savatdan sanab bilardi. */
                <ProductTile
                  key={p.id}
                  product={p}
                  available={p.stockQuantity != null
                    ? round3(freeStock(p) - inCart(p.id))
                    : null}
                  view={view}
                  onPick={pickProduct}
                  changed={flash.has(p.id)}
                />
              ))}
              {products.length === 0 && !searching && (
                <div style={{ gridColumn: "1/-1" }}>
                  <Empty icon="fa-magnifying-glass" text={t("products.notFound")} />
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Ustunlar chegarasi — suriladi. `separator` roli va o'q
            tugmalari bilan: sichqonchasiz terminalda ham ishlasin. */}
        <div className="kassa-split" role="separator" aria-orientation="vertical"
             tabIndex={0} aria-label={t("kassa.resizeHint")}
             aria-valuenow={rightW} aria-valuemin={MIN_RIGHT_W} aria-valuemax={MAX_RIGHT_W}
             title={t("kassa.resizeHint")}
             onPointerDown={dragSplit} onKeyDown={nudgeSplit}>
          <span className="kassa-split__grip" aria-hidden="true" />
        </div>

        {/* ════ O'NG: Savat + To'lov ════ */}
        <div className="kassa-right">
          <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* ════ SAVAT SARLAVHASI = TABLAR ════

                ⚠ «Savat (2)» yozuvi OLIB TASHLANDI va uning qatori tablar
                bilan birlashtirildi. Ikkisi bir xil narsani aytardi —
                tabning o'zida tovar soni ham, summasi ham turibdi — va
                shu takror savat ro'yxatidan bir qator balandlik o'g'irlardi.

                ⚠ TAB DOIM KO'RINADI, bitta savatda ham. Yashirilsa, kassir
                bu imkoniyat borligini bilmasdi — «+» ni faqat kerak bo'lganda
                ko'rish uchun avval kerakligini bilish kerak bo'lardi.

                Har tabda MIJOZ NOMI yoki raqam, tovar soni va summa turadi:
                qaytib kelgan mijozning savatini kassir summasidan taniydi. */}
            <div className="cart-head">
              {/* ⚠ `role="tablist"` EMAS, `role="group"`. ARIA da tablist ning
                  bevosita bolalari FAQAT `role="tab"` bo'lishi shart, bu
                  yerda esa har tabning ichida yopish tugmasi ham bor
                  (tugma ichiga tugma qo'yib bo'lmaydi, demak o'rash
                  kerak). axe buni haqli ravishda buzilish deb belgiladi.

                  Ochiq savat `aria-current` bilan aytiladi — bu ro'yxatdagi
                  «hozir shu» ma'nosini beradigan to'g'ri atribut. */}
              <div className="cart-tabs" role="group" aria-label={t("kassa.carts")}>
                {carts.map((c, i) => {
                const on = c.id === active.id;
                return (
                  <div key={c.id} className={`cart-tab ${on ? "is-on" : ""}`}>
                    <button type="button" aria-current={on ? "true" : undefined}
                            className="cart-tab__pick"
                            onClick={() => switchCart(c.id)}>
                      <span className="cart-tab__name">
                        {c.customer?.name || t("kassa.cartN", { n: i + 1 })}
                      </span>
                      <span className="cart-tab__sum ek-num">
                        {c.items.length
                          ? `${c.items.length} × ${money(cartStore.totalOf(c.items))}`
                          : t("kassa.cartEmpty")}
                      </span>
                    </button>
                    {/* Yopish tugmasi FAQAT ochiq tabda: yopilmaydigan
                        savatning ustidagi «×» tasodifan bosiladigan
                        tugmadan boshqa narsa emas. */}
                    {on && (carts.length > 1 || c.items.length > 0) && (
                      <button type="button" className="cart-tab__x"
                              onClick={() => dropCart(c.id)}
                              aria-label={t("kassa.closeCart")} title={t("kassa.closeCart")}>
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Tozalash tablardan TASHQARIDA: tablar yon tomonga
                  suriladi va surilib ketadigan «Tozalash» tugmasi
                  topilmay qolardi. */}
              {cart.length > 0 && (
                <button className="btn btn-sm cart-head__clear" onClick={handleClearCart}>
                  <i className="fa-solid fa-trash" aria-hidden="true" /> {t("common.reset")} <span className="kbd">Esc</span>
                </button>
              )}
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <Empty icon="fa-barcode" text={t("kassa.scanPrompt")} />
              ) : (
                cart.map((item) => (
                  <div
                    className={`cart-item ${item._added ? "ek-row-in" : ""} ${item._pulse ? "ek-pop" : ""}`}
                    key={`${item.id}-${item._pulse || item._added || 0}`}
                  >
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      {/* Tarozili tovarda "0.35 kg × 95 000" — faqat jami
                          summani ko'rsatish kassirni ham, mijozni ham
                          tekshirish imkonidan mahrum qilardi. */}
                      <div className="cart-item-price ek-num">
                        {isDivisible(item)
                          ? `${fmtQty(item.qty, item.unitDecimals)} ${unitLabel(item.unit)} × ${money(item.salePrice)}`
                          : money(item.salePrice)}
                      </div>
                    </div>
                    <div className="qty-ctrl">
                      <button className="qty-btn" aria-label={t("kassa.decrease")} onClick={() => updateQty(item.id, -1)}>−</button>
                      {/* ⚠ SON BOSILADI. Ilgari bu oddiy `<span>` edi va
                          donalab tovarda miqdorni oshirishning yagona yo'li
                          «+» bo'lgan: 200 dona qog'oz sochiq sotish uchun
                          kassir «+» ni 200 marta bosishi kerak edi. Endi
                          sonning ustiga bosilsa miqdor oynasi ochiladi va
                          qiymat yoziladi — kasrli birlikda ham, donada ham. */}
                      <button
                        className="qty-num qty-num--edit"
                        onClick={() => editQty(item)}
                        disabled={!!item.markingGroup}
                        title={item.markingGroup ? t("kassa.qtyFromLabels") : t("kassa.enterQuantity")}
                        aria-label={`${item.name} — ${t("kassa.enterQuantity")}`}
                      >
                        {fmtQty(item.qty, item.unitDecimals)}
                      </button>
                      <button className="qty-btn" aria-label={t("kassa.increase")} onClick={() => updateQty(item.id, +1)}>+</button>
                    </div>
                    <button className="btn-icon danger" aria-label={`${item.name} — o'chirish`} onClick={() => removeFromCart(item.id)}>
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
            {/* ⚠ MIJOZ SAVATNING ICHIDA, alohida kartochkada emas.

                Ikki sabab. Birinchisi — MA'NO: mijoz endi har savatga
                alohida biriktiriladi, ya'ni u savatning bir qismi.
                Ikkinchisi — JOY: alohida kartochka o'z chekkasi, soyasi
                va oraliq bo'shlig'i bilan ustundan 70+ piksel olardi va
                o'sha piksellar savat ro'yxatidan yeyilardi. */}
            <div className="cart-cust">
            <Select
              block
              ariaLabel={t("kassa.customer")}
              placeholder={t("kassa.pickCustomer")}
              value={customer?.id ? String(customer.id) : ""}
              onChange={(v) => setCustomer(customers.find((c) => String(c.id) === v) || null)}
              options={[
                { value: "", label: t("kassa.noCustomer"), icon: "fa-user-slash" },
                ...customers.map((c) => ({
                  value: String(c.id),
                  label: `${c.fullName} · ${c.phone}`,
                  icon: "fa-user",
                })),
              ]}
            />

            {/* ── Sodiqlik darajasi ────────────────────────────────────
                Kassir mijozga aytishi uchun: chegirmasi qancha va keyingi
                darajagacha qancha qolgan. Chegirmani KASSIR QO'LLAMAYDI —
                uni server chek yozilganda o'zi hisoblaydi; bu yer faqat
                ko'rsatadi. */}
            {customer && tier && (
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                fontSize: 13,
              }}>
                <span>
                  <i className="fa-solid fa-award" style={{ color: "var(--fg-warning)", marginRight: 6 }} />
                  {tier.tierName
                    ? <>{tier.tierName} · <b>{tier.discountPercent}%</b></>
                    : <span className="text-muted">{t("loyalty.noTier")}</span>}
                </span>
                {tier.toNextTier != null && (
                  <span className="text-muted mono" style={{ fontSize: 12 }}>
                    {t("loyalty.toNext")}: {money(tier.toNextTier)}
                  </span>
                )}
              </div>
            )}

            {/* ── Ball ishlatish ──────────────────────────────────────
                Faqat balans ham, chegara ham noldan katta bo'lganda
                ko'rinadi: bo'sh maydon kassirni «nega ishlamayapti»
                degan savolga qo'yardi. */}
            {customer && bonusAvail > 0 && (
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span>
                    <i className="fa-solid fa-coins" style={{ color: "var(--fg-warning)", marginRight: 6 }} />
                    {t("bonus.balance")}: <b className="mono">{money(tier.bonusBalance)}</b>
                  </span>
                  <button type="button" className="btn btn-outline btn-sm"
                          onClick={() => setBonusUse(String(bonusAvail))}>
                    {t("bonus.useMax")}
                  </button>
                </div>
                {/* Muddat (V30): kassir mijozga aytadi — «shuncha balingiz
                    oy ichida kuyadi, ishlatib qoling». Sotuvni ham oshiradi,
                    kuyish ham kutilmagan bo'lmaydi. */}
                {Number(tier?.bonusExpiringSoon) > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: "var(--fg-warning)" }}>
                    <i className="fa-solid fa-hourglass-half" style={{ marginRight: 5 }} aria-hidden="true" />
                    {t("bonus.expiringSoon", { amount: money(tier.bonusExpiringSoon) })}
                  </div>
                )}
                <NumField kind="int"
                  className="form-input ek-num" max={bonusAvail}
                  style={{ marginTop: 8 }}
                  value={bonusUse}
                  onChange={(e) => setBonusUse(e.target.value)}
                  placeholder={t("bonus.usePh", { max: money(bonusAvail) })}
                />
              </div>
            )}
          </div>

          </div>

          <div className="total-card">
            {/* ⚠ Miqdorlar YIG'ILMAYDI: 2 dona + 0.35 kg = "2.35" degan
                raqam ma'nosiz va chalg'ituvchi bo'lardi. Savatdagi SATRLAR
                soni ko'rsatiladi. */}
            <div className="total-row">
              <span>{t("products.title")}</span>
              <span className="ek-num">{cart.length}</span>
            </div>
            <div className="total-big">
              <span>{t("common.total").toUpperCase()}</span>
              <span className="ek-num">{money(total)}</span>
            </div>

            <button className="btn btn-green btn-full btn-pos" style={{ marginTop: 10 }} onClick={openPayModal} disabled={!cart.length}>
              <i className="fa-solid fa-wallet" aria-hidden="true" />
              {t("kassa.checkout")} <span className="kbd">F9</span>
            </button>
          </div>
        </div>
      </div>

      {/* ════ Markirovka yorliqlari (tamaki, alkogol, suv…) ════ */}
      {markModal && (
        <MarkingScanModal
          product={markModal.product}
          mode="sale"
          onDone={applyMarkingCodes}
          onClose={() => { setMarkModal(null); focusBarcode(); }}
        />
      )}

      {/* ════ Miqdor kiritish (tarozili tovar) ════ */}
      {qtyModal && (
        <QuantityModal
          product={qtyModal.product}
          /* Boshqa savatlarda band bo'lgan miqdor AYIRILGAN qoldiq:
             oynada «omborda 3 ta» deb turib, tasdiqlashda «yetmaydi»
             deyish kassirni ishonchdan mahrum qilardi. */
          stock={freeStock(qtyModal.product)}
          initial={qtyModal.initial}
          onConfirm={applyQuantity}
          onClose={() => { setQtyModal(null); focusBarcode(); }}
        />
      )}

      {/* ════ Bekor qilish (undo) ════ */}
      {undo && (
        <div className="ek-undo ek-toast-in" role="status" aria-live="polite">
          <span>{undo.item.name} o'chirildi</span>
          <button onClick={restoreUndo}>{t("kassa.undo")}</button>
        </div>
      )}

      {/* ════ TO'LOV MODALI ════ */}
      {showPayModal && (
        <div className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true" aria-label={t("kassa.pay")}>
          <div className="pay-modal-box ek-dialog">
            <div className="pay-modal-header">
              <div className="pay-modal-title">
                <i className="fa-solid fa-cash-register" aria-hidden="true" />
                {t("kassa.pay")}
              </div>
              <button className="pay-modal-close" onClick={closePayModal} aria-label={t("common.close")}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="pay-modal-body">
              <div className="pay-modal-total">
                <div className="pay-modal-total-label">{t("kassa.grandTotal")}</div>
                <div className="pay-modal-total-value ek-num">{money(total)}</div>
                <div className="pay-modal-total-qty">
                  <span className="ek-num">{cart.length}</span> xil mahsulot
                </div>
              </div>

              {/* ── Chegirma ────────────────────────────────────────────
                  To'lov turidan OLDIN: chegirma jamini o'zgartiradi, ya'ni
                  kassir avval yakuniy summani ko'rib, keyin to'lovni
                  qabul qilishi kerak. Chegara oshsa server bajik so'raydi. */}
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-tag" aria-hidden="true" /> {t("kassa.discount")}
              </div>
              <NumField kind="money" max={subtotal}
                className="form-input pay-mixed-input ek-num"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
              {discountNum > 0 && (
                <div className="pay-modal-hint">
                  {money(subtotal)} − {money(discountNum)}
                </div>
              )}
              {/* ⚠ Ball to'lov oynasida ham ko'rinadi: kassir yakuniy
                  summani aytishdan oldin nima hisobidan kamayganini
                  bilishi kerak — mijoz albatta so'raydi. */}
              {bonusNum > 0 && (
                <div className="pay-modal-hint">
                  <i className="fa-solid fa-coins" style={{ color: "var(--fg-warning)", marginRight: 4 }} />
                  {t("bonus.used")}: −{money(bonusNum)}
                </div>
              )}

              <div className="pay-modal-section-label">
                <i className="fa-solid fa-credit-card" aria-hidden="true" /> To'lov turini tanlang
              </div>
              <div className="pay-modal-types">
                {PAY_METHODS.map(({ key, label, icon, color, kbd }) => (
                  <button
                    key={key}
                    className={`pay-type-btn ${payType === key ? "active" : ""}`}
                    onClick={() => handlePayTypeChange(key)}
                    aria-pressed={payType === key}
                    style={{ "--pay-color": color }}
                  >
                    <div className="pay-type-icon"><i className={`fa-solid ${icon}`} aria-hidden="true" /></div>
                    <div className="pay-type-label">{label}</div>
                    {kbd && <span className="kbd">{kbd}</span>}
                  </button>
                ))}
              </div>

              {/* ── NAQD: olingan summa → qaytim avtomatik ── */}
              {payType === "CASH" && (
                <div style={{ marginTop: 18 }}>
                  <label className="form-label" htmlFor="given">{t("kassa.received")}</label>
                  <NumField kind="money"
                    id="given"
                    className="form-input pay-mixed-input"
                    value={cashGiven}
                    autoFocus
                    onChange={(e) => setCashGiven(e.target.value)}
                    placeholder={String(total)}
                  />
                  <div className="ek-quick-cash">
                    {[50000, 100000, 200000].map((v) => (
                      <button key={v} type="button" onClick={() => setCashGiven(String(v))}>
                        {v.toLocaleString("uz-UZ")}
                      </button>
                    ))}
                    <button type="button" onClick={() => setCashGiven(String(total))}>{t("kassa.exactAmount")}</button>
                  </div>
                  {Number(cashGiven) > 0 && (
                    <div className="ek-change">
                      <span className="ek-change__label">{t("kassa.change")}</span>
                      <span className="ek-change__value">{money(change)}</span>
                    </div>
                  )}
                  {!cashOk && (
                    <div className="pay-mixed-warn ek-shake">
                      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Olingan summa jamidan kam
                    </div>
                  )}
                </div>
              )}

              {/* ── KARTA: terminal tasdig'ini kutish ── */}
              {payType === "CARD" && (
                <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--bg-brand-subtle)", border: "1px solid var(--border-brand)", borderRadius: "var(--r-lg)", color: "var(--fg-brand)", fontWeight: 600, fontSize: 13 }}>
                  <Spinner />
                  Terminal tasdig'ini kuting, so'ng t("kassa.sellAndPrint") ni bosing
                </div>
              )}

              {/* ── ARALASH ── */}
              {payType === "MIXED" && (
                <div className="pay-mixed-section">
                  <div className="pay-mixed-label" style={{ color: "var(--fg-secondary)", marginBottom: 10 }}>
                    <i className="fa-solid fa-shuffle" aria-hidden="true" /> Naqd + qolgan qismi:
                  </div>
                  <div className="pay-mixed-second-types">
                    {MIXED_SECOND.map(({ key, label, icon, color }) => (
                      <button
                        key={key}
                        className={`pay-mixed-second-btn ${mixedSecondType === key ? "active" : ""}`}
                        onClick={() => setMixedSecondType(key)}
                        aria-pressed={mixedSecondType === key}
                        style={{ "--pay-color": color }}
                      >
                        <i className={`fa-solid ${icon}`} aria-hidden="true" />{label}
                      </button>
                    ))}
                  </div>

                  <div className="pay-mixed-row" style={{ marginTop: 14 }}>
                    <div className="pay-mixed-field">
                      <label className="pay-mixed-label" htmlFor="mx-cash" style={{ color: "var(--fg-success)" }}>
                        <i className="fa-solid fa-money-bill-1" aria-hidden="true" /> Naqd (so'm)
                      </label>
                      <NumField kind="money"
                        id="mx-cash"
                        className="form-input pay-mixed-input"
                        style={{ borderColor: "var(--border-success)", color: "var(--fg-success)" }}
                        value={cashAmount}
                        onChange={(e) => {
                          setCashAmount(e.target.value);
                          setCardAmount(String(Math.max(0, total - (Number(e.target.value) || 0))));
                        }}
                      />
                    </div>
                    <div className="pay-mixed-field">
                      <label className="pay-mixed-label" htmlFor="mx-card" style={{ color: "var(--fg-brand)" }}>
                        <i className="fa-solid fa-credit-card" aria-hidden="true" />
                        {paymentLabel(mixedSecondType)} (so'm)
                      </label>
                      <NumField kind="money"
                        id="mx-card"
                        className="form-input pay-mixed-input"
                        style={{ borderColor: "var(--border-brand)", color: "var(--fg-brand)" }}
                        value={cardAmount}
                        onChange={(e) => {
                          setCardAmount(e.target.value);
                          setCashAmount(String(Math.max(0, total - (Number(e.target.value) || 0))));
                        }}
                      />
                    </div>
                  </div>
                  {!mixedOk && total > 0 && (
                    <div className="pay-mixed-warn">
                      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                      Yig'indi <span className="ek-num">{mixedSum.toLocaleString("uz-UZ")}</span> —
                      jami <span className="ek-num">{total.toLocaleString("uz-UZ")}</span> bilan teng bo'lishi kerak
                    </div>
                  )}
                </div>
              )}
              {/* Nasiyada mijoz tanlanmagan bo'lsa — nima qilish kerakligini
                  AYTAMIZ. Tugmani jimgina o'chirib qo'yish kassirni
                  "nega ishlamayapti" deb qidirishga majbur qilardi. */}
              {payType === "CREDIT" && !customer && (
                <div className="pay-mixed-warn">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                  {t("credit.customerRequired")}
                </div>
              )}
            </div>

            <div className="pay-modal-footer">
              <button className="btn btn-outline" onClick={closePayModal} disabled={processing}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Orqaga
              </button>
              {/* Yuklanayotganda kenglik o'zgarmaydi — matn o'rnini spinner egallaydi */}
              <button
                className="btn btn-green btn-pos pay-modal-submit"
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-loading={processing || undefined}
              >
                {processing
                  ? <><Spinner /> Bajarilmoqda…</>
                  : <><i className="fa-solid fa-receipt" aria-hidden="true" /> Sotish va Chek <span className="kbd">F9</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ YAKUNLASH: chek chiqmoqda → ✓ ════ */}
      {finish && (
        <FinishOverlay
          phase={finish.phase}
          total={finish.total}
          receiptNo={finish.receiptNo}
          onClose={finish.phase === "done" ? () => { setFinish(null); focusBarcode(); } : undefined}
        />
      )}
    </div>
  );
}
