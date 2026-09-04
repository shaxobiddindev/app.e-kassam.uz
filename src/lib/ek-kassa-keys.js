/* ══════════════════════════════════════════════════════════════════════════
   KASSA KLAVIATURA YORLIQLARI — YAGONA MANBA (V57)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Do'konlarning ko'pi SENSORSIZ monoblok ishlatadi: ekranga barmoq
   tegmaydi, har amal uchun sichqonchani olib, kursorni tugmagacha
   yetkazish kerak. Navbatda turgan mijoz oldida bu har chekda o'nlab
   ortiqcha harakat. Kassirning ikkala qo'li klaviaturada bo'lishi kerak.

   ═══ NEGA BITTA JADVAL ════════════════════════════════════════════════

   Ilgari yorliqlar uch joyda yashardi: `keydown` ishlovchisida, tugma
   yonidagi `<span className="kbd">` da va sahifa boshidagi izohda. Ular
   allaqachon bir-biriga to'g'ri kelmay qolgan edi (izohda F2 ikki xil
   vazifa bilan yozilgan). Endi manba BITTA: quyidagi jadval. Ishlovchi
   ham, ekrandagi belgilar ham, yordam oynasi ham shundan o'qiydi —
   yangi yorliq qo'shish uchun bitta qator yetadi.

   ═══ HARFLAR QANDAY TANLANDI ══════════════════════════════════════════

   ⚠ VAZIFANING O'ZBEKCHA NOMIDAN: Bo'lim → Alt+B, Ko'rinish → Alt+K,
   Sevimli → Alt+S, Mijoz → Alt+M, Chegirma → Alt+C, Yangi mijoz →
   Alt+Y. Ingliz tilidan olingan harf kassirga hech narsa demasdi.

   ⚠ BROUZER EGALLAGANLARIDAN QOCHILDI: Alt+D (manzil qatori),
   Alt+E / Alt+F (menyu), Alt+← / Alt+→ (orqaga-oldinga) va Ctrl+1..9
   (varaqlar) ISHLATILMAYDI — ular bosilganda kassa ko'zdan g'oyib
   bo'lardi. Ctrl+P va Ctrl+O esa ATAYLAB olingan va `preventDefault`
   bilan to'siladi: chop etish va ochish oynalari bu yerda keraksiz.

   ⚠ F1..F4 TO'LOV OYNASIDA boshqa ma'noda — bu tarixiy va ataylab
   saqlangan: kassirlarning barmog'i uni yod biladi. Shuning uchun har
   qatorda `scope` bor va ishlovchi faqat o'z sohasidagini bajaradi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `scope`:
 *   `"cart"` — kassa ekrani (oyna ochiq bo'lmaganda)
 *   `"pay"`  — to'lov oynasi ochiq bo'lganda
 *   `"any"`  — ikkalasida ham
 */
