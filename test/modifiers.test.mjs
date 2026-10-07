/* ══════════════════════════════════════════════════════════════════════════
   TAOM QO'SHIMCHALARI — kassa mantig'i (R2, V149)

   ⚠ ENG MUHIMI: qo'shimchasiz qator ESKICHA qoladi (kalit = tovar ID).
   Aks holda oddiy do'konning savati — «ikki bosish = ×2» — buzilardi.

   Ishga tushirish:  node test/modifiers.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { keyOf, groupsFor, toggle, missing, chosen, extraOf, lineFor, modsText, isSingle } =
  await import("../src/lib/ek-modifiers.js");

let pass = 0, fail = 0;
const is = (cond, name, extra = "") => {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log(`  ❌ ${name}${extra ? "\n     " + extra : ""}`); }
};
const eq = (got, want, name) =>
  is(JSON.stringify(got) === JSON.stringify(want), name, `olindi: ${JSON.stringify(got)}, kutilgan: ${JSON.stringify(want)}`);

const BURGER = { id: 7, name: "Burger", salePrice: 30000, minPrice: 25000, wholesalePrice: 27000 };
const SAUCE = { id: 1, name: "Sous", minSelect: 0, maxSelect: 2, productIds: [7],
  options: [{ id: 11, name: "Pishloq", price: 4000 }, { id: 12, name: "Ketchup", price: 2000 }, { id: 13, name: "Piyozsiz", price: 0 }] };
const SIZE = { id: 2, name: "Porsiya", minSelect: 1, maxSelect: 1, productIds: [7, 8],
  options: [{ id: 21, name: "Kichik", price: 0 }, { id: 22, name: "Katta", price: 8000 }] };
const EMPTY = { id: 3, name: "Bo'sh", minSelect: 0, maxSelect: null, productIds: [7], options: [] };

console.log("\n── Qator kaliti ──");
{
  eq(keyOf(BURGER), 7, "qo'shimchasiz — tovar ID (oddiy savat o'zgarmaydi)");
  is(lineFor(BURGER, []) === BURGER, "tanlov bo'sh — tovarning O'ZI qaytadi (oddiy qator bilan birlashadi)");
  const a = lineFor(BURGER, [SAUCE.options[1], SAUCE.options[0]]);
  const b = lineFor(BURGER, [SAUCE.options[0], SAUCE.options[1]]);
  eq(keyOf(a), "7~11.12", "kalit: ID + saralangan qo'shimchalar");
  eq(keyOf(a), keyOf(b), "tanlash tartibi kalitni o'zgartirmaydi — bir xil buyurtma birlashadi");
  is(keyOf(lineFor(BURGER, [SAUCE.options[2]])) !== keyOf(BURGER), "⚠ «Piyozsiz» (0 so'm) ham alohida qator — oshxona uchun boshqa taom");
}

console.log("\n── Narx ──");
{
  const l = lineFor(BURGER, [SAUCE.options[0], SAUCE.options[1]]);
  eq(l.salePrice, 36000, "dona narxi = 30 000 + 4 000 + 2 000");
  eq(l.basePrice, 30000, "taomning o'z narxi saqlanadi");
  eq(l.minPrice, 31000, "chegirma chegarasi ham qo'shimcha qadar ko'tariladi");
  eq(l.wholesalePrice, null, "⚠ optom narx olib tashlanadi — qo'shimcha bepul bo'lib qolmasin");
  eq(l.modifiers.map((m) => m.id), [11, 12], "qo'shimchalar qatorda (sotuvga ID bilan ketadi)");
  eq(extraOf([{ price: "4000" }, { price: null }]), 4000, "satr va bo'sh narx — xatosiz");
  eq(modsText(l), "Pishloq, Ketchup", "chek va ekran matni");
  eq(lineFor({ ...BURGER, minPrice: null }, [SAUCE.options[0]]).minPrice, null, "chegara yo'q bo'lsa yo'qligicha qoladi");
}

console.log("\n── Guruhlar va tanlov ──");
{
  eq(groupsFor([SAUCE, SIZE, EMPTY], 7).map((g) => g.id), [1, 2], "taomga biriktirilganlar; variantsiz guruh chiqmaydi");
  eq(groupsFor([SAUCE, SIZE], "8").map((g) => g.id), [2], "ID satr bo'lsa ham topiladi (oflayn katalog)");
  eq(groupsFor(null, 7), [], "guruhlar yo'q — bo'sh");

  is(isSingle(SIZE) && !isSingle(SAUCE), "«ko'pi bilan 1» — radio");
  let p = toggle({}, SIZE, 21);
  p = toggle(p, SIZE, 22);
  eq(p[2], [22], "radio guruhda yangisi eskisini almashtiradi");
  let q = toggle({}, SAUCE, 11);
  q = toggle(q, SAUCE, 12);
  q = toggle(q, SAUCE, 13);
  eq(q[1], [11, 12], "⚠ chegaraga yetganda yangisi QO'SHILMAYDI (tanlov kassirning bilmasidan o'zgarmasin)");
  eq(toggle(q, SAUCE, 11)[1], [12], "qayta bosish — olib tashlaydi");

  eq(missing([SAUCE, SIZE], {}).map((g) => g.id), [2], "majburiy «Porsiya» tanlanmagan");
  eq(missing([SAUCE, SIZE], { 2: [21] }), [], "hammasi to'ldi");
  eq(chosen([SAUCE, SIZE], { 2: [22], 1: [11] }).map((o) => o.id), [11, 22], "tanlanganlar guruh tartibida");
}

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
