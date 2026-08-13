/* ==========================================================================
   e-Kassam — QAT'IY KIRITISH MAYDONLARI

   MANBA FAYL — packages/ui/components/ da tahrirlanadi, sync-tokens.ps1
   uni har ilovaning `src/components/ek/` papkasiga ko'chiradi.

   Har bir komponent `<input>` ustidagi yupqa qatlam:
     • kiritilgan matnni MAYDON TURIGA mos shaklga keltiradi (`ek-input.js`),
     • ekranda formatlangan ko'rinishni chizadi (razryad, telefon niqobi),
     • ota-onaga TOZA qiymat beradi — `onChange({ target: { value, name } })`.

   Oxirgi nuqta ataylab: mavjud sahifalarda `onChange={(e) => setForm(...
   e.target.value)}` yozilgan yuzlab joy bor. Komponentlar o'sha shartnomani
   saqlaydi, shuning uchun sahifada faqat TEG NOMI o'zgaradi.

   ⚠ KURSOR. Formatlangan maydonda qiymat qayta chizilgani uchun kursor
   oxiriga sakrab ketadi — o'rtadagi raqamni tuzatib bo'lmay qoladi. Shu
   sababli kursordan oldingi RAQAMLAR SONI eslab qolinadi va qayta
   chizilgandan keyin kursor o'sha raqamdan keyin qo'yiladi.

   ⚠ `forwardRef` SHART: kirish sahifasi birinchi maydonga fokus beradi
   (`ref`), kassa esa skanerdan keyin maydonni tanlaydi. Oddiy
   funksiya-komponent `ref` ni yutib yuboradi va bu JIMGINA buziladi.
   ========================================================================== */
import { forwardRef, useRef, useLayoutEffect, useImperativeHandle } from "react";
import {
  numberInput, displayNumber, countDigits,
  phoneInput, emailInput, barcodeInput, mxikInput,
  codeInput, usernameInput, nameInput, otpInput,
} from "../../lib/ek-input";   // ⚠ ilova ichidagi yo'l (sync-tokens `src/lib/` ga qo'yadi)

/* Kursorni raqam indeksiga qarab tiklaydi. */
function useCaret(ref) {
  const wanted = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || wanted.current == null) return;
    const want = wanted.current;
    wanted.current = null;
    if (document.activeElement !== el) return;
    /* Oxiriga yozayotgan bo'lsa — kursor oxirida qoladi. ⚠ Bu shart:
       "1 234." holatida kursorni OXIRGI RAQAMDAN keyin qo'ysak, u nuqtadan
       OLDIN turadi va keyingi raqam nuqtadan oldin tushib, kasr qismini
       yozib bo'lmaydi ("12,99" → "1299."). */
    if (want === "end") { try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {} return; }
    let seen = 0, pos = el.value.length;
    for (let i = 0; i < el.value.length; i++) {
      if (/\d/.test(el.value[i])) {
        seen++;
        if (seen === want) { pos = i + 1; break; }
      }
    }
    if (want === 0) pos = el.value.search(/\d/) === -1 ? el.value.length : 0;
    try { el.setSelectionRange(pos, pos); } catch (_) { /* type=email caretni qo'llamaydi */ }
  });
  return wanted;
}

/* ── Son: pul, miqdor, foiz, butun son ───────────────────────────────── */

const KINDS = {
  money:   { decimals: 2, min: 0, inputMode: "decimal" },
  qty:     { decimals: 3, min: 0, inputMode: "decimal" },
  percent: { decimals: 2, min: 0, max: 100, inputMode: "decimal" },
  int:     { decimals: 0, min: 0, inputMode: "numeric" },
  /* Manfiy ham mumkin bo'lgan YAGONA tur — ommaviy narx o'zgartirish
     ("-10%" mavsumiy chegirma). Boshqa joyda ishlatilmasin. */
  signed:  { decimals: 2, min: null, inputMode: "decimal" },
};

/**
 * `kind`: "money" | "qty" | "percent" | "int" | "signed".
 *
 * ⚠ `type="number"` ATAYLAB ISHLATILMAYDI. Sabablari:
 *   1. `min="0"` kiritishni to'smaydi — `-500` bemalol yoziladi;
 *   2. brauzer "e", "+", "-" belgilarini qabul qiladi ("1e5" — son emas);
 *   3. sichqoncha g'ildiragi maydon ustida aylansa qiymat JIMGINA o'zgaradi;
 *   4. razryadlarga ajratib bo'lmaydi (1 240 000 o'qilishi kerak).
 */
