import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import { saleApi } from "../api";
import { money } from "../utils";
import { BranchSelector, Modal } from "../components";
import { Empty, SearchBar, Badge, Field } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { useBadge } from "../context/BadgeProvider";
import { useAuth } from "../hooks/useAuth";
import { PAYMENT_TYPE, SALE_STATUS, paymentEntry, saleStatus } from "../lib/ek-labels";
// ⚠ `Spinner` HAM shu yerdan. U chek chiqarish va bekor qilish tugmalarida
// FAQAT amal davomida chiziladi — shuning uchun import unutilgani sahifa
// ochilganda bilinmasdi, tugma bosilgan zahoti esa render'da
// `ReferenceError` bo'lib butun ilovani bo'sh oynaga aylantirardi.
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { printReceipt } from "../lib/ek-hardware";
import SaleDetailModal from "../components/SaleDetailModal";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { topRole } from "../lib/ek-roles";
import { useScanner } from "../hooks/useScanner";
import { useOnline } from "../hooks/useOnline";
import { parseSaleCode } from "../lib/ek-barcode";
import { rankItems } from "../lib/ek-search";

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

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saleApi.getAll(branchId);
      // Teskari tartib: yangi sotuvlar yuqorida
      const sorted = (res.data || []).sort((a, b) => {
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
  }, [branchId]);

  useEffect(() => { loadSales(); }, [loadSales]);

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
    digits: (s) => [String(s.id)],
    texts:  (s) => [s.customerName, s.cashierName],
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">{t("sales.title")}</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t("sales.search")} style={{ width: 280 }} />
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
          {busy ? <SkeletonTable rows={8} cols={["narrow", "text", "text", "num", "text", "text", "text"]} /> : (
            <table>
              <thead>
                <tr>
                  <SortTh flt={colFlt} col="id">#</SortTh>
                  <SortTh flt={colFlt} col="cash">{t("sales.colCashier")}</SortTh>
                  <SortTh flt={colFlt} col="cust">{t("cust.col")}</SortTh>
                  <SortTh flt={colFlt} col="sum">{t("common.sum")}</SortTh>
                  <SortTh flt={colFlt} col="pay">{t("sales.colPayment")}</SortTh>
                  <SortTh flt={colFlt} col="st">{t("common.status")}</SortTh>
                  <SortTh flt={colFlt} col="date">{t("common.date")}</SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((sale) => {
                  const st = statusBadge(sale.status);
                  return (
                    <tr key={sale.id}>
                      <td className="mono fw-800 text-muted">#{sale.id}</td>
                      <td className="fw-700">{sale.cashierName || "—"}</td>
                      <td>{sale.customerName || <span className="text-muted">—</span>}</td>
                      <td><span className="mono fw-700 text-blue">{money(sale.totalAmount)}</span></td>
                      {/* Aralash chekda qismlar sichqoncha ostida (V66). */}
                      <td><span style={{ fontSize: 13 }}
                                title={(sale.payments || []).length > 1
                                  ? sale.payments.map((p) => `${paymentEntry(p.type).label}: ${money(p.amount)}`).join(" · ")
                                  : undefined}><PayLabel type={sale.paymentType} /></span></td>
                      <td><Badge color={st.color}>{st.label}</Badge></td>
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
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8}><Empty icon="fa-receipt" text={t("sales.notFound")} /></td></tr>
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
                </tr>
              </thead>
              <tbody>
                {(ret.sale.items || []).map((it) => {
                  const left = Number(it.quantity || 0) - Number(it.returnedQuantity || 0);
                  return (
                    <tr key={it.id}>
                      <td className="fw-700">{it.productName}</td>
                      <td><Badge color={left > 0 ? "blue" : "gray"}>{left}</Badge></td>
                      <td style={{ width: 150 }}>
                        <Field
                          kind="qty" unit={it.unit} max={left}
                          className="form-input ek-num"
                          disabled={left <= 0}
                          value={ret.lines[it.id] ?? ""}
                          onChange={(e) => setRet({ ...ret, lines: { ...ret.lines, [it.id]: e.target.value } })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
