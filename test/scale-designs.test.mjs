/* ══════════════════════════════════════════════════════════════════════════
   TAROZI YORLIG'I DIZAYNLARI (V146) — generator, migratsiya, burilish

   ⚠ NEGA SINOV. (1) Kimdir generatorni o'zgartirib SQL ni qayta yozmasa —
   bazadagi shablon boshqa, ekrandagi boshqa. (2) Tik barkod faqat SVG da
   burilib, printer buyrug'ida burilmasa — ko'rish oynasida to'g'ri,
   qog'ozda esa barkod matn ustiga tushadi. Ikkalasi ham ekranda ko'rinmaydi.

   Ishga tushirish:  node test/scale-designs.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";

const { buildScale } = await import("../scripts/gen-scale-templates.mjs");
const { SIZES, specsIn } = await import("../scripts/gen-sticker-templates.mjs");
const { SCALE_DESIGN_ORDER, designsFor, pickTemplate, isScaleTpl } = await import("../src/lib/ek-sticker-auto.js");
const { renderLabel, layoutLabel } = await import("../src/lib/ek-label-render.js");
const { toTSPL, toZPL } = await import("../src/lib/ek-label-bytes.js");
const { weighedProduct } = await import("../src/lib/ek-weight-label.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};

const { out, bad } = buildScale();
is(bad.length === 0, "har shablon tekshiruvdan o'tdi (validatsiya, renderer, chegara, ustma-ust)", bad.slice(0, 3).join("\n"));
is(out.length === SCALE_DESIGN_ORDER.length * SIZES.length, `${SCALE_DESIGN_ORDER.length} dizayn × ${SIZES.length} o'lcham = ${out.length}`);

const v146 = new URL("../../../e-kassam/src/main/resources/db/migration/V146__scale_label_designs.sql", import.meta.url);
if (fs.existsSync(v146)) {
  const sqlText = fs.readFileSync(v146, "utf8");
  const map = new Map();
  for (const m of sqlText.matchAll(/\('(scl_[a-z_]+_\d+x\d+)',[^\n]*?'(\{[^\n]*\})'\)/g)) map.set(m[1], m[2].replace(/''/g, "'"));
  const diff = out.filter((t) => map.get(t.code) !== t.spec);
  is(map.size === out.length && diff.length === 0, "V146 migratsiyasi generator natijasi bilan bir xil",
     diff.slice(0, 3).map((t) => t.code).join(", "));
  void specsIn;
} else {
  console.log("  ⏭  backend repo yonida emas — migratsiya solishtirilmadi");
}

const p = weighedProduct({ name: "Pista", salePrice: 15000, plu: "1", unit: "KG" }, 0.255,
  { prefixes: ["27"], pluDigits: 5, valueDigits: 5, valueDecimals: 3 }).product;
const side = { ...out.find((t) => t.code === "scl_side_58x40"), id: 1, system: true };

console.log("\n── Tik barkod (suratdagidek) ──");
{
  const { svg, warnings } = renderLabel(side, p, { printedAt: "2026-09-30 13:25" });
  is(warnings.length === 0, "ogohlantirishsiz chiziladi", JSON.stringify(warnings));
  is(svg.includes("rotate(-90)"), "SVG da barkod va vaqt buriladi");
  is(svg.replace(/[\s  ]/g, " ").includes("3 825") && svg.includes("0,255 kg") && svg.includes("2026-09-30 13:25"), "jami, og'irlik va vaqt yorliqda");
  const L = layoutLabel(side, p, {});
  const tspl = toTSPL(L, { dpi: 203 });
  is(/BARCODE \d+,\d+,"EAN13",\d+,1,270,2,4,"2700001002550"/.test(tspl), "TSPL: barkod 270° burilib, og'irlikli kod bilan",
     tspl.split("\r\n").find((l) => l.startsWith("BARCODE")));
  is(/\^BEB,/.test(toZPL(L, { dpi: 203 })), "ZPL: barkod pastdan yuqoriga (^BEB)");
}

console.log("\n── Oddiy stikerdan ajratilgan ──");
{
  const media = { labelWidthMm: 58, labelHeightMm: 40, mediaType: "RULON" };
  const std = { id: 9, code: "stk_standard_58x40", kind: "STICKER", widthMm: 58, heightMm: 40, system: true };
  const all = [...out.map((t, i) => ({ ...t, id: 100 + i, system: true })), std];
  is(designsFor(all, media, "STICKER").every((t) => !isScaleTpl(t)), "⚠ oddiy stiker galereyasida tarozi dizayni yo'q");
  is(designsFor(all, media, "SCALE").length === 3, "tarozi ekranida shu o'lchamdagi 3 dizayn");
  is(pickTemplate(all, media, null, "SCALE")?.code === "scl_side_58x40", "tarozi uchun standart — yon barkod");
  is(pickTemplate(all, media, null, "STICKER")?.code === "stk_standard_58x40", "stiker uchun — hamon «Standart»");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
