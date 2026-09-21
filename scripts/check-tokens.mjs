/* ══════════════════════════════════════════════════════════════════════════
   TOKEN QOROVULI — `var(--x)` yozilgan, `--x` esa mavjud emas.

   ⚠ NEGA KERAK. CSS o'zgaruvchisi mavjud bo'lmasa brauzer XATO BERMAYDI:

     border: 1.5px solid var(--border-default);   ← `--border-default` yo'q

   butun `border` e'loni bekor bo'ladi va element CHEGARASIZ chiziladi.
   Konsolda hech narsa chiqmaydi, build yashil, sinovlar yashil — faqat
   ekranda chegara yo'q. Aynan shu holat `.ek-switch` va `.ek-note` da
   uchala ilovada ham bor edi va uni HECH KIM sezmagan (2026-09-21,
   `docs/09-CHETLANISHLAR.md` §10ț).

   Ikkinchi holat — zaxira qiymat:

     color: var(--warning, #d97706);              ← `--warning` yo'q

   bu yerda hech narsa buzilmaydi, lekin DOIM `#d97706` chiziladi: ya'ni
   token tizimi chetlab o'tilgan, qorong'i rejim bu rangga ta'sir
   qilmaydi va `CLAUDE.md` ning 1-qoidasi («dizayn tokenlaridan tashqarida
   rang yozilmaydi») buzilgan. Eng yomoni — kod tokenni ishlatayotgandek
   KO'RINADI.

   ⚠ NIMA XATO EMAS. Zaxirasi bor va CHAQIRUVCHI qo'yadigan
   o'zgaruvchilar: `--depth` (toast qatlami), `--i`/`--d` (animatsiya
   navbati), `--sb-control-*` (yon menyu ichidagi komponent). Ular
   ataylab shunday — shuning uchun rang bo'lmagan zaxira (son, uzunlik,
   `transparent`, `inherit`) qabul qilinadi.

   Ishga tushirish:  node scripts/check-tokens.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

/* `src/styles/` — `packages/` dan kelgan NUSXA. U yerdagi komponent
   boshqa ilovada ishlatiladigan o'zgaruvchini kutishi mumkin (masalan
   `--sb-hover` faqat yon menyusi bor ilovada aniqlanadi), shuning uchun
   rang zaxirasi qoidasi unga TATBIQ ETILMAYDI. Aniqlanmagan va
   ZAXIRASIZ o'zgaruvchi esa u yerda ham xato — u hech qayerda
   chizilmaydi. */
const SHARED_DIR = path.join(SRC, "styles") + path.sep;

const EXT = /\.(css|jsx?|mjs|html)$/;

function walk(dir, out = []) {
  for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
    if (it.name === "node_modules" || it.name === "dist") continue;
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else if (EXT.test(it.name)) out.push(p);
  }
  return out;
}

/* E'lon uch xil bo'ladi: CSS da `--x:`, JSX inline uslubda `"--x":`,
   JS da `setProperty("--x", …)`. Uchalasi ham haqiqiy e'lon. */
const DEFS = [
  /--([A-Za-z0-9_-]+)\s*:/g,
  /["'`]--([A-Za-z0-9_-]+)["'`]\s*:/g,
  /setProperty\(\s*["'`]--([A-Za-z0-9_-]+)["'`]/g,
];
const USE = /var\(\s*--([A-Za-z0-9_-]+)\s*(,([^()]*(\([^()]*\))?[^()]*))?\)/g;

/* Izohlar hisobga olinmaydi: ular ko'pincha ESKI, allaqachon tuzatilgan
   holatni keltiradi (masalan «ilgari `var(--bg-base, …)` edi») va soxta
   signal beradi. Qatorlar soni saqlanadi. */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

const IS_COLOR = /#[0-9A-Fa-f]{3,8}\b|\b(rgba?|hsla?|color-mix|oklch)\s*\(/;

const files = walk(SRC);
const defined = new Set();
for (const f of files) {
  const s = strip(fs.readFileSync(f, "utf8"));
  for (const re of DEFS) for (const m of s.matchAll(re)) defined.add(m[1]);
}

const dead = [];   // aniqlanmagan + zaxirasiz → HECH NARSA chizilmaydi
const hard = [];   // aniqlanmagan + rang zaxirasi → token chetlab o'tilgan

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const shared = f.startsWith(SHARED_DIR);
  strip(fs.readFileSync(f, "utf8")).split("\n").forEach((line, i) => {
    for (const m of line.matchAll(USE)) {
      const [, name, , fallback] = m;
      if (defined.has(name)) continue;
      const where = `${rel}:${i + 1}`;
      if (fallback === undefined) dead.push([where, name]);
      else if (!shared && IS_COLOR.test(fallback)) hard.push([where, name, fallback.trim()]);
    }
  });
}

if (!dead.length && !hard.length) {
  console.log("✅ Tokenlar: aniqlanmagan `var(--…)` yo'q.");
  process.exit(0);
}

if (dead.length) {
  console.error(`\n❌ ANIQLANMAGAN VA ZAXIRASIZ (${dead.length} ta) — e'lon BEKOR bo'ladi:`);
  for (const [where, name] of dead) console.error(`   ${where}  var(--${name})`);
}
if (hard.length) {
  console.error(`\n❌ TOKEN CHETLAB O'TILGAN (${hard.length} ta) — doim qattiq rang chiziladi:`);
  for (const [where, name, fb] of hard) console.error(`   ${where}  var(--${name}, ${fb})`);
}
console.error(
  "\nTuzatish: mavjud semantik tokenni yozing (`--fg-*`, `--bg-*`, `--border-*`).\n" +
  "Yangi token kerak bo'lsa — `packages/tokens/ekassam-tokens.css` ga qo'shing,\n" +
  "ilovada qattiq rang QOLDIRMANG.\n"
);
process.exit(1);
