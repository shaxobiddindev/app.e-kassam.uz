/* ══════════════════════════════════════════════════════════════════════════
   XATO KUZATUVI — nima yuboriladi, nima yo'q (`ek-errors-core.js`)

   Bu yerdagi nosozliklar jim: shovqin o'tib ketsa, bosh admin minglab
   «tarmoq uzildi» ichida haqiqiy xatoni ko'rmaydi; filtr ortiqcha qattiq
   bo'lsa — haqiqiy xato hech qachon yetib bormaydi. Ikkalasida ham ilova
   xato bermaydi.
   ══════════════════════════════════════════════════════════════════════════ */
import { isNoise, classify, createGate, queuePush, queueTake, pathOnly, MAX_QUEUE, QUEUE_KEY }
  from "../src/lib/ek-errors-core.js";

let pass = 0, fail = 0;
const yes = (c, m) => { c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m)); };

console.log("\n── Shovqin ──");
yes(isNoise(Object.assign(new Error("Xatolik: 500"), { status: 500 }), "Xatolik: 500", ""), "server javobi — backend logida bor");
yes(isNoise({ offline: true, message: "Internet yo'q" }, "Internet yo'q", ""), "tarmoq uzilishi — nosozlik emas");
yes(isNoise(null, "Script error.", ""), "«Script error.» — matni yashirilgan");
yes(isNoise(null, "ResizeObserver loop completed with undelivered notifications.", ""), "ResizeObserver ogohlantirishi");
yes(isNoise(null, "x is undefined", "at f (chrome-extension://abc/inject.js:1:2)"), "brauzer kengaytmasi");
yes(isNoise(null, "SESSION_TAKEN_OVER", ""), "sessiya boshqa qurilmada — oqim signali");
yes(isNoise(null, "   ", ""), "bo'sh xabar");
yes(!isNoise(new TypeError("Cannot read properties of undefined (reading 'map')"),
  "Cannot read properties of undefined (reading 'map')", "at SalesList (https://app.e-kassam.uz/assets/SalesPage-x.js:1:2)"),
  "HAQIQIY xato o'tadi");
yes(!isNoise(new ReferenceError("Spinner is not defined"), "Spinner is not defined", ""),
  "import unutilgani (SalesPage voqeasi) o'tadi");

console.log("\n── Tasnif ──");
yes(classify("render", "Failed to fetch dynamically imported module: https://app.e-kassam.uz/assets/KassaPage-B_D2KGzd.js") === "chunk",
  "eskirgan bo'lak — «chunk» (sababi relizda)");
yes(classify("rejection", "Importing a module script failed.") === "chunk", "Safari matni ham");
yes(classify("render", "x is not a function") === "render", "oddiy xato turi o'zgarmaydi");

console.log("\n── Sessiya darvozasi ──");
{
  const allow = createGate(3);
  yes(allow("a") && !allow("a"), "bir xil xato — bir marta");
  yes(allow("b") && allow("c"), "boshqasi o'tadi");
  yes(!allow("d"), "chegaradan keyin hech biri o'tmaydi (sekundiga yuz marta yiqilgan effekt)");
}

console.log("\n── Oflayn navbat ──");
{
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  for (let i = 0; i < MAX_QUEUE + 5; i++) queuePush(storage, { message: "m" + i });
  const q = queueTake(storage);
  yes(q.length === MAX_QUEUE, `navbat ${MAX_QUEUE} tadan oshmaydi`);
  yes(q[q.length - 1].message === "m" + (MAX_QUEUE + 4), "eng YANGILARI qoladi");
  yes(queueTake(storage).length === 0, "olingach navbat bo'sh — ikki marta yuborilmaydi");

  mem.set(QUEUE_KEY, "{buzuq");
  yes(Array.isArray(queueTake(storage)) && !mem.has(QUEUE_KEY), "buzuq qiymat yiqitmaydi va tozalanadi");

  const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); }, removeItem() {} };
  let threw = false;
  try { queuePush(full, { message: "x" }); } catch (_) { threw = true; }
  yes(!threw, "to'la xotira kassani yiqitmaydi");
}

console.log("\n── Manzil ──");
yes(pathOnly("/sale?token=SIR#x") === "/sale", "so'rov qatori (token) yuborilmaydi");
yes(pathOnly("/inventory/12") === "/inventory/12", "oddiy yo'l o'zgarmaydi");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
