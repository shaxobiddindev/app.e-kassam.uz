import { useState } from "react";
import { useT } from "../lib/ek-i18n";
import { roleSet } from "../lib/ek-roles";
import MobileHome from "./MobileHome";
import MobileReports from "./MobileReports";
import MobileSales from "./MobileSales";
import MobileSettings from "./MobileSettings";

/* ══════════════════════════════════════════════════════════════════════════
   MOBIL ILOVA — do'kon EGASINING nazorat ilovasi.

   ⚠ Bu kassa ilovasining nusxasi EMAS (foydalanuvchi qarori, 2026-08-14):
   telefonda savdo qilinmaydi — telefonda KUZATILADI. Shu sababli daraxt
   butunlay alohida: kassa, ombor, formalar yo'q; faqat «bugun ishlar
   qanday?» savoliga javob beradigan ekranlar. Barkod maydoni yo'qligi
   klaviatura o'z-o'zidan ochilishini ham yo'q qiladi.

   Ekranlar (pastki navigatsiya):
     · Bosh     — bugungi raqamlar + «e'tibor talab qiladi»
     · Hisobot  — kun / hafta / oy
     · Sotuvlar — oxirgi cheklar lentasi
     · Sozlash  — Telegram, til, tema, chiqish

   Kassir bu ilovaga kirsa, unga «bu ilova egasi uchun» ekrani chiqadi:
   pul hisobotlari unga baribir yopiq (server ham 403 qaytaradi).
   ══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: "home",     icon: "fa-house" },
  { key: "reports",  icon: "fa-chart-column" },
  { key: "sales",    icon: "fa-receipt" },
  { key: "settings", icon: "fa-gear" },
];

export default function MobileApp({ user, logout, toast }) {
  const { t } = useT();
  const [tab, setTab] = useState("home");
  const [branchId, setBranchId] = useState(null);

  const roles = roleSet(user?.role);
  const isManager = roles.has("OWNER") || roles.has("SHOP_ADMIN");

  if (!isManager) {
    return (
      <div className="m-app">
        <div className="m-guard">
          <i className="fa-solid fa-user-shield" aria-hidden="true" />
          <h2>{t("m.guardTitle")}</h2>
          <p>{t("m.guardText")}</p>
          <button className="btn btn-outline" onClick={logout}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> {t("layout.logout")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-app">
      <main className="m-page">
        {tab === "home"     && <MobileHome     toast={toast} branchId={branchId} setBranchId={setBranchId} />}
        {tab === "reports"  && <MobileReports  toast={toast} branchId={branchId} />}
        {tab === "sales"    && <MobileSales    toast={toast} branchId={branchId} />}
        {tab === "settings" && <MobileSettings toast={toast} user={user} logout={logout} />}
      </main>

      <nav className="m-nav" aria-label={t("m.nav")}>
        {TABS.map(({ key, icon }) => (
          <button key={key} type="button"
                  className={`m-nav__btn ${tab === key ? "active" : ""}`}
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => setTab(key)}>
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
            <span>{t(`m.tab.${key}`)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
