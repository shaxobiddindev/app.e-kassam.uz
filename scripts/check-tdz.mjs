/* ══════════════════════════════════════════════════════════════════════════
   E'LONDAN OLDIN O'QILGAN NOM (TDZ) — tekshiruv

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   `AuditPage.jsx` ni cheksiz ro'yxatga o'tkazganda shunday yozildi:

       const busy = useLoading(loading && !rows.length);   // ← 1
       ...
       const { rows, loading } = useInfinite(fetchPage);   // ← 2

   `const` — «temporal dead zone»: 1-qator 2-qatordan OLDIN o'qilsa
   `ReferenceError: Cannot access 'loading' before initialization`
   bo'ladi. React esa xato tashlagan komponentni UMUMAN chizmaydi:
   ekran BO'SH qoladi, sababi faqat konsolda turadi.

   ⚠ NEGA QURILISH USHLAMADI. `vite build` (esbuild) buni sintaktik
   jihatdan mutlaqo to'g'ri deb biladi — `var` da bu haqiqatan
   ishlaydi. Xato faqat ISHGA TUSHGANDA paydo bo'ladi.

   ⚠ NEGA AYNAN HOZIR. Sahifalash butun tizim bo'ylab qo'llanyapti va
   har sahifada bir xil shakl takrorlanadi: hook'dan `rows`/`loading`
   olinadi, keyin ular ishlatiladi. Qatorlar joyi almashsa — bo'sh
   ekran. Bitta sahifada bu `scripts/check-audit.mjs` tutdi, qolgan
   o'ntasida tutadigan hech narsa yo'q edi.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   Funksiya tanasining ENG YUQORI darajasida (`{}` ichiga kirmagan)
   e'lon qilingan `const`/`let` nomlari. Har biri uchun: o'sha nom
   e'londan OLDIN va yana ENG YUQORI darajada o'qilganmi.

   ⚠ ATAYLAB TOR — `{}` ICHIDAGISI SANALMAYDI:

       const onSave = () => { ... rows ... };   // ← QONUNIY
       const { rows } = useInfinite(...);

   Bu TDZ emas: `onSave` KEYINROQ ishga tushadi, o'shanda `rows` bor.
   Shuning uchun figurali qavs ichidagi o'qish e'tiborga olinmaydi.
   Aksincha, `useCallback(fn, [rows])` dagi bog'liqlik ro'yxati
   DARHOL hisoblanadi — u qavs ichida emas, ya'ni tutiladi.

   Ishga tushirish:  node scripts/check-tdz.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walk(full);
  return /\.(js|jsx)$/.test(e.name) ? [full] : [];
});

/* ⚠ IZOH VA SATRLAR BO'SHLIQQA ALMASHADI, O'CHIRILMAYDI: qator va
   ustun raqamlari saqlanishi kerak, aks holda xato boshqa qatorni
   ko'rsatardi. Apostrof haqidagi ehtiyot `check-undefined.mjs` dagi
   bilan bir xil — o'zbekcha matnda `'` HARF («do'kon»), satr chegarasi
   emas, va u yutilib ketsa skript to'g'ri faylni xato deb ko'rsatardi. */
