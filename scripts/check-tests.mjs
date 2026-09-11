/* ══════════════════════════════════════════════════════════════════════════
   HAR BIR SINOV FAYLI HAQIQATAN ISHGA TUSHADIMI (V97)

   ⚠ BU QO'RIQCHI HAQIQIY NUQSON USTIGA YOZILDI. `test/line-price.test.mjs`
   yozildi, ichida 20 ta sinov bor edi va `npm test` YASHIL turardi —
   chunki fayl `package.json` dagi ro'yxatga qo'shilmagan edi. Ya'ni
   sinov bor, lekin u HECH QACHON ishlamasdi.

   Bu shu sessiyada IKKINCHI marta uchragan sinf: admin panelda ham
   `import` qatori qo'shilmay qolgan, hamma qo'riqchi yashil turgan edi.
   Savol «buni tuzatdimmi» emas, «BU SINFMI» bo'lishi kerak — shuning
   uchun bu yerda umumiy qoida qo'yiladi.
   ══════════════════════════════════════════════════════════════════════════ */
import { readdirSync, readFileSync, existsSync } from "node:fs";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts || {};
const test = scripts.test || "";
/* ⚠ IKKALA BUYRUQ HAM HAYSTACK. Qo'riqchilarning bir qismi `test` da,
   bir qismi `check` da turadi — faqat bittasiga qarash ro'yxatda
   turgan faylni «yo'q» deb ko'rsatardi. */
const all = `${test} ${scripts.check || ""}`;

let bad = 0;

const files = existsSync("test")
  ? readdirSync("test").filter((f) => f.endsWith(".test.mjs"))
  : [];
const missing = files.filter((f) => !test.includes(`test/${f}`));
if (missing.length) {
  bad += missing.length;
  console.log(`\n❌ Ro'yxatga tushmagan sinov fayllari — ular HECH QACHON ishlamaydi:`);
  for (const f of missing) console.log(`   • test/${f}`);
  console.log(`\n   Ularni package.json dagi "test" buyrug'iga qo'shing.`);
}

/* ══ QO'RIQCHILARNING O'ZI HAM RO'YXATDA BO'LSIN ═══════════════════════

   Yuqoridagi qoida faqat `test/*.test.mjs` ni qarardi va `scripts/`
   ochiq qolgan edi — ya'ni QO'RIQCHINING o'zi yozilib, ro'yxatga
   tushmay qolishi mumkin edi. Bu aynan shu faylni tug'dirgan
   nuqsonning o'zi, faqat bitta papka narida.

   Bu teshik taxmin emas: `check-refs.mjs` uchta omborga qo'shilganda
   uchalasida ham ro'yxat QO'LDA yangilandi. Qo'lda qilinadigan
   qadam — ertami-kechmi unutiladigan qadam. */
const guards = readdirSync("scripts")
  .filter((f) => f.startsWith("check-") && f.endsWith(".mjs"));
const idle = guards.filter((f) => !all.includes(`scripts/${f}`));
if (idle.length) {
  bad += idle.length;
  console.log(`\n❌ Ro'yxatga tushmagan qo'riqchilar — ular HECH QACHON ishlamaydi:`);
  for (const f of idle) console.log(`   • scripts/${f}`);
  console.log(`\n   Ularni package.json dagi "test" yoki "check" buyrug'iga qo'shing.`);
}

if (bad) {
  console.log("");
  process.exit(1);
}

console.log(`\n✅ Hamma sinov (${files.length}) va qo'riqchi (${guards.length}) ro'yxatda`);
