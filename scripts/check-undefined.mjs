/* ══════════════════════════════════════════════════════════════════════════
   YO'Q FUNKSIYAGA CHAQIRUV — tekshiruv (V58)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Sotuv oynasi qayta yozilganda `cashGiven`, `cashAmount`, `cardAmount`
   va `payType` holatlari o'chdi, ammo sotuvdan KEYINGI tozalash
   qatorida ularning `setXxx(...)` chaqiruvlari qolib ketdi.

   Natija do'kon uchun og'ir edi: sotuv o'tadi, `ReferenceError` esa
   undan keyingi `setProcessing(false)` ga yetkazmaydi va tugma abadiy
   «Bajarilmoqda…» bo'lib qoladi — kassa to'xtaydi. Buni tekshiruv
   emas, do'kon egasi topdi.

   ⚠ NEGA QURILISH USHLAMADI. `vite build` (esbuild) faqat SINTAKSISNI
   qaraydi. E'lon qilinmagan nom sintaktik jihatdan mutlaqo to'g'ri —
   u faqat ISHLAGANDA yiqiladi. Ya'ni bunday xato test yozilmagan
   yo'lda oxirigacha yashirin qoladi.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   `setXxx(` ko'rinishidagi HAR chaqiruv uchun o'sha faylda e'lon
   qidiriladi: `useState` juftligi, `const/let/function`, import,
   destrukturizatsiya yoki funksiya argumenti.

   ⚠ ATAYLAB TOR. Bu ESLint emas va bo'lishga urinmaydi ham: React
   holat o'rnatgichlari — refaktordan keyin eng ko'p qoladigan va eng
   qimmatga tushadigan qoldiq. Tor tekshiruv yolg'on ogohlantirish
   bermaydi, ya'ni unga ishonish mumkin.

   Ishga tushirish:  node scripts/check-undefined.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

/** Barcha `.js`/`.jsx` fayllar. */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walk(full);
  return /\.(js|jsx)$/.test(e.name) ? [full] : [];
});

/* Izoh va satrlarni olib tashlaymiz: izohdagi `setFoo(` chaqiruv emas. */
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/`(?:[^`\\]|\\.)*`/g, "``")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''");

/* Brauzerning o'z funksiyalari — e'lon talab qilmaydi. */
const GLOBALS = new Set(["setTimeout", "setInterval", "setImmediate"]);

let bad = 0;
for (const file of walk(SRC)) {
  const code = strip(fs.readFileSync(file, "utf8"));

  /* ⚠ NUQTADAN KEYINGISI SANALMAYDI: `el.setAttribute(`,
     `store.setItem(`, `d.setHours(` — bular boshqa obyektning usuli va
     bu yerda e'lon qidirilmaydi. Shuning uchun oldindagi belgi
     tekshiriladi (lookbehind). */
  const called = new Set([...code.matchAll(/(?<![.\w$])(set[A-Z]\w*)\s*\(/g)]
    .map((m) => m[1])
    .filter((n) => !GLOBALS.has(n)));
  if (!called.size) continue;

  const declared = new Set();
  /* `const [x, setX] = useState(...)` */
  for (const m of code.matchAll(/\[\s*[\w$]+\s*,\s*(set[A-Z]\w*)\s*\]/g)) declared.add(m[1]);
  /* `const setX = …`, `function setX(…)`, `let setX` */
  for (const m of code.matchAll(/\b(?:const|let|var|function)\s+(set[A-Z]\w*)\b/g)) declared.add(m[1]);
  /* import, obyekt destrukturizatsiyasi va funksiya argumentlari:
     `{ setX }`, `{ setX, setY }`, `(props, setX)` */
  for (const m of code.matchAll(/[{(,]\s*(set[A-Z]\w*)\s*[,})=:]/g)) declared.add(m[1]);
  /* `obj.setX = …` va `setX:` — obyekt maydoni */
  for (const m of code.matchAll(/\b(set[A-Z]\w*)\s*[:=][^=]/g)) declared.add(m[1]);

  const missing = [...called].filter((n) => !declared.has(n));
  if (missing.length) {
    bad += missing.length;
    console.log(`  ❌ ${path.relative(ROOT, file)}`);
    for (const n of missing) {
      const line = fs.readFileSync(file, "utf8").split("\n")
        .findIndex((l) => new RegExp(`(?<![.\\w$])${n}\\s*\\(`).test(l)) + 1;
      console.log(`       ${n}(…) — e'lon qilinmagan   (:${line})`);
    }
  }
}

console.log(bad
  ? `\n  ${bad} ta e'lon qilinmagan chaqiruv. Ular ishga tushganda ilovani to'xtatadi.\n`
  : "  ✅ E'lon qilinmagan `setXxx(` chaqiruvi yo'q\n");
process.exit(bad ? 1 : 0);
