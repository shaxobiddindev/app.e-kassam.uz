/* ══════════════════════════════════════════════════════════════════════════
   BIR ELEMENTDA TAKRORLANGAN ATRIBUT (V97)

   ⚠ HAQIQIY NUQSON USTIGA YOZILDI. `KassaPage.jsx` dagi qator narxi
   tugmasida IKKITA `title` turardi:

       title={item.discountAllowed === false ? t("products.discountHint") : undefined}
       onClick={...}
       title={t("kassa.linePrice")}

   JSX da keyingisi oldingisini JIMGINA yeb ketadi. Natijada «bu tovarga
   chegirma berilmaydi» degan izoh HECH QACHON ko'rinmasdi — kodning
   ustidagi izohda esa aynan «kassir buni OLDIN bilishi kerak» deb
   yozilgan edi.

   ⚠ NEGA UZOQ SEZILMADI. `vite build` buni faqat OGOHLANTIRISH qilib
   chiqaradi va yig'ish MUVAFFAQIYATLI tugaydi. Ogohlantirish yuzlab
   qator log orasida ko'rinmay ketadi. Shuning uchun bu yerda u
   XATOGA aylantiriladi.
   ══════════════════════════════════════════════════════════════════════════ */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".jsx")) out.push(p);
  }
  return out;
}

/* Ochilish teglarini topamiz: `<Xxx ... >` yoki `<xxx ... />`.
   Ichkaridagi `{...}` ifodalar tirnoq/qavs bilan tugamasligi mumkin,
   shuning uchun qavslar SANALADI. */
function openingTags(src) {
  const tags = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "<") continue;
    if (!/[A-Za-z]/.test(src[i + 1] || "")) continue;      // `</`, `<!--`, `a < b`
    let depth = 0, j = i + 1, inStr = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inStr) { if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      else if (c === "<" && depth === 0) { j = -1; break; }  // teg emas edi
    }
    if (j < 0 || j >= src.length) continue;
    tags.push({ text: src.slice(i, j), line: src.slice(0, i).split("\n").length });
    i = j;
  }
  return tags;
}

/* Atribut nomlari — FAQAT tepa qavat (`{}` ichidagi JSX o'z tegi bilan
   alohida topiladi). */
function attrNames(tag) {
  const names = [];
  let depth = 0, inStr = null;
  const body = tag.replace(/^<[A-Za-z][\w.:-]*/, (m) => " ".repeat(m.length));
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (depth !== 0) continue;
    const m = /^([A-Za-z][\w:-]*)\s*=/.exec(body.slice(i));
    if (m && (i === 0 || /\s/.test(body[i - 1]))) { names.push(m[1]); i += m[1].length; }
  }
  return names;
}

let bad = 0;
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  for (const tag of openingTags(src)) {
    const names = attrNames(tag.text);
    const seen = new Set(), dup = new Set();
    for (const nm of names) (seen.has(nm) ? dup : seen).add(nm);
    for (const nm of dup) {
      bad++;
      console.log(`❌ ${file}:${tag.line} — «${nm}» ikki marta: keyingisi oldingisini yeb ketadi`);
    }
  }
}

if (bad) {
  console.log(`\n   ${bad} ta takrorlangan atribut. JSX da keyingisi g'olib —`);
  console.log(`   birinchisi hech qachon ishlamaydi.\n`);
  process.exit(1);
}
console.log(`\n✅ Takrorlangan JSX atributi yo'q`);
