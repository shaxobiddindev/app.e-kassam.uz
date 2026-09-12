/* ══════════════════════════════════════════════════════════════════════════
   USTUN FILTRINI SERVERGA YOZISH — sinov

   ═══ NEGA BU SINOV BOR ════════════════════════════════════════════════

   Ustun filtri BRAUZERDA ishlardi. Ro'yxatlar sahifalangach, u
   jimgina buzilardi: filtr faqat yuklangan 50 qatorga tegib,
   do'konchi «tovar yo'q» degan XATO xulosaga kelardi.

   Endi shartlar SERVERGA yuboriladi — ya'ni bu funksiya ikki
   tomonning KELISHUV NUQTASI. U noto'g'ri yozsa, server shartni
   tushunmaydi (400) yoki, yomoni, BOSHQACHA tushunadi va ekranda
   xato ko'rinmasdan noto'g'ri ro'yxat chiqadi.

   ⚠ SHAKL SERVERDAGI `ColumnFilter.parse` BILAN BIR XIL bo'lishi
   shart. Shuning uchun bu yerda «qanday yozilishi» EMAS, «serverda
   nima o'qilishi» tekshiriladi.

   Ishga tushirish:  node test/filter-serialize.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { serializeFilter, isLiveCond, OPS, NEEDS_VALUE, NEEDS_SECOND }
  from "../src/lib/ek-filter.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg); }
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b),
  `${msg}${JSON.stringify(a) === JSON.stringify(b) ? "" : `  →  ${JSON.stringify(a)}`}`);

const parse = (s) => (s === null ? null : JSON.parse(s));

console.log("\n── Shakl ──");
{
  const r = parse(serializeFilter(
    [{ key: "name", type: "text", op: "has", value: "cola" }],
    { key: "price", dir: "desc" }));
  eq(r, { conds: [{ key: "name", type: "text", op: "has", value: "cola" }],
          sort: { key: "price", dir: "desc" } },
     "matn sharti va tartib");

  /* ⚠ `empty`/`notEmpty` QIYMAT YUBORMAYDI: server `value` ni
     o'qimaydi va bo'sh matn yuborilsa, u «bo'sh matnga teng» degan
     BOSHQA shart bo'lib ketishi mumkin edi. */
  const e = parse(serializeFilter([{ key: "code", type: "text", op: "empty", value: "" }], null));
  ok(!("value" in e.conds[0]), "⚠ `empty` sharti qiymat yubormaydi");

  const en = parse(serializeFilter(
    [{ key: "st", type: "enum", op: "in", value: ["out", "off"] }], null));
  eq(en.conds[0].value, ["out", "off"], "ro'yxat (enum) massiv bo'lib ketadi");

  const bw = parse(serializeFilter(
    [{ key: "price", type: "number", op: "between", value: "1000", value2: "5000" }], null));
  eq([bw.conds[0].value, bw.conds[0].value2], ["1000", "5000"], "oraliqning ikki chekkasi");
}

console.log("\n── ⚠ O'LIK SHART YUBORILMAYDI ──");
{
  /* Foydalanuvchi qatorni qo'shdi-yu, qiymatni hali yozmadi. U
     ro'yxatni KESMASLIGI kerak — ekranda ham chip ko'rinmaydi. */
  ok(serializeFilter([{ key: "name", type: "text", op: "has", value: "" }], null) === null,
     "⚠ qiymatsiz shart yuborilmaydi");
  ok(serializeFilter([{ key: "st", type: "enum", op: "in", value: [] }], null) === null,
     "⚠ bo'sh tanlov yuborilmaydi");
  ok(serializeFilter([], null) === null, "shart ham, tartib ham yo'q — hech narsa");

  /* ⚠ ORALIQDA BITTA CHEKKA YETARLI: «1000 dan» degan shart to'liq. */
  const one = parse(serializeFilter(
    [{ key: "price", type: "number", op: "between", value: "1000", value2: "" }], null));
  ok(one !== null && one.conds.length === 1, "⚠ oraliqning bitta chekkasi yetarli");

  /* Tirik va o'lik shart aralash — faqat tirigi ketadi. */
  const mix = parse(serializeFilter([
    { key: "name", type: "text", op: "has", value: "" },
    { key: "price", type: "number", op: "gte", value: "500" },
  ], null));
  ok(mix.conds.length === 1 && mix.conds[0].key === "price",
     "⚠ o'lik shart tashlanadi, tirigi qoladi");
}

