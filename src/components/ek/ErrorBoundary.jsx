/* ══════════════════════════════════════════════════════════════════════════
   Xato to'sig'i — bitta buzuq bo'lak butun kassani o'chirmasin

   NEGA KERAK: React 18 da render paytidagi tutilmagan xato BUTUN daraxtni
   yechib tashlaydi. Amalda bu shunday ko'rindi: `SalesPage` da `Spinner`
   import qilinmagani uchun chek chiqarish tugmasi bosilganda `ReferenceError`
   bo'lib, ilova qoramtir BO'SH OYNAga aylandi — kassir uchun dastur
   "yiqilgandek". Kassa dasturida bu qimmat: smena o'rtasida oyna o'chsa,
   sotuv to'xtaydi.

   ⚠ Bu to'siq XATONI TUZATMAYDI va tuzatishning o'rnini bosmaydi. U faqat
   zararni CHEGARALAYDI: buzilgan sahifa o'rniga tushunarli xabar chiqadi,
   yon menyu joyida qoladi va kassir boshqa bo'limga o'tib ishlashda davom
   etadi. Xato matni ekranda ko'rsatiladi — qo'ng'iroq qilgan kassirdan
   "nima yozibdi?" deb so'rash mumkin.
   ══════════════════════════════════════════════════════════════════════════ */

import { Component } from "react";
import { useLocation } from "react-router-dom";
import { t } from "../../lib/ek-i18n";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Konsolga chiqarish — `.exe` da devtools yo'q, lekin remote debugging
    // bilan ulanilganda (WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS) shu yerdan
    // to'liq stack olinadi.
    console.error("ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center", padding: "48px 24px",
        minHeight: "60vh", gap: 14,
      }}>
        <i className="fa-solid fa-triangle-exclamation"
           style={{ fontSize: 44, color: "var(--warn, #E0A82E)" }} aria-hidden="true" />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("err.title")}</h2>
        <p style={{ maxWidth: 460, opacity: 0.7, lineHeight: 1.6, margin: 0 }}>
          {t("err.desc")}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {/* Qayta urinish — sahifani QAYTA CHIZADI. Ko'p hollarda xato
              vaqtinchalik holatdan (masalan bo'sh javob) kelib chiqadi va
              shu tugma yetarli bo'ladi. */}
          <button type="button" className="btn btn-primary"
                  onClick={() => this.setState({ error: null })}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("err.retry")}
          </button>
          <button type="button" className="btn btn-outline"
                  onClick={() => window.location.reload()}>
            <i className="fa-solid fa-arrows-rotate" aria-hidden="true" /> {t("err.reload")}
          </button>
        </div>

        {/* Xato matni — yig'ilgan holda. Kassirni qo'rqitmasin, lekin
            qo'llab-quvvatlash so'raganda ochib o'qish mumkin bo'lsin. */}
        <details style={{ marginTop: 18, maxWidth: 520, width: "100%", textAlign: "left" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, opacity: 0.6 }}>
            {t("err.details")}
          </summary>
          <pre style={{
            marginTop: 8, padding: 12, borderRadius: 8, fontSize: 12,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            background: "var(--bg-soft, rgba(127,127,127,0.12))",
          }}>{String(error?.message || error)}</pre>
        </details>
      </div>
    );
  }
}

/**
 * Yo'nalish o'zgarganda to'siq O'ZI TIKLANADI.
 *
 * ⚠ `key` shu sababli kerak: usiz buzilgan sahifadan menyu orqali boshqasiga
 * o'tilganda ham to'siq xato holatida qolib, yangi sahifa o'rniga o'sha
 * xabar ko'rinardi — kassir ilova butunlay ishlamayapti deb o'ylardi.
 */
export function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

export default ErrorBoundary;
