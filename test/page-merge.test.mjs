/* ══════════════════════════════════════════════════════════════════════════
   CHEKSIZ RO'YXAT MANTIQI

   ⚠ ENG MUHIM SINOV — ESKI JAVOB SHAKLI. Server sahifalashni
   IXTIYORIY qildi (`Paging.maybe`), ya'ni ko'p endpoint hali
   to'liq massiv qaytaradi. Front ikkalasi bilan ham ishlashi shart;
   aks holda sahifalanmagan bo'lim bo'sh ko'rinardi.

   Ishga tushirish:  node test/page-merge.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import {
  PAGE_SIZE, emptyState, mergePage, readPage, shouldLoadMore,
} from "../src/lib/ek-page.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
};
const head = (s) => console.log(`\n── ${s} ──`);

const rows = (from, n) =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, name: "q" + (from + i) }));

/* ══ 1. JAVOB SHAKLI ══ */
head("Server javobi");
{
  const paged = readPage({ content: rows(0, 50), page: 0, size: 50, total: 120, hasNext: true });
  ok("sahifalangan javob o'qildi", paged.rows.length === 50 && paged.hasNext === true);
  ok("umumiy son olindi", paged.total === 120);
  ok("`paged` belgilandi", paged.paged === true);

  /* ⚠ ESKI SHAKL — sahifalanmagan endpoint. */
  const plain = readPage(rows(0, 7));
  ok("to'liq massiv ham o'qildi", plain.rows.length === 7);
  ok("to'liq massivda «yana bor» YO'Q", plain.hasNext === false,
     "aks holda cheksiz scroll bir xil ro'yxatni qayta so'rardi");
  ok("`paged` false", plain.paged === false);

  /* ⚠ `total: -1` — «sanalmadi», nol emas. */
  const unknown = readPage({ content: rows(0, 5), hasNext: true, total: -1 });
  ok("sanalmagan umumiy son `null` bo'ladi", unknown.total === null,
     "nol bo'lsa ekranda «0 ta topildi» chiqardi");

  /* ⚠ AUDIT JURNALINING O'Z SHAKLI — u `PageResponse` dan oldin
     yozilgan va serverda hamon shunday. */
  const audit = readPage({ items: rows(0, 50), page: 0, totalItems: 137, totalPages: 3 });
  ok("audit shakli (`items`) o'qildi", audit.rows.length === 50);
  ok("audit da `hasNext` sahifa raqamidan hisoblandi", audit.hasNext === true,
     "bu shaklda `hasNext` maydoni yo'q");
  ok("audit da umumiy son olindi", audit.total === 137);

  const auditLast = readPage({ items: rows(100, 37), page: 2, totalItems: 137, totalPages: 3 });
  ok("audit oxirgi sahifasida «yana bor» YO'Q", auditLast.hasNext === false,
     "3 sahifadan 3-si — tugadi");

  ok("buzuq javob yiqitmaydi", readPage(null).rows.length === 0
     && readPage(undefined).rows.length === 0
     && readPage({}).rows.length === 0
     && readPage("matn").rows.length === 0);
}

/* ══ 2. QO'SHISH ══ */
head("⚠ Spring `Page` shakli");
{
  /* ⚠ NEGA UCHINCHI SHAKL BOR. Umumiy katalog (admin paneli) bazadagi
     sahifalashni TO'G'RIDAN-TO'G'RI javobga chiqaradi — Spring'ning
     `Page` i: `{content, number, totalElements, totalPages}`. Bizning
     `PageResponse` esa `{content, page, size, total, hasNext}`.

     Ikkisi tashqi ko'rinishidan bir xil (`content` bor), ichi esa
     boshqa. Va aynan shu yerda JIM BUZILISH bo'lardi: Spring
     shaklida `hasNext` YO'Q, `Boolean(undefined)` → `false`, ya'ni
     cheksiz scroll BIRINCHI SAHIFADA to'xtab, ekranda «hammasi
     ko'rsatildi — 50 ta» deb yozilib turardi. Bazada mingtasi
     bo'lsa ham. */
  const r = readPage({ content: [{ id: 1 }], number: 0, totalElements: 137, totalPages: 3 });
  ok("qatorlar o'qildi", r.rows.length === 1);
  ok("⚠ `hasNext` YO'Q bo'lsa sahifa raqamidan hisoblanadi", r.hasNext === true);
  ok("jami son `totalElements` dan", r.total === 137);

  ok("⚠ oxirgi sahifada «yana bor» o'chadi",
     readPage({ content: [{ id: 9 }], number: 2, totalElements: 137, totalPages: 3 })
       .hasNext === false);

  /* ⚠ O'ZIMIZNING SHAKL BUZILMADI: unda `hasNext` BOR va u
     serverdan olinadi — hisoblanmaydi. */
  ok("o'zimizning shakl o'zgarmadi",
     readPage({ content: [{ id: 1 }], page: 0, size: 50, total: 137, hasNext: true })
       .hasNext === true);
  ok("o'zimizning shaklda `hasNext` yolg'on bo'lmaydi",
     readPage({ content: [], page: 2, size: 50, total: 137, hasNext: false })
       .hasNext === false);
}

