/* ══════════════════════════════════════════════════════════════════════════
   MIJOZLAR RO'YXATI: QATOR AMALLARI RO'YXAT NOMIGA EMAS,
   MA'LUMOTGA QARAB CHIQSIN (V105)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   Sahifada uchta ro'yxat bor: «Barchasi», «Qarzdorlar», «Mijoz
   jamg'armasi». Qator oxiridagi amal tugmalari — tahrirlash va
   JAMG'ARMA — `view === "all"` shartida turardi.

   Uchinchi ro'yxat (jamg'arma) keyinroq qo'shilgan va shart eskiligicha
   qolgan edi. Natijada AYNAN JAMG'ARMA uchun ochilgan ro'yxatda
   jamg'arma tugmasi YO'Q edi: do'kon egasi «kimda pulim turibdi» ni
   ko'rar, lekin o'sha qatordan pul qo'sha olmasdi.

   ⚠ BU XATO TURI: ikki qiymatli holatga uchinchisi qo'shilganda,
   `=== "birinchi"` deb yozilgan shartlar jimgina noto'g'ri bo'lib
   qoladi. Kompilyator ham, sinov ham buni ko'rmaydi — faqat ekran
   ko'rsatadi.

   ═══ QANDAY TEKSHIRADI ════════════════════════════════════════════════

   Tugmaning `onClick` idan ORQAGA yurib, uni o'rab turgan `{view ...
   && (` shartini topadi va shartni UCHALA qiymat bilan HISOBLAYDI:

       savings → true    (jamg'arma ro'yxatida tugma BO'LISHI shart)
       all     → true
       debtors → false   (u yerda qator to'liq mijoz yozuvi emas)

   Ya'ni tekshiruv matnga emas, shartning MA'NOSIGA qaraydi: shart
   qanday yozilgani (`!== "debtors"`, `=== "all" || === "savings"`)
   ahamiyatsiz.

   Ishga tushirish:  node scripts/check-cust.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve(import.meta.dirname, "..", "src", "pages", "CustomersPage.jsx");
const src = fs.readFileSync(FILE, "utf8");

/* Har bir amal: qaysi ro'yxatda ko'rinishi SHART, qaysisida ko'rinmasligi. */
const ACTIONS = [
  { call: "openSavings(c)", want: { all: true, savings: true, debtors: false } },
  { call: "openEdit(c)",    want: { all: true, savings: true, debtors: false } },
];

/* Berilgan o'rindan oldingi ENG YAQIN `{view ... && (` shartini qaytaradi. */
const wrapperBefore = (idx) => {
  const re = /\{\s*(view\s*[^\n]*?)\s*&&\s*\(/g;
  let last = null, m;
  while ((m = re.exec(src)) && m.index < idx) last = m[1];
  return last;
};

let bad = 0;
for (const { call, want } of ACTIONS) {
  const idx = src.indexOf(call);
  if (idx < 0) {
    bad++;
    console.log(`  ❌ \`${call}\` topilmadi — tugma o'chirilgan yoki nomi o'zgargan`);
    continue;
  }
  const cond = wrapperBefore(idx);
  if (!cond) {
    /* Shartsiz — hamma ro'yxatda chiqadi. Qarzdorlar uchun bu XATO:
       u yerdagi qator to'liq mijoz yozuvi emas. */
    bad++;
    console.log(`  ❌ \`${call}\` hech qanday \`view\` shartida emas —`
              + " qarzdorlar ro'yxatida ham chiqadi");
    continue;
  }
  /* ⚠ SHART FAQAT `view` GA TAYANSIN. Agar u boshqa o'zgaruvchini ham
     ishlatsa (masalan `view === "debtors" && isManager`), uni bu yerda
     hisoblab bo'lmaydi — o'sha o'zgaruvchi bu yerda yo'q. Shunda
     tekshiruv YIQILMAYDI, balki buni aniq aytadi: qo'riqchining
     «tushunmadim» deb qulashi «hammasi joyida» dan ham yomon. */
  let fn, probe;
  try {
    fn = new Function("view", `return (${cond});`);
    probe = Object.keys(want).map((v) => Boolean(fn(v)));
  } catch (e) {
    bad++;
    console.log(`  ❌ \`${call}\` sharti hisoblanmadi: ${cond}`
              + ` — ${e.message}. Shart faqat \`view\` ga tayanishi kerak.`);
    continue;
  }
  for (const [i, [view, expected]] of Object.entries(want).entries()) {
    if (probe[i] !== expected) {
      bad++;
      console.log(`  ❌ \`${call}\`: «${view}» ro'yxatida `
                + `${expected ? "BO'LISHI SHART" : "BO'LMASLIGI SHART"}, `
                + `lekin shart \`${cond}\` buni bermayapti`);
    }
  }
}

if (!bad) {
  console.log(`  ✅ Qator amallari uchala ro'yxatda ham to'g'ri (${ACTIONS.length} ta amal)`);
}
process.exit(bad ? 1 : 0);
