/* ══════════════════════════════════════════════════════════════════════════
   YOZUVLAR: O'LIK GURUHLAR YIG'ILIB QOLMASIN (V60)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Uchala til faylida 1652 tadan kalit bor edi va ularning 107 tasi
   ilovada UMUMAN ishlatilmasdi: `req` (arizalar), `twofa`, `signup`,
   `recovery`, `chart`, `export` — bularning hammasi admin paneli va
   auth ilovasiga tegishli, bu yerga esa nusxa ko'chirilganda kelib
   qolgan.

   Uchala tilda 321 kalit — bu bekorga yuklanadigan bayt va, undan ham
   yomoni, tarjimonning bekorga sarflagan vaqti: hech qayerda
   ko'rinmaydigan yozuvni uch tilga o'girish.

   ═══ NEGA BITTA KALIT EMAS, GURUH ═════════════════════════════════════

   ⚠ BITTA KALITNI tekshirish ISHONCHSIZ va bu sinab ko'rilgan:
   `ek-labels.js` da `dict("enum.payment", {...})` kalitlarni ISH
   PAYTIDA quradi, ya'ni `enum.payment.CASH` kodda hech qayerda
   yozilmagan. Bunday kalitlarni «o'lik» deb o'chirish kassirning
   ekraniga xom kalit chiqarardi.

   Guruh nomi esa BARIBIR kodda yoziladi — `dict("enum.payment"` da
   ham, `t(`enum.role.${x}`)` da ham. Shuning uchun tekshiruv GURUH
   darajasida: butun guruh hech qayerda tilga olinmagan bo'lsa, u
   rostdan ham keraksiz.

   Ishga tushirish:  node scripts/check-locales.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const f = path.join(d, e.name);
  return e.isDirectory() ? walk(f) : (/\.(js|jsx)$/.test(e.name) ? [f] : []);
});

const code = walk(SRC)
  .filter((f) => !f.includes(`${path.sep}locales${path.sep}`))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

const langs = ["uz", "ru", "en"];
const keysOf = (lang) => [...fs
  .readFileSync(path.join(SRC, "lib", "locales", `${lang}.js`), "utf8")
  .matchAll(/^\s*"([\w.]+)"\s*:/gm)].map((m) => m[1]);

/* ── 1. O'lik guruhlar ────────────────────────────────────────────── */
const groups = {};
for (const k of keysOf("uz")) (groups[k.split(".")[0]] ||= []).push(k);

const dead = Object.entries(groups).filter(([g]) =>
  !new RegExp(`["'\`]${g}\\.`).test(code) && !new RegExp(`["'\`]${g}["'\`]`).test(code));

/* ── 2. Tillar bir-biriga mos ─────────────────────────────────────── */
const base = new Set(keysOf("uz"));
const gaps = [];
for (const lang of langs.slice(1)) {
  const here = new Set(keysOf(lang));
  const missing = [...base].filter((k) => !here.has(k));
  const extra = [...here].filter((k) => !base.has(k));
  if (missing.length || extra.length) gaps.push([lang, missing, extra]);
}

/* ── 3. TAKRORLANGAN KALIT (V105) ─────────────────────────────────────
   ⚠ NEGA 2-BO'LIM BUNI KO'RMAGAN: u kalitlarni `new Set` ga soladi,
   Set esa takrorni O'ZI yutadi. Ya'ni qo'riqchining o'zida ko'r nuqta
   bor edi va u 15 ta takror kalitni yillar davomida o'tkazib yubordi.

   ⚠ NEGA MUHIM: obyekt literalida bir kalit ikki marta yozilsa,
   JavaScript XATO BERMAYDI — KEYINGISI oldingisini jimgina bosadi.
   Ya'ni tarjimon yozgan matn ekranga umuman chiqmaydi va buni
   bilishning yagona yo'li — ekranga qarab, boshqa matn turganini
   payqash. Topilgan 15 tadan olti tasida matn HAR XIL edi:
   `nav.audit` da «Audit» o'lik, «Jurnal» ko'rinardi. */
const dupsOf = (lang) => {
  const seen = new Map();
  for (const k of keysOf(lang)) seen.set(k, (seen.get(k) || 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
};
const dups = langs.map((l) => [l, dupsOf(l)]).filter(([, d]) => d.length);

let bad = 0;

if (dead.length) {
  bad++;
  console.log("  ❌ Hech qayerda ishlatilmaydigan guruhlar:");
  for (const [g, ks] of dead) console.log(`       ${g} — ${ks.length} kalit`);
  console.log("     Ular uchala tildan o'chirilishi kerak.");
} else {
  console.log("  ✅ Ishlatilmaydigan yozuv guruhi yo'q");
}

for (const [lang, missing, extra] of gaps) {
  bad++;
  console.log(`  ❌ ${lang}: yetishmaydi ${missing.length}, ortiqcha ${extra.length}`);
  for (const k of missing.slice(0, 5)) console.log(`       yo'q: ${k}`);
  for (const k of extra.slice(0, 5)) console.log(`       ortiqcha: ${k}`);
}
if (!gaps.length) console.log(`  ✅ Uchala til mos (${base.size} kalit)`);

for (const [lang, ks] of dups) {
  bad++;
  console.log(`  ❌ ${lang}: ${ks.length} ta kalit IKKI MARTA yozilgan —`
            + " oldingisi jimgina o'ladi:");
  for (const k of ks.slice(0, 10)) console.log(`       ${k}`);
}
if (!dups.length) console.log("  ✅ Takrorlangan kalit yo'q (uchala tilda)");

process.exit(bad ? 1 : 0);
