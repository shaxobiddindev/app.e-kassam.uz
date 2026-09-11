/* ══════════════════════════════════════════════════════════════════════════
   KATEGORIYA: MAJBURIY VA ALMASHTIRILMAYDI

   ⚠ NEGA SINOV KERAK. Bu qoida bitta joyda emas, UCHTA joyda yashaydi:
   formadagi tekshiruv, `Select` ning qulfi va saqlashda yuboriladigan
   qiymat. Ulardan biri tushib qolsa qolgan ikkitasi YASHIL turadi va
   qoida jimgina ishlamay qo'yadi — masalan `disabled` olib tashlansa,
   forma baribir «to'g'ri» ko'rinardi.

   ⚠ QULF ASL YOZUVDAN HISOBLANADI (`modal.product.categoryId`), forma
   holatidan EMAS. Formadan hisoblansa, qo'shish oynasida kategoriya
   tanlangan zahoti maydon o'zini qulflab qo'yardi va odam xato
   tanlaganini tuzata olmasdi.

   Ishga tushirish:  node test/category-required.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");
const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log("  ❌ " + msg); }
};

console.log("\n── Forma: kategoriya majburiy ──");
{
  const p = src("pages/ProductsPage.jsx");

  ok(p.includes('if (!form.categoryId) { toast.error(t("products.needCategory")); return; }'),
     "⚠ saqlashdan OLDIN to'xtatiladi — serverdan qaytgan xato formani yopib ulgurardi");

  ok(p.includes('label={`${t("products.category")} *`}'),
     "maydon yorlig'ida majburiylik belgisi");

  ok(!p.includes('{ value: "", label: t("products.noCategory"), icon: "fa-tag" }'),
     "⚠ «Kategoriyasiz» bandi ro'yxatda YO'Q — u turgan ekan majburiylik ma'nosiz");

  ok(p.includes('t("products.noCategoriesYet")'),
     "⚠ kategoriyasi yo'q do'kon boshi berk ko'chaga tushmaydi — nima qilish aytiladi");
}

console.log("\n── Qulf: qo'yilgan kategoriya almashtirilmaydi ──");
{
  const p = src("pages/ProductsPage.jsx");

  ok(p.includes("const categoryLocked = Boolean(modal?.product?.categoryId) && catLocked !== false;"),
     "⚠ qulf ASL yozuvdan hisoblanadi, forma holatidan emas");

  ok(p.includes("productApi.getById(p.id)") && p.includes("categoryLocked !== false"),
     "⚠ qulf SERVERDAN so'raladi — ro'yxat javobida bu bayroq yo'q");

  ok(p.includes("setCatLocked(p.categoryId ? true : false);"),
     "⚠ javob kelguncha QULFLANGAN — noaniqlikda ochib yuborilmaydi");

  ok(p.includes("mine !== catSeq.current"),
     "⚠ kechikkan javob boshqa tovarning qulfini buzmaydi");

  ok(p.includes("disabled={categoryLocked}"),
     "qulflanganda maydon o'chiriladi");

  ok(p.includes("categoryId: categoryLocked ? modal.product.categoryId : (form.categoryId || null),"),
     "⚠ saqlashda ham asl qiymat ketadi — `disabled` yolg'iz to'siq bo'la olmaydi");

  ok(p.includes('t("products.categoryLocked")'),
     "⚠ nega o'chiq ekani YOZILADI — o'chiq maydon sababsiz qoldirilmaydi");

  /* ⚠ BO'SH KATEGORIYA OCHIQ QOLISHI SHART. Eski tovarlarning bir
     qismi kategoriyasiz; ular ham qulflansa «har bir tovar
     kategoriyada bo'lsin» talabi hech qachon bajarilmasdi. */
  ok(p.includes("Boolean(modal?.product?.categoryId)")
     && !p.includes('const categoryLocked = modal?.type === "edit"'),
     "⚠ kategoriyasiz ESKI tovar tahrirlanadi — qulf faqat to'ldirilganida");

  /* ⚠ SOTILMAGAN TOVAR OCHIQ QOLISHI SHART. Qulf «kategoriyasi bor»
     ga bog'lansa, kategoriyani bo'shatib bo'lmaydi va u abadiy
     o'chirilmas bo'lib qoladi — bu bir marta sodir bo'lgan. */
  ok(p.includes("catLocked !== false"),
     "⚠ tarixi yo'q tovarda kategoriya OCHIQ — aks holda kategoriya o'chirilmas bo'lib qoladi");
}

console.log("\n── Lug'at: uchala til ──");
{
  for (const lang of ["uz", "ru", "en"]) {
    const l = src("lib/locales/" + lang + ".js");
    const missing = ["products.needCategory", "products.pickCategory",
                     "products.noCategoriesYet", "products.categoryLocked"]
      .filter((k) => !l.includes('"' + k + '"'));
    ok(missing.length === 0, lang + ": to'rtala kalit bor" +
       (missing.length ? " — yetishmaydi: " + missing.join(", ") : ""));
  }
}

console.log(`\n${fail === 0 ? "✅" : "❌"}  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
