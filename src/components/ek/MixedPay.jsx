import { useMemo } from "react";
import { NumField } from "./EkFields";
import { ClearButton } from "../ui";
import { paymentEntry } from "../../lib/ek-labels";
import { money } from "../../lib/ek-format";
import { useT } from "../../lib/ek-i18n";
import { enteredTotal, enteredParts, enteredMax } from "../../lib/ek-payment";

/* ══════════════════════════════════════════════════════════════════════════
   ARALASH TO'LOV — HAMMA TO'LOV OYNASI UCHUN (V96)

   Do'kon egasi: «butun tizimda to'lov qilinadigan hamma oynada
   kassadagiday aralash to'lov tizimi bo'lishi kerak».

   ═══ NEGA ALOHIDA KOMPONENT ════════════════════════════════════════════

   Beshta oyna: qarz to'lash, jamg'arma to'ldirish, jamg'armadan
   qaytarish, ta'minotchiga to'lov, kirim hujjatidagi to'lov. Beshtasiga
   alohida yozilsa, ular bir kuni bir-biridan ajralib ketardi — bu
   loyihada allaqachon bo'lgan (`ek-payment.js` sarlavhasidagi «ikkinchi
   nusxa» darsi).

   ═══ ⚠ KASSA TEGILMADI ═════════════════════════════════════════════════

   `KassaPage` o'z ko'rinishini SAQLAB QOLDI va bu ataylab. U yerda
   ustiga yana uch qatlam bor — nasiya, qaytim, jamg'armaga
   yo'naltirish — va ularni umumiy komponentga tiqish uni ikki xil
   vazifaga bo'lib yuborardi. Ishlab turgan pul yo'lini «go'zallik
   uchun» qayta yozish do'kon egasining birinchi qoidasiga zid:
   mavjud funksiyalar ishlashda davom etsin.

   Bu yerdagi shakl esa BOSHQACHA va soddaroq: belgilangan chek summasi
   YO'Q — to'lov summasi kiritilganlarning yig'indisi.

   ═══ ⚠ HOLAT TASHQARIDA ════════════════════════════════════════════════

   `entered` ham, `focus` ham chaqiruvchida turadi. Sabab amaliy:
   chaqiruvchilar ularga TAYANADI — qarz oynasi tanlangan qarzlar
   yig'indisini o'sha maydonga yozadi, qaytarish oynasi esa jamiga
   chegara qo'yadi. Holat ichkarida yashiringanda ikkalasi ham
   imkonsiz bo'lardi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * @param methods  ko'rsatiladigan usullar (`["CASH","CARD",…]`)
 * @param entered  `{ CASH: "200000", CARD: "300000" }` — matn ham, son ham
 * @param onChange yangi `entered` bilan chaqiriladi
 * @param focus    hozir tahrirlanayotgan usul
 * @param onFocus  usul tugmasi bosilganda
 * @param cap      JAMIGA chegara (jamg'armadan qaytarishda qoldiq). `null` —
 *                 chegara yo'q
 * @param inputId  maydonning `id` si — chaqiruvchi unga fokus bera olsin
 */
export default function MixedPay({
  methods = ["CASH", "CARD", "CLICK", "PAYME"],
  entered, onChange, focus, onFocus,
  cap = null, inputId = "mixed-amount", autoFocus = false, disabled = false,
}) {
  const { t } = useT();

  const rows = useMemo(() => enteredParts(entered), [entered]);
  const total = useMemo(() => enteredTotal(entered), [entered]);
  const max = enteredMax(entered, cap, focus);
  const value = entered?.[focus] ?? "";

  /* ⚠ FOKUS DOM DA HAM KO'CHADI (kassadagi bilan bir xil qoida, V94):
     kassir usulni bosdi — darrov summani yozaveradi. Karetka esa YANGI
     qiymat chizilgandan keyin oxiriga qo'yiladi. */
  const pick = (type) => {
    onFocus?.(type);
    const el = document.getElementById(inputId);
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => {
      const n = el.value.length;
      try { el.setSelectionRange(n, n); } catch (_) { /* karetkasiz maydon */ }
    });
  };

  const set = (v) => {
    const next = { ...(entered || {}) };
    if (v === "" || v == null) delete next[focus];
    else next[focus] = v;
    onChange?.(next);
  };

  const drop = (type) => {
    const next = { ...(entered || {}) };
    delete next[type];
    onChange?.(next);
  };

  const label = paymentEntry(focus)?.label || focus;

  return (
    <>
      <div className="pay-modal-section-label">
        <i className="fa-solid fa-credit-card" aria-hidden="true" /> {t("credit.method")}
      </div>
      {/* ⚠ TUGMA TO'LOV TURINI EMAS, TAHRIRLANADIGAN USULNI tanlaydi —
          kassadagi bilan aynan bir xil ma'no. Bosilganda hech narsa
          o'chmaydi: maydon o'sha usulning summasiga o'tadi va eski
          qiymati qaytadi. */}
      <div className="pay-modal-types">
        {methods.map((key) => {
          const p = paymentEntry(key);
          return (
            <button key={key} type="button" disabled={disabled}
                    className={`pay-type-btn ${focus === key ? "active" : ""}${
                      Number(entered?.[key]) > 0 ? " has-amount" : ""}`}
                    style={{ "--pay-color": p.color }}
                    aria-pressed={focus === key}
                    onClick={() => pick(key)}>
              <span className="pay-type-icon">
                <i className={`fa-solid ${p.icon || "fa-wallet"}`} aria-hidden="true" />
              </span>
              <span className="pay-type-label">{p.label}</span>
            </button>
          );
        })}
      </div>

      <label className="form-label" htmlFor={inputId} style={{ marginTop: 12 }}>
        {t("kassa.amountFor", { method: label })}
      </label>
      {/* «×» — monoblokda `Ctrl+A`+`Delete` qilib bo'lmaydi (V94). */}
      <div className="field">
        <NumField kind="money"
                  id={inputId}
                  className={`form-input ek-num${value !== "" && value != null ? " has-clear" : ""}`}
                  max={max ?? undefined}
                  value={value}
                  autoFocus={autoFocus}
                  disabled={disabled}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0" />
        {value !== "" && value != null && (
          <ClearButton label={t("kassa.clearInput")} onClear={() => set("")} />
        )}
      </div>

      {/* ⚠ HISOB FAQAT BIRDAN ORTIQ USULDA. Bitta usulda u yuqoridagi
          maydonni takrorlagan bo'lardi — do'kon egasi taqiqlagan
          ortiqcha element. */}
      {rows.length > 1 && (
        <div className="pay-sum" style={{ marginTop: 10 }}>
          {rows.map((x) => {
            const p = paymentEntry(x.type);
            return (
              <div className="pay-sum__row" key={x.type} style={{ "--pay-color": p.color }}>
                <span className="pay-sum__name">
                  <i className={`fa-solid ${p.icon || "fa-wallet"}`} aria-hidden="true" /> {p.label}
                </span>
                <b className="ek-num">{money(x.amount)}</b>
                <button type="button" className="pay-sum__x" disabled={disabled}
                        title={t("common.delete")} aria-label={t("common.delete")}
                        onClick={() => drop(x.type)}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <div className="pay-sum__row pay-sum__row--taken">
            <span className="pay-sum__name">
              <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true" />{" "}
              {t("kassa.takenTotal")}
            </span>
            <b className="ek-num">{money(total)}</b>
          </div>
        </div>
      )}
    </>
  );
}
