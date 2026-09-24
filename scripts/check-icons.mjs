/* ══════════════════════════════════════════════════════════════════════════
   KODDAGI HAR BIR IKONKA NOMI TO'PLAMDA BORMI

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Font Awesome nomi xato yozilsa yoki PULLIK to'plamdan olingan bo'lsa,
   brauzer hech narsa demaydi: `<i>` elementi joyida turadi, o'lchamini
   ham egallaydi, ichida esa HECH NARSA chizilmaydi. Konsol toza, xato
   yo'q, sinovlar yashil — tugmada shunchaki bo'sh joy.

   Ikkita bunday nom haqiqatan bor edi (2026-09-24 da topildi):

     fa-hand-holding-box   kassa · PickupPage — «Berish» tugmasi
     fa-shield-slash       admin · TwoFactorCard — «O'chirish» tugmasi

   Ikkalasi ham Font Awesome Pro dagi ikonkalar. Ular kodda qancha vaqt
   ko'rinmay turgani noma'lum — hech kim sezmasligi ham mumkin edi.

   ⚠ BU TEKSHIRUV SHRIFTLAR O'Z DOMENIMIZGA KO'CHGACH MUMKIN BO'LDI.
   Ilgari ikonkalar CDN'dan kelardi va koddan qaysi nom mavjudligini
   bilishning yo'li yo'q edi. Endi to'plam `public/fa/all.css` da va
   har bir kod nuqtasi shu faylda yozilgan.

   ═══ DINAMIK NOMLAR ═══════════════════════════════════════════════════

   `fa-chevron-${open ? "up" : "down"}` kabi nomlar ham tekshiriladi:
   `${…}` ichidagi matn qiymatlari olinadi va har biri prefiks bilan
   qo'shib qaraladi. Shunchaki o'tkazib yuborish xato bo'lardi —
   ro'yxatdagi bitta noto'g'ri qiymat jimgina bo'sh ikonka berardi.

   Ishga tushirish:  node scripts/check-icons.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = path.join(ROOT, "public/fa/all.css");

if (!fs.existsSync(CSS)) {
  console.error(`\n  ❌ ${path.relative(ROOT, CSS)} topilmadi.`);
  console.error("  Ikonkalar o'z domenimizdan keladi; fayl yo'q bo'lsa ular");
  console.error("  umuman chizilmaydi va bu tekshiruvning ham ma'nosi qolmaydi.\n");
  process.exit(1);
}

/* `.fa-bars,.fa-navicon{--fa:"\f0c9"}` — FA 6.7 shakli. */
const cssText = fs.readFileSync(CSS, "utf8");
const known = new Set();
for (const m of cssText.matchAll(/((?:\.fa-[a-z0-9-]+,?)+)\{--fa:"\\[0-9a-f]+"\}/g)) {
  for (const n of m[1].matchAll(/\.fa-([a-z0-9-]+)/g)) known.add("fa-" + n[1]);
}

/* ── Uslub klasslari — ikonka emas ─────────────────────────────────────
   ⚠ QO'LDA YOZILMAYDI (2026-09-24). Ilgari shu yerda qo'lda ro'yxat
   turardi va u TO'LIQ EMAS edi: `fa-1x`, `fa-2xl` yo'q edi. Ular
   ishlatilsa tekshiruv ularni ikonka deb o'ylab, «PRO to'plamda» degan
   YOLG'ON ayblov bilan yiqilardi. Ro'yxat to'rt nusxada ham turgan va
   nusxalar bir-biridan ajralib ketgan edi.

   Qoida oddiy va CSS ning o'zidan: `.fa-*` selektori bor, `--fa`
   qiymati yo'q → uslub klassi. */
const NOT_ICON = new Set(["fa-solid", "fa-regular", "fa-brands", "fa-classic"]);
for (const m of cssText.matchAll(/\.fa-([a-z0-9-]+)\b/g)) {
  const n = "fa-" + m[1];
  if (!known.has(n)) NOT_ICON.add(n);
}

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o;
  for (const it of fs.readdirSync(d, { withFileTypes: true })) {
    if (it.name === "node_modules" || it.name === "dist") continue;
    const p = path.join(d, it.name);
    if (it.isDirectory()) walk(p, o);
    else if (/\.(jsx?|html)$/.test(it.name)) o.push(p);
  }
  return o;
};

