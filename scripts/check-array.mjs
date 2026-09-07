/* ══════════════════════════════════════════════════════════════════════════
   SERVER JAVOBIDAN RO'YXAT: `|| []` YOLG'ON HIMOYA (V86)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Kodning o'nlab joyida shunday yozilgan edi:

       setItems(r.data || []);

   `||` faqat «bo'sh» qiymatlarni ushlaydi: `null`, `undefined`, `0`,
   `""`. Obyekt esa — `{}` bo'lsa ham — TRUTHY va shundoq o'tib
   ketadi. Keyingi qatordagi `.map(...)` yiqiladi:

       TypeError: r.map is not a function

   ⚠ NATIJASI BITTA QATOR EMAS, BUTUN SAHIFA. React'da render
   ichidagi istisno butun daraxtni yiqitadi — foydalanuvchi
   ErrorBoundary'ning «Bu bo'limda xatolik yuz berdi» oynasini
   ko'radi. Kassir uchun bu kassa to'xtaganini bildiradi.

   ═══ BU HAQIQIY XAVFMI ════════════════════════════════════════════════

   Ha, va u shu loyihada IKKI MARTA ro'y bergan:

     1. Fiskal panel `{}` javobini `|| []` bilan «himoyalab», keyin
        `.map` qilgan — butun Sozlamalar sahifasi yiqilgan (V85).
     2. `CommandPalette.jsx` da `r.data?.content || r.data || []` deb
        yozilgan: kimdir allaqachon endpoint ro'yxatdan sahifalangan
        javobga o'tganini ko'rgan. O'shanda BITTA joy tuzatilgan,
        qolgan o'nlab joy o'sha holicha qolgan.

   Server tomonda `List<T>` ni `Page<T>` ga o'zgartirish — oddiy
   qadam. Uni qilgan odam frontendning qaysi yigirma joyi
   yiqilishini bilmaydi.

   ═══ NIMA TALAB QILINADI ══════════════════════════════════════════════

   Server javobidan ro'yxat olinadigan joyda `asArray(...)`
   (`src/lib/ek-array.js`). U massivni o'zgartirmaydi, sahifalangan
   javobni tushunadi va boshqa hamma narsaga bo'sh massiv qaytaradi.

   ⚠ ATAYLAB TOR: faqat `.data` dan keyin kelgan `|| []` qaraladi.
   Boshqa joydagi `|| []` (masalan mahalliy o'zgaruvchida) bu yerda
   tekshirilmaydi — yolg'on ogohlantirish bermaslik uchun.

   Ishga tushirish:  node scripts/check-array.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

/** Funksiyaning O'ZI — izohida yomon namuna ataylab keltirilgan. */
const SKIP = path.join("lib", "ek-array.js");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.jsx?$/.test(e.name) ? [p] : [];
});

const PAT = /\.data(?:\?\.\w+)?\s*(?:\|\||\?\?)\s*\[\]/;

let bad = 0;
console.log("\n══ Server javobidan ro'yxat: `|| []` yolg'on himoya ══");

for (const file of walk(SRC)) {
  if (file.endsWith(SKIP)) continue;
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!PAT.test(line)) return;
    bad++;
    console.log(`  ❌ ${rel}:${i + 1}`);
    console.log(`     ${line.trim()}`);
  });
}

if (bad) {
  console.log(`\n❌ ${bad} ta yolg'on himoya.`);
  console.log("   `.data || []` obyektni O'TKAZIB YUBORADI va keyingi `.map`");
  console.log("   BUTUN SAHIFANI yiqitadi. O'rniga:");
  console.log("       import { asArray } from \"…/lib/ek-array\";");
  console.log("       setItems(asArray(r.data));");
  process.exit(1);
}

console.log("  ✅ ro'yxatlar `asArray` bilan olinadi");
process.exit(0);
