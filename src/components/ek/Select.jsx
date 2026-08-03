import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);   // klaviatura bilan yurilgan band
  const [drop, setDrop] = useState("down");

  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: "", at: 0 });

  const autoId = useId();
  const listId = `${id || autoId}-list`;

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  /* ── Ochilganda: tanlangan bandga turamiz va uni ko'rinishga suramiz ──── */
  useLayoutEffect(() => {
    if (!open) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);

    // Pastda joy yetmasa yuqoriga ochamiz — ro'yxat ekrandan chiqib ketmasin
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setDrop(window.innerHeight - r.bottom < 280 && r.top > 300 ? "up" : "down");
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
    if (focusBtn) btnRef.current?.focus();
  };

  const pick = (i) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange?.(opt.value, opt);
    close();
  };

  /* ── Klaviatura ───────────────────────────────────────────────────────── */
  const onKeyDown = (e) => {
    const last = options.length - 1;

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
      const found = options.findIndex((o) => String(o.label).toLowerCase().startsWith(q));
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
    <div className={cls} ref={rootRef} data-open={open || undefined} data-drop={drop}>
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

      {open && (
        <div
          className="ek-select__list"
          id={listId}
          role="listbox"
          ref={listRef}
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          {options.length === 0 && <div className="ek-select__empty">{emptyText}</div>}
          {options.map((o, i) => (
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
              <i className="fa-solid fa-check ek-select__opt-check" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
