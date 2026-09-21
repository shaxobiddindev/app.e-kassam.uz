/* ══════════════════════════════════════════════════════════════════════════
   OFLAYN KATALOG — KASSIR SAVATNI YIG'A OLADIMI

   ═══ NEGA BU SINOV ═══════════════════════════════════════════════════

   «Kassir ekrani internetsiz ishlaydi» — o'zgarmas qoidalardan biri.
   Amalda uning YARMI ishlardi: tayyor savatni YUBORISH oflayn
   ishlardi (`offline-queue.test.mjs`), savatni YIG'ISH esa yo'q.
   Barkod skanerlansa serverga so'rov ketardi va internetsiz kassir
   «topilmadi» ni ko'rardi; sahifa yangilansa katalog bo'sh qolardi.

   ═══ NIMA TEKSHIRILADI ═══════════════════════════════════════════════

   Uchta narsa va uchalasi ham kassirning ish kuniga tegadi:

     1. KOD TOPILADIMI — oddiy barkod, do'kon kodi, QADOQ barkodi;
     2. KESH TO'G'RI YANGILANADIMI — to'liq surat, farq, arxivlangan
        tovarning O'CHISHI, filial almashganda tashlanishi;
     3. QOLDIQ YO'QLIGI ROSTLIGICHA QOLADIMI — `stockQuantity: null`,
        ya'ni «noma'lum», nol emas. Nol bo'lsa `addToCart` «omborda
        qolmagan» deb rad etardi va oflayn kassa umuman sotmasdi.

   Ishga tushirish:  node test/catalog-offline.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { installFakeIndexedDb, installBrowserEnv } from "./helpers/fake-idb.mjs";

const db = installFakeIndexedDb();
installBrowserEnv({ online: true });

const cat = await import("../src/lib/ek-catalog.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m);
                          if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));

/* ── Sinov ma'lumoti ─────────────────────────────────────────────── */

const cola = {
  id: 1, name: "Coca-Cola 1L", barcode: "4780000000017", searchCode: "2000015",
  salePrice: 12000, unit: "DONA", unitDecimals: 0, favorite: true, categoryId: 7,
  packs: [{ barcode: "4780000000024", packQty: 12, label: "Quti" }],
};
const milk = {
  id: 2, name: "Sut 1L", barcode: "4780000000031", salePrice: 9000,
  unit: "DONA", unitDecimals: 0, categoryId: 8, packs: [],
};
const cheese = {
  id: 3, name: "Pishloq", barcode: "4780000000048", salePrice: 45000,
  unit: "KG", unitDecimals: 3, categoryId: 8, packs: [],
};

/** Serverning javobini taqlid qiladi. */
const reply = (products, { full = true, goneIds = [], syncedAt = "2026-09-21T10:00:00Z" } = {}) =>
  ({ data: { syncedAt, full, total: products.length, products, goneIds } });

/* ══ 1. KOD BO'YICHA TOPISH ════════════════════════════════════════ */
console.log("\n══ 1. Kod bo'yicha topish ══");
{
  const index = cat.buildIndex([cola, milk, cheese]);

  const byBarcode = cat.lookupIn(index, "4780000000017");
  eq(byBarcode.source, "PRODUCT", "oddiy barkod topildi");
  eq(byBarcode.product.name, "Coca-Cola 1L", "to'g'ri tovar qaytdi");
  eq(byBarcode.quantity, 1, "miqdor 1");

  /* ⚠ QADOQ — oflaynda uni taniydigan boshqa hech narsa yo'q edi:
     kassir quti skanerlab «topilmadi» ni ko'rardi. */
  const byPack = cat.lookupIn(index, "4780000000024");
  eq(byPack.source, "PACK", "qadoq barkodi PACK deb tanildi");
  eq(byPack.quantity, 12, "quti = 12 dona");
  eq(byPack.packLabel, "Quti", "qadoq nomi aytiladi");

  eq(cat.lookupIn(index, "2000015").product?.id, 1, "do'konning o'z kodi bilan topildi");
  eq(cat.lookupIn(index, "  4780000000031  ").product?.id, 2, "probellar tozalanadi");
  eq(cat.lookupIn(index, "9999999999999").source, "NONE", "yo'q kod — NONE");
}

/* ══ 2. QOLDIQ — ROST AYTILADI ════════════════════════════════════ */
console.log("\n══ 2. Qoldiq noma'lum va shunday deyiladi ══");
{
  const p = cat.asUiProduct(cola);

  /* ⚠ ENG MUHIM SATR. `null` — «noma'lum»; `0` bo'lsa `addToCart`
     «omborda qolmagan» deb rad etardi va oflayn kassa umuman
     sotmasdi. `stockError` esa `null` ni «qoldiq tushunchasi yo'q»
     deb o'qiydi va tekshirmaydi. */
  eq(p.stockQuantity, null, "⚠⚠ qoldiq NOMA'LUM (null), nol emas");
  eq(p.expired, false, "muddat qoldiqdan kelib chiqadi — oflaynda tekshirilmaydi");
  eq(p.offline, true, "qator keshdan kelgani BELGILANADI");
  eq(p.salePrice, 12000, "narx o'zgarmaydi");

  /* Manba obyekt tegilmaydi — kesh yozuvi buzilmasin. */
  eq(cola.stockQuantity, undefined, "manba yozuv o'zgarmadi");
}

