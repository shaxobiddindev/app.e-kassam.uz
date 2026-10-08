/* ══════════════════════════════════════════════════════════════════════════
   ZAL TERMINALI (3-bosqich D1) — `src/lib/ek-terminal.js`

   ⚠ ENG MUHIMI: qulf vaqti faqat ruxsat etilgan qiymatlardan (buzilgan yoki
   eski qiymat «hech qachon qulflanmaydi» bo'lib qolmasin) va terminal
   bayrog'i qurilma kaliti sifatida chiqib-kirishda saqlanadi.

   Ishga tushirish:  node test/terminal.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };

const T = await import("../src/lib/ek-terminal.js");
const { DEVICE_KEYS } = await import("../src/lib/ek-session.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Terminal bayrog'i va qulf vaqti ──");
ok(!T.isTerminal(), "boshida terminal emas");
T.setTerminal(true);
ok(T.isTerminal(), "yoqildi");
T.setTerminal(false);
ok(!T.isTerminal() && !mem.has("ek_terminal"), "o'chirildi — kalit olib tashlandi");

ok(T.idleSeconds() === 60, "standart 60 soniya");
T.setIdleSeconds(120);
ok(T.idleSeconds() === 120, "120 tanlandi");
mem.set("ek_terminal_idle", "9999");
ok(T.idleSeconds() === 60, "⚠ ruxsat etilmagan qiymat — standartga qaytadi (cheksiz ochiq qolmaydi)");
T.setIdleSeconds(7);
ok(!mem.has("ek_terminal_idle"), "noto'g'ri qiymat yozilmaydi");

console.log("\n── Qolgan vaqt ──");
ok(T.leftMs(1000, 1000, 60) === 60000, "endigina harakat — 60 s qoldi");
ok(T.leftMs(1000, 31000, 60) === 30000, "30 s o'tdi — 30 s qoldi");
ok(T.leftMs(1000, 999999, 60) === 0, "vaqt o'tdi — 0 (manfiy emas)");

console.log("\n── Qurilma kalitlari ──");
ok(DEVICE_KEYS.includes("ek_terminal") && DEVICE_KEYS.includes("ek_terminal_idle"),
   "⚠ terminal sozlamasi chiqib-kirishda yo'qolmaydi (DEVICE_KEYS)");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
