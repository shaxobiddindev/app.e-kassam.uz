import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, customerApi, saleApi, securityApi, shopApi, mediaApi, fiscalApi, loyaltyApi } from "../api";
import { useBadge } from "../context/BadgeProvider";
import { useConfirm } from "../context/ConfirmProvider";
import { money, quantity as fmtQty } from "../utils";
import { unitLabel } from "../lib/ek-labels";
import ProductTile from "../components/ProductTile";
import QuantityModal from "../components/QuantityModal";
import LinePriceModal from "../components/LinePriceModal";
import MarkingScanModal from "../components/MarkingScanModal";
import { Empty, ClearButton } from "../components/ui";
import { useKeyboard } from "../context/KeyboardProvider";
import { clear as clearField } from "../lib/ek-keys";
import { isTouch } from "../lib/ek-touch";
import { FinishOverlay, SkeletonTiles, Spinner } from "../components/ek/Loading";
import Overlay from "../components/ek/Overlay";
import { layerCount } from "../lib/modal-stack";
import { FISCAL_UI } from "../config";
import OfflineBar from "../components/OfflineBar";
import ShiftBar from "../components/ShiftBar";
import * as queue from "../lib/ek-offline";
import * as cartStore from "../lib/ek-cart-store";
import { PAYMENT_TYPE, paymentLabel } from "../lib/ek-labels";
import { shortDate } from "../lib/ek-format";
import { useLoading } from "../lib/use-loading";
import Modal from "../components/Modal";
import { PhoneField } from "../components/ek/EkFields";
import Select from "../components/ek/Select";
import { printReceipt, openDrawer } from "../lib/ek-hardware";
import FacetFilter from "../components/ek/FacetFilter";
import { KASSA_KEYS, keyLabel, resolve as resolveKey } from "../lib/ek-kassa-keys";
import { settle, payType as payTypeOf, restFor } from "../lib/ek-payment";
import { spreadDiscount, roundingOffers, budgetOffers, cartRoom,
         cartLossRoom, discountVerdict } from "../lib/ek-discount";
import { useScanner } from "../hooks/useScanner";
import { rankLocal, looksLikeCode } from "../lib/ek-search";
import { useTileMetrics } from "../hooks/useTileMetrics";
import { isDesktop } from "../lib/ek-desktop";
import { NumField } from "../components/ek/EkFields";

/* ══════════════════════════════════════════════════════════════════════════
   Kassir paneli — 06-APP-KASSIR.md

   Asosiy stsenariy 3 ta harakat:  skaner → to'lov turi → yakunlash (F9).
   Sichqoncha ixtiyoriy; hamma narsa klaviatura bilan ishlaydi.

   ⚠ KLAVIATURA YORLIQLARI BU YERDA SANALMAYDI — ular
   `lib/ek-kassa-keys.js` dagi YAGONA jadvalda (V57). Ilgari ro'yxat shu
   izohda, ishlovchida va tugmalar yonidagi belgilarda alohida yashardi
   va allaqachon bir-biriga to'g'ri kelmay qolgan edi (shu izohning
   o'zida F2 ikki xil vazifa bilan yozilgan edi). Endi uchalasi ham
   o'sha bitta jadvaldan o'qiydi va kassir `?` bosib to'liq ro'yxatni
   ko'radi.
   ══════════════════════════════════════════════════════════════════════════ */

/* To'lov usullari — nom, ikonka va rang YAGONA lug'atdan (ek-labels.js).
   Ilgari ular shu faylda qo'lda yozilgan edi va sotuvlar tarixida Click/Payme
   tarjimasiz chiqardi. Klaviatura yorliqlari faqat shu ekranga tegishli,
   shuning uchun ular bu yerda qo'shiladi. */
/* ⚠ Jadvaldan olinadi, qo'lda yozilmaydi — yorliq o'zgarsa tugmadagi
   belgi ham o'zi o'zgaradi. */
/* ⚠ ENDI YORLIQLAR JOYIGA MOS: F1 Naqd · F2 Karta · F3 Click · F4
   Payme. Ilgari F3 «Aralash», F4 «Nasiya» edi va ikkalasi ham
   ro'yxatdan chiqdi — bo'shagan joyni Click va Payme egalladi.
   Kassirning barmog'i uchun F1 va F2 o'z joyida qoldi. */
const PAY_KBD = {
  CASH: keyLabel("payCash"), CARD: keyLabel("payCard"),
  CLICK: keyLabel("payClick"), PAYME: keyLabel("payPayme"),
};
const payItem = (key) => {
  const p = PAYMENT_TYPE[key];
  return { key, label: p.label, icon: p.icon, color: p.color, kbd: PAY_KBD[key] };
};
/* ══ TO'LOV USULLARI (V58) ═══════════════════════════════════════════
   ⚠ «ARALASH» VA «NASIYA» BU RO'YXATDA YO'Q va ikkalasi ham ataylab.

   «Aralash» alohida TUR bo'lishi kassirdan OLDINDAN qaror talab
   qilardi: «bu chek aralashmi?». Amalda u buni bilmaydi — mijoz avval
   «20 mingi naqd» deydi, qolgani haqida keyin gaplashadi. Endi har
   chek shunday ishlaydi: usul tanlanadi, summa yoziladi, qolgani
   o'z-o'zidan nasiyaga tushadi.

   «Nasiya» ham tugma emas: u YOZILMAGAN qismning o'zi. Tugma
   qoldirilsa, bitta ish uchun ikki yo'l bo'lardi — o'sha eski
   chalkashlik.

   Hisobotdagi «Aralash» esa QOLADI (`ek-payment.js` → `payType`):
   ekrandagi tur bilan hisobotdagi tur boshqa-boshqa narsa. */
const PAY_METHODS = ["CASH", "CARD", "CLICK", "PAYME"].map(payItem);

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
/* ⚠ CHEGARALAR KENGAYTIRILDI (foydalanuvchi so'rovi: «savat oynasi
   maksimal kengaysin»). Savatdan mijoz bloki ham, tablar ham chiqib
   ketdi — ya'ni endi u FAQAT tovarlar ro'yxati va unga qancha keng joy
   berilsa, qator shuncha to'liq o'qiladi (uzun nom qisqarmaydi, narx
   va miqdor bir qatorga sig'adi). */
