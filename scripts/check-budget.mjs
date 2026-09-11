/* ══════════════════════════════════════════════════════════════════════════
   BANDL BYUDJETI — qurilgan fayllar belgilangan hajmdan oshmasin.

   ⚠ NEGA KERAK. 08-ROADMAP.md da har ilova uchun byudjet yozilgan
   (`docs/09-CHETLANISHLAR.md` §10 jadvali), lekin uni HECH KIM
   o'lchamasdi: raqamlar qo'lda, bir marta yozilgan va eskirgan. Bitta
   e'tiborsiz `import` (masalan butun grafik kutubxonasi) bandlni ikki
   barobar oshirib yuborishi mumkin — bu 4G ulanishdagi kassir uchun
   qo'shimcha soniyalar demak, lekin ishlab chiqishda umuman bilinmaydi.

   Byudjet `size-budget.json` da. Oshib ketsa CI YIQILADI: raqamni
   ko'tarish — ONGLI qaror bo'lishi kerak, tasodifiy emas.

   Ishga tushirish:  node scripts/check-budget.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist", "assets");
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, "size-budget.json"), "utf8"));

if (!fs.existsSync(DIST)) {
  console.error("dist/assets topilmadi — avval `npm run build`.");
  process.exit(1);
}

const files = fs.readdirSync(DIST);
const gz = (f) => gzipSync(fs.readFileSync(path.join(DIST, f))).length;
const sum = (ext) => files.filter((f) => f.endsWith(ext)).reduce((n, f) => n + gz(f), 0);

/* ⚠ KIRISH TO'PLAMI ALOHIDA O'LCHANADI (2026-08-27).

   Ilova marshrutlar bo'yicha bo'lingandan keyin «hamma faylning
   yig'indisi» yuqoridagi maqsadni O'LCHAMAY QO'YDI: chunklarning ko'pi
   birinchi ochilishda umuman yuklanmaydi. Aksincha, bo'lish umumiy
   hajmni bir oz OSHIRADI (har chunkning o'z yuki bor) — ya'ni eski
   o'lchov bo'yicha to'g'ri qilingan ish «yomonlashish» bo'lib ko'rinardi.

   Endi ikkita raqam bor va IKKALASI HAM majburiy:

     KIRISH — `index.html` so'raydigan to'plam va uslub. Aynan shuni
              kassir har ochilishda kutadi. Sarlavhadagi «4G dagi
              qo'shimcha soniyalar» — shu raqam.

     JAMI   — hamma JS. Kirish raqami yaxshi ko'rinsin deb kodni
              cheksiz ko'paytirishning oldini oladi: bo'lish bahona
              bo'lib qolmasin.

   Kirish fayli `dist/index.html` dan o'qiladi — build qanday nomlashidan
   qat'i nazar to'g'ri topiladi. */
const html = fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf8");
const pick = (re) => {
  const m = html.match(re);
  return m && files.includes(m[1]) ? gz(m[1]) : 0;
};
const entry = pick(/\/assets\/([A-Za-z0-9_.-]+\.js)/) + pick(/\/assets\/([A-Za-z0-9_.-]+\.css)/);

/* ⚠ TARJIMA — KOD EMAS (V60).

   Ilova uch tilda va har til o'z bo'lagida (`ru-*.js`, `en-*.js`).
   Do'kon BITTA tilda ishlaydi, ya'ni foydalanuvchi ularning faqat
   bittasini yuklaydi — qolgani diskda yotadi va hech qachon tarmoqqa
   chiqmaydi.

   «JAMI JS» ilgari ularni ham sanardi va bu o'lchovni buzardi:
   byudjet chegarasiga yetganda «kodni kamaytir» degan signal
   kelardi-yu, aslida o'sgani TARJIMA edi. Ya'ni o'lchov tarjima
   ishini jazolardi, holbuki uning maqsadi — KOD cheksiz o'smasin
   degan qoida.

   Endi ular alohida sanaladi va o'z byudjeti bor. «Jami kod» esa
   o'z ishini qiladi: bo'lish kodni ko'paytirishga bahona bo'lmasin.

   ⚠ O'ZBEKCHA BU YERDA YO'Q: u kirish to'plamining ichida (statik) va
   allaqachon KIRISH raqamida sanalgan. */
const isLang = (f) => /^(ru|en)-[A-Za-z0-9_-]+\.js$/.test(f);
const langBytes = files.filter(isLang).reduce((n, f) => n + gz(f), 0);

const kb = (n) => Math.round(n / 1024);
const results = [
  ["KIRISH   (gzip)", kb(entry),                    budget.entryKb],
  ["JAMI KOD (gzip)", kb(sum(".js") - langBytes),   budget.jsKb],
  ["TILLAR   (gzip)", kb(langBytes),                budget.langKb],
  ["CSS      (gzip)", kb(sum(".css")),              budget.cssKb],
];

let failed = false;
for (const [label, actual, limit] of results) {
  const over = actual > limit;
  failed ||= over;
  const bar = over ? "❌" : "✅";
  console.log(`  ${bar} ${label}: ${actual} KB / ${limit} KB`);
}

if (failed) {
  console.error(
    "\nByudjet oshib ketdi. Ikki yo'l bor:\n" +
    "  1. Sababini toping (yangi kutubxona? kechiktirilmagan import?);\n" +
    "  2. Byudjet haqiqatan o'zgarishi kerak bo'lsa — `size-budget.json`\n" +
    "     ni ONGLI ravishda yangilang va sababini commit xabarida yozing."
  );
  process.exit(1);
}
console.log("\n  Byudjet ichida.");
