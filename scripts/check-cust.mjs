/* ══════════════════════════════════════════════════════════════════════════
   MIJOZLAR SAHIFASI — QAYSI RO'YXATDA QAYSI TUGMA
   ══════════════════════════════════════════════════════════════════════════

   ⚠ NEGA QO'RIQCHI KERAK. Bu joy ikki marta jimgina buzilgan:

     · `view === "all"` yozilgani uchun JAMG'ARMA ro'yxatida jamg'arma
       tugmasi yo'q edi — ro'yxat nima uchun ochilgan bo'lsa, aynan
       o'sha ish undan chiqib ketgandi;
     · qarzdorlarda bitta tugma qoldiqqa qarab goh «to'lash», goh
       «tarix» bo'lardi — ya'ni tarixni ochish uchun avval qarzni
       to'lash kerak edi.

   Ikkalasi ham kodga qarab BILINMAYDI: shart to'g'ri ko'rinadi,
   natijasi esa noto'g'ri. Shuning uchun kutilma shu yerda YOZIB
   QO'YILGAN va u kodning MA'NOSIGA solishtiriladi.

   ═══ KUTILMA ═════════════════════════════════════════════════════════

       ro'yxat     tugmalar
       ────────    ─────────────────────────────────────
       hammasi     tarix/to'lash · tahrirlash · jamg'arma
       jamg'arma   tarix · jamg'arma
       qarzdorlar  to'lash · tarix

   ═══ QANDAY TEKSHIRADI ═══════════════════════════════════════════════

   `&&` bilan o'ralgan tugmalar uchun: tugmani O'RAB TURGAN BARCHA
   `{view ... && (` shartlari topiladi (qavslar muvozanati bo'yicha,
   ya'ni ichma-ich o'rovchilar ham) va ularning KESISHMASI uchala
   `view` qiymati bilan hisoblanadi.

   ⚠ ILGARI FAQAT ENG YAQIN O'ROVCHI OLINARDI. Tahrirlash tugmasi
   ichma-ich shartga tushgach (`!== "debtors"` ichida `=== "all"`),
   eski usul jamg'arma tugmasiga TAHRIRLASHNING shartini bog'lab
   qo'yardi — qo'riqchining o'zi yolg'on javob berardi.

   Uchlik shart (`view === "debtors" ? … : …`) uchun tarmoq qavslar
   bo'yicha ajratiladi va ichidagi amallar tekshiriladi.

   Ishga tushirish:  node scripts/check-cust.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve(import.meta.dirname, "..", "src", "pages", "CustomersPage.jsx");
const src = fs.readFileSync(FILE, "utf8");
const VIEWS = ["all", "savings", "debtors"];

let bad = 0;
const fail = (msg) => { console.error("❌ " + msg); bad++; };

/* `(` dan boshlab muvozanatlashgan yopuvchi qavsni topadi. */
const matchParen = (open) => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
};

/* Berilgan o'rinni O'RAB TURGAN barcha `{view ... && (` shartlari. */
const enclosingConditions = (idx) => {
  const re = /\{\s*(view\s*[^\n]*?)\s*&&\s*\(/g;
  const conds = [];
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(open);
    if (open < idx && idx < close) conds.push(m[1]);
  }
  return conds;
};

/* Shartni haqiqiy `view` qiymati bilan hisoblaydi. */
const holds = (cond, view) => {
  try {
    // eslint-disable-next-line no-new-func
    return Boolean(new Function("view", `return (${cond});`)(view));
  } catch (e) {
    fail(`shartni hisoblab bo'lmadi: «${cond}» — ${e.message}`);
    return null;
  }
};

/* ═══ 1. `&&` bilan o'ralgan tugmalar ═══ */
const ACTIONS = [
  { call: "openEdit(c)",    want: { all: true, savings: false, debtors: false } },
  { call: "openSavings(c)", want: { all: true, savings: true,  debtors: false } },
];

for (const { call, want } of ACTIONS) {
  const idx = src.indexOf(call);
  if (idx < 0) { fail(`«${call}» topilmadi — tugma o'chib ketganmi?`); continue; }

  const conds = enclosingConditions(idx);
  if (!conds.length) { fail(`«${call}» hech qanday \`view\` sharti bilan o'ralmagan`); continue; }

  for (const view of VIEWS) {
    /* Kesishma: HAMMA o'rovchi shart rost bo'lsagina tugma chiziladi. */
    const shown = conds.every((c) => holds(c, view) === true);
    if (shown !== want[view]) {
      fail(`«${call}» — «${view}» ro'yxatida ${want[view] ? "BO'LISHI SHART" : "BO'LMASLIGI SHART"}, `
         + `lekin shartlar [${conds.join(" ] && [ ")}] «${shown}» beryapti`);
    }
  }
}

/* ═══ 2. Ro'yxatga xos tarmoqlar (uchlik shart) ═══ */
/**
 * Shu markerning TUGMALAR blokidagi tarmog'ini qaytaradi.
 *
 * ⚠ NEGA «BIRINCHISI» EMAS. `view === "debtors" ? (` faylda bir necha
 * marta uchraydi — jadval ustuni ham shu shart bilan chiziladi. Birinchi
 * uchraganini olganda qo'riqchi USTUN tanasini tekshirib, tugmalarni
 * umuman ko'rmasdi va «tugma yo'q» deb yolg'on baqirardi. Shuning uchun
 * tanasida `btn-icon` bo'lgan tarmoq tanlanadi.
 */
const branch = (marker) => {
  let from = 0, at;
  while ((at = src.indexOf(marker, from)) >= 0) {
    from = at + marker.length;
    const open = at + marker.length - 1;
    const close = matchParen(open);
    if (close < 0) continue;
    const body = src.slice(open, close);
    if (body.includes("btn-icon")) return body;
  }
  return null;
};

const BRANCHES = [
  {
    name: "qarzdorlar", marker: 'view === "debtors" ? (',
    must: ["openDebtPay(c)", "openDebt(c)"],
    mustNot: ["openEdit(c)", "openSavings(c)"],
  },
  {
    name: "jamg'arma", marker: 'view === "savings" ? (',
    must: ["openDebt(c)"],
    /* ⚠ To'lash bu ro'yxatning ishi emas — u «hammasi» va
       «qarzdorlar» da bor. */
    mustNot: ["openDebtPay(c)", "openEdit(c)"],
  },
];

for (const b of BRANCHES) {
  const body = branch(b.marker);
  if (body === null) { fail(`«${b.name}» tarmog'i topilmadi (${b.marker})`); continue; }
  for (const need of b.must) {
    if (!body.includes(need)) fail(`«${b.name}» ro'yxatida «${need}» yo'q`);
  }
  for (const no of b.mustNot) {
    if (body.includes(no)) fail(`«${b.name}» ro'yxatida ortiqcha «${no}» bor`);
  }
}

/* ═══ 3. ⚠ Qarzi yo'q mijozda tugma YASHIRILMAYDI, o'chiriladi ═══
   Qatorda tugmalar soni mijozdan mijozga o'zgarsa, qolganlari suriladi
   va kassirning barmog'i qo'shni amalga tushadi. */
const debtors = branch(BRANCHES[0].marker) || "";
if (!/disabled=\{!\(Number\(c\.balance\) > 0\)\}/.test(debtors)) {
  fail("qarzdorlarda «to'lash» tugmasi qoldiqqa qarab O'CHIRILISHI kerak (yashirilmasin)");
}

if (bad) { console.error(`\n${bad} ta muammo topildi.`); process.exit(1); }
console.log("✅ Mijozlar sahifasi: har ro'yxatda kerakli tugmalar joyida.");
