import { useState, useEffect, useCallback, useRef } from "react";
import { t } from "../lib/ek-i18n";
import { productApi, customerApi, saleApi, securityApi } from "../api";
import { useBadge } from "../context/BadgeProvider";
import { money } from "../utils";
import { Empty } from "../components/ui";
import { FinishOverlay, SkeletonTiles, Spinner } from "../components/ek/Loading";
import OfflineBar from "../components/OfflineBar";
import ShiftBar from "../components/ShiftBar";
import * as queue from "../lib/ek-offline";
import { PAYMENT_TYPE, paymentLabel } from "../lib/ek-labels";
import { useLoading } from "../lib/use-loading";
import Select from "../components/ek/Select";
import { printReceipt, openDrawer } from "../lib/ek-hardware";
import { useScanner } from "../hooks/useScanner";
import { isDesktop } from "../lib/ek-desktop";

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
const PAY_METHODS  = ["CASH", "CARD", "CLICK", "PAYME", "MIXED"].map(payItem);
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
  const [cart, setCart]             = useState([]);
  const [search, setSearch]         = useState("");
  const [searching, setSearching]   = useState(true);   // birinchi yuklash
  const tilesBusy = useLoading(searching);
  const [payType, setPayType]       = useState("CASH");
  const [cashGiven, setCashGiven]   = useState("");     // naqdda berilgan summa
  const [cashAmount, setCashAmount] = useState("");     // aralash: naqd qismi
  const [cardAmount, setCardAmount] = useState("");     // aralash: ikkinchi qism
  const [customer, setCustomer]     = useState(null);
  const [processing, setProcessing] = useState(false);
  const [branchId]                  = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [mixedSecondType, setMixedSecondType] = useState("CARD");
  const [finish, setFinish]         = useState(null);   // { phase, total, receiptNo }
  const [undo, setUndo]             = useState(null);   // { item, index }
  const [bcWarn, setBcWarn]         = useState(false);  // fokus yo'qolgani

  const barcodeRef  = useRef(null);
  const searchRef   = useRef(null);
  const debounceRef = useRef(null);
  const refocusRef  = useRef(null);
  const undoRef     = useRef(null);
  const lastSale    = useRef(null);   // Ctrl+P uchun

  // Chek sarlavhasi va imzosi. Sessiyadan olinadi — chek uchun alohida
  // so'rov yubormaymiz: kassa ekrani oflaynda ham ishlashi kerak.
  const shopName = localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode") || "";
  const cashier  = localStorage.getItem("ek_fullName") || localStorage.getItem("ek_username") || "";

  /* ── Mijozlar ─────────────────────────────────────────────── */
  useEffect(() => {
    customerApi.getAll(branchId).then((r) => setCustomers(r.data || [])).catch(() => {});
  }, [branchId]);

  /* ── Server qidiruvi (debounce 350ms) ─────────────────────── */
  const doSearch = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await productApi.search(q, 0, 40, branchId);
      setProducts(res.data || []);
    } catch (_) { /* oflaynda katalog eskicha qoladi */ }
    finally { setSearching(false); }
  }, [branchId]);

  useEffect(() => { doSearch(""); }, [doSearch]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

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
    if (showPayModal || finish) return;
    focusBarcode();
  }, [showPayModal, finish, focusBarcode]);

  useEffect(() => {
    const onFocusOut = () => {
      clearTimeout(refocusRef.current);
      refocusRef.current = setTimeout(() => {
        const el = document.activeElement;
        const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
        if (showPayModal || finish || typing) { setBcWarn(!typing); return; }
        focusBarcode();
      }, REFOCUS_MS);
    };
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusout", onFocusOut); clearTimeout(refocusRef.current); };
  }, [showPayModal, finish, focusBarcode]);

  /* ── Barkod bo'yicha qo'shish ──────────────────────────────── */
  const addByBarcode = async (code) => {
    const local = products.find((p) => p.barcode === code);
    if (local) { addToCart(local); return; }
    try {
      const res = await productApi.search(code, 0, 5, branchId);
      const found = (res.data || []).find((p) => p.barcode === code);
      if (found) { addToCart(found); return; }
    } catch (_) { /* oflayn */ }
    // Xato ovozi emas, taklif (06-APP-KASSIR.md).
    // ⚠ Ilgari bu satrda `t("products.title")` AYNAN shu ko'rinishda chiqardi:
    // u shablon satr ichida edi va hech qachon chaqirilmagan.
    toast.info(t("kassa.barcodeNotFound", { code, section: t("products.title") }));
  };

  /* ── Skaner: butun oyna bo'ylab ────────────────────────────────
     Ilgari barkod FAQAT o'z maydoni fokusda bo'lganda o'qilardi. Amalda
     kassir mijoz oynasini ochib qo'yadi yoki sichqoncha bilan boshqa joyni
     bosadi — va skanerlangan kod yo'qoladi yoki tovar nomi maydoniga
     yozilib qoladi. Endi u qayerda bo'lishidan qat'i nazar savatga tushadi.

     To'lov oynasi ochiq bo'lganda O'CHADI: u yerda summa kiritiladi va
     tasodifiy skanerlash summani buzib yuborardi. */
  useScanner(addByBarcode, { enabled: !showPayModal && !finish });

  /* ── Savat ────────────────────────────────────────────────── */
  const addToCart = (product) => {
    if (product.expired) { toast.error(`${product.name} — muddati o'tgan, sotib bo'lmaydi!`); return; }
    if (product.stockQuantity != null && product.stockQuantity <= 0) {
      toast.error(`${product.name} — omborda qolmagan!`); return;
    }
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      // Bir xil tovar ikkinchi marta → miqdor oshadi, yangi satr yaratilmaydi
      if (exists) return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1, _pulse: Date.now() } : i));
      return [...prev, { ...product, qty: 1, _added: Date.now() }];
    });
    setSearch("");
    clearTimeout(debounceRef.current);
    doSearch("");
  };

  const updateQty = (id, delta) =>
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));

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

  const clearCart = () => setCart([]);

  const total    = cart.reduce((sum, i) => sum + i.salePrice * i.qty, 0);
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

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
    setCashGiven(""); setCashAmount(""); setCardAmount("");
    setMixedSecondType("CARD");
    setShowPayModal(true);
  };
  const closePayModal = () => setShowPayModal(false);

  const change      = Math.max(0, (Number(cashGiven) || 0) - total);
  const mixedSum    = (Number(cashAmount) || 0) + (Number(cardAmount) || 0);
  const mixedOk     = payType !== "MIXED" || mixedSum === total;
  const cashOk      = payType !== "CASH"  || !cashGiven || Number(cashGiven) >= total;
  const canSubmit   = cart.length > 0 && !processing && mixedOk && cashOk;

  /* ── Sotuvni yakunlash ────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setProcessing(true);

    const payload = {
      idempotencyKey: queue.newIdempotencyKey(),
      customerId: customer?.id || null,
      items: cart.map((i) => ({ productId: i.id, quantity: i.qty })),
      paymentType: payType,
      mixedSecondType: payType === "MIXED" ? mixedSecondType : undefined,
      cashAmount: payType === "CASH" ? total : payType === "MIXED" ? Number(cashAmount) || 0 : 0,
      cardAmount: ["CARD", "CLICK", "PAYME"].includes(payType) ? total
                : payType === "MIXED" ? Number(cardAmount) || 0 : 0,
    };
    const snapshot = { cart: [...cart], total, payType, customer };

    setShowPayModal(false);
    setFinish({ phase: "printing", total: money(total) });

    let receiptNo = null;
    let offline   = false;

    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      const res = await saleApi.create(payload);
      receiptNo = res?.data?.id != null ? `A-${res.data.id}` : null;
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

    lastSale.current = { ...snapshot, saleId: receiptNo, offline };
    // Chek va pul yashigi — BITTA amalda, kassirdan qo'shimcha bosish
    // talab qilmasdan. Xatosi yutilmaydi, lekin SOTUVNI to'xtatmaydi:
    // sotuv allaqachon qayd etilgan va printer nosozligi uni bekor
    // qilmasligi kerak — kassir chekni Ctrl+P bilan qayta chiqaradi.
    printReceipt({ saleId: receiptNo, ...snapshot, offline, shopName, cashier })
      .catch((err) => toast.error(`${t("hw.printFailed")}: ${err.message}`));

    setFinish({ phase: "done", total: money(snapshot.total), receiptNo });
    if (refreshLowStock) refreshLowStock();

    clearCart();
    setCustomer(null);
    setCashGiven(""); setCashAmount(""); setCardAmount("");
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
        if (showPayModal) { closePayModal(); return; }
        if (cart.length && window.confirm(t("kassa.clearConfirm"))) clearCart();
        return;
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
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0, gap: 12 }}>
        <h2 className="page-title" style={{ fontSize: 18 }}>{t("kassa.title")}</h2>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {/* Apparat tugmalari FAQAT desktop'da. Brauzerda ular bosilganda
              hech nima qilmasdi va kassirni chalg'itardi. */}
          {isDesktop() && (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={kickDrawer}
                      title={t("hw.openDrawerHint")}>
                <i className="fa-solid fa-cash-register" aria-hidden="true" /> {t("hw.openDrawer")}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={reprint}
                      title={t("kassa.reprintHint")}>
                <i className="fa-solid fa-print" aria-hidden="true" /> {t("kassa.reprint")}
                <span className="kbd" style={{ marginLeft: 6 }}>Ctrl+P</span>
              </button>
            </>
          )}

          <div className="ek-shift" data-open="true">
            <span className="ek-shift__dot" aria-hidden="true" />
            {t("kassa.shiftOpen")}
          </div>
        </div>
      </div>

      <OfflineBar />
      <ShiftBar toast={toast} />

      <div className="kassa-layout" style={{ height: "auto", flex: 1 }}>
        {/* ════ CHAP: Barkod + Mahsulotlar ════ */}
        <div className="kassa-left">
          {/* Barkod maydoni — doim fokusda, monoshriftda (bu raqam) */}
          <div className="bc-field" data-unfocused={bcWarn}>
            <i className="fa-solid fa-barcode" aria-hidden="true" />
            <label htmlFor="bc" className="ek-sr-only">{t("kassa.scanTitle")}</label>
            <input
              id="bc"
              ref={barcodeRef}
              data-scanner="true"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("kassa.scanHint")}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const code = e.currentTarget.value.trim();
                e.currentTarget.value = "";       // skanerdan keyin maydon tozalanadi
                if (code.length > 2) addByBarcode(code);
              }}
            />
            <span className="kbd" title={t("kassa.backToBarcode")}>Ctrl+B</span>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <div className="search-bar">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                <input
                  ref={searchRef}
                  placeholder={t("kassa.searchByName")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && products.length === 1) addToCart(products[0]); }}
                />
                <span className="kbd">/</span>
              </div>
            </div>

            {/* Birinchi yuklanishda katakcha shaklidagi skeleton — kelayotgan
                to'r aynan shu shaklda, shuning uchun sakrash bo'lmaydi.
                Keyingi qidiruvlarda esa mavjud natijalar joyida qoladi va
                yuqorida faqat kichik holat ko'rsatiladi. */}
            {tilesBusy && products.length === 0 ? (
              <SkeletonTiles count={12} />
            ) : (
            <div className="product-grid" style={{ position: "relative" }}>
              {searching && products.length > 0 && (
                <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, fontSize: 11, color: "var(--fg-brand)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Spinner small /> Qidirilmoqda…
                </div>
              )}
              {products.map((p) => (
                <button type="button" className="product-card" key={p.id} onClick={() => addToCart(p)}>
                  <div className="product-name">{p.name}</div>
                  <div className="product-barcode ek-num">{p.barcode || "—"}</div>
                  <div className="product-price ek-num">{money(p.salePrice)}</div>
                </button>
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

        {/* ════ O'NG: Savat + To'lov ════ */}
        <div className="kassa-right">
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-cart-shopping text-blue" aria-hidden="true" />
                Savat (<span className="ek-num">{cart.length}</span>)
              </span>
              {cart.length > 0 && (
                <button className="btn btn-sm" style={{ background: "var(--bg-danger-subtle)", color: "var(--fg-danger)" }} onClick={clearCart}>
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
                      <div className="cart-item-price ek-num">{money(item.salePrice)}</div>
                    </div>
                    <div className="qty-ctrl">
                      <button className="qty-btn" aria-label={t("kassa.decrease")} onClick={() => updateQty(item.id, -1)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" aria-label={t("kassa.increase")} onClick={() => updateQty(item.id, +1)}>+</button>
                    </div>
                    <button className="btn-icon danger" aria-label={`${item.name} — o'chirish`} onClick={() => removeFromCart(item.id)}>
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ padding: "10px 14px" }}>
            <Select
              block
              ariaLabel={t("kassa.customer")}
              placeholder={t("kassa.pickCustomer")}
              value={customer?.id ? String(customer.id) : ""}
              onChange={(v) => setCustomer(customers.find((c) => String(c.id) === v) || null)}
              options={[
                { value: "", label: "Mijoz tanlanmagan", icon: "fa-user-slash" },
                ...customers.map((c) => ({
                  value: String(c.id),
                  label: `${c.fullName} · ${c.phone}`,
                  icon: "fa-user",
                })),
              ]}
            />
          </div>

          <div className="total-card">
            <div className="total-row">
              <span>{t("products.title")}</span>
              <span className="ek-num">{totalQty} dona</span>
            </div>
            <div className="total-big">
              <span>JAMI</span>
              <span className="ek-num">{money(total)}</span>
            </div>

            <button className="btn btn-green btn-full btn-pos" style={{ marginTop: 14 }} onClick={openPayModal} disabled={!cart.length}>
              <i className="fa-solid fa-wallet" aria-hidden="true" />
              To'lovga o'tish <span className="kbd">F9</span>
            </button>
          </div>
        </div>
      </div>

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
                  <span className="ek-num">{totalQty}</span> ta mahsulot · <span className="ek-num">{cart.length}</span> xil
                </div>
              </div>

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
                  <input
                    id="given"
                    type="number" min="0" inputMode="numeric"
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
                      <input
                        id="mx-cash" type="number" min="0" inputMode="numeric"
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
                      <input
                        id="mx-card" type="number" min="0" inputMode="numeric"
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
