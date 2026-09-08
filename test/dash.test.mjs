/* ══════════════════════════════════════════════════════════════════════════
   BOSH SAHIFANING MIYASI (V74)

   Bu yerda tekshiriladigan narsa — QAROR, ko'rinish emas. Bosh sahifa
   o'nlab satrni bitta ro'yxatga yig'ib, ularni tartiblaydi va qaysi
   biri qizil bo'lishini hal qiladi. Xato jimgina bo'ladi: satr
   noto'g'ri joyda turadi yoki umuman chiqmaydi, ekran esa buzilmaydi.

   ⚠ ENG QIMMAT QOIDA — «+40%» HAR DOIM YAXSHI EMAS. Tushumning 40%
   o'sishi bayram, qaytarishning 40% o'sishi falokat. Ikkalasi ham bir
   xil «+40%» bo'lib ko'rinadi va rangni faqat ko'rsatkichning O'ZI hal
   qiladi.
   ══════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import {
  buildAlerts, sortAlerts, moneyAtRisk, countBySeverity,
  changes, pctChange, opportunities, healthTone,
  WIDGETS, allowedWidgets, readLayout, saveLayout, move, toggle,
  comparePoints, T,
} from "../src/lib/ek-dash.js";

const LOCALES = Object.fromEntries(await Promise.all(
  ["uz", "ru", "en"].map(async (l) => [l, (await import(`../src/lib/locales/${l}.js`)).default])));

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};
const ids = (list) => list.map((a) => a.id);

/* ══════════════════════════════════════════════════════════════════
   OGOHLANTIRISHLAR
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Ogohlantirishlar markazi ──");

it("bo'sh ma'lumotda faqat «sotuv yo'q» chiqadi", () => {
  const a = buildAlerts({ hasSales: false });
  assert.deepEqual(ids(a), ["nosale"]);
  assert.equal(a[0].severity, "info");
});

it("savdo haqida MA'LUMOT YO'Q bo'lsa, «sotuv yo'q» DEYILMAYDI", () => {
  /* ⚠ Omborchida savdo so'rovi umuman yuborilmaydi. Bilmaslikni
     «yo'q» deb hisoblash unga har kuni yolg'on satr chiqarardi. */
  assert.deepEqual(buildAlerts({ hasSales: null }), [],
    "bilmaganda hech narsa aytilmaydi");
  assert.deepEqual(buildAlerts({ hasSales: undefined }), [],
    "berilmaganda ham xuddi shunday");
});

it("sotuv bor va muammo yo'q — ro'yxat BO'SH", () => {
  assert.deepEqual(buildAlerts({ hasSales: true }), []);
});

it("qizil satrlar sariqlardan YUQORIDA turadi", () => {
  const a = buildAlerts({
    signals: {
      cashShortage: { count: 1, amount: 50000 },
      staleOpenShifts: 3,
      customerDebt: { count: 2, amount: 900000 },
    },
  });
  const sev = a.map((x) => x.severity);
  assert.deepEqual(sev, ["critical", "warning", "info"],
    "tartib muhimlik bo'yicha: " + JSON.stringify(sev));
});

it("bir xil muhimlikda PUL ko'p bo'lgani yuqorida", () => {
  const a = buildAlerts({
    signals: {
      cashShortage: { count: 1, amount: 10000 },
      nonCashDiff:  { count: 1, amount: 800000 },
      stockShortage:{ count: 1, amount: 400000 },
    },
  });
  assert.deepEqual(ids(a), ["noncash", "stock", "cash"],
    "800k → 400k → 10k tartibida bo'lishi kerak");
});

it("«xavf ostidagi pul» faqat QIZIL satrlardan yig'iladi", () => {
  const a = buildAlerts({
    signals: {
      cashShortage: { count: 1, amount: 100000 },        // qizil
      supplierDebt: { count: 1, amount: 5000000 },       // sariq
      customerDebt: { count: 1, amount: 9000000 },       // ko'k
    },
  });
  assert.equal(moneyAtRisk(a), 100000,
    "sariq va ko'k satrlar «xavf» emas — ular reja, yo'qotish emas");
});

