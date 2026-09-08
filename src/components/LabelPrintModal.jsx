/* ══════════════════════════════════════════════════════════════════════════
   JAVON YORLIG'INI CHIQARISH (V108)

   ⚠ NEGA OYNA KERAK. Ilgari yorliq tugmasi BOSILGAN ZAHOTI chek
   printeriga ketardi — tanlov ham, ko'rish ham yo'q edi. Ikkita
   oqibati bor edi:

     · brauzerdan ishlaydigan do'kon tugmani UMUMAN ko'rmasdi
       (`isDesktop()` bilan yashiringan), ya'ni yorliq chiqara olmasdi;
     · qanday chiqishini oldindan bilib bo'lmasdi va noto'g'ri
       o'lchamdagi varaq qog'oz bilan birga vaqtni ham yeb ketardi.

   ⚠ KO'RISH `iframe` DA — ATAYLAB. Yorliq uslubi (`@page`, `.lb-*`)
   BUTUN hujjatga tegishli va uni ilova ichiga qo'yish sahifaning o'z
   uslublariga aralashardi. `iframe` — bu chegara, va u yerda AYNAN
   chop etiladigan HTML turadi: ko'rilgan narsa bilan chiqqan narsa
   bir xil bo'lishining yagona ishonchli yo'li.
   ══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { buildLabelSheet, labelSheetCss, LABEL_SIZES } from "../lib/ek-label-sheet";
import { printHtml } from "../lib/ek-receipt-pdf";
import { printPriceLabels } from "../lib/ek-hardware";
import { isDesktop } from "../lib/ek-desktop";
import { t } from "../lib/ek-i18n";

export default function LabelPrintModal({ items = [], onClose, toast }) {
  const [mode, setMode]     = useState("sheet");   // "sheet" | "tape"
  const [size, setSize]     = useState("big");
  const [copies, setCopies] = useState(1);
  const [busy, setBusy]     = useState(false);

  const tapeOn = isDesktop();
  const shopName = localStorage.getItem("ek_shopName") || "";

  const n = Math.max(1, Math.min(50, Number(copies) || 1));
  const total = items.length * n;
  const s = LABEL_SIZES[size];
  const sheets = Math.ceil(total / (s.cols * s.rows));

  /* ⚠ FAQAT BIRINCHI TOVAR KO'RSATILADI. Butun varaqni chizish
     yuzlab yorliqda oynani sekinlashtirardi, foydasi esa nol: hamma
     yorliq bir xil qolipda. */
  const preview = useMemo(() => {
    if (!items.length) return "";
    try {
      return `<!DOCTYPE html><html data-theme="light"><head><meta charset="utf-8">`
        + `<style>${labelSheetCss(size)}`
        /* Ko'rishda varaq emas, BITTA yorliq turadi. */
        + `body{padding:6px}.lb-sheet{grid-template-columns:${s.w}mm}</style></head>`
        + `<body>${buildLabelSheet([items[0]], { size, copies: 1, shopName })}</body></html>`;
    } catch {
      return "";
    }
  }, [items, size, shopName, s.w]);

  const run = async () => {
    setBusy(true);
    try {
      if (mode === "tape") {
        await printPriceLabels(items, { copies: n, shopName });
        toast?.success(t("label.sent", { n: total }));
      } else {
        await printHtml(buildLabelSheet(items, { size, copies: n, shopName }),
                        t("label.sheetTitle"), labelSheetCss(size),
                        "width=900,height=760");
      }
      onClose();
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const Seg = ({ value, cur, set, children, disabled, title }) => (
    <button type="button" className={`cat-tab ${cur === value ? "active" : ""}`}
            disabled={disabled} title={title}
            aria-pressed={cur === value}
            onClick={() => set(value)}>{children}</button>
  );

  return (
    <Modal title={t("label.title")} onClose={onClose} maxWidth={560}
           footer={(
             <>
               <button className="btn btn-outline" onClick={onClose}>{t("common.cancel")}</button>
               <button className="btn btn-green" onClick={run} disabled={busy || !items.length}>
                 <i className="fa-solid fa-print" /> {t("label.printNow")}
               </button>
             </>
           )}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        <div>
          <div className="form-label">{t("label.where")}</div>
          <div className="cat-tabs" role="group">
            <Seg value="sheet" cur={mode} set={setMode}>
              <i className="fa-solid fa-file-lines" /> {t("label.modeSheet")}
            </Seg>
            {/* ⚠ O'CHIQ TUGMA YASHIRILMAYDI: sababi tushuntiriladi.
                Ilgari u umuman ko'rinmasdi va brauzerdagi do'kon
                «bu imkoniyat yo'q» deb o'ylardi. */}
            <Seg value="tape" cur={mode} set={setMode}
                 disabled={!tapeOn}
                 title={tapeOn ? "" : t("label.tapeNeedsDesktop")}>
              <i className="fa-solid fa-receipt" /> {t("label.modeTape")}
            </Seg>
          </div>
          {!tapeOn && (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 5 }}>
              {t("label.tapeNeedsDesktop")}
            </div>
          )}
        </div>

        {mode === "sheet" && (
          <div>
            <div className="form-label">{t("label.size")}</div>
            <div className="cat-tabs" role="group">
              <Seg value="big" cur={size} set={setSize}>
                {t("label.sizeBig", { w: LABEL_SIZES.big.w, h: LABEL_SIZES.big.h })}
              </Seg>
              <Seg value="small" cur={size} set={setSize}>
                {t("label.sizeSmall", { w: LABEL_SIZES.small.w, h: LABEL_SIZES.small.h })}
              </Seg>
            </div>
          </div>
        )}

        <div>
          <div className="form-label">{t("label.copies")}</div>
          <input className="input" type="number" min={1} max={50} value={copies}
                 style={{ width: 110 }}
                 onChange={(e) => setCopies(e.target.value)} />
        </div>

        {/* ⚠ HISOB OLDINDAN: «necha varaq chiqadi» degan savol qog'oz
            printerga ketmasdan OLDIN javob topishi kerak. */}
        <div className="text-muted" style={{ fontSize: 13 }}>
          {mode === "sheet"
            ? t("label.summarySheet", { n: total, s: sheets })
            : t("label.summaryTape", { n: total })}
        </div>

        {mode === "sheet" && preview && (
          <div>
            <div className="form-label">{t("label.preview")}</div>
            <iframe title={t("label.preview")} srcDoc={preview}
                    style={{ width: "100%", height: 160, border: "1px solid var(--border)",
                             borderRadius: 8, background: "#fff" }} />
          </div>
        )}
      </div>
    </Modal>
  );
}