head("Sahifalarni qo'shish");
{
  ok("bo'shdan boshlanadi", mergePage([], rows(0, 3)).length === 3);
  ok("ketma-ket qo'shiladi", mergePage(rows(0, 50), rows(50, 50)).length === 100);

  /* ⚠ ASOSIY HOLAT: ro'yxat ko'rilayotganda yangi qator qo'shilsa,
     chegara suriladi va bitta yozuv IKKI MARTA keladi. */
  const overlap = mergePage(rows(0, 50), rows(45, 50));
  ok("takrorlangan qator BIR MARTA qoladi", overlap.length === 95,
     `olindi: ${overlap.length}`);
  const ids = overlap.map((r) => r.id);
  ok("takror `id` yo'q", new Set(ids).size === ids.length);
  ok("tartib saqlandi", ids.every((v, i) => i === 0 || v > ids[i - 1]));

  /* ⚠ BUTUNLAY BIR XIL SAHIFA (tarmoq takrorlagan so'rov). */
  ok("bir xil sahifa ikki marta — o'zgarmaydi",
     mergePage(rows(0, 50), rows(0, 50)).length === 50);

  /* ⚠ KALITI YO'Q QATOR — hisobot qatorlari. */
  const noKey = mergePage([{ a: 1 }], [{ a: 2 }, { a: 3 }]);
  ok("kaliti yo'q qatorlar yo'qolmaydi", noKey.length === 3);

  ok("boshqa kalit bo'yicha ham ishlaydi",
     mergePage([{ code: "x" }], [{ code: "x" }, { code: "y" }], "code").length === 2);

  /* ⚠ ASL RO'YXAT O'ZGARMASLIGI kerak — React holati. */
  const before = rows(0, 3);
  const snapshot = JSON.stringify(before);
  mergePage(before, rows(3, 3));
  ok("kirish ro'yxati o'zgartirilmadi", JSON.stringify(before) === snapshot);

  ok("bo'sh sahifa qo'shilsa shu ro'yxat qaytadi",
     mergePage(rows(0, 5), []).length === 5);
  ok("buzuq kirish yiqitmaydi",
     mergePage(null, null).length === 0 && mergePage(undefined, rows(0, 2)).length === 2);
}

/* ══ 3. QACHON SO'RALADI ══ */
head("Keyingi sahifani so'rash sharti");
{
  ok("yana bor va bo'sh — so'raladi",
     shouldLoadMore({ hasNext: true, loading: false, error: null }) === true);
  ok("yana yo'q — so'ralmaydi",
     shouldLoadMore({ hasNext: false, loading: false, error: null }) === false);

  /* ⚠ YUKLANAYOTGANDA SO'RALMAYDI: scroll chegarasida kuzatuvchi
     bir necha marta ishga tushadi va bu o'nlab bir xil so'rov
     yuborardi. */
  ok("yuklanayotganda so'ralmaydi",
     shouldLoadMore({ hasNext: true, loading: true, error: null }) === false);

  /* ⚠ XATODAN KEYIN AVTOMATIK TAKRORLANMAYDI: aks holda tarmoq
     uzilganda cheksiz aylanish boshlanardi. */
  ok("xatodan keyin avtomatik takrorlanmaydi",
     shouldLoadMore({ hasNext: true, loading: false, error: "tarmoq" }) === false);
}

/* ══ 4. BOSHLANG'ICH HOLAT ══ */
head("Boshlang'ich holat");
{
  const s = emptyState();
  ok("bo'sh ro'yxatdan boshlanadi", s.rows.length === 0 && s.page === 0);
  /* ⚠ `hasNext` BOSHIDA `true`: aks holda birinchi sahifa ham
     so'ralmasdi va ro'yxat bo'sh qolardi. */
  ok("boshida «yana bor» true", s.hasNext === true,
     "false bo'lsa birinchi sahifa ham yuklanmasdi");
  ok("har chaqiruvda YANGI obyekt", emptyState() !== emptyState());
  ok("sahifa hajmi serverdagi bilan bir xil", PAGE_SIZE === 50);
}

/* ══ 5. KUTUBXONA TOZA ══ */
head("Kutubxona");
{
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, "..", "src", "lib", "ek-page.js"), "utf8");
  ok("i18n import qilinmagan", !/from\s+["'][^"']*ek-i18n/.test(src));
  ok("React import qilinmagan — sof mantiq", !/from\s+["']react["']/.test(src));
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
