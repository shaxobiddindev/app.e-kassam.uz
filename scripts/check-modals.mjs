/* ══════════════════════════════════════════════════════════════════════════
   OYNALAR QOIDASI (V72)

   Do'kon egasi ikkita qoida qo'ydi:

     1. ORQA FONGA (bo'sh joyga) bosish oynani YOPMASIN — sensor
        ekranda barmoq oynaning chetiga tasodifan tegishi oddiy hol va
        o'shanda yarim to'ldirilgan forma yo'qolib ketardi.
     2. ESC HAR BIR oynada ishlasin — va faqat ENG USTIDAGISINI yopsin,
        ketma-ket ochilgan oynalar bittada yopilib ketmasin.

   ⚠ NEGA STATIK TEKSHIRUV. Bu qoida o'nlab fayldagi o'nlab oynaga
   tegishli va yangi oyna yozgan odam uni bilmasligi mumkin. Brauzer
   sinovi esa faqat OCHILGAN oynalarni ko'radi — kamdan-kam ochiladigan
   oyna (masalan xatolik oynasi) sinovdan chetda qolardi va qoida
   jimgina buzilardi.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/** `<Tag ...>` ochilish teglarini topadi (jingalak qavslarni hisobga olib). */
function openTags(src, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m;
  while ((m = re.exec(src))) {
    let depth = 0, i = m.index + m[0].length;
    while (i < src.length) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      i++;
    }
    out.push({ text: src.slice(m.index, i), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const problems = [];
const files = walk(SRC);

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  /* ── 1. Orqa fonni yopadigan ishlovchi ─────────────────────────────
     Ikki ko'rinishi bor: `e.target === e.currentTarget` tekshiruvi va
     `Overlay`/`.ov` ga to'g'ridan-to'g'ri qo'yilgan `onClick`. */
  for (const m of src.matchAll(/e\.target\s*===\s*e\.currentTarget/g)) {
    problems.push({
      rel, line: src.slice(0, m.index).split("\n").length,
      msg: "orqa fonga bosish oynani yopadi — bu qoida bekor qilingan",
    });
  }

  for (const tag of openTags(src, "Overlay")) {
    if (/\bonClick=/.test(tag.text)) {
      problems.push({ rel, line: tag.line, msg: "`Overlay` ga `onClick` qo'yilgan — orqa fon yopmasligi kerak" });
    }
    /* ── 2. ESC har oynada ─────────────────────────────────────────── */
    if (!/\bonEscape=/.test(tag.text)) {
      problems.push({ rel, line: tag.line, msg: "`Overlay` da `onEscape` yo'q — ESC ishlamaydi" });
    }
  }
}

if (problems.length) {
  console.log("\n  ❌ OYNALAR QOIDASI BUZILGAN:\n");
  for (const p of problems) console.log(`     ${p.rel}:${p.line} — ${p.msg}`);
  console.log("");
  process.exit(1);
}
console.log(`  ✅ Oynalar qoidasi: orqa fon yopmaydi, ESC hamma joyda (${files.length} fayl)`);