const files = walk(path.join(ROOT, "src"));
const html = path.join(ROOT, "index.html");
if (fs.existsSync(html)) files.push(html);

const missing = new Map();   // nom → birinchi uchragan joy
const seen = new Set();
let dynamic = 0;
const note = (name, file) => {
  seen.add(name);
  if (known.has(name)) return;
  if (!missing.has(name)) missing.set(name, path.relative(ROOT, file));
};

/**
 * Izohlar olib tashlanadi.
 *
 * ⚠ SHART, VA BUNI QO'RIQCHINING O'ZI KO'RSATDI: pulli ikonka
 * tuzatilgach, tuzatish yonidagi «`fa-hand-holding-box` EMAS» degan
 * IZOH tekshiruvni yiqitib turdi. Izohda yozilgan nom hech qayerga
 * chizilmaydi, ya'ni u xato emas.
 *
 * ⚠ `//` FAQAT QATOR BOSHIDA qirqiladi. Matn ichidagi `https://` ni
 * izoh deb qirqsak, o'sha qatordagi haqiqiy ikonka nomi ko'rinmay
 * qolardi — ya'ni qo'riqchi jimgina yarim ishlab qolardi.
 */
const stripComments = (s) => s
  /* ⚠ HTML IZOHI HAM — va buni qo'riqchining o'zi ko'rsatdi: `index.html`
     dagi izoh `fa-caret-${...}` ni eslatib turardi va tekshiruv uni
     ISHLATILGAN nom deb hisoblardi. Zarari shu bilan tugamaydi: izohda
     eslatilgan PULLIK nom qo'riqchini bekordan-bekorga yiqitardi. */
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");

for (const f of files) {
  const src = stripComments(fs.readFileSync(f, "utf8"));

  /* ── Dinamik nomlar: prefiks + `${…}` ichidagi har bir matn qiymati ── */
  for (const m of src.matchAll(/(fa-[a-z0-9-]*)\$\{([^}]*)\}/g)) {
    const [, prefix, expr] = m;
    const parts = [...expr.matchAll(/["'`]([a-z0-9-]+)["'`]/g)].map((x) => x[1]);
    /* Qiymatlar o'zgaruvchidan kelsa (matn emas) — tekshirib bo'lmaydi.
       Jimgina o'tkazib yuboramiz, lekin sonini ko'rsatamiz: qo'riqchi
       nimani KO'RMAGANINI aytishi kerak. */
    if (!parts.length) { dynamic++; continue; }
    for (const p of parts) note(prefix + p, f);
  }

  /* ── Oddiy nomlar ──────────────────────────────────────────────────── */
  /* ⚠ `(?<!-)`: `--fa-style`, `--fa-display` kabi Font Awesome'ning
     RASMIY sozlash o'zgaruvchilari ham `fa-` bilan boshlanadi. Ikonka
     deb o'qilsa tekshiruv yolg'on ayblov bilan yiqilardi. */
  for (const m of src.matchAll(/(?<!-)\bfa-[a-z0-9-]*/g)) {
    const n = m[0];
    /* Chizig'i bilan tugagan bo'lak — yuqoridagi dinamik nomning
       prefiksi, o'zi ikonka emas. */
    if (n.endsWith("-") || NOT_ICON.has(n)) continue;
    note(n, f);
  }
}

console.log(`\n═══ Ikonka nomlari ═══\n`);
console.log(`  To'plamda: ${known.size} nom · kodda ishlatilgan: ${seen.size}` +
            (dynamic ? ` · o'zgaruvchidan yasalgan: ${dynamic}` : ""));

if (missing.size) {
  console.error(`\n  ❌ ${missing.size} ta nom to'plamda YO'Q:\n`);
  for (const [n, f] of missing) console.error(`       ${n.padEnd(28)} ${f}`);
  console.error("\n  Bunday nom hech qanday xato bermaydi — tugmada shunchaki");
  console.error("  bo'sh joy qoladi. Ko'pincha sabab: nom Font Awesome PRO da.");
  console.error("  Bepul muqobilini toping yoki nomdagi xatoni tuzating.\n");
  process.exit(1);
}
console.log("\n  ✅ Har bir ikonka nomi to'plamda bor.\n");
