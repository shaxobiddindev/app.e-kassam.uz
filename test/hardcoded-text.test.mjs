/* ══════════════════════════════════════════════════════════════════════════
   QOTIRILGAN MATN — XODIM EKRANLARIDA TAQIQLANADI

   ⚠ NEGA QO'RIQCHI KERAK. Matnni lug'atga ko'chirish bir martalik ish;
   uni QAYTIB KELISHIDAN saqlash esa doimiy. Bugungi misol aniq:
   `kassa.sellAndPrint` va `kassa.processing` kalitlari uchala tilda
   YOZILGAN edi va hech qayerda ishlatilmasdi — to'lov oynasidagi
   tugma ularni chetlab o'tib, o'zbekcha matnni qotirib qo'ygan edi.
   Kalit bor, tarjima bor, foyda yo'q.

   `check-locales` buni ushlay olmaydi: u «chaqirilgan kalit lug'atda
   bormi» deb tekshiradi, teskarisini emas.

   ⚠ DOIRA ATAYLAB TOR. Faqat `src/pages` va `src/components`, ya'ni
   xodim ko'radigan ekranlar. Butun `src/` ga yoyilsa qo'riqchi shovqin
   chiqarardi (test fikstura, ishlab chiqish yordamchilari, klaviatura
   belgilarining o'zi) va uni bir haftada o'chirib tashlashardi.

   Ishga tushirish:  node test/hardcoded-text.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/* ── Chetlatish ro'yxati ───────────────────────────────────────────────
   Har qator ONGLI qadam: NOMI, SABABI va MUDDATI.

   ⚠ Bu ro'yxat jimgina o'smasin — hajmi pastda chop etiladi. */
const EXEMPT = [
  // [fayl bo'lagi, matn, sabab]
  ["components/ek/CommandPalette.jsx", "Enter", "klaviatura belgisi — tarjima qilinmaydi"],
  ["components/ek/CommandPalette.jsx", "Esc",   "klaviatura belgisi"],
  ["components/ek/Loading.jsx",        "Esc",   "klaviatura belgisi"],
  ["components/QuantityModal.jsx",     "Esc",   "klaviatura belgisi"],
  ["components/QuantityModal.jsx",     "Enter", "klaviatura belgisi"],
  ["pages/KassaPage.jsx",              "Esc",   "klaviatura belgisi"],
  ["pages/DashboardPage.jsx",          "Ctrl",  "klaviatura belgisi"],
  ["pages/LoginPage.jsx",              "e-Kassam", "brend nomi — tarjima qilinmaydi"],
  ["components/EkIntro.jsx",           "Kassa va CRM tizimi",
   "brend shiori; MUDDAT: mijoz tomoni bilan birga (7-qadam qoldig'i)"],
  ["pages/ProductsPage.jsx",           "tasnif.soliq.uz", "tashqi manzil"],
];

/* Klaviatura belgilari va brend — umumiy qoida sifatida ham o'tadi. */
const ALWAYS_OK = new Set(["Esc", "Enter", "Ctrl", "Alt", "Shift", "Tab", "F9",
                           "e-Kassam", "e-kassam.uz", "MXIK", "QQS", "PLU", "QR"]);

const ROOTS = ["src/pages", "src/components", "src/customer", "src/portal"];
/* ⚠ MIJOZ TOMONI HAM KIRADI (2026-09-12 dan). Ilgari u doiradan
   tashqarida edi: u yerda 90 dan ortiq satr qotirilgan bo'lib,
   qo'riqchi birinchi kunidanoq qizil bo'lardi — bunday qo'riqchini
   bir haftada o'chirishadi. Endi o'sha satrlar lug'atga ko'chirildi
   va doira kengaytirildi: `customer/` va `portal/` ham qo'riqlanadi. */
const SKIP_DIRS = new Set();

const files = [];
for (const root of ROOTS) {
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(e)) walk(p); }
      else if (p.endsWith(".jsx")) files.push(p.split(sep).join("/"));
    }
  })(root);
}

/* JSX matn tuguni: >...< orasida, ichida {} yo'q. */
const NODE = />([^<>{}]{2,120})</g;
const LETTERS = /[A-Za-zА-Яа-яЎўҚқҒғҲҳ]{2,}/;
/* Kod bo'lagi — matn emas. Har qanday `nom(` eng keng to'r:
   `Number(x)` kabi ifodalar JSX ichida `>` va `<` orasida qolib
   ketishi mumkin. */
