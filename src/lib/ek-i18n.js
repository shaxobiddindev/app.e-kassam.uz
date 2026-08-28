/* ==========================================================================
   e-Kassam — interfeys tili (uz · ru · en)

   QAMROV: faqat INTERFEYS. Foydalanuvchi kiritgan ma'lumot (tovar nomi,
   mijoz ismi, do'kon nomi, izoh) HECH QACHON tarjima qilinmaydi — u bazada
   qanday bo'lsa, shundayligicha ko'rsatiladi.

   Til shu tartibda aniqlanadi:
     1. URL dagi `?lang=` — ilovalararo yo'naltirishda uzatiladi
     2. localStorage `ek_lang` — foydalanuvchi tanlovi
     3. "uz" — tizimning ASOSIY tili. Brauzer tilidan taxmin YO'Q
        (ataylab): kompyuterlar ko'pincha ruscha/inglizcha o'rnatilgan,
        kassa esa o'zbekcha ochilishi kerak.

   Nega URL birinchi: `auth.e-kassam.uz` va `app.e-kassam.uz` — TURLI origin,
   localStorage ular orasida bo'linmaydi. deviceId bilan bir xil muammo
   (docs/09-CHETLANISHLAR.md §6). Shuning uchun til ham redirect parametrida
   uzatiladi, ilova esa uni o'z localStorage'iga ko'chiradi.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.
   ========================================================================== */

import { useCallback, useSyncExternalStore } from "react";
/* ⚠ O'ZBEKCHA STATIK, qolgani KECHIKTIRILGAN (V48).
   Ilgari uchala til ham kirish to'plamiga tushardi (~75 KB xom matn),
   holbuki do'kon bitta tilda ishlaydi. Endi faqat tanlangan til
   yuklanadi. O'zbekcha esa DOIM birga keladi va bu ataylab:
   1. u foydalanuvchilarning aksariyatining tili — ular uchun
      qo'shimcha so'rov umuman bo'lmaydi;
   2. u YETISHMAYOTGAN kalitlar uchun zaxira (`t()` quyida shundan
      oladi) — kechiktirilsa, yangi kalit tarjima qilinmagan tilda
      kalitning o'zi bo'lib chiqib qolardi. */
import uz from "./locales/uz";

const KEY = "ek_lang";

/* Yuklangan lug'atlar. `uz` doim shu yerda; qolgani `loadLocale` bilan
   qo'shiladi. */
const DICT = { uz };

const LOADERS = {
  ru: () => import("./locales/ru"),
  en: () => import("./locales/en"),
};

/* Bir tilni ikki marta tortmaslik uchun: so'rov ketgan bo'lsa, o'sha
   va'da qaytariladi. */
const pending = {};

/**
 * Tanlangan tilni yuklaydi.
 *
 * ⚠ `t()` SINXRON QOLADI. Bu shart: `t()` yuzlab joyda, shu jumladan
 * render ichida chaqiriladi va uni `await` qilinadigan qilish butun
 * ilovani qayta yozishni talab qilardi. Shuning uchun lug'at RENDERDAN
 * OLDIN yuklanadi (`main.jsx`), kalit esa quyidagi zaxira zanjiri
 * bo'yicha topiladi.
 *
 * ⚠ Xato YUTILADI: tarmoq uzilib chunk kelmasa ham ilova ishlashi
 * kerak — matn o'zbekchada chiqadi, bu bo'sh ekrandan yaxshiroq.
 */
export function loadLocale(lang) {
  const code = isValid(lang) ? lang : DEFAULT_LANG;
  if (DICT[code]) return Promise.resolve(DICT[code]);
  if (!LOADERS[code]) return Promise.resolve(DICT[DEFAULT_LANG]);
  if (!pending[code]) {
    pending[code] = LOADERS[code]()
      .then((m) => { DICT[code] = m.default; emit(); return DICT[code]; })
      .catch(() => DICT[DEFAULT_LANG]);
  }
  return pending[code];
}

