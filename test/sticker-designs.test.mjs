/* ══════════════════════════════════════════════════════════════════════════
   STIKER DIZAYNLARI GENERATORI (V142)

   ⚠ NEGA SINOV. `V142__sticker_designs.sql` qo'lda yozilmaydi — uni
   `scripts/gen-sticker-templates.mjs` hisoblaydi. Kimdir dizayn qoidasini
   o'zgartirsa-yu, natijani tekshirmasa, 121 shablondan bittasida barkod
   12 mm dan pastga tushishi yoki narx barkod ustiga chiqishi mumkin —
   va bu faqat o'sha o'lchamdagi rulonli do'konda, qog'ozda ko'rinadi.

   Ishga tushirish:  node test/sticker-designs.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
const { build, layout, SIZES, DESIGNS } = await import("../scripts/gen-sticker-templates.mjs");
const { DESIGN_ORDER } = await import("../src/lib/ek-sticker-auto.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};

const { out, bad } = build();
is(bad.length === 0, "har shablon tekshiruvdan o'tdi (validatsiya, renderer, barkod ≥ 12 mm)",
  bad.slice(0, 5).join("\n     "));
is(out.length === DESIGN_ORDER.length * SIZES.length - 5,
  `${out.length} ta yangi shablon = 14 × 9 − 5 (eski stikerlar egallagan)`);
is(Object.keys(DESIGNS).sort().join() === [...DESIGN_ORDER].sort().join(),
  "generator va front bir xil dizaynlarni biladi");
is(new Set(out.map((t) => t.code)).size === out.length, "kodlar takrorlanmaydi");
is(out.every((t) => /^stk_[a-z_]+_\d+x\d+$/.test(t.code)), "kod formati stk_<dizayn>_<eni>x<bo'yi>");
is(out.every((t) => t.name.length === 3 && t.name.every(Boolean)), "nom uchala tilda");

/* Deterministik: bir xil kirish — bir xil SQL (migratsiya qayta yozilsa
   Flyway checksum o'zgarib, server ko'tarilmay qolardi). */
is(JSON.stringify(layout("standard", 58, 40)) === JSON.stringify(layout("standard", 58, 40)),
  "joylashuv deterministik");

/* ⚠ MIGRATSIYA GENERATOR BILAN MOS: kimdir skriptni o'zgartirib, SQL ni
   qayta yozmasa (yoki teskarisi) — shu yerda bilinadi. */
const sqlPath = new URL("../../../e-kassam/src/main/resources/db/migration/V142__sticker_designs.sql", import.meta.url);
if (fs.existsSync(sqlPath)) {
  const sql = fs.readFileSync(sqlPath, "utf8");
  const missing = out.filter((t) => !sql.includes(`'${t.code}'`) || !sql.includes(t.spec.replace(/'/g, "''")));
  is(missing.length === 0, "V142 migratsiyasi generator natijasi bilan bir xil",
    missing.slice(0, 3).map((t) => t.code).join(", "));
} else {
  console.log("  ⏭  backend repo yonida emas — migratsiya solishtirilmadi");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
