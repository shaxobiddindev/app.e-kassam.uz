/* ══════════════════════════════════════════════════════════════════════════
   ROL ANIQ TENGLIK BILAN SOLISHTIRILMAYDI

   ═══ HAQIQIY NUQSON USTIGA YOZILDI (2026-09-14) ════════════════════════

   Do'kon egasi: «ba'zi do'konlarda maxsulot kiritish kabi funksiyalar
   chiqmayapti». Sabab bitta qatorda edi:

       const isHeadUser = user?.role === "OWNER"
                       || user?.role === "SHOP_ADMIN"
                       || user?.role === "ADMIN";

   Sessiyadagi rol ANIQ BITTA SO'Z EMAS:

     · xodimda bir nechta rol bo'lishi mumkin va ular vergul bilan
       saqlanadi — egasi ayni paytda kassir ham bo'lsa `"OWNER,CASHIER"`;
     · ba'zi kirish yo'llari `ROLE_` prefiksi bilan yozadi
       (`[{type:"ROLE_OWNER"}]` → `"ROLE_OWNER"`).

   Ikkala holatda ham tenglik YOLG'ON beradi va butun boshqaruv
   tugmalari JIMGINA yo'qoladi. Ekranda xato yo'q — shunchaki tugma
   yo'q, va do'kon egasi buni «ilova buzilgan» deb tushunadi.

   ⚠ O'LCHANGAN: jonli sahifada `ek_role` ni almashtirib tekshirildi.
   `"OWNER"` → tugma bor; `"ROLE_OWNER"` va `"OWNER,CASHIER"` → yo'q.

   ⚠ NEGA FAQAT BA'ZI DO'KONDA: ko'p xodimda bitta rol bo'ladi va
   tenglik ishlayveradi. Nuqson faqat ikki rolli hisobda chiqadi —
   ya'ni aynan do'kon egasining o'zida.

   To'g'ri yo'l — `lib/ek-roles.js`:
     · ruxsat tekshirish     → `hasRole(user?.role, ["SHOP_ADMIN"])`
     · ko'rsatish (yorliq)   → `topRole(user?.role)`

   Ishga tushirish:  node scripts/check-roles.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* ⚠ `fileURLToPath`, `URL.pathname` EMAS: loyiha yo'lida BO'SHLIQ bor
   («E-KASSAM Project») va `pathname` uni `%20` qilib beradi — o'shanda
   papka topilmay, qo'riqchining o'zi yiqilardi. Bu xato shu repoda
   ikkinchi marta takrorlandi. */
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** Rol lug'atining o'zi — tenglik u yerda O'RINLI. */
const EXEMPT = ["lib/ek-roles.js"];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(name)) files.push(p);
  }
})(SRC);

/* Izohlar tashlanadi: ular eski yo'lni TARIX sifatida eslaydi. */
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* `user.role === "..."`, `role !== "..."`, `x?.role === "..."` — hammasi.
   ⚠ `role="alert"` kabi JSX atributi TEGILMAYDI: u `=` bilan yoziladi,
   bu yerda esa `===` yoki `!==` qidiriladi. */
const RE = /\.role\s*(===|!==)\s*["'`]/g;

let bad = 0, checked = 0;
for (const file of files) {
  const rel = relative(SRC, file).split(sep).join("/");
  if (EXEMPT.includes(rel)) continue;
  checked++;
  const code = bare(readFileSync(file, "utf8"));
  const hits = [...code.matchAll(RE)];
  if (!hits.length) continue;
  for (const h of hits) {
    const line = code.slice(0, h.index).split("\n").length;
    bad++;
    console.log(`  ❌ ${rel}:${line} — rol aniq tenglik bilan solishtirilgan`);
  }
}

if (bad === 0) {
  console.log(`  ✅ Rol hech qayerda aniq tenglik bilan solishtirilmaydi (${checked} fayl)`);
  process.exit(0);
}
console.log("\n  ⚠ `hasRole(user?.role, [...])` yoki `topRole(user?.role)` ishlating.");
console.log("     Sessiyada rol `\"OWNER,CASHIER\"` yoki `\"ROLE_OWNER\"` bo'lishi mumkin.\n");
process.exit(1);
