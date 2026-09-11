/* ══════════════════════════════════════════════════════════════════════════
   ESKI RAQAMI BOSHQA TOVARGA O'TGAN TOVARLAR (B0)

   ⚠ NEGA BU EKRAN UMUMAN BOR. Kodlar toza formatga keltirilganda
   (V117) eski raqamlar bo'shab qoldi va ularning ba'zilari BOSHQA
   tovarga berildi. Eski raqamlarni qayta tiriltirganda (V119) o'sha
   tovarlar tashlab ketildi: bitta raqam ikki tovarni ocholmaydi.

   Natijada javonda TURGAN yorliq yolg'on gapiradi: undagi raqam endi
   boshqa tovarni ochadi. Buni faqat do'kon egasi tuzata oladi va u
   qaysi tovar ekanini BILISHI kerak. Migratsiya jurnaliga yozib
   qo'yish yetarli emas — jurnalni hech kim o'qimaydi.

   ⚠ EGA HECH NARSA QILMASA HAM XAVFSIZ. Yorliq eskiligicha qoladi,
   kassir raqamni terganda boshqa tovar chiqadi va u buni ko'radi:
   ekranda tovar nomi turadi. Ya'ni bu — noqulaylik, pul xatosi emas.
   Shuning uchun ro'yxat ogohlantirish rangida, lekin ishni
   to'smaydi.

   ⚠ BO'SH BO'LSA BLOK UMUMAN CHIZILMAYDI. To'qnashuvsiz do'konda bu
   sahifada bir piksel ham o'zgarmasligi kerak.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { productApi } from "../api";
import { asArray } from "../lib/ek-array";
import { money } from "../utils";
import LabelPrintModal from "./ek/LabelPrintModal";

/* ⚠ RO'YXAT CHEGARALANADI. Eng katta bazada 2 241 ta to'qnashuv
   o'lchandi va hammasini bir yo'la chizish sahifani muzlatardi. Ega
   ro'yxatni o'qish uchun emas, YORLIQ CHIQARISH uchun ochadi — buning
   uchun esa tugma yetarli, har satrni ko'rish shart emas. */
const VISIBLE = 50;

export default function CodeConflictPanel({ toast }) {
  const [rows, setRows]   = useState([]);
  const [busy, setBusy]   = useState(false);
  const [all, setAll]     = useState(false);
  const [labels, setLabels] = useState(null);

  useEffect(() => {
    let alive = true;
    productApi.codeConflicts()
      /* ⚠ `asArray`, `|| []` EMAS: server obyekt qaytarsa `|| []`
         uni O'TKAZIB YUBORADI va quyidagi `.map` butun sahifani
         yiqitadi. Loyihaning o'z qo'riqchisi aynan shuni tutdi. */
      .then((r) => { if (alive) setRows(asArray(r?.data)); })
      /* Xato yutiladi va bu ataylab: bu blok — qo'shimcha ma'lumot.
         Sozlamalar sahifasining qolgani uning tufayli buzilmasligi
         kerak. */
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!rows.length) return null;

  /** Yorliq chiqarilgach qator ro'yxatdan ketadi. */
  const dismiss = async (id) => {
    setBusy(true);
    try {
      await productApi.dismissCodeConflict(id);
      setRows((prev) => prev.filter((c) => c.productId !== id));
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = all ? rows : rows.slice(0, VISIBLE);
  const hidden = rows.length - shown.length;

  return (
    <div className="card set-card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa-solid fa-tags" aria-hidden="true" /> {t("codeFix.title")}
        </span>
        {/* Badge EMAS: badge ichidagi kichik qalin yozuv qorong'i temada
            kontrastdan yiqilardi — `ScaleSettings` da o'sha topilma
            yozib qo'yilgan. `--fg-warning` kartochka foniga qo'yilgan
            matn uchun mo'ljallangan va ikkala temada ham yetarli. */}
        <span style={{ color: "var(--fg-warning)", fontWeight: 700 }}>
          {t("codeFix.count", { n: rows.length })}
        </span>
      </div>
      <p className="set-card__hint">{t("codeFix.hint")}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => setLabels(rows.map((x) => x.productId))}>
          <i className="fa-solid fa-print" aria-hidden="true" />
          {" "}{t("codeFix.printAll", { n: rows.length })}
        </button>
      </div>

      <div className="table-wrap" style={{ maxHeight: 420, overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("common.name")}</th>
              <th className="ek-num">{t("codeFix.oldCode")}</th>
              <th className="ek-num">{t("codeFix.newCode")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.productId}>
                <td>
                  {c.name || "—"}
                  {c.salePrice != null && (
                    <div className="set-row__hint">{money(c.salePrice, { withUnit: true })}</div>
                  )}
                </td>
                {/* Eski raqam o'chirilgan holda: u endi ishlamaydi. */}
                <td className="ek-num"><s>{c.oldCode}</s></td>
                <td className="ek-num"><b>{c.newCode || "—"}</b></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" disabled={busy}
                          onClick={() => setLabels([c.productId])}>
                    {t("label.print")}
                  </button>
                  {" "}
                  <button className="btn btn-outline btn-sm" disabled={busy}
                          onClick={() => dismiss(c.productId)}>
                    {t("codeFix.done")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}
                onClick={() => setAll(true)}>
          {t("codeFix.more", { n: hidden })}
        </button>
      )}

      {labels && (
        <LabelPrintModal productIds={labels} toast={toast}
                         onClose={() => setLabels(null)} />
      )}
    </div>
  );
}
