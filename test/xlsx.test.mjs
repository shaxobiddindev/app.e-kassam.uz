/* ══════════════════════════════════════════════════════════════════════════
   EXCEL FAYLI (V71)

   ⚠ NEGA SINOV QATTIQ. Excel yaroqsiz faylni «buzilgan» deb UMUMAN
   ochmaydi va sababini aytmaydi. Ya'ni bitta noto'g'ri bayt — xato
   hisob emas, butunlay ishlamaydigan tugma, va uni faqat foydalanuvchi
   topadi. Shuning uchun bu yerda ZIP tuzilishi, CRC va XML to'g'riligi
   bayt darajasida tekshiriladi.

   Yozuvchining o'zi hech qanday kutubxonaga tayanmaydi, sinov esa
   Node ning O'Z `crc32` iga solishtiradi — ikkita mustaqil hisob bir
   xil javob berishi kerak.
   ══════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import { crc32 as nodeCrc32 } from "node:zlib";
import { buildXlsx, crc32, xmlEscape, colName, safeSheetName } from "../src/lib/ek-xlsx.js";

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};

const enc = (s) => new TextEncoder().encode(s);
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const ctrl = (n) => String.fromCharCode(n);

console.log("\n── CRC-32 ──");
it("Node ning o'z hisobi bilan bir xil", () => {
  for (const s of ["", "a", "Choy", "Do'kon — 2026", "ЁЖИК"]) {
    assert.equal(crc32(enc(s)), nodeCrc32(Buffer.from(s)) >>> 0, `«${s}»`);
  }
});

console.log("\n── XML ──");
it("maxsus belgilar qochiriladi", () => {
  assert.equal(xmlEscape('a & b < c > d " e \' f'), "a &amp; b &lt; c &gt; d &quot; e &apos; f");
});
it("⚠ KO'RINMAS boshqaruv belgilari TASHLANADI", () => {
  /* Skanerdan yoki eski importdan tushgan 0x01, 0x1F — ular XML ni
     yaroqsiz qiladi va Excel faylni umuman ochmaydi, sabab esa
     ekranda ko'rinmaydi. */
  assert.equal(xmlEscape(`Cho${ctrl(1)}y${ctrl(31)}`), "Choy");
  assert.equal(xmlEscape("qator\nsatr\ttab"), "qator\nsatr\ttab", "yangi qator va tab QOLADI");
});
it("ustun harflari", () => {
  assert.equal(colName(0), "A");
  assert.equal(colName(25), "Z");
  assert.equal(colName(26), "AA");
  assert.equal(colName(51), "AZ");
  assert.equal(colName(701), "ZZ");
});
it("⚠ varaq nomi Excel qoidalariga keltiriladi", () => {
  assert.equal(safeSheetName("Savdo/2026"), "Savdo 2026", "«/» ni Excel qabul qilmaydi");
  assert.equal(safeSheetName("x".repeat(50)).length, 31, "31 belgidan uzun bo'lolmaydi");
  assert.equal(safeSheetName("   ", "Zaxira"), "Zaxira", "bo'sh nom — zaxira");
});

console.log("\n── ZIP tuzilishi ──");
const book = buildXlsx([
  { name: "Savdo", rows: [[{ v: "Nomi", bold: true }, { v: "Summa", bold: true }],
                          ["Choy", 12000], ["Non & Sut", 3500.5]] },
  { name: "Kassirlar", rows: [["Ali", 5]] },
]);

it("ZIP imzosi bilan boshlanadi", () => assert.equal(u32(book, 0), 0x04034b50));
it("oxirida markaziy katalog yakuni bor", () => {
  let at = -1;
  for (let i = book.length - 22; i >= 0; i--) if (u32(book, i) === 0x06054b50) { at = i; break; }
  assert.ok(at > 0, "EOCD topilmadi");
  assert.equal(u16(book, at + 8), u16(book, at + 10), "fayllar soni ikki joyda bir xil");
  assert.equal(u32(book, at + 16) + u32(book, at + 12), at, "katalog boshi + hajmi = EOCD o'rni");
});
it("har fayl uchun CRC va hajm to'g'ri yozilgan", () => {
  let at = 0, n = 0;
  while (u32(book, at) === 0x04034b50) {
    const crc = u32(book, at + 14);
    const size = u32(book, at + 18);
    const start = at + 30 + u16(book, at + 26) + u16(book, at + 28);
    const body = book.slice(start, start + size);
    assert.equal(crc, nodeCrc32(Buffer.from(body)) >>> 0, `fayl #${n} CRC`);
    at = start + size;
    n++;
  }
  assert.equal(n, 7, `ikki varaqli kitobda 7 ta fayl bo'lishi kerak; topildi: ${n}`);
});
it("siqilmagan (STORE) — siqilgan va xom hajm teng", () => {
  let at = 0;
  while (u32(book, at) === 0x04034b50) {
    assert.equal(u16(book, at + 8), 0, "usul = 0 (STORE)");
    assert.equal(u32(book, at + 18), u32(book, at + 22), "hajmlar teng");
    at = at + 30 + u16(book, at + 26) + u16(book, at + 28) + u32(book, at + 18);
  }
});

