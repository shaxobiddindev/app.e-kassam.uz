import { useState } from "react";
import { useT } from "../lib/ek-i18n";
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
     · Sozlash  — Telegram, til, tema, «To'liq panel», chiqish

   ⚠ Bu daraxtga FAQAT egasi/do'kon admini tushadi — routing App.jsx da:
   kassir/omborchi to'g'ridan-to'g'ri TO'LIQ daraxtni oladi (V34), shuning
   uchun bu yerda rol to'sig'i YO'Q. Pul hisobotlari serverda baribir
   rol bilan himoyalangan (403).
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
