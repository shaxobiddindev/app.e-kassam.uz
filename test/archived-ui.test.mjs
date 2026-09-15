/* ══════════════════════════════════════════════════════════════════════════
   ARXIVDAGI TOVAR — EKRANDAGI QISMI (B, 2/3/4-bandlar)

   ⚠ NEGA MATN BO'YICHA QO'RIQCHI. Server bu uchta yo'lni ALLAQACHON
   qaytarardi (`ARCHIVED`, `ARCHIVED_PRODUCT`, `POST /restore`), lekin
   frontend ularni O'QIMASDI. Hamma server sinovi yashil turardi va
   xususiyat ishlamasdi: kassir hamon «topilmadi» ni ko'rardi.

   Aynan shu xatoni P7 auditi topdi. Bu sinov uning qaytishini
   to'sadi: ulanish uzilsa — yiqiladi.

   Ishga tushirish:  node test/archived-ui.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
const { readFileSync } = await import("node:fs");

let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (Object.is(got, want)) { pass++; console.log("  ✅ " + msg); }
  else { fail++; console.log(`  ❌ ${msg}\n      kutilgan: ${want}\n      keldi:    ${got}`); }
};
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

console.log("\n── Kassa: arxivdagi barkod ──");
{
  const k = read("src/pages/KassaPage.jsx");

  eq(/r\.source === "ARCHIVED"/.test(k), true,
     "⚠ kassa `ARCHIVED` javobini umuman qaramaydi — kassir «topilmadi» ni ko'radi");
  eq(/archivedMatch/.test(k), true, "arxiv ma'lumoti o'qilmayapti");
  eq(/productApi\.restore\(/.test(k), true, "tiklash chaqirilmayapti");

  /* ⚠ TIKLASH HAMMAGA EMAS: server OWNER/SHOP_ADMIN/STOREKEEPER dan
     boshqasini qo'ymaydi. Kassirga tugma ko'rsatib keyin 403 berish
     faqat umid uyg'otardi. */
  eq(/canRestore/.test(k), true,
     "⚠ tiklash rolga qarab to'silmayapti — kassir 403 oladi");

  /* ⚠ ARXIVDA TOPILGANI XATO EMAS — hech kim noto'g'ri ish qilmadi.
     Tiklay olmaydigan kassirga XABAR beriladi (`info`), qizil xato
     emas.

     ⚠ `toast.error` ning O'ZI taqiqlanmaydi: tiklash so'rovi
     haqiqatan yiqilsa (tarmoq, 403) u XATO va shunday
     ko'rsatilishi kerak. Taqiqlanadigan narsa — HOLATNI xato deb
     ko'rsatish. */
  const block = k.slice(k.indexOf('r.source === "ARCHIVED"'));
  const informing = block.slice(0, block.indexOf("await confirm"));
  eq(/toast\.info\(t\("kassa\.archivedFound"/.test(informing), true,
     "⚠ tiklay olmaydigan kassirga xabar berilmayapti");
  eq(/toast\.error/.test(informing), false,
     "⚠ arxivdagi tovar HOLATI xato deb ko'rsatilyapti — u xato emas");
}

console.log("\n── Tovar formasi: ikkita yo'l ──");
{
  const p = read("src/pages/ProductsPage.jsx");

  eq(/ARCHIVED_PRODUCT/.test(p), true,
     "⚠ ziddiyat javobi o'qilmayapti — ega ikkita tugmani ko'rmaydi");
  eq(/createNew: true/.test(p), true, "«yangisini yarat» yo'li yo'q");
  eq(/productApi\.restore\(/.test(p), true, "«tiklash» yo'li yo'q");

  /* ⚠⚠ ENG MUHIM QO'RIQCHI — ESC TUZOG'I.
     `confirm()` ikki holatli: ESC ham, «bekor» ham `false` beradi.
     Agar `false` «yangisini yarat» ma'nosini olsa, oynani yopmoqchi
     bo'lib ESC bosgan ega JIMGINA tovar yaratib qo'yardi. Uchinchi
     holat — «hech narsa qilma» — shart, shuning uchun bu yerda
     alohida oyna ishlatiladi. */
  const save = p.slice(p.indexOf("ARCHIVED_PRODUCT"), p.indexOf("ARCHIVED_PRODUCT") + 700);
  eq(/await confirm\(/.test(save), false,
     "⚠ ziddiyat `confirm` bilan hal qilinyapti — ESC jimgina tovar yaratadi");
  eq(/setArchivedConflict\(/.test(save), true, "oyna holati qo'yilmayapti");
}

console.log("\n── Arxiv ro'yxati: o'chirilganlarni ko'rish va tiklash ──");
{
  /* ⚠ NEGA QO'RIQCHI KERAK. 2026-09-15 gacha bu ro'yxat UMUMAN yo'q
     edi: o'chirilgan tovarni faqat barkodini skanerlab topish mumkin
     edi, ya'ni xato o'chirilgan tovarni qaytarish uchun uni avval
     topish kerak edi-yu, topadigan ekran yo'q edi.

     Bu yerdagi uchta ulanishning bittasi uzilsa, ro'yxat JIMGINA
     noto'g'ri ishlaydi: `archived` yuborilmasa — ekranda «Arxiv» deb
     turib KATALOG chiziladi (server parametrsiz katalogni beradi). */
  const p = read("src/pages/ProductsPage.jsx");
  const api = read("src/api/index.js");

  eq(/archived,?\s*\n?\s*\}\);|archived,/.test(p), true,
     "⚠ `archived` serverga yuborilmayapti — «Arxiv» deb turib katalog chiziladi");
  eq(/p\.set\("archived", "true"\)/.test(api), true,
     "⚠ api qatlami `archived` parametrini qo'ymayapti");
  eq(/handleRestore/.test(p), true, "tovarlar sahifasida tiklash amali yo'q");

  /* ⚠ ARXIVDA TAHRIRLASH VA O'CHIRISH TUGMASI BO'LMASIN: server
     ularni baribir rad etadi (`findActiveById`), ishlamaydigan tugma
     esa eng yomon yo'l. */
  const at = p.indexOf("handleRestore(p)");
  /* Oraliq KENG: qatordagi izohlar uzun va ular ikkala tugma
     orasida turadi — tor oyna qo'riqchini kod O'ZGARMAGANDA ham
     yiqitardi. */
  const actions = at < 0 ? "" : p.slice(at - 600, at + 2400);
  eq(/archived \? \(/.test(actions), true,
     "⚠ tiklash tugmasi arxiv shartidan TASHQARIDA — u katalogda ham chiqadi");
  eq(/handleDelete\(p\)/.test(actions), true,
     "⚠ tahrirlash/o'chirish tugmalari arxivda ham qolgan — server ularni "
     + "baribir rad etadi, ishlamaydigan tugma esa eng yomon yo'l");

  /* ⚠ ROLGA QARAB: kassa ekranidagi bilan bir xil qoida. */
  eq(/canRestore/.test(p), true,
     "⚠ tiklash rolga qarab to'silmayapti — kassir 403 oladi");

  /* ⚠ ARXIVDA KOD REJIMI YO'Q: `*425` kassa qidiruviga ketadi va u
     o'chirilganlarni ATAYLAB qaytarmaydi — javob doim bo'sh bo'lardi. */
  eq(/!archived && isCodeQuery/.test(p), true,
     "⚠ arxivda kod rejimi yoqiq qolgan — natija doim bo'sh chiqadi");
}

console.log("\n── Uchala til ──");
{
  const keys = ["kassa.archivedAsk", "kassa.archivedFound", "kassa.archivedRestore",
                "products.archivedAsk", "products.archivedRestore",
                "products.archivedCreateNew", "products.restored",
                "products.archiveView", "products.catalogView", "products.archiveNote",
                "products.archiveEmpty", "products.archivedAtCol", "products.neverSold",
                "products.restore", "products.restoreTitle", "products.restoreAsk",
                "products.restoreNoRight"];
  for (const lang of ["uz", "ru", "en"]) {
    const src = read(`src/lib/locales/${lang}.js`);
    const miss = keys.filter((k) => !src.includes(`"${k}"`));
    eq(miss.length, 0, `${lang}: hamma yozuv joyida${miss.length ? " — yo'q: " + miss : ""}`);
  }
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
