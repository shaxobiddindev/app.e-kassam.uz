/* ══════════════════════════════════════════════════════════════════════════
   DESKTOP MASSHTABI — Ctrl +/−/0 VA Ctrl + G'ILDIRAK (2026-10-05)

   ⚠ NEGA SINOV. Egasi: «desktop ilovaga zoom qo'sh». Masshtab ilova
   yopilganda unutilmasligi (qurilma sozlamasi), har xil klaviatura
   tartibida ishlashi va stikerning «haqiqiy o'lcham» ko'rinishini
   buzmasligi shu yerda qotiriladi.

   Ishga tushirish:  node test/zoom.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const calls = [];
let deviceFile = "";
const listeners = {};
globalThis.window = {
  __TAURI_INTERNALS__: {},
  __TAURI__: { core: { invoke: async (cmd, a = {}) => {
    if (cmd === "set_zoom") calls.push(a.scale);
    if (cmd === "device_store_set") deviceFile = a.json;
    if (cmd === "device_store_get") return deviceFile;
    return null;
  } } },
  addEventListener: (type, fn) => { listeners[type] = fn; },
  removeEventListener: () => {},
};

const z = await import("../src/lib/ek-zoom.js");
const { DEVICE_KEYS } = await import("../src/lib/ek-session.js");
const cal = await import("../src/lib/ek-screen-calibration.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (o) => {
  let prevented = false;
  return { ctrlKey: true, altKey: false, metaKey: false, repeat: false, key: "", code: "", deltaY: 0,
           ...o, preventDefault: () => { prevented = true; }, stopPropagation: () => {}, get prevented() { return prevented; } };
};

console.log("\n── Qadamlar ──");
is(z.nextStep(1, +1) === 1.1 && z.nextStep(1, -1) === 0.9, "100% dan: 110% va 90%");
is(z.nextStep(2, +1) === 2 && z.nextStep(0.67, -1) === 0.5 && z.nextStep(0.5, -1) === 0.5, "kichraytirish 50% gacha, kattalashtirish 200% gacha");
is(z.nextStep(1.13, +1) === 1.25 && z.nextStep(1.13, -1) === 1.1, "qadamdan tashqari qiymatdan eng yaqin qadamga");

console.log("\n── Tugmalar (har xil klaviatura tartibi) ──");
is(z.keyAction(ev({ key: "=", code: "Equal" })) === 1, "Ctrl + = → kattaroq");
is(z.keyAction(ev({ key: "+", code: "NumpadAdd" })) === 1, "Ctrl + raqamli «+» → kattaroq");
is(z.keyAction(ev({ key: "-", code: "Minus" })) === -1, "Ctrl + − → kichikroq");
is(z.keyAction(ev({ key: "0", code: "Digit0" })) === 0, "Ctrl + 0 → 100%");
is(z.keyAction(ev({ key: "й", code: "Equal" })) === 1, "ruscha tartibda ham (tugma joyi bo'yicha)");
is(z.keyAction(ev({ ctrlKey: false, key: "+" })) === null, "Ctrlsiz «+» — miqdor kiritish, tegilmaydi");
is(z.keyAction(ev({ key: "b" })) === null, "Ctrl + B (kassa qidiruvi) tegilmaydi");

console.log("\n── Ishga tushish va saqlash ──");
mem.set("ek_zoom", "1.25");
z.initZoom();
await wait(10);
is(calls.at(-1) === 1.25 && z.zoomLevel() === 1.25, "⚠ saqlangan 125% ilova ochilganda qo'llandi", JSON.stringify(calls));

const k = ev({ key: "=", code: "Equal" });
listeners.keydown(k);
await wait(10);
is(k.prevented && z.zoomLevel() === 1.5 && mem.get("ek_zoom") === "1.5", "Ctrl + = → 150%, saqlandi");
await wait(400);
is(JSON.parse(deviceFile || "{}").ek_zoom === "1.5", "⚠ ilova fayliga ham yozildi (esdan chiqmaydi)");
is(DEVICE_KEYS.includes("ek_zoom"), "⚠ sessiya tozalanganda (chiqish) masshtab o'chmaydi");

console.log("\n── G'ildirak ──");
const w1 = ev({ deltaY: -100 });
listeners.wheel(w1);
await wait(10);
is(w1.prevented && z.zoomLevel() === 1.75, "Ctrl + g'ildirak yuqoriga → kattaroq");
for (let i = 0; i < 3; i++) listeners.wheel(ev({ deltaY: 15 }));
await wait(10);
is(z.zoomLevel() === 1.75, "sensorli panelning mayda harakati darhol sakratmaydi");
listeners.wheel(ev({ deltaY: 20 }));
await wait(10);
is(z.zoomLevel() === 1.5, "yig'ilgach bir qadam kichrayadi");
const w2 = ev({ ctrlKey: false, deltaY: 100 });
listeners.wheel(w2);
is(!w2.prevented && z.zoomLevel() === 1.5, "Ctrlsiz g'ildirak — oddiy aylantirish");

console.log("\n── Ekran kalibrovkasi ──");
mem.set("ek.screen.pxPerMm", "4");
is(Math.abs(cal.pxPerMm() - 4 / 1.5) < 1e-9, "⚠ 150% da px/mm bo'linadi — «haqiqiy o'lcham» o'zgarmaydi");
cal.saveFromCardWidth(4 / 1.5 * 85.6);
is(Math.abs(Number(mem.get("ek.screen.pxPerMm")) - 4) < 1e-9, "150% da kalibrlansa ham 100% qiymati saqlanadi");

listeners.keydown(ev({ key: "0", code: "Digit0" }));
await wait(10);
is(z.zoomLevel() === 1 && !mem.has("ek_zoom") && Math.abs(cal.pxPerMm() - 4) < 1e-9, "Ctrl + 0 → 100%, sozlama tozalandi");

console.log("\n── Ekrandagi «100%» belgisi yo'qoladi (2026-10-08) ──");
{
  /* ⚠ Egasi: «zoom ko'rsatkichi qolib ketyapti». `el.hidden = true` inline
     `display:flex` ni yengolmasdi. Soxta DOM — ko'rinishni faqat
     `style.display` hal qiladi (brauzerdagi kabi). */
  const made = [];
  globalThis.document = {
    createElement: () => { const el = { style: {}, setAttribute() {}, innerHTML: "" }; made.push(el); return el; },
    body: { appendChild() {} },
  };
  await z.setZoom(1.1);
  const el = made[0];
  is(!!el && el.style.display !== "none", "masshtab o'zgarganda belgi ko'rinadi");
  await wait(1500);
  is(el?.style.display === "none", "⚠ 1,4 soniyadan keyin belgi YO'QOLADI (ekranda qolib ketmaydi)");
  await z.setZoom(1, { show: false });
  delete globalThis.document;
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
process.exit(fail ? 1 : 0);
