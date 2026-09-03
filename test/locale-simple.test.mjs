/* ══════════════════════════════════════════════════════════════════════════
   YOZUVLAR SODDA BO'LSIN — sinov (V57).

   Do'kon egasining talabi: «tushuntirishlar, izohlar shunchalik sodda
   bo'lsinki, oddiy odam osongina tushunib olsin; ularga murakkablik
   qilmasligi shart».

   ⚠ NEGA SINOV KERAK. Yozuvni bir marta soddalashtirish oson; MURAKKAB
   BO'LIB QOLMASLIGI qiyin. Yangi maydon qo'shgan dasturchi izohni
   o'zicha yozadi va u odatda dasturchining tilida chiqadi: uzun
   qo'shma gap, bosh harfli baqiriq, «⚠» belgisi. Bir yildan keyin
   ilova yana o'qib bo'lmaydigan bo'ladi.

   Bu yerda TEKSHIRILADIGAN QOIDALAR:

     1. «⚠» — DASTURCHI belgisi. Kod izohida joyi bor, ekranda yo'q:
        u qo'rqitadi, lekin nima qilish kerakligini aytmaydi.
     2. BOSH HARFLI BAQIRIQ gap ichida bo'lmasin. Yorliq («FILIAL»)
        boshqa narsa — u bitta so'z va u belgi vazifasini bajaradi.
     3. Gap UZUN bo'lmasin. Uzun qo'shma gapni kassir navbat oldida
        o'qimaydi — ko'zi bilan sirg'anib o'tadi.
     4. Butun yozuv ham juda uzun bo'lmasin — bir ekranda o'qilsin.

   ⚠ GAP SONI TEKSHIRILMAYDI va bu ataylab: uchta QISQA gap bitta uzun
   qo'shma gapdan ancha sodda. «Bajik shaxsiy. Boshqaga bermang.
   Yo'qolsa ayting.» — uchta gap, lekin hech qanday murakkablik yo'q.
   To'silishi kerak bo'lgan narsa — UZUNLIK, gap soni emas.

   Ishga tushirish:  node test/locale-simple.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, list) => {
  fail++;
  console.log("  ❌ " + m);
  for (const x of list.slice(0, 8)) console.log("       " + x);
  if (list.length > 8) console.log(`       … yana ${list.length - 8} ta`);
};

/** Bitta gapning eng ko'p uzunligi. */
const MAX_SENTENCE = 90;
/** Butun yozuvning eng ko'p uzunligi. */
const MAX_TOTAL = 180;

/**
 * ⚠ BULAR YORLIQ, GAP EMAS — baqiriq qoidasi ularga tegishli emas.
 * Ular ekranda belgi (badge) bo'lib turadi va bosh harf ataylab.
 */
const BADGES = new Set([
  "layout.superadmin", "badge.printTitle",
  "adm.shops.typeBranch", "adm.shops.typeMain",
  "adm.shops.selfRegistered", "adm.shops.planRequested",
]);

/**
 * Qisqartmalar — baqiriq emas.
 *
 * ⚠ KIRILLCHASI HAM: ruscha tarjimada «МХИК», «НДС», «ОФД» — bular
 * qisqartma va ular bosh harfda YOZILISHI kerak. Ro'yxatga
 * qo'shilmasa, sinov to'g'ri yozuvni ham xato deb ko'rsatardi.
 */
const ABBR = new RegExp(
  "\\b(QQS|MXIK|IKPU|PLU|SMS|QR|API|PDF|XML|JSON|CSV|URL|ID|TIN|INN|POS|USB|IP"
  + "|МХИК|ИКПУ|НДС|ОФД|СМС|ИНН|КПП)\\b", "g");

const langs = ["uz", "ru", "en"];
const problems = { warn: [], caps: [], long: [], many: [] };

for (const lang of langs) {
  const src = readFileSync(new URL(`../src/lib/locales/${lang}.js`, import.meta.url), "utf8");
  const rows = [...src.matchAll(/"([\w.]+)":\s*"((?:[^"\\]|\\.)*)"/g)];

  for (const [, key, raw] of rows) {
    /* `\uXXXX` ni haqiqiy harfga aylantiramiz — ruscha yozuvlar shu
       ko'rinishda saqlanmaydi, lekin belgilar uchun ishlatiladi. */
    const text = raw.replace(/\\u([0-9a-fA-F]{4})/g,
                             (_, h) => String.fromCharCode(parseInt(h, 16)));
    const where = `${lang}: ${key}`;

    if (text.includes("⚠")) problems.warn.push(`${where} — ${text.slice(0, 60)}`);

    /* Gaplarga bo'lamiz. Qisqartmalardan keyin nuqta qo'yilmaydi,
       shuning uchun oddiy bo'lish yetarli. */
    const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.trim());

    for (const s of sentences) {
      if (s.length > MAX_SENTENCE) {
        problems.long.push(`${where} (${s.length}) — ${s.slice(0, 70)}…`);
        break;
      }
    }
    if (text.length > MAX_TOTAL) {
      problems.many.push(`${where} (${text.length}) — ${text.slice(0, 60)}…`);
    }

    /* Baqiriq: uch harfdan uzun bosh harfli so'z, GAP ichida. */
    if (!BADGES.has(key)) {
      const words = text.trim().split(/\s+/);
      if (words.length > 2) {
        const clean = text.replace(ABBR, "");
        /* Lotin va kirill — ikkalasi ham. Apostrof o'zbekchada
           harfning bir qismi (O', G'). */
        const shout = clean.match(/\b[A-ZА-ЯЎҚҒҲ][A-ZА-ЯЎҚҒҲ'’ʻ]{3,}\b/g);
        if (shout) problems.caps.push(`${where} — ${shout.join(", ")}`);
      }
    }
  }
}

console.log("── Ekrandagi yozuvlar ──");
problems.warn.length ? bad("«⚠» belgisi ekranda ishlatilmagan", problems.warn)
                     : ok("«⚠» belgisi ekranda yo'q");
problems.caps.length ? bad("Gap ichida BOSH HARFLI baqiriq yo'q", problems.caps)
                     : ok("Gap ichida baqiriq yo'q");
problems.long.length ? bad(`Har gap ${MAX_SENTENCE} belgidan qisqa`, problems.long)
                     : ok(`Har gap ${MAX_SENTENCE} belgidan qisqa`);
problems.many.length ? bad(`Yozuv ${MAX_TOTAL} belgidan uzun emas`, problems.many)
                     : ok(`Yozuv ${MAX_TOTAL} belgidan uzun emas`);

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