it("tugash bashorati: 2 kun — qizil, 7 kun — sariq", () => {
  const a = buildAlerts({
    hasSales: true,
    pulse: { stockouts: [
      { name: "Choy", daysLeft: 1, lostPerDay: 30000 },
      { name: "Non",  daysLeft: 5, lostPerDay: 10000 },
      { name: "Suv",  daysLeft: 9, lostPerDay: 90000 },   // ufqdan tashqarida
    ] },
  });
  const now = a.find((x) => x.id === "stockout-now");
  const soon = a.find((x) => x.id === "stockout-soon");
  assert.equal(now.severity, "critical");
  assert.equal(now.args.n, 1);
  assert.equal(soon.severity, "warning");
  assert.equal(soon.args.n, 1, "9 kunlik tovar ro'yxatga TUSHMAYDI");
});

it("ombordagi «tugagan» va «kam qolgan» ALOHIDA satr", () => {
  const a = buildAlerts({ hasSales: true, lowStock: [
    { quantity: 0 }, { quantity: 0 }, { quantity: 2 },
  ] });
  assert.equal(a.find((x) => x.id === "outofstock").count, 2);
  assert.equal(a.find((x) => x.id === "lowstock").count, 1);
  assert.equal(a.find((x) => x.id === "outofstock").severity, "critical");
  assert.equal(a.find((x) => x.id === "lowstock").severity, "warning");
});

it("marja ogohlantirishi SAVDOSIZ kunda chiqmaydi", () => {
  const off = buildAlerts({ hasSales: true, pulse: { today: { netSales: 0, margin: 0 } } });
  assert.equal(off.find((x) => x.id === "margin"), undefined,
    "savdo nol bo'lganda marja ham nol — bu «marja tushdi» degani emas");

  const on = buildAlerts({ hasSales: true, pulse: { today: { netSales: 500000, margin: 4 } } });
  assert.equal(on.find((x) => x.id === "margin").severity, "warning");
});

it("qaytarish ulushi chegaradan oshsa ogohlantiradi", () => {
  const p = { today: { netSales: 100000, returnAmount: 20000, returns: 3, margin: 30 } };
  const a = buildAlerts({ hasSales: true, pulse: p });
  const r = a.find((x) => x.id === "returns");
  assert.equal(r.args.v, 20, "20 000 / 100 000 = 20%");
  assert.equal(r.money, 20000);
});

it("jimlik faqat SOTUV BOSHLANGANDAN keyin ogohlantiradi", () => {
  const before = buildAlerts({ hasSales: true, pulse: { velocity: { sinceLastSaleMin: null } } });
  assert.equal(before.find((x) => x.id === "quiet"), undefined,
    "do'kon hali ochilmagan — «sotuv yo'q» xabari har kuni ertalab yonardi");

  const after = buildAlerts({ hasSales: true, pulse: { velocity: { sinceLastSaleMin: 120 } } });
  assert.equal(after.find((x) => x.id === "quiet").args.n, 120);
});

it("reja sur'atidan orqada qolish — faqat reja QO'YILGAN bo'lsa", () => {
  const noPlan = buildAlerts({ hasSales: true, pulse: { target: { monthly: null, pace: 50, progress: 0 } } });
  assert.equal(noPlan.find((x) => x.id === "pace"), undefined);

  const plan = buildAlerts({ hasSales: true, pulse: { target: { monthly: 1e7, pace: 50, progress: 30 } } });
  assert.equal(plan.find((x) => x.id === "pace").args.v, 20);
});

it("filial salomatligi pastligi bitta satrda jamlanadi", () => {
  const a = buildAlerts({ hasSales: true, pulse: { branches: [
    { name: "Chilonzor", health: 40 },
    { name: "Yunusobod", health: 55 },
    { name: "Sergeli",   health: 90 },
  ] } });
  const b = a.find((x) => x.id === "branch-health");
  assert.equal(b.args.n, 2, "uchtadan ikkitasi kasal");
  assert.equal(b.args.name, "Chilonzor", "eng yomoni nomma-nom ko'rsatiladi");
});

