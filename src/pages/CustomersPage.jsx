import { useState, useEffect } from "react";
import { t } from "../lib/ek-i18n";
import { customerApi } from "../api";
import { BranchSelector } from "../components";
import { maskPhone, cleanPhone, money } from "../config";
import Modal from "../components/Modal";
import { Empty, Field, SearchBar, Avatar, FormGroup } from "../components/ui";
import { useConfirm } from "../context/ConfirmProvider";
import { roleSet } from "../lib/ek-roles";
import { useAuth } from "../hooks/useAuth";
import { shortDate } from "../lib/ek-format";
import SaleDetailModal from "../components/SaleDetailModal";
import DebtPayModal from "../components/DebtPayModal";
import { printDebtReceipt } from "../lib/ek-hardware";
import { saleApi } from "../api";
import { SkeletonTable, Spinner } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import { PhoneField } from "../components/ek/EkFields";

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
  /* O'chirish — faqat egasi va do'kon administratori. */
  const canDelete = [...roleSet(user?.role)].some((r) => r === "OWNER" || r === "SHOP_ADMIN");
  const [payOpen, setPayOpen] = useState(false);
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
      const r = await customerApi.payDebt(debt.customer.id, { amount, method });
      const left = Number(r?.data) || 0;
      toast.success(`${t("credit.left")}: ${money(left)}`);

      /* ⚠ CHEK MIJOZ UCHUN (V47). U pul berdi va buning izini olishi
         kerak — aks holda «to'lagandim-ku» degan tortishuv yana
         do'konning so'ziga qarshi mijozning so'zi bo'lib qolardi.
         Chop etish XATOSI to'lovni bekor qilmaydi: pul allaqachon
         kassada va chekni qayta chiqarish mumkin. */
      try {
        await printDebtReceipt({
          customer: debt.customer, amount, method, balanceAfter: left,
          shopName: localStorage.getItem("ek_shopName") || localStorage.getItem("ek_shopCode") || "",
          cashier: localStorage.getItem("ek_fullName") || "",
          date: new Date(),
        });
      } catch (e) {
        toast.info(e.message || t("hw.errPopup"));
      }

      setPayOpen(false);
      setDebt(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
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

  /**
   * MIJOZNI RO'YXATDAN OLIB TASHLASH (V47).
   *
   * ⚠ ILGARI BU TUGMA UMUMAN ISHLAMASDI: u `customerApi.delete` ni
   * chaqirardi, bunday metod esa YO'Q edi — bosilganda jimgina
   * `TypeError` chiqardi (foydalanuvchi shikoyati: «o'chirsa o'chmay
   * qolyapti»).
   *
   * ⚠ Matn ROSTINI aytadi: bu arxivlash, ya'ni xaridlar tarixi va qarz
   * jurnali saqlanadi. «Butunlay o'chirildi» deb yozish yolg'on bo'lardi
   * va do'kon egasi keyin hisobotda o'sha mijozni ko'rib hayron qolardi.
   */
  const handleDelete = async (customer) => {
    const ok = await confirm({
      title: t("cust.delete"),
      message: t("cust.deleteAsk").replace("{name}", customer.fullName),
      type: "danger",
      confirmText: t("cust.delete"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await customerApi.remove(customer.id);
      toast.success(t("cust.deleted"));
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const filtered = customers.filter((c) =>
    c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  /* Muddat qo'yilgan do'konda kamida bitta qarz kechikkanmi (V43).
     Ustun shu holatda chiziladi: muddatsiz do'konda u har qatorda
     chiziqcha ko'rsatib, jadvalni bekorga kengaytirardi. */
  const hasOverdue = view === "debtors" && customers.some((c) => Number(c.overdue) > 0);

  const [reminding, setReminding] = useState(false);
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
                        {Number(c.balance) > 0
                          ? <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(c.balance)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {Number(c.balance) > 0 && (
                            <button className="btn-icon" title={t("credit.pay")} onClick={() => openDebt(c)}>
                              <i className="fa-solid fa-hand-holding-dollar" />
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
                              {/* ⚠ O'CHIRISH FAQAT RAHBARGA (V47). Kassir
                                  mijozlar bilan to'liq ishlaydi, lekin
                                  o'zi xizmat qilgan mijozni ro'yxatdan
                                  yashira olsa, qarzdorni ham, nizoni ham
                                  ko'zdan yo'qota olardi. Server ham shu
                                  qoidani qo'yadi (`SecurityConfig`). */}
                              {canDelete && (
                                <button className="btn-icon danger" title={t("cust.delete")}
                                        onClick={() => handleDelete(c)}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              )}
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

      {/* ── QARZ OYNASI (V47): jurnal + KASSA KO'RINISHIDAGI to'lov ────
          ⚠ To'lov ALOHIDA oynada: kassa kabi katta summa, to'lov turi
          katakchalari va raqamli klaviatura bilan. Jurnalni ham, raqamli
          klaviaturani ham bitta oynaga tiqish uni ekrandan uzun qilardi. */}
      {debt && !payOpen && (
        <Modal
          title={`${t("credit.title")} — ${debt.customer.fullName}`}
          onClose={() => setDebt(null)}
          maxWidth={520}
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
            <span className="mono fw-800" style={{ color: "var(--fg-danger)" }}>{money(debt.customer.balance)}</span>
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
          <div className="table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
            <table>
              <tbody>
                {(debt.ledger || []).map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{t(`credit.type.${l.type}`)}</td>
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
                  </tr>
                ))}
                {debt.ledger && debt.ledger.length === 0 && (
                  <tr><td colSpan={3}><Empty icon="fa-receipt" text={t("credit.noDebt")} /></td></tr>
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
    </div>
  );
}
