import { useState, useEffect, lazy, Suspense } from "react";
import { t } from "../lib/ek-i18n";
import { customerApi } from "../api";
import { BranchSelector } from "../components";
import { maskPhone, cleanPhone, money } from "../config";
import Modal from "../components/Modal";
import { Empty, Field, SearchBar, Avatar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { roleSet } from "../lib/ek-roles";
import { useAuth } from "../hooks/useAuth";
import { shortDate, dateTime } from "../lib/ek-format";
import SaleDetailModal from "../components/SaleDetailModal";
/* ⚠ SEKIN YUKLANADI: to'lov cheki kunda bir necha marta ochiladi,
   mijozlar sahifasi esa doim. Chekni asosiy bo'lakka qo'shish uni
   hech qachon ochmaydigan kassirga ham yuklatardi. */
const PaymentReceipt = lazy(() => import("../portal/PaymentReceipt"));
import DebtPayModal from "../components/DebtPayModal";
import ManualDebtModal from "../components/ManualDebtModal";
import SavingsModal from "../components/SavingsModal";
import { printDebtReceipt } from "../lib/ek-hardware";
import { saleApi } from "../api";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { PhoneField } from "../components/ek/EkFields";
import { rankItems } from "../lib/ek-search";

/* Yangi mijozda telefon BO'SH boshlanadi. Ilgari bu yerda `"998"` turardi
   va maydon «(99) 8» bilan to'ldirilgan holda ochilardi: odam uni
   o'chirib, keyin o'z raqamini yozishi kerak edi. */
const EMPTY_FORM = { fullName: "", phone: "" };

/**
 * Jurnal qatorining MIJOZ KO'ZI BILAN ishorali summasi.
 *
 * Qarz — manfiy (odam qarzga botdi), to'lov — musbat (qarz yopildi).
 * Balans esa teskari yo'nalishda yuradi, shuning uchun bu yerda ishora
 * ataylab AGDARILADI.
 */
const ledgerSigned = (l) => {
  const v = Number(l.amount) || 0;
  return l.type === "PAYMENT" ? Math.abs(v) : -v;
};

/** Qarz necha kundan beri turibdi. `null` — jurnal bo'sh (eski ma'lumot). */
const daysSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms < 0 ? 0 : Math.floor(ms / 86400000);
};