export const NumField = forwardRef(function NumField({
  kind = "money", value, onChange, name,
  decimals, min, max, className = "form-input ek-num", onBlur, ...rest
}, fwdRef) {
  const preset = KINDS[kind] || KINDS.money;
  const opts = {
    decimals: decimals ?? preset.decimals,
    /* ⚠ `??` EMAS: `signed` turida `preset.min` ATAYLAB `null` (minus
       ruxsat etilgan), `??` esa uni 0 ga almashtirib qo'yardi. */
    min: min !== undefined ? min : preset.min,
    max: max !== undefined ? max : (preset.max ?? null),
  };
  const ref = useRef(null);
  useImperativeHandle(fwdRef, () => ref.current, []);
  const caret = useCaret(ref);

  function handle(e) {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const { raw } = numberInput(el.value, opts);
    caret.current = pos >= el.value.length ? "end"
                                           : Math.min(countDigits(before), countDigits(raw));
    onChange?.({ target: { value: raw, name } });
  }

  function blur(e) {
    // "12." holatida qolib ketmasin
    const { raw } = numberInput(e.target.value, opts);
    const tidy = raw.endsWith(".") ? raw.slice(0, -1) : raw;
    if (tidy !== String(value ?? "")) onChange?.({ target: { value: tidy, name } });
    onBlur?.(e);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={preset.inputMode}
      autoComplete="off"
      className={className}
      name={name}
      value={displayNumber(value, { decimals: opts.decimals })}
      onChange={handle}
      onBlur={blur}
      onWheel={(e) => e.currentTarget.blur()}   // g'ildirak qiymatni o'zgartirmasin
      {...rest}
    />
  );
});

/* ── Niqobli matn maydonlari ─────────────────────────────────────────── */

const MaskedField = forwardRef(function MaskedField(
  { mask, value, onChange, name, className = "form-input", keepCaret = true, ...rest }, fwdRef
) {
  const ref = useRef(null);
  useImperativeHandle(fwdRef, () => ref.current, []);
  const caret = useCaret(ref);
  const shown = mask(value ?? "");

  function handle(e) {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const next = mask(el.value);
    if (keepCaret) {
      caret.current = pos >= el.value.length ? "end"
                                             : Math.min(countDigits(before), countDigits(next.raw));
    }
    onChange?.({ target: { value: next.raw, name } });
  }

  return (
    <input
      ref={ref}
      className={className}
      name={name}
      value={shown.display}
      onChange={handle}
      {...rest}
    />
  );
});

/** Niqob funksiyasidan komponent yasaydi — hammasi bir xil qoidada. */
function masked(displayName, mask, defaults = {}) {
  const Cmp = forwardRef(function Typed(props, ref) {
    return <MaskedField ref={ref} mask={mask} {...defaults} {...props} />;
  });
  Cmp.displayName = displayName;
  return Cmp;
}

/** Faqat tozalaydigan niqoblar uchun `{raw, display}` qobig'i. */
const plain = (fn) => (v) => { const raw = fn(v); return { raw, display: raw }; };

/** +998 (90) 123-45-67 — 998 dan boshqa kod kiritib bo'lmaydi. */
export const PhoneField = masked("PhoneField", phoneInput, {
  type: "tel", inputMode: "tel", autoComplete: "tel",
  placeholder: "+998 (90) 123-45-67", maxLength: 19,
  className: "form-input ek-num",
});

/** Bo'shliqsiz, kichik harfda. */
export const EmailField = masked("EmailField", plain(emailInput), {
  type: "email", inputMode: "email", autoComplete: "email", spellCheck: false,
  placeholder: "pochta@example.com", keepCaret: false,
});

/** Faqat raqam, 14 tagacha. */
export const BarcodeField = masked("BarcodeField", plain(barcodeInput), {
  inputMode: "numeric", autoComplete: "off", className: "form-input ek-num",
});

/** 17 raqamgacha (MXIK). */
export const MxikField = masked("MxikField", plain(mxikInput), {
  inputMode: "numeric", autoComplete: "off", className: "form-input ek-num",
});

/** Kichik lotin + raqam + `-` `_` (do'kon/filial kodi). */
export const CodeField = masked("CodeField", plain(codeInput), {
  autoComplete: "off", spellCheck: false, keepCaret: false, className: "form-input mono",
});

/** Kichik lotin + raqam + `_` (foydalanuvchi nomi). */
export const UsernameField = masked("UsernameField", plain(usernameInput), {
  autoComplete: "username", spellCheck: false, keepCaret: false, className: "form-input mono",
});

/** Ism-familiya: raqam va maxsus belgilarsiz. */
export const NameField = masked("NameField", plain(nameInput), {
  autoComplete: "off", keepCaret: false,
});

/** TOTP (6 raqam) yoki tiklash kodi ("ABCD-EFGH") — ikkalasi ham. */
export const OtpField = masked("OtpField", plain(otpInput), {
  inputMode: "text", autoComplete: "one-time-code", spellCheck: false,
  maxLength: 9, keepCaret: false, className: "form-input ek-num",
});
