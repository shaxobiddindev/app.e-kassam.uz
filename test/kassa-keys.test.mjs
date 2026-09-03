/* ══════════════════════════════════════════════════════════════════════════
   KASSA KLAVIATURA YORLIQLARI — sinov (V57).

   ⚠ NEGA MUHIM. Yorliqlar ilgari uch joyda alohida yozilgan edi va
   bir-biriga to'g'ri kelmay qolgan edi. Endi manba bitta, lekin bitta
   jadval ham TINCHGINA buzilishi mumkin: ikkita amalga bir kombinatsiya
   berilsa, ro'yxatda birinchisi ishlaydi va ikkinchisi HECH QACHON
   ishlamaydi — hech qanday xato ham chiqmaydi.

   Bu yerda qat'iy qayd etiladi:
     · bir sohada bir kombinatsiya IKKI marta ishlatilmaydi
     · brauzer egallagan kombinatsiyalar jadvalga TUSHMAYDI
     · modifikatorlar QAT'IY tekshiriladi (Ctrl+Shift+P ≠ Ctrl+P)
     · har qatorning tarjima kaliti bor

   Ishga tushirish:  node test/kassa-keys.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { KASSA_KEYS, matches, resolve, keyLabel, comboLabel }
  = await import("../src/lib/ek-kassa-keys.js");
const uz = (await import("../src/lib/locales/uz.js")).default;

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const yes = (c, m) => (c ? ok(m) : bad(m));
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

/** Soxta `KeyboardEvent`. */
const ev = (key, o = {}) => ({ key, ctrlKey: !!o.ctrl, altKey: !!o.alt, shiftKey: !!o.shift });

console.log("── Jadval butunligi ──");

/* ⚠ ENG MUHIM SINOV. Takrorlangan kombinatsiya hech qanday xato
   bermaydi — amal shunchaki JIMGINA ishlamay qoladi. */
for (const scope of ["cart", "pay"]) {
  const seen = new Map();
  let dup = null;
  for (const k of KASSA_KEYS) {
    if (k.scope !== "any" && k.scope !== scope) continue;
    if (seen.has(k.combo)) dup = `${k.combo}: ${seen.get(k.combo)} ↔ ${k.id}`;
    seen.set(k.combo, k.id);
  }
  yes(!dup, `«${scope}» sohasida takrorlangan kombinatsiya yo'q${dup ? " — " + dup : ""}`);
}

yes(new Set(KASSA_KEYS.map((k) => k.id)).size === KASSA_KEYS.length, "`id` lar takrorlanmaydi");

/* ⚠ Brauzer egallaganlari. Bosilganda kassa ko'zdan g'oyib bo'lardi. */
const FORBIDDEN = ["Alt+D", "Alt+E", "Alt+F", "Alt+ArrowLeft", "Alt+ArrowRight", "Alt+Home",
                   "Ctrl+T", "Ctrl+W", "Ctrl+N", "Ctrl+R", "Ctrl+L"];
const clash = KASSA_KEYS.filter((k) => FORBIDDEN.includes(k.combo)).map((k) => k.combo);
yes(clash.length === 0, `brauzer yorliqlari ishlatilmagan${clash.length ? " — " + clash : ""}`);

/* Tarjimasiz qator — yordam oynasida kalitning O'ZI ko'rinib qolardi. */
const noText = KASSA_KEYS.filter((k) => !uz[k.label]).map((k) => k.label);
yes(noText.length === 0, `har qatorning o'zbekcha matni bor${noText.length ? " — YO'Q: " + noText : ""}`);

console.log("\n── Modifikatorlar ──");

yes(matches(ev("p", { ctrl: 1 }), "Ctrl+P"), "Ctrl+P mos keladi");
/* ⚠ Ilgari faqat `e.ctrlKey` ga qaralardi va brauzerning yashirin
   oynasi (Ctrl+Shift+P) ham «qayta chop etish» deb tushunilardi. */
yes(!matches(ev("P", { ctrl: 1, shift: 1 }), "Ctrl+P"), "Ctrl+Shift+P — MOS EMAS");
yes(!matches(ev("p", { alt: 1 }), "Ctrl+P"), "Alt+P — mos emas");
yes(matches(ev("B", { alt: 1 }), "Alt+B"), "katta harf ham mos (CapsLock)");
yes(!matches(ev("b"), "Alt+B"), "modifikatorsiz «b» — mos emas");
/* `?` va `+` klaviaturaga qarab Shift bilan yoziladi. */
yes(matches(ev("?", { shift: 1 }), "?"), "«?» Shift bilan ham mos");
yes(matches(ev("+", { shift: 1 }), "+"), "«+» Shift bilan ham mos");

console.log("\n── Soha ajratish ──");

/* ⚠ TARIXIY: F2 ikki ekranda ikki xil ish qiladi va shunday QOLISHI
   kerak — kassirlarning barmog'i uni yod biladi. */
eq(resolve(ev("F2"), "cart"), "newCart", "F2 kassa ekranida — yangi savat");
eq(resolve(ev("F2"), "pay"),  "payCard", "F2 to'lov oynasida — karta");
eq(resolve(ev("F9"), "cart"), "pay", "F9 — ikkala ekranda ham to'lov");
eq(resolve(ev("F9"), "pay"),  "pay", "F9 to'lov oynasida ham");
eq(resolve(ev("ArrowUp"), "pay"), null, "savat yorliqlari to'lov oynasida ISHLAMAYDI");
eq(resolve(ev("z", { alt: 1 }), "cart"), null, "jadvalda yo'q kombinatsiya — null");

console.log("\n── Ko'rinadigan belgilar ──");
eq(keyLabel("linePrev"), "↑", "ArrowUp → ↑");
eq(keyLabel("lineDrop"), "Del", "Delete → Del");
eq(keyLabel("linePrice"), "↵", "Enter → ↵");
eq(comboLabel("Ctrl+P"), "Ctrl+P", "Ctrl+P o'zgarmaydi");
eq(keyLabel("yo-q-bunday"), "", "noma'lum `id` — bo'sh satr");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
