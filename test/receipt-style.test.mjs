/* ══════════════════════════════════════════════════════════════════════════
   CHEK IKKI JOYDA BEZALADI — IKKALASI HAM TO'LIQ BO'LSIN (V109)

   ═══ QANDAY NOSOZLIKNI QAYTARMASLIK UCHUN ═════════════════════════════

   Chek tasmasi EKRANDA `styles.css` bilan, SAQLANGAN PDF da esa
   `ek-receipt-pdf.js` ichidagi alohida jadval bilan bezaladi (PDF
   klonlangan DOM ni o'z hujjatiga ko'chiradi va sahifaning uslublari
   u yerga bormaydi).

   Ikkita jadval — ikkita unutish ehtimoli. Sinov yozilganda ikkalasi
   ham topildi:

     · `.pt-tape__kind` PDF da YO'Q edi — «QARZ TO'LOVI» sarlavhasi
       saqlangan nusxada oddiy mayda matnga aylanib, xarid chekidan
       ajralib turmay qolardi. Holbuki uni ajratib turadigan YAGONA
       narsa shu qator;
     · `.pt-line__cut` esa EKRANDA yo'q edi — qator chegirmasi
       ekranda oddiy qator, qog'ozda ichkariroq va so'nikroq bo'lardi.

   Ikkala xato ham JIM: hech qayerda xato chiqmaydi, faqat mijoz
   ekranda bir xil, qog'ozda boshqa chek ko'radi.

   ⚠ OYNA BEZAKLARI ISTISNO. `pt-modal`, `pt-close`, `pt-actions*` —
   tasmaning O'ZI emas, uning atrofidagi oyna. PDF ga faqat tasma
   ko'chadi, shuning uchun ular u yerda bo'lmasligi TO'G'RI.

   Ishga tushirish:  node test/receipt-style.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     ${got}`)); };

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

const components = ["../src/portal/PaymentReceipt.jsx", "../src/portal/Receipt.jsx"];
const source = components.map(read).join("\n");
const css = read("../src/styles.css");
const pdf = read("../src/lib/ek-receipt-pdf.js");

/** Tasmadan TASHQARIDAGI bezaklar — PDF ga ko'chmaydi (yuqoridagi izoh). */
const CHROME = new Set(["pt-modal", "pt-modal__inner", "pt-close",
                        "pt-actions", "pt-actions__err"]);

const used = [...new Set([...source.matchAll(/\bpt-[a-z0-9_-]+/g)].map((m) => m[0]))].sort();

console.log("── ⚠ PDF USLUBLARI SHABLON SATRI ICHIDA ──");
/* ⚠ SHU YERDA HAQIQIY XATO BO'LGAN (V109).
   `ek-receipt-pdf.js` dagi CSS oddiy fayl emas — u JS SHABLON SATRI
   ichida turadi. Izohga qo'yilgan bitta teskari apostrof satrni ERTA
   YOPADI va qolgan CSS JS kodi bo'lib o'qiladi.

   Eng yomoni: fayl SINTAKTIK JIHATDAN TO'G'RI qoladi, `vite build`
   xato bermaydi va nosozlik butunlay boshqa joyda chiqadi —
   «Mijozlar» bo'limi `ReferenceError: returned is not defined` bilan
   qulagan edi.

   Shuning uchun bu tekshiruv sinflar ro'yxatidan OLDIN turadi: satr
   buzilgan bo'lsa, quyidagi hamma tekshiruv ma'nosini yo'qotadi. */
{
  const mark = "const PRINT_CSS = `";
  const at = pdf.indexOf(mark);
  if (at < 0) {
    bad("PDF uslublari topilmadi — o'zgaruvchi nomi o'zgarganmi?");
  } else {
    /* ⚠ QOIDA: satrni yopadigan teskari apostrofdan KEYIN darhol
       `;` kelishi shart. Buzilganda esa u CSS ning o'rtasida yopiladi
       va ketidan `.pt-...` turadi — aynan shu farq ushlanadi.

       «Ichida `.pt-tape` bormi?» deb tekshirish YETMAYDI: erta
       yopilgan satrda ham boshidagi qoidalar joyida qoladi va
       tekshiruv yashil bo'laverardi (birinchi urinishda shunday
       bo'ldi). */
    const rest = pdf.slice(at + mark.length);
    const end = rest.indexOf("`");
    const after = rest.slice(end + 1, end + 2);
    after === ";"
      ? ok("shablon satri to'g'ri joyda yopiladi")
      : bad("shablon satri ERTA YOPILGAN — izohdagi teskari apostrofmi?",
            `yopilishdan keyin: ${JSON.stringify(rest.slice(end + 1, end + 40))}`);
  }
}

console.log("\n── Chek sinflari ──");
used.length >= 20 ? ok(`chekda ${used.length} ta sinf ishlatilgan`)
                  : bad("sinflar topilmadi — qidiruv buzilgan bo'lishi mumkin", used.length);

console.log("\n── Ekran jadvali (styles.css) ──");
{
  const miss = used.filter((c) => !css.includes(`.${c}`));
  miss.length === 0 ? ok("hamma sinf ekranda bezalgan")
                    : bad("ekranda bezaksiz qoladi", miss.join(", "));
}

console.log("\n── ⚠ PDF jadvali (ek-receipt-pdf.js) ──");
{
  const miss = used.filter((c) => !CHROME.has(c) && !pdf.includes(`.${c}`));
  miss.length === 0 ? ok("tasmaning hamma sinfi PDF da ham bezalgan")
                    : bad("PDF da bezaksiz qoladi", miss.join(", "));
}

console.log("\n── Istisno ro'yxati o'zi ham tekshiriladi ──");
/* ⚠ Ro'yxat eskirmasin: unda endi ishlatilmaydigan sinf qolsa, u
   keyingi o'quvchini «demak bu ataylab» deb chalg'itardi. */
{
  const stale = [...CHROME].filter((c) => !used.includes(c));
  stale.length === 0 ? ok("istisnolarning hammasi hali ham ishlatiladi")
                     : bad("istisno ro'yxati eskirgan", stale.join(", "));
}

console.log("\n── ⚠ BEKOR QILINGAN TO'LOV belgisi (V109) ──");
/* Bu belgi ikkala jadvalda ham bo'lishi SHART: bekor qilingan
   to'lovning cheki qog'ozda ham shunday deyishi kerak. */
for (const cls of ["pt-void", "pt-void__title", "pt-void__when", "pt-void__why"]) {
  const inCss = css.includes(`.${cls}`), inPdf = pdf.includes(`.${cls}`);
  inCss && inPdf ? ok(`${cls} — ekranda ham, PDF da ham`)
                 : bad(`${cls} yetishmaydi`, `ekran: ${inCss}, pdf: ${inPdf}`);
}
source.includes("data.reversedAt")
  ? ok("chek `reversedAt` ni o'qiydi")
  : bad("chek bekor qilinganini umuman o'qimayapti");

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
