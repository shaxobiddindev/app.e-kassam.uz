/* ══════════════════════════════════════════════════════════════════════════
   TAROZI OQIMI (V111)

   Do'kon egasi: «tarozi sticker chiqarmaydi, monoblokka ulangan —
   kassa bilan aloqa qilishi kerak».

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Bu yerdan chiqadigan son to'g'ridan-to'g'ri chekka tushadi, shuning
   uchun ikkita narsa qat'iy:

     · YARIM RAMKADAN son olinmaydi — port ma'lumotni bo'lak-bo'lak
       beradi va «0.1» bilan «23 kg» ikki o'qishda kelishi mumkin;
     · TEBRANIB turgan o'lchov «barqaror» deb ko'rsatilmaydi.

   Ishga tushirish:  node test/scale.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { splitFrames, parseFrame, stableOf, feed } = await import("../src/lib/ek-scale.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + (got === undefined ? "" : `\n     olindi: ${got}`)); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));

console.log("── CAS / Mettler-Toledo ramkasi ──");
{
  const r = parseFrame("ST,GS,   0.123kg");
  eq(r.kg, 0.123, "og'irlik 0.123 kg");
  eq(r.stable, true, "«ST» — barqaror");
  eq(r.net, false, "«GS» — brutto");
}
{
  const r = parseFrame("US,NT,   1.500 kg");
  eq(r.stable, false, "«US» — tebranmoqda");
  eq(r.net, true, "«NT» — netto");
}

console.log("\n── Sodda ASCII ──");
eq(parseFrame("  0.250 kg").kg, 0.25, "faqat son va birlik");
eq(parseFrame("0,250").kg, 0.25, "vergul ham nuqta kabi");
eq(parseFrame("  0.250 ").stable, null, "barqarorlik AYTILMAGAN — `null`, `false` emas");

console.log("\n── Birliklar ──");
eq(parseFrame("450 g").kg, 0.45, "gramm kilogrammga o'giriladi");
eq(parseFrame("1.5 kg").kg, 1.5, "kilogramm o'zgarmaydi");
eq(parseFrame("ST,GS,0.123kg").kg, 0.123, "«GS» «gramm» deb o'qilmaydi");

console.log("\n── Sonsiz ramka ──");
eq(parseFrame(""), null, "bo'sh ramka — null");
eq(parseFrame("ERR"), null, "xato belgisi — null");
eq(parseFrame(null), null, "yo'q ramka — null");

console.log("\n── ⚠ YARIM RAMKA ISHLATILMAYDI ──");
{
  const { frames, rest } = splitFrames("ST,GS,0.1kg\r\nST,GS,0.2");
  eq(frames.length, 1, "faqat tugallangani olinadi");
  eq(rest, "ST,GS,0.2", "yarmi keyingi o'qishga qoladi");
}
{
  /* Port ikki bo'lakda berdi — natija BUTUN o'lchov bo'lishi shart. */
  let st = feed(null, "ST,GS,   1.2");
  eq(st.kg, null, "yarim ramkadan og'irlik olinmadi");
  st = feed(st, "34 kg\r\n");
  eq(st.kg, 1.234, "ikki bo'lak birlashib 1.234 kg berdi");
}

console.log("\n── ⚠ BARQARORLIK ──");
eq(stableOf([1, 1, 1]), false, "to'rttadan kam o'lchov — hali barqaror emas");
eq(stableOf([1, 1, 1, 1]), true, "to'rtta bir xil — barqaror");
eq(stableOf([1, 1, 1.002, 1]), false, "oxirgilari farq qilsa — barqaror emas");
eq(stableOf([0.5, 1, 1, 1, 1]), true, "eskisi ahamiyatsiz — oxirgi to'rttasi muhim");
{
  /* Tarozining O'Z so'zi kuzatuvdan ustun: aks holda barqaror
     o'lchov ham to'rt o'qish kutishga majbur bo'lardi. */
  const st = feed(null, "ST,GS,0.500kg\r\n");
  eq(st.stable, true, "tarozi «ST» desa — darhol barqaror");
}
{
  const st = feed(null, "US,GS,0.500kg\r\nUS,GS,0.500kg\r\nUS,GS,0.500kg\r\nUS,GS,0.500kg\r\n");
  eq(st.stable, false, "⚠ tarozi «US» desa — bir xil kelsa ham barqaror EMAS");
}
{
  /* Barqarorlikni aytmaydigan tarozi — kuzatuv bilan. */
  let st = null;
  for (let i = 0; i < 4; i++) st = feed(st, "0.750\r\n");
  eq(st.stable, true, "aytmaydigan tarozida to'rt bir xil o'lchov — barqaror");
  st = feed(st, "0.760\r\n");
  eq(st.stable, false, "qiymat o'zgardi — yana barqaror emas");
}

console.log("\n── Tarix cheklangan ──");
{
  let st = null;
  for (let i = 0; i < 50; i++) st = feed(st, `${i / 1000}\r\n`);
  st.history.length <= 20 ? ok(`tarix ${st.history.length} ta bilan cheklangan`)
                          : bad("tarix cheksiz o'smasin", st.history.length);
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
