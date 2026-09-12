import { useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import { OPS, NEEDS_VALUE, NEEDS_SECOND, applyAll, blankCond, isLiveCond,
         serializeFilter } from "../../lib/ek-filter";
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

/**
 * Shart TO'LDIRILGANMI (ya'ni ro'yxatni haqiqatan kesadimi).
 *
 * ⚠ BITTA joyda ta'riflangan: qoida uchta joyda kerak — tugmadagi
 * son, chiplar va `ek-filter.js` dagi qo'llash. Uch nusxa bo'lganda
 * ular vaqt o'tib bir-biridan uzoqlashardi va ekranda «2 ta shart»
 * deb yozilib, ro'yxat esa bittasi bilan kesilgan bo'lardi.
 */
/* ⚠ QOIDA `ek-filter.js` DA, BU YERDA FAQAT QAYTA CHIQARISH.
   Ilgari nusxa shu yerda turardi; shartlarni SERVERGA yuborish
   qo'shilgach, uchinchi nusxa ham kerak bo'lib qoldi (server o'lik
   shartni tashlashi kerak). Uch nusxa vaqt o'tib ajralib ketardi va
   o'shanda ekranda «2 ta shart» deb yozilib, ro'yxat bittasi bilan
   kesilgan bo'lardi. Endi front tomonda bitta manba bor — server
   nusxasi esa `ColumnFilter.isLive` da va sinov ikkisini
   solishtiradi. */
export const isLive = isLiveCond;

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

  /**
   * Shart va tartibni BIRGA yozadi.
   *
   * ⚠⚠ MANA SHU YERDA HAQIQIY XATO BOR EDI. `clear()` ketma-ket
   * `set([])` va `setSorting(...)` ni chaqirardi, ularning har biri
   * esa `localStorage` ga O'ZICHA yozardi — ikkinchisi o'z
   * yopilmasidan (closure) ESKI shartlarni olib, birinchisi tozalagan
   * ro'yxatni QAYTA TIKLARDI. Natijada foydalanuvchi filtrni
   * tozalaydi, ekran to'g'ri yangilanadi, lekin boshqa sahifaga o'tib
   * qaytganda (yoki F5 dan keyin) shart QAYTA PAYDO bo'lardi va uni
   * o'chirishning yo'li ko'rinmasdi.
   *
   * ⚠ Xato ko'rinmasligining sababi: ekrandagi holat (`useState`)
   * to'g'ri tozalanardi, faqat DISKDAGI nusxa eski qolardi. Ya'ni
   * hamma narsa ishlayotgandek ko'rinardi — keyingi kirishgacha.
   */
  const write = (nextConds, nextSort) => {
    setConds(nextConds);
    setSort(nextSort);
    save(nextConds, nextSort);
  };

  const set = (nextConds) => write(nextConds, sort);
  const setSorting = (nextSort) => write(conds, nextSort);

  /** Ustun sarlavhasiga bosilganda: o'sish → kamayish → tartibsiz. */
  const toggleSort = (colKey) => {
    if (sort.key !== colKey) return setSorting({ key: colKey, dir: "asc" });
    if (sort.dir === "asc") return setSorting({ key: colKey, dir: "desc" });
    return setSorting({ key: null, dir: "asc" });
  };

  const apply = (rows) => applyAll(rows || [], conds, sort, cols);

  /* Faol (to'ldirilgan) shartlar soni — tugmadagi belgi shundan. */
  const activeCount = useMemo(() => conds.filter(isLive).length, [conds]);

  /**
   * Shartlarni SERVERGA yuborish uchun yozadi.
   *
   * ⚠ `apply` BILAN IKKI XIL YO'L, VA IKKISI HAM KERAK:
   *   · `apply(rows)`  — to'liq ro'yxat allaqachon qo'lda bo'lganda
   *     (sahifalanmagan ekranlar);
   *   · `serialize()`  — ro'yxat sahifalanganda, filtr SERVERDA
   *     bajarilishi shart, aks holda u faqat yuklangan 50 qatorga
   *     tegardi.
   *
   * ⚠ `useMemo` SHART: natija `useInfinite` ning `fetcher` iga
   * kiradi va har renderda yangi matn bo'lsa, hook ro'yxatni
   * boshidan yuklab, cheksiz so'rov yuborardi.
   */
  const serialize = useMemo(() => () => serializeFilter(conds, sort), [conds, sort]);

  return { cols, conds, set, sort, setSorting, toggleSort, apply, serialize,
           open, setOpen, activeCount,
           /* ⚠ BITTA yozuv: ikkita alohida chaqiruv bir-birining
              yozganini bosib ketardi (yuqoridagi izoh). */
           clear: () => write([], { key: null, dir: "asc" }) };
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
export default function DataFilter({ cols, flt, compact = false, chips = true }) {
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
    /* ⚠ TO'LDIRILMAGAN shart chip BERMAYDI. Ilgari qator qo'shilishi
       bilan «Mahsulot ichida bor» degan bo'sh chip paydo bo'lardi —
       u hech narsani kesmaydi, lekin ekranda filtr ishlayotgandek
       ko'rinardi va foydalanuvchi «nega ro'yxat o'zgarmadi?» deb
       qolardi. Shart faol bo'lishi qoidasi `activeCount` bilan bir
       xil. */
    if (!isLive(c)) return null;
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

      {/* Faol shartlar — oyna yopiq bo'lsa ham ko'rinadi.
          ⚠ `chips={false}` bo'lsa ular BU YERDA chizilmaydi: ba'zi
          sahifada (ombor paneli) chiplar tugmalar bilan bitta qatorga
          sig'may, «Stiker chiqarish» ni siqib qo'yardi. U yerda
          `FilterChips` alohida, to'liq kenglikdagi qatorga qo'yiladi. */}
      {chips && activeCount > 0 && !compact && (
        <span className="flt-chips">
          {conds.map(chip)}
          <button type="button" className="flt-chips__clear" onClick={flt.clear}>
            {t("filter.clear")}
          </button>
        </span>
      )}

      {open && (
        /* ⚠ ORQA FONGA BOSISH YOPMAYDI (V72) — sensor ekranda barmoq
           chetga tasodifan tegishi oddiy hol va yarim terilgan shart
           yo'qolib ketardi. Chiqish: ✕, ESC va «Qo'llash». */
        <Overlay className="modal-overlay ek-overlay" onEscape={() => setOpen(false)}
                 role="dialog" aria-modal="true" aria-label={t("filter.title")}>
          <div className="modal-box ek-dialog flt-box">
            <div className="modal-header flt-head">
              <div>
                <h3 className="modal-title">
                  <i className="fa-solid fa-filter" aria-hidden="true" /> {t("filter.title")}
                </h3>
                {/* ⚠ Qoida OYNANING O'ZIDA yozilgan. Ilgari shartlar
                    «VA» bilan birlashishini hech narsa aytmasdi va
                    ikkita shart qo'ygan odam nega ro'yxat bo'shab
                    qolganini tushunmasdi. */}
                <span className="flt-head__hint">{t("filter.andHint")}</span>
              </div>
              <button type="button" className="flt-x" onClick={() => setOpen(false)}
                      aria-label={t("common.close")} title={t("common.close")}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body flt-body">
              {conds.length === 0 && (
                /* Bo'sh holat — yozuv emas, TAKLIF: bitta bosishda
                   birinchi shart qo'shiladi. */
                <button type="button" className="flt-empty" onClick={addCond}>
                  <i className="fa-solid fa-filter-circle-xmark" aria-hidden="true" />
                  <b>{t("filter.empty")}</b>
                  <span>{t("filter.add")}</span>
                </button>
              )}

              {conds.map((c, i) => {
                const col = byKey.get(c.key) || cols[0];
                const ops = OPS[c.type] || OPS.text;
                return (
                  <div className="flt-row" key={i}>
                    {/* ⚠ Qator raqami: uchta-to'rtta shart bo'lganda
                        «qaysi biri qaysi» degan savol tug'iladi va
                        ular ko'zga bir xil ko'rinardi. */}
                    <span className="flt-row__n">{i + 1}</span>
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

              {conds.length > 0 && (
                <button type="button" className="btn btn-outline btn-sm flt-add" onClick={addCond}>
                  <i className="fa-solid fa-plus" aria-hidden="true" /> {t("filter.add")}
                </button>
              )}
            </div>

            <div className="modal-footer flt-foot">
              {/* Faol shartlar soni — «Qo'llash» dan keyin ro'yxat
                  nega qisqarganini oldindan aytadi. */}
              <span className="flt-foot__n">
                {activeCount > 0 ? t("filter.activeN", { n: activeCount }) : t("filter.none")}
              </span>
              <button className="btn btn-outline btn-sm" onClick={flt.clear}
                      disabled={!conds.length}>
                <i className="fa-solid fa-eraser" aria-hidden="true" /> {t("filter.clear")}
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

/**
 * Faol shartlar chipi — ALOHIDA joyga qo'yish uchun.
 *
 * ⚠ Nega kerak: ombor panelida tugmalar va chiplar bitta qatorda
 * turardi va uchta shart qo'yilgan zahoti «Stiker chiqarish» siqilib,
 * yozuvi ko'rinmay qolardi. Chiplar soni oldindan noma'lum, tugmalar
 * esa doimiy — shuning uchun ular BOSHQA qatorda bo'lishi kerak.
 */
export function FilterChips({ cols, flt }) {
  const { conds, set, activeCount } = flt;
  const byKey = useMemo(() => new Map(cols.map((c) => [c.key, c])), [cols]);
  if (!activeCount) return null;

  const dropCond = (i) => set(conds.filter((_, k) => k !== i));
  return (
    <span className="flt-chips">
      {conds.map((c, i) => {
        const col = byKey.get(c.key);
        if (!col || !isLive(c)) return null;
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
      })}
      <button type="button" className="flt-chips__clear" onClick={flt.clear}>
        {t("filter.clear")}
      </button>
    </span>
  );
}
