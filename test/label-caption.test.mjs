/* ══════════════════════════════════════════════════════════════════════════
   DO'KON KODI BARKODI OSTIDA FAQAT «*123» (2026-10-09)

   Egasi: «stikerda *kodning oldi va orqasiga raqamlar qo'shilyapti — faqat
   *kodning o'zi qolsin». Chiziqlar (skaner o'qiydigani) o'zgarmaydi.

   Ishga tushirish:  node test/label-caption.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { layoutLabel, renderLabel, storeCaption } = await import("../src/lib/ek-label-render.js");
const { toTSPL, toZPL } = await import("../src/lib/ek-label-bytes.js");
const { storeCodeOf } = await import("../src/lib/ek-store-code.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } };

const TPL = {
  kind: "STICKER", widthMm: 30, heightMm: 20, dpi: 203, thermal: true,
  spec: {
    background: "#fff",
    barcode: { moduleDots: 2, quietLeftModules: 9, quietRightModules: 7, showText: true },
    fields: [
      { key: "name",    x: 1, y: 1,  w: 28, h: 5,  size: 7, weight: 700, visible: true },
      { key: "barcode", x: 1, y: 7,  w: 28, h: 12, align: "center", visible: true },
    ],
  },
};
const store = { id: 1, name: "Non", searchCode: "123", barcode: storeCodeOf("123") };
const ean = { id: 2, name: "Shokolad", searchCode: "425", barcode: "5901234123457" };

console.log("\n── Qaysi barkodga ──");
ok(storeCodeOf("123") === "20001230", "do'kon kodi 123 → EAN-8 20001230 (chiziqlar shu)");
ok(storeCaption(store, store.barcode) === "*123", "do'kon kodi barkodi → «*123»");
ok(storeCaption({ searchCode: "*123" }, "20001230") === "*123", "kod «*» bilan saqlangan bo'lsa ham");
ok(storeCaption(ean, ean.barcode) === null, "⚠ tovarning o'z barkodi — raqamlari tegilmaydi");

console.log("\n── Joylashuv ──");
{
  const L = layoutLabel(TPL, store);
  const bc = L.items.find((i) => i.kind === "barcode");
  const cap = L.items.find((i) => i.key === "barcodeCaption");
  ok(bc && bc.value === "20001230" && bc.showText === false, "chiziqlar o'sha, printer raqamlari o'chiq");
  ok(cap && cap.text === "*123", "ostida matn «*123»");
  ok(cap && bc && Math.abs(cap.y - (bc.y + bc.h)) < 1e-9 && cap.y + cap.h <= 19 + 1e-9, "matn chiziqlar ostida, maydon ichida");
  const svg = renderLabel(TPL, store).svg;
  ok(svg.includes(">*123<") && !svg.includes(">20001230<"), "ko'rish oynasida faqat «*123»");
  const tspl = toTSPL(L);
  ok(/BARCODE [^\n]*"EAN8",\d+,0,/.test(tspl) && tspl.includes('"*123"'), "TSPL: raqamlarsiz barkod + «*123» matni");
  const zpl = toZPL(L);
  ok(zpl.includes("^BEN,") && zpl.includes(",N,N^FD20001230") && zpl.includes("*123"), "ZPL: raqamlarsiz barkod + «*123»");
}
{
  const L = layoutLabel(TPL, ean);
  const bc = L.items.find((i) => i.kind === "barcode");
  ok(bc.showText === true && !L.items.some((i) => i.key === "barcodeCaption"), "oddiy EAN-13 — eskicha, raqamlari bilan");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
