import { useState } from "react";
import { t } from "../../lib/ek-i18n";
import { rowsFromCols, rowsFromTable, fileName } from "../../lib/ek-table-xlsx";
import { Spinner } from "./Loading";

/* ══════════════════════════════════════════════════════════════════════════
   «EXCEL» TUGMASI — har jadval uchun bitta (2026-10-09)

   Egasi: «har qanday jadval ko'rinishidagi ma'lumotni Excel'ga yuklab olish
   imkoni bo'lsin». Ilgari har sahifa tugmani va faylni qo'lda yasardi va
   40 ta jadvaldan 5 tasida bor edi. Endi bitta komponent, to'rt manba:

     <ExcelButton name="mijozlar" cols={COLS} rows={shown} />        ustunlar ta'rifi
     <ExcelButton name="partiyalar" table={() => ref.current} />      ekrandagi jadval
     <ExcelButton name="tovarlar" cols={COLS} fetchAll={collect} />   hamma sahifalar
     <ExcelButton name="hisobot" sheets={() => [...]} />              bir necha varaq

   ⚠ FAYL HAQIQIY .xlsx (`ek-xlsx`), CSV emas — raqamlar raqam bo'lib qoladi.
   ⚠ `ek-xlsx` KECHIKTIRIB yuklanadi: tugma bosilganda. Kirish to'plamiga
   (KIRISH 197/200) tushmaydi.
   ⚠ `fetchAll` `null` qaytarsa — juda ko'p qator (cheklov), xabar beriladi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function ExcelButton({ name, sheet, cols, rows, table, fetchAll, sheets, toast,
                                      label, className = "btn btn-outline btn-sm", disabled }) {
  const [busy, setBusy] = useState(false);
  const empty = rows != null && !fetchAll && !sheets && rows.length === 0;

  const run = async () => {
    setBusy(true);
    try {
      let book;
      if (sheets) {
        book = await sheets();
      } else {
        let data = rows;
        if (fetchAll) {
          data = await fetchAll();
          if (data == null) { toast?.error?.(t("xlsx.tooMany")); return; }
        }
        const grid = table ? rowsFromTable(typeof table === "function" ? table() : table)
                           : rowsFromCols(cols, data, { yes: t("common.yes"), no: t("common.no") });
        book = [{ name: sheet || name, rows: grid }];
      }
      if (!book?.length || book.every((s) => (s.rows || []).length <= 1)) {
        toast?.error?.(t("xlsx.empty"));
        return;
      }
      const { downloadXlsx } = await import("../../lib/ek-xlsx");
      downloadXlsx(fileName(name), book);
    } catch (e) {
      toast?.error?.(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} onClick={run} disabled={busy || empty || disabled}
            title={t("xlsx.hint")} aria-label={t("xlsx.hint")}>
      {busy ? <Spinner /> : <i className="fa-solid fa-file-excel" aria-hidden="true" />} {label ?? "Excel"}
    </button>
  );
}
