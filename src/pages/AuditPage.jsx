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
import { dateTime } from "../lib/ek-format";
import DataFilter, { useDataFilter, SortTh } from "../components/ek/DataFilter";
import { AUDIT_ACTIONS as ACTIONS, AUDIT_MONEY as MONEY } from "../lib/ek-audit";
import { asArray } from "../lib/ek-array";

/* ⚠ RO'YXAT ENDI `lib/ek-audit.js` DA (V81).

   U shu yerda, sahifaning ichida edi va aynan shuning uchun sinovdan
   tekshirilmasdi: React sahifasini Node'dan yuklab bo'lmaydi.
   Natijada ro'yxat jimgina eskirdi — serverda amal qo'shilardi, bu
   yerda esa yo'q.

   O'shanda yigirmata amal turardi, do'konga esa qirq bittasi kelardi.
   Qolgani — `TRANSFER_*`, `BONUS_*`, `CART_ABANDONED`, `DEVICE_*` va
   hatto `SUBSCRIPTION_EXPIRED` — jurnalda KO'RINARDI, lekin
   tanlanmasdi; ustiga o'n beshtasining yorlig'i ham yo'q edi va ular
   ekranda xom kalit bo'lib chiqardi («enum.audit.TRANSFER_SEND»). */

/* ⚠ SANA+VAQT — `lib/ek-format.js` dan (V70). Uchta sahifada
   uchta bir xil mahalliy nusxa bor edi va ular `uz-UZ` ni
   qattiq yozardi: ruscha yoki inglizcha tanlagan foydalanuvchi
   ham o'zbekcha sanani ko'rardi. */
const fmtT = dateTime;

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
      setRows(asArray(r.data?.items));
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
    /* ⚠ QIYMATLAR HAM QIDIRUVGA KIRADI (V106). Tekshiruv ko'pincha
       raqamdan boshlanadi — «9 000 ga kim tushirgan?» — va u faqat
       shu ikki ustunda turadi. */
    { key: "sum",   label: t("audit.summary"),  type: "text",
      get: (r) => `${r.summary || ""} ${r.details || ""} ${r.oldValue || ""} ${r.newValue || ""}` },
    { key: "actor", label: t("audit.actor"),    type: "text",
      get: (r) => (r.actorType === "ADMIN" ? t("audit.actorSupport") : r.actorUsername) },
    /* ⚠ TERMINAL — ALOHIDA FILTR (V106): «shu kassada nima bo'ldi?»
       degan savol tekshiruvning o'zagi va IP unga javob bermaydi —
       bitta do'kondagi hamma terminal bitta routerdan chiqadi.
       Server ham aynan shu ustun uchun indeks yaratgan (V77). */
    { key: "term",  label: t("audit.terminal"), type: "text",
      get: (r) => r.terminalId || "" },
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
                      {/* ⚠ `badge-orange` USLUBI YO'Q EDI (V81) va natija
                          maqsadning TESKARISI bo'lardi: pulga tegadigan
                          qator — jurnalning butun ma'nosi — YAGONA
                          foni yo'q qator bo'lib chiqardi, qolgan hammasi
                          esa ko'k belgi bilan turardi. Sariq — `styles.css`
                          da mavjud va ogohlantirish rangi. */}
                      <span className={`badge badge-${MONEY.has(r.action) ? "yellow" : "blue"}`}>
                        {t(`enum.audit.${r.action}`)}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.summary}
                      {/* ⚠ OLDINGI → YANGI (V106). Server buni V101 dan
                          beri yozadi, ekran esa ko'rsatmasdi: ya'ni
                          tekshiruvda birinchi so'raladigan ikki raqam
                          bazada bor-u, egasining ko'zi oldida yo'q edi.

                          Matn ichida emas, ALOHIDA qatorda: «narx
                          12 000 dan 9 000 ga tushirildi» degan gapni
                          o'qish kerak, `12 000 → 9 000` esa bir
                          qarashda ko'rinadi.

                          ⚠ Faqat bittasi bo'lsa o'q CHIZILMAYDI:
                          yaratishda eski qiymat yo'q va «→ 9 000»
                          «nimadandir 9 000 ga» degan yolg'on taassurot
                          berardi. */}
                      {(r.oldValue || r.newValue) && (
                        <div className="audit-chg mono">
                          {r.oldValue && <span className="audit-chg__old">{r.oldValue}</span>}
                          {r.oldValue && r.newValue && (
                            <i className="fa-solid fa-arrow-right-long audit-chg__arrow" aria-hidden="true" />
                          )}
                          {r.newValue && <span className="audit-chg__new">{r.newValue}</span>}
                        </div>
                      )}
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
                      {/* ⚠ QAYSI KASSADAN (V106) — «kim» bilan bir
                          katakda: tekshiruvda ular birga so'raladi
                          («kim, qayerdan») va alohida ustun jadvalni
                          kengaytirib, telefonda yon-tomonga surardi.

                          Eski yozuvlarda bo'sh — o'shanda hech narsa
                          chizilmaydi: bo'sh chip «noma'lum terminal»
                          degan yolg'on ma'lumot bo'lardi. */}
                      {r.terminalId && (
                        <div className="audit-term" title={t("audit.terminal")}>
                          <i className="fa-solid fa-cash-register" aria-hidden="true" />
                          {r.terminalId}
                        </div>
                      )}
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
