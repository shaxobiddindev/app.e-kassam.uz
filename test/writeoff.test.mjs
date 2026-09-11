/* ══════════════════════════════════════════════════════════════════════════
   CHIQIT SABABLARI — BITTA RO'YXAT (V116)

   ═══ NIMA BO'LGAN EDI ══════════════════════════════════════════════════

   Ro'yxat uch joyda yozilgan edi: `ek-labels.js` da, `InventoryPage.jsx`
   da va `BatchCorrectModal.jsx` da. Ular allaqachon bir xil emas edi:

     · `RECOUNT` asosiy lug'atdan TUSHIB QOLGAN — ombor ekranida
       sakkizta sabab, sotuvlar ekranida yettita;
     · `SPOILAGE` bir ekranda ko'za, boshqasida ogohlantirish
       uchburchagi bo'lib chizilardi.

   Buni hech kim sezmadi, chunki hech qayerda xato chiqmagan.

   ═══ NEGA MATN BO'YICHA TEKSHIRILADI ═══════════════════════════════════

   ⚠ `ek-labels.js` ni bu yerdan `import` qilib bo'lmaydi: u
   `./ek-i18n` ni kengaytmasiz chaqiradi va buni faqat Vite yechadi.
   Node uchun uni qayta yozish sinov uchun ishlab chiqarish kodini
   o'zgartirish bo'lardi.

   Bu yerdagi qoida esa TUZILISHGA tegishli — «ro'yxat bitta joyda» —
   va uni matndan o'qish yetarli.

   Ishga tushirish:  node test/writeoff.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };

const labels = fs.readFileSync(path.join(SRC, "lib", "ek-labels.js"), "utf8");

/* Serverdagi `WriteOffReason` — tartibi bilan. */
const REASONS = ["BREAKAGE", "SPOILAGE", "EXPIRY", "THEFT",
                 "SUPPLIER_RETURN", "OWN_USE", "RECOUNT", "OTHER"];

console.log("── 1. Lug'atda hamma sabab bor ──");
{
  const i = labels.indexOf("WRITE_OFF_REASON = dict(");
  const block = labels.slice(i, labels.indexOf("});", i));
  const missing = REASONS.filter((r) => !new RegExp(`^\\s+${r}:`, "m").test(block));
  missing.length === 0
    ? ok(`sakkiztasi ham lug'atda (${REASONS.length})`)
    : bad("lug'atda yetishmaydi", missing.join(", "));

  /* ⚠ AYNAN SHU TUSHIB QOLGAN EDI. */
  /^\s+RECOUNT:/m.test(block)
    ? ok("⚠ `RECOUNT` lug'atda — u avval yo'q edi")
    : bad("`RECOUNT` lug'atda bo'lishi kerak", "yo'q");
}

console.log("\n── 2. Ro'yxat BOSHQA HECH QAYERDA yozilmagan ──");
{
  /* Ko'chirma nusxani shu iz bilan taniymiz: sabablardan bittasi
     `value:` sifatida yozilgan bo'lsa — demak ro'yxat qayta
     terilgan. */
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(d, e.name);
    return e.isDirectory() ? walk(f) : (/\.(js|jsx)$/.test(e.name) ? [f] : []);
  });
  const copies = walk(SRC)
    .filter((f) => !f.endsWith(`${path.sep}ek-labels.js`))
    .filter((f) => !f.includes(`${path.sep}locales${path.sep}`))
    .filter((f) => /value:\s*"(BREAKAGE|SUPPLIER_RETURN|SPOILAGE)"/.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(ROOT, f));

  copies.length === 0
    ? ok("ro'yxat faqat `ek-labels.js` da")
    : bad("⚠ ro'yxat qayta terilgan — u yana farq qila boshlaydi", copies.join(", "));
}

console.log("\n── 3. Qaytarishda «hisob xatosi» yo'q ──");
{
  /* ⚠ Qaytarilgan tovar QO'LDA TURIBDI: uni «raqam noto'g'ri edi»
     deb hisobdan chiqarish hisobotni buzardi — `RECOUNT` yo'qotish
     sifatida sanalmaydi, ya'ni rostdan yo'q bo'lgan tovar hech
     qayerda ko'rinmay qolardi. */
  /RETURN_WRITE_OFF_EXCLUDE\s*=\s*\["RECOUNT"\]/.test(labels)
    ? ok("`RETURN_WRITE_OFF_EXCLUDE` — `RECOUNT`")
    : bad("qaytarish yo'lida `RECOUNT` chiqarib tashlanishi kerak", "yo'q");

  const sales = fs.readFileSync(path.join(SRC, "pages", "SalesPage.jsx"), "utf8");
  /writeOffOptions\(\{\s*exclude:\s*RETURN_WRITE_OFF_EXCLUDE\s*\}\)/.test(sales)
    ? ok("sotuvlar sahifasi shu ro'yxatdan foydalanadi")
    : bad("SalesPage `exclude` bilan chaqirishi kerak", "chaqirmaydi");
}

console.log("\n── 4. Uchala tilda yorlig'i bor ──");
{
  for (const lang of ["uz", "ru", "en"]) {
    const loc = fs.readFileSync(path.join(SRC, "lib", "locales", `${lang}.js`), "utf8");
    const missing = REASONS.filter((r) => !loc.includes(`"enum.writeOff.${r}"`));
    missing.length === 0
      ? ok(`${lang}: hammasi tarjima qilingan`)
      : bad(`${lang}: yorlig'i yo'q`, missing.join(", "));
  }
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
