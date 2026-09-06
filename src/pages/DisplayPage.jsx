import { useEffect, useRef, useState } from "react";
import { t } from "../lib/ek-i18n";
import { money, quantity as fmtQty } from "../utils";
import { unitLabel, unitDecimals } from "../lib/ek-labels";
import { read, subscribe } from "../lib/ek-display";

/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ EKRANI (V77)

   ═══ BU EKRAN KIM UCHUN ══════════════════════════════════════════════

   MIJOZ uchun, kassir uchun EMAS. Shundan hamma qaror kelib chiqadi:

     · yozuv KATTA — mijoz kassadan bir-ikki qadam narida turadi va
       ekranga egilmaydi;
     · ustunlar, tugmalar, menyu YO'Q — bosiladigan hech narsa yo'q,
       chunki mijoz bu ekranga tegmaydi;
     · SCROL YO'Q. Savat uzun bo'lsa oxirgi qatorlar ko'rinadi:
       mijozning savoli «hozir nima urildi?», «birinchi nima urilgan
       edi?» emas. Chek to'liq ro'yxatni beradi.

   ⚠ TARMOQ YO'Q. Ekran hech qanday so'rov yubormaydi: u kassa
   oynasidan kelgan holatni chizadi, xolos (`ek-display.js`). Shu
   sababli internet uzilganda ham ishlayveradi — kassa ham offline
   sotaveradi.

   ═══ TO'RT HOLAT ═════════════════════════════════════════════════════

     idle — savat bo'sh: do'kon nomi va takliflar
     cart — qatorlar va JAMI
     pay  — JAMI, berildi, QAYTIM
     done — «Rahmat!» va qaytim

   ⚠ `done` DARHOL YO'QOLMAYDI. Mijoz qaytimni o'qishga ulgurishi
   kerak; shuning uchun u bir necha soniya turadi va keyin o'zi
   bo'sh ekranga qaytadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** «Rahmat» ekrani shuncha turadi. */
const DONE_MS = 8000;

/** Bo'sh ekranda taklif shuncha vaqtda almashadi. */
const PROMO_MS = 5000;

/** Ekranda ko'rinadigan oxirgi qatorlar — sabab sinf izohida. */
const MAX_LINES = 7;