it("muhimlik bo'yicha sanoq", () => {
  const c = countBySeverity(buildAlerts({
    signals: { cashShortage: { count: 1, amount: 1 }, staleOpenShifts: 1,
               customerDebt: { count: 1, amount: 1 } },
  }));
  assert.deepEqual(c, { critical: 1, warning: 1, info: 1 });
});

it("sortAlerts asl ro'yxatni O'ZGARTIRMAYDI", () => {
  const src = [{ id: "a", severity: "info" }, { id: "b", severity: "critical" }];
  const out = sortAlerts(src);
  assert.deepEqual(ids(src), ["a", "b"], "manba tegilmasdan qolishi kerak");
  assert.deepEqual(ids(out), ["b", "a"]);
});

/* ══════════════════════════════════════════════════════════════════
   «NIMA O'ZGARDI?»
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Nima o'zgardi ──");

it("nol bazadan o'sish foizga aylanmaydi", () => {
  assert.equal(pctChange(100, 0), null, "cheksizlikni ekranga chiqarib bo'lmaydi");
  assert.equal(pctChange(0, 100), -100);
  assert.equal(pctChange(150, 100), 50);
});

it("tushumning o'sishi YAXSHI, qaytarishning o'sishi YOMON", () => {
  const now  = { netSales: 140, returns: 140, receipts: 10, avgReceipt: 14,
                 margin: 20, discount: 10, cancelledAmount: 0 };
  const prev = { netSales: 100, returns: 100, receipts: 10, avgReceipt: 14,
                 margin: 20, discount: 10, cancelledAmount: 0 };
  const c = changes(now, prev, 5);
  const sales = c.find((x) => x.key === "netSales");
  const rets  = c.find((x) => x.key === "returns");
  assert.equal(sales.pct, 40);
  assert.equal(rets.pct, 40, "ikkalasi ham +40%");
  assert.equal(sales.tone, "good");
  assert.equal(rets.tone, "bad", "AYNAN SHU — bir xil foiz, teskari ma'no");
});

it("kichik farqlar ro'yxatga TUSHMAYDI", () => {
  const now  = { netSales: 103, returns: 0, receipts: 10, avgReceipt: 10,
                 margin: 20, discount: 0, cancelledAmount: 0 };
  const prev = { netSales: 100, returns: 0, receipts: 10, avgReceipt: 10,
                 margin: 20, discount: 0, cancelledAmount: 0 };
  assert.deepEqual(changes(now, prev), [],
    `3% farq ${T.changeMin}% chegaradan past — shovqin`);
});

it("marja PUNKT bilan o'lchanadi, foizning foizi bilan emas", () => {
  const now  = { netSales: 100, returns: 0, receipts: 10, avgReceipt: 10,
                 margin: 25, discount: 0, cancelledAmount: 0 };
  const prev = { netSales: 100, returns: 0, receipts: 10, avgReceipt: 10,
                 margin: 20, discount: 0, cancelledAmount: 0 };
  const m = changes(now, prev)[0];
  assert.equal(m.key, "margin");
  assert.equal(m.diff, 5, "20% → 25% = +5 punkt (+25% EMAS)");
  assert.equal(m.pct, null);
});

it("eng sezilarli o'zgarish birinchi turadi va soni cheklangan", () => {
  const now  = { netSales: 200, returns: 12, receipts: 11, avgReceipt: 18,
                 margin: 20, discount: 50, cancelledAmount: 0 };
  const prev = { netSales: 100, returns: 10, receipts: 10, avgReceipt: 10,
                 margin: 20, discount: 10, cancelledAmount: 0 };
  const c = changes(now, prev, 2);
  assert.equal(c.length, 2, "ro'yxat cheklangan — uzun ro'yxat o'qilmaydi");
  assert.equal(c[0].key, "discount", "+400% eng katta o'zgarish");
});

it("taqqoslash davri bo'lmasa ro'yxat bo'sh", () => {
  assert.deepEqual(changes(null, { netSales: 1 }), []);
  assert.deepEqual(changes({ netSales: 1 }, null), []);
});

/* ══════════════════════════════════════════════════════════════════
   IMKONIYATLAR
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Imkoniyatlar ──");

it("ishonchsiz juftlik taklif qilinmaydi", () => {
  const weak = opportunities({ analytics: { basket: [{ nameA: "A", nameB: "B", confidence: 12 }] } });
  assert.equal(weak.find((o) => o.id === "basket"), undefined,
    "12% ishonch — tasodif, taklif emas");

  const strong = opportunities({ analytics: { basket: [{ nameA: "Choy", nameB: "Shakar", confidence: 68 }] } });
  assert.equal(strong[0].args.v, 68);
  assert.equal(strong[0].args.a, "Choy");
});

it("eng gavjum soat topiladi", () => {
  const o = opportunities({ analytics: { hourly: [
    { hour: 9, netSales: 100 }, { hour: 18, netSales: 900 }, { hour: 20, netSales: 300 },
  ] } });
  assert.equal(o.find((x) => x.id === "peak").args.h, 18);
});

it("savdosiz soatlardan «cho'qqi» yasalmaydi", () => {
  const o = opportunities({ analytics: { hourly: [{ hour: 9, netSales: 0 }] } });
  assert.equal(o.find((x) => x.id === "peak"), undefined);
});

it("takliflar soni cheklangan", () => {
  const o = opportunities({
    analytics: {
      basket: [{ nameA: "A", nameB: "B", confidence: 90 }],
      stock: { slowMoving: [{ name: "S", stockValue: 1000 }] },
      hourly: [{ hour: 18, netSales: 900 }],
      customers: { segments: { AT_RISK: 5 } },
    },
    pulse: { stockouts: [{ name: "P", daysLeft: 2, lostPerDay: 500 }] },
  }, 3);
  assert.equal(o.length, 3);
});

/* ══════════════════════════════════════════════════════════════════
   VIDJETLAR
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Vidjetlar ──");

it("omborchiga PUL ko'rsatadigan bloklar berilmaydi", () => {
  const w = allowedWidgets(false);
  assert.ok(w.length > 0, "omborchida ham bloklar bor");
  assert.ok(w.every((x) => !x.money), "pul bloklari umuman ro'yxatga kirmaydi");
  assert.ok(w.some((x) => x.id === "alerts"), "ogohlantirishlar unga ham kerak");
  assert.ok(w.some((x) => x.id === "stock"));
});

it("rahbarga hamma blok ochiq", () => {
  assert.equal(allowedWidgets(true).length, WIDGETS.length);
});

it("YANGI blok eski saqlangan tartibda ham KO'RINADI", () => {
  /* Saqlangan ro'yxat faqat ikkita blokni biladi. Qolganlari — yangi. */
  const saved = { order: ["alerts", "kpi"], hidden: [] };
  const list = readLayout(true, saved);
  assert.equal(list.length, WIDGETS.length,
    "saqlangan ro'yxat haqiqat manbayi emas — yangi blok yo'qolmasligi kerak");
  assert.equal(list[0].id, "alerts", "saqlangan tartib qo'llanadi");
  assert.equal(list[1].id, "kpi");
  assert.ok(list.every((w) => w.on), "yashirilmagani yoqiq");
});