console.log("\n── Tartib ──");
{
  ok(parse(serializeFilter([], { key: "qty", dir: "asc" })).sort.key === "qty",
     "shartsiz tartib ham yuboriladi");
  ok(parse(serializeFilter([], { key: "qty", dir: "nimadir" })).sort.dir === "asc",
     "⚠ noma'lum yo'nalish `asc` ga aylanadi — serverda taxmin qolmaydi");
  ok(serializeFilter([], { key: null, dir: "desc" }) === null,
     "tartib kaliti yo'q — yuborilmaydi");
}

console.log("\n── ⚠ QIYMAT DOIM MATN ──");
{
  /* Server `value` ni matn deb o'qiydi (`ColumnFilter.text`). Son
     yuborilsa Jackson uni o'qiy oladi, lekin ikki shakl ikki yo'l
     degani — va biri sinovsiz qolardi. */
  const n = parse(serializeFilter(
    [{ key: "price", type: "number", op: "eq", value: 1500 }], null));
  ok(typeof n.conds[0].value === "string", "⚠ son ham matn bo'lib ketadi");
  eq(n.conds[0].value, "1500", "qiymat o'zgarmaydi");

  /* ⚠ AJRATGICH TOZALANMAYDI: ekranda «12 000» ko'rinadi, odam
     shunday yozadi va tozalashni SERVER qiladi (`FilterCols.decimal`).
     Ikki joyda ikki xil tozalash qoidasi bo'lsa, ular ajralib
     ketardi. */
  const sp = parse(serializeFilter(
    [{ key: "price", type: "number", op: "gte", value: "12 000" }], null));
  eq(sp.conds[0].value, "12 000", "⚠ ajratgich frontda tozalanmaydi");
}

console.log("\n── ⚠ BARCHA TUR × AMAL KOMBINATSIYASI ──");
{
  /* Har tur uchun har amal yozilishi kerak: bittasi tushib qolsa,
     o'sha ustun bo'yicha filtr jimgina ishlamay qo'yardi. */
  let missing = [];
  for (const [type, ops] of Object.entries(OPS)) {
    for (const op of ops) {
      const cond = {
        key: "k", type, op,
        value: type === "enum" ? ["a"] : (type === "date" ? "2026-01-01" : "5"),
        value2: NEEDS_SECOND.has(op) ? (type === "date" ? "2026-02-01" : "9") : "",
      };
      if (!isLiveCond(cond)) { missing.push(`${type}/${op}: tirik emas`); continue; }
      const out = parse(serializeFilter([cond], null));
      if (!out || out.conds.length !== 1) { missing.push(`${type}/${op}: yozilmadi`); continue; }
      const c = out.conds[0];
      if (c.op !== op || c.type !== type) missing.push(`${type}/${op}: buzilib yozildi`);
      if (NEEDS_VALUE.has(op) && c.value === undefined) missing.push(`${type}/${op}: qiymat yo'q`);
      if (NEEDS_SECOND.has(op) && c.value2 === undefined) missing.push(`${type}/${op}: 2-qiymat yo'q`);
    }
  }
  ok(missing.length === 0, `barcha tur × amal yoziladi${missing.length ? ": " + missing.join("; ") : ""}`);
}

console.log("\n── ⚠ SERVER LUG'ATI BILAN BIR XIL ──");
{
  /* Serverdagi `ColumnFilter` da har tur uchun amallar RO'YXATI
     qaytarilgan. Front yangi amal qo'shsa-yu, server bilmasa —
     so'rov 400 bo'lardi; teskarisi esa o'lik imkoniyat. Shuning
     uchun ro'yxat SHU YERDA yozib qo'yiladi va farq ko'rinadi. */
  const SERVER = {
    text:   ["has", "eq", "starts", "empty", "notEmpty"],
    number: ["eq", "ne", "gt", "gte", "lt", "lte", "between"],
    date:   ["from", "to", "between"],
    enum:   ["in"],
    bool:   ["isTrue", "isFalse"],
  };
  const diff = [];
  for (const type of new Set([...Object.keys(OPS), ...Object.keys(SERVER)])) {
    const a = [...(OPS[type] || [])].sort().join(",");
    const b = [...(SERVER[type] || [])].sort().join(",");
    if (a !== b) diff.push(`${type}: front=[${a}] server=[${b}]`);
  }
  ok(diff.length === 0,
     `⚠ front va server lug'ati bir xil${diff.length ? ": " + diff.join("; ") : ""}`);
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