export default function DisplayPage() {
  const [s, setS] = useState(read);
  const [promoIdx, setPromoIdx] = useState(0);
  const doneRef = useRef(null);

  useEffect(() => subscribe(setS), []);

  /* ⚠ «Rahmat» dan bo'sh ekranga QAYTISH shu yerda, kassada emas:
     kassir keyingi mijozga o'tib ketgan bo'lishi mumkin va u
     mijozning ekranini tozalashni eslab turishi shart emas. */
  useEffect(() => {
    clearTimeout(doneRef.current);
    if (s.mode !== "done") return undefined;
    doneRef.current = setTimeout(() => setS((prev) =>
      /* ⚠ Faqat O'SHA «rahmat» hali turgan bo'lsa tozalanadi: shu
         orada yangi savat boshlangan bo'lsa, uni o'chirib yuborish
         mijozni ekranidan ayirardi. */
      (prev.mode === "done" && prev.at === s.at ? { ...prev, mode: "idle", items: [] } : prev)), DONE_MS);
    return () => clearTimeout(doneRef.current);
  }, [s.mode, s.at]);

  /* Takliflarni aylantirish — faqat bo'sh ekranda va faqat bittadan
     ko'p bo'lsa. */
  useEffect(() => {
    if (s.mode !== "idle" || (s.promo?.length || 0) < 2) return undefined;
    const id = setInterval(() => setPromoIdx((i) => (i + 1) % s.promo.length), PROMO_MS);
    return () => clearInterval(id);
  }, [s.mode, s.promo]);

  const lines = s.items || [];
  /* ⚠ OXIRGI qatorlar: mijozning savoli «hozir nima urildi?». */
  const shown = lines.slice(-MAX_LINES);
  const hidden = lines.length - shown.length;

  return (
    <div className="cd" data-mode={s.mode}>
      {/* ══ Sarlavha — do'kon nomi doim ko'rinadi ══════════════════ */}
      <header className="cd__head">
        <span className="cd__shop">{s.shop || "E-KASSAM.UZ"}</span>
        {s.customer?.name && (
          <span className="cd__cust">
            <i className="fa-solid fa-user" aria-hidden="true" /> {s.customer.name}
          </span>
        )}
      </header>

      {s.mode === "idle" ? <Idle s={s} idx={promoIdx} />
       : s.mode === "done" ? <Done s={s} />
       : (
        <>
          {/* ══ Qatorlar ═══════════════════════════════════════════ */}
          <div className="cd__list">
            {hidden > 0 && (
              <div className="cd__more">{t("display.more", { n: hidden })}</div>
            )}
            {shown.length === 0 ? (
              <div className="cd__empty">{t("display.scanning")}</div>
            ) : shown.map((x, i) => (
              <div className="cd__row" key={`${x.name}-${i}`}>
                <span className="cd__name">{x.name}</span>
                {/* ⚠ «2 × 15 000» ALOHIDA ustunda: mijoz narxni ham,
                    miqdorni ham ko'rishi kerak. Faqat yig'indi
                    ko'rsatilganda «nega shuncha?» degan savol
                    javobsiz qolardi. */}
                <span className="cd__qty ek-num">
                  {fmtQty(x.qty, unitDecimals(x.unit))}{x.unit ? ` ${unitLabel(x.unit)}` : ""}
                  {" × "}{money(x.price)}
                </span>
                <span className="cd__sum ek-num">{money(x.sum)}</span>
              </div>
            ))}
          </div>

          {/* ══ Yakun ══════════════════════════════════════════════ */}
          <footer className="cd__foot">
            {s.discount > 0 && (
              <div className="cd__line">
                <span>{t("display.discount")}</span>
                <b className="ek-num">−{money(s.discount)}</b>
              </div>
            )}
            <div className="cd__total">
              <span>{t("display.total")}</span>
              <b className="ek-num">{money(s.total)}</b>
            </div>

            {/* ⚠ QAYTIM — ekrandagi ENG KATTA raqam. Aynan shu son
                uchun bahs chiqadi va mijoz uni bir qarashda o'qishi
                kerak. */}
            {s.mode === "pay" && s.given != null && (
              <>
                <div className="cd__line">
                  <span>{t("display.given")}</span>
                  <b className="ek-num">{money(s.given)}</b>
                </div>
                {s.change > 0 && (
                  <div className="cd__change">
                    <span>{t("display.change")}</span>
                    <b className="ek-num">{money(s.change)}</b>
                  </div>
                )}
              </>
            )}
          </footer>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BO'SH EKRAN

   ⚠ EKRAN BO'SH TURMAYDI. Kun bo'yi qorayib turgan monitor buzuq
   ko'rinadi va do'kon haqida yomon taassurot qoldiradi. Taklif
   bo'lmasa — shunchaki do'kon nomi va salom.
   ══════════════════════════════════════════════════════════════════════ */
function Idle({ s, idx }) {
  const p = s.promo?.[idx % Math.max(1, s.promo.length)] || null;
  return (
    <div className="cd__idle">
      <div className="cd__welcome">{t("display.welcome")}</div>
      {p && (
        <div className="cd__promo">
          <div className="cd__promoTag">{t("display.promo")}</div>
          <div className="cd__promoName">{p.name}</div>
          <div className="cd__promoPrice">
            {p.was > 0 && p.was > p.price && (
              <s className="cd__promoWas ek-num">{money(p.was)}</s>
            )}
            <b className="ek-num">{money(p.price)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sotuvdan keyin — rahmat va qaytim. */
function Done({ s }) {
  return (
    <div className="cd__done">
      <i className="fa-solid fa-circle-check cd__doneIco" aria-hidden="true" />
      <div className="cd__thanks">{t("display.thanks")}</div>
      <div className="cd__line cd__line--big">
        <span>{t("display.total")}</span>
        <b className="ek-num">{money(s.total)}</b>
      </div>
      {s.change > 0 && (
        <div className="cd__change">
          <span>{t("display.change")}</span>
          <b className="ek-num">{money(s.change)}</b>
        </div>
      )}
      {s.receiptNo && <div className="cd__receipt">{t("display.receipt", { n: s.receiptNo })}</div>}
    </div>
  );
}
