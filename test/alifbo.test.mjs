/* ══════════════════════════════════════════════════════════════════════════
   YANGI ALIFBO QO'RIQCHISI (2026-10-22, docs/09 §10ƫ)

   Interfeys yangi o'zbek alifbosida (OʻRQ–1184): sh → ş, ch → ç,
   oʻ → ö, gʻ → ğ. Yangi kalit odat bo'yicha eski yozuvda qo'shilsa, ekranda
   ikki alifbo aralashib qolardi — bu sinov o'zbekcha lokallarda eski harfni
   ushlaydi.

   ⚠ Istisno — inglizcha qolgan so'zlar (brend, texnik atama). Ro'yxatga
   qo'shishdan oldin o'ylang: «chek», «shtrix», «chat», «keshbek» kabi
   O'ZBEKCHA talaffuzdagi o'zlashmalar yangi alifboda ç/ş bilan yoziladi.

   ⚠ Do'kon ma'lumoti (tovar, mijoz nomi) bu yerda emas va o'girilmaydi —
   qidiruv ikkala alifboni bitta kalitga tushiradi (`ek-search.js`, V168).

   Ishga tushirish:  node test/alifbo.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import uz from "../src/lib/locales/uz.js";
import fs from "node:fs";

const KEEP = new Set(["Chrome", "Dashboard", "Push", "Shop", "shop", "Shift", "Humo", "HUMO"]);
const OLD = /[A-Za-z]*(?:sh|ch|[oOgG]['ʻ’‘](?=[A-Za-z]|$))[A-Za-z]*/gi;

/* `ek-rest-words.js` — uch til bitta faylda; faqat `const uz = { … }` bo'lagi. */
function restUz() {
  const src = fs.readFileSync(new URL("../src/lib/ek-rest-words.js", import.meta.url), "utf8");
  const m = /const uz = \{([\s\S]*?)\n\};/.exec(src);
  const out = {};
  for (const r of (m?.[1] || "").matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/gm)) out[r[1]] = r[2];
  return out;
}

let bad = 0;
for (const [src, dict] of [["uz.js", uz], ["ek-rest-words.js", restUz()]]) {
  for (const [k, v] of Object.entries(dict)) {
    const text = String(v).replace(/\{[^}]*\}/g, " ").replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ");
    const hits = (text.match(OLD) || []).filter((w) => !KEEP.has(w));
    if (hits.length) {
      bad++;
      if (bad <= 20) console.log(`  ❌ ${src} «${k}»: ${hits.join(", ")}  —  ${String(v).slice(0, 80)}`);
    }
  }
}
console.log(bad ? `\n❌ ${bad} ta qiymatda eski alifbo qoldi` : "  ✅ o'zbekcha lokallarda eski alifbo yo'q");
process.exit(bad ? 1 : 0);
