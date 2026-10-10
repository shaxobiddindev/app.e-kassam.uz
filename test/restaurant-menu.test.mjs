/* ══════════════════════════════════════════════════════════════════════════
   RESTORAN MENYUSI — `src/lib/ek-restaurant-menu.js`

   Ishga tushirish:  node test/restaurant-menu.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const M = await import("../src/lib/ek-restaurant-menu.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Tannarx ulushi bahosi ──");
ok(M.costTone(28.4).word === "good", "28% — yaxshi");
ok(M.costTone(30).word === "good", "30% — chegara, yaxshi");
ok(M.costTone(33).word === "ok", "33% — me'yorda");
ok(M.costTone(39).tone === "bad", "39% — yuqori");
ok(M.costTone(null) === null, "⚠ tannarx yo'q — baho yo'q, «0% yaxshi» emas");

console.log("\n── Ko'rinadigan taomlar ──");
const D = [
  { id: 1, name: "Osh", categoryId: 10, stopListed: false },
  { id: 2, name: "Lag'mon", categoryId: 11, stopListed: true },
  { id: 3, name: "Cola", categoryId: null, stopListed: false },
];
ok(M.visibleDishes(D).length === 3, "hammasi");
ok(M.visibleDishes(D, { section: 10 }).map((d) => d.id).join() === "1", "bo'lim bo'yicha");
ok(M.visibleDishes(D, { section: "none" }).map((d) => d.id).join() === "3", "bo'limsiz");
ok(M.visibleDishes(D, { stopOnly: true }).map((d) => d.id).join() === "2", "faqat stop-list");
ok(M.visibleDishes(D, { query: "LAG‘MON" }).map((d) => d.id).join() === "2", "⚠ qidiruv: katta harf va ‘ belgisi farq qilmaydi");

console.log("\n── Kartochka ──");
ok(M.initialOf("qozon kabob") === "Q", "bosh harf");
ok(M.initialOf("") === "?", "nomsiz");
ok(M.stationBg(null, []) === "var(--bg-sunken)", "sexsiz — neytral");
ok(M.stationBg("Grill", ["Oshxona", "Grill"]) !== M.stationBg("Oshxona", ["Oshxona", "Grill"]), "har sexning o'z foni");

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
