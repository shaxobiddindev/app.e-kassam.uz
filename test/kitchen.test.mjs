/* ══════════════════════════════════════════════════════════════════════════
   OSHXONA CHEKI — guruhlash va baytlar (R4)
   Ishga tushirish:  node test/kitchen.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { stationOptions, stationMap, kitchenTickets, buildTicket, wrapTo } = await import("../src/lib/ek-kitchen.js");

let pass = 0, fail = 0;
const eq = (got, want, name) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}${ok ? "" : `\n     olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`}`);
};

const CATS = [
  { id: 1, name: "Ikkinchi taomlar", station: "Oshxona" },
  { id: 2, name: "Ichimliklar", station: "Bar" },
  { id: 3, name: "Sovuq ichimliklar", parentId: 2, station: null },
  { id: 4, name: "Non", station: "" },
];

console.log("\n── Bo'limlar ──");
eq(stationOptions(CATS), ["Oshxona", "Bar"], "taklif + toifalardagi (takrorsiz)");
eq(stationOptions([{ station: "Mangal" }, { station: "oshxona" }]), ["Oshxona", "Bar", "Mangal"], "yangi nom qo'shiladi, katta-kichik harf farqi takror emas");
const map = stationMap(CATS);
eq([map.get("1"), map.get("2"), map.get("3"), map.get("4")], ["Oshxona", "Bar", "Bar", undefined],
   "⚠ bola toifa bo'sh — ota toifaniki; bo'limsiz toifa — yo'q");

console.log("\n── Savat → cheklar ──");
const cart = [
  { id: 7, name: "Osh", categoryId: 1, qty: 2, unitDecimals: 0, modifiers: [{ id: 22, name: "Katta" }] },
  { id: 8, name: "Kola", categoryId: 3, qty: 1, unitDecimals: 0 },
  { id: 9, name: "Non", categoryId: 4, qty: 3, unitDecimals: 0 },
  { id: 7, name: "Osh", categoryId: 1, qty: 1, unitDecimals: 0 },
];
const tk = kitchenTickets(cart, map);
eq(tk.map((x) => x.station), ["Oshxona", "Bar"], "ikki bo'lim; non (bo'limsiz) oshxonaga bormaydi");
eq(tk[0].lines.map((l) => `${l.qty}x${l.name}${l.mods.length ? "+" + l.mods.join(",") : ""}`), ["2xOsh+Katta", "1xOsh"],
   "qo'shimchali va qo'shimchasiz osh — alohida qator (oshpaz uchun boshqa taom)");
eq(kitchenTickets([], map), [], "bo'sh savat — chek yo'q");

console.log("\n── Chek baytlari ──");
const bytes = buildTicket({ station: "Oshxona", lines: tk[0].lines, orderNo: "A-901", at: new Date(2026, 9, 8, 12, 5), cashier: "Ali" });
const txt = String.fromCharCode(...bytes.filter((b) => b >= 32 && b < 127));
eq(["OSHXONA", "#A-901", "12:05", "2 x Osh", "+ Katta"].every((s) => txt.includes(s)), true, "bo'lim, raqam, vaqt, taom va qo'shimcha chekda");
eq(txt.includes("so'm") || /\d{2,} ?\d{3}/.test(txt.replace("12:05", "")), false, "narx YO'Q — oshxonaga kerak emas");
eq(bytes.slice(-4), [0x1d, 0x56, 66, 3], "oxirida qog'oz kesiladi");
eq(wrapTo("Qo'y go'shtidan tayyorlangan maxsus palov", 24).every((l) => l.length <= 24), true, "ikki baravar shriftda qator yarim kenglikdan oshmaydi");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
