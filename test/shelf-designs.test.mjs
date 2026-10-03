/* ══════════════════════════════════════════════════════════════════════════
   JAVON YORLIQLARI GENERATORI (V143)

   ⚠ NEGA SINOV. `V143__shelf_designs.sql` ni `scripts/gen-shelf-templates.mjs`
   hisoblaydi. Qoida o'zgarib, natija tekshirilmasa — narx kod ustiga chiqishi
   yoki javon yorlig'ida barkod paydo bo'lishi mumkin (G1 ga zid), va bu faqat
   o'sha o'lchamdagi do'konda, javonda ko'rinadi.

   Ishga tushirish:  node test/shelf-designs.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
const { buildShelf, SHELF_SIZES, SHELF_DESIGNS } = await import("../scripts/gen-shelf-templates.mjs");
const { SHELF_DESIGN_ORDER, designOf, designsFor } = await import("../src/lib/ek-sticker-auto.js");
const { validateOutput } = await import("../src/lib/ek-label-validate.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};

const { out, bad } = buildShelf();
is(bad.length === 0, "har javon shabloni tekshiruvdan o'tdi", bad.slice(0, 5).join("\n     "));
is(out.length === SHELF_DESIGN_ORDER.length * SHELF_SIZES.length - 8,
  `${out.length} ta yangi = 9 dizayn × 13 o'lcham − 8 (eski javon shablonlari)`);
is(Object.keys(SHELF_DESIGNS).sort().join() === [...SHELF_DESIGN_ORDER].sort().join(),
  "generator va front bir xil dizaynlarni biladi");
is(out.every((t) => !JSON.parse(t.spec).fields.some((f) => f.key === "barcode")),
  "⚠ javon yorlig'ida barkod yo'q (G1)");
is(out.every((t) => JSON.parse(t.spec).fields.filter((f) => f.key === "code").every((f) => f.prefix === "*")),
  "kod `*` bilan — kassada aynan shunday teriladi");
is(out.every((t) => JSON.parse(t.spec).fields.every((f) => !f.size || f.size <= 72)), "shrift ≤ 72 pt (server chegarasi)");
is(designOf({ code: "shf_big_price_58x40" }) === "big_price" && designOf({ code: "shelf_a5" }) === "promo",
  "front javon dizaynini taniydi");
const T = out.map((t, i) => ({ ...t, id: i }));
is(designsFor(T, { labelWidthMm: 58, labelHeightMm: 40 }, "SHELF").length === SHELF_DESIGN_ORDER.length,
  "58×40 da 9 ta javon dizayni");

/* ⚠ dpi qoidasi faqat barkodli shablonda: 300 dpi javon dizayni Xprinter'da. */
const xp = { lang: "TSPL", dpi: 203, printWidthMm: 104 };
const roll = { mediaType: "RULON", labelWidthMm: 70, labelHeightMm: 50, across: 1, gapYMm: 2, sensor: "ORALIQ" };
const shelf300 = { kind: "SHELF", widthMm: 70, heightMm: 50, dpi: 300,
  spec: JSON.stringify({ fields: [{ key: "price", x: 2, y: 2, w: 60, h: 20, visible: true }] }) };
const sticker300 = { ...shelf300, kind: "STICKER",
  spec: JSON.stringify({ barcode: { moduleDots: 2 }, fields: [{ key: "barcode", x: 2, y: 2, w: 60, h: 20, visible: true }] }) };
is(!validateOutput(roll, xp, shelf300).some((e) => e.field === "dpi"),
  "⚠ barkodsiz 300 dpi javon yorlig'i 203 dpi printerda rad etilmaydi");
is(validateOutput(roll, xp, sticker300).some((e) => e.field === "dpi"),
  "barkodli shablonda dpi qoidasi qoladi");

const sqlPath = new URL("../../../e-kassam/src/main/resources/db/migration/V143__shelf_designs.sql", import.meta.url);
if (fs.existsSync(sqlPath)) {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const missing = out.filter((t) => !sql.includes(`'${t.code}'`) || !sql.includes(t.spec.replace(/'/g, "''")));
  is(missing.length === 0, "V143 migratsiyasi generator natijasi bilan bir xil",
    missing.slice(0, 3).map((t) => t.code).join(", "));
} else {
  console.log("  ⏭  backend repo yonida emas — migratsiya solishtirilmadi");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