it("yashirilgan blok o'chiq, lekin ro'yxatda qoladi", () => {
  const list = readLayout(true, { order: [], hidden: ["live"] });
  const live = list.find((w) => w.id === "live");
  assert.equal(live.on, false, "qayta yoqish uchun ro'yxatda turishi kerak");
});

it("buzuq saqlangan holat ekranni yiqitmaydi", () => {
  assert.equal(readLayout(true, "shalabalon").length, WIDGETS.length);
  assert.equal(readLayout(true, { order: "yo'q", hidden: 5 }).length, WIDGETS.length);
});

it("saqlash tartib va yashirilganlarni yozadi", () => {
  const list = toggle(readLayout(true, null), "live");
  const data = saveLayout(list);
  assert.deepEqual(data.hidden, ["live"]);
  assert.equal(data.order.length, WIDGETS.length);
});

it("blokni surish chetdan chiqmaydi", () => {
  const list = readLayout(true, null);
  const first = list[0].id;
  assert.equal(move(list, first, -1)[0].id, first, "birinchisi yuqoriga chiqmaydi");
  const last = list[list.length - 1].id;
  assert.equal(move(list, last, 1)[list.length - 1].id, last, "oxirgisi pastga tushmaydi");
});

it("surish ikkita blokni ALMASHTIRADI", () => {
  const list = readLayout(true, null);
  const [a, b] = [list[0].id, list[1].id];
  const out = move(list, b, -1);
  assert.deepEqual([out[0].id, out[1].id], [b, a]);
});