/* ══ 3. NOM BO'YICHA QIDIRUV ══════════════════════════════════════ */
console.log("\n══ 3. Nom bo'yicha qidiruv ══");
{
  const all = [cola, milk, cheese];

  const s = cat.searchIn(all, "sut");
  eq(s.length, 1, "«sut» bo'yicha bitta natija");
  eq(s[0].name, "Sut 1L", "topilgani to'g'ri");

  /* Boshlanadiganlar OLDIN — kassir terayotgan so'z odatda boshidan. */
  const p = cat.searchIn([{ ...milk, name: "Qaymoqli sut" }, milk], "sut");
  eq(p[0].name, "Sut 1L", "nomi «sut» dan boshlanadigani birinchi");

  eq(cat.searchIn(all, "", { categoryId: 8 }).length, 2, "kategoriya filtri ishlaydi");
  eq(cat.searchIn(all, "", { favorites: true }).length, 1, "«tez tovarlar» filtri ishlaydi");
  eq(cat.searchIn(all, "478000000004").length, 1, "kod bo'yicha ham topiladi");
  eq(cat.searchIn(all, "", { limit: 2 }).length, 2, "chegara hurmat qilinadi");
  eq(cat.searchIn(all, "yo'q narsa").length, 0, "topilmasa bo'sh ro'yxat");
}

/* ══ 4. SINXRONIZATSIYA ═══════════════════════════════════════════ */
console.log("\n══ 4. Kesh yangilanishi ══");
{
  await cat.clear();

  /* To'liq surat. */
  let asked = null;
  let res = await cat.sync({
    shopId: 10,
    fetcher: (since, shopId) => { asked = { since, shopId }; return reply([cola, milk]); },
  });
  eq(asked.since, null, "birinchi sinxronizatsiya TO'LIQ (since yo'q)");
  eq(asked.shopId, 10, "filial serverga uzatiladi");
  eq(res.count, 2, "ikkita tovar keshga tushdi");
  eq((await cat.lookup("4780000000017")).product?.id, 1, "keshdan topiladi");

  /* Farq — oldingi `syncedAt` qaytariladi. */
  res = await cat.sync({
    shopId: 10,
    fetcher: (since) => {
      asked = { since };
      return reply([cheese], { full: false, syncedAt: "2026-09-21T11:00:00Z" });
    },
  });
  eq(asked.since, "2026-09-21T10:00:00Z",
     "⚠ keyingi so'rov SERVER bergan sanani qaytaradi");
  eq(res.count, 3, "farq ustiga qo'shildi, eskisi joyida qoldi");
  eq((await cat.lookup("4780000000031")).product?.id, 2, "eski tovar keshda qoldi");

  /* Arxivlangan tovar — keshdan CHIQADI. */
  await cat.sync({
    shopId: 10,
    fetcher: () => reply([], { full: false, goneIds: [2], syncedAt: "2026-09-21T12:00:00Z" }),
  });
  eq((await cat.lookup("4780000000031")).source, "NONE",
     "⚠⚠ arxivlangan tovar keshdan o'chdi — aks holda oflaynda abadiy sotilardi");
  eq((await cat.info()).count, 2, "qolganlari joyida");
}

/* ══ 5. FILIAL ALMASHSA ═══════════════════════════════════════════ */
console.log("\n══ 5. Filial almashsa kesh tashlanadi ══");
{
  let asked = null;
  await cat.sync({
    shopId: 20,
    fetcher: (since) => { asked = { since }; return reply([milk]); },
  });
  eq(asked.since, null,
     "⚠ boshqa filial — TO'LIQ qayta yuklanadi, farq emas");
  eq((await cat.info()).count, 1, "eski filialning tovarlari qolmadi");
  eq((await cat.lookup("4780000000017")).source, "NONE",
     "⚠ birinchi filialning barkodi ikkinchisida ochilmaydi");
}

/* ══ 6. KESHNING ESKILIGI ═════════════════════════════════════════ */
console.log("\n══ 6. Kesh qanchalik eski ══");
{
  const now = Date.UTC(2026, 8, 21, 12, 0, 0);
  const hours = (n) => now - n * 3_600_000;

  eq(cat.freshness(null, now), "none", "hech qachon yuklanmagan");
  eq(cat.freshness(hours(2), now), "fresh", "2 soat — yangi");
  eq(cat.freshness(hours(24), now), "stale", "bir kun — eskirgan");
  eq(cat.freshness(hours(100), now), "old", "to'rt kun — eski");
}

/* ══ 7. XATO SOTUVNI TO'XTATMAYDI ═════════════════════════════════ */
console.log("\n══ 7. Server javob bermasa ══");
{
  const before = (await cat.info()).count;
  let threw = false;
  try {
    await cat.sync({ shopId: 20, fetcher: () => { throw new Error("Internet yo'q"); } });
  } catch (_) { threw = true; }

  ok(threw ? "xato chaqiruvchiga qaytadi (u o'zi yutadi)"
           : "xato yutilib ketdi — chaqiruvchi bilmay qoladi");
  eq((await cat.info()).count, before,
     "⚠ yuklanmagan sinxronizatsiya mavjud keshni buzmaydi");
}

console.log(`\n${fail ? "❌" : "✅"} oflayn katalog: ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
