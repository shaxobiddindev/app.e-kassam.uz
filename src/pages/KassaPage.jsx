import { useState, useEffect, useCallback, useRef } from "react";
import { productApi, customerApi, saleApi } from "../api";
import { BranchSelector } from "../components";
import { money } from "../utils";
import { Empty } from "../components/ui";

// ─── Chek chiqarish ──────────────────────────────────────────
function printCheck({ saleId, cart, total, payType, customer }) {
  const win = window.open("", "_blank", "width=320,height=600,toolbar=no,menubar=no");
  if (!win) return;

  const payLabel = { CASH: "Naqd", CARD: "Karta", MIXED: "Aralash", CLICK: "Click", PAYME: "Payme" };
  const rows = cart
    .map((i) => `<div class="row"><span>${i.name} ×${i.qty}</span><span>${(i.salePrice * i.qty).toLocaleString("uz-UZ")} so'm</span></div>`)
    .join("");

  win.document.write(`
    <!DOCTYPE html><html><head><title>Chek #${saleId}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: monospace; font-size: 12px; padding: 12px; width: 280px; }
      .c { text-align: center; }
      .hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; padding: 3px 0; }
      .logo { font-size: 18px; font-weight: 900; color: #017dca; }
      .dot { color: #22c55e; }
    </style></head>
    <body>
      <div class="c">
        <div class="logo">E-KASSAM<span class="dot">.UZ</span></div>
        <small>CRM Tizimi</small>
      </div>
      <div class="hr"></div>
      <div class="row"><span>Chek #${saleId || "—"}</span><span>${new Date().toLocaleString("uz-UZ")}</span></div>
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      <div class="row"><b>JAMI:</b><b>${total.toLocaleString("uz-UZ")} so'm</b></div>
      <div class="row"><span>To'lov:</span><span>${payLabel[payType] || payType}</span></div>
      ${customer ? `<div class="row"><span>Mijoz:</span><span>${customer.fullName}</span></div>` : ""}
      <div class="hr"></div>
      <div class="c"><p>Xarid uchun rahmat!</p><small>e-kassam.uz</small></div>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── KassaPage ───────────────────────────────────────────────
export default function KassaPage({ toast, refreshLowStock }) {
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [cart, setCart]             = useState([]);
  const [search, setSearch]         = useState("");
  const [searching, setSearching]   = useState(false);
  const [payType, setPayType]       = useState("CASH");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [customer, setCustomer]     = useState(null);
  const [processing, setProcessing] = useState(false);
  const [branchId, setBranchId]     = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [mixedSecondType, setMixedSecondType] = useState("CARD");

  // Barcode scanner uchun buffer
  const bcBuffer   = useRef("");
  const bcTimer    = useRef(null);
  const debounceRef = useRef(null);

  // Mijozlarni tanlangan shopga qarab yuklaymiz
  useEffect(() => {
    customerApi.getAll(branchId).then((r) => setCustomers(r.data || [])).catch(() => {});
  }, [branchId]);

  // Server search — debounce 350ms
  const doSearch = useCallback(async (q) => {
    setSearching(true);
    try {
      const res = await productApi.search(q, 0, 40, branchId);
      setProducts(res.data || []);
    } catch (_) {}
    finally { setSearching(false); }
  }, [branchId]);

  // Sahifa ochilganda va search bo'sh bo'lganda — birinchi 40 ta
  useEffect(() => {
    doSearch("");
  }, [doSearch]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  // ── USB Barcode Scanner listener ────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      // Search input yoki boshqa inputlarda ishlamasin
      if (e.target.tagName === "INPUT" && !e.target.dataset.scanner) return;

      if (e.key === "Enter") {
        if (bcBuffer.current.length > 2) {
          const found = products.find((p) => p.barcode === bcBuffer.current);
          if (found) {
            addToCart(found);
            toast.info(`${found.name} qo'shildi`);
          } else {
            toast.error(`Barkod topilmadi: ${bcBuffer.current}`);
          }
          bcBuffer.current = "";
        }
      } else if (e.key.length === 1) {
        bcBuffer.current += e.key;
        clearTimeout(bcTimer.current);
        bcTimer.current = setTimeout(() => { bcBuffer.current = ""; }, 200);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [products]);

  // ── Savatcha ────────────────────────────────────────────────
  const addToCart = (product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setSearch("");
    clearTimeout(debounceRef.current);
    doSearch("");
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, i) => sum + i.salePrice * i.qty, 0);
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  // payType o'zgarganda default miqdorlar
  const handlePayTypeChange = (type) => {
    setPayType(type);
    if (type === "MIXED") {
      const half = Math.round(total / 2);
      setCashAmount(String(half));
      setCardAmount(String(total - half));
      setMixedSecondType("CARD");
    } else {
      setCashAmount("");
      setCardAmount("");
    }
  };

  // Aralash to'lovda ikkinchi turni o'zgartirish
  const handleMixedSecondChange = (type) => {
    setMixedSecondType(type);
  };

  // Modal ochilganda payType reset
  const openPayModal = () => {
    setPayType("CASH");
    setCashAmount("");
    setCardAmount("");
    setMixedSecondType("CARD");
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
  };

  // ── Sotish ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cart.length) return;
    setProcessing(true);
    try {
      const res = await saleApi.create({
        customerId:  customer?.id || null,
        items:       cart.map((i) => ({ productId: i.id, quantity: i.qty })),
        paymentType: payType,
        mixedSecondType: payType === "MIXED" ? mixedSecondType : undefined,
        cashAmount:  payType === "CASH"  ? total :
                     payType === "MIXED" ? Number(cashAmount) || 0 : 0,
        cardAmount:  payType === "CARD"  ? total :
                     payType === "CLICK" ? total :
                     payType === "PAYME" ? total :
                     payType === "MIXED" ? Number(cardAmount) || 0 : 0,
      });

      toast.success(`${money(total)} sotuv bajarildi!`);
      if (refreshLowStock) refreshLowStock(); // Ombor ogohlantirishini yangilash
      printCheck({ saleId: res?.data?.id, cart, total, payType, customer });
      clearCart();
      setCustomer(null);
      setCashAmount(""); setCardAmount("");
      setPayType("CASH");
      setShowPayModal(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ height: "calc(100vh - var(--sh) - 40px)", display: "flex", flexDirection: "column" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Savdo (Kassa)</h2>
        </div>
      </div>

      <div className="kassa-layout" style={{ height: "auto", flex: 1 }}>
        {/* ════ CHAP: Mahsulotlar ════ */}
        <div className="kassa-left">
          <div className="card" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* Search / Barcode input */}
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div className="search-bar">
                <i className="fa-solid fa-barcode" />
                <input
                  data-scanner="true"
                  placeholder="Mahsulot nomi yoki barkod skanerlang..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && products.length === 1) {
                      addToCart(products[0]);
                    }
                  }}
                />
              </div>
            </div>

            {/* Product grid */}
            <div className="product-grid" style={{ position: "relative" }}>
              {searching && (
                <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, fontSize: 11, color: "var(--blue)", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  <i className="fa-solid fa-spinner fa-spin" /> Qidirilmoqda...
                </div>
              )}
              {products.map((p) => (
                <div className="product-card" key={p.id} onClick={() => addToCart(p)}>
                  <div className="product-name">{p.name}</div>
                  <div className="product-barcode">{p.barcode || "—"}</div>
                  <div className="product-price">{money(p.salePrice)}</div>
                </div>
              ))}
              {products.length === 0 && (
                <div style={{ gridColumn: "1/-1" }}>
                  <Empty icon="fa-magnifying-glass" text="Mahsulot topilmadi" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════ O'NG: Savatcha + To'lov ════ */}
        <div className="kassa-right">

          {/* Savatcha */}
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="card-header">
              <span className="card-title">
                <i className="fa-solid fa-cart-shopping text-blue" />
                Savatcha ({cart.length})
              </span>
              {cart.length > 0 && (
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--red-l)", color: "var(--red)", border: "none" }}
                  onClick={clearCart}
                >
                  <i className="fa-solid fa-trash" /> Tozalash
                </button>
              )}
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <Empty icon="fa-cart-shopping" text="Mahsulot qo'shing" />
              ) : (
                cart.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">{money(item.salePrice)}</div>
                    </div>

                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, +1)}>+</button>
                    </div>

                    <button className="btn-icon danger" onClick={() => removeFromCart(item.id)}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mijoz tanlash */}
          <div className="card" style={{ padding: "10px 14px" }}>
            <select
              className="form-input"
              style={{ fontSize: 13 }}
              value={customer?.id || ""}
              onChange={(e) => setCustomer(customers.find((c) => c.id === Number(e.target.value)) || null)}
            >
              <option value="">Mijoz tanlash (ixtiyoriy)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName} · {c.phone}</option>
              ))}
            </select>
          </div>

          {/* Jami summa va To'lovga o'tish tugmasi */}
          <div className="total-card">
            <div className="total-row">
              <span>Mahsulotlar</span>
              <span>{totalQty} dona</span>
            </div>
            <div className="total-big">
              <span>JAMI</span>
              <span className="mono">{money(total)}</span>
            </div>

            <button
              className="btn btn-green btn-full"
              style={{ marginTop: 14 }}
              onClick={openPayModal}
              disabled={!cart.length}
            >
              <i className="fa-solid fa-wallet" />
              To'lovga o'tish
            </button>
          </div>
        </div>
      </div>

      {/* ════ TO'LOV MODALI ════ */}
      {showPayModal && (
        <div className="pay-modal-overlay">
          <div className="pay-modal-box">
            {/* Modal header */}
            <div className="pay-modal-header">
              <div className="pay-modal-title">
                <i className="fa-solid fa-cash-register" />
                To'lov qilish
              </div>
              <button className="pay-modal-close" onClick={closePayModal}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal body */}
            <div className="pay-modal-body">

              {/* Jami summa ko'rsatish */}
              <div className="pay-modal-total">
                <div className="pay-modal-total-label">Umumiy summa</div>
                <div className="pay-modal-total-value">{money(total)}</div>
                <div className="pay-modal-total-qty">{totalQty} ta mahsulot · {cart.length} xil</div>
              </div>

              {/* To'lov turlari */}
              <div className="pay-modal-section-label">
                <i className="fa-solid fa-credit-card" /> To'lov turini tanlang
              </div>
              <div className="pay-modal-types">
                {[
                  { key: "CASH",  label: "Naqd",    icon: "fa-money-bill-1", color: "#16a34a" },
                  { key: "CARD",  label: "Karta",   icon: "fa-credit-card",  color: "#2563eb" },
                  { key: "CLICK", label: "Click",   icon: "fa-mobile-screen", color: "#7c3aed" },
                  { key: "PAYME", label: "Payme",   icon: "fa-mobile-screen-button", color: "#06b6d4" },
                  { key: "MIXED", label: "Aralash",  icon: "fa-shuffle",      color: "#ea580c" },
                ].map(({ key, label, icon, color }) => (
                  <button
                    key={key}
                    className={`pay-type-btn ${payType === key ? "active" : ""}`}
                    onClick={() => handlePayTypeChange(key)}
                    style={{ "--pay-color": color }}
                  >
                    <div className="pay-type-icon">
                      <i className={`fa-solid ${icon}`} />
                    </div>
                    <div className="pay-type-label">{label}</div>
                  </button>
                ))}
              </div>

              {/* MIXED: ikkinchi to'lov turini tanlash + miqdorlar */}
              {payType === "MIXED" && (
                <div className="pay-mixed-section">
                  {/* Ikkinchi to'lov turini tanlash */}
                  <div className="pay-mixed-label" style={{ color: "var(--text2)", marginBottom: 10 }}>
                    <i className="fa-solid fa-shuffle" /> Naqd + qolgan qismi:
                  </div>
                  <div className="pay-mixed-second-types">
                    {[
                      { key: "CARD",  label: "Karta",  icon: "fa-credit-card",          color: "#2563eb" },
                      { key: "CLICK", label: "Click",  icon: "fa-mobile-screen",        color: "#7c3aed" },
                      { key: "PAYME", label: "Payme",  icon: "fa-mobile-screen-button", color: "#06b6d4" },
                    ].map(({ key, label, icon, color }) => (
                      <button
                        key={key}
                        className={`pay-mixed-second-btn ${mixedSecondType === key ? "active" : ""}`}
                        onClick={() => handleMixedSecondChange(key)}
                        style={{ "--pay-color": color }}
                      >
                        <i className={`fa-solid ${icon}`} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Miqdor inputlari */}
                  <div className="pay-mixed-row" style={{ marginTop: 14 }}>
                    <div className="pay-mixed-field">
                      <label className="pay-mixed-label" style={{ color: "#15803d" }}>
                        <i className="fa-solid fa-money-bill-1" /> Naqd (so'm)
                      </label>
                      <input
                        type="number" min="0"
                        className="form-input pay-mixed-input"
                        style={{ borderColor: "#86efac", color: "#15803d" }}
                        value={cashAmount}
                        onChange={(e) => {
                          setCashAmount(e.target.value);
                          const v = Number(e.target.value) || 0;
                          setCardAmount(String(Math.max(0, total - v)));
                        }}
                      />
                    </div>
                    <div className="pay-mixed-field">
                      <label className="pay-mixed-label" style={{ color: mixedSecondType === "CARD" ? "#1d4ed8" : mixedSecondType === "CLICK" ? "#7c3aed" : "#06b6d4" }}>
                        <i className={`fa-solid ${mixedSecondType === "CARD" ? "fa-credit-card" : mixedSecondType === "CLICK" ? "fa-mobile-screen" : "fa-mobile-screen-button"}`} />
                        {mixedSecondType === "CARD" ? "Karta" : mixedSecondType === "CLICK" ? "Click" : "Payme"} (so'm)
                      </label>
                      <input
                        type="number" min="0"
                        className="form-input pay-mixed-input"
                        style={{ borderColor: mixedSecondType === "CARD" ? "#93c5fd" : mixedSecondType === "CLICK" ? "#c4b5fd" : "#a5f3fc", color: mixedSecondType === "CARD" ? "#1d4ed8" : mixedSecondType === "CLICK" ? "#7c3aed" : "#06b6d4" }}
                        value={cardAmount}
                        onChange={(e) => {
                          setCardAmount(e.target.value);
                          const v = Number(e.target.value) || 0;
                          setCashAmount(String(Math.max(0, total - v)));
                        }}
                      />
                    </div>
                  </div>
                  {(Number(cashAmount) || 0) + (Number(cardAmount) || 0) !== total && total > 0 && (
                    <div className="pay-mixed-warn">
                      <i className="fa-solid fa-triangle-exclamation" /> Yig'indi: {((Number(cashAmount) || 0) + (Number(cardAmount) || 0)).toLocaleString()} — Jami: {total.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="pay-modal-footer">
              <button
                className="btn btn-outline"
                onClick={closePayModal}
                disabled={processing}
              >
                <i className="fa-solid fa-arrow-left" /> Orqaga
              </button>
              <button
                className="btn btn-green pay-modal-submit"
                onClick={handleSubmit}
                disabled={!cart.length || processing}
              >
                <i className={`fa-solid ${processing ? "fa-spinner fa-spin" : "fa-receipt"}`} />
                {processing ? "Bajarilmoqda..." : "Sotish va Chek"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