/* ══════════════════════════════════════════════════════════════════
   EGRI CHIZIQ
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Bugun va kecha ──");

it("bugungi chiziq joriy soatda TUGAYDI — nolga qulamaydi", () => {
  const today = [{ hour: 0, netSales: 0 }, { hour: 1, netSales: 500 }];
  const ref = Array.from({ length: 24 }, (_, h) => ({ hour: h, netSales: h * 100 }));
  const pts = comparePoints(today, ref);

  assert.equal(pts.length, 24, "o'q to'liq sutkani ko'rsatadi");
  assert.equal(pts[1].today, 500);
  assert.equal(pts[2].today, null,
    "yetishmagan soat NOL emas, YO'Q — nol qo'yilsa chiziq pastga qulardi");
  assert.equal(pts[23].ref, 2300, "taqqoslash chizig'i esa oxirigacha boradi");
});

it("bo'sh ma'lumotda ham 24 nuqta qaytadi", () => {
  const pts = comparePoints([], []);
  assert.equal(pts.length, 24);
  assert.ok(pts.every((p) => p.today === null && p.ref === null));
  assert.equal(pts[9].label, "09", "yorliq ikki xonali");
});

/* ══════════════════════════════════════════════════════════════════
   SALOMATLIK
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Salomatlik bali ──");

it("ball rangga aylanadi", () => {
  assert.equal(healthTone(95), "good");
  assert.equal(healthTone(80), "good");
  assert.equal(healthTone(70), "warn");
  assert.equal(healthTone(59), "bad");
  assert.equal(healthTone(0), "bad");
});

/* ══════════════════════════════════════════════════════════════════
   KALENDAR VA VAZIFALAR (V72)
   ══════════════════════════════════════════════════════════════════ */
console.log("\n── Kalendar va vazifalar ──");

it("kechikkan vazifa — sariq, bugungisi — ko'k", () => {
  const a = buildAlerts({ hasSales: true, plan: { tasks: { open: 5, overdue: 2, dueToday: 1 } } });
  assert.equal(a.find((x) => x.id === "task-overdue").severity, "warning");
  assert.equal(a.find((x) => x.id === "task-overdue").count, 2);
  assert.equal(a.find((x) => x.id === "task-today").severity, "info");
});

it("shunchaki OCHIQ vazifa ogohlantirish EMAS", () => {
  /* ⚠ Har ochiq vazifa uchun satr chiqarilsa, blok ish rejasiga
     aylanardi va haqiqiy muammolar orasida yo'qolardi. */
  const a = buildAlerts({ hasSales: true, plan: { tasks: { open: 9, overdue: 0, dueToday: 0 } } });
  assert.deepEqual(a, []);
});

it("uzoqdagi voqea ogohlantirishga TUSHMAYDI", () => {
  const far = buildAlerts({ hasSales: true, plan: {
    events: [{ title: "Bayram", daysAway: 12, active: false, remindDays: 0 }] } });
  assert.equal(far.find((x) => x.id === "event-soon"), undefined,
    "o'n ikki kundan keyingi bayram ogohlantirish emas — u kalendarning ishi");
});

it("voqeaning O'Z eslatish oynasi hurmat qilinadi", () => {
  /* Ijara to'lovi besh kun oldin kerak, oddiy chegara esa uch kun. */
  const a = buildAlerts({ hasSales: true, plan: {
    events: [{ title: "Ijara", daysAway: 5, active: false, remindDays: 5 }] } });
  const e = a.find((x) => x.id === "event-soon");
  assert.equal(e.args.name, "Ijara");
  assert.equal(e.args.n, 5);
});

