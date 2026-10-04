/* ══════════════════════════════════════════════════════════════════════════
   SESSIYA TOZALANGANDA KOMPYUTER SOZLAMALARI QOLADI (2026-10-04)

   ⚠ NEGA SINOV. Egasi: «har safar ilova yangilanganda stiker chiqarishni
   qayta sozlash kerak bo'lyapti». Sabab — sessiya tiklanmaganda
   `localStorage.clear()` printer nomini ham o'chirardi. Bu xato hech
   qachon ekranda xato bo'lib chiqmaydi: ilova shunchaki «unutadi».
   Ikkinchi qism — qo'riqchi: kimdir yana `localStorage.clear()` yozsa,
   shu yerda yiqiladi.

   Ishga tushirish:  node test/session-keep.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
const { clearSession, DEVICE_KEYS } = await import("../src/lib/ek-session.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};

console.log("\n── clearSession ──");
{
  const hw = JSON.stringify({ labelPrinterName: "Xprinter XP-365B", printerName: "XP-58" });
  mem.set("ek_hw", hw);
  mem.set("ek_lang", "ru");
  mem.set("ek_theme", "dark");
  mem.set("ek_lbl_last_tpl", "42");
  mem.set("ek_token", "secret");
  mem.set("ek_refresh", "r");
  mem.set("ek_shopCode", "DOKON1");
  mem.set("ek_cart_DOKON1_ali", "{}");
  mem.set("ek_kassaFav", "[1,2]");
  mem.set("ek_app_token", "mijoz");
  clearSession(["ek_app_token"]);

  is(mem.get("ek_hw") === hw, "⚠ printer va tarozi sozlamasi (ek_hw) qoldi");
  is(mem.get("ek_lang") === "ru" && mem.get("ek_theme") === "dark", "til va mavzu qoldi");
  is(mem.get("ek_lbl_last_tpl") === "42", "oxirgi stiker dizayni qoldi");
  is(mem.get("ek_app_token") === "mijoz", "chaqiruvchi so'ragan kalit (mijoz sessiyasi) qoldi");
  is(!mem.has("ek_token") && !mem.has("ek_refresh"), "xodim tokenlari o'chdi");
  is(!mem.has("ek_shopCode") && !mem.has("ek_cart_DOKON1_ali") && !mem.has("ek_kassaFav"),
     "do'kon, savat va sevimlilar o'chdi — keyingi kirgan boshqa do'kon bo'lishi mumkin");
}
{
  mem.clear();
  clearSession();
  is(mem.size === 0, "bo'sh xotirada ham ishlaydi — yo'q kalit yaratilmaydi");
}
is(!DEVICE_KEYS.some((k) => /token|refresh|shop|cart|user|role|deviceId/i.test(k)),
   "oq ro'yxatda sessiya yoki do'kon kaliti yo'q", DEVICE_KEYS.join(", "));

console.log("\n── Qo'riqchi: `localStorage.clear()` faqat ek-session.js da ──");
{
  const bad = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(jsx?|mjs)$/.test(e) || p.replace(/\\/g, "/").endsWith("lib/ek-session.js")) continue;
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/localStorage\.clear\(\)/.test(code) && !/^\s*(\*|\/\*)/.test(code) && !/`[^`]*localStorage\.clear\(\)[^`]*`/.test(code)) {
          bad.push(`${p}:${i + 1}`);
        }
      });
    }
  })("src");
  is(bad.length === 0, "boshqa joyda `localStorage.clear()` yo'q (clearSession ishlatilsin)", bad.join("\n     "));
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
