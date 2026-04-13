import { productApi, customerApi, saleApi } from "../api";
import { BranchSelector } from "../components";
import { money } from "../utils";
import { Empty } from "../components/ui";

// ─── Chek chiqarish ──────────────────────────────────────────
function printCheck({ saleId, cart, total, payType, customer }) {
  const win = window.open("", "_blank", "width=320,height=600,toolbar=no,menubar=no");
  if (!win) return;

  const payLabel = { CASH: "Naqd", CARD: "Karta", MIXED: "Aralash" };
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
    } else {
      setCashAmount("");
      setCardAmount("");
    }
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
        cashAmount:  payType === "CASH"  ? total :
                     payType === "MIXED" ? Number(cashAmount) || 0 : 0,
        cardAmount:  payType === "CARD"  ? total :
                     payType === "MIXED" ? Number(cardAmount) || 0 : 0,
      });

      toast.success(`${money(total)} sotuv bajarildi!`);
      if (refreshLowStock) refreshLowStock(); // Ombor ogohlantirishini yangilash
      printCheck({ saleId: res?.data?.id, cart, total, payType, customer });
      clearCart();
      setCustomer(null);
      setCashAmount(""); setCardAmount("");
      setPayType("CASH");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="kassa-layout" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Savdo (Kassa)</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={(id) => { setBranchId(id); setCart([]); }} />
      </div>
      
      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 16 }}>

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
          <div className="product-grid" style={{ position:"relative" }}>
            {searching && (
              <div style={{ position:"absolute", top:8, right:8, zIndex:10, fontSize:11, color:"var(--blue)", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
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

        {/* Jami va to'lov */}
        <div className="total-card">
          <div className="total-row">
            <span>Mahsulotlar</span>
            <span>{totalQty} dona</span>
          </div>
          <div className="total-big">
            <span>JAMI</span>
            <span className="mono">{money(total)}</span>
          </div>

          {/* To'lov turlari */}
          <div className="payment-grid">
            {[
              { key: "CASH",  label: "Naqd",    icon: "fa-money-bill-1" },
              { key: "CARD",  label: "Karta",   icon: "fa-credit-card" },
              { key: "MIXED", label: "Aralash", icon: "fa-shuffle", full: true },
            ].map(({ key, label, icon, full }) => (
              <button
                key={key}
                className={`payment-btn ${payType === key ? "active" : ""}`}
                style={full ? { gridColumn: "1 / -1" } : {}}
                onClick={() => handlePayTypeChange(key)}
              >
                <i className={`fa-solid ${icon}`} /> {label}
              </button>
            ))}
          </div>

          {/* MIXED: naqd va karta miqdori */}
          {payType === "MIXED" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:"#15803d", display:"block", marginBottom:4 }}>
                  <i className="fa-solid fa-money-bill-1" /> Naqd (so'm)
                </label>
                <input
                  type="number" min="0"
                  className="form-input"
                  style={{ textAlign:"right", fontWeight:700, color:"#15803d", borderColor:"#86efac" }}
                  value={cashAmount}
                  onChange={(e) => {
                    setCashAmount(e.target.value);
                    const v = Number(e.target.value) || 0;
                    setCardAmount(String(Math.max(0, total - v)));
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:"#1d4ed8", display:"block", marginBottom:4 }}>
                  <i className="fa-solid fa-credit-card" /> Karta (so'm)
                </label>
                <input
                  type="number" min="0"
                  className="form-input"
                  style={{ textAlign:"right", fontWeight:700, color:"#1d4ed8", borderColor:"#93c5fd" }}
                  value={cardAmount}
                  onChange={(e) => {
                    setCardAmount(e.target.value);
                    const v = Number(e.target.value) || 0;
                    setCashAmount(String(Math.max(0, total - v)));
                  }}
                />
              </div>
              {(Number(cashAmount)||0) + (Number(cardAmount)||0) !== total && total > 0 && (
                <div style={{ gridColumn:"1/-1", fontSize:12, color:"var(--red)", fontWeight:700, textAlign:"center" }}>
                  <i className="fa-solid fa-triangle-exclamation" /> Yig'indi: {((Number(cashAmount)||0)+(Number(cardAmount)||0)).toLocaleString()} — Jami: {total.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Sotish tugmasi */}
          <button
            className="btn btn-green btn-full"
            style={{ marginTop: 12 }}
            onClick={handleSubmit}
            disabled={!cart.length || processing}
          >
            <i className={`fa-solid ${processing ? "fa-spinner fa-spin" : "fa-receipt"}`} />
            {processing ? "Bajarilmoqda..." : "Sotish va Chek Chiqarish"}
          </button>
        </div>
      </div>
    </div>
  </div>
);
}
