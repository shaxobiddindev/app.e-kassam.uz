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
import { readdirSync, readFileSync } from "node:fs";

const script = JSON.parse(readFileSync("package.json", "utf8")).scripts?.test || "";
const files = readdirSync("test").filter((f) => f.endsWith(".test.mjs"));

const missing = files.filter((f) => !script.includes(`test/${f}`));

if (missing.length) {
  console.log(`\n❌ Ro'yxatga tushmagan sinov fayllari — ular HECH QACHON ishlamaydi:`);
  for (const f of missing) console.log(`   • test/${f}`);
  console.log(`\n   Ularni package.json dagi "test" buyrug'iga qo'shing.\n`);
  process.exit(1);
}

console.log(`\n✅ Hamma sinov fayli ro'yxatda (${files.length} fayl)`);
