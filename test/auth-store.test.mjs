/* ══════════════════════════════════════════════════════════════════════════
   SESSIYA HOLATI UMUMIY BO'LISHI SHART

   ⚠ BU SINOV HAQIQIY NUQSON USTIGA YOZILDI (2026-09-13). `useAuth`
   oddiy `useState` bilan yozilgan edi va to'rt joyda chaqirilardi:
   `App`, `SettingsPage`, `BranchSelector`, `ShopUsersPage`. Har
   chaqiruv O'Z holatini yaratardi.

   Oqibati: Sozlamalardan chiqilganda `logout()` SettingsPage
   nusxasini `null` qilardi, `App.jsx` niki esa tegilmasdi — ekran
   o'zgarmay qolardi. Kassir ilovani X bilan yopib qayta ochishga
   majbur bo'lardi. Har smena oxirida.

   ⚠ NEGA BUNI HECH KIM SEZMAGAN: brauzerda `logout` sahifani
   butunlay almashtiradi (`location.replace`), ya'ni holat baribir
   noldan o'qiladi. Nosozlik FAQAT `.exe` va telefon ilovasida
   chiqardi — o'sha yerda chiqish oynani tashlab ketmaydi.

   Ishga tushirish:  node test/auth-store.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/hooks/useAuth.js", import.meta.url), "utf8");
/* Izohlar tashlanadi: ular `useState` so'zini tarix sifatida eslaydi. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg); }
};

console.log("\n═══ Sessiya holati umumiymi ═══\n");

ok(!/useState/.test(code),
   "⚠ `useState` ISHLATILMAYDI — u har chaqiruvga alohida holat yasardi");

ok(/useSyncExternalStore/.test(code),
   "umumiy do'kon (`useSyncExternalStore`) ishlatiladi");

ok(/subscribers/.test(code) && /\.forEach\(/.test(code),
   "⚠ o'zgarish HAMMA chaqiruvchiga yetkaziladi, faqat o'ziga emas");

/* ⚠ Keshsiz `readUser()` har chaqiruvda yangi obyekt qaytaradi va
   React "snapshot o'zgardi" deb cheksiz qayta chizardi. */
ok(/cached\s*=\s*readUser\(\)/.test(code) && /if \(cached === undefined\)/.test(code),
   "⚠ snapshot KESHLANADI — aks holda cheksiz qayta chizish");

/* Desktopda chiqish oynani tashlab ketmaydi, ya'ni ekranni
   almashtiradigan yagona narsa — xabar berish. */
const logoutBody = code.slice(code.indexOf("const logout"));
ok(/isNativeShell\(\)\s*\)\s*\{\s*refreshUser\(\);\s*return;/.test(logoutBody),
   "⚠ desktopda chiqish `refreshUser()` chaqiradi — ekran shu bilan almashadi");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