/** Qo'llab-quvvatlanadigan tillar. UI shu ro'yxatdan quriladi. */
export const LANGS = [
  { value: "uz", label: "O'zbekcha", short: "UZ", icon: "fa-language" },
  { value: "ru", label: "Русский",   short: "RU", icon: "fa-language" },
  { value: "en", label: "English",   short: "EN", icon: "fa-language" },
];

const CODES = LANGS.map((l) => l.value);
export const DEFAULT_LANG = "uz";

const isValid = (v) => CODES.includes(v);

/* ── Holat ─────────────────────────────────────────────────────────────── */

function detect() {
  // 1. URL — ilovalararo uzatish
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (isValid(fromUrl)) return fromUrl;
  } catch (_) { /* SSR yoki test muhiti */ }

  // 2. Foydalanuvchi tanlovi
  try {
    const saved = localStorage.getItem(KEY);
    if (isValid(saved)) return saved;
  } catch (_) { /* private mode */ }

  // 3. O'zbekcha — tizimning ASOSIY tili (2026-08-07 qarori).
  // ⚠ Brauzer tilidan taxmin ATAYLAB yo'q: mijozlar O'zbekistonda, lekin
  // Windows/brauzer ko'pincha ruscha yoki inglizcha o'rnatilgan bo'ladi —
  // kassa shunga qarab chet tilida ochilib ketardi. Boshqa til kerak
  // bo'lsa foydalanuvchi Sozlamalardan tanlaydi va tanlov saqlanadi.
  return DEFAULT_LANG;
}

let current = detect();

/* ── Obuna (React qayta chizishi uchun) ────────────────────────────────── */

const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* ⚠ SUR'AT (`snapshot`) TIL KODIDAN KENGROQ (V48).
   `useSyncExternalStore` sur'atni `Object.is` bilan solishtiradi va u
   o'zgarmagan bo'lsa qayta chizmaydi. Ilgari sur'at TIL KODINING o'zi
   edi va tillar bo'linganidan keyin bu xatoga aylandi:

     1. `setLang("ru")` — kod uz→ru, ekran qayta chiziladi, LEKIN ruscha
        lug'at hali yo'q (chunk yo'lda) va matn o'zbekcha chiqadi;
     2. chunk keladi, `loadLocale` `emit()` qiladi — kod hamon "ru",
        ya'ni sur'at O'ZGARMAGAN va React qayta chizmaydi.

   Natijada til almashardi-yu, matn o'zbekcha qolib ketardi. Endi
   sur'atga yuklangan lug'atlar soni ham kiradi: chunk kelishi uni
   o'zgartiradi va ekran ruschaga o'tadi. Brauzerda aynan shu ushlandi. */
let snapshot = `${current}:${Object.keys(DICT).length}`;
const emit = () => {
  snapshot = `${current}:${Object.keys(DICT).length}`;
  listeners.forEach((fn) => fn());
};
/* ⚠ Har chaqiruvda YANGI qiymat qaytarmaydi: `useSyncExternalStore`
   buni cheksiz sikl deb hisoblardi. */
const getSnapshot = () => snapshot;

/* ── Ommaviy API ───────────────────────────────────────────────────────── */

/** Joriy til kodi: "uz" | "ru" | "en". */
export function getLang() {
  return current;
}

/** Joriy til yozuvi (label, short, icon bilan). */
export function getLangEntry() {
  return LANGS.find((l) => l.value === current) || LANGS[0];
}

/**
 * Tilni o'rnatadi va saqlaydi. Sahifa qayta yuklanmaydi — `useT` ga
 * obuna bo'lgan barcha komponentlar o'zi qayta chiziladi.
 */
export function setLang(lang) {
  const next = isValid(lang) ? lang : DEFAULT_LANG;
  if (next === current) return next;
  current = next;
  try { localStorage.setItem(KEY, next); } catch (_) { /* private mode */ }
  paint(next);
  /* ⚠ Lug'at hali kelmagan bo'lishi mumkin — kutilmaydi. Interfeys
     darhol o'zbekchada qayta chiziladi, chunk kelgach `loadLocale`
     o'zi yana `emit()` qiladi va matn almashadi. Kutilsa, til tanlash
     tugmasi bosilgach ekran bir necha yuz millisekund qotib turardi. */
  loadLocale(next);
  emit();
  return next;
}

function paint(lang) {
  try {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-lang", lang);
  } catch (_) { /* DOM yo'q */ }
}

/**
 * Ilova ko'tarilishida bir marta. URL dan kelgan tilni localStorage ga
 * ko'chiradi — shundan keyin foydalanuvchi bu originda uni qayta tanlamaydi.
 */
export function initLang() {
  try { localStorage.setItem(KEY, current); } catch (_) { /* private mode */ }
  paint(current);
  return current;
}

/* ── Tarjima ───────────────────────────────────────────────────────────── */

/**
 * `t("common.save")` → "Saqlash"
 * `t("users.count", { n: 5 })` → "5 ta xodim"
 *
 * Kalit topilmasa: avval `uz` dan olinadi (yangi kalit hali tarjima
 * qilinmagan bo'lishi mumkin), u ham bo'lmasa KALITNING O'ZI qaytariladi —
 * bo'sh joy emas, shunda yetishmayotgan tarjima darrov ko'rinadi.
 */
export function t(key, vars) {
  const raw =
    DICT[current]?.[key] ??
    DICT[DEFAULT_LANG]?.[key] ??
    key;

  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (m, name) =>
    vars[name] === undefined || vars[name] === null ? m : String(vars[name])
  );
}

