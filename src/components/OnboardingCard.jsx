import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../lib/ek-i18n";
import { productApi, saleApi, shopApi } from "../api";
import CatalogWizard from "./CatalogWizard";

/* ══════════════════════════════════════════════════════════════════════════
   Birinchi qadamlar (onboarding) — V31 ning davomi.

   MUAMMO: o'zi ro'yxatdan o'tgan ega BO'M-BO'SH ilovaga tushadi. Tayyor
   katalog ustasi bor-u (CatalogWizard), lekin u Mahsulotlar sahifasining
   ichida — yangi odam u yergacha yetib bormaydi. Sinov 14 kun; birinchi
   kunda tovar kiritilmasa, qolgan 13 kuni ham kelmaydi.

   YECHIM: bosh sahifaning tepasida 3 qadamlik jonli ro'yxat —
   katalog → birinchi sotuv → xodim. Har qadim holati HAQIQIY ma'lumotdan
   (bajarilgan qadam localStorage'ga emas, bazaga qarab belgilanadi).

   ⚠ ESKI DO'KONGA KO'RINMAYDI: tovar 30 tadan ko'p bo'lsa bu do'kon
   allaqachon yashayapti — bayroq yozilib, boshqa hech qachon so'ralmaydi.
   Bayroq do'kon kodiga bog'langan (`ek_onboard_<shopCode>`): bitta
   brauzerdan ikki do'konga kirganda adashmasin.
   ══════════════════════════════════════════════════════════════════════════ */

const doneKey = () => `ek_onboard_${localStorage.getItem("ek_shopCode") || ""}`;

export default function OnboardingCard({ toast }) {
  const navigate = useNavigate();
  const [state, setState] = useState(null);   // null — hali aniqlanmagan / ko'rinmaydi
  const [wizard, setWizard] = useState(false);
  const [tick, setTick] = useState(0);        // wizard tugagach qayta hisoblash

  useEffect(() => {
    if (localStorage.getItem(doneKey())) { setState(null); return; }
    let alive = true;
    (async () => {
      try {
        /* «Yashab turgan do'kon»ni SOTUV TARIXI aytadi, tovar soni emas:
           tayyor katalogning o'zi 77 tovar qo'shadi va tovar bo'yicha
           qisqartma kartani katalog qadamidan keyinoq yashirib, qolgan
           qadamlarni yo'qotgan edi. 20+ sotuv — onboarding unga shovqin. */
        const sales = (await saleApi.getAll()).data || [];
        if (sales.length > 20) {
          localStorage.setItem(doneKey(), "auto");
          if (alive) setState(null);
          return;
        }
        const [products, users] = await Promise.all([
          productApi.getAll().then((r) => r.data || []).catch(() => []),
          shopApi.getUsers().then((r) => r.data || []).catch(() => []),
        ]);
        const steps = {
          catalog: products.length > 0,
          sale: sales.length > 0,
          staff: users.length > 1,
        };
        if (steps.catalog && steps.sale && steps.staff) {
          localStorage.setItem(doneKey(), "done");
          if (alive) setState(null);
          return;
        }
        if (alive) setState(steps);
      } catch (_) {
        if (alive) setState(null); // aniqlab bo'lmasa — indamay yo'q bo'lamiz
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  if (!state) return null;

  const rows = [
    {
      key: "catalog", done: state.catalog,
      icon: "fa-boxes-stacked",
      title: t("onb.catalog"), sub: t("onb.catalogSub"),
      action: () => setWizard(true),
    },
    {
      key: "sale", done: state.sale,
      icon: "fa-cash-register",
      title: t("onb.sale"), sub: t("onb.saleSub"),
      action: () => navigate("/sale"),
    },
    {
      key: "staff", done: state.staff,
      icon: "fa-users",
      title: t("onb.staff"), sub: t("onb.staffSub"),
      action: () => navigate("/shop-users"),
    },
  ];
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <div className="card onb" style={{ marginBottom: 14 }}>
      <div className="card-body">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <i className="fa-solid fa-flag-checkered" style={{ color: "var(--fg-brand)" }} aria-hidden="true" />
          <b style={{ fontSize: 14 }}>{t("onb.title")}</b>
          <span className="text-muted" style={{ fontSize: 12 }}>{doneCount}/3</span>
          {/* «Keyinroq» — butunlay emas, shu brauzerda yashiradi. Majburlab
              bo'lmaydi: eskirgan maslahat qaytaverishidan yomoni yo'q. */}
          <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }}
                  onClick={() => { localStorage.setItem(doneKey(), "dismissed"); setState(null); }}>
            {t("onb.later")}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <button key={r.key} type="button" className="onb__row" disabled={r.done}
                    onClick={r.action}>
              <i className={`fa-solid ${r.done ? "fa-circle-check" : r.icon}`}
                 style={{ color: r.done ? "var(--ek-green-700)" : "var(--fg-brand)", width: 18 }}
                 aria-hidden="true" />
              <span style={{ display: "flex", flexDirection: "column", textAlign: "left", minWidth: 0 }}>
                <b style={{ fontSize: 13, textDecoration: r.done ? "line-through" : "none" }}>{r.title}</b>
                {!r.done && <small className="text-muted" style={{ fontSize: 11.5 }}>{r.sub}</small>}
              </span>
              {!r.done && <i className="fa-solid fa-chevron-right" style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-tertiary)" }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      {wizard && (
        <CatalogWizard
          toast={toast}
          onClose={() => setWizard(false)}
          onDone={() => { setWizard(false); setTick((n) => n + 1); }}
        />
      )}
    </div>
  );
}
