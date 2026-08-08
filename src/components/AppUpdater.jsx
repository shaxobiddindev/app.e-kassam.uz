import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
// ⚠ To'g'ridan-to'g'ri fayldan, `.` (barrel) dan EMAS: bu komponent
// o'sha barrel'dan eksport qilinadi va aylanma import hosil bo'lardi.
import Modal from "./Modal";
import { checkUpdate, installUpdate } from "../lib/ek-update";
import { isDesktop } from "../lib/ek-desktop";

/* ══════════════════════════════════════════════════════════════════════════
   Ilova o'zini o'zi yangilaydi

   ⚠ ENG MUHIM QAROR: yangilanish KASSIR SOTUV QILAYOTGANDA majburlanmaydi.
   O'rnatish ilovani qayta ishga tushiradi, ya'ni to'lov o'rtasida bosilgan
   yangilanish savatni yo'q qiladi. Shuning uchun ikki xil xatti-harakat:

     · KIRISH EKRANIDA (hech kim ishlamayapti) — O'ZI o'rnatiladi.
       Bu eng xavfsiz payt: sotuv yo'q, yo'qotadigan narsa yo'q. Amalda
       kassalar har kuni ertalab shu ekrandan boshlaydi, ya'ni yangilanish
       hech kimdan so'ramasdan yetib boradi.

     · ISHLAYOTGANDA — so'raladi, majburlanmaydi. «Keyinroq» tanlansa
       ikki soatdan keyin qayta so'raydi (har daqiqada emas — o'sha
       bezovtalik tufayli odamlar yangilanishni butunlay o'chirib qo'yadi).

   ⚠ Brauzerda bu komponent HECH NARSA qilmaydi: `checkUpdate()` darhol
   `null` qaytaradi. Veb versiyani Netlify o'zi yangilaydi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Ishga tushgach birinchi tekshiruvgacha. Kassa ochilishini sekinlashtirmaydi. */
const FIRST_CHECK_MS = 8_000;
/** Keyingi tekshiruvlar oralig'i. Kassa kun bo'yi ochiq turadi. */
const EVERY_MS = 6 * 60 * 60 * 1000;
/** «Keyinroq» dan keyin qayta so'ragunga qadar. */
const SNOOZE_MS = 2 * 60 * 60 * 1000;

export default function AppUpdater({ loggedIn, toast }) {
  const [update, setUpdate]   = useState(null);
  const [busy, setBusy]       = useState(false);
  const [percent, setPercent] = useState(null);
  const snoozedUntil          = useRef(0);
  // Bir vaqtda ikkita o'rnatish boshlanmasin: taymer yangilanish
  // yuklanayotgan paytda ham ishlayveradi.
  const running               = useRef(false);

  useEffect(() => {
    if (!isDesktop()) return;
    let alive = true;

    async function look() {
      if (!alive || running.current) return;
      if (Date.now() < snoozedUntil.current) return;

      const found = await checkUpdate();
      if (!alive || !found) return;

      setUpdate(found);
      // Kirish ekranida — so'ramaymiz, o'rnatamiz.
      if (!loggedIn) start(found);
    }

    const first = setTimeout(look, FIRST_CHECK_MS);
    const timer = setInterval(look, EVERY_MS);
    return () => { alive = false; clearTimeout(first); clearInterval(timer); };
    // `loggedIn` o'zgarganda taymer qayta quriladi — shu tufayli kassir
    // chiqqan zahoti (kirish ekraniga qaytganda) yangilanish o'zi o'rnatiladi.
  }, [loggedIn]);

  async function start(found) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setPercent(null);
    try {
      // Qaytmaydi: o'rnatishdan keyin ilova qayta ishga tushadi.
      await installUpdate(found, setPercent);
    } catch (err) {
      running.current = false;
      setBusy(false);
      setUpdate(null);
      // Yangilanmagani sotuvga xalaqit bermaydi — shuning uchun modal
      // emas, toast. Keyingi tekshiruvda yana urinib ko'riladi.
      if (toast) toast.error(`${t("update.failed")}: ${err?.message || err}`);
    }
  }

  if (!update) return null;

  // Kirish ekranidagi avtomatik o'rnatish: tanlov yo'q, faqat holat.
  if (busy && !loggedIn) {
    return (
      <Modal title={t("update.title")} onClose={() => {}}>
        <Progress percent={percent} label={t("update.autoIdle")} />
      </Modal>
    );
  }

  return (
    <Modal
      title={t("update.title")}
      onClose={busy ? () => {} : later}
      footer={busy ? null : (
        <>
          <button className="btn btn-outline btn-sm" onClick={later}>{t("update.later")}</button>
          <button className="btn btn-primary btn-sm" onClick={() => start(update)}>
            <i className="fa-solid fa-download" /> {t("update.now")}
          </button>
        </>
      )}
    >
      {busy ? (
        <Progress percent={percent} label={percent === 100 ? t("update.installing") : t("update.downloading")} />
      ) : (
        <>
          <p style={{ marginBottom: 10 }}>
            {t("update.available")
              .replace("{v}", update.version || "")
              .replace("{cur}", update.currentVersion || "")}
          </p>
          <p className="text-muted" style={{ fontSize: 13 }}>{t("update.hintBusy")}</p>
        </>
      )}
    </Modal>
  );

  function later() {
    snoozedUntil.current = Date.now() + SNOOZE_MS;
    setUpdate(null);
  }
}

/* Foiz noma'lum bo'lishi mumkin: server `Content-Length` bermasa yuklanish
   hajmi bilinmaydi. Shunda raqam emas, harakatdagi chiziq ko'rsatiladi —
   "0%" da qotib turgan indikator ilova osilgandek ko'rinardi. */
function Progress({ percent, label }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--bg-sunken)", overflow: "hidden" }}>
        <div
          className={percent == null ? "ek-progress-idle" : ""}
          style={{
            height: "100%",
            width: percent == null ? "35%" : `${percent}%`,
            borderRadius: 999,
            background: "var(--bg-brand)",
            transition: "width .2s linear",
          }}
        />
      </div>
      {percent != null && (
        <div className="mono text-muted" style={{ marginTop: 6, fontSize: 12 }}>{percent}%</div>
      )}
    </div>
  );
}
