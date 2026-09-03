import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { rankItems } from "../../lib/ek-search";

/* ==========================================================================
   e-Kassam — SELECT

   Native `<select>` o'rniga. Sabab: uning ochilgan ro'yxatini OS chizadi va
   CSS unga ta'sir qilmaydi — qorong'i rejimda oq tizim oynasi ochilib,
   variantlar ko'rinmay qolardi.

   Bu yerda hamma narsa qo'lda qilingan, shu jumladan native select BEPUL
   beradigan narsalar:
     · klaviatura: ↑ ↓ Home End Enter Space Esc, harf bosib topish
     · `role="listbox"` + `aria-activedescendant`
     · tashqariga bosilganda yopilish, fokus tugmaga qaytadi
     · pastda joy bo'lmasa yuqoriga ochilish
     · ochilganda tanlangan bandga scroll

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.

   @example
     <Select value={role} onChange={setRole}
             options={[{ value: "CASHIER", label: "Kassir", icon: "fa-user" }]} />
   ========================================================================== */

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = "Tanlang",
  disabled = false,
  invalid = false,
  variant = "",          // "field" | "compact" | ""
  block = false,
  icon,                  // tugmadagi doimiy ikonka (masalan tema belgisi)
  ariaLabel,
  id,
  className = "",
  emptyText = "Variant yo'q",

  /**
   * QIDIRUV maydoni ro'yxat tepasida.
   *
   * ⚠ QOIDA: MA'LUMOT ro'yxatida — HAR DOIM yoqiladi, QAT'IY
   * ro'yxatda — yo'q.
   *
   *   · ma'lumot (kategoriya, mijoz, yetkazib beruvchi, filial):
   *     bugun beshta bo'lsa ham ertaga o'ttizta bo'ladi va o'sha kuni
   *     foydalanuvchi ro'yxatni aylantirib qidirishga majbur qoladi —
   *     `searchable` ni ANIQ yozing;
   *   · qat'iy (to'lov turi, o'lchov birligi, QQS stavkasi): ro'yxat
   *     hech qachon o'smaydi va joylashuvi yodda qoladi — qidiruv
   *     u yerda ortiqcha bosqich.
   *
   * ⚠ Standarti — `null`, ya'ni AVTOMATIK: bandlar soni 8 dan oshsa
   * qidiruv o'zi paydo bo'ladi. Bu — ESLATIB QO'YILMAGAN joylar
   * uchun himoya to'ri, qoidaning o'rnini bosmaydi: uzun qat'iy
   * ro'yxat (masalan jurnal amallari) ham shu yo'l bilan qidiruv
   * oladi.
   *
   * Qidiruv KASSADAGI algoritm bilan ishlaydi (`lib/ek-search.js`):
   * kirillcha yozuv, apostrof, «x»/«h» farqi va xato yozilgan harf
   * ham topiladi.
   */
  searchable = null,
  searchPlaceholder = "Qidirish…",
  /** Tanlovni bekor qilish — maydon ichidagi ✕ tugmasi. */
  clearable = false,
  clearLabel = "Tozalash",
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);   // klaviatura bilan yurilgan band
  const [drop, setDrop] = useState("down");
  const [align, setAlign] = useState("left");

  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: "", at: 0 });

  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  /* Qidiruv KO'RSATILADIMI — aniq aytilmagan bo'lsa bandlar soniga qarab. */
  const showSearch = searchable == null ? options.length > 8 : !!searchable;

  /* ⚠ `useMemo` — reyting har bosishda emas, so'rov O'ZGARGANDA
     hisoblanadi. Usiz yuz bandli ro'yxatda har harakat (sichqoncha
     ustiga kelish ham) butun ro'yxatni qaytadan saralardi. */
  const shown = useMemo(
    () => (showSearch && query
      ? rankItems(options, query, { texts: (o) => [o.label, o.hint] })
      : options),
    [options, query, showSearch],
  );

  /* ⚠ Tanlangan band QIDIRILMAGAN ro'yxatdan izlanadi: u so'rovga mos
     kelmasa ham maydonda ko'rinib turishi kerak. */
  const selected = options.find((o) => String(o.value) === String(value)) || null;
  const selectedIndex = shown.findIndex((o) => String(o.value) === String(value));

  /* ── Ochilganda: tanlangan bandga turamiz va uni ko'rinishga suramiz ──── */
  useLayoutEffect(() => {
    if (!open) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);

    // Pastda joy yetmasa yuqoriga ochamiz — ro'yxat ekrandan chiqib ketmasin
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setDrop(window.innerHeight - r.bottom < 280 && r.top > 300 ? "up" : "down");
    // Ro'yxat tugmadan kengroq bo'lishi mumkin — o'ng chetdan chiqib ketmasin
    setAlign(window.innerWidth - r.left < 240 ? "right" : "left");
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /* ── Tashqariga bosish va Tab bilan chiqish ───────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onFocus = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  const close = ({ focusBtn = true } = {}) => {
    setOpen(false);
    /* ⚠ So'rov YOPILGANDA tozalanadi. Ilgari saqlansa, keyingi safar
       ro'yxat filtrlangan holda ochilar va foydalanuvchi «bandlar
       yo'qolib qolibdi» deb o'ylardi. */
    setQuery("");
    if (focusBtn) btnRef.current?.focus();
  };

  /* Ochilishi bilan qidiruvga fokus — foydalanuvchi darhol yoza oladi.
     ⚠ Sensorli ekranda ATAYLAB emas: u yerda ekran klaviaturasi
     o'zi ochilib, ro'yxatning yarmini yopib qo'yardi. */
  useEffect(() => {
    if (!open || !showSearch) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    searchRef.current?.focus();
  }, [open, showSearch]);

  const pick = (i) => {
    const opt = shown[i];
    if (!opt || opt.disabled) return;
    onChange?.(opt.value, opt);
    close();
  };

  /* ── Klaviatura ───────────────────────────────────────────────────────── */
  const onKeyDown = (e) => {
    const last = shown.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault(); setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":    e.preventDefault(); close(); return;
      case "Tab":       setOpen(false); return;            // fokus tabiiy ketadi
      case "ArrowDown": e.preventDefault(); setActive((i) => Math.min(last, i + 1)); return;
      case "ArrowUp":   e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return;
      case "Home":      e.preventDefault(); setActive(0); return;
      case "End":       e.preventDefault(); setActive(last); return;
      case "Enter":
      case " ":         e.preventDefault(); pick(active); return;
      default: break;
    }

    // Harf bosib topish — native select shunday ishlaydi, odat buzilmasin
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 800 ? e.key : t.text + e.key;
      t.at = now;
      const q = t.text.toLowerCase();
      const found = shown.findIndex((o) => String(o.label).toLowerCase().startsWith(q));
      if (found >= 0) setActive(found);
    }
  };

  const cls = [
    "ek-select",
    variant && `ek-select--${variant}`,
    block && "ek-select--block",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} ref={rootRef} data-open={open || undefined} data-drop={drop} data-align={align}>
      <button
        type="button"
        ref={btnRef}
        id={id}
        className="ek-select__btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        {(icon || selected?.icon) && (
          <i className={`fa-solid ${icon || selected.icon} ek-select__icon`} aria-hidden="true" />
        )}
        <span className="ek-select__value" data-placeholder={!selected || undefined}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ek-select__caret" aria-hidden="true">
          <i className="fa-solid fa-chevron-down" />
        </span>
      </button>

      {/* ⚠ ✕ TUGMASI — tugmaning ICHIDA emas, YONIDA joylashgan.
          Ichida bo'lsa u `<button>` ichidagi `<button>` bo'lib qolardi:
          HTML da bunday ichma-ichlik taqiqlangan va brauzer uni o'zi
          ajratib tashlab, ✕ ni selektdan TASHQARIGA chiqarib
          yuborardi. Shuning uchun u mutlaq joylashuvda ustiga
          qo'yiladi (`position: absolute`, CSS da). */}
      {/* ⚠ `selected` YETMAYDI. Ro'yxatda qiymati BO'SH band bo'lishi
          mumkin («Mijozsiz») va u ham «tanlangan» deb hisoblanardi —
          ✕ tozalagandan keyin ham ekranda qolib turardi va uni yana
          bosish mumkin edi. Tozalash faqat HAQIQIY qiymat bor
          paytda ma'noga ega. */}
      {clearable && selected && value !== "" && value != null && !disabled && (
        <button
          type="button"
          className="ek-select__clear"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={(e) => { e.stopPropagation(); onChange?.("", null); }}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          className="ek-select__list"
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          {showSearch && (
            <div className="ek-select__search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                /* ⚠ Klaviatura BOSHQARUVI tugmadagi bilan bir xil
                   ishlovchiga boradi: ↑ ↓ Enter Esc qidiruv maydonida
                   ham ishlashi kerak, aks holda foydalanuvchi yozib
                   bo'lgach sichqonchaga o'tishga majbur bo'lardi. */
                onKeyDown={onKeyDown}
              />
            </div>
          )}
          {shown.length === 0 && (
            <div className="ek-select__empty">{query ? searchPlaceholder : emptyText}</div>
          )}
          {shown.map((o, i) => (
            <button
              key={o.value ?? i}
              type="button"
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={String(o.value) === String(value)}
              aria-disabled={o.disabled || undefined}
              data-active={i === active || undefined}
              className="ek-select__opt"
              /* Sichqoncha ustiga kelganda ham "faol" band o'zgaradi —
                 klaviatura va sichqoncha bir xil joyni ko'rsatishi kerak */
              onMouseMove={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {o.icon && <i className={`fa-solid ${o.icon} ek-select__opt-icon`} aria-hidden="true" />}
              <span className="ek-select__opt-label">{o.label}</span>
              {/* ⚠ `hint` — O'Z USTUNIDA (telefon, kod, summa).
                  Ilgari u yorliqqa qo'shib yuborilardi («Ali · +998…»)
                  va ismlar uzunligi turlicha bo'lgani uchun raqamlar
                  har qatorda boshqa joydan boshlanardi — ro'yxatni
                  ko'z bilan kuzatib o'qib bo'lmasdi. Endi u o'ngga
                  tekislanadi va raqamlar bitta ustunda turadi. */}
              {o.hint && <span className="ek-select__opt-hint">{o.hint}</span>}
              <i className="fa-solid fa-check ek-select__opt-check" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
