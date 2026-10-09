/* ══════════════════════════════════════════════════════════════════════════
   JADVAL → EXCEL — `src/lib/ek-table-xlsx.js`

   ⚠ ENG MUHIMI: pul va miqdor Excel'da RAQAM bo'lsin (qo'shib bo'lsin),
   shtrix-kod va telefon esa MATN (raqamga aylansa oxirgi xonalari yo'qoladi).

   Ishga tushirish:  node test/table-xlsx.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const X = await import("../src/lib/ek-table-xlsx.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

console.log("\n── Raqam yoki matn ──");
ok(X.toNumber("1 250 000 so'm") === 1250000, "«1 250 000 so'm» → 1250000");
ok(X.toNumber("1 250 000") === 1250000, "bo'sh joyning turli belgilari");
ok(X.toNumber("−3") === -3 && X.toNumber("+25") === 25, "«−3», «+25»");
ok(X.toNumber("12,5") === 12.5 && X.toNumber("34 kg") === 34, "kasr vergul bilan, birlik bilan");
ok(X.toNumber("4780000000079") === null, "⚠ shtrix-kod — matn");
ok(X.toNumber("0123") === null && X.toNumber("0") === 0, "«0» bilan boshlangan kod — matn, «0» o'zi — raqam");
ok(X.toNumber("—") === null && X.toNumber("12:30") === null && X.toNumber("Kassa") === null, "tire, vaqt, so'z — matn");
ok(X.cell("—") === "" && X.cell("  Non  buxanka ") === "Non buxanka", "katak tozalanadi");

console.log("\n── Ustunlar ta'rifidan ──");
{
  const cols = [
    { key: "name", label: "Nomi", type: "text", get: (r) => r.name },
    { key: "sum", label: "Summa", type: "number", get: (r) => r.sum },
    { key: "st", label: "Holat", type: "enum", options: [{ value: "PAID", label: "To'langan" }], get: (r) => r.st },
    { key: "at", label: "Sana", type: "date", get: (r) => r.at },
    { key: "on", label: "Faol", type: "bool", get: (r) => r.on },
    { key: "x", label: "Yashirin", type: "text", get: () => "x", xlsx: false },
  ];
  const g = X.rowsFromCols(cols, [{ name: "Non", sum: "4500", st: "PAID", at: "2026-10-09T09:05:00", on: true }]);
  ok(g[0].map((h) => h.v).join("|") === "Nomi|Summa|Holat|Sana|Faol", "sarlavha qalin, yashirin ustunsiz");
  ok(g[1][1] === 4500 && g[1][2] === "To'langan" && g[1][3] === "2026-10-09 09:05" && g[1][4] === "ha",
     "raqam, holat yorlig'i, sana, ha/yo'q");
}

console.log("\n── Ekrandagi jadvaldan ──");
{
  /* DOM o'rniga oddiy obyektlar — `rowsFromTable` faqat shu xossalarni o'qiydi. */
  const td = (innerText, extra = {}) => ({ innerText, colSpan: 1, dataset: {}, ...extra });
  const tr = (...cells) => ({ cells });
  const table = {
    tHead: { rows: [tr(td("Tovar"), td("Summa"), td(""))] },
    tBodies: [{ rows: [
      tr(td("Non\nbuxanka"), td("4 500 so'm"), td("✎")),
      tr(td("Shtrix"), td("x", { dataset: { xlsx: "4780000000079" } }), td("")),
      tr(td("Ma'lumot yo'q", { colSpan: 3 })),
    ] }],
    tFoot: { rows: [tr(td("Jami"), td("4 500"), td(""))] },
  };
  const g = X.rowsFromTable(table);
  ok(g[0].map((h) => h.v).join("|") === "Tovar|Summa", "sarlavhasiz (tugma) ustun tushib qoladi");
  ok(g[1][0] === "Non buxanka" && g[1][1] === 4500, "matn tozalanadi, pul — raqam");
  ok(g[2][1] === "4780000000079", "`data-xlsx` matn o'rnida; shtrix-kod matn bo'lib qoladi");
  ok(g.length === 4 && g[3][0] === "Jami", "«ma'lumot yo'q» qatori yo'q, jami qatori bor");
}

console.log("\n── Fayl nomi va sahifalar ──");
ok(X.fileName("mijozlar ro'yxati", new Date(2026, 9, 9)) === "mijozlar-ro'yxati-2026-10-09", "fayl nomida sana");
{
  const pages = [[1, 2], [3, 4], [5]];
  const all = await X.collectPages(async (p) => ({ data: { content: pages[p] || [], total: 5 } }), { size: 2 });
  ok(all.join() === "1,2,3,4,5", "hamma sahifalar yig'iladi");
  const big = await X.collectPages(async () => ({ data: { content: [1], total: 50000 } }), { size: 1, cap: 100 });
  ok(big === null, "⚠ cheklovdan ko'p — null (chaqiruvchi «juda ko'p» deydi)");
  const arr = await X.collectPages(async (p) => (p === 0 ? { data: [1, 2, 3] } : { data: [] }), { size: 200 });
  ok(arr.length === 3, "massiv javob (sahifasiz) ham");
  const audit = await X.collectPages(async (p) => ({ data: { items: p < 2 ? [p * 2, p * 2 + 1] : [], totalItems: 4 } }), { size: 2 });
  ok(audit.join() === "0,1,2,3", "⚠ audit shakli ({items, totalItems}) ham");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
