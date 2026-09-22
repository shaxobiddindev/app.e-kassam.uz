/* ══════════════════════════════════════════════════════════════════════════
   TO'LIQ EKRAN — ikki muhitda ikki yo'l

   Bu yerda tekshirilayotgan nosozlik jimgina bo'ladi: noto'g'ri yo'l
   tanlansa ilova xato bermaydi, shunchaki ekran to'liq bo'lmaydi. Aynan
   shuning uchun sinov bor.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let pass = 0, fail = 0;
const yes = (c, m) => { c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m)); };

/* ── Soxta brauzer ──────────────────────────────────────────────────── */
let asked = [];            // qaysi API chaqirildi
const browserDoc = () => ({
  fullscreenElement: null,
  documentElement: {
    requestFullscreen() { asked.push("requestFullscreen"); browser.fullscreenElement = {}; return Promise.resolve(); },
  },
  exitFullscreen() { asked.push("exitFullscreen"); browser.fullscreenElement = null; return Promise.resolve(); },
  addEventListener() {}, removeEventListener() {},
});
let browser = browserDoc();

global.document = new Proxy({}, {
  get: (_, k) => browser[k],
  set: (_, k, v) => { browser[k] = v; return true; },
});
global.window = {};        // brauzer: Tauri yo'q

const { enterFullscreen, exitFullscreen, setFullscreen } =
  await import("../src/lib/ek-fullscreen.js");

console.log("── Brauzer ──");

await enterFullscreen();
yes(asked.includes("requestFullscreen"), "yoqilganda Fullscreen API chaqiriladi");

asked = [];
await exitFullscreen();
yes(asked.includes("exitFullscreen"), "o'chirilganda ekran qaytariladi");

/* ⚠ ENG MUHIM SINOV. Foydalanuvchi ilovadan OLDIN brauzerning o'z F11
   ini bosgan bo'lishi mumkin — u holda `fullscreenElement` bo'sh, lekin
   ekran to'liq. Biz yoqmagan narsani O'CHIRMASLIGIMIZ kerak, aks holda
   ilova ochilishining o'zi foydalanuvchining tanlovini bekor qilardi. */
asked = [];
await exitFullscreen();
yes(!asked.length, "biz yoqmagan to'liq ekranga tegilmaydi");

/* ── Tauri (.exe) ───────────────────────────────────────────────────── */
console.log("\n── Desktop ──");

const calls = [];
browser = browserDoc();
global.window = { __TAURI__: { core: { invoke: (c, a) => { calls.push([c, a]); return Promise.resolve(null); } } } };

asked = [];
await setFullscreen(true);
yes(calls.some(([c, a]) => c === "set_fullscreen" && a.on === true), "yoqilganda Rust buyrug'i chaqiriladi");
/* ⚠ WebView2 da `requestFullscreen()` sahifani OYNA ICHIDA yoyadi: oyna
   ramkasi va Windows'ning vazifalar paneli joyida qolaveradi. Shuning
   uchun desktopda u UMUMAN chaqirilmasligi kerak. */
yes(!asked.includes("requestFullscreen"), "desktopda Fullscreen API ishlatilmaydi");

await setFullscreen(false);
yes(calls.some(([c, a]) => c === "set_fullscreen" && a.on === false), "o'chirilganda ham Rust buyrug'i chaqiriladi");

/* ── Ikki tomonning nomi bitta ekanini ──────────────────────────────── */
console.log("\n── Bog'lanish ──");

const rust = fs.readFileSync(path.join(ROOT, "src-tauri/src/main.rs"), "utf8");
yes(/fn\s+set_fullscreen\s*\(/.test(rust), "Rust tomonida `set_fullscreen` bor");
/* Buyruq `generate_handler!` ga qo'shilmasa, chaqiruv ish vaqtida
   «command not found» bilan rad etiladi — qurishda esa hech narsa
   sezilmaydi. */
yes(/generate_handler!\[[^\]]*\bset_fullscreen\b/s.test(rust), "buyruq `generate_handler!` ga qo'shilgan");

const layout = fs.readFileSync(path.join(ROOT, "src/components/Layout.jsx"), "utf8");
/* ⚠ `requestFullscreen()` FAQAT foydalanuvchi harakatining ichida
   bajariladi. Agar u `useEffect` ga ko'chirilsa, brauzer so'rovni
   jimgina rad etadi va rejim yarim ishlaydi: menyu yashirinadi, ekran
   esa to'liq bo'lmaydi. Shuning uchun bosish ishlovchisi ekranni O'ZI
   so'rashi shart. */
yes(/const applyFullscreen = \(on\) => \{[^}]*setFullscreen\(on\)/.test(layout),
    "ekran bosish ishlovchisining o'zidan so'raladi");
yes(/KEY_BY_ID\.fullscreen\.combo/.test(layout), "F11 jadvaldan olinadi, kodga yozilmagan");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
