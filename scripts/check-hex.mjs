/* ══════════════════════════════════════════════════════════════════════════
   XOM HEX QOROVULI (C2, 2026-10-12)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   `CLAUDE.md` 1-qoida: dizayn tokenlaridan tashqarida rang yozilmaydi.
   Xom `#fff` qorong'i rejimda ham o'sha rangda qoladi va brend o'zgarsa
   eskirib qoladi — `NotFound` sahifasida ESKI brend ko'ki `#017dca` turgan
   edi, `ShiftBar` dagi och sariq ogohlantirish qorong'i rejimda dog' edi.
   `check-tokens` faqat `var(...)` ni ko'radi — xom hexni hech narsa
   tekshirmasdi.

   ═══ QONUNIY HOLATLAR — IZOH BILAN ════════════════════════════════════

   Ba'zi joyda token NOTO'G'RI bo'lardi: chek qog'ozi qorong'i rejimda ham
   oq, QR/barkod foni oq bo'lmasa skaner o'qimaydi, chop etiladigan hujjat
   ilovaning CSS'isiz ochiladi. Ular taqiqlanmaydi, lekin SABABI yozilishi
   shart:
     · CSS qoidasi ichida «hex: sabab» izohi — butun qoida uchun;
     · JS/JSX qatorida «// hex: sabab» izohi;
     · `--token: #...` e'loni va `@media print { … }` bloki — o'z-o'zidan;
     · butun fayl — pastdagi `FILES` ro'yxati (hujjat va chop etish modullari).
   Sababsiz yangi hex — CI yiqiladi.

   Ishga tushirish:  node scripts/check-hex.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

/** Butunlay ruxsat etilgan fayllar — sababi bilan. */
const FILES = {
  "src/styles/": "packages/ dan nusxa — token e'lonlari va umumiy komponentlar (o'z qorovuli bor)",
  "src/lib/ek-label-": "yorliq/stiker chizish — printerga ketadigan oq-qora hujjat",
  "src/lib/ek-receipt-pdf.js": "chek PDF — ilova CSS'isiz hujjat",
  "src/lib/ek-hardware.js": "chek/oshxona HTML'i — printer oynasida, tokensiz",
  "src/lib/ek-barcode": "barkod SVG — skaner uchun qora-oq",
  "src/lib/ek-qr.js": "QR SVG — skaner uchun qora-oq",
  "src/lib/ek-theme.js": "<meta name=theme-color> — brauzer faqat hex qabul qiladi",
  "src/lib/ek-statusbar.js": "Android status bar rangi — faqat hex",
  "src/components/QrPoster.jsx": "chop etiladigan QR plakat (mm o'lchovli hujjat)",
  "src/components/BadgeCard.jsx": "chop etiladigan bajik kartasi",
  "src/components/StatementModal.jsx": "chop etiladigan akt-sverka (alohida oyna)",
};

const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.(css|jsx?)$/.test(e.name)) o.push(p);
  }
  return o;
};
const HEX = /(?<![\w&-])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g;
const bad = [];

for (const f of walk(SRC)) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (Object.keys(FILES).some((k) => rel.startsWith(k))) continue;
  const text = fs.readFileSync(f, "utf8");
  if (f.endsWith(".css")) checkCss(rel, text); else checkJs(rel, text);
}

/** JS/JSX: qatorda `hex:` izohi bo'lsa — ruxsat; izoh ichidagi hex hisobga olinmaydi. */
function checkJs(rel, text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => (/hex:/.test(m) ? "/*hex:*/" + m.replace(/[^\n]/g, " ").slice(8) : m.replace(/[^\n]/g, " ")));
  noBlock.split("\n").forEach((line, i) => {
    if (/^\s*\/\//.test(line) || /hex:/.test(line)) return;
    const code = line.replace(/\/\/.*$/, "");
    for (const m of code.matchAll(HEX)) bad.push(`${rel}:${i + 1}  ${m[0]}  ${line.trim().slice(0, 100)}`);
  });
}

/**
 * CSS: har bir hex uchun uni o'rab turgan qoida topiladi. Qoidada `hex:`
 * izohi bo'lsa yoki u `@media print` ichida bo'lsa — ruxsat. `--x: #…` —
 * token e'loni, ruxsat.
 */
function checkCss(rel, text) {
  const blocks = [];          // {start, end, head}
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 1; continue; }
    if (c === "{") {
      const prev = Math.max(text.lastIndexOf("}", i - 1), text.lastIndexOf(";", i - 1), text.lastIndexOf("{", i - 1));
      stack.push({ start: i, head: text.slice(prev + 1, i) });
    } else if (c === "}") {
      const b = stack.pop();
      if (b) blocks.push({ ...b, end: i });
    }
  }
  const lineOf = (pos) => text.slice(0, pos).split("\n").length;
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  for (const m of stripped.matchAll(HEX)) {
    const pos = m.index;
    const lineStart = stripped.lastIndexOf("\n", pos) + 1;
    const decl = stripped.slice(Math.max(stripped.lastIndexOf(";", pos), stripped.lastIndexOf("{", pos)) + 1, pos);
    if (/^\s*--[\w-]+\s*:/.test(decl)) continue;                       // token e'loni
    const around = blocks.filter((b) => b.start < pos && pos < b.end);
    if (around.some((b) => /@media[^{]*print/.test(b.head))) continue;  // chop etish
    const inner = around.sort((a, b) => b.start - a.start)[0];
    if (inner && /hex:/.test(text.slice(inner.start, inner.end))) continue;
    if (inner && /hex:/.test(inner.head)) continue;
    bad.push(`${rel}:${lineOf(pos)}  ${m[0]}  ${stripped.slice(lineStart, stripped.indexOf("\n", pos)).trim().slice(0, 100)}`);
  }
}

if (bad.length) {
  console.error(`\n❌ XOM HEX — token o'rniga qattiq rang (${bad.length} ta):`);
  for (const b of bad) console.error("   " + b);
  console.error(
    "\nTuzatish: semantik token yozing (`var(--fg-on-brand)`, `var(--bg-warning-subtle)` …).\n" +
    "Rang ATAYLAB qattiq bo'lsa (qog'oz, QR foni, brend belgisi) — sababini yozing:\n" +
    "  CSS qoidasi ichida /* hex: sabab */, JS qatorida // hex: sabab\n");
  process.exit(1);
}
console.log("✅ Xom hex: hammasi token yoki sababi yozilgan.");
