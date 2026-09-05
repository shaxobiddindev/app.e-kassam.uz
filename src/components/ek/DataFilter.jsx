import { useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { OPS, NEEDS_VALUE, NEEDS_SECOND, applyAll, blankCond } from "../../lib/ek-filter";
import Select from "./Select";
import Overlay from "./Overlay";

/* ══════════════════════════════════════════════════════════════════════════
   USTUNLAR BO'YICHA FILTR — UI (V68)

   Do'kon egasi: «har bir mumkin bo'lgan sahifada professional filtr
   bo'lsin, ekranda ko'ringan har bir ustun bilan filtr qila olsin,
   mumkin bo'lgan hamma kombinatsiyalar ishlatilsin».

   ═══ QANDAY ULANADI ═══════════════════════════════════════════════════

     const COLS = [
       { key: "name", label: "Nomi",   type: "text",   get: (r) => r.name },
       { key: "qty",  label: "Qoldiq", type: "number", get: (r) => r.qty },
       { key: "st",   label: "Holat",  type: "enum",   get: (r) => r.status,
         options: ["FAOL", "TUGAGAN"] },
     ];
     const flt = useDataFilter(COLS, "inv");   // "inv" — eslab qolish kaliti
     const shown = flt.apply(rows);
     …
     <DataFilter cols={COLS} flt={flt} />

   ⚠ USTUNLAR RO'YXATI EKRANDAGI JADVALDAN OLINADI. Filtrda ko'rinmaydigan
   ustun bo'lsa, foydalanuvchi «nega bu yo'q?» deb qoladi; jadvalda yo'q
   ustun bo'yicha filtr esa natijani tushuntirib bo'lmas qiladi.

   ═══ NEGA OYNA, YONDAGI PANEL EMAS ════════════════════════════════════

   Filtr KAMDAN-KAM ochiladi, lekin ochilganda KENG joy talab qiladi
   (ustun + amal + qiymat, bir nechta qator). Doimiy panel har sahifada
   joyni yeb turardi; oyna esa kerak bo'lganda ochiladi va yopiladi.
   Faol shartlar esa oyna yopilgach ham CHIP bo'lib ko'rinib turadi —
   aks holda «nega ro'yxat qisqa?» degan savol javobsiz qolardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Amal nomlari — tarjima kalitlari `filter.op.*`. */
const opLabel = (op) => t(`filter.op.${op}`);

/**
 * Sahifa holati: shartlar, saralash va ularni qo'llash.
 *
 * ⚠ HOLAT ESLAB QOLINADI (`localStorage`): omborchi filtr qo'yib,
 * tovarni ochib, qaytganda filtr saqlanib qolishi kerak — aks holda
 * har safar qaytadan terishga majbur bo'lardi.
 */
export function useDataFilter(cols, storageKey) {
  const key = storageKey ? `ek_flt_${storageKey}` : null;
  const [conds, setConds] = useState(() => {
    if (!key) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      /* ⚠ Saqlangan shart ustuni O'CHIRILGAN bo'lishi mumkin (versiya
         yangilandi) — u tashlanadi, aks holda filtr hech narsa
         ko'rsatmay qo'yardi va sababi ko'rinmasdi. */
      const live = (raw?.conds || []).filter((c) => cols.some((x) => x.key === c.key));
      return live;
    } catch { return []; }
  });
  const [sort, setSort] = useState(() => {
    if (!key) return { key: null, dir: "asc" };
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      const s = raw?.sort;
      return s?.key && cols.some((x) => x.key === s.key) ? s : { key: null, dir: "asc" };
    } catch { return { key: null, dir: "asc" }; }
  });
  const [open, setOpen] = useState(false);

  const save = (nextConds, nextSort) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ conds: nextConds, sort: nextSort }));
    } catch { /* xotira to'lgan yoki bloklangan — filtr baribir ishlaydi */ }
  };

  const set = (nextConds) => { setConds(nextConds); save(nextConds, sort); };
  const setSorting = (nextSort) => { setSort(nextSort); save(conds, nextSort); };

  /** Ustun sarlavhasiga bosilganda: o'sish → kamayish → tartibsiz. */
  const toggleSort = (colKey) => {
    if (sort.key !== colKey) return setSorting({ key: colKey, dir: "asc" });
    if (sort.dir === "asc") return setSorting({ key: colKey, dir: "desc" });
    return setSorting({ key: null, dir: "asc" });
  };

  const apply = (rows) => applyAll(rows || [], conds, sort, cols);

  /* Faol (to'ldirilgan) shartlar soni — tugmadagi belgi shundan. */
  const activeCount = useMemo(() => conds.filter((c) => {
    if (!NEEDS_VALUE.has(c.op)) return true;
    if (c.type === "enum") return Array.isArray(c.value) && c.value.length > 0;
    if (NEEDS_SECOND.has(c.op)) return c.value !== "" || c.value2 !== "";
    return c.value !== "" && c.value != null;
  }).length, [conds]);

  return { cols, conds, set, sort, setSorting, toggleSort, apply, open, setOpen, activeCount,
           clear: () => { set([]); setSorting({ key: null, dir: "asc" }); } };
}

