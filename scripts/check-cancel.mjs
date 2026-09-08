/* ══════════════════════════════════════════════════════════════════════════
   BAJIK OYNASI BEKOR QILINGANDA TEXNIK MATN CHIQMASIN (V100)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Bajik talab qiladigan amal shunday oqimda ketadi:

     amal → server 428 → `guard` skanerlash oynasini ochadi
          → kassir «Bekor qilish» bosadi
          → `guard` MAXSUS belgi bilan rad etadi: `{cancelled: true}`

   ⚠ BEKOR QILISH — XATO EMAS. Odam fikridan qaytdi, xolos. Lekin
   chaqiruvchi buni farqlamasa, ekranda `BADGE_CANCELLED` degan
   TEXNIK matn qizil xabar bo'lib chiqadi. Kassir uni xato deb
   o'ylaydi, rahbarni chaqiradi va navbat kutadi — hech qanday
   nosozlik bo'lmagan holda.

   ⚠ BU SINF, BITTA XATO EMAS. `guard` bilan o'ralgan HAR bir yangi
   amal shu tuzoqqa tushadi va uni hech qanday sinov ushlamaydi:
   brauzer tekshiruvlari bajik oynasini odatda BEKOR QILMAYDI, ular
   muvaffaqiyatli yo'lni yuradi. V100 da to'rtta joyda topildi —
   uchtasi ancha oldin yozilgan edi va hech kim sezmagan.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   Har bir `try { … guard(…) … } catch (e) { … }` bloki:
   `catch` ichida `toast.error` bo'lsa, `cancelled` ham tekshirilishi
   SHART.

   ⚠ FAQAT `guard` BOR BLOKLAR. Oddiy `try/catch` larga tegilmaydi:
   ularda `cancelled` degan tushuncha umuman yo'q va talab qilish
   yuzlab yolg'on ogohlantirish berardi.

   Ishga tushirish:  node scripts/check-cancel.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { parseAst } from "rollup/parseAst";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const walkDir = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return walkDir(full);
  return /\.(js|jsx)$/.test(e.name) ? [full] : [];
});

/* Daraxtning har bir tuguni bo'ylab yuradi.
   ⚠ `value`/`raw` CHIQARILMAYDI: aynan shu xato `check-refs.mjs` da
   bir marta qo'riqchini jimgina teshib qo'ygan edi. */
const SKIP = new Set(["type", "start", "end", "loc", "range", "parent"]);
function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) walk(n, fn); return; }
  if (typeof node.type === "string") fn(node);
  for (const [k, v] of Object.entries(node)) {
    if (SKIP.has(k)) continue;
    if (v && typeof v === "object") walk(v, fn);
  }
}

/** Tugun ichida shu nomli chaqiruv bormi. */
const hasCall = (node, name) => {
  let found = false;
  walk(node, (n) => {
    if (n.type !== "CallExpression") return;
    const c = n.callee;
    if (c?.type === "Identifier" && c.name === name) found = true;
    if (c?.type === "MemberExpression" && c.property?.name === name) found = true;
  });
  return found;
};

/**
 * `guard(() => shopApi.createUser(...))` ichidagi API chaqiruvining
 * nomi.
 *
 * ⚠ FAYL NOMI YETARLI EMAS: bitta faylda beshtagacha `guard` bloki
 * bo'lishi mumkin va «ShopUsersPage.jsx» degan xabar dasturchini
 * yana qidirishga majbur qilardi. Satr raqami esa ishlamaydi —
 * daraxt JSX dan O'GIRILGAN koddan olinadi va raqamlar siljigan
 * bo'ladi.
 */
const guardedCallName = (node) => {
  let name = null;
  walk(node, (n) => {
    if (name || n.type !== "CallExpression") return;
    const c = n.callee;
    const isGuard = (c?.type === "Identifier" && c.name === "guard")
      || (c?.type === "MemberExpression" && c.property?.name === "guard");
    if (!isGuard) return;
    walk(n.arguments, (inner) => {
      if (name || inner.type !== "CallExpression") return;
      const ic = inner.callee;
      if (ic?.type === "MemberExpression" && ic.object?.name && ic.property?.name) {
        name = `${ic.object.name}.${ic.property.name}`;
      } else if (ic?.type === "Identifier") {
        name = ic.name;
      }
    });
  });
  return name;
};

/** Tugun ichida shu nom o'qiladimi (xossa nomi sifatida ham). */
const mentions = (node, name) => {
  let found = false;
  walk(node, (n) => {
    if (n.type === "Identifier" && n.name === name) found = true;
  });
  return found;
};

let checked = 0;
const bad = [];

for (const file of walkDir(SRC)) {
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.includes("guard(")) continue;

  let ast;
  try {
    const js = esbuild.transformSync(raw, {
      loader: "jsx", jsx: "automatic", format: "esm",
    }).code;
    ast = parseAst(js);
  } catch (e) {
    bad.push(`${path.relative(ROOT, file)} — o'qib bo'lmadi: ${e.message}`);
    continue;
  }

  walk(ast, (n) => {
    if (n.type !== "TryStatement" || !n.handler) return;
    if (!hasCall(n.block, "guard")) return;
    checked++;
    /* `toast.error` bo'lmasa — ko'rsatiladigan matn ham yo'q. */
    if (!hasCall(n.handler.body, "error")) return;
    if (mentions(n.handler.body, "cancelled")) return;
    const which = guardedCallName(n.block);
    bad.push(`${path.relative(ROOT, file)}${which ? ` → ${which}` : ""} — bajik `
      + `bekor qilinganda \`BADGE_CANCELLED\` matni chiqadi: `
      + `\`catch\` da \`err?.cancelled\` yo'q`);
  });
}

if (bad.length) {
  console.log(`  ❌ Bajik bekor qilinishi ${bad.length} joyda xato deb ko'rsatiladi:`);
  for (const b of bad) console.log(`     · ${b}`);
  process.exit(1);
}

/* ⚠ NOL TOPILSA — QO'RIQCHI O'LGAN. `guard` qayta nomlansa yoki
   tekshiruv sindirilsa, skript hech nimani ko'rmay yashil qolardi. */
if (checked === 0) {
  console.log("  ❌ Birorta `guard` bloki topilmadi — qo'riqchi ishlamayapti");
  process.exit(1);
}

console.log(`  ✅ ${checked} ta bajik amalida bekor qilish xato deb ko'rsatilmaydi`);
