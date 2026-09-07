/* ══════════════════════════════════════════════════════════════════════════
   SERVER JAVOBIDAN RO'YXAT — himoya haqiqiymi (V86)

   ⚠ Bu sinov IKKI QISMDAN iborat va ikkinchisi muhimroq:

     1. `asArray` to'g'ri ishlaydimi;
     2. kod uni HAQIQATAN ishlatadimi — chunki to'g'ri funksiya
        yozib, uni chaqirmaslik hech narsani o'zgartirmaydi.

   Ishga tushirish:  node test/array-guard.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { asArray } from "../src/lib/ek-array.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m);
                          if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eqArr = (actual, expected, msg) =>
  (JSON.stringify(actual) === JSON.stringify(expected) ? ok(msg) : bad(msg, actual));

console.log("\n══ asArray ══");

eqArr(asArray([1, 2]), [1, 2], "massiv o'zgarmaydi");
eqArr(asArray(null), [], "null → bo'sh");
eqArr(asArray(undefined), [], "undefined → bo'sh");

/* ⚠ ASOSIY BAND. `|| []` aynan shu yerda ishlamaydi: `{}` truthy
   va u shundoq o'tib ketadi, keyin `.map` butun sahifani yiqitadi. */
eqArr(asArray({}), [], "bo'sh OBYEKT → bo'sh massiv (`|| []` buni o'tkazib yuborardi)");
eqArr(asArray({ error: "x" }), [], "begona obyekt → bo'sh");
eqArr(asArray("matn"), [], "matn → bo'sh");
eqArr(asArray(0), [], "nol → bo'sh");

/* ⚠ Sahifalangan javob: server `List<T>` dan `Page<T>` ga o'tsa,
   chaqiruvchi bo'sh ro'yxat emas, HAQIQIY ma'lumot ko'rishi kerak. */
eqArr(asArray({ content: [7, 8] }), [7, 8], "sahifalangan javob → ichidagi ro'yxat");
eqArr(asArray({ content: null }), [], "content massiv emas → bo'sh");

/* Natija HAR DOIM massiv — chaqiruvchi tekshirmasdan `.map` qila oladi. */
const always = [[], null, undefined, {}, "x", 5, { content: [] }, [1]]
  .every((v) => Array.isArray(asArray(v)));
always ? ok("natija har doim massiv") : bad("ba'zi kirishda massiv emas");

console.log(`\n${fail ? "❌" : "✅"} massiv himoyasi: ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