const blank = (s) => s.replace(/[^\n]/g, " ");
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
  .replace(/`(?:[^`\\]|\\.)*`/g, blank)
  .replace(/"(?:[^"\\\n]|\\.)*"/g, blank)
  .replace(/(^|[^A-Za-z0-9_$])'(?:[^'\\\n]|\\.)*'/gm, (m, p) => p + blank(m.slice(p.length)));

/* ══ ⚠ NAQSH (REGEX) — KOD EMAS ════════════════════════════════════════
   Birinchi urinishda naqshlar tozalanmagan edi va skript UCHTA
   to'g'ri faylni xato deb ko'rsatdi:

       const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(...);  → `\d` dagi «d»
       const unit = /\b(kg|кг)\b/i.test(raw) ? ...         → «kg»

   Ya'ni `\d` ni `d` nomining o'qilishi, `(kg|...)` ni `kg` ning
   o'qilishi deb oldi — ikkalasi ham keyinroq e'lon qilinadi.

   ⚠ BO'LISHDAN AJRATISH: `/` bo'lish belgisi ham. Naqsh faqat
   OPERATOR yoki qavs/vergul/`return` dan keyin boshlanadi; `a / b` da
   esa oldida NOM turadi. Shu farq yetarli va aynan shu sabab bu yerda
   to'liq JS tahlilchisi kerak emas. */
const RE_OK_BEFORE = /[(,=:[!&|?{};+\-*%~^<>]$|\b(?:return|typeof|case|in|of|new|delete|void|await|yield)$/;

function blankRegex(code) {
  const out = code.split("");
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== "/") continue;
    if (code[i + 1] === "/" || code[i + 1] === "*") continue;
    const before = code.slice(0, i).replace(/\s+$/, "");
    if (before && !RE_OK_BEFORE.test(before)) continue;

    let j = i + 1, cls = false, done = -1;
    for (; j < code.length && code[j] !== "\n"; j++) {
      if (code[j] === "\\") { j++; continue; }
      if (cls) { if (code[j] === "]") cls = false; continue; }
      if (code[j] === "[") { cls = true; continue; }
      if (code[j] === "/") { done = j; break; }
    }
    if (done < 0) continue;                       /* yopilmadi — bo'lish */
    while (done + 1 < code.length && /[a-z]/.test(code[done + 1])) done++;
    for (let k = i; k <= done; k++) out[k] = " ";
    i = done;
  }
  return out.join("");
}

/* ══ ⚠ O'Q FUNKSIYASINING ARGUMENTI — BOG'LANISH, O'QISH EMAS ══════════
   `rows.map((r, i) => …)` dagi `i` — YANGI nom. U pastda
   `for (let i = 0; …)` deb e'lon qilingan `i` bilan hech qanday
   aloqasi yo'q, lekin skript uni «e'londan oldin o'qilgan» deb oldi.
   Shuning uchun argument ro'yxatlari bo'shliqqa almashtiriladi. */
function blankArrowParams(code) {
  const out = code.split("");
  for (let i = 0; i + 1 < code.length; i++) {
    if (code[i] !== "=" || code[i + 1] !== ">") continue;
    let e = i - 1;
    while (e >= 0 && /\s/.test(code[e])) e--;
    if (e < 0) continue;
    if (code[e] === ")") {
      let depth = 0, s = e;
      for (; s >= 0; s--) {
        if (code[s] === ")") depth++;
        else if (code[s] === "(") { depth--; if (!depth) break; }
      }
      if (s < 0) continue;
      for (let k = s + 1; k < e; k++) if (code[k] !== "\n") out[k] = " ";
    } else {
      let s = e;
      while (s >= 0 && /[\w$]/.test(code[s])) s--;
      for (let k = s + 1; k <= e; k++) out[k] = " ";
    }
  }
  return out.join("");
}

/* Funksiya tanasi: ochilish `{` dan yopilishigacha. */
function bodyEnd(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") { depth--; if (!depth) return i; }
  }
  return code.length;
}

/** Har bir belgi uchun funksiya tanasiga nisbatan `{}` chuqurligi. */
function depths(code, from, to) {
  const d = new Int32Array(to - from);
  let cur = 0;
  for (let i = from; i < to; i++) {
    if (code[i] === "}") cur--;
    d[i - from] = cur;
    if (code[i] === "{") cur++;
  }
  return d;
}

/* ⚠ ENG YUQORI DARAJADAGI FUNKSIYALAR: komponentlar va hook'lar shu
   ko'rinishda yoziladi. Ichki funksiya tanasi ham shu oynaga tushadi,
   lekin u `{}` ichida — ya'ni chuqurligi 0 dan katta va sanalmaydi. */
const FN = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;

let bad = 0;
for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, "utf8");
  const code = blankArrowParams(blankRegex(strip(raw)));
  const lineOf = (off) => code.slice(0, off).split("\n").length;

  for (const fn of code.matchAll(FN)) {
    const open = code.indexOf("{", fn.index + fn[0].length - 1);
    const end = bodyEnd(code, open);
    const d = depths(code, open + 1, end);
    const at = (off) => d[off - open - 1];

    /* Tananing eng yuqori darajasidagi `const`/`let` e'lonlari. */
    const decls = [];
    for (const m of code.slice(open + 1, end).matchAll(/\b(const|let)\s+(\{[^}]*\}|\[[^\]]*\]|[A-Za-z_$][\w$]*)\s*=/g)) {
      const off = open + 1 + m.index;
      if (at(off) !== 0) continue;
      const names = [...m[2].matchAll(/[A-Za-z_$][\w$]*/g)].map((n) => n[0])
        /* `{ a: b }` da bog'lanadigan nom `b`; `{ a = 1 }` da `a`. */
        .filter((n) => !/^(true|false|null|undefined)$/.test(n));
      for (const n of names) decls.push({ name: n, off });
    }
    if (!decls.length) continue;

    const first = new Map();
    for (const dc of decls) if (!first.has(dc.name)) first.set(dc.name, dc.off);

    for (const [name, off] of first) {
      const win = code.slice(open + 1, off);
      const re = new RegExp(`(?<![.\\w$])${name}(?![\\w$])`, "g");
      for (const u of win.matchAll(re)) {
        const uoff = open + 1 + u.index;
        if (at(uoff) !== 0) continue;             /* `{}` ichida — qonuniy closure */
        /* ⚠ O'ZINI O'ZI SANAB QO'YMASIN: bir xil nom boshqa e'londa
           ham uchraydi (`const { rows } = …` dan keyin `const rows2`). */
        if (decls.some((dc) => dc.off === uoff)) continue;
        /* ══ ⚠ ICHKI FUNKSIYA TANASI — QONUNIY ══════════════════════
           `const freeStock = (p) => round3(...)` — `round3` pastda
           e'lon qilinsa ham bu XATO EMAS: `freeStock` keyinroq
           chaqiriladi, o'shanda `round3` bor. Qavssiz o'q tanasi
           `{}` bermaydi, ya'ni chuqurlik 0 bo'lib qoladi — shuning
           uchun gapning boshidan o'qishgacha `=>` yoki `function`
           bormi, shu qaraladi. */
        const stmt = win.slice(0, u.index);
        const head = stmt.slice(Math.max(stmt.lastIndexOf(";"),
                                Math.max(stmt.lastIndexOf("{"), stmt.lastIndexOf("}"))) + 1);
        if (/=>|\bfunction\b/.test(head)) continue;
        bad++;
        console.log(`  ❌ ${path.relative(ROOT, file)}:${lineOf(uoff)}`);
        console.log(`       \`${name}\` :${lineOf(uoff)} da o'qiladi, e'loni :${lineOf(off)} da`);
        console.log(`       → e'lon o'qishdan OLDIN turishi kerak, aks holda bo'sh ekran`);
        break;
      }
    }
  }
}

console.log(bad
  ? `\n  ${bad} ta nom e'londan oldin o'qiladi. Ishga tushganda ekran bo'sh qoladi.\n`
  : "  ✅ E'londan oldin o'qilgan nom yo'q (TDZ)\n");
process.exit(bad ? 1 : 0);
