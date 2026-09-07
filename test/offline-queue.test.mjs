/* ══════════════════════════════════════════════════════════════════════════
   OFLAYN NAVBAT — SOTUV YO'QOLMAYDI

   ═══ NEGA BU SINOV ENG KERAKLISI ══════════════════════════════════════

   Kassaning eng asosiy va'dasi: internet yo'qolganda ham ishlaydi.
   Sotuv navbatga tushadi, chek chiqadi, mijoz ketadi — pul olingan,
   tovar berilgan. Navbat o'sha sotuvni yo'qotsa, do'kon pulni ham,
   hisobni ham yo'qotadi va buni faqat oy oxirida bilib qoladi.

   ⚠ SHU MODULDA BIRORTA SINOV YO'Q EDI. V85 da unda jiddiy xato
   tuzatilgan: 10 urinishdan keyin sotuv «failed» bo'lardi va
   urinishlar har 15 soniyada bo'lgani uchun bu IKKI YARIM DAQIQADA
   tugardi — Wi-Fi qayta ulanayotgan payt ham sotuvni yo'qotish
   uchun yetarli edi. Tuzatildi, lekin qo'riqlanmadi: ertaga kimdir
   «cheksiz sikl bo'lmasin» deb chegarani qaytarib qo'yishi mumkin.

   ═══ NIMA TEKSHIRILADI ════════════════════════════════════════════════

   Ikki xato bir-biriga qarama-qarshi va ikkalasi ham qimmat:

     · sotuvni ERTA tashlash  → pul olingan, hisobda yo'q;
     · rad etilganini CHEKSIZ qayta yuborish → haqiqiy muammo
       ko'rinmaydi, jurnal to'ladi.

   Chegara aniq: TARMOQ xatosi — cheksiz kutamiz; SERVER RAD ETSA
   (4xx) — kassirga ko'rsatamiz.

   Ishga tushirish:  node test/offline-queue.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { installFakeIndexedDb, installBrowserEnv } from "./helpers/fake-idb.mjs";

const db = installFakeIndexedDb();
const env = installBrowserEnv({ online: true });

const q = await import("../src/lib/ek-offline.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m);
                          if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));

/** Tarmoq xatosi — javob UMUMAN kelmadi. */
const networkError = () => Object.assign(new Error("Internet yo'q"), { offline: true });
/** Server javob berdi va rad etdi. */
const rejected = (status) => Object.assign(new Error("Rad etildi"), { status });

const reset = () => { db.clear(); env.setOnline(true); };
const row = (key) => db.rows().find((r) => r.key === key);
const sale = (n) => ({ items: [{ productId: n, quantity: 1 }], paymentType: "CASH" });

/* ══ 1. NAVBATGA TUSHADI ═══════════════════════════════════════════ */
console.log("\n══ 1. Sotuv navbatga tushadi ══");
{
  reset();
  const item = await q.enqueue(sale(1));

  ok(item.key ? "idempotentlik kaliti berildi" : bad("kalit yo'q"));
  eq(item.payload.idempotencyKey, item.key,
     "kalit YUKNING ICHIGA ham yozildi — serverdagi takrorlanishni shu to'sadi");
  eq(item.status, "pending", "holat «pending»");
  eq(await q.count(), 1, "navbatda bitta sotuv");
}

/* ══ 2. ⚠ TARMOQ XATOSIDA SOTUV YO'QOLMAYDI ════════════════════════ */
console.log("\n══ 2. ⚠ Tarmoq xatosi — sotuv YO'QOLMAYDI ══");
{
  reset();
  const item = await q.enqueue(sale(2));

  /* ⚠⚠ VAQT BOSHQARILADI VA BUSIZ SINOV BEKORGA O'TARDI.

     Birinchi variantda shunchaki `flush()` 30 marta chaqirilgandi va
     band yashil edi. Lekin o'lchab ko'rilganda MA'LUM BO'LDI:
     haqiqiy urinishlar soni 1 ta. Birinchi xatodan keyin
     `nextAttemptAt` kelajakka suriladi va keyingi `flush` lar
     yozuvni UMUMAN ko'rmaydi — ya'ni «pending qoldi» degan xulosa
     kodning to'g'riligidan emas, kutish oynasidan kelib chiqardi.
     Eski 10 urinishli chegara qaytarilsa ham sinov yashil turaverardi.

     Endi soat oldinga suriladi: har urinishdan keyin backoff oynasi
     HAQIQATAN o'tadi va 30 urinish 30 marta bo'ladi. */
  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  try {
    let calls = 0;
    q.setSender(async () => { calls++; throw networkError(); });
    for (let i = 0; i < 30; i++) {
      await q.flush();
      clock += 61_000;          // eng katta backoff — 60 s
    }

    const after = row(item.key);
    eq(calls, 30,
       "HAQIQATAN 30 marta urinildi (busiz band bekorga o'tardi)");
    eq(after?.attempts, 30, "urinishlar soni yozuvda ham 30");
    eq(after?.status, "pending",
       "30 urinishdan keyin ham «pending» - tarmoq tiklanmaguncha kutadi. "
       + "Eski kodda chegara 10 edi va sotuv IKKI YARIM DAQIQADA yo'qolardi");
    eq(await q.count(), 1, "sotuv navbatda turibdi, tashlanmadi");
  } finally {
    Date.now = realNow;
  }
}

