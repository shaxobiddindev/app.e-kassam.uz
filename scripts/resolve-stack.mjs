/* ══════════════════════════════════════════════════════════════════════════
   STACK → MANBA FAYL VA QATOR (A3, 2026-10-12)

   «Ilova xatolari» dagi stack siqilgan koddan keladi:
       at Xt (https://app.e-kassam.uz/assets/SalesPage-CWzBhLfy.js:1:2345)
   Bu skript uni asl joyga aylantiradi:
       at loadSale  src/pages/SalesPage.jsx:212:18
         › const rows = res.data.map(…)

   ═══ NEGA MANBA XARITASI SAYTDA EMAS ═══════════════════════════════════

   O'lchandi: xaritalar har buildda ~7 MB (gzip'da 1.9 MB). `dist/` repoda
   turadi (Netlify o'zi qurmaydi) va desktop o'rnatuvchisiga ham kiradi —
   ya'ni har reliz git tarixiga 7 MB va har kassaga katta `.exe` bo'lardi.
   Shu bilan birga TEKSHIRILDI: `--sourcemap hidden` bilan build JS fayl
   NOMLARINI o'zgartirmaydi (xesh bir xil). Demak xaritani istalgan payt
   O'SHA commitdan qayta yasash mumkin — saqlash shart emas.

   ═══ QANDAY ═══════════════════════════════════════════════════════════

   1. Har qatordagi fayl nomi (`SalesPage-CWzBhLfy.js`) bo'yicha uni
      `dist/assets/` ga birinchi qo'shgan commit topiladi (`git log`).
      Topilmasa (desktop CI da qurgan, nomi farq qilsa) — `--version` dagi
      `desktop-vX.Y.Z` tegi sinab ko'riladi.
   2. O'sha commit vaqtinchalik `git worktree` ga olinadi — ILOVA PAPKASI
      ICHIDA (`.cache/ek-wt/`), shunda Node joriy `node_modules` ni o'zi
      yuqoridan topadi — va `vite build --sourcemap hidden`.
      ⚠⚠ JUNCTION ISHLATILMAYDI (2026-10-12 da qimmatga tushdi): birinchi
      variant worktree ichiga `node_modules` junction qo'yardi va
      `git worktree remove --force` havola ICHIGA kirib, HAQIQIY
      `node_modules/@babel` ni o'chirib yubordi («Filename too long» da
      to'xtadi). `npm ci` bilan tiklandi. Joriy ishchi papkadagi (hali
      commit qilinmagan) `dist` fayli bo'lsa — shu papkaning o'zidan quriladi.
      ⚠ Qurilgan fayl nomi stackdagisi bilan TENG bo'lishi tekshiriladi —
      bog'liqliklar o'sha commitdan beri o'zgargan bo'lsa, xesh boshqa
      chiqadi va noto'g'ri qator ko'rsatishdan ko'ra «topilmadi» deyiladi.
   3. Xaritalar keshlanadi (`.cache/ek-maps/<commit>`, git e'tiborsiz qoldiradi).

   Ishga tushirish (stack — admin panelidagi «Nusxalash» tugmasidan):
     node scripts/resolve-stack.mjs stack.txt
     node scripts/resolve-stack.mjs --version 1.15.62 < stack.txt
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SourceMapConsumer } from "source-map-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".cache", "ek-maps");
const WT = path.join(ROOT, ".cache", "ek-wt");
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const version = arg("version");
const fileArg = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--version");
const text = fileArg ? fs.readFileSync(fileArg, "utf8") : fs.readFileSync(0, "utf8");

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const FRAME = /(\/assets\/([A-Za-z0-9_.-]+\.js)):(\d+):(\d+)/;

/** Fayl nomini birinchi qo'shgan commit. */
function commitOf(file) {
  try { return git("log", "--all", "--diff-filter=A", "--format=%H", "-1", "--", `dist/assets/${file}`) || null; }
  catch { return null; }
}

const build = (cwd, out) => execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build",
  "--sourcemap", "hidden", "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: "inherit" });

/** Shu commitning xaritalari — keshdan yoki qayta qurib. */
function mapsFor(sha) {
  const out = path.join(CACHE, sha);
  if (fs.existsSync(path.join(out, ".ok"))) return out;
  const wt = path.join(WT, sha.slice(0, 10));
  console.error(`  … ${sha.slice(0, 10)} qurilmoqda (bir marta, keyin keshdan)`);
  try {
    if (!fs.existsSync(wt)) git("worktree", "add", "--detach", wt, sha);
    build(wt, out);
    fs.writeFileSync(path.join(out, ".ok"), sha);
  } finally {
    /* Worktree ichida havola YO'Q — o'chirish faqat o'sha papkaga tegadi. */
    try { git("worktree", "remove", "--force", wt); } catch { /* qoldiq — keyingi safar qayta ishlatiladi */ }
  }
  return out;
}

/** Hali commit qilinmagan joriy `dist` — ishchi papkaning o'zidan (keshlanmaydi). */
let localDir = null;
function localMaps() {
  if (!localDir) {
    localDir = path.join(CACHE, "local");
    console.error("  … ishchi papka qurilmoqda (commit qilinmagan dist)");
    build(ROOT, localDir);
  }
  return localDir;
}

const consumers = new Map();
function consumer(dir, file) {
  const p = path.join(dir, "assets", file + ".map");
  if (!fs.existsSync(p)) return null;
  if (!consumers.has(p)) consumers.set(p, new SourceMapConsumer(JSON.parse(fs.readFileSync(p, "utf8"))));
  return consumers.get(p);
}

const where = new Map();   // fayl → xaritalar papkasi yoki null
function dirFor(file) {
  if (where.has(file)) return where.get(file);
  const tries = [commitOf(file), version ? `desktop-v${version}` : null].filter(Boolean);
  let found = null;
  if (fs.existsSync(path.join(ROOT, "dist", "assets", file))) {
    const dir = localMaps();
    if (consumer(dir, file)) { where.set(file, dir); return dir; }
  }
  for (const ref of tries) {
    let sha;
    try { sha = git("rev-parse", `${ref}^{commit}`); } catch { continue; }
    const dir = mapsFor(sha);
    if (consumer(dir, file)) { found = dir; break; }
  }
  where.set(file, found);
  return found;
}

const short = (src) => String(src).replace(/^.*?(\/src\/|node_modules\/)/, (m, g) => (g === "/src/" ? "src/" : "nm/"));
const missing = new Set();

for (const line of text.split(/\r?\n/)) {
  const m = FRAME.exec(line);
  if (!m) { console.log(line); continue; }
  const [, , file, ln, col] = m;
  const dir = dirFor(file);
  const c = dir && consumer(dir, file);
  if (!c) { missing.add(file); console.log(line + "   ⟵ xarita topilmadi"); continue; }
  const o = c.originalPositionFor({ line: Number(ln), column: Number(col) - 1 });
  if (!o.source) { console.log(line + "   ⟵ joy topilmadi"); continue; }
  console.log(`    at ${o.name || "?"}  ${short(o.source)}:${o.line}:${(o.column ?? 0) + 1}`);
  const code = c.sourceContentFor(o.source, true)?.split(/\r?\n/)[o.line - 1];
  if (code) console.log(`      › ${code.trim().slice(0, 140)}`);
}

if (missing.size) {
  console.error(`\n  ⚠ ${missing.size} ta fayl uchun xarita yo'q: ${[...missing].join(", ")}`);
  console.error("    Desktop xatosi bo'lsa — `--version X.Y.Z` bering (desktop-vX.Y.Z tegi).");
}