export default function CustomersPage({ toast }) {
  const confirm = useConfirm();
  /* Chegarani egasi yoki do'kon administratori qo'yadi (2026-08-10, 5-qaror).
     Kassir uni ko'ra oladi, lekin o'zgartira olmaydi — backend ham shunday. */
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  // Ekranda ko'rsatiladigan holat: tez javobda skeleton UMUMAN chizilmaydi
  // (180ms kechikish), chizilgan bo'lsa esa kamida 400ms turadi — miltillamaydi.
  const busy = useLoading(loading);
  const [search, setSearch]       = useState("");
  const [modal, setModal]         = useState(null); // null | "add" | { type:"edit", customer }
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [branchId, setBranchId]   = useState(null);
  /* Nasiya: { customer, amount, method, ledger } — bitta oyna ham to'lov
     qabul qiladi, ham jurnalni ko'rsatadi. Ikkita alohida oyna kassirni
     ortiqcha bosishga majbur qilardi. */
  const [debt, setDebt]           = useState(null);
  /* ⚠ QARZ JURNALIDAN CHEKKA (V47). «Bu 76 970 so'm qayerdan chiqdi?»
     degan savol aynan shu oynada tug'iladi va unga javob berish uchun
     do'kon egasi Sotuvlar sahifasiga o'tib, chekni qidirishi kerak
     edi. Endi qatorning o'zi bosiladi. */
  const { user } = useAuth();
  /* ⚠ NOMI `canDelete` EDI (V62 da o'zgardi). O'chirish endi umuman
     yo'q — bu bayroq faqat RAHBAR amallarini (qo'lda qarz kiritish)
     to'sadi. Eski nom qolganda, keyingi o'quvchi «demak o'chirish bor
     ekan» deb o'ylardi. */
  const isManager = [...roleSet(user?.role)].some((r) => r === "OWNER" || r === "SHOP_ADMIN");
  const [payOpen, setPayOpen] = useState(false);
  /* Ekranda turgan to'lov cheki: to'lovdan keyin darhol, yoki jurnaldagi
     tugmadan. `null` — yopiq. */
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(null);
  /* Jamg'arma oynasi (V63): `{ customer, account }` yoki `null`. */
  const [savings, setSavings] = useState(null);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const [saleDetail, setSaleDetail] = useState(null);
  const [saleLoading, setSaleLoading] = useState(null);

  const openSale = async (saleId) => {
    if (!saleId || saleLoading) return;
    setSaleLoading(saleId);
    try {
      const r = await saleApi.getById(saleId);
      setSaleDetail(r?.data || null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaleLoading(null);
    }
  };

  const [paying, setPaying]       = useState(false);
  /* "all" | "debtors". Alohida sahifa emas, chunki ikkala ro'yxatda ham
     bir xil amal qilinadi (qarz to'lash) va yon menyuda yana bitta qator
     qarzdorlar yo'q do'konlar uchun bo'sh joy egallardi. */
  const [view, setView]           = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      // Qarzdorlar ro'yxati SERVERDA saralanadi va "necha kundan beri"
      // ma'lumotini ham olib keladi — uni mijozlar ro'yxatidan hisoblab
      // bo'lmaydi.
      const res = view === "debtors"
        ? await customerApi.debtors()
        : await customerApi.getAll(branchId);
      setCustomers(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [branchId, view]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal("add");
  };

  /* Qarz oynasi jurnal bilan birga ochiladi: "qancha qarzim bor" degan
     savoldan keyin darhol "qayerdan chiqdi" savoli keladi. */
  const openDebt = async (c) => {
    setDebt({ customer: c, ledger: null });
    setPayOpen(false);
    try {
      const r = await customerApi.ledger(c.id);
      setDebt((d) => (d && d.customer.id === c.id ? { ...d, ledger: r.data || [] } : d));
    } catch (_) { /* jurnal kelmasa ham to'lov qabul qilinaveradi */ }
  };

  const submitDebt = async ({ amount, method }) => {
    setPaying(true);
    try {
      /* ⚠ JAVOB — CHEKNING O'ZI (V61), qolgan balans emas: har
         to'lovning o'z raqami, o'z havolasi va o'z QR i bor. */
      const r = await customerApi.payDebt(debt.customer.id, { amount, method });
      const rc = r?.data || null;
      const left = Number(rc?.balanceAfter) || 0;
      toast.success(`${t("credit.left")}: ${money(left)}`);

      /* ⚠ CHEK MIJOZ UCHUN (V47). U pul berdi va buning izini olishi
         kerak — aks holda «to'lagandim-ku» degan tortishuv yana
         do'konning so'ziga qarshi mijozning so'zi bo'lib qolardi.
         Chop etish XATOSI to'lovni bekor qilmaydi: pul allaqachon
         kassada va chekni qayta chiqarish mumkin. */
      try {
        await printDebtReceipt({
          customer: debt.customer, amount, method, balanceAfter: left,
          /* Raqam va havola SERVERDAN (V61): qog'ozdagi QR aynan shu
             chekni ochadi va qog'ozdagi raqam ekrandagi bilan bir xil
             bo'lishi shart. */
          receiptNo: rc?.receiptNo, qrUrl: rc?.qrUrl,
          balanceBefore: rc?.balanceBefore,
          toSavings: rc?.toSavings, bonusEarned: rc?.bonusEarned,
          shopName: rc?.shopName || localStorage.getItem("ek_shopName")
                    || localStorage.getItem("ek_shopCode") || "",
          cashier: rc?.cashierName || localStorage.getItem("ek_fullName") || "",
          date: rc?.date ? new Date(rc.date) : new Date(),
        });
      } catch (e) {
        toast.info(e.message || t("hw.errPopup"));
      }

      setPayOpen(false);
      setDebt(null);
      /* ⚠ CHEK EKRANDA HAM QOLADI. Printersiz do'konda (yoki qog'oz
         tugaganda) chop etish jimgina yo'q bo'lardi va mijoz yana
         quruq qo'l bilan ketardi — endi u chekni telefoniga QR orqali
         ko'chirib oladi. */
      if (rc) setReceipt(rc);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  /* Jurnaldagi ESKI to'lovning cheki. ⚠ Mijoz «o'tgan hafta
     to'lagandim, qog'ozi yo'q» deb kelganda javob «qaytadan to'lang»
     bo'lmasligi kerak. */
  const openReceipt = async (ledgerId) => {
    setReceiptLoading(ledgerId);
    try {
      const r = await customerApi.paymentReceipt(ledgerId);
      setReceipt(r.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReceiptLoading(null);
    }
  };

  const openEdit = (customer) => {
    setForm({ fullName: customer.fullName, phone: customer.phone });
    setModal({ type: "edit", customer });
  };

  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.fullName || !form.phone) {
      toast.error(t("products.requiredFields"));
      return;
    }
    setSaving(true);
    try {
      const profile = form;
      let customerId;
      if (modal === "add") {
        const r = await customerApi.create(profile);
        customerId = r?.data?.id;
        /* ⚠ SERVERNING XABARI USTUN (V47). Arxivlangan mijoz qayta
           qo'shilganda server «ro'yxatga qaytarildi — eski xaridlari va
           ballari joyida» deydi. Bu yerda doim «qo'shildi» yozilsa,
           do'kon YANGI yozuv ochilgan deb o'ylardi va o'sha mijozning
           eski ballari qayerdan chiqqanini tushunmasdi. */
        toast.success(r?.message || t("cust.added"));
      } else {
        customerId = modal.customer.id;
        await customerApi.update(customerId, profile);
        toast.success(t("cust.updated"));
      }

      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── MIJOZ JAMG'ARMASI (V63) ─────────────────────────────────────
     ⚠ Bu KESHBEK EMAS: ball do'konning sovg'asi (kuyadi, naqdga
     chiqarilmaydi), jamg'arma esa mijozning do'konga bergan puli va
     do'kon uchun majburiyat. */
  const openSavings = async (c) => {
    try {
      const r = await customerApi.savings(c.id);
      setSavings({ customer: c, account: r.data });
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ⚠ Javobda YANGI holat qaytadi va oyna shundan yangilanadi —
     qayta so'rov yuborilmaydi. Ikki so'rov orasida kassir eski
     qoldiqni ko'rib turardi. */
  const runSavings = (fn) => async (amount) => {
    setSavingsBusy(true);
    try {
      const r = await fn(savings.customer.id, { amount, method: "CASH" });
      setSavings((prev) => ({ ...prev, account: r.data }));
      toast.success(r.message || t("common.saved"));
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingsBusy(false);
    }
  };

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /* ⚠ QIDIRUV — kassadagi bilan BIR XIL algoritm (`lib/ek-search.js`).
     Ilgari bu yerda oddiy `includes` turardi: «Абдулла» deb kiritilgan
     mijozni «abdulla» deb qidirgan kassir TOPA OLMASDI, xato yozilgan
     harf esa umuman natija bermasdi. Telefon raqami maxsus ishlanadi —
     odam oxirgi raqamlarni eslaydi, to'liq raqamni emas. */
  const filtered = rankItems(customers, search, {
    texts:  (c) => [c.fullName],
    digits: (c) => [c.phone],
  });

  /* Muddat qo'yilgan do'konda kamida bitta qarz kechikkanmi (V43).
     Ustun shu holatda chiziladi: muddatsiz do'konda u har qatorda
     chiziqcha ko'rsatib, jadvalni bekorga kengaytirardi. */
  const hasOverdue = view === "debtors" && customers.some((c) => Number(c.overdue) > 0);

  const [reminding, setReminding] = useState(false);
  /* QO'LDA QARZDOR (V48) — daftardan ko'chirish. Serverda ham FAQAT
     rahbarga ochiq: pul harakatisiz qarz tug'dirish `adjust` bilan bir
     xil xavf. Tugmani kassirga ko'rsatib, keyin 403 berish esa
     tushunarsiz bo'lardi. */
  const [manualDebt, setManualDebt] = useState(false);
  const [savingDebt, setSavingDebt] = useState(false);

  const saveManualDebt = async (payload) => {
    setSavingDebt(true);
    try {
      const r = await customerApi.addManualDebt(payload);
      toast.success(r?.message || t("common.saved"));
      setManualDebt(false);
      /* Ro'yxat DARHOL yangilanadi: do'koncha endigina kiritgan
         qarzdorni ko'rmasa, «yozildimi?» degan savol qolardi.
         Tugma faqat qarzdorlar ro'yxatida turadi, ya'ni `loadData`
         aynan shu ro'yxatni qayta o'qiydi. */
      await loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDebt(false);
    }
  };
  /**
   * Qarz eslatmalarini darhol yuborish (V44).
   *
   * ⚠ Natija ANIQ aytiladi: «0 ta» ham javob. Sozlama o'chiq bo'lsa yoki
   * hammaga yaqinda yuborilgan bo'lsa hech narsa ketmaydi va egasi buni
   * bilishi kerak — aks holda u tugmani qayta-qayta bosardi.
   */
  const remindDebtors = async () => {
    setReminding(true);
    try {
      const r = await customerApi.remindDebtors();
      const n = Number(r?.data) || 0;
      if (n > 0) toast.success(t("credit.remindSent", { n }));
      else toast.info(t("credit.remindNone"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReminding(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 className="page-title">{t("cust.title")}</h2>
        </div>
        <BranchSelector selectedId={branchId} onSelect={setBranchId} />
      </div>
      <div className="card">
        <div className="card-header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("cust.search")}
            style={{ width: 280 }}
          />
          {/* Qarzdorlar — alohida RO'YXAT, filtr emas: u serverdan qarz
              bo'yicha saralangan holda va qarz yoshi bilan keladi. */}
          <div className="cat-tabs" role="tablist" aria-label={t("credit.debtors")}>
            {[["all", t("common.all")], ["debtors", t("credit.debtors")]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k}
                      className={`cat-tab ${view === k ? "active" : ""}`}
                      onClick={() => setView(k)}>
                {label}
              </button>
            ))}
          </div>
          {/* Eslatma tugmasi FAQAT muddati o'tgan qarz bo'lganda (V44).
              Yuboradigan narsa yo'q joyda turgan tugma bosiladi-yu,
              «0 ta yuborildi» deydi — bu foydali emas, chalg'ituvchi.
              Kunlik ish har kuni 10:30 da o'zi yuboradi; bu tugma
              sozlamani endigina yoqqan egaga «ishlayaptimi?» degan
              javobni beradi. Haftalik oyna bu yerda ham amal qiladi. */}
          {hasOverdue && (
            <button className="btn btn-outline btn-sm" onClick={remindDebtors} disabled={reminding}>
              <i className="fa-solid fa-bell" /> {t("credit.remindNow")}
            </button>
          )}
          {/* Qarzdorlar ro'yxatida asosiy amal — MIJOZ emas, QARZ
              qo'shish: do'koncha bu ro'yxatga aynan daftarini
              ko'chirish uchun kiradi. */}
          {view === "debtors" && isManager && (
            <button className="btn btn-outline btn-sm" onClick={() => setManualDebt(true)}>
              <i className="fa-solid fa-file-pen" /> {t("credit.manualAdd")}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Mijoz qo'shish
          </button>
        </div>

        <div className="table-wrap">
          {busy ? (
            <SkeletonTable rows={7} cols={["wide", "text", "num", "narrow"]} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("cust.col")}</th>
                  <th>{t("common.phone")}</th>
                  {/* ⚠ Chegara ustuni OLIB TASHLANDI (V46) va o'rniga
                      «qachondan beri qarzdor» turadi. Chegara endi yo'q;
                      qarzning YOSHI esa qaror uchun aynan kerak: bugungi
                      300 ming va yarim yillik 300 ming boshqa gap. */}
                  {view === "debtors"
                    ? <><th>{t("credit.debtSince")}</th><th>{t("credit.since")}</th>
                        {/* Muddati o'tgan qism (V43) — do'kon muddat
                            qo'ymagan bo'lsa ustun umuman chizilmaydi:
                            har qatorda nol turgan ustun jadvalni
                            kengaytiradi-yu, hech narsa aytmaydi. */}
                        {hasOverdue && <th>{t("credit.overdue")}</th>}</>
                    : <th>{t("cust.totalSpent")}</th>}
                  <th>{t("credit.balance")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={c.fullName} size={30} />
                          <span className="fw-700">{c.fullName}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 13 }}>{maskPhone(c.phone)}</td>
                      {view === "debtors" ? (
                        <>
                          <td className="mono" style={{ fontSize: 13 }}>
                            {c.debtSince
                              ? shortDate(c.debtSince)
                              : <span className="text-muted">—</span>}
                          </td>
                          {/* Qarz yoshi — kunlarda. Jurnalsiz eski qarzda
                              sana yo'q, shunda chiziqcha qo'yiladi: "0 kun"
                              yozilsa u yangi qarzdek ko'rinardi. */}
                          <td>
                            {daysSince(c.lastChargeAt) == null
                              ? <span className="text-muted">—</span>
                              : <span className="mono">{t("credit.daysAgo").replace("{n}", daysSince(c.lastChargeAt))}</span>}
                          </td>
                          {hasOverdue && (
                            <td>
                              {Number(c.overdue) > 0
                                ? <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(c.overdue)}</span>
                                : <span className="text-muted">—</span>}
                            </td>
                          )}
                        </>
                      ) : (
                        <td>
                          <span className="mono fw-700 text-blue">{money(c.totalSpent)}</span>
                        </td>
                      )}
                      {/* Qarz — MUSBAT bo'lsa qizil: bu do'konning pulini
                          ushlab turgan summa va u ko'zga tashlanishi kerak. */}
                      <td>
                        {/* ⚠ QARZSIZDA «0», TIRE EMAS. Tire «ma'lumot
                            yo'q» degani va do'kon egasini «hisoblanmagan
                            bo'lsa kerak» deb o'ylatardi. Nol esa ANIQ
                            javob: bu mijoz hech narsa qarz emas.
                            Rangi ham boshqa — qizil faqat haqiqiy qarzda. */}
                        {Number(c.balance) > 0
                          ? <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(c.balance)}</span>
                          : <span className="mono text-muted">{money(0)}</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {/* ⚠ TUGMA QARZ TUGAGACH HAM QOLADI (V60).
                              Ilgari sharti faqat `balance > 0` edi:
                              mijoz qarzini to'liq to'lagach tugma
                              yo'qolar va u bilan birga JURNAL OYNASIGA
                              kiradigan yagona eshik ham yo'qolardi —
                              «qachon, qancha to'ladi?» degan savolga
                              javob berib bo'lmasdi. Jurnal bazada ham,
                              API da ham joyida edi; yetishmagani eshik
                              edi.

                              Balansning o'zi yetarli emas: nol balans
                              «hech qachon qarz olmagan» va «olib, to'lab
                              bo'lgan» ni ajratmaydi. Shu sabab server
                              `hasDebtHistory` ni aytadi.

                              Qarzi borida — to'lash, tugaganida —
                              tarix: ikkalasi bitta oyna, lekin tugma
                              nima qilishini aniq aytishi kerak. */}
                          {(Number(c.balance) > 0 || c.hasDebtHistory) && (
                            <button className="btn-icon"
                                    title={Number(c.balance) > 0 ? t("credit.pay") : t("credit.history")}
                                    aria-label={Number(c.balance) > 0 ? t("credit.pay") : t("credit.history")}
                                    onClick={() => openDebt(c)}>
                              <i className={`fa-solid ${Number(c.balance) > 0
                                  ? "fa-hand-holding-dollar" : "fa-clock-rotate-left"}`} />
                            </button>
                          )}
                          {/* Qarzdorlar ro'yxatida tahrirlash/o'chirish YO'Q:
                              u yerdagi qator to'liq mijoz yozuvi emas (server
                              faqat qarz uchun kerakli maydonlarni yuboradi)
                              va formani undan to'ldirish chegarani jimgina
                              buzardi. */}
                          {view === "all" && (
                            <>
                              <button className="btn-icon" onClick={() => openEdit(c)}>
                                <i className="fa-solid fa-pen" />
                              </button>
                              {/* ⚠ JAMG'ARMA TUGMASI DOIM BOR (V63),
                                  qoldiq nol bo'lsa ham: kassir aynan
                                  shu yerdan pul QO'SHADI. Qarz
                                  tugmasidan farqi shunda — u tarixni
                                  ochadi, bu esa ish qildiradi. */}
                              <button className="btn-icon" title={t("savings.title")}
                                      aria-label={t("savings.title")}
                                      onClick={() => openSavings(c)}>
                                <i className="fa-solid fa-sack-dollar"
                                   style={Number(c.savingsBalance) > 0
                                     ? { color: "var(--fg-success)" } : undefined} />
                              </button>
                              {/* ═══ ⚠ O'CHIRISH TUGMASI YO'Q — ATAYLAB (V62)
                                  Ilgari bu yerda rahbarga ochiq savat
                                  tugmasi turardi.

                                  Yozuv MIJOZNIKI: unda odamning ismi,
                                  telefoni, xarid tarixi va ballari
                                  yotadi. Do'kon uni ro'yxatdan yashira
                                  olsa, mijoz o'z ma'lumoti ustidan
                                  nazoratini yo'qotardi.

                                  ⚠ Rolni qattiqroq qilish yetmasdi:
                                  masala huquqda emas, EGALIKDA. Server
                                  ham endi bu yo'lni bermaydi —
                                  `DELETE /customers/{id}` UMUMAN yo'q.

                                  O'chirishni mijozning o'zi ilovadan
                                  qiladi («Hisobni o'chirish»). ═══ */}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={view === "debtors" ? 6 : 5}>
                      <Empty icon="fa-users"
                             text={view === "debtors" ? t("credit.noDebtors") : t("cust.notFound")} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal
          title={modal === "add" ? t("cust.new") : t("cust.edit")}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={closeModal}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner /> : <i className="fa-solid fa-check" />}
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <FormGroup label={`${t("common.fullName")} *`}>
            <Field
              kind="name"
              className="form-input"
              value={form.fullName}
              onChange={setField("fullName")}
              placeholder="Abdullayev Ali"
              autoFocus
            />
          </FormGroup>
          <FormGroup label={`${t("common.phone")} *`}>
            <PhoneField
              className="form-input mono ek-num"
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </FormGroup>
        </Modal>
      )}

      {/* ── QO'LDA QARZDOR (V48) ── */}
      {manualDebt && (
        <ManualDebtModal
          onClose={() => setManualDebt(false)}
          onSave={saveManualDebt}
          saving={savingDebt}
        />
      )}

      {/* ── QARZ OYNASI (V47): jurnal + KASSA KO'RINISHIDAGI to'lov ────
          ⚠ To'lov ALOHIDA oynada: kassa kabi katta summa, to'lov turi
          katakchalari va raqamli klaviatura bilan. Jurnalni ham, raqamli
          klaviaturani ham bitta oynaga tiqish uni ekrandan uzun qilardi. */}
      {debt && !payOpen && (
        <Modal
          /* Sarlavha holatga qarab: qarzi borida «Qarz», tugaganida
             «Qarz tarixi» — oyna bir xil, savol boshqa. */
          title={`${Number(debt.customer.balance) > 0 ? t("credit.title") : t("credit.history")}`
                 + ` — ${debt.customer.fullName}`}
          onClose={() => setDebt(null)}
          /* ⚠ KENG (720): jurnalda endi to'rt ustun bor — tur, SANA-VAQT,
             izoh va summa. 520 da sana summani siqib, raqamlar
             o'ralib ketardi. */
          maxWidth={720}
          footer={
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setDebt(null)}>
                {t("common.close")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setPayOpen(true)}
                      disabled={!(Number(debt.customer.balance) > 0)}>
                <i className="fa-solid fa-hand-holding-dollar" /> {t("credit.pay")}
              </button>
            </>
          }
        >
          <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="fw-700">{t("credit.balance")}</span>
            {/* ⚠ QIZIL — do'kon ushlab turgan pul. Nol esa yomon xabar
                emas: qarz yopilgan. Uni ham qizil qilib ko'rsatish
                tarixni ochgan egaga «hali ham muammo bor» degan yolg'on
                taassurot berardi. */}
            <span className="mono fw-800"
                  style={{ color: Number(debt.customer.balance) > 0
                    ? "var(--fg-danger)" : "var(--fg-success)" }}>
              {money(debt.customer.balance)}
            </span>
          </div>
          {/* ⚠ Chegara O'RNIGA «qachondan beri qarzdor» (V46): «yana
              nasiya berish mumkinmi» degan savolga endi raqam emas,
              qarzning yoshi javob beradi. */}
          {debt.customer.debtSince && (
            <div className="row text-muted" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
              <span>{t("credit.debtSince")}</span>
              <span className="mono">{shortDate(debt.customer.debtSince)}</span>
            </div>
          )}

          {/* Jurnal — "qarz qayerdan chiqdi" degan savolga javob. */}
          <div className="form-label" style={{ marginTop: 14 }}>{t("credit.ledger")}</div>
          {/* ⚠ BALANDLIK EKRANGA QARAB (`vh`), qat'iy 220px EMAS. Ilgari
              oynada bor-yo'g'i to'rt qator ko'rinardi va yillik qarz
              tarixi millimetrlab aylantiriladigan darchadan o'qilardi.
              Endi bo'sh joyning yarmigacha cho'ziladi; kichkina
              monoblokda esa `min()` uni 260px dan pastga tushirmaydi,
              ya'ni oyna ekrandan chiqib ketmaydi. */}
          <div className="table-wrap"
               style={{ maxHeight: "min(52vh, 520px)", minHeight: 260, overflowY: "auto" }}>
            <table>
              <tbody>
                {(debt.ledger || []).map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{t(`credit.type.${l.type}`)}</td>
                    {/* ⚠ SANA VA VAQT (do'kon egasining talabi). Usiz
                        jurnal «kim qachon nima qildi» degan savolga
                        javob bermasdi: bir kunda ikkita to'lov bo'lsa,
                        qaysi biri ertalab, qaysi biri kechqurun ekani
                        ko'rinmasdi — tortishuv esa aynan shundan
                        boshlanadi. VAQT ham kerak, faqat sana emas. */}
                    <td className="mono text-muted"
                        style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {dateTime(l.createdAt)}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {l.saleId
                        ? <button type="button" className="ek-linkbtn"
                                  onClick={() => openSale(l.saleId)}
                                  disabled={saleLoading === l.saleId}
                                  title={t("sales.details")}>
                            {saleLoading === l.saleId ? <Spinner small /> : `#${l.saleId}`}
                          </button>
                        : (l.reason || "—")}
                      {/* ⚠ MIJOZ TASDIG'I (V46) — aynan shu qatorda.
                          Tortishuv «qaysi qarz?» degan savoldan
                          boshlanadi: holat qarzdan ajralib, alohida
                          ro'yxatda tursa, do'kon ularni o'zi
                          solishtirishga majbur bo'lardi.
                          `NONE` ko'rsatilmaydi: «so'ralmagan» — bu
                          xabar emas, shovqin. */}
                      {l.confirmState && l.confirmState !== "NONE" && (
                        <div style={{ fontSize: 11, marginTop: 2 }}
                             className={l.confirmState === "REJECTED" ? "text-danger" : "text-muted"}>
                          {t(`debt.state.${l.confirmState}`)}
                          {l.confirmNote ? ` — «${l.confirmNote}»` : ""}
                        </div>
                      )}
                    </td>
                    {/* ⚠ ISHORA MIJOZNING KO'ZI BILAN (foydalanuvchi
                        talabi): qarz — MANFIY, to'lov — MUSBAT. Ilgari
                        teskari edi (balans o'sishi «+» bilan) va do'kon
                        egasi jurnalga qarab «bu men olganmi yoki men
                        berganmi?» deb o'ylab qolardi.

                        ⚠ `ADJUSTMENT` ning summasi O'ZI imzoli, shuning
                        uchun u ham shunchaki teskarilanadi: qarzni
                        kamaytirgan to'g'irlash «+» bo'lib, yashil
                        chiqadi — to'lov bilan bir xil ma'noda. */}
                    <td className="mono fw-700"
                        style={{ color: ledgerSigned(l) >= 0 ? "var(--fg-success)" : "var(--fg-danger)" }}>
                      {ledgerSigned(l) >= 0 ? "+" : "−"}{money(Math.abs(ledgerSigned(l)))}
                    </td>
                    {/* ⚠ CHEK FAQAT TO'LOVDA (V61). Qarz qatorining
                        cheki — o'sha sotuvning cheki va u yonidagi
                        `#id` tugmasidan ochiladi; to'g'irlashda esa
                        umuman chek yo'q (mijoz pul bermagan). Har
                        qatorga tugma qo'yish jurnalni tugmalar
                        devoriga aylantirardi. */}
                    <td style={{ width: 34, textAlign: "right" }}>
                      {/* ⚠ QARZ QATORIDA HAM CHEK BOR (V62). Ilgari
                          faqat to'lovda edi va qarz olgan mijozning
                          qo'lida hech narsa qolmasdi — ayniqsa QO'LDA
                          kiritilgan qarzda (daftardan ko'chirilgan),
                          u yerda sotuv ham, chek ham umuman yo'q.

                          TO'G'IRLASHDA tugma YO'Q: uni mijoz emas,
                          do'kon qiladi (kechirdi, xato tuzatdi) va
                          server ham uni ochmaydi. */}
                      {l.type !== "ADJUSTMENT" && (
                        <button type="button" className="btn-icon"
                                title={t("credit.receipt")}
                                aria-label={t("credit.receipt")}
                                disabled={receiptLoading === l.id}
                                onClick={() => openReceipt(l.id)}>
                          {receiptLoading === l.id
                            ? <Spinner small />
                            : <i className="fa-solid fa-receipt" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {debt.ledger && debt.ledger.length === 0 && (
                  <tr><td colSpan={5}><Empty icon="fa-receipt" text={t("credit.noDebt")} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Kassa ko'rinishidagi to'lov oynasi (V47). */}
      {debt && payOpen && (
        <DebtPayModal
          customer={debt.customer}
          paying={paying}
          onClose={() => setPayOpen(false)}
          onSubmit={submitDebt}
        />
      )}

      {/* ⚠ CHEK TAFSILOTI ENG OXIRIDA chiziladi (V47): u qarz oynasining
          USTIDAN ochilishi kerak. Ilgari u yuqorida turardi va bir xil
          `z-index` da DOM tartibi hal qilardi — chek oynasi qarz
          oynasining ORQASIDA qolib, ko'rinmasdi. */}
      <SaleDetailModal sale={saleDetail} onClose={() => setSaleDetail(null)} />

      {/* ⚠ TO'LOV CHEKI ENG OXIRIDA — chek tafsiloti bilan bir xil
          sabab: u qarz oynasining USTIDAN ochilishi kerak va bir xil
          `z-index` da buni DOM tartibi hal qiladi. */}
      {savings && (
        <SavingsModal
          account={savings.account}
          customer={savings.customer}
          canRefund={isManager}
          busy={savingsBusy}
          onTopUp={runSavings(customerApi.topUpSavings)}
          onRefund={runSavings(customerApi.refundSavings)}
          onClose={() => setSavings(null)}
        />
      )}

      {receipt && (
        <Suspense fallback={null}>
          <PaymentReceipt data={receipt} onClose={() => setReceipt(null)} />
        </Suspense>
      )}
    </div>
  );
}
