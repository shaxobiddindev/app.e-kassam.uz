import { useMemo, useState } from "react";
import { t } from "../../lib/ek-i18n";
import Overlay from "./Overlay";
import { rankItems } from "../../lib/ek-search";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * KO'P TANLOVLI FILTR (V57)
 *
 * ═══ NEGA TANLAGICH (SELECT) YETMADI ═══════════════════════════════════
 *
 * Kassada kategoriya tanlagichda edi va u BITTA qiymat beradi. Kiyim
 * do'konida esa savol deyarli har doim bir nechta: «ayollar VA bolalar»,
 * «M VA L», «Zara VA Mango». Tanlagich bilan buni qilishning yo'li yo'q
 * edi — kassir har birini navbat bilan ochib ko'rardi.
 *
 * ═══ QARORLAR ══════════════════════════════════════════════════════════
 *
 * ⚠ SANOQ HAR KATAKCHADA. «Qora (0)» ni bosgan kassir bo'sh ekran ko'radi
 * va tizimni buzuq deb o'ylaydi. Sanoq ko'rinib turganda u umuman
 * bosmaydi — bu eng arzon «xato»ni yo'qotish usuli.
 *
 * ⚠ BO'SH BO'LIM UMUMAN CHIZILMAYDI. Oziq-ovqat do'konida «O'lcham»
 * sarlavhasi ostidagi bo'sh joy kassirni chalkashtirardi: u nimadir
 * yuklanmagan deb o'ylardi.
 *
 * ⚠ QIDIRUV — 8 tadan ko'p qiymatda. Brendlar soni yuzta bo'lishi
 * mumkin va ularni aylantirib qidirish tanlagichdagi muammoning
 * o'zginasi bo'lardi. Qidiruv KASSA ALGORITMI bilan (`ek-search.js`) —
 * tizimda bitta qidiruv qoidasi bor.
 *
 * ⚠ TANLANGANLARI DOIM TEPADA. Yuzta brend orasidan belgilaganini
 * qaytadan topish uchun kassir yana qidirishga majbur bo'lardi.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Bitta bo'lim: sarlavha, katakchalar va tanlanganlar. */
function Section({ title, icon, options, selected, onToggle }) {
  const [q, setQ] = useState("");

  /* ⚠ 8 — tanlagichdagi bilan BIR XIL chegara (`ek/Select.jsx`).
     Ikki joyda ikki xil bo'lsa, bir xil uzunlikdagi ro'yxat bir yerda
     qidiruvli, boshqasida qidiruvsiz chiqardi. */
  const searchable = options.length > 8;

  const shown = useMemo(() => {
    if (!q.trim()) return options;
    /* ⚠ Spec shakli `PRODUCT_SPEC` bilan bir xil: `codes` — aniq mos
       kelishi kerak bo'lgan qisqa kalitlar, `texts` — matn. Bu yerda
       faqat matn bor. */
    return rankItems(options, q, { texts: (o) => [o.label] });
  }, [options, q]);

  /* Tanlanganlar tepaga — belgilaganini qayta qidirishga hojat qolmasin. */
  const ordered = useMemo(() => {
    const on = shown.filter((o) => selected.includes(o.value));
    const off = shown.filter((o) => !selected.includes(o.value));
    return [...on, ...off];
  }, [shown, selected]);

  if (!options.length) return null;

  return (
    <div className="facet">
      <div className="facet__title">
        <i className={`fa-solid ${icon}`} aria-hidden="true" /> {title}
        {selected.length > 0 && <span className="facet__badge ek-num">{selected.length}</span>}
      </div>

      {searchable && (
        <input
          type="text"
          className="form-input facet__search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.searchShort")}
          aria-label={title}
        />
      )}

      <div className="facet__list">
        {ordered.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className={`facet__row ${on ? "is-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} />
              {/* Rang doirachasi — «ko'k» va «moviy» ni ajratadigan
                  yagona narsa. `hex` bo'lmasa chizilmaydi. */}
              {o.hex && <span className="facet__dot" style={{ background: o.hex }} aria-hidden="true" />}
              <span className="facet__label">{o.label}</span>
              <span className="facet__count ek-num">{o.count}</span>
            </label>
          );
        })}
        {ordered.length === 0 && (
          <div className="facet__empty">{t("common.notFound")}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Filtr oynasi.
 *
 * @param facets   serverdan kelgan `{ categories, brands, sizes, colors, targets, seasons }`
 * @param value    tanlanganlar — o'sha kalitlar bo'yicha massivlar
 * @param onChange yangi qiymat
 */
export default function FacetFilter({ facets, value, onChange, onClose }) {

  const toggle = (key, v) => {
    const cur = value[key] || [];
    onChange({
      ...value,
      [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    });
  };

  const total = Object.values(value).reduce((s, a) => s + (a?.length || 0), 0);

  const SECTIONS = [
    { key: "categories", icon: "fa-tag",       title: t("products.category") },
    { key: "targets",    icon: "fa-user-group", title: t("clothing.target") },
    { key: "sizes",      icon: "fa-ruler",      title: t("clothing.size") },
    { key: "colors",     icon: "fa-palette",    title: t("clothing.color") },
    { key: "brands",     icon: "fa-copyright",  title: t("clothing.brand") },
    { key: "seasons",    icon: "fa-sun",        title: t("clothing.season") },
  ];

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
             aria-label={t("common.filter")} onEscape={onClose}>
      <div className="ek-dialog facet-box">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-filter" aria-hidden="true" /> {t("common.filter")}
            {total > 0 && <span className="facet__badge ek-num">{total}</span>}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="facet-box__body">
          {SECTIONS.map((s) => (
            <Section
              key={s.key}
              title={s.title}
              icon={s.icon}
              options={facets?.[s.key] || []}
              selected={value[s.key] || []}
              onToggle={(v) => toggle(s.key, v)}
            />
          ))}
        </div>

        <div className="facet-box__foot">
          {/* ⚠ «TOZALASH» ALOHIDA TUGMA. Har bo'limni qo'lda bo'shatish
              oltita bosish edi va kassir ko'pincha yarmini unutib,
              «tizim noto'g'ri ko'rsatyapti» deb o'ylardi. */}
          <button type="button" className="btn btn-sm" disabled={total === 0}
                  onClick={() => onChange({})}>
            <i className="fa-solid fa-broom" aria-hidden="true" /> {t("common.reset")}
          </button>
          <button type="button" className="btn btn-green" onClick={onClose}>
            {t("common.apply")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
