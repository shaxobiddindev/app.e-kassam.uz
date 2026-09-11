/* ══════════════════════════════════════════════════════════════════════════
   EKRANDAGI SABABSIZ «0» — tekshiruv (V66)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Ombor sahifasida qidiruv yonida sababsiz «0» turardi. Sababi bitta
   qator edi:

       const hasClothing = facets.brands.length || … || facets.seasons.length;
       …
       {hasClothing && <button>Filtr</button>}

   `||` zanjirining qiymati — oxirgi `.length`, ya'ni RAQAM. Kiyim
   atributi yo'q omborda u `0` bo'ladi va JSX da `0 && <…>` ifodasi
   `0` ni qaytaradi. React esa nolni MATN deb chizadi (`false`,
   `null`, `undefined` va bo'sh satrni chizmaydi — faqat `0` va
   `NaN` ko'rinadi).

   ⚠ XATO JIMGINA. Qurilish o'tadi, konsolda hech narsa chiqmaydi,
   sinovlar yashil — ekranda esa tushunarsiz raqam turadi va uni
   faqat odam ko'radi. Aynan shuning uchun tekshiruv kerak: buni
   do'kon egasi topdi, tizim emas.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   JSX ichidagi `{IDENT && …}` shartlari. Har `IDENT` uchun o'sha
   fayldagi e'loni topiladi va u RAQAM berishi aniq bo'lsa
   (`.length` bilan tugasa yoki `Number(...)`, arifmetika bo'lsa)
   — ogohlantirish. Yechim: `Boolean(...)` yoki `> 0`.

   ⚠ ATAYLAB TOR (`check-undefined.mjs` dagi bilan bir xil qoida): bu
   ESLint emas. Faqat e'loni SHU FAYLDA turgan va raqam ekani
   ANIQ bo'lgan nomlar tekshiriladi — shunda yolg'on ogohlantirish
   bo'lmaydi va ro'yxatga ishonish mumkin.

   Ishga tushirish:  node scripts/check-zero.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walk(full);
  return /\.jsx$/.test(e.name) ? [full] : [];
});

/* Izoh va satrlar — `check-undefined.mjs` dagi bilan AYNAN bir xil
   qoida, jumladan o'zbekcha apostrof (`jamg'arma`) satr chegarasi
   emasligi. Ikki joyda ikki xil bo'lsa, biri ikkinchisi ko'rgan
   xatoni ko'rmay qolardi. */
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/`(?:[^`\\]|\\.)*`/g, "``")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  .replace(/(^|[^A-Za-z0-9_$])'(?:[^'\\\n]|\\.)*'/gm, "$1''");

/**
 * Ifoda RAQAM berishi ANIQMI.
 *
 * ⚠ Faqat SHUBHASIZ holatlar: `.length` bilan tugagan (yoki `||`
 * zanjirining OXIRGI bo'lagi shunday), `Number(...)`, `parseInt`,
 * arifmetika. `.some(...)`, `!...`, `===` — mantiqiy, tegilmaydi.
 */
function isNumeric(expr) {
  const e = expr.trim().replace(/;$/, "");

  /* ⚠ MANTIQIYGA AYLANTIRILGAN IFODA — BUTUNI bo'yicha tekshiriladi,
     `||` bo'laklari bo'yicha EMAS. `Boolean(a.length || b.length)` da
     oxirgi bo'lak `b.length)` bo'lib chiqadi va u «raqam» ga o'xshaydi,
     holbuki butun ifoda `true/false`. Bu yerda tartib buzilsa, tekshiruv
     TO'G'RI kodni xato deb ko'rsatardi (skript yozilayotganda tutildi —
     yolg'on ogohlantirish esa uni ishonchsiz qiladi va o'chirtiradi). */
  if (/^(Boolean\s*\(|!!)/.test(e)) return false;

  /* O'rovchi qavslar TURNI o'zgartirmaydi: `(a.length || b.length)` ham
     raqam. Ular tozalanmasa oxirgi bo'lak `b.length)` bo'lib qolardi. */
  const bare = e.replace(/^\((.*)\)$/s, "$1").trim();
  /* `||` va `??` zanjirida qiymat — OXIRGI bo'lak. */
  const last = bare.split(/\|\||\?\?/).pop().trim().replace(/\)+$/, "");

  if (/^!/.test(last) || /[=!]==/.test(last)) return false;
  if (/[<>]=?\s/.test(last)) return false;              // taqqoslash — mantiqiy
  if (/\.length\s*$/.test(last)) return true;
  if (/^(Number|parseInt|parseFloat)\s*\(/.test(last)) return true;
  if (/^\w[\w.$?[\]]*\s*[-+*/%]\s*\w/.test(last)) return true;   // arifmetika
  return false;
}

let bad = 0;
for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, "utf8");
  const code = strip(raw);

  /* Fayldagi `const X = …` e'lonlari (bitta qatorli va ko'p qatorli). */
  const decl = new Map();
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
    decl.set(m[1], m[2]);
  }

  /* JSX sharti: `{X && …}` yoki `{a && X && …}` */
  const names = new Set();
  for (const m of code.matchAll(/\{\s*(?:[!\w$.?()]+\s*&&\s*)*([A-Za-z_$][\w$]*)\s*&&/g)) {
    names.add(m[1]);
  }

  for (const name of names) {
    const expr = decl.get(name);
    if (!expr || !isNumeric(expr)) continue;
    bad++;
    const line = raw.split("\n").findIndex((l) => new RegExp(`\\b${name}\\s*&&`).test(l)) + 1;
    console.log(`  ❌ ${path.relative(ROOT, file)}`);
    console.log(`       {${name} && …} — \`${name}\` RAQAM, noli ekranga chiziladi   (:${line})`);
    console.log(`       Yechim: e'lonni \`Boolean(…)\` ga o'rang yoki \`> 0\` bilan solishtiring`);
  }
}

console.log(bad
  ? `\n  ${bad} ta joyda ekranga sababsiz «0» chiqishi mumkin.\n`
  : "  ✅ JSX shartlarida raqam yo'q — ekranga sababsiz «0» chiqmaydi\n");
process.exit(bad ? 1 : 0);