/* ══ 3. SERVER RAD ETSA — KASSIR KO'RADI ═══════════════════════════ */
console.log("\n══ 3. Server RAD ETSA — «failed», cheksiz emas ══");
{
  reset();
  const item = await q.enqueue(sale(3));

  let calls = 0;
  q.setSender(async () => { calls++; throw rejected(400); });
  await q.flush();
  await q.flush();
  await q.flush();

  eq(row(item.key)?.status, "failed",
     "4xx dan keyin «failed» — qayta yuborish yordam bermaydi");
  eq(calls, 1,
     "«failed» bo'lgach QAYTA YUBORILMADI - aks holda jurnal to'lardi va "
     + "haqiqiy muammo ko'rinmasdi");
}

/* ══ 4. 5xx — TARMOQ KABI, RAD ETISH EMAS ══════════════════════════ */
console.log("\n══ 4. 5xx — server nosoz, sotuv aybdor emas ══");
{
  reset();
  const item = await q.enqueue(sale(4));
  q.setSender(async () => { throw rejected(503); });
  await q.flush();

  /* ⚠ NOZIK FARQ: 4xx «sening so'roving noto'g'ri», 5xx «menda
     muammo». Ikkinchisini «failed» qilish serverning vaqtincha
     nosozligi uchun sotuvni qurbon qilish bo'lardi. */
  eq(row(item.key)?.status, "pending",
     "5xx da sotuv navbatda qoladi — server tuzalganda yuboriladi");
}

/* ══ 5. MUVAFFAQIYAT — NAVBATDAN CHIQADI ═══════════════════════════ */
console.log("\n══ 5. Yuborilgan sotuv navbatdan chiqadi ══");
{
  reset();
  await q.enqueue(sale(5));

  let sent = 0;
  q.setSender(async () => { sent++; });
  await q.flush();

  eq(sent, 1, "bir marta yuborildi");
  eq(await q.count(), 0, "navbat bo'shadi");

  await q.flush();
  eq(sent, 1,
     "IKKINCHI marta yuborilmadi - aks holda mijozdan ikki marta pul olinardi");
}

/* ══ 6. OFLAYNDA HECH NARSA YUBORILMAYDI ═══════════════════════════ */
console.log("\n══ 6. Oflaynda navbat tegilmaydi ══");
{
  reset();
  await q.enqueue(sale(6));
  env.setOnline(false);

  let sent = 0;
  q.setSender(async () => { sent++; });
  await q.flush();

  /* ⚠ BU YERDA IKKI QATLAM HIMOYA BOR va buzib tekshirishda ma'lum
     bo'ldi: `flush` boshidagi `!navigator.onLine` qorovulini olib
     tashlash YETMAYDI — sikl ichida ham `if (!navigator.onLine)
     break` turibdi. Band faqat IKKALASI ham olib tashlanganda
     yiqildi.

     Ikkalasi ham kerak: birinchisi bekorga baza o'qishning oldini
     oladi, ikkinchisi esa YUBORISH PAYTIDA internet uzilsa qolgan
     cheklarni tashlab yubormaslik uchun. */
  eq(sent, 0, "internet yo'qligida urinilmadi");
  eq(await q.count(), 1, "sotuv joyida");
  env.setOnline(true);
}

/* ══ 7. TARTIB — CHEK RAQAMI TARTIBIDA ═════════════════════════════ */
console.log("\n══ 7. FIFO — sotuvlar tartibi saqlanadi ══");
{
  reset();
  const a = await q.enqueue({ ...sale(71), idempotencyKey: "aaa" });
  await new Promise((r) => setTimeout(r, 5));
  const b = await q.enqueue({ ...sale(72), idempotencyKey: "bbb" });
  await new Promise((r) => setTimeout(r, 5));
  const c = await q.enqueue({ ...sale(73), idempotencyKey: "ccc" });

  const order = [];
  q.setSender(async (p) => { order.push(p.idempotencyKey); });
  await q.flush();

  eq(order.join(","), "aaa,bbb,ccc",
     "eng eski sotuv birinchi ketdi - chek raqamlari tartibi shunga bog'liq");
  void a; void b; void c;
}

/* ══ 8. QO'LDA QAYTA URINISH ═══════════════════════════════════════ */
console.log("\n══ 8. Kassir «qayta urinish» bosadi ══");
{
  reset();
  const item = await q.enqueue(sale(8));
  q.setSender(async () => { throw rejected(400); });
  await q.flush();
  eq(row(item.key)?.status, "failed", "avval «failed» bo'ldi");

  /* Muammo hal qilindi (smena ochildi, tovar qaytarildi) — endi o'tadi. */
  let sent = 0;
  q.setSender(async () => { sent++; });
  await q.retry(item.key);
  await new Promise((r) => setTimeout(r, 20));

  eq(sent, 1, "qayta urinishdan keyin yuborildi");
  eq(await q.count(), 0, "navbatdan chiqdi");
}

console.log(`\n${fail ? "❌" : "✅"} oflayn navbat: ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
