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
const { build, layout, SIZES, DESIGNS, specsIn } = await import("../scripts/gen-sticker-templates.mjs");
const { DESIGN_ORDER } = await import("../src/lib/ek-sticker-auto.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};

const { out, bad } = build();
is(bad.length === 0, "har shablon tekshiruvdan o'tdi (validatsiya, renderer, barkod ≥ 12 mm, kichigida ≥ 10)",
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
   qayta yozmasa (yoki teskarisi) — shu yerda bilinadi. Oxirgi holat —
   V142 (yaratish) ustiga V144 (o'zgargan joylashuvlar). */
const dir = new URL("../../../e-kassam/src/main/resources/db/migration/", import.meta.url);
const v142 = new URL("V142__sticker_designs.sql", dir), v144 = new URL("V144__sticker_designs_small.sql", dir);
const later = ["V147__sticker_price_code_bigger.sql", "V148__sticker_long_names.sql"].map((n) => new URL(n, dir));
if (fs.existsSync(v142) && fs.existsSync(v144) && later.every((f) => fs.existsSync(f))) {
  const latest = specsIn(fs.readFileSync(v142, "utf8"));
  for (const f of [v144, ...later]) for (const [k, v] of specsIn(fs.readFileSync(f, "utf8"))) latest.set(k, v);
  const { legacy: leg } = build();
  const missing = [...out, ...leg].filter((t) => latest.get(t.code) !== t.spec);
  is(missing.length === 0,
    "V142 + V144 + V147 + V148 migratsiyalari generator natijasi bilan bir xil (eski V131 ham)",
    missing.slice(0, 3).map((t) => t.code).join(", "));
} else {
  console.log("  ⏭  backend repo yonida emas — migratsiya solishtirilmadi");
}

/* ⚠ 30×20 DA DIZAYNLAR HAR XIL (egasi, 2026-10-04): maydonlar to'plami
   takrorlanmasin — ilgari 14 dizaynning deyarli hammasi «barkod + narx» edi. */
const sig = (t) => {
  const sp = JSON.parse(t.spec);
  /* Maydon + shrift: «Standart» va «Nom yirik» da maydonlar bir xil, nom o'lchami farq qiladi. */
  return sp.fields.map((f) => `${f.key}${f.size ? ":" + f.size : ""}`).join(",") + "|" + sp.border.widthMm;
};
const small = out.filter((t) => t.widthMm === 30 && t.heightMm === 20).map(sig);
is(new Set(small).size === small.length, "30×20 da har dizayn o'z maydonlari bilan", small.join("  "));
const std = out.find((t) => t.code === "stk_standard_30x20");
is(std && JSON.parse(std.spec).fields.some((f) => f.key === "nameShort"), "30×20 «Standart» da nom bor");

/* ⚠ BO'SH JOY NARX VA KODGA (V147, 2026-10-05): egasi «narx va *kod kattaroq
   ko'rinsin». 58×40 «Standart» da narx asl 15 pt dan katta, eski 30×20 stiker ham
   yangi qoidada. */
const priceOf = (code, list = out) => JSON.parse(list.find((t) => t.code === code)?.spec || "{}")
  .fields?.find((f) => f.key === "price")?.size || 0;
is(priceOf("stk_standard_58x40") >= 20, "58×40 «Standart» da narx yirik (≥ 20 pt)", String(priceOf("stk_standard_58x40")));
const { legacy } = build();
is(legacy.length === 5 && priceOf("sticker_small", legacy) >= 13,
   "eski 30×20 «Barkod va narx» ham kattalashdi (≥ 13 pt)", String(priceOf("sticker_small", legacy)));
console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
if (fail) process.exit(1);