export const KASSA_KEYS = [
  /* ── Qidiruv va savatlar ─────────────────────────────────────────── */
  { id: "search",    combo: "/",        scope: "cart", label: "kbd.search" },
  { id: "newCart",   combo: "F2",       scope: "cart", label: "kbd.newCart" },
  { id: "nextCart",  combo: "F3",       scope: "cart", label: "kbd.nextCart" },
  { id: "closeCart", combo: "F4",       scope: "cart", label: "kbd.closeCart" },

  /* ── Katalog ─────────────────────────────────────────────────────── */
  { id: "category",  combo: "Alt+B",    scope: "cart", label: "kbd.category" },
  { id: "favorites", combo: "Alt+S",    scope: "cart", label: "kbd.favorites" },
  { id: "view",      combo: "Alt+K",    scope: "cart", label: "kbd.view" },
  /* ⚠ FILTR — «T» dan, «F» dan EMAS. «Filtr» so'zi «F» ni taklif
     qiladi-yu, `Alt+F` brauzerning MENYUSINI ochadi va kassa ko'zdan
     g'oyib bo'lardi (sinovda tutildi). «T» — do'kon egasining o'z
     so'zidan: «bir nechtasini TANLAB bo'lsin». */
  { id: "filter",    combo: "Alt+T",    scope: "cart", label: "kbd.filter" },

  /* ── Savat qatorlari ─────────────────────────────────────────────── */
  { id: "linePrev",  combo: "ArrowUp",   scope: "cart", label: "kbd.linePrev" },
  { id: "lineNext",  combo: "ArrowDown", scope: "cart", label: "kbd.lineNext" },
  { id: "linePlus",  combo: "+",         scope: "cart", label: "kbd.linePlus" },
  { id: "lineMinus", combo: "-",         scope: "cart", label: "kbd.lineMinus" },
  { id: "linePrice", combo: "Enter",     scope: "cart", label: "kbd.linePrice" },
  { id: "lineDrop",  combo: "Delete",    scope: "cart", label: "kbd.lineDrop" },
  /* ⚠ «0-9» — HUJJAT UCHUN QATOR, `resolve` unga hech qachon mos
     kelmaydi (uch belgili «tugma» yo'q). Raqamlar `KassaPage` da
     jadvaldan OLDIN tutiladi (`ek-qty-type.js`): ular yorliq emas,
     matn — lekin yordam oynasida kassir buni ko'rishi kerak. */
  { id: "lineQty",   combo: "0-9",       scope: "cart", label: "kbd.lineQty" },

  /* ── Apparat ─────────────────────────────────────────────────────── */
  { id: "drawer",    combo: "Ctrl+O",   scope: "cart", label: "kbd.drawer" },
  { id: "reprint",   combo: "Ctrl+P",   scope: "cart", label: "kbd.reprint" },

  /* ── To'lov ──────────────────────────────────────────────────────── */
  { id: "pay",       combo: "F9",       scope: "any",  label: "kbd.pay" },
  /* ⚠ F1..F4 — TO'LOV USULINI TANLAYDI, uni yakunlamaydi. Bosilganda
     kursor summa maydoniga o'tadi va o'sha usulning oldingi qiymati
     ko'rinadi. Nasiya uchun tugma YO'Q: to'lanmagan qoldiq o'zi
     nasiyaga yoziladi. */
  { id: "payCash",   combo: "F1",       scope: "pay",  label: "kbd.payCash" },
  { id: "payCard",   combo: "F2",       scope: "pay",  label: "kbd.payCard" },
  { id: "payClick",  combo: "F3",       scope: "pay",  label: "kbd.payClick" },
  { id: "payPayme",  combo: "F4",       scope: "pay",  label: "kbd.payPayme" },
  /* ⚠ `Alt+J` — JAMG'ARMA (V63), F5 EMAS. F1..F4 to'lov usullariga
     bog'langan va beshinchisini qo'shish qatorni davom ettirgandek
     ko'rinardi-yu, aslida jamg'arma boshqa narsa: u mijozning
     hisobidan yechadi va faqat mijoz tanlanganda ishlaydi. Harf esa
     o'zbekcha nomdan — qolgan yorliqlardagi qoida bilan bir xil. */
  { id: "paySavings", combo: "Alt+J",   scope: "pay",  label: "kbd.paySavings" },
  /* ⚠ O'SHA `Alt+J` — KASSA EKRANIDA «jamg'armaga pul qo'yish» (V66).
     Harf bitta, ma'no bitta: J — jamg'arma. To'lov oynasida undan
     TO'LANADI, kassa ekranida unga QO'YILADI; soha ajratib turadi. */
  { id: "topUp",     combo: "Alt+J",    scope: "cart", label: "kbd.topUp" },
  { id: "customer",  combo: "Alt+M",    scope: "pay",  label: "kbd.customer" },
  { id: "newCust",   combo: "Alt+Y",    scope: "pay",  label: "kbd.newCust" },
  { id: "discount",  combo: "Alt+C",    scope: "pay",  label: "kbd.discount" },

  /* ── Umumiy ──────────────────────────────────────────────────────── */
  { id: "help",      combo: "?",        scope: "any",  label: "kbd.help" },
];

