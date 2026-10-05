/* ══════════════════════════════════════════════════════════════════════════
   TAROZI — DESKTOP PORTI VA AVTOMATIK TOPISH (2026-10-05)

   ⚠ NEGA SINOV. Egasi: «asosan desktop ilovada ishlatamiz — avto sozlaydigan
   va esdan chiqarmaydigan qil». Avtomatik topish boshqa COM portlarga ham
   bayt yuboradi: ketma-ket chek printeri bo'lsa, u qog'ozga axlat bosadi.
   Shuning uchun avtomatik rejimda FAQAT USB-serial adapterlar sinalishi va
   topilgan sozlama ilova fayliga ham yozilishi shu yerda qotiriladi.

   Ishga tushirish:  node test/scale-native.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const PORTS = [
  { name: "COM1", kind: "pci", vid: null, pid: null },
  { name: "COM5", kind: "usb", vid: 0x1A86, pid: 0x7523, product: "USB-SERIAL CH340" },
  { name: "COM7", kind: "usb", vid: 0x0FE6, pid: 0x811E, product: "POS Printer" },
  { name: "COM9", kind: "bluetooth", vid: null, pid: null },
];
const opened = [];
let cur = null;           // { name, baud }
let rx = [];
let deviceFile = "";
const enc = (s) => Array.from(s, (c) => c.charCodeAt(0));

globalThis.window = {
  __TAURI_INTERNALS__: {},
  __TAURI__: { core: { invoke: async (cmd, a = {}) => {
    switch (cmd) {
      case "serial_ports": return PORTS;
      case "serial_open": opened.push(`${a.name}@${a.baud}`); cur = { name: a.name, baud: a.baud }; rx = []; return null;
      case "serial_close": cur = null; return null;
      case "serial_write": {
        /* Tarozi: faqat COM5, 9600 da; ENQ → ACK, keyin DC1 → og'irlik (MERTECH uslubi). */
        if (cur?.name === "COM5" && cur.baud === 9600) {
          if (a.data.length === 1 && a.data[0] === 0x05) rx.push(0x06);
          if (a.data.length === 1 && a.data[0] === 0x11) rx.push(...enc("  0.255 kg\r\n"));
        }
        return null;
      }
      case "serial_read": { if (!cur) throw new Error("closed"); const out = rx; rx = []; return out; }
      case "device_store_get": return deviceFile;
      case "device_store_set": deviceFile = a.json; return null;
      default: return null;
    }
  } } },
  addEventListener: () => {}, removeEventListener: () => {},
};
// Node 21+ da `navigator` bor (Web Serial siz) — tegilmaydi.

const { autoDetect, readCfg, stop, snapshot } = await import("../src/lib/ek-scale-live.js");
const { restoreDevice } = await import("../src/lib/ek-device-store.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\n── Avtomatik topish (faqat USB adapterlar) ──");
{
  const r = await autoDetect();
  is(r?.name === "COM5" && r.baudRate === 9600 && r.poll === "ENQ_DC1", "⚠ tarozi topildi: COM5 · 9600 · ENQ → ACK → DC1", JSON.stringify(r));
  is(opened.every((o) => o.startsWith("COM5")), "⚠ chek printeri (COM7) va ichki COM1 ga hech narsa yuborilmadi", opened.join(", "));
  const cfg = readCfg();
  is(cfg.enabled && cfg.name === "COM5" && cfg.id === `${0x1A86}:${0x7523}` && cfg.off === false,
     "sozlama saqlandi (port, USB belgisi, yoqilgan)", JSON.stringify(cfg));
  await wait(400);
  is(snapshot().on && snapshot().kg === 0.255, "ulangandan keyin og'irlik o'qilyapti: 0.255 kg", JSON.stringify(snapshot()));
  await wait(400);
  is(JSON.parse(deviceFile || "{}").ek_scale_port?.includes("COM5"), "⚠ ilova fayliga ham yozildi (esdan chiqmaydi)");
  await stop();
  is(readCfg().off === true && !readCfg().enabled, "do'kon o'zi uzdi — avtomatik topish qayta ulamaydi");
}

console.log("\n── Tugma bilan: barcha portlar ──");
{
  opened.length = 0;
  PORTS[1].vid = 0x9999; PORTS[1].product = "Noma'lum";      // adapter tanilmasa ham
  const r = await autoDetect({ all: true });
  is(r?.name === "COM5", "tugma bosilganda ichki COM va noma'lum USB ham sinaladi");
  is(!opened.some((o) => o.startsWith("COM9")), "Bluetooth port sinalmaydi");
  await stop();
}

console.log("\n── Fayldan tiklash ──");
{
  mem.clear();
  deviceFile = JSON.stringify({ ek_hw: '{"labelPrinterName":"Xprinter XP-365B"}', ek_scale_port: '{"enabled":true,"name":"COM5"}', ek_token: "sir" });
  const n = await restoreDevice();
  is(n === 2 && mem.get("ek_hw")?.includes("Xprinter"), "⚠ printer va tarozi sozlamasi fayldan tiklandi");
  is(!mem.has("ek_token"), "fayldagi begona kalit (token) tiklanmaydi");
  mem.set("ek_hw", '{"labelPrinterName":"Yangi"}');
  await restoreDevice();
  is(mem.get("ek_hw").includes("Yangi"), "joriy sozlama fayldagisidan ustun");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
process.exit(fail ? 1 : 0);