const MIN_RIGHT_W = 340;
const MAX_RIGHT_W = 760;
const clampRight = (w, layoutW) =>
  Math.round(Math.max(MIN_RIGHT_W, Math.min(w, MAX_RIGHT_W, layoutW * 0.62)));

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
  /* ══ TO'LOV (V58) ═══════════════════════════════════════════════════
     ⚠ `payType` VA `split` O'RNIGA IKKI HOLAT. Ilgari to'lov turi
     («CASH» yoki «MIXED») va aralash qatorlar ro'yxati alohida
     yashardi; ikkalasini sinxron ushlab turish har o'zgarishda qo'lda
     ish edi va aynan shu yerdan xatolar chiqardi.

     Endi bitta lug'at yetadi: qaysi usulga qancha yozilgan. Chekning
     TURI undan hisoblanadi (`ek-payment.js` → `payType`), ya'ni u
     saqlanadigan holat emas — hosila. */
  const [paid, setPaid] = useState({});
  /** Bitta maydon hozir qaysi usulni tahrirlayapti. */
  const [payFocus, setPayFocus] = useState("CASH");
  const customer = active.customer;
  const setCustomer = (c) => patchCart(active.id, { customer: c });
  /* Mijozning sodiqlik darajasi — faqat KO'RSATISH uchun. Chegirmani
     server chek yozilganda o'zi hisoblaydi; bu yerdagi raqam hisobga
     ta'sir qilmaydi va shunday bo'lishi ham kerak: front hisoblagan
     chegirma kassir tomonidan o'zgartirilishi mumkin bo'lardi. */
  const [tier, setTier]             = useState(null);
  /* Ball: kassir kiritgan summa + do'kon chegarasi (foizda).

     ⚠ SAVATNING O'ZIDA (V57) — `customer` bilan bir qatorda. Sahifa
     holatida turganida tab almashtirilganda ikkinchi mijozga
     birinchisining ballari ko'chib o'tardi. */
  const bonusUse = active.bonusUse ?? "";
  const setBonusUse = (v) => patchCart(active.id, { bonusUse: v });
  /* Kassadan yangi mijoz qo'shish (V47) — `null` bo'lsa oyna yopiq. */
  const [newCust, setNewCust] = useState(null);
  const [savingCust, setSavingCust] = useState(false);
  const [bonusMaxPercent, setBonusMaxPercent] = useState(0);
  /* ⚠ NASIYA YOQILGANMI. Do'kon uni butunlay o'chirib qo'ygan bo'lishi
     mumkin; tugmani baribir ko'rsatish kassirni serverdan rad javob
     oladigan yo'lga boshlardi — u esa sababini ekranda ko'rmasdi. */
  const [creditEnabled, setCreditEnabled] = useState(true);
  /* Nasiya muddati, kunlarda (V43) — chekdagi «to'lash muddati» uchun.
     ⚠ SAHIFA holatida: bu DO'KON sozlamasi (`creditDueDays`), savatning
     xususiyati emas — kassir uni tahrirlamaydi. */
  const [dueDays, setDueDays] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [branchId]                  = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [finish, setFinish]         = useState(null);   // { phase, total, receiptNo }
  const [undo, setUndo]             = useState(null);   // { item, index }
  /* Barkod maydoni boshqarilmaydi (skaner unga to'g'ridan-to'g'ri yozadi va
     Enter'da o'zi tozalanadi). «×» tugmasi esa qiymat BORLIGINI bilishi
     kerak — shuning uchun faqat shu bayroq holatda saqlanadi. */
  /* Chek chegirmasi — SUMMA. Kassir foizni emas, summani kiritadi:
     "5 000 so'm chegirma" mijoz bilan gaplashishda tabiiyroq va chekda
     ham summa turadi. Server chegarani foizga aylantirib tekshiradi. */
  /* ⚠ SAVATNING O'ZIDA (V57). Ilgari sahifa holatida edi va ikkita
     xato berardi: tab almashtirilganda chegirma ikkinchi mijozga
     ko'chardi, F5 da esa savat tiklanib chegirma yo'qolardi. */
  const discount = active.discount ?? "";
  const setDiscount = (v) => patchCart(active.id, { discount: v });
  /* ⚠ «Bermoqchi bo'lgan ENG KO'P chegirma» — chegirmaning O'ZI EMAS.
     Kassir shu maydonga yozadi, tizim esa shundan oshmaydigan yaxlit
     variantlarni taklif qiladi. Tanlanmaguncha chekka hech narsa
     tushmaydi: bu maydon niyat, chegirma esa qaror. */
  const [discBudget, setDiscBudget] = useState("");
  /* ⚠ TANLANGAN SAVAT QATORI — klaviatura bilan ishlash uchun (V57).
     Sensorsiz monoblokda «−», «+», narx va «✕» tugmalariga yetish
     uchun har safar sichqonchani olish kerak edi. Endi qator ↑/↓ bilan
     tanlanadi va o'sha tugmalar klaviaturadan bosiladi.

     ⚠ INDEKS EMAS, `id` SAQLANADI: savatda tovar qo'shilganda tartib
     o'zgaradi va indeks boshqa qatorga «sirg'alib» ketardi — kassir
     ko'zi bilan bir qatorni ko'rib, boshqasini o'chirgan bo'lardi. */
  const [pickedId, setPickedId] = useState(null);
  /* Yorliqlar ro'yxati (`?`) — `null` bo'lsa yopiq. */
  const [keysOpen, setKeysOpen] = useState(false);

  /* ══ KO'P TANLOVLI FILTR (V57) ═══════════════════════════════════════
     ⚠ QURILMADA SAQLANADI — kategoriya tabi bilan bir xil sabab: kassir
     kun bo'yi bitta bo'limda ishlaydi («ayollar, qishki») va har
     qaytganda uni qaytadan belgilash kuniga o'nlab ortiqcha bosish edi.

     ⚠ Buzuq yozuvda BO'SH filtr: eski yoki qo'lda o'zgartirilgan
     yozuv butun katalogni ko'rinmas qilib qo'yardi va kassir sababini
     topa olmasdi. */
  const [filter, setFilter] = useState(() => {
    try {
      const raw = localStorage.getItem("ek_kassaFilter");
      const v = raw ? JSON.parse(raw) : null;
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (_) { return {}; }
  });
  const [facets, setFacets] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  /** Nechta katakcha belgilangan — tugmadagi belgi uchun. */
  const filterCount = useMemo(
    () => Object.values(filter).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0),
    [filter],
  );

  useEffect(() => {
    try {
      if (filterCount > 0) localStorage.setItem("ek_kassaFilter", JSON.stringify(filter));
      else localStorage.removeItem("ek_kassaFilter");
    } catch (_) { /* shaxsiy rejim — saqlanmasa ham kassa ishlaydi */ }
  }, [filter, filterCount]);

  /* Filtr katakchalari — do'konda haqiqatan mavjud qiymatlar.
     Xatosi JIM yutiladi: filtr — qulaylik, sotuvning sharti emas. */
  useEffect(() => {
    productApi.getFacets(branchId)
      .then((r) => setFacets(r.data || null))
      .catch(() => setFacets(null));
  }, [branchId]);
  const keyboard                    = useKeyboard();
  const touchOn                     = isTouch();
  const confirm                     = useConfirm();

  /* ── Katalog ko'rinishi ────────────────────────────────────────
     Kategoriya tabi va ikki ko'rinish (rasmli / zich). Ko'rinish
     QURILMADA saqlanadi: bitta do'konda kassa va omborchining
     ekranlari har xil bo'lishi mumkin, va tanlov har kirishda
     qaytadan qilinmasin. */
  const [categories, setCategories] = useState([]);
  /* ⚠ KATEGORIYA TABI VA «SEVIMLI» FILTRI QURILMADA SAQLANADI (V57).
     Do'kon egasining so'rovi: «kassa oynasini qanday holatda tark
     etsa, qaytganda ham shunday tursin — hatto qayta yuklashda ham».

     Kassir kun bo'yi bitta bo'limda ishlaydi (masalan «Ichimliklar»)
     va har qaytganda uni qaytadan tanlash — kuniga o'nlab ortiqcha
     bosish edi. Ko'rinish (`ek_kassaView`) va ustun kengligi
     (`ek_kassaRightW`) allaqachon shunday saqlanardi; bu ikkisi
     o'sha qatorga qo'shildi.

     ⚠ HISOBDA EMAS, QURILMADA: bitta hisob bilan kirilgan kassa
     monitori va omborchining noutbugi bir xil bo'lishi shart emas. */
  const [categoryId, setCategoryId] = useState(() => {
    const raw = localStorage.getItem("ek_kassaCategory");
    const n = Number(raw);
    return raw && Number.isFinite(n) && n > 0 ? n : null;   // null = hammasi
  });
  const [favOnly, setFavOnly]       = useState(
    () => localStorage.getItem("ek_kassaFav") === "1",
  );

  /* ⚠ Saqlash EFFEKTDA, `setCategoryId` o'ramida emas: tabni bosish
     bir necha joydan chaqiriladi (tugma, «hammasi», sevimlilar) va
     ularning birortasi unutilsa, saqlash jimgina ishlamay qolardi. */
  useEffect(() => {
    try {
      if (categoryId) localStorage.setItem("ek_kassaCategory", String(categoryId));
      else localStorage.removeItem("ek_kassaCategory");
    } catch (_) { /* shaxsiy rejim — saqlanmasa ham kassa ishlaydi */ }
  }, [categoryId]);

  useEffect(() => {
    try {
      if (favOnly) localStorage.setItem("ek_kassaFav", "1");
      else localStorage.removeItem("ek_kassaFav");
    } catch (_) { /* yuqoridagi bilan bir xil sabab */ }
  }, [favOnly]);
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
  /* Smena ochiqmi — `ShiftBar` xabar beradi. To'lov tugmasi yonidagi
     ogohlantirish shunga qarab chiziladi (`ShiftBar` izohiga qarang). */
  const [shiftOpen, setShiftOpen] = useState(true);
  const onShiftState = useCallback(({ open }) => setShiftOpen(open), []);

  const layoutRef = useRef(null);
  /* Tovar to'ri — rasm nisbatini saqlash uchun o'lchanadi. */
  const gridRef   = useRef(null);

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
  /* Qator narxini tushirish (V48) — `null` bo'lsa oyna yopiq. */
  const [priceModal, setPriceModal] = useState(null);
  const [markModal, setMarkModal]   = useState(null);   // { product } — DataMatrix

  const searchRef   = useRef(null);
  const debounceRef = useRef(null);
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
  /**
   * ⚠ BALL FAQAT SHU SAVAT ICHIDA mijoz almashganda tozalanadi (V57).
   *
   * Ilgari bu yerda shartsiz `setBonusUse("")` turardi. Ball savatning
   * o'ziga ko'chgach (tab almashtirilganda meros bo'lmasin deb) o'sha
   * shartsiz tozalash ikkita YANGI xatoni bergan bo'lardi:
   *
   *   · boshqa tabga o'tish «mijoz almashdi» deb qaralib, o'sha
   *     savatning o'z balli o'chib ketardi;
   *   · F5 dan keyin savat tiklanardi-yu, kassir yozgan ball
   *     yo'qolardi — ya'ni uni qaytadan yozish kerak edi.
   *
   * Shuning uchun oldingi holat (qaysi savat, qaysi mijoz) eslab
   * qolinadi va tozalash faqat HAQIQIY almashishda bo'ladi.
   */
  const custKeyRef = useRef(null);
  useEffect(() => {
    const cartId = active.id;
    const custId = customer?.id ?? null;
    const prev = custKeyRef.current;
    custKeyRef.current = { cartId, custId };
    if (prev && prev.cartId === cartId && prev.custId !== custId) setBonusUse("");

    if (!custId) { setTier(null); return; }
    let alive = true;
    loyaltyApi.customerTier(custId)
      .then((r) => { if (alive) setTier(r.data || null); })
      .catch(() => { if (alive) setTier(null); });
    return () => { alive = false; };
  }, [active.id, customer?.id]);


  /* ── Kategoriyalar va standart ko'rinish ───────────────────────
     Ko'rinish tanlanmagan bo'lsa faoliyat turidan olinadi: oziq-ovqatda
     zich ro'yxat (tovar barkod bilan tanlanadi va ekranga ko'proq
     sig'ishi kerak), kiyim/kosmetikada rasmli katakcha (tovar KO'RIB
     tanlanadi). Bu — standart, majburiyat emas. */
  useEffect(() => {
    productApi.getCategories(branchId)
      .then((r) => {
        const list = (r.data || []).filter((c) => c.productCount > 0);
        setCategories(list);
        /* ⚠ SAQLANGAN TAB HALI BORMI. Kategoriya o'chirilgan yoki
           tovarsiz qolgan bo'lsa, saqlangan raqam katalogni BO'SH
           ko'rsatib turardi va kassir sababini topa olmasdi. */
        setCategoryId((cur) => (cur && !list.some((c) => c.id === cur) ? null : cur));
      })
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
        setDueDays(Number(r?.data?.creditDueDays) || 0);
        setCreditEnabled(r?.data?.creditEnabled !== false);
        /* ⚠ STANDART KO'RINISH — RASMLI (foydalanuvchi qarori: «asosiy
           ko'rinish rasmli bo'lsin, zich emas»). Ilgari faqat kiyim va
           kosmetika do'konlariga rasmli berilardi, qolganiga zich
           ro'yxat — lekin zich ro'yxatda tovarni KO'RIB tanlab
           bo'lmaydi va ekran raqamlar devoriga aylanardi.

           Tanlov saqlanadi (`ek_kassaView`): zich ro'yxat kerak
           bo'lgan do'kon bir marta bosadi va shundayligicha qoladi. */
        setView((cur) => cur || "tiles");
      })
      .catch(() => {
        setBonusMaxPercent(0);
        setDueDays(0);
        /* ⚠ Xatoda nasiya YOPIQ deb hisoblanadi: bilmagan holatda
           qarz yozdirishga yo'l ochish, ochmaslikdan qimmatroq. */
        setCreditEnabled(false);
        setView((cur) => cur || "tiles");
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
        { categoryId, favorites: favOnly, ...filter });
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
  }, [branchId, categoryId, favOnly, filter, flagChanges]);

  /* Kategoriya, filtr yoki filial almashsa kesh yaroqsiz — ro'yxat boshqa. */
  useEffect(() => { baseProducts.current = null; }, [branchId, categoryId, favOnly, filter]);

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

  /* ══════════════════════════════════════════════════════════════════
     UCH BOSQICHLI QIDIRUV

     ⚠ NEGA BOSQICHLAR. Ilgari har harfda 350 ms kutilar, keyin serverga
     so'rov ketardi — ya'ni kassir yozib bo'lgach ham ro'yxat yarim
     soniya eski holatda turardi. Sekin tarmoqda bu bir necha soniyaga
     cho'zilardi va kassir mijoz oldida kutib qolardi.

       0-bosqich (0 ms) — ANIQ KOD. Yozilgani yuklangan tovarlardan
         birining barkodi yoki artikuliga aynan teng bo'lsa, u DARHOL
         savatga tushadi. Skaner aynan shu yo'ldan o'tadi.

       1-bosqich (0 ms) — MAHALLIY REYTING. Ekranda allaqachon turgan
         katalog `ek-search.js` qoidasi bilan saralanadi va shu zahoti
         ko'rsatiladi. Kassir uchun qidiruv «bir zumda» ishlaydi.

       2-bosqich (180 ms) — SERVER. To'liq katalog bo'yicha reytingli
         qidiruv (`pg_trgm`), natija mahalliysini almashtiradi.

     ⚠ Kutish 350 → 180 ms ga tushirildi: mahalliy javob bor ekan,
     server javobini uzoq kutib turishning ma'nosi qolmadi.
     ══════════════════════════════════════════════════════════════════ */
  const handleSearchChange = (val) => {
    setSearch(val);

    /* 1-bosqich: server javobini kutmasdan mahalliy saralash. Bo'sh
       so'rovda keshdagi to'liq ro'yxat qaytariladi. */
    const base = baseProducts.current;
    if (base) setProducts(val ? rankLocal(base, val) : base);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 180);
  };

  /**
   * Qidiruv maydonida Enter — BARKOD yoki TOVAR.
   *
   * ⚠ Bitta maydon ikkala vazifani bajaradi (alohida barkod maydoni
   * olib tashlangan). Ajratish mezoni — matnning O'ZI:
   *
   *   · faqat raqam va 6 tadan uzun → KOD (`addByBarcode`): u tarozi
   *     va qadoq barkodlarini ham biladi, oddiy qidiruv esa bilmaydi;
   *   · aks holda ro'yxatdagi ENG MOS tovar savatga tushadi.
   *
   * ⚠ Kod yo'lida maydon TOZALANADI: skanerdan keyin oldingi kod
   * qolib, keyingisi uning ustiga yozilib ketmasin.
   */
  const onSearchEnter = (e) => {
    if (e.key !== "Enter") return;
    const value = e.currentTarget.value.trim();
    if (!value) return;
    e.preventDefault();

    if (looksLikeCode(value)) {
      handleSearchChange("");
      addByBarcode(value);
      return;
    }
    /* ⚠ BIRINCHISI, «faqat bitta bo'lsa» EMAS. Ilgari Enter faqat
       ro'yxatda AYNAN BITTA tovar qolgandagina ishlardi — ya'ni
       kassir kerakli tovar birinchi turgan bo'lsa ham yozishda davom
       etishga majbur edi. Endi reyting bor va birinchi qator aynan
       eng mos tovar. */
    if (products.length > 0) pickProduct(products[0]);
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
    focusSearch();
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
    focusSearch();
  };

  const switchCart = (id) => { setActiveId(id); focusSearch(); };

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
  /* ⚠ Nomi `focusSearch`: barkod maydoni yo'q, qidiruv ikkalasini ham
     bajaradi. Fokus FAQAT odam so'raganda beriladi (Ctrl+B yoki «/»)
     yoki modal yopilganda — avto-fokus olib tashlangan. */
  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  /* ⚠ AVTO-FOKUS OLIB TASHLANDI (foydalanuvchi qarori: «unga skaner
     ishlatiladi, avtofokusga ehtiyoj sezmayapman»).

     Ilgari barkod maydoni sahifa ochilganda va har modal yopilganda
     o'ziga fokusni tortardi, fokus boshqa joyga o'tsa esa uch soniyadan
     keyin QAYTARIB olardi. Bu skanerga hech narsa qo'shmasdi — u
     hujjat darajasida tutiladi (`useScanner`) va fokus qayerda
     bo'lishidan qat'i nazar ishlaydi — lekin odamga xalal berardi:
     boshqa maydonga yozayotgan kassirning fokusi o'z-o'zidan ketardi.

     Fokus endi FAQAT odam so'raganda beriladi: maydonni bosganda yoki
     Ctrl+B bilan. */

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
    } catch (err) {
      /* ⚠ IKKI XIL XATO, ikki xil ish. 400 — kod ESKIRGAN (aylanma
         karta, V45): mijozdan ilovadagi ekranni qayta ko'rsatishni
         so'rash kerak, mijozni qidirish emas. Serverning matni aynan
         shuni aytadi, shuning uchun u o'zgartirilmasdan ko'rsatiladi.
         Qolgani — karta bu do'konga tegishli emas yoki o'chirilgan. */
      if (err?.status === 400 && err.message) toast.error(err.message);
      else toast.info(t("kassa.cardNotFound"));
    }
  };

  /**
   * KASSADAN YANGI MIJOZ (V47).
   *
   * ⚠ Qo'shilgan zahoti SAVATGA biriktiriladi: kassir uni qo'shib,
   * keyin ro'yxatdan qayta tanlashi ortiqcha qadam bo'lardi — mijoz esa
   * kassa oldida turibdi.
   */
  const saveNewCustomer = async () => {
    const name = (newCust?.fullName || "").trim();
    if (!name || !newCust?.phone) return;
    setSavingCust(true);
    try {
      const r = await customerApi.create({ fullName: name, phone: newCust.phone });
      const c = r?.data;
      if (c?.id) {
        setCustomers((prev) => [c, ...prev]);
        setCustomer(c);
      }
      setNewCust(null);
      /* ⚠ Serverning xabari ustun: arxivlangan mijoz qaytarilgan bo'lsa
         kassir buni bilishi kerak (izohi `CustomersPage` da). */
      toast.success(r?.message || t("cust.added"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCust(false);
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
  /* Rasm nisbatini saqlash — o'lchov `useTileMetrics` izohida. */
  useTileMetrics(gridRef, view === "tiles", [products.length, view]);

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
    const shortage = stockError(product, roundQty(product, inCart(product.id) + amount));
    if (shortage) { toast.error(shortage); return; }
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      // Bir xil tovar ikkinchi marta → miqdor oshadi, yangi satr yaratilmaydi
      if (exists) {
        const next = roundQty(product, exists.qty + amount);
        // Narxi tushirilgan qatorga yana bir dona qo'shilsa, chegirma
        // ham o'sha DONA narxida qoladi — quyidagi izohga qarang.
        return prev.map((i) => (i.id === product.id
          ? { ...i, qty: next, ...rescaleDiscount(i, next), _pulse: Date.now() }
          : i));
      }
      return [...prev, { ...product, qty: roundQty(product, amount), _added: Date.now() }];
    });
    resetSearch();
  };

  /** Kasrli qo'shishda 0.1 + 0.2 = 0.30000000000000004 bo'lmasin. */
  const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

  /**
   * Miqdorni TOVARNING BIRLIGIGA moslab yaxlitlaydi.
   *
   * ⚠ NEGA `round3` YETMAYDI. U hamma narsani uch kasr xonaga
   * yaxlitlaydi, ya'ni DONA tovarda `0.6` savatda `0.6` bo'lib
   * qolardi. Server esa uni jimgina `1` ga aylantirib, mijozdan butun
   * dona uchun pul olardi (foydalanuvchi shikoyati). Ya'ni ekranda bir
   * son, chekda boshqa son turardi.
   *
   * Endi savatga tushadigan qiymat serverning qoidasi bilan BIR XIL
   * bo'ladi va nima ko'rinsa, o'sha sotiladi.
   */
  const roundQty = (product, n) => {
    const d = product?.unitDecimals ?? 3;
    const p = 10 ** d;
    return Math.round((Number(n) + Number.EPSILON) * p) / p;
  };

  /* ⚠ «−» OXIRGI donani olib tashlasa, bu X tugmasi bilan AYNI amal —
     demak u ham bajik so'rashi shart. Ilgari bu yerda `.filter(qty > 0)`
     turardi va tovar jimgina yo'q bo'lardi: kassir X ni bosmasdan, «−» ni
     bir necha marta bosib qo'riqlovni butunlay aylanib o'tardi va jurnalda
     hech qanday iz qolmasdi.

     Endi miqdor 0 ga TUSHMAYDI — 1 dan pastga urinish qo'riqlanadigan
     `removeFromCart` ga yo'naltiriladi. Shu bilan savatdan chiqishning
     YAGONA yo'li qoladi va uni yopib qo'yish yetarli. */
  /* ⚠ QATOR CHEGIRMASI MIQDOR BILAN BIRGA QAYTA HISOBLANADI (V48).
     Chegirma qator bo'yicha JAMI summa, miqdor esa keyin o'zgarishi
     mumkin. Kassir 2 dona uchun narxni tushirib, keyin miqdorni 3 ga
     oshirsa, eski jami chegirma uch donaga tarqalib, dona narxi o'zidan
     o'zi yana arzonlashib ketardi. Shuning uchun kassir qo'ygan DONA
     narxi saqlanadi, jami esa yangi miqdorga qarab qayta olinadi. */
  const rescaleDiscount = (i, nextQty) => {
    const d = Number(i.discount) || 0;
    const q = Number(i.qty) || 0;
    if (d <= 0 || q <= 0) return {};
    // Chegirma qator jamisidan oshmasligi kerak — chek manfiyga tushmasin.
    const scaled = Math.round((d / q) * nextQty * 100) / 100;
    return { discount: Math.min(scaled, i.salePrice * nextQty) };
  };

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
        ? { ...i, markingCodes: rest, qty: rest.length, ...rescaleDiscount(i, rest.length) } : i)));
      return;
    }

    // Tarozili tovarda "+" bir kilogramm qo'shishi mantiqsiz — miqdor
    // oynasi ochiladi va kassir aniq qiymat kiritadi.
    if (isDivisible(item)) { setQtyModal({ product: item, initial: item.qty }); return; }

    const next = roundQty(item, item.qty + delta);
    if (next <= 0) { removeFromCart(id); return; }
    const shortage = stockError(item, next);
    if (shortage) { toast.error(shortage); return; }
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: next, ...rescaleDiscount(i, next) } : i)));
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
    const shortage = stockError(product, roundQty(product, value));
    if (shortage) { toast.error(shortage); return; }
    const exists = cart.find((i) => i.id === product.id);
    if (exists) {
      setCart((prev) => prev.map((i) => (i.id === product.id
        ? { ...i, qty: roundQty(product, value), ...rescaleDiscount(i, roundQty(product, value)), _pulse: Date.now() } : i)));
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

  /* Qatorning chegirmadan KEYINGI dona narxi — savatda shu ko'rinadi. */
  const unitPriceOf = (i) => {
    const q = Number(i.qty) || 0;
    const d = Number(i.discount) || 0;
    return q > 0 ? Math.max(0, i.salePrice - d / q) : i.salePrice;
  };
  /* ⚠ «Oraliq jami» — chegirmalardan OLDINGI summa (server ham shunday
     hisoblaydi): chek chegirmasi foizini aynan shundan olish kerak. */
  const subtotal = cart.reduce((sum, i) => sum + i.salePrice * i.qty, 0);
  /* Qator chegirmalari jami — to'lov oynasida alohida ko'rsatiladi. */
  const lineDiscounts = cart.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
  /* ⚠ QATOR CHEGIRMALARIDAN KEYINGI summa (V48) — chek chegirmasi
     AYNAN shundan olinadi. Serverda ham tartib shunday: avval qator
     chegirmalari, keyin chek chegirmasi. Aks holda ikkalasi bir xil
     bazadan hisoblanib, jami manfiyga tushib ketishi mumkin edi. */
  const afterLines = Math.max(0, subtotal - lineDiscounts);
  /* Chegirma savat jamidan oshib keta olmaydi — aks holda chek manfiy
     summaga aylanardi. Server ham buni rad etadi; bu yerdagi cheklov
     kassirga darhol ko'rinadigan javob berish uchun. */
  const discountNum = Math.max(0, Math.min(Number(discount) || 0, afterLines));
  const afterDiscount = afterLines - discountNum;
  /* ⚠ CHEGIRMA QAYSI TOVARGA QANCHADAN TUSHDI (V48).
     «Umumiy summadan 50 ming tushiray» deyilganda savol darhol
     tug'iladi: ertaga shu chekdan bitta tovar qaytarilsa, qancha pul
     qaytariladi? Server chek chegirmasini qatorlarga taqsimlaydi
     (`SaleService.distributeSaleDiscount`) va qaytarish AYNAN shu
     taqsimotdan hisoblanadi. Shuning uchun bu yerdagi hisob — o'sha
     qoidaning nusxasi (`ek-discount.js`): kassir uni to'lovdan OLDIN
     ko'radi va chekdagi raqamlar bilan bir xil chiqadi. */
  const discountSplit = useMemo(
    () => spreadDiscount(cart, discountNum),
    [cart, discountNum],
  );


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
  /* ── Yaxlitlash takliflari (V56) ──────────────────────────────────────
     ⚠ ALLAQACHON BERILGAN chegirmadan KEYINGI summadan hisoblanadi:
     kassir chegirma yozib, keyin yaxlitlashni bossa, ikkalasi
     qo'shilishi kerak. Bo'sh joy ham shu chegirmani hisobga oladi —
     aks holda taklif chegaradan oshib, bajik so'ratardi. */
  /* Chek chegirmasi TAQSIMLANGANDAN keyingi qatorlar — bo'sh joy shundan
     hisoblanadi, aks holda taklif allaqachon berilganini yana bir bor
     hisoblab, chegaradan oshib ketardi. */
  const linesAfterDisc = useMemo(
    () => cart.map((i, idx) => ({
      ...i,
      discount: (Number(i.discount) || 0) + (discountSplit[idx] || 0),
    })),
    [cart, discountSplit],
  );
  const liveTotal = Math.max(0, afterLines - discountNum - bonusNum);

  const roundOffers = useMemo(
    () => roundingOffers(linesAfterDisc, liveTotal),
    [linesAfterDisc, liveTotal],
  );

  /* ── Byudjetli takliflar (V57) ────────────────────────────────────────
     Kassir «shuncha bermoqchiman» deb yozadi, tizim esa shu summadan
     OSHMAYDIGAN, lekin jamini yaxlit qiladigan variantlarni beradi.
     Boshlang'ich nuqta — kassirning summasi, chekning qoldig'i emas. */
  const budgetNum = Math.max(0, Number(discBudget) || 0);
  const budgetPicks = useMemo(
    () => budgetOffers(linesAfterDisc, liveTotal, budgetNum),
    [linesAfterDisc, liveTotal, budgetNum],
  );

  /* ── Chegirma chegaralari ─────────────────────────────────────────────
     Ikkalasi BUTUN savatdan (qator chegirmalarini hisobga olib), chek
     chegirmasi esa hali qo'shilmagan holatda: kassir yozayotgan raqam
     aynan shu bo'shliqqa sig'ishi kerak. */
  const ruleRoom = useMemo(() => cartRoom(cart), [cart]);
  const lossLimit = useMemo(() => cartLossRoom(cart), [cart]);
  /** `"ok"` · `"over"` (rahbar tasdig'i) · `"loss"` (zararga sotish). */
  const discVerdict = useMemo(
    () => discountVerdict(cart, discountNum + budgetNum),
    [cart, discountNum, budgetNum],
  );

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

  /* ══ TO'LOV (V58) ═══════════════════════════════════════════════════

     Do'kon egasining so'zi bilan: «naqd tanlandi, 20 000 kiritildi,
     qolgani nasiyaga hisoblanib tursin; keyin Click tanlanadi, 15 000
     kiritiladi va yana qolgani nasiyaga». Ya'ni maydon BITTA va u
     tanlangan usulning summasini tahrirlaydi; yozilmagan qism esa
     o'z-o'zidan nasiya bo'ladi.

     Hisob-kitobning O'ZI bu yerda emas — `lib/ek-payment.js` da va u
     sinov bilan qulflangan (`test/payment.test.mjs`). Sabab: bu
     raqamlar CHEKKA va KASSAGA tushadi, bir tiyin xato smena oxirida
     hisobni buzadi. */
  const pay = useMemo(() => settle(paid, total), [paid, total]);

  /** Tanlangan usulning maydondagi qiymati. */
  const payValue = paid[payFocus] ?? "";

  /**
   * ⚠ USULNI TANLASH — QIYMATNI O'CHIRMAYDI. Kassir naqdga 20 000
   * yozib, Click ga o'tib, keyin naqdga QAYTSA, maydonda o'sha 20 000
   * turishi kerak (do'kon egasining talabi). Shuning uchun bu yerda
   * faqat fokus almashadi.
   */
  const focusMethod = (type) => setPayFocus(type);

  /** Maydonga yozilgan summa — tanlangan usulga. */
  const setPayValue = (v) =>
    setPaid((prev) => {
      const next = { ...prev };
      /* Bo'sh maydon — «bu usul ishlatilmadi». Nol yozib qoldirish
         chekda 0 so'mlik qatorni paydo qilardi. */
      if (v === "" || v == null) delete next[payFocus];
      else next[payFocus] = v;
      return next;
    });

  /** «Qolganini» — shu usulga qolgan summani yozadi (ustiga qo'shmaydi). */
  const fillRest = () => setPayValue(String(restFor(paid, total, payFocus)));

  /** Usulni butunlay olib tashlash. */
  const dropMethod = (type) =>
    setPaid((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });

  const openPayModal = () => {
    if (!cart.length) return;
    /* ⚠ OYNA «NAQD — BUTUN SUMMA» BILAN OCHILADI. Bo'sh ochilsa,
       yozilmagan chek BUTUNLAY nasiya bo'lardi va chalg'igan kassir
       «Sotish» ni bosib butun chekni qarzga yozib qo'yardi. Nasiya
       KAMAYTIRISH orqali paydo bo'lishi kerak — ataylab qilingan
       harakat bilan. */
    setPaid({ CASH: String(total) });
    setPayFocus("CASH");
    setDiscount("");
    setShowPayModal(true);
  };
  const closePayModal = () => setShowPayModal(false);

  /* Nasiya — MIJOZGA beriladigan qarz. Kimga berilganini bilmasdan
     yozib bo'lmaydi: server ham rad etadi, lekin kassir buni to'lov
     tugmasini bosishdan OLDIN ko'rishi kerak. */
  const creditPart = pay.credit;
  const creditOk   = creditPart <= 0 || !!customer;

  /* ⚠ NASIYA O'CHIRILGAN DO'KONDA qoldiq QOLMASLIGI shart: u yerda
     yozilmagan qismni yozadigan joy yo'q. Ilgari bu holat umuman
     bo'lmasdi — «Aralash» da qoldiq nolga tenglashtirilardi. */
  const creditBlocked = creditPart > 0 && !creditEnabled;

  /* ⚠ NAQDSIZ USULDA ORTIQCHA — XATO, qaytim emas: terminal aynan
     so'ralgan summani oladi. */
  const overOk = pay.over === 0;

  const canSubmit = cart.length > 0 && !processing
                    && creditOk && !creditBlocked && overOk;

  /* ── Sotuvni yakunlash ────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setProcessing(true);

    /* Chekning turi — hisobot uchun bitta so'z. */
    const saleType = payTypeOf(pay.parts);

    const payload = {
      idempotencyKey: queue.newIdempotencyKey(),
      customerId: customer?.id || null,
      items: cart.map((i) => ({
        productId: i.id,
        quantity: i.qty,
        /* Qator chegirmasi — kassir narxni tushirgan bo'lsa (`LinePriceModal`).
           Serverda ham aynan SUMMA saqlanadi: foiz saqlansa, keyin narx
           o'zgarganda eski chek boshqacha o'qilardi. */
        ...(i.discount > 0 ? { discountAmount: i.discount } : {}),
        // Markirovkasiz tovarda maydon umuman yuborilmaydi.
        ...(i.markingCodes?.length ? { markingCodes: i.markingCodes } : {}),
      })),
      /* ⚠ TUR HISOBLANADI, saqlanmaydi (`ek-payment.js`): bitta usul
         bo'lsa — o'sha usul, bir nechtasi bo'lsa «MIXED». Hisobotda
         «aralash» degan qator kerak, aks holda bitta chek ikki
         bo'limda sanalardi. */
      paymentType: saleType,
      discountAmount: discountNum,
      // ⚠ Ball — chegirma, to'lov turi emas: `cashAmount` allaqachon
      // balldan KEYINGI summani ko'rsatadi va kassaga aynan shu tushadi.
      bonusAmount: bonusNum,
      /* ⚠ TO'LOV QISMLARI (V53) — server aynan shu ro'yxatni oladi.
         Bitta usulda ham ro'yxat yuboriladi: shunda serverda bitta yo'l
         qoladi va «bitta usul» bilan «aralash» boshqa-boshqa kod
         bo'lib ajralib ketmaydi. */
      payments: pay.parts,
      /* ⚠ ESKI MAYDONLAR HAM YUBORILADI. Sabab bosqichma-bosqich
         yangilanish: server hali eski bo'lsa (yoki oflayn navbatdagi
         chek eski serverga tushsa) chek baribir yozilishi kerak.
         Yangi server ro'yxatni afzal ko'radi va bularni e'tiborsiz
         qoldiradi. Eski shakl faqat IKKI qismni ko'tara oladi —
         shuning uchun undan ortig'i bo'lsa birinchi ikkitasi
         yuboriladi va bu ATAYLAB: eski server uchdan birini baribir
         qabul qila olmasdi. */
      mixedSecondType: saleType === "MIXED"
        ? (pay.parts.find((p) => p.type !== "CASH")?.type || "CARD") : undefined,
      cashAmount: pay.cashPaid,
      cardAmount: pay.parts.filter((p) => ["CARD", "CLICK", "PAYME"].includes(p.type))
                           .reduce((a, p) => a + p.amount, 0),
    };
    /* Chekka chegirma ham tushadi: mijoz "qancha chegirma oldim" degan
       savolga qog'ozdan javob topishi kerak, aks holda faqat yakuniy
       summa ko'rinib, chegirma ko'rinmay qolardi. */
    /* ⚠ NASIYA MA'LUMOTI CHEKKA (V47). «Nasiya» degan bitta so'z
       yetmaydi: mijoz uyiga borib «qancha qarzim bor edi?» deb o'ylab
       qoladi va ertaga do'kon bilan tortishadi. Shu chek qarzi, JAMI
       qarz va muddat chekda turadi.

       ⚠ Jami qarz — SOTUVDAN KEYINGI holat: `tier.debtBalance` sotuvdan
       oldingi qoldiq, shuning uchun shu chek qarzi qo'shiladi. */
    const creditInfo = creditPart > 0 ? {
      amount: creditPart,
      balance: (Number(tier?.debtBalance) || 0) + creditPart,
      dueDate: dueDays > 0
        ? shortDate(new Date(Date.now() + dueDays * 864e5).toISOString())
        : null,
    } : null;
    /* ⚠ Chekka TAQSIMOT ham tushadi (V53): «Aralash» degan bitta so'z
       mijozga hech narsa aytmaydi va u ertaga «karta bilan qancha
       to'lagan edim?» deb do'kon bilan tortishadi. */
    const snapshot = { cart: [...cart], total, subtotal, discount: discountNum,
                       payType: saleType, customer,
                       payments: payload.payments, credit: creditInfo };

    setShowPayModal(false);
    setFinish({ phase: "printing", total: money(total) });

    let receiptNo = null;
    let offline   = false;
    let res_saleId = null;
    let receiptUrl = null;

    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      /* ⚠ `guard` — CHEGARADAN OSHGAN CHEGIRMADA server bajik so'raydi
         (428). Usiz chek «Bajikni skanerlang» xatosi bilan rad etilardi,
         lekin skanerlash oynasi OCHILMASDI: kassir xabarni o'qir-u,
         nima qilishni bilmasdi va chegirmani qo'lda kamaytirishga
         majbur bo'lardi. Chegara ichidagi chegirmada server bajik
         so'ramaydi — oddiy chek sekinlashmaydi. */
      const res = await guard(() => saleApi.create(payload));
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
        /* Bajik oynasi bekor qilingan bo'lsa — bu xato emas, kassirning
           o'z tanlovi: to'lov oynasi qaytadi va u chegirmani
           o'zgartirishi mumkin. */
        if (!err?.cancelled) toast.error(err.message);
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
    /* ⚠ MVP da fiskal belgi SO'RALMAYDI (`FISCAL_UI`): modul ulanmagan
       bo'lsa bu so'rov har chekda bekorga ketar va javobi baribir
       bo'sh bo'lardi. Chek belgisiz chiqadi — izohi `config.js` da. */
    if (FISCAL_UI && !offline && res_saleId) {
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

    setTimeout(() => { setFinish(null); focusSearch(); }, 2200);
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

      /* Ctrl+B — tarixiy yorliq: ilgari «barkod maydoniga qaytish»
         degani edi, endi qidiruvni fokuslaydi. Saqlab qolindi:
         kassirlar barmog'i uni yod biladi. */
      if (e.ctrlKey && (e.key === "b" || e.key === "B")) { e.preventDefault(); focusSearch(); return; }
      /* ⚠ Ctrl+P va «/» BU YERDA EMAS — ular ham quyidagi jadvalda.
         Ilgari ular shu yerda alohida yozilgani uchun yordam oynasida
         ko'rsatilgan ro'yxat bilan haqiqiy xatti-harakat ikki xil
         bo'lib qolish xavfi bor edi. */

      if (e.key === "Escape") {
        if (finish)       { setFinish(null); focusSearch(); return; }
        /* ⚠ OCHIQ OYNA BO'LSA — Esc O'SHA OYNANIKI, bu yerdagi ro'yxatniki
           emas. Har oyna o'zini `Overlay` orqali yopadi va faqat ENG
           USTIDAGISI javob beradi (`modal-stack.js`).

           Ilgari bu ro'yxat birinchi bo'lib ishlardi va u faqat kassa
           bilgan oynalarni bilardi: to'lov oynasi ustidan ochilgan «yangi
           mijoz» oynasida Esc yangi mijozni emas, TO'LOVNI yopib
           yuborardi — kassir yozganini yo'qotardi. */
        if (layerCount() > 0) return;
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
            focusSearch();
          });
        }
        return;
      }

      /* ══ YORLIQLAR JADVALI (V57) ═══════════════════════════════════
         Endi hamma qolgan yorliq `lib/ek-kassa-keys.js` dan o'qiladi:
         qaysi ekran ochiq ekaniga qarab («cart» yoki «pay») mos qator
         topiladi va faqat o'shanisi bajariladi. Shu sababdan F2 kassa
         ekranida «yangi savat», to'lov oynasida esa «karta» bo'lib
         qolaveradi — tarixiy yorliqlar buzilmaydi.

         ⚠ Ctrl+1..9 JADVALDA YO'Q: brauzerda u varaqlarni almashtiradi
         va kassirning kassasi ko'zdan g'oyib bo'lardi. */
      const scope = showPayModal ? "pay" : "cart";
      /* ⚠ Kassa ekranidagi yorliqlar boshqa oyna ochiq turganda
         ISHLAMAYDI: miqdor yoki belgi oynasida «+» bosgan kassir
         savatdagi boshqa qatorni o'zgartirib qo'yardi. */
      if (scope === "cart" && (finish || qtyModal || markModal || layerCount() > 0)) return;

      /* ⚠ MAYDONGA YOZAYOTGANDA — faqat funksional tugmalar. Aks holda
         chegirma maydoniga «-» yozmoqchi bo'lgan kassir savatdagi
         qator miqdorini kamaytirib yuborardi. */
      const printable = e.key.length === 1 && !e.ctrlKey && !e.altKey;
      if (typing && printable) return;

      const id = resolveKey(e, scope);
      if (!id) return;

      /* Tanlangan qator; tanlanmagan bo'lsa — OXIRGISI (endigina
         qo'shilgan tovar, kassir aynan uni tuzatadi). */
      const picked = cart.find((i) => i.id === pickedId) || cart[cart.length - 1] || null;
      const moveLine = (d) => {
        if (!cart.length) return;
        const at = cart.findIndex((i) => i.id === picked?.id);
        const nextAt = at < 0 ? (d > 0 ? 0 : cart.length - 1)
                              : Math.min(cart.length - 1, Math.max(0, at + d));
        setPickedId(cart[nextAt].id);
      };

      const run = {
        search:    () => searchRef.current?.focus(),
        newCart:   addCart,
        nextCart,
        closeCart: () => dropCart(activeId),
        category:  () => document.querySelector(".kassa-cat .ek-select__btn")?.click(),
        favorites: () => { setFavOnly((v) => !v); setCategoryId(null); },
        view:      () => setViewMode(view === "tiles" ? "list" : "tiles"),
        filter:    () => facets && setFilterOpen((v) => !v),
        linePrev:  () => moveLine(-1),
        lineNext:  () => moveLine(+1),
        linePlus:  () => picked && updateQty(picked.id, +1),
        lineMinus: () => picked && updateQty(picked.id, -1),
        linePrice: () => picked && picked.discountAllowed !== false && setPriceModal(picked),
        lineDrop:  () => picked && removeFromCart(picked.id),
        drawer:    kickDrawer,
        reprint,
        pay:       () => { if (showPayModal) handleSubmit(); else openPayModal(); },
        /* ⚠ F1..F4 — usulni tanlaydi va kursorni summa maydoniga
           qaytaradi. Kassir qo'lini klaviaturadan olmaydi: usulni
           bosdi — darrov summani yozaveradi. */
        payCash:   () => focusMethod("CASH"),
        payCard:   () => focusMethod("CARD"),
        payClick:  () => focusMethod("CLICK"),
        payPayme:  () => focusMethod("PAYME"),
        customer:  () => document.querySelector(".cart-cust .ek-select__btn")?.click(),
        newCust:   () => setNewCust({ fullName: "", phone: "" }),
        discount:  () => document.getElementById("disc-budget")?.focus(),
        help:      () => setKeysOpen((v) => !v),
      }[id];

      if (run) { e.preventDefault(); run(); }
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
          {/* ⚠ SAVAT TABLARI CHAP USTUNGA ko'chdi (foydalanuvchi
              so'rovi). Ilgari ular savat ustunining tepasida turardi va
              o'sha tor ustundan balandlik yeyardi — savat esa endi
              iloji boricha keng va baland bo'lishi kerak. Bu yerda
              gorizontal joy bor: tablar cho'zilib, mijoz nomi va summa
              qisqarmasdan ko'rinadi. */}
          <div className="cart-head">
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

            {/* «Yangi savat» — tablarning O'ZI YONIDA. Bu yerda ular bir
                butun: ro'yxat va unga qo'shish. */}
            <button type="button" className="btn btn-outline btn-sm cart-head__add" onClick={addCart}
                    disabled={carts.length >= cartStore.MAX_CARTS}
                    title={t("kassa.newCart")}>
              <i className="fa-solid fa-cart-plus" aria-hidden="true" />
              <span className="kbd">F2</span>
            </button>
          </div>
          {/* ⚠ ALOHIDA BARKOD MAYDONI OLIB TASHLANDI (foydalanuvchi
              so'rovi: «barkod skaner inputini to'liq olib tashlab uni
              qidirish ichiga qo'shib yuborsa bo'ladimi»).

              Bo'ladi va shunday to'g'riroq: skaner maydonga muhtoj
              emas — u hujjat darajasida tutiladi (`useScanner`) va
              fokus qayerda bo'lishidan qat'i nazar ishlaydi. Maydon
              faqat QO'LDA kiritish uchun kerak edi, qo'lda kiritish
              esa qidiruvdan farq qilmaydi: ikkalasida ham odam matn
              yozib Enter bosadi.

              Endi bitta maydon ikkalasini ham qiladi: raqamli kod
              yozilsa barkod sifatida, aks holda nom sifatida
              qidiriladi. Ekrandan bir qator bo'shadi va kassir
              «qaysi maydonga yozay?» degan savoldan qutuladi. */}

          <div className="card" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0,
                          display: "flex", alignItems: "center", gap: 8 }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 0 }}>
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  ref={searchRef}
                  data-scanner="true"
                  /* ⚠ Ekran klaviaturasi O'ZI OCHILMAYDI: bu maydon
                     kassa ekranining asosiy maydoni va klaviatura
                     ochilib qolsa, u yerdan hech qachon ketmasdi.
                     Kerak bo'lganda yonidagi tugma bilan ochiladi. */
                  data-osk="off"
                  autoComplete="off"
                  placeholder={t("kassa.searchOrScan")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={onSearchEnter}
                />
                {search && <ClearButton label={t("osk.clear")} onClear={() => handleSearchChange("")} />}
                {touchOn && (
                  <button
                    type="button"
                    className="search-bar__pad"
                    title={t("osk.title")}
                    aria-label={t("osk.title")}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => keyboard.open(searchRef.current)}
                  >
                    <i className="fa-solid fa-calculator" aria-hidden="true" />
                  </button>
                )}
                <span className="kbd">/</span>
              </div>

              {/* ⚠ KATEGORIYA — TANLAGICH, tablar emas (foydalanuvchi
                  so'rovi). Ilgari har kategoriya alohida tab edi va
                  ular bir qatorga sig'masdi: qator YON TOMONGA
                  surilardi, ya'ni kassir kerakli bo'limni topish uchun
                  avval uni qidirib surishi kerak edi. Tanlagichda
                  hammasi bir bosishda ko'rinadi va joy olmaydi. */}
              <Select
                className="kassa-cat"
                ariaLabel={t("products.category")}
                searchable searchPlaceholder={t("common.searchShort")}
                value={favOnly ? "fav" : (categoryId ? String(categoryId) : "")}
                onChange={(v) => {
                  setFavOnly(v === "fav");
                  setCategoryId(v && v !== "fav" ? Number(v) : null);
                }}
                options={[
                  { value: "",    label: t("kassa.allProducts"), icon: "fa-grip" },
                  { value: "fav", label: t("kassa.favorites"),   icon: "fa-star" },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                    icon: c.icon || "fa-tag",
                  })),
                ]}
              />

              {/* ⚠ FILTR TUGMASI — TANLAGICH YONIDA (V57). Tanlagich bitta
                  kategoriya beradi, filtr esa bir nechtasini va kiyim
                  atributlarini. Ikkalasi yonma-yon turadi va ular
                  BIRGA ishlaydi: tab toraytiradi, filtr yana
                  toraytiradi.

                  ⚠ Belgilangan katakchalar soni TUGMADA ko'rinadi —
                  aks holda kassir bo'sh natijani «tovar yo'q» deb
                  tushunardi, holbuki sabab kechagi filtr edi. */}
              {facets && (
                <button type="button"
                        className={`btn-icon filter-btn ${filterCount > 0 ? "is-on" : ""}`}
                        title={`${t("common.filter")} (${keyLabel("filter")})`}
                        aria-label={t("common.filter")}
                        onClick={() => setFilterOpen(true)}>
                  <i className="fa-solid fa-filter" aria-hidden="true" />
                  {filterCount > 0 && <span className="facet__badge ek-num">{filterCount}</span>}
                </button>
              )}

              {/* ⚠ KO'RINISH TUGMALARI SHU YERDA (foydalanuvchi so'rovi):
                  ilgari ular kategoriya qatorining o'ng chetida turardi
                  va o'sha butun qator endi yo'q. */}
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

              {/* ⚠ SMENA SHU YERDA — bitta tugma, na ochiq, na yopiq
                  holatda alohida qator egallamaydi (foydalanuvchi
                  so'rovi: «yuqoridan joyni egallab turibdi»).
                  Ogohlantirishning O'ZI esa to'lov tugmasi yoniga
                  ko'chdi — u aslida to'sadigan joyga. */}
              <ShiftBar toast={toast} compact onState={onShiftState} />

              {/* Apparat tugmalari FAQAT desktop'da. Brauzerda ular bosilganda
                  hech nima qilmasdi va kassirni chalg'itardi.
                  ⚠ Faqat BELGI qoldi, matn yo'q: qidiruv qatori ustunning
                  eng muhim elementi va uni ikkita yozuv bilan qisqartirish
                  bir muammoni ikkinchisi bilan almashtirish bo'lardi. */}
              {isDesktop() && (
                <>
                  <button type="button" className="btn-icon" onClick={kickDrawer}
                          title={`${t("hw.openDrawerHint")} (${keyLabel("drawer")})`}
                          aria-label={t("hw.openDrawer")}>
                    <i className="fa-solid fa-cash-register" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon" onClick={reprint}
                          title={`${t("kassa.reprint")} (${keyLabel("reprint")})`}
                          aria-label={t("kassa.reprint")}>
                    <i className="fa-solid fa-print" aria-hidden="true" />
                  </button>
                </>
              )}
              {/* ⚠ YORDAM TUGMASI HAR DOIM — `isDesktop()` ichida EMAS.
                  Aynan klaviatura bilan ishlaydigan kassirga kerak va u
                  brauzerdagi kassada ham o'sha odam. */}
              <button type="button" className="btn-icon" onClick={() => setKeysOpen(true)}
                      title={`${t("kbd.title")} (${keyLabel("help")})`} aria-label={t("kbd.title")}>
                <i className="fa-solid fa-keyboard" aria-hidden="true" />
              </button>
            </div>

            {/* Birinchi yuklanishda katakcha shaklidagi skeleton — kelayotgan
                to'r aynan shu shaklda, shuning uchun sakrash bo'lmaydi.
                Keyingi qidiruvlarda esa mavjud natijalar joyida qoladi va
                yuqorida faqat kichik holat ko'rsatiladi.

                ⚠ KATEGORIYA QATORI OLIB TASHLANDI — u endi qidiruv
                yonidagi tanlagich. Butun bir qator (~46px) tovarlar
                ro'yxatiga qaytdi. */}
            {tilesBusy && products.length === 0 ? (
              <SkeletonTiles count={12} />
            ) : (
            <div ref={gridRef}
                 className={`product-grid ${view === "list" ? "product-grid--list" : ""}`}
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
            {/* ⚠ SAVAT TABLARI CHAP USTUNGA KO'CHDI (foydalanuvchi
                so'rovi). Bu ustun endi FAQAT savat: sarlavha ham,
                mijoz bloki ham olib tashlangan va butun balandlik
                tovarlar ro'yxatiga tegishli. */}
            <div className="cart-items">
              {cart.length === 0 ? (
                <Empty icon="fa-barcode" text={t("kassa.scanPrompt")} />
              ) : (
                cart.map((item) => (
                  <div
                    /* ⚠ `is-picked` — klaviatura bilan tanlangan qator.
                       Belgisiz bo'lsa ↑/↓ bosgan kassir qaysi qatorga
                       ta'sir qilayotganini KO'RMASDI va «−» ni boshqa
                       tovarga bosib yuborardi. */
                    className={`cart-item ${item._added ? "ek-row-in" : ""} ${item._pulse ? "ek-pop" : ""}${
                      item.id === pickedId ? " is-picked" : ""}`}
                    key={`${item.id}-${item._pulse || item._added || 0}`}
                    onClick={() => setPickedId(item.id)}
                  >
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      {/* Tarozili tovarda "0.35 kg × 95 000" — faqat jami
                          summani ko'rsatish kassirni ham, mijozni ham
                          tekshirish imkonidan mahrum qilardi. */}
                      {/* ⚠ NARX BOSILADI (V48): «belgilangan narxdan
                          arzonroq berish» aynan shu yerda bo'ladi.
                          Chegirma qo'yilgan bo'lsa, ESKI narx ustidan
                          chizilgan holda qoladi — kassir ham, mijoz ham
                          nima o'zgarganini ko'rishi kerak. */}
                      {/* ⚠ CHEGIRMA BERILMAYDIGAN TOVAR (V53) — narx
                          maydoni umuman ochilmaydi. Server ham rad etadi,
                          lekin kassir buni narxni yozib, tugmani bosib,
                          xato olgandan KEYIN emas, OLDIN bilishi kerak:
                          mijoz oldida bunday urinish noqulay. */}
                      <button type="button"
                              className={`cart-item-price ek-num${item.discountAllowed === false ? "" : " cart-item-price--edit"}`}
                              disabled={item.discountAllowed === false}
                              title={item.discountAllowed === false ? t("products.discountHint") : undefined}
                              onClick={() => setPriceModal(item)}
                              title={t("kassa.linePrice")}
                              aria-label={`${item.name} — ${t("kassa.linePrice")}`}>
                        {item.discount > 0 && (
                          <s className="cart-item-price__was">{money(item.salePrice)}</s>
                        )}
                        {isDivisible(item)
                          ? `${fmtQty(item.qty, item.unitDecimals)} ${unitLabel(item.unit)} × ${money(unitPriceOf(item))}`
                          : money(unitPriceOf(item))}
                      </button>
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
            {/* Savatni tozalash — endi ro'yxat OSTIDA, jami yonida. */}
            {cart.length > 0 && (
              <button className="btn btn-sm cart-clear" onClick={handleClearCart}>
                <i className="fa-solid fa-trash" aria-hidden="true" /> {t("common.reset")}
                <span className="kbd">Esc</span>
              </button>
            )}
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

            {/* ⚠ OGOHLANTIRISH AYNAN SHU YERDA (foydalanuvchi so'rovi).
                Ilgari u sahifaning tepasida butun kenglikdagi sariq
                qator edi: joy egallar, kassir esa uni har kuni ko'rib
                o'qimay qo'yardi. Endi u to'lov tugmasining ustida —
                yopiq smena aynan shu tugmani to'sadi va kassir
                ogohlantirishni aynan kerak bo'lgan daqiqada ko'radi. */}
            {!shiftOpen && (
              <div className="total-warn" role="status">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>{t("shift.closedWarn")}</span>
              </div>
            )}

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
          onClose={() => { setMarkModal(null); focusSearch(); }}
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
          onClose={() => { setQtyModal(null); focusSearch(); }}
        />
      )}

      {/* ════ Bekor qilish (undo) ════ */}
      {undo && (
        <div className="ek-undo ek-toast-in" role="status" aria-live="polite">
          <span>{undo.item.name} o'chirildi</span>
          <button onClick={restoreUndo}>{t("kassa.undo")}</button>
        </div>
      )}

      {/* ════ QATOR NARXI (V48) ════ */}
      {/* ══ KLAVIATURA YORLIQLARI RO'YXATI (V57) ═══════════════════════
          ⚠ Yorliq bor-u, uni HECH KIM BILMASA — yo'q bilan barobar.
          Kassir ishga kirgan kuni hech kim unga jadval bermaydi;
          shuning uchun ro'yxat ilovaning o'zida, bitta `?` bosishida.

          ⚠ Ro'yxat QO'LDA YOZILMAYDI — ishlovchi bilan bitta manbadan
          (`ek-kassa-keys.js`). Aks holda u birinchi o'zgarishdayoq
          yolg'on gapira boshlardi. */}
      {filterOpen && (
        <FacetFilter
          facets={facets}
          value={filter}
          onChange={setFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {keysOpen && (
        <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
                 aria-label={t("kbd.title")} onEscape={() => setKeysOpen(false)}>
          <div className="ek-dialog kbd-help">
            <div className="pay-modal-header">
              <div className="pay-modal-title">
                <i className="fa-solid fa-keyboard" aria-hidden="true" /> {t("kbd.title")}
              </div>
              <button className="pay-modal-close" onClick={() => setKeysOpen(false)}
                      aria-label={t("common.close")}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <div className="kbd-help__body">
              {[["cart", t("kbd.scopeCart")], ["pay", t("kbd.scopePay")]].map(([sc, title]) => (
                <div className="kbd-help__col" key={sc}>
                  <div className="pay-modal-section-label">{title}</div>
                  <ul className="kbd-help__list">
                    {KASSA_KEYS.filter((k) => k.scope === sc || (sc === "cart" && k.scope === "any"))
                      .map((k) => (
                        <li key={k.id}>
                          <span className="kbd">{keyLabel(k.id)}</span>
                          <span>{t(k.label)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Overlay>
      )}

      {priceModal && (
        <LinePriceModal
          item={priceModal}
          onClose={() => setPriceModal(null)}
          onApply={(discount) => {
            setCart((prev) => prev.map((i) => (i.id === priceModal.id
              ? { ...i, discount, _pulse: Date.now() } : i)));
            setPriceModal(null);
          }}
        />
      )}

      {/* ════ YANGI MIJOZ (V47) ════ */}
      {newCust && (
        <Modal
          title={t("kassa.newCustomer")}
          onClose={() => setNewCust(null)}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setNewCust(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveNewCustomer}
                      disabled={savingCust || !newCust.fullName.trim() || !newCust.phone}>
                <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.save")}
              </button>
            </>
          }
        >
          <label className="form-label">{t("common.fullName")} *</label>
          <input className="form-input" autoFocus value={newCust.fullName}
                 onChange={(e) => setNewCust({ ...newCust, fullName: e.target.value })}
                 placeholder="Abdullayev Ali" />
          <label className="form-label" style={{ marginTop: 10 }}>{t("common.phone")} *</label>
          <PhoneField className="form-input mono ek-num" value={newCust.phone}
                      onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
        </Modal>
      )}

      {/* ════ TO'LOV MODALI ════ */}
      {showPayModal && (
        <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
                 aria-label={t("kassa.pay")} onEscape={closePayModal}>
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

            {/* ══ IKKI USTUN — SCROL BO'LMASIN (V56) ═══════════════════
                ⚠ Ilgari hammasi BITTA ustunda edi va oyna 810px ga
                sig'masdi: kassir to'lov turini ko'rish uchun
                surishga majbur bo'lardi. Mijoz oldida har surish
                sekundlarni yeydi va kassir tugmani qidirib qoladi.

                Kenglik bo'sh turgan edi (oyna 720px, ekran 1400px) —
                shuning uchun mazmun ikki ustunga bo'lindi: chapda
                CHEK (jami, mijoz, chegirma), o'ngda TO'LOV. Tor
                ekranda ustunlar o'z-o'zidan bittaga qaytadi (CSS). */}
            <div className="pay-modal-body">
              {/* ══ 1-USTUN: CHEK ═══════════════════════════════════════
                  ⚠ TOVARLAR RO'YXATI SHU YERDA (do'kon egasining
                  so'rovi). Kassir chegirma bermoqchi bo'lganda «nima
                  sotilyapti va qaysi qatorga qancha tushdi?» degan
                  savolga javob kerak — ilgari buning uchun oynani yopib,
                  savatga qaytish kerak edi.

                  ⚠ RO'YXATNING O'ZI suriladi, OYNA emas. Uzun chekni
                  butunlay sig'dirishning imkoni yo'q; muhimi — oynaning
                  qolgan qismi (jami, chegirma, to'lov tugmalari)
                  JOYIDA qolishi. */}
              <div className="pay-col pay-col--list">
              <div className="pay-modal-total">
                <div className="pay-modal-total-label">{t("kassa.grandTotal")}</div>
                <div className="pay-modal-total-value ek-num">{money(total)}</div>
                <div className="pay-modal-total-qty">
                  <span className="ek-num">{cart.length}</span> xil mahsulot
                </div>
              </div>

              <div className="pay-modal-section-label">
                <i className="fa-solid fa-basket-shopping" aria-hidden="true" /> {t("kassa.items")}
              </div>
              <ul className="pay-items">
                {cart.map((i, idx) => {
                  /* Qatorning O'Z chegirmasi + chek chegirmasidan tushgan ulush. */
                  const own = Number(i.discount) || 0;
                  const cut = own + (discountSplit[idx] || 0);
                  const gross = (Number(i.salePrice) || 0) * (Number(i.qty) || 0);
                  return (
                    <li className="pay-items__row" key={i.id}>
                      <span className="pay-items__name" title={i.name}>{i.name}</span>
                      <span className="pay-items__qty ek-num">
                        {/* ⚠ E'LON NARXI, chegirmadan KEYINGISI emas:
                            chegirma o'z ustunida alohida ko'rinadi va
                            ikkalasi bir raqamga qo'shib yuborilsa,
                            mijozning «nega bu narx?» savoliga javob
                            yo'qolardi. */}
                        {fmtQty(i.qty, i.unitDecimals)} {unitLabel(i.unit)} × {money(i.salePrice)}
                      </span>
                      <span className="pay-items__sum ek-num">
                        {money(gross - cut)}
                        {cut > 0 && (
                          <em className="pay-items__cut">−{money(cut)}</em>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              </div>

              <div className="pay-col pay-col--left">

              {/* ⚠ MIJOZ TO'LOV OYNASIGA KO'CHDI (foydalanuvchi so'rovi).

                  Ilgari u savat ustunida doim turardi va o'sha ustundan
                  balandlik yeyardi — holbuki mijoz KO'PCHILIK chekda
                  umuman tanlanmaydi. Endi u faqat to'lov paytida, ya'ni
                  aynan kerak bo'lgan daqiqada so'raladi: sodiqlik
                  darajasi, qarzi va ballari ham shu yerda — chunki
                  ularning hammasi to'lovga ta'sir qiladi. */}
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-user" aria-hidden="true" /> {t("kassa.customer")}
              </div>
              <div className="cart-cust">
              {/* ⚠ MIJOZ QATORI — TANLASH + QO'SHISH + RO'YXAT (V47).
                  Ilgari bu yerda faqat tanlagich turardi: kassa oldida
                  turgan YANGI mijozni qo'shish uchun kassir savatni
                  tashlab «Mijozlar» sahifasiga o'tishi kerak edi. Endi
                  ikkalasi ham shu yerda va ko'zga tashlanadi. */}
              <div className="cart-cust__row">
                <Select
                  block
                  ariaLabel={t("kassa.customer")}
                  placeholder={t("kassa.pickCustomer")}
                  /* ⚠ QIDIRUV MAJBURIY YOQILGAN, avtomatik emas: mijozlar
                     soni bugun oltita bo'lsa ham ertaga yuzta bo'ladi va
                     kassir o'sha kuni ro'yxatni aylantirib qidirishga
                     majbur qolardi. Qidiruv kassa qidiruvi bilan bir xil
                     algoritmda ishlaydi (`lib/ek-search.js`). */
                  searchable
                  searchPlaceholder={t("kassa.searchCustomer")}
                  /* ✕ — tanlangan mijozni olib tashlash. Ilgari buning
                     uchun ro'yxatni ochib «Mijozsiz» ni topish kerak edi. */
                  clearable
                  clearLabel={t("kassa.noCustomer")}
                  value={customer?.id ? String(customer.id) : ""}
                  onChange={(v) => setCustomer(customers.find((c) => String(c.id) === v) || null)}
                  options={[
                    { value: "", label: t("kassa.noCustomer"), icon: "fa-user-slash" },
                    ...customers.map((c) => ({
                      value: String(c.id),
                      label: c.fullName,
                      /* ⚠ Telefon YORLIQQA QO'SHILMAYDI, o'z ustunida
                         turadi: ismlar uzunligi turlicha bo'lgani uchun
                         raqamlar har qatorda boshqa joydan boshlanar va
                         ro'yxatni ko'z bilan kuzatib o'qib bo'lmasdi. */
                      hint: c.phone,
                      icon: "fa-user",
                    })),
                  ]}
                />
                <button type="button" className="btn-icon cart-cust__btn"
                        title={t("kassa.newCustomer")} aria-label={t("kassa.newCustomer")}
                        onClick={() => setNewCust({ fullName: "", phone: "" })}>
                  <i className="fa-solid fa-user-plus" aria-hidden="true" />
                </button>
                {/* ⚠ «HAMMA MIJOZLAR» TUGMASI OLIB TASHLANDI.
                    U `/customers` ga o'tkazardi va shu bilan YARIM
                    TERILGAN SAVATNI tashlab ketardi: kassa oldida
                    navbat turganda bu qo'pol xato. Kassa sahifasidan
                    chiqishning yagona yo'li — yon menyu; u yerda
                    chiqayotgani ko'rinib turadi.

                    Ehtiyoj ham qolmadi: yuqoridagi tanlagichda
                    qidiruv bor va u butun ro'yxatni ko'rsatadi. */}
              </div>

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
                      : <span className="text-muted">{t("loyalty.noTier")}</span>}{" "}
                    {/* ⚠ Daraja OYNADAN hisoblansa buni aytish shart (V43):
                        aks holda mijoz «men bu do'kondan million so'mlik
                        olganman, nega darajam yo'q?» deb so'raganda kassir
                        javob topa olmasdi. */}
                    {Number(tier.loyaltyWindowDays) > 0 && (
                      <span className="text-muted" style={{ fontSize: 11, marginLeft: 6 }}>
                        {t("loyalty.windowNote", { days: tier.loyaltyWindowDays })}
                      </span>
                    )}
                  </span>
                  {tier.toNextTier != null && (
                    <span className="text-muted mono" style={{ fontSize: 12 }}>
                      {t("loyalty.toNext")}: {money(tier.toNextTier)}
                    </span>
                  )}
                </div>
              )}

              {/* ── Mijozning QARZI ──────────────────────────────────────

                  ⚠ Kassir buni KO'RMASDI. U nasiyaga sotishga urinib,
                  chegaradan oshganini faqat serverdan qaytgan xatodan —
                  mijoz oldida — bilardi. Endi qarz ham, chegarada qancha
                  joy qolgani ham savat ustunida turadi.

                  Faqat QARZI BOR mijozda ko'rinadi: nol qarzli qator
                  foydali ma'lumot bermaydi va kartochkani cho'zardi. */}
              {customer && tier && Number(tier.debtBalance) > 0 && (
                <div style={{
                  marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  fontSize: 13,
                }}>
                  <span style={{ color: "var(--fg-danger)", fontWeight: 700 }}>
                    <i className="fa-solid fa-hand-holding-dollar" style={{ marginRight: 6 }} aria-hidden="true" />
                    {t("credit.balance")}: <b className="mono">{money(tier.debtBalance)}</b>
                    {/* ⚠ MUDDATI O'TGAN qism alohida aytiladi (V43). Umumiy
                        qarz «bor» degani, muddati o'tgani esa «so'rash
                        kerak» degani — kassir uchun bu ikki xil holat. */}
                    {Number(tier.overdueDebt) > 0 && (
                      <> · <i className="fa-solid fa-clock" aria-hidden="true" />{" "}
                        {t("credit.overdue")}: <b className="mono">{money(tier.overdueDebt)}</b></>
                    )}
                  </span>
                  {/* ⚠ «Qolgan chegara» O'RNIGA — QACHONDAN BERI qarzdor
                      (V46). Chegara olib tashlandi, kassirga esa qarzning
                      YOSHI kerak: bugungi 300 ming va yarim yillik 300 ming
                      butunlay boshqa gap. */}
                  {tier.debtSince && (
                    <span className="text-muted mono" style={{ fontSize: 12 }}>
                      {t("credit.debtSince")} {shortDate(tier.debtSince)}
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

              {/* ── Chegirma ────────────────────────────────────────────
                  To'lov turidan OLDIN: chegirma jamini o'zgartiradi, ya'ni
                  kassir avval yakuniy summani ko'rib, keyin to'lovni
                  qabul qilishi kerak. Chegara oshsa server bajik so'raydi. */}
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-tag" aria-hidden="true" /> {t("kassa.discount")}
              </div>
              {/* ⚠ CHEGARA `afterLines` (V48): kassir savatda ayrim
                  qatorlar narxini allaqachon tushirgan bo'lishi mumkin.
                  Chek chegirmasi shundan KEYINGI summadan olinadi —
                  serverdagi tartib ham shunday. */}
              <NumField kind="money" max={afterLines}
                className="form-input pay-mixed-input ek-num"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
              {/* Qatorda tushirilgan narx ham chegirma — kassir uni
                  ko'rmasa, chek chegirmasini yana ustiga qo'shib
                  yuborardi. */}
              {lineDiscounts > 0 && (
                <div className="pay-modal-hint">
                  <i className="fa-solid fa-tags" style={{ marginRight: 4 }} aria-hidden="true" />
                  {t("kassa.lineDiscounts")}: −{money(lineDiscounts)}
                </div>
              )}
              {discountNum > 0 && (
                <div className="pay-modal-hint">
                  {money(afterLines)} − {money(discountNum)}
                </div>
              )}

              {/* ══ BERMOQCHI BO'LGAN SUMMA (V57) ════════════════════
                  ⚠ Do'kon egasining so'rovi AYNAN shunday edi:

                    «20 000 chegirma qilmoqchiman. Shundan oshmaydigan,
                     lekin piyoz va kartoshkadagi 500 va 700 ni
                     yo'qotadigan summani tizim taklif qilsin.»

                  Ya'ni boshlang'ich nuqta — KASSIRNING SUMMASI, chekning
                  qoldig'i emas. Quyidagi «yaxlitlash takliflari» esa
                  boshqa savolga javob beradi (eng arzon yechim) va
                  ikkalasi bir vaqtda kerak bo'lmaydi: byudjet yozilgan
                  zahoti o'sha ro'yxat almashadi. */}
              <label className="pay-modal-section-label" htmlFor="disc-budget">
                <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true" />{" "}
                {t("kassa.discBudget")}
              </label>
              {/* ⚠ Chegara — QOIDA emas, ZARAR chegarasi: kassir undan
                  ortig'ini yozsa ham maydondan qaytarilmaydi, faqat
                  ogohlantiriladi. Niyatni to'sish uni raqamni boshqa
                  joyga yozishga majbur qilardi, xolos. */}
              <NumField id="disc-budget" kind="money" max={afterLines}
                className="form-input pay-mixed-input ek-num"
                value={discBudget}
                onChange={(e) => setDiscBudget(e.target.value)}
                placeholder="0"
              />

              {/* ⚠ OGOHLANTIRISH IKKI DARAJALI. Bitta xabar ikkala
                  holatga ham yozilsa, kassir ularning og'irligini
                  farqlay olmasdi: biri rahbar tasdig'i bilan mumkin,
                  ikkinchisi esa do'konni ZARARGA sotdiradi. */}
              {discVerdict !== "ok" && (
                <div className={`disc-warn disc-warn--${discVerdict}`} role="status">
                  <i className={`fa-solid ${discVerdict === "loss"
                      ? "fa-triangle-exclamation" : "fa-user-shield"}`} aria-hidden="true" />
                  <span>
                    {discVerdict === "loss" ? t("kassa.discLoss") : t("kassa.discOverLimit")}
                    <b className="ek-num">
                      {" "}{money(discVerdict === "loss" ? lossLimit : ruleRoom)}
                    </b>
                  </span>
                </div>
              )}

              {budgetNum > 0 && (
                budgetPicks.length > 0 ? (
                  <div className="round-offers">
                    <div className="round-offers__label">
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                      {t("kassa.budgetOffer")}
                      <span className="round-offers__hint">{t("kassa.budgetHint")}</span>
                    </div>
                    <div className="round-offers__row">
                      {budgetPicks.map((o) => (
                        <button key={o.target} type="button" className="round-offers__btn"
                                onClick={() => { setDiscount(String(discountNum + o.discount)); setDiscBudget(""); }}>
                          <span className="round-offers__target ek-num">{money(o.target)}</span>
                          <span className="round-offers__cut ek-num">−{money(o.discount)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ⚠ JIM QOLMAYDI. Taklif chiqmasligining ikki sababi
                     bor va ikkalasi ham kassirga aytiladi, aks holda u
                     maydonga yozib turib «nega hech narsa bo'lmadi?»
                     deb qolardi. */
                  <div className="pay-modal-hint">
                    <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} aria-hidden="true" />
                    {ruleRoom <= 0 ? t("kassa.budgetNoRoom") : t("kassa.budgetNoFit")}
                  </div>
                )
              )}

              {/* ══ YAXLITLASH TAKLIFLARI (V56) ═══════════════════════
                  ⚠ Do'kon egasining so'rovi: chek 141 200 chiqdi, mijoz
                  142 000 beradi, kassir 800 qaytaradi — maydasi yo'q,
                  navbat kutadi va oxir-oqibat o'sha 800 hisobsiz ketadi.

                  Tizim shu qoldiqni O'ZI ko'rib chegirma qilib taklif
                  qiladi. Har taklif SIG'ADIGANI tekshirilgan: bo'sh joy
                  har qatorning tovar foizi, tannarxi va kassir
                  chegarasidan kelib chiqadi (`lib/ek-discount.js`).

                  ⚠ Jami allaqachon yaxlit bo'lsa taklif CHIQMAYDI:
                  maqsad — noqulay qoldiqni yo'qotish, «yaxlit chegirma
                  berish» emas. */}
              {budgetNum <= 0 && roundOffers.length > 0 && (
                <div className="round-offers">
                  <div className="round-offers__label">
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
                    {t("kassa.roundOffer")}
                    <span className="round-offers__hint">{t("kassa.roundHint")}</span>
                  </div>
                  <div className="round-offers__row">
                    {roundOffers.map((o) => (
                      <button key={o.target} type="button" className="round-offers__btn"
                              onClick={() => setDiscount(String(discountNum + o.discount))}>
                        <span className="round-offers__target ek-num">{money(o.target)}</span>
                        <span className="round-offers__cut ek-num">−{money(o.discount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Bitta tovarli chekda taqsimotni ko'rsatishning ma'nosi
                  yo'q — hammasi o'sha bitta qatorga tushadi. */}
              {discountNum > 0 && cart.length > 1 && (
                <details className="disc-split">
                  <summary>{t("kassa.discountSplit")}</summary>
                  <ul className="disc-split__list">
                    {cart.map((i, idx) => (
                      <li key={i.id}>
                        <span className="disc-split__name">{i.name}</span>
                        <span className="disc-split__val">−{money(discountSplit[idx])}</span>
                      </li>
                    ))}
                  </ul>
                </details>
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

              </div>

              <div className="pay-col pay-col--right">
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-credit-card" aria-hidden="true" /> To'lov turini tanlang
              </div>
              {/* ⚠ TUGMA TO'LOV TURINI EMAS, TAHRIRLANADIGAN USULNI
                  tanlaydi. Bosilganda hech narsa o'chmaydi — faqat
                  quyidagi maydon o'sha usulning summasiga o'tadi va
                  eski qiymati qaytadi (do'kon egasining talabi). */}
              <div className="pay-modal-types">
                {PAY_METHODS.map(({ key, label, icon, color, kbd }) => (
                  <button
                    key={key}
                    className={`pay-type-btn ${payFocus === key ? "active" : ""}${
                      paid[key] ? " has-amount" : ""}`}
                    style={{ "--pay-color": color }}
                    aria-pressed={payFocus === key}
                    onClick={() => focusMethod(key)}
                  >
                    <span className="pay-type-icon"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>
                    {/* ⚠ Nom SPAN ichida — yalang'och matn emas. Tugma
                        endi grid va yalang'och matn anonim katakka
                        tushib, joyini boshqarib bo'lmasdi. */}
                    <span className="pay-type-label">{label}</span>
                    {kbd && <span className="kbd">{kbd}</span>}
                    {/* Kiritilgan summa TUGMANING O'ZIDA: kassir qaysi
                        usulga qancha yozganini pastdagi ro'yxatga
                        qaramasdan ko'radi.

                        ⚠ Summa BO'LMAGANDA ham qator bo'sh turadi
                        (`&nbsp;`): aks holda pul yozilgan tugma
                        boshqalaridan baland bo'lib, 2×2 to'r
                        qiyshayardi. */}
                    <span className="pay-type-btn__sum ek-num">
                      {paid[key] ? money(paid[key]) : "\u00a0"}
                    </span>
                  </button>
                ))}
              </div>

              {/* ══ BITTA MAYDON ═══════════════════════════════════════
                  ⚠ Har usul uchun alohida maydon ochilmaydi (do'kon
                  egasining talabi). Ilgari aralash to'lovda har usul
                  o'z qatorini ochar, oyna o'sar va kassir qaysi
                  maydonga yozayotganini adashtirardi. */}
              <label className="form-label" htmlFor="pay-amount" style={{ marginTop: 14 }}>
                {t("kassa.amountFor", { method: PAY_METHODS.find((m) => m.key === payFocus)?.label })}
              </label>
              <NumField kind="money"
                id="pay-amount"
                className="form-input pay-mixed-input"
                value={payValue}
                autoFocus
                onChange={(e) => setPayValue(e.target.value)}
                placeholder="0"
              />
              <div className="ek-quick-cash">
                {[50000, 100000, 200000].map((v) => (
                  <button key={v} type="button" onClick={() => setPayValue(String(v))}>
                    {v.toLocaleString("uz-UZ")}
                  </button>
                ))}
                {/* Eng ko'p uchraydigan amal: «qolganini shu usuldan». */}
                <button type="button" onClick={fillRest}>{t("kassa.fillRest")}</button>
              </div>

              {/* ══ HISOB ══════════════════════════════════════════════
                  Kiritilganlar va qolgani — bir joyda, bir qarashda. */}
              <div className="pay-sum">
                {pay.parts.filter((x) => x.type !== "CREDIT").map((x) => {
                  const m = PAY_METHODS.find((k) => k.key === x.type);
                  return (
                    <div className="pay-sum__row" key={x.type} style={{ "--pay-color": m?.color }}>
                      <span className="pay-sum__name">
                        <i className={`fa-solid ${m?.icon}`} aria-hidden="true" /> {m?.label || x.type}
                      </span>
                      <b className="ek-num">{money(x.amount)}</b>
                      <button type="button" className="pay-sum__x"
                              title={t("common.delete")} aria-label={t("common.delete")}
                              onClick={() => dropMethod(x.type)}>
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                {/* ⚠ QAYTIM — faqat naqdda. Terminal aynan so'ralgan
                    summani oladi va u yerdan pul qaytmaydi. */}
                {pay.change > 0 && (
                  <div className="pay-sum__row pay-sum__row--change">
                    <span className="pay-sum__name">
                      <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" /> {t("kassa.change")}
                    </span>
                    <b className="ek-num">{money(pay.change)}</b>
                  </div>
                )}

                {/* ⚠ QOLGANI — AVTOMATIK NASIYA. Kassir uni yozmaydi,
                    tizim o'zi hisoblaydi va shu yerda ko'rsatadi. */}
                {creditPart > 0 && (
                  <div className={`pay-sum__row pay-sum__row--credit ${creditBlocked ? "is-blocked" : ""}`}>
                    <span className="pay-sum__name">
                      <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true" />{" "}
                      {creditEnabled ? t("kassa.toCredit") : t("kassa.unpaid")}
                    </span>
                    <b className="ek-num">{money(creditPart)}</b>
                  </div>
                )}

                {pay.parts.length === 0 && creditPart === 0 && (
                  <div className="pay-sum__empty">{t("kassa.payEmpty")}</div>
                )}
              </div>

              {/* ⚠ NASIYA O'CHIRILGAN DO'KONDA qoldiq qololmaydi: uni
                  yozadigan joy yo'q va chek yopilmaydi. */}
              {creditBlocked && (
                <div className="pay-mixed-warn ek-shake">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                  {t("kassa.creditOff")}
                </div>
              )}

              {/* Naqdsiz usulda ortiqcha — xato, qaytim emas. */}
              {pay.over > 0 && (
                <div className="pay-mixed-warn ek-shake">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                  {t("kassa.payOver", { amount: money(pay.over) })}
                </div>
              )}

              {/* Nasiyada mijoz tanlanmagan bo'lsa — nima qilish
                  kerakligini AYTAMIZ. Tugmani jimgina o'chirib qo'yish
                  kassirni «nega ishlamayapti» deb qidirishga majbur
                  qilardi. */}
              {creditPart > 0 && !creditBlocked && !customer && (
                <div className="pay-mixed-warn">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                  {t("credit.customerRequired")}
                </div>
              )}
              {/* Qarz chegarasi — tugmani jimgina o'chirib qo'yish o'rniga
                  QANCHA joy qolganini aytamiz: kassir summani o'zi
                  to'g'irlay oladi va mijozni kutdirmaydi. */}
              </div>
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
        </Overlay>
      )}

      {/* ════ YAKUNLASH: chek chiqmoqda → ✓ ════ */}
      {finish && (
        <FinishOverlay
          phase={finish.phase}
          total={finish.total}
          receiptNo={finish.receiptNo}
          onClose={finish.phase === "done" ? () => { setFinish(null); focusSearch(); } : undefined}
        />
      )}
    </div>
  );
}
