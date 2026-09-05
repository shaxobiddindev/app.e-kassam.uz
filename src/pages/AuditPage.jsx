/* ══════════════════════════════════════════════════════════════════════════
   Amallar jurnali — DO'KON egasi uchun

   Ilgari jurnal faqat `/superadmin/audit` da edi: do'kon egasi o'z
   do'konida kim nima qilganini ko'ra olmasdi, holbuki pulga va tovarga
   tegadigan amallarning deyarli hammasi uniki.

   ⚠ Bajik tasdiqlari bu yerda EMAS — ular «Xavfsizlik» bo'limida. Ikkalasi
   boshqa savolga javob beradi: bu yerda «nima bo'ldi», u yerda «kim
   tasdiqladi».
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { shopApi } from "../api";
import { Empty, SearchBar } from "../components/ui";
import Select from "../components/ek/Select";
import { SkeletonTable } from "../components/ek/Loading";
import { useLoading } from "../lib/use-loading";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";

/* Ro'yxat qo'lda sanab chiqiladi: server enum'ni qaytarmaydi va uni
   olish uchun alohida endpoint ochish ortiqcha bo'lardi. Yangi amal
   qo'shilganda shu yerga ham qo'shiladi (lug'atga ham). */
const ACTIONS = [
  "SHIFT_CLOSE", "CASH_MOVEMENT", "SALE_CANCEL", "SALE_RETURN",
  "PRICE_CHANGE", "PRICE_BULK_CHANGE", "STOCK_TAKE_CLOSE", "STOCK_TAKE_CANCEL",
  "EXPENSE_CREATE", "EXPENSE_DELETE", "GOODS_RECEIPT", "SUPPLIER_PAYMENT",
  "CUSTOMER_DEBT_ADJUST", "SHOP_SETTING_CHANGE",
  "USER_CREATE", "USER_UPDATE", "USER_DELETE", "USER_BLOCK", "USER_UNBLOCK",
  "USER_PASSWORD_CHANGE",
];

/* Pulga tegadigan amallar ko'zga tashlanadi — jurnalning asosiy
   maqsadi aynan ularni topish. */
const MONEY = new Set([
  "CASH_MOVEMENT", "SALE_CANCEL", "SALE_RETURN", "EXPENSE_DELETE",
  "CUSTOMER_DEBT_ADJUST", "SHOP_SETTING_CHANGE", "PRICE_BULK_CHANGE",
]);

