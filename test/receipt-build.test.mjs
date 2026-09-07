/* ══════════════════════════════════════════════════════════════════════════
   CHEK QURUVCHISI — MIJOZ QO'LIDAGI QOG'OZ

   ═══ NEGA BU SINOV KECHIKKAN ══════════════════════════════════════════

   `buildReceipt` — tizimning eng KO'RINADIGAN natijasi: uni har
   xaridda mijoz o'qiydi va tekshiruvchi ham shuni so'raydi. Shunga
   qaramay unda birorta sinov yo'q edi, va sababi texnik: modul
   `./ek-desktop` kabi KENGAYTMASIZ importlar ishlatadi. Vite ularni
   hal qiladi, Node esa yo'q — ya'ni faylni `import` qilib bo'lmasdi.

   ⚠ MANBAGA TEGILMADI. Kengaytmalarni butun daraxt bo'ylab qo'shish
   396 ta importni, 106 ta faylni o'zgartirardi — sinov qulayligi
   uchun juda katta churn (loyihaning 1-qoidasi: ishlab turgan
   narsaga tegmaslik). O'rniga modul shu yerda `esbuild` bilan
   yig'iladi: u Vite ning O'ZI ishlatadigan hal qiluvchi, ya'ni
   sinov brauzerdagi bilan bir xil kodni ko'radi.

   ⚠ NIMA TEKSHIRILADI: chekdagi PUL QATORLARI va 943-qaror
   qoidalari. Uslub (kenglik, tekislash) `receipt-style.test.mjs`
   da, ESC/POS baytlari `escpos.test.mjs` da.

   Ishga tushirish:  node test/receipt-build.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import * as esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ── Brauzer muhitining eng kichik qismi ─────────────────────────────── */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = {
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true, userAgent: "node" }, configurable: true,
});