/** Tez qidirish uchun: `id` → qator. */
export const KEY_BY_ID = Object.fromEntries(KASSA_KEYS.map((k) => [k.id, k]));

/** Tugma yonida ko'rsatiladigan belgi (`kbd.combo` emas, o'qiladigan shakl). */
const PRETTY = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  Delete: "Del",
  Enter: "↵",
};

/** `"Alt+B"` → `"Alt+B"`, `"ArrowUp"` → `"↑"`. */
export function comboLabel(combo) {
  const { key, want } = parseCombo(combo);
  const mods = [want.ctrl && "Ctrl", want.alt && "Alt", want.shift && "Shift"].filter(Boolean);
  return [...mods, PRETTY[key] || key].join("+");
}

/** `id` bo'yicha ko'rinadigan belgi — JSX da shu chaqiriladi. */
export const keyLabel = (id) => {
  const k = KEY_BY_ID[id];
  return k ? comboLabel(k.combo) : "";
};

/** `"Ctrl+Alt+P"` → `{ key: "P", want: {ctrl, alt, shift} }`. */
function parseCombo(combo) {
  let rest = combo;
  const want = { ctrl: false, alt: false, shift: false };
  const PREFIX = [["Ctrl+", "ctrl"], ["Alt+", "alt"], ["Shift+", "shift"]];
  let matched = true;
  while (matched) {
    matched = false;
    for (const [p, flag] of PREFIX) {
      /* ⚠ `rest !== p` sharti: yorliqning O'ZI «Shift+» bo'lolmaydi,
         lekin «+» bo'lishi mumkin va uni prefiks deb qirqib
         yubormaslik kerak. */
      if (rest.startsWith(p) && rest.length > p.length) {
        want[flag] = true; rest = rest.slice(p.length); matched = true;
      }
    }
  }
  return { key: rest, want };
}

/**
 * Hodisa shu kombinatsiyaga mos keladimi.
 *
 * ⚠ MODIFIKATORLAR QAT'IY TEKSHIRILADI. Ilgari faqat `e.ctrlKey` ga
 * qaralardi va `Ctrl+Shift+P` (brauzerning yashirin oynasi) ham
 * «qayta chop etish» deb tushunilardi.
 *
 * ⚠ HARF KATTA-KICHIGI HISOBGA OLINMAYDI: `Alt+B` bosilganda brauzer
 * `e.key` ni «b» ham, «B» ham qilib berishi mumkin (Shift, CapsLock,
 * klaviatura sxemasi). Kassir uchun ikkalasi bir xil tugma.
 */
export function matches(e, combo) {
  /* ⚠ `split("+")` ISHLATILMAYDI. «+» ning O'ZI ham yorliq (savatdagi
     miqdorni oshirish) va `"+".split("+")` ikkita BO'SH satr beradi —
     ya'ni tugmaning nomi yo'qoladi va yorliq hech qachon ishlamasdi.
     Shuning uchun modifikatorlar oldindan QIRQILADI, qolgani esa
     tugmaning o'zi bo'ladi, u «+» bo'lsa ham. */
  const { key, want } = parseCombo(combo);
  if (e.ctrlKey !== want.ctrl) return false;
  if (e.altKey !== want.alt) return false;
  /* ⚠ `?` VA `+` NING O'ZI Shift bilan yoziladi (klaviaturaga qarab),
     shuning uchun ular uchun Shift TEKSHIRILMAYDI. Aks holda yorliq
     hech qachon ishlamasdi. */
  if (!"?+".includes(key) && e.shiftKey !== want.shift) return false;

  if (key.length === 1) return (e.key || "").toLowerCase() === key.toLowerCase();
  return e.key === key;
}

/**
 * Bosilgan tugmaga mos yorliqning `id` si (yoki `null`).
 *
 * @param scope `"cart"` yoki `"pay"` — hozir qaysi ekran ochiq
 */
export function resolve(e, scope) {
  for (const k of KASSA_KEYS) {
    if (k.scope !== "any" && k.scope !== scope) continue;
    if (matches(e, k.combo)) return k.id;
  }
  return null;
}