/** Ko'plik shakli kerak bo'lganda: `plural("cart.items", n)`. */
export function plural(key, n, vars) {
  const suffix = current === "uz" ? "" : n === 1 ? ".one" : ".many";
  const withCount = { n, ...vars };
  const candidate = key + suffix;
  return DICT[current]?.[candidate] !== undefined
    ? t(candidate, withCount)
    : t(key, withCount);
}

/* ── React ─────────────────────────────────────────────────────────────── */

/**
 * `const { t, lang, setLang } = useT();`
 *
 * `useSyncExternalStore` tanlandi (useState + useEffect emas): til
 * o'zgarganda BARCHA obuna bo'lgan komponentlar bitta kadrda yangilanadi
 * va "yarmi eski tilda" holati bo'lmaydi.
 */
export function useT() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LANG);
  // Sur'at bog'liqlikda: til o'zgarsa HAM, lug'at kech kelsa HAM `t`
  // yangi havola oladi va uni memo ichida ishlatgan komponentlar ham
  // qayta hisoblanadi.
  const translate = useCallback((key, vars) => t(key, vars), [snap]);
  return { t: translate, lang: getLang(), setLang, langs: LANGS };
}

/* ── Ilovalararo uzatish ───────────────────────────────────────────────── */

/**
 * URL ga joriy tilni qo'shadi. Login → app/admin yo'naltirishida SHART:
 * originlar turli, localStorage bo'linmaydi.
 *
 *   withLang("https://app.e-kassam.uz")        → ".../?lang=ru"
 *   withLang(`${LOGIN_URL}?logged_out=1`)      → "...?logged_out=1&lang=ru"
 */
export function withLang(url, lang) {
  const code = isValid(lang) ? lang : current;
  const sep = String(url).includes("?") ? "&" : "?";
  return `${url}${sep}lang=${code}`;
}

/** Faqat parametr kerak bo'lganda: `lang=ru`. */
export function langParam(lang) {
  return `lang=${isValid(lang) ? lang : current}`;
}

/** Backend `Accept-Language` uchun. */
export function acceptLanguage() {
  return current;
}

paint(current);
