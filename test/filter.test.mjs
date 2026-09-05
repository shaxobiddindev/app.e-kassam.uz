/* ══════════════════════════════════════════════════════════════════════════
   USTUNLAR BO'YICHA FILTR (V68)

   ⚠ NEGA QULFLANADI. Noto'g'ri filtr JIMGINA yolg'on gapiradi: ekranda
   yo'q tovar ko'rinadi yoki bor tovar yo'qoladi. Omborchi «tovar
   qolmagan ekan» deb buyurtma beradi yoki bermaydi — ikkalasi ham
   pulga tegadi. Xato esa hech qayerda chiqmaydi.

   Ishga tushirish:  node test/filter.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { applyAll, applyFilters, applySort, matchOne, norm, num, day, blankCond, OPS }
  = await import("../src/lib/ek-filter.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, JSON.stringify(a)));
const yes = (c, m, got) => (c ? ok(m) : bad(m, got));

const COLS = [
  { key: "name",  label: "Nomi",   type: "text",   get: (r) => r.name },
  { key: "qty",   label: "Qoldiq", type: "number", get: (r) => r.qty },
  { key: "price", label: "Narx",   type: "number", get: (r) => r.price },
  { key: "date",  label: "Sana",   type: "date",   get: (r) => r.date },
  { key: "state", label: "Holat",  type: "enum",   get: (r) => r.state },
  { key: "fav",   label: "Sevimli", type: "bool",  get: (r) => r.fav },
];
const ROWS = [
  { name: "Sut 1L",       qty: 0,   price: 9000,  date: "2026-09-04T14:30:00Z", state: "TUGAGAN", fav: false },
  { name: "Do'kon nonu",  qty: 12,  price: 7000,  date: "2026-09-01T08:00:00Z", state: "FAOL",    fav: true  },
  { name: "Kofe 2025",    qty: 71,  price: 80000, date: "2026-09-10T00:00:00Z", state: "FAOL",    fav: false },
  { name: "Choy",         qty: null, price: null, date: null,                   state: "FAOL",    fav: false },
];
const names = (rs) => rs.map((r) => r.name);
const f = (key, op, value, value2 = "") => {
  const col = COLS.find((c) => c.key === key);
  return { ...blankCond(col), op, value, value2 };
};

console.log("── Matn ──");
eq(names(applyFilters(ROWS, [f("name", "has", "sut")], COLS)), ["Sut 1L"], "«sut» — katta-kichik harf farq qilmaydi");
/* ⚠ Kassa qidiruvidagi qoida: apostrof va uning shakllari bir xil. */
eq(names(applyFilters(ROWS, [f("name", "has", "dokon")], COLS)), ["Do'kon nonu"], "«dokon» → «Do'kon» ni topadi");
eq(names(applyFilters(ROWS, [f("name", "starts", "ko")], COLS)), ["Kofe 2025"], "«boshlanadi»");
eq(names(applyFilters(ROWS, [f("name", "eq", "choy")], COLS)), ["Choy"], "«aynan»");
eq(applyFilters(ROWS, [f("name", "has", "")], COLS).length, 4, "bo'sh qiymat hech narsani kesmaydi");

console.log("\n── Son ──");
eq(names(applyFilters(ROWS, [f("qty", "lt", 5)], COLS)), ["Sut 1L"], "qoldiq < 5");
eq(names(applyFilters(ROWS, [f("qty", "gte", 12)], COLS)), ["Do'kon nonu", "Kofe 2025"], "qoldiq ≥ 12");
eq(names(applyFilters(ROWS, [f("price", "between", 7000, 9000)], COLS)), ["Sut 1L", "Do'kon nonu"], "narx 7 000…9 000");
/* ⚠ BO'SH QIYMAT SONGA MOS KELMAYDI: `null` ni 0 deb hisoblash
   «narxi yo'q» tovarni «tekin» qilib ko'rsatardi. */
eq(names(applyFilters(ROWS, [f("qty", "eq", 0)], COLS)), ["Sut 1L"], "qoldiq = 0 (bo'sh qiymat kirmaydi)");
eq(num("80 000"), 80000, "bo'shliqli raqam o'qiladi");
eq(num("12,5"), 12.5, "vergul kasr sifatida o'qiladi");