const CODEY = /&&|===|!==|\?\?|=>|\w+\(|\|\||\+\+|return |const | \? /;

/* Manzil va URL bo'lagi — tarjima qilinmaydi. */
const URLISH = /^[\w.-]+\.(uz|com|ru|net|org)$|^\?\w+=|^https?:/;

let pass = 0, fail = 0;
const hits = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  /* ⚠ KO'P QATORLI IZOH KUZATILADI. Faqat `*` bilan boshlanadigan
     qatorni tashlash yetmaydi: bu repoda izohlar uzun va ularning
     davomi oddiy matn bilan boshlanadi. Usiz qo'riqchi O'Z izohlarini
     «tarjimasiz matn» deb ko'rsatardi — va bir haftada o'chirilardi. */
  let inBlock = false;
  src.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    const opens = line.lastIndexOf("/*");
    const closes = line.lastIndexOf("*/");
    const wasInBlock = inBlock;
    if (!inBlock && opens !== -1 && closes < opens) inBlock = true;
    else if (inBlock && closes !== -1) inBlock = false;
    if (wasInBlock || inBlock) return;
    if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return;
    let m;
    NODE.lastIndex = 0;
    while ((m = NODE.exec(line))) {
      const txt = m[1].trim();
      if (!txt || !LETTERS.test(txt) || CODEY.test(txt)) continue;
      if (ALWAYS_OK.has(txt) || URLISH.test(txt)) continue;
      if (EXEMPT.some(([file, text]) => f.endsWith(file) && txt === text)) continue;
      hits.push({ f, line: i + 1, txt });
    }
  });
}

console.log("\n═══ Qotirilgan matn — xodim ekranlarida ═══\n");
console.log(`  Tekshirildi: ${files.length} fayl (${ROOTS.join(", ")})`);
console.log(`  Chetlatish ro'yxatida: ${EXEMPT.length} band\n`);

if (hits.length === 0) {
  pass++;
  console.log("  ✅ Qotirilgan matn topilmadi");
} else {
  fail++;
  console.log("  ❌ Lug'atdan tashqaridagi matn:");
  for (const h of hits) console.log(`     ${h.f}:${h.line}  «${h.txt}»`);
  console.log("\n     Ularni `src/lib/locales/{uz,ru,en}.js` ga ko'chiring va");
  console.log("     `t(\"kalit\")` bilan chaqiring. Klaviatura belgisi yoki brend");
  console.log("     nomi bo'lsa — yuqoridagi `EXEMPT` ga SABABI bilan yozing.");
}

/* ══ 2-BO'LIM: `t()` chaqiriladi, lekin IMPORT QILINMAGAN ══════════════
   ⚠ BU BUILD DAN O'TADI. Vite `t` ni tashqi nom deb hisoblaydi va jim
   o'tkazadi; komponent esa faqat CHIZILGANDA `ReferenceError` bilan
   yiqiladi — ya'ni nosozlik foydalanuvchining ekranida chiqadi,
   ishlab chiquvchining terminalida emas.

   Bu bir necha soat ichida UCH MARTA sodir bo'ldi (`CodeZoom`,
   `CustomerLogin`, `CustomerWeb`) — ya'ni tasodif emas, sinf.

   Doira KENGROQ: butun `src/`, chunki tekshiruv aniq va shovqinsiz. */
const ALL = [];
(function walkAll(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkAll(p);
    else if (p.endsWith(".jsx") || p.endsWith(".js")) ALL.push(p.split(sep).join("/"));
  }
})("src");

const missingImport = [];
for (const file of ALL) {
  const src = readFileSync(file, "utf8");
  if (!/[^\w.]t\(\s*["'`]/.test(src)) continue;
  /* Yo'l kengaytma bilan ham bo'lishi mumkin: `./ek-i18n.js`. */
  if (/from ['"][^'"]*ek-i18n(\.js)?['"]/.test(src)) continue;
  if (/(const|let|var|function)\s+t\b/.test(src)) continue;
  if (file.endsWith("lib/ek-i18n.js")) continue;
  missingImport.push(file);
}

console.log("\n═══ `t()` chaqirilgan, lekin import qilinmagan ═══\n");
if (missingImport.length === 0) {
  pass++;
  console.log("  ✅ Har bir fayl `t` ni import qilgan");
} else {
  fail++;
  console.log("  ❌ Import yetishmaydi:");
  for (const m of missingImport) console.log("     " + m);
  console.log("\n     Build bunday xatoni O'TKAZIB YUBORADI — u faqat");
  console.log("     komponent chizilganda ko'rinadi.");
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