const fmtT = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function AuditPage({ toast }) {
  /* Filtr manzilda ham turadi: bosh sahifadagi «Kassa kamomadi» satri shu
     yerga `?action=SHIFT_CLOSE` bilan olib keladi. Manzilsiz signal
     egasini filtrsiz jurnalga tashlab ketardi va u kerakli qatorni
     yuzta boshqasi orasidan qidirishga majbur bo'lardi. */
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(() => {
    const a = params.get("action");
    return ACTIONS.includes(a) ? a : "";
  });
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const busy = useLoading(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await shopApi.audit({ action: action || null, actor: actor || null, page, size: 50 });
      setRows(r.data?.items || []);
      setTotal(r.data?.totalItems || 0);
      setPages(r.data?.totalPages || 0);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [action, actor, page, toast]);

  useEffect(() => { load(); }, [load]);
  // Filtr o'zgarsa birinchi sahifaga qaytamiz — aks holda bo'sh sahifada
  // "jurnal bo'sh" ko'rinib, sabab tushunarsiz bo'lardi.
  useEffect(() => { setPage(0); }, [action, actor]);

  /* Tanlangan amal manzilga yoziladi — havola ulashiladi va F5 filtrni
     saqlaydi. `replace` bilan: har bir tanlov tarixga yozilsa, "orqaga"
     tugmasi foydalanuvchini eski filtrlar bo'ylab yurgizib chiqardi. */
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (action) next.set("action", action); else next.delete("action");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [action]);

  /* ══ USTUNLAR BO'YICHA FILTR (V68) ═════════════════════════════════
     ⚠ Yuqoridagi «amal» tanlagichi SERVERGA ketadi (sahifalash bilan),
     bu esa KELGAN sahifani kesadi. Ikkalasi bir-birini almashtirmaydi:
     server bittagina amalni bera oladi, bu yerda esa «narx VA
     chegirma» kabi kombinatsiya va sana oralig'i ishlaydi. */
  const COLS = useMemo(() => [
    { key: "date",  label: t("common.date"),    type: "date", get: (r) => r.createdAt },
    { key: "act",   label: t("audit.action"),   type: "enum",
      options: ACTIONS.map((a) => ({ value: a, label: t(`enum.audit.${a}`) })),
      get: (r) => r.action },
    { key: "sum",   label: t("audit.summary"),  type: "text",
      get: (r) => `${r.summary || ""} ${r.details || ""}` },
    { key: "actor", label: t("audit.actor"),    type: "text",
      get: (r) => (r.actorType === "ADMIN" ? t("audit.actorSupport") : r.actorUsername) },
  ], []);
  const colFlt = useDataFilter(COLS, "audit");
  const shown = colFlt.apply(rows);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 className="page-title">{t("audit.title")}</h2>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>{t("audit.hint")}</p>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Select
              value={action}
              onChange={setAction}
              ariaLabel={t("audit.action")}
              options={[{ value: "", label: t("audit.allActions"), icon: "fa-list" },
                ...ACTIONS.map((a) => ({ value: a, label: t(`enum.audit.${a}`), icon: "fa-clock-rotate-left" }))]}
            />
            <SearchBar value={actor} onChange={setActor} placeholder={t("audit.actor")} style={{ width: 220 }} />
            <DataFilter cols={COLS} flt={colFlt} />
          </div>
          <span className="text-muted mono" style={{ fontSize: 13 }}>{total}</span>
        </div>

        <div className="table-wrap">
          {busy ? <SkeletonTable rows={8} cols={["text", "text", "wide", "narrow"]} /> : (
            <table>
              <thead>
                <tr>
                  <SortTh flt={colFlt} col="date">{t("common.date")}</SortTh>
                  <SortTh flt={colFlt} col="act">{t("audit.action")}</SortTh>
                  <SortTh flt={colFlt} col="sum">{t("audit.summary")}</SortTh>
                  <SortTh flt={colFlt} col="actor">{t("audit.actor")}</SortTh>
                </tr>
              </thead>
              <tbody>
                {shown.length ? shown.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmtT(r.createdAt)}</td>
                    <td>
                      <span className={`badge badge-${MONEY.has(r.action) ? "orange" : "blue"}`}>
                        {t(`enum.audit.${r.action}`)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.summary}
                      {r.details && (
                        <div className="text-muted mono" style={{ fontSize: 11 }}>{r.details}</div>
                      )}
                    </td>
                    {/* ⚠ Platforma xodimi (`actorType === "ADMIN"`) do'kon xodimi EMAS.
                        Uning ichki foydalanuvchi nomi ("superadmin") egaga hech narsa
                        aytmaydi — u buni o'z xodimi deb o'ylashi mumkin. Shuning uchun
                        satr alohida belgilanadi; amalning O'ZI yashirilmaydi, aks holda
                        «narxni kim o'zgartirdi?» degan savol javobsiz qolardi. */}
                    <td className="mono text-muted" style={{ fontSize: 13 }}>
                      {r.actorType === "ADMIN" ? (
                        <span className="badge badge-orange" title={r.actorUsername}>
                          <i className="fa-solid fa-headset" aria-hidden="true" /> {t("audit.actorSupport")}
                        </span>
                      ) : r.actorType === "SYSTEM" ? (
                        <span className="badge badge-blue">
                          <i className="fa-solid fa-robot" aria-hidden="true" /> {t("audit.actorSystem")}
                        </span>
                      ) : r.actorUsername}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}><Empty icon="fa-clock-rotate-left" text={t("audit.none")} /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {pages > 1 && (
          <div className="card-body" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <span className="mono" style={{ alignSelf: "center", fontSize: 13 }}>{page + 1} / {pages}</span>
            <button className="btn btn-outline btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