console.log("\n── Sana ──");
eq(names(applyFilters(ROWS, [f("date", "from", "2026-09-04")], COLS)), ["Sut 1L", "Kofe 2025"], "4-sentabrdan");
/* ⚠ VAQT QIRQILADI: 4-sentabr 14:30 dagi yozuv «4-sentabrgacha» ga KIRADI. */
eq(names(applyFilters(ROWS, [f("date", "to", "2026-09-04")], COLS)), ["Sut 1L", "Do'kon nonu"], "4-sentabrgacha (o'sha kun ham)");
eq(names(applyFilters(ROWS, [f("date", "between", "2026-09-01", "2026-09-04")], COLS)),
   ["Sut 1L", "Do'kon nonu"], "1—4-sentabr oralig'i");

console.log("\n── Ro'yxat va ha/yo'q ──");
eq(names(applyFilters(ROWS, [f("state", "in", ["FAOL"])], COLS)).length, 3, "holat = FAOL");
eq(names(applyFilters(ROWS, [f("state", "in", ["TUGAGAN", "FAOL"])], COLS)).length, 4, "ikkita holat — YOKI");
eq(applyFilters(ROWS, [f("state", "in", [])], COLS).length, 4, "hech biri tanlanmagan — hammasi");
eq(names(applyFilters(ROWS, [f("fav", "isTrue")], COLS)), ["Do'kon nonu"], "sevimli = ha");

console.log("\n── Bir nechta shart (VA) ──");
eq(names(applyFilters(ROWS, [f("state", "in", ["FAOL"]), f("qty", "gt", 50)], COLS)),
   ["Kofe 2025"], "FAOL VA qoldiq > 50");
eq(names(applyFilters(ROWS, [f("name", "has", "o"), f("qty", "lt", 20)], COLS)),
   ["Do'kon nonu"], "nomida «o» VA qoldiq < 20");

console.log("\n── Saralash ──");
eq(names(applySort(ROWS, { key: "qty", dir: "asc" }, COLS)),
   ["Sut 1L", "Do'kon nonu", "Kofe 2025", "Choy"], "qoldiq o'sish bo'yicha, bo'sh — oxirida");
eq(names(applySort(ROWS, { key: "qty", dir: "desc" }, COLS)),
   ["Kofe 2025", "Do'kon nonu", "Sut 1L", "Choy"], "kamayish bo'yicha ham bo'sh OXIRIDA");
/* ⚠ Raqam SON sifatida solishtiriladi: matn solishtiruvida «71» «9» dan
   oldin chiqardi. */
eq(applySort([{ v: 9 }, { v: 71 }, { v: 100 }], { key: "v", dir: "asc" },
   [{ key: "v", type: "number", get: (r) => r.v }]).map((r) => r.v), [9, 71, 100], "9 < 71 < 100");
/* ⚠ O'ZBEK ALIFBOSI: `ch` — oxirgi harflardan biri (…v, x, y, z, o', g',
   sh, ch), shuning uchun «Choy» ro'yxat OXIRIDA turadi. Ingliz tartibida
   u birinchi bo'lardi — `localeCompare(…, "uz")` aynan shu farq uchun. */
eq(names(applySort(ROWS, { key: "name", dir: "asc" }, COLS)),
   ["Do'kon nonu", "Kofe 2025", "Sut 1L", "Choy"], "matn o'zbek alifbosi bo'yicha");

console.log("\n── Filtr + saralash birga ──");
eq(names(applyAll(ROWS, [f("state", "in", ["FAOL"])], { key: "price", dir: "desc" }, COLS)),
   ["Kofe 2025", "Do'kon nonu", "Choy"], "FAOL, narx kamayish bo'yicha");

console.log("\n── Chegaralar ──");
eq(applyFilters(ROWS, [], COLS).length, 4, "shartsiz — hammasi");
eq(applyFilters(ROWS, [f("qty", "eq", "")], COLS).length, 4, "to'ldirilmagan shart hisobga olinmaydi");
eq(applyFilters(ROWS, [{ ...f("qty", "eq", 5), key: "yoq" }], COLS).length, 4, "noma'lum ustun — e'tiborsiz");
yes(OPS.text.length >= 3 && OPS.number.includes("between"), "har turda amallar bor");
yes(norm(" Do‘kon  ") === "dokon", "normalize: apostrof TASHLANADI (qidiruv bilan bir xil)", norm(" Do‘kon  "));
yes(day("2026-09-04T23:59:00Z") !== null, "sana o'qiladi");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