it("bugun boshlangan voqea BOSHQA matn oladi", () => {
  const today = buildAlerts({ hasSales: true, plan: {
    events: [{ title: "Navro'z", daysAway: 0, active: true, remindDays: 0 }] } });
  assert.equal(today.find((x) => x.id === "event-soon").key, "dash.alertEventToday");

  const soon = buildAlerts({ hasSales: true, plan: {
    events: [{ title: "Navro'z", daysAway: 2, active: false, remindDays: 0 }] } });
  assert.equal(soon.find((x) => x.id === "event-soon").key, "dash.alertEventSoon");
});

it("bir nechta voqea BITTA satrga yig'iladi", () => {
  const a = buildAlerts({ hasSales: true, plan: { events: [
    { title: "Birinchi", daysAway: 0, active: true, remindDays: 0 },
    { title: "Ikkinchi", daysAway: 1, active: false, remindDays: 0 },
  ] } });
  const rows = a.filter((x) => x.id === "event-soon");
  assert.equal(rows.length, 1, "har voqeaga alohida satr ro'yxatni ko'mib tashlardi");
  assert.equal(rows[0].count, 2, "lekin nechtaligi ko'rinadi");
});

it("kalendar va vazifa bloki OMBORCHIGA ham ochiq", () => {
  assert.ok(allowedWidgets(false).some((w) => w.id === "plan"),
    "vazifa aynan omborchi bajaradigan ish — undan yashirishning ma\'nosi yo\'q");
});

/* ══════════════════════════════════════════════════════════════════
   TARJIMA QAMROVI

   ⚠ BU SINOV HAQIQIY XATODAN KEYIN YOZILDI. Ogohlantirish matnlari
   `ek-dash.js` da KALIT sifatida tug'iladi (`dash.alertStockoutNow`),
   sahifada esa faqat `t(a.key)` turadi. Shu sababli kalitlarni
   sahifadan izlaydigan tekshiruv ularni KO'RMASDI va yettita kalit
   tarjimasiz qoldi — ekranda foydalanuvchiga «dash.alertStockoutNow»
   degan yozuv chiqdi. Endi kalitlar manbadan, ya'ni funksiyaning
   O'ZIDAN olinadi.
   ══════════════════════════════════════════════════════════════════ */
/* ══ NARXI TAN NARXDAN PAST TOVARLAR (V99) ═══════════════════════════
   Do'kon egasi: «yangi partiya kelganda tan narxi sotuv narxidan yoki
   OPTOM narxdan oshib ketsa?» Kirim paytidagi tavsiya bir martalik —
   oyna yopilsa yo'qoladi. Bu signal esa narx tuzatilgunicha turadi. */
console.log("\n── Narxi tan narxdan past (V99) ──");

it("signal chiqadi va SON bilan", () => {
  const a = buildAlerts({ signals: { pricedBelowCost: 3 } })
    .find((x) => x.id === "below-cost");
  assert.ok(a, "signal chiqishi kerak");
  assert.equal(a.count, 3);
  assert.equal(a.severity, "critical", "zarariga sotish — kritik");
});

it("⚠ MANZIL FILTR BILAN — usiz egasi yuzta tovar orasida qoladi", () => {
  const a = buildAlerts({ signals: { pricedBelowCost: 1 } })
    .find((x) => x.id === "below-cost");
  assert.equal(a.to, "/products?below=1");
});

it("nol bo'lsa signal YO'Q — bo'sh satr blokni ishonchsiz qiladi", () => {
  assert.equal(buildAlerts({ signals: { pricedBelowCost: 0 } })
    .find((x) => x.id === "below-cost"), undefined);
  assert.equal(buildAlerts({ signals: {} })
    .find((x) => x.id === "below-cost"), undefined);
});

console.log("\n── Tarjima qamrovi ──");

