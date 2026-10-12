/* Bitta sotuv vaqti (C4) — `src/lib/ek-sale-speed.js`.
   Nosozlik jim bo'ladi: noto'g'ri boshlanish vaqti sotuvni buzmaydi, faqat
   mezon raqamini yolg'on qiladi. */
import { nextStartedAt, durationOf, MAX_MS } from "../src/lib/ek-sale-speed.js";

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m)); };

console.log("\n── Boshlanish ──");
ok(nextStartedAt([], [{ id: 1 }], undefined, 1000) === 1000, "birinchi tovar — vaqt boshlanadi");
ok(nextStartedAt([{ id: 1 }], [{ id: 1 }, { id: 2 }], 1000, 5000) === 1000, "ikkinchi tovar — boshlanish o'zgarmaydi");
ok(nextStartedAt([{ id: 1 }], [], 1000, 5000) === undefined, "savat bo'shadi — vaqt o'chadi");
ok(nextStartedAt([{ id: 1 }], [{ id: 1 }], undefined, 7000) === 7000, "eski (vaqtsiz) savat — hozirdan boshlanadi");

console.log("\n── Davomiylik ──");
ok(durationOf(1000, {}, 9500) === 8500, "8.5 s");
ok(durationOf(undefined, {}, 9500) === null, "boshlanish yo'q — o'lchanmagan");
ok(durationOf(1000, { tableOrderId: 5 }, 9500) === null, "⚠ stol buyurtmasi — o'lchanmaydi (hisob soatlab ochiq)");
ok(durationOf(1000, {}, 1000 + MAX_MS + 1) === null, "30 daqiqadan uzun — savat kutib turgan");
ok(durationOf(9000, {}, 1000) === null, "manfiy — kassa soati xato");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