/** Jadval sarlavhasi uchun: saralanadigan `th`. */
export function SortTh({ flt, col, children, ...rest }) {
  const on = flt.sort.key === col;
  return (
    <th {...rest}>
      <button type="button" className={`th-sort${on ? " is-on" : ""}`}
              onClick={() => flt.toggleSort(col)}
              title={t("filter.sortHint")}>
        {children}
        <i className={`fa-solid ${on ? (flt.sort.dir === "asc" ? "fa-arrow-up-short-wide"
                                                              : "fa-arrow-down-wide-short")
                                     : "fa-sort"}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/** Filtr tugmasi + faol shartlar chipi + oyna. */
export default function DataFilter({ cols, flt, compact = false }) {
  const { conds, set, open, setOpen, activeCount } = flt;
  const byKey = useMemo(() => new Map(cols.map((c) => [c.key, c])), [cols]);

  const addCond = () => set([...conds, blankCond(cols[0])]);
  const dropCond = (i) => set(conds.filter((_, k) => k !== i));
  const patch = (i, next) => set(conds.map((c, k) => (k === i ? { ...c, ...next } : c)));

  /* Ustun almashsa — amal ham o'sha turning BIRINCHISIGA qaytadi:
     «matn ichida bor» amali songa qo'llanib qolmasin. */
  const pickCol = (i, colKey) => {
    const col = byKey.get(colKey);
    if (col) patch(i, blankCond(col));
  };

  const chip = (c, i) => {
    const col = byKey.get(c.key);
    if (!col) return null;
    const val = c.type === "enum" ? (c.value || []).join(", ")
      : NEEDS_SECOND.has(c.op) ? `${c.value || "…"} — ${c.value2 || "…"}`
      : NEEDS_VALUE.has(c.op) ? c.value : "";
    return (
      <span className="flt-chip" key={i}>
        <b>{col.label}</b> {opLabel(c.op)} {val && <span className="mono">{String(val)}</span>}
        <button type="button" onClick={() => dropCond(i)} aria-label={t("common.delete")}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </span>
    );
  };

  return (
    <>
      <button type="button"
              className={`btn btn-sm ${activeCount ? "btn-primary" : "btn-outline"} filter-btn`}
              onClick={() => setOpen(true)}>
        <i className="fa-solid fa-filter" aria-hidden="true" />
        {!compact && ` ${t("filter.title")}`}
        {activeCount > 0 && <span className="facet__badge ek-num">{activeCount}</span>}
      </button>

      {/* Faol shartlar — oyna yopiq bo'lsa ham ko'rinadi. */}
      {activeCount > 0 && !compact && (
        <span className="flt-chips">
          {conds.map(chip)}
          <button type="button" className="flt-chips__clear" onClick={flt.clear}>
            {t("filter.clear")}
          </button>
        </span>
      )}

      {open && (
        <Overlay className="modal-overlay ek-overlay" onEscape={() => setOpen(false)}
                 role="dialog" aria-modal="true" aria-label={t("filter.title")}
                 onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal-box ek-dialog" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                <i className="fa-solid fa-filter" aria-hidden="true" /> {t("filter.title")}
              </h3>
              <button className="modal-close" onClick={() => setOpen(false)}
                      aria-label={t("common.close")}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              {conds.length === 0 && (
                <div className="text-muted" style={{ marginBottom: 10 }}>{t("filter.empty")}</div>
              )}

              {conds.map((c, i) => {
                const col = byKey.get(c.key) || cols[0];
                const ops = OPS[c.type] || OPS.text;
                return (
                  <div className="flt-row" key={i}>
                    <Select block ariaLabel={t("filter.column")}
                            value={c.key} onChange={(v) => pickCol(i, v)}
                            options={cols.map((x) => ({ value: x.key, label: x.label }))} />
                    <Select block ariaLabel={t("filter.op")}
                            value={c.op} onChange={(v) => patch(i, { op: v, ...(NEEDS_VALUE.has(v) ? {} : { value: "", value2: "" }) })}
                            options={ops.map((o) => ({ value: o, label: opLabel(o) }))} />

                    {/* Qiymat — ustun turiga qarab boshqa boshqaruv. */}
                    {c.type === "enum" ? (
                      <div className="flt-enum">
                        {(col.options || []).map((o) => {
                          const v = typeof o === "string" ? o : o.value;
                          const lbl = typeof o === "string" ? o : o.label;
                          const on = (c.value || []).includes(v);
                          return (
                            <button type="button" key={v}
                                    className={`btn btn-sm ${on ? "btn-primary" : "btn-outline"}`}
                                    onClick={() => patch(i, {
                                      value: on ? c.value.filter((x) => x !== v) : [...(c.value || []), v],
                                    })}>
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    ) : NEEDS_VALUE.has(c.op) ? (
                      <div className="flt-vals">
                        <input className="form-input"
                               type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                               value={c.value ?? ""} placeholder={t("filter.value")}
                               onChange={(e) => patch(i, { value: e.target.value })} />
                        {NEEDS_SECOND.has(c.op) && (
                          <input className="form-input"
                                 type={c.type === "date" ? "date" : "number"}
                                 value={c.value2 ?? ""} placeholder={t("filter.value2")}
                                 onChange={(e) => patch(i, { value2: e.target.value })} />
                        )}
                      </div>
                    ) : <div className="flt-vals text-muted">{t("filter.noValue")}</div>}

                    <button type="button" className="btn-icon danger" onClick={() => dropCond(i)}
                            aria-label={t("common.delete")}>
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}

              <button type="button" className="btn btn-outline btn-sm" onClick={addCond}
                      style={{ marginTop: 8 }}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> {t("filter.add")}
              </button>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={flt.clear}>
                {t("filter.clear")}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                <i className="fa-solid fa-check" aria-hidden="true" /> {t("common.apply")}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