const out = path.join(os.tmpdir(), `ek-hw-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: ["src/lib/ek-hardware.js"],
  bundle: true, format: "esm", platform: "neutral",
  outfile: out, logLevel: "silent",
  define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, MODE: "production" }) },
});
const { buildReceipt } = await import(out);
fs.unlinkSync(out);

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
/* ⚠ Chekda ESC/POS BOSHQARUV BAYTLARI bor va ular xato xabariga
   tushsa, chiqish «binary» bo'lib qoladi: `grep` uni ko'rsatmaydi,
   terminal esa buzilib ketadi. Sinov birinchi marta buzib
   tekshirilganda aynan shu bo'ldi — band yiqildi, lekin sababi
   ekranda ko'rinmadi. Shuning uchun baytlar nuqtaga almashtiriladi. */
const printable = (v) => String(v).replace(/[\x00-\x1f\x7f]/g, "·").slice(0, 400);
const bad = (m, got) => { fail++; console.log("  ❌ " + m);
                          if (got !== undefined) console.log("     olindi: " + printable(got)); };
const has = (text, needle, m) =>
  (text.includes(needle) ? ok(m) : bad(m, text));
const hasnt = (text, needle, m) =>
  (!text.includes(needle) ? ok(m) : bad(m, text));

/** Chekning O'QILADIGAN matni — ESC/POS baytlarisiz. */
const textOf = (built) => {
  const raw = built?.text ?? built?.plain ?? built;
  return typeof raw === "string" ? raw
       : new TextDecoder().decode(Uint8Array.from(built.bytes || []));
};

const CART = [
  { name: "Suv 1,5 l", qty: 2, salePrice: 5000 },
  { name: "Non", qty: 1, salePrice: 4000 },
];

console.log("\n══ Chek quruvchisi ══");

/* ══ 1. PUL QATORLARI ══════════════════════════════════════════════ */
console.log("\n─ 1. Jami, chegirma, qaytim ─");
{
  const t = textOf(buildReceipt({ saleId: 42, cart: CART, total: 14000, payType: "CASH" }));
  has(t, "Suv 1,5 l", "tovar nomi chekda");
  has(t, "42", "chek raqami chekda");
  ok(t.length > 40 ? "chek bo'sh emas" : bad("chek bo'sh"));
}
{
  /* ⚠ Yaxlitlash NOLMAS bo'lsa chekda ALOHIDA qator bo'lib chiqadi:
     ko'rinmaydigan yaxlitlash - o'g'irlikning eng sekin turi. */
  const t = textOf(buildReceipt({
    saleId: 43, cart: CART, total: 14000, rounding: 500, payType: "CASH" }));
  has(t, "500", "yaxlitlash summasi chekda ko'rinadi");
}
{
  const t = textOf(buildReceipt({
    saleId: 44, cart: CART, total: 14000, rounding: 0, payType: "CASH" }));
  hasnt(t, "Yaxlitlash", "yaxlitlash NOL bo'lsa qator umuman chizilmaydi");
}

/* ══ 2. ⚠ 943-QAROR: FISKAL BELGI FAQAT FISKAL HUJJATDA ════════════ */
console.log("\n─ 2. ⚠ Fiskal belgi va QR — faqat fiskal chekda ─");
const FISCAL = { fiscalSign: "1234567890123456", qrUrl: "https://ofd.uz/c/abc123" };
{
  const t = textOf(buildReceipt({
    saleId: 45, cart: CART, total: 14000, payType: "CASH",
    fiscal: FISCAL, saleType: "SALE" }));
  has(t, "1234567890123456", "SOTUV chekida fiskal belgi bor");
}
{
  /* ⚠ Bo'nak va bo'lib to'lash cheklari soliqqa KETMAYDI. Ularda
     fiskal belgi chiqsa, chekda «bu chek soliqqa qayd etildi» degan
     YOLG'ON turardi. */
  for (const type of ["ADVANCE", "INSTALLMENT", "CREDIT"]) {
    const t = textOf(buildReceipt({
      saleId: 46, cart: CART, total: 14000, payType: "CASH",
      fiscal: FISCAL, saleType: type }));
    hasnt(t, "1234567890123456", `${type} chekida fiskal belgi YO'Q`);
  }
}
{
  const t = textOf(buildReceipt({
    saleId: 47, cart: CART, total: 14000, payType: "CASH",
    fiscal: FISCAL, saleType: "RETURN" }));
  has(t, "1234567890123456", "QAYTARISH ham fiskal hujjat — belgi bor");
}
{
  const t = textOf(buildReceipt({
    saleId: 48, cart: CART, total: 14000, payType: "CASH",
    fiscal: FISCAL, saleType: "CORRECTION" }));
  has(t, "1234567890123456", "TUZATUVCHI chek ham fiskal — belgi bor");
}

/* ══ 3. BRENDSIZ ═══════════════════════════════════════════════════ */
console.log("\n─ 3. Chekda BEGONA brend yo'q (V85) ─");
{
  const t = textOf(buildReceipt({ saleId: 49, cart: CART, total: 14000, payType: "CASH" }));
  hasnt(t, "E-KASSAM", "«E-KASSAM.UZ» yozuvi yo'q");
  hasnt(t, "CRM", "«CRM Tizimi» satri yo'q");
}

/* ══ 4. BUZUQ KIRITISH YIQITMAYDI ══════════════════════════════════ */
console.log("\n─ 4. Buzuq kiritish chekni yiqitmaydi ─");
{
  /* Kassir tugmani bosdi — chek HAR QANDAY holatda chiqishi kerak.
     Yiqilsa mijoz chek olmaydi va kassir sababini bilmaydi. */
  for (const [label, arg] of [
    ["bo'sh savat", { saleId: 1, cart: [], total: 0 }],
    ["savatsiz", { saleId: 2, total: 0 }],
    ["nomsiz tovar", { saleId: 3, cart: [{ qty: 1, salePrice: 100 }], total: 100 }],
    ["miqdorsiz tovar", { saleId: 4, cart: [{ name: "X", salePrice: 100 }], total: 100 }],
    ["manfiy jami", { saleId: 5, cart: CART, total: -5000 }],
  ]) {
    try { textOf(buildReceipt(arg)); ok(`${label} — chek chiqdi`); }
    catch (e) { bad(`${label} — chek YIQILDI`, e.message); }
  }
}

console.log(`\n${fail ? "❌" : "✅"} chek quruvchisi: ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