console.log("\n── Mazmun ──");
const text = new TextDecoder().decode(book);
it("kerakli qismlar bor", () => {
  for (const n of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
                   "xl/_rels/workbook.xml.rels", "xl/styles.xml",
                   "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(text.includes(n), n);
  }
});
it("⚠ SON son bo'lib yoziladi, matn bo'lib emas", () => {
  assert.ok(text.includes("<v>12000</v>"), "12000 raqam katakda");
  assert.ok(text.includes("<v>3500.5</v>"), "kasr son ham");
  assert.ok(!text.includes(">12000</t>"), "raqam matn katagida bo'lmasligi kerak — "
    + "aks holda Excel uni JAMLAY OLMAYDI va «nega yig'indi chiqmayapti?» degan savol qolardi");
});
it("sarlavha qalin uslub bilan", () => assert.ok(text.includes('s="1" t="inlineStr"')));
it("«&» xavfsiz yozilgan", () => assert.ok(text.includes("Non &amp; Sut")));
it("⚠ uslub `rId` i varaqlarnikidan KEYIN", () => {
  /* Bir xil `rId` ikki marta ishlatilsa Excel faylni ochmaydi. */
  const rels = text.slice(text.indexOf("workbook.xml.rels"));
  assert.ok(/Id="rId3"[^>]*styles\.xml/.test(rels), "ikki varaqda uslub — rId3");
  assert.ok(!/Id="rId1"[^>]*styles\.xml/.test(rels));
});

console.log("\n── Chegaralar ──");
it("⚠ BO'SH ro'yxatdan ham FAYL chiqadi", () => {
  const b = buildXlsx([]);
  assert.ok(b.length > 100, "Excel nolta varaqli kitobni ochmaydi");
  assert.ok(new TextDecoder().decode(b).includes("sheet1.xml"));
});
it("⚠ bir xil nomli varaqlar AJRATILADI", () => {
  const t = new TextDecoder().decode(buildXlsx([
    { name: "Savdo", rows: [] }, { name: "Savdo", rows: [] },
  ]));
  assert.ok(t.includes('name="Savdo"') && t.includes('name="Savdo 2"'),
    "Excel bir xil nomli ikki varaqli kitobni ochmaydi");
});
it("bo'sh katak yozilmaydi", () => {
  const t = new TextDecoder().decode(buildXlsx([{ name: "A", rows: [["x", null, "", undefined, "y"]] }]));
  assert.ok(t.includes('r="A1"') && t.includes('r="E1"'));
  assert.ok(!t.includes('r="B1"'), "bo'sh katak faylni bekorga shishirardi");
});
it("NaN va Infinity son sifatida yozilmaydi", () => {
  const t = new TextDecoder().decode(buildXlsx([{ name: "A", rows: [[NaN, Infinity]] }]));
  assert.ok(!t.includes("<v>NaN</v>") && !t.includes("<v>Infinity</v>"),
    "Excel bunday katakni o'qiy olmaydi");
});
it("uzun kitob ham to'g'ri (500 qator)", () => {
  const rows = Array.from({ length: 500 }, (_, i) => [`Tovar ${i}`, i * 1000]);
  const b = buildXlsx([{ name: "Katta", rows }]);
  let at = 0, n = 0;
  while (u32(b, at) === 0x04034b50) {
    const size = u32(b, at + 18);
    const start = at + 30 + u16(b, at + 26) + u16(b, at + 28);
    assert.equal(u32(b, at + 14), nodeCrc32(Buffer.from(b.slice(start, start + size))) >>> 0);
    at = start + size; n++;
  }
  assert.equal(n, 6);
});

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