/** Barcha mumkin bo'lgan ogohlantirish chiqadigan holat. */
const EVERY = {
  hasSales: false,
  lowStock: [{ quantity: 0 }, { quantity: 5 }],
  signals: {
    shiftWindowDays: 7, stockWindowDays: 30,
    cashShortage: { count: 1, amount: 1 }, nonCashDiff: { count: 1, amount: 1 },
    stockShortage: { count: 1, amount: 1 }, supplierDebt: { count: 1, amount: 1 },
    customerDebt: { count: 1, amount: 1 }, overdueDebt: { count: 1, amount: 1 },
    disputedDebts: 1, staleOpenShifts: 1, staleTransfers: 1,
    /* ⚠ YANGI SIGNAL SHU RO'YXATGA QO'SHILISHI SHART. Aks holda
       quyidagi tarjima qamrovi uni umuman KO'RMAYDI: kalitlar
       `buildAlerts(EVERY)` natijasidan olinadi va signalsiz holat
       kalitni tug'dirmaydi. Aynan shu naqsh bo'yicha ilgari yettita
       kalit tarjimasiz qolib, ekranda «dash.alertStockoutNow» degan
       yozuv chiqqan edi. */
    pricedBelowCost: 3,
  },
  pulse: {
    today: { netSales: 100, margin: 1, returnAmount: 50, returns: 2 },
    velocity: { sinceLastSaleMin: 200 },
    target: { monthly: 1, pace: 90, progress: 10 },
    branches: [{ name: "X", health: 10 }],
    stockouts: [{ name: "A", daysLeft: 1, lostPerDay: 5 },
                { name: "B", daysLeft: 5, lostPerDay: 5 }],
  },
  plan: {
    tasks: { open: 4, overdue: 2, dueToday: 1, mine: 1, top: [] },
    events: [{ id: 1, title: "Navro'z", daysAway: 0, active: true, remindDays: 0 }],
  },
};

/* «{n} kundan keyin» matni FAOL BO'LMAGAN voqeada chiqadi — yuqoridagi
   namunada voqea bugungi, shuning uchun ikkinchisi kerak. */
const EVERY_SOON = {
  hasSales: true,
  plan: { events: [{ id: 2, title: "Ijara", daysAway: 2, active: false, remindDays: 0 }] },
};

const EVERY_OPP = {
  analytics: {
    basket: [{ nameA: "a", nameB: "b", confidence: 90 }],
    stock: { slowMoving: [{ name: "s", stockValue: 1 }] },
    hourly: [{ hour: 18, netSales: 9 }],
    customers: { segments: { AT_RISK: 3 } },
  },
  pulse: { stockouts: [{ name: "p", daysLeft: 2, lostPerDay: 1 }] },
};

const emitted = new Set();
for (const a of buildAlerts(EVERY)) emitted.add(a.key);
for (const a of buildAlerts(EVERY_SOON)) emitted.add(a.key);
for (const o of opportunities(EVERY_OPP, 99)) emitted.add(o.key);
for (const w of WIDGETS) emitted.add(w.key);

it("hamma ogohlantirish CHIQADI — sinov o'zi ham tekshiriladi", () => {
  assert.ok(buildAlerts(EVERY).length >= 15,
    "kamida o'n beshta satr kutilgan, kelgan: " + buildAlerts(EVERY).length);
});

for (const lang of ["uz", "ru", "en"]) {
  const L = (await import(`../src/lib/locales/${lang}.js`)).default;
  it(`${lang}: ek-dash chiqaradigan hamma kalit tarjima qilingan`, () => {
    const miss = [...emitted].filter((k) => !(k in L));
    assert.deepEqual(miss, [], "tarjimasiz: " + miss.join(", "));
  });
}

it("o'rin egallovchilar uchala tilda ham bir xil", () => {
  const [uz, ru, en] = ["uz", "ru", "en"].map((l) => LOCALES[l]);
  const ph = (v) => [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const k of emitted) {
    assert.equal(ph(ru[k]), ph(uz[k]), `${k}: ru`);
    assert.equal(ph(en[k]), ph(uz[k]), `${k}: en`);
  }
});

console.log(`\n${fail ? "❌" : "✅"} dash: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
