/* ══════════════════════════════════════════════════════════════════════════
   BOSH SAHIFA (V74) — brauzerda

   ═══ NEGA BU TEKSHIRUV KERAK ═══════════════════════════════════════════

   Bosh sahifa — ilovaning BIRINCHI ekrani. U yiqilsa, foydalanuvchi
   boshqa hech qayerga o'ta olmaydi: menyu ham, kassa ham ortida qoladi.
   Shu sababli bu yerda tekshiriladigan narsa go'zallik emas, TIRIK
   QOLISH:

     · o'n beshta blok ham chizildi va JS xatosi tushmadi;
     · SERVER BO'SH javob qaytarganda ham yiqilmaydi (yangi do'kon);
     · maydonlar YETISHMAGANDA ham yiqilmaydi (server javobi o'zgardi);
     · omborchiga PUL so'rovi umuman YUBORILMAYDI (403 o'rniga);
     · avto-yangilanish OG'IR so'rovni takrorlamaydi;
     · Ctrl+K ochiladi va Esc yopadi;
     · bloklarni yashirish ishlaydi va SAQLANADI.

   ⚠ CORS sarlavhalari shart — sababi `check-pay.mjs` da.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-dash.mjs
     SHOT_DIR=/tmp/shots — skrinshotlar
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4619;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  let file = path.join(DIST, url === "/" ? "index.html" : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--no-proxy-server"],
});
const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

let pageErrors = [];
let pass = 0, fail = 0;
const ok  = (m, x = "") => { pass++; console.log(`  ✅ ${m}${x ? ` (${x})` : ""}`); };
const bad = (m, x = "") => { fail++; console.log(`  ❌ ${m}${x ? ` — ${x}` : ""}`); };
const is  = (c, m, x = "") => (c ? ok(m, x) : bad(m, x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Soxta javoblar ─────────────────────────────────────────────────── */
const HOUR = (n) => Array.from({ length: n }, (_, h) => ({
  hour: h, netSales: h * 900000, receipts: h * 3,
}));

const PULSE = {
  at: new Date().toISOString(), hour: 14,
  today:     { netSales: 12.6e6, grossProfit: 3.1e6, margin: 24.6, receipts: 42,
               avgReceipt: 300000, returns: 1, returnAmount: 220000,
               cancelled: 2, cancelledAmount: 90000, customers: 31, items: 210 },
  yesterday: { netSales: 10.2e6, grossProfit: 2.4e6, margin: 23.5, receipts: 38,
               avgReceipt: 268000, returns: 0, returnAmount: 0,
               cancelled: 0, cancelledAmount: 0, customers: 28, items: 190 },
  lastWeek:  { netSales: 11.1e6, grossProfit: 2.7e6, margin: 24.3, receipts: 40,
               avgReceipt: 277000, returns: 1, returnAmount: 100000,
               cancelled: 1, cancelledAmount: 40000, customers: 30, items: 200 },
  todayCurve: HOUR(15), yesterdayCurve: HOUR(24), lastWeekCurve: HOUR(24),
  velocity: { receiptsLastHour: 6, salesLastHour: 1.4e6, receiptsPrevHour: 4,
              salesPrevHour: 900000, perHourAvg: 1.2e6, sinceLastSaleMin: 7 },
  target: { monthly: 300e6, achieved: 128e6, progress: 42.7, pace: 46.6,
            daysPassed: 14, daysInMonth: 30, projected: 274e6 },
  forecast: { endOfDay: 19.4e6, low: 17.7e6, high: 21.1e6, confidence: 74 },
  live: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1, at: new Date(Date.now() - i * 6e5).toISOString(),
    cashier: i % 2 ? "Ali" : "Vali", branch: "Chilonzor",
    customer: i === 1 ? "Karim aka" : null,
    amount: 120000 + i * 30000, items: 3, payment: i % 2 ? "CARD" : "CASH",
    type: i === 5 ? "RETURN" : "SALE",
    status: i === 6 ? "CANCELLED" : "PAID",
  })),
  registers: [
    { shiftId: 1, terminal: "K1", cashier: "Ali", branch: "Chilonzor",
      openedAt: new Date(Date.now() - 5 * 36e5).toISOString(),
      openingFloat: 200000, expectedCash: 4.2e6, sales: 4e6, receipts: 24, openHours: 5 },
    { shiftId: 2, terminal: "K2", cashier: "Vali", branch: "Sergeli",
      openedAt: new Date(Date.now() - 30 * 36e5).toISOString(),
      openingFloat: 200000, expectedCash: 1.1e6, sales: 900000, receipts: 6, openHours: 30 },
  ],
  branches: [
    { shopId: 2, name: "Sergeli", netSales: 2.1e6, receipts: 8, prevNetSales: 5e6,
      growth: -58, grossProfit: 90000, margin: 4.3, health: 45,
      issues: ["drop", "lowMargin"] },
    { shopId: 1, name: "Chilonzor", netSales: 10.5e6, receipts: 34, prevNetSales: 9e6,
      growth: 16.7, grossProfit: 2.6e6, margin: 24.8, health: 100, issues: [] },
  ],
  stockouts: [
    { productId: 7, name: "Coca-Cola 1L", unit: "DONA", stock: 4, dailyRate: 3.5, daysLeft: 1, lostPerDay: 420000 },
    { productId: 9, name: "Non",          unit: "DONA", stock: 30, dailyRate: 6, daysLeft: 5, lostPerDay: 90000 },
  ],
  incoming: { transfersInTransit: 2, openShifts: 2, lowStock: 11, outOfStock: 3 },
};

const kpi = (m = 1) => ({
  grossSales: 120e6 * m, discount: 5e6 * m, returns: 3e6 * m, netSales: 112e6 * m,
  cogs: 78e6 * m, grossProfit: 34e6 * m, margin: 30.4, expenses: 9e6 * m,
  inventoryLoss: 1.2e6 * m, netProfit: 23.8e6 * m,
  receipts: Math.round(438 * m), returnReceipts: 7, cancelledReceipts: 3,
  cancelledAmount: 410000, avgReceipt: 255000, maxReceipt: 1840000, minReceipt: 12000,
  itemsSold: 5210 * m, cash: 40e6 * m, card: 38e6 * m, online: 20e6 * m,
  savings: 6e6 * m, credit: 8e6 * m,
  customers: Math.round(310 * m), newCustomers: 24, lossSales: 2, lossAmount: 180000,
});

const ANALYTICS = {
  from: new Date().toISOString(), to: new Date().toISOString(), bucket: "day",
  now: kpi(1), prev: kpi(0.8),
  series: Array.from({ length: 14 }, (_, i) => ({
    label: `${i + 1}`, at: new Date().toISOString(),
    netSales: 6e6 + i * 4e5, cogs: 4e6, grossProfit: 2e6, returns: 0, receipts: 30,
  })),
  hourly: HOUR(24), heat: [],
  products: [
    { productId: 1, name: "Choy", unit: "DONA", categoryName: "Ichimlik", quantity: 100,
      netSales: 9e6, cogs: 5e6, profit: 4e6, margin: 44, returnedQty: 0,
      turnover: 3, stockQty: 20, stockValue: 1e6 },
    { productId: 2, name: "Zarar tovar", unit: "DONA", categoryName: "Non", quantity: 20,
      netSales: 1e6, cogs: 1.4e6, profit: -400000, margin: -40, returnedQty: 2,
      turnover: 1, stockQty: 5, stockValue: 200000 },
  ],
  categories: [], cashiers: [
    { userId: 1, name: "Ali", receipts: 132, netSales: 12.4e6, discount: 300000,
      returns: 200000, returnCount: 3, cancelled: 1, avgReceipt: 93900, nonCashShare: 58.2 },
  ],
  branches: [], payments: [
    { type: "CASH", amount: 40e6, share: 47.6 },
    { type: "CARD", amount: 44e6, share: 52.4 },
  ],
  expenses: [],
  stock: { totalQuantity: 5210, totalValue: 210e6, outOfStock: 3, lowStock: 11,
           expiringSoon: 4, expired: 1,
           slowMoving: [{ productId: 5, name: "Eski tovar", stockQty: 90, stockValue: 3.4e6, soldQty: 1 }] },
  debt: { total: 18e6, overdue: 4e6, bucket0to7: 3e6, bucket8to30: 7e6, bucket31plus: 8e6, debtors: 41 },
  customers: { total: 1482, active: 310, newInPeriod: 24, debtors: 41,
               segments: { VIP: 61, LOYAL: 240, POTENTIAL: 700, AT_RISK: 300, LOST: 181 },
               repeatRate: 38.7,
               top: [{ customerId: 1, name: "Karim aka", phone: "+998901112233",
                       receipts: 9, spent: 4.2e6, debt: 300000,
                       lastVisit: new Date().toISOString() }] },
  anomalies: [{ kind: "HIGH_RETURNS", severity: "high", subjectName: "Ali", value: 8.4, baseline: 1.7 }],
  basket: [{ productA: 1, nameA: "Choy", productB: 2, nameB: "Shakar", together: 64, confidence: 68 }],
};

const SIGNALS = {
  shiftWindowDays: 7, stockWindowDays: 30,
  cashShortage: { count: 2, amount: 340000 },
  nonCashDiff: { count: 1, amount: 120000 },
  stockShortage: { count: 0, amount: 0 },
  supplierDebt: { count: 3, amount: 12e6 },
  customerDebt: { count: 41, amount: 18e6 },
  overdueDebt: { count: 6, amount: 4e6 },
  disputedDebts: 1, staleOpenShifts: 1, staleTransfers: 2,
};

/** Bo'sh do'kon — hamma ro'yxat bo'sh, hamma raqam nol. */
const EMPTY_PULSE = {
  at: new Date().toISOString(), hour: 9,
  today: { netSales: 0, grossProfit: 0, margin: 0, receipts: 0, avgReceipt: 0,
           returns: 0, returnAmount: 0, cancelled: 0, cancelledAmount: 0, customers: 0, items: 0 },
  yesterday: null, lastWeek: null,
  todayCurve: [], yesterdayCurve: [], lastWeekCurve: [],
  velocity: { receiptsLastHour: 0, salesLastHour: 0, receiptsPrevHour: 0,
              salesPrevHour: 0, perHourAvg: 0, sinceLastSaleMin: null },
  target: { monthly: null, achieved: 0, progress: 0, pace: 30, daysPassed: 9,
            daysInMonth: 30, projected: 0 },
  forecast: { endOfDay: null, low: null, high: null, confidence: 0 },
  live: [], registers: [], branches: [], stockouts: [],
  incoming: { transfersInTransit: 0, openShifts: 0, lowStock: 0, outOfStock: 0 },
};
const EMPTY_ANALYTICS = {
  ...ANALYTICS,
  now: Object.fromEntries(Object.keys(kpi()).map((k) => [k, 0])),
  prev: Object.fromEntries(Object.keys(kpi()).map((k) => [k, 0])),
  series: [], hourly: [], products: [], cashiers: [], payments: [],
  stock: { totalQuantity: 0, totalValue: 0, outOfStock: 0, lowStock: 0,
           expiringSoon: 0, expired: 0, slowMoving: [] },
  debt: { total: 0, overdue: 0, bucket0to7: 0, bucket8to30: 0, bucket31plus: 0, debtors: 0 },
  customers: { total: 0, active: 0, newInPeriod: 0, debtors: 0, segments: {}, repeatRate: 0, top: [] },
  anomalies: [], basket: [],
};

/* ── Sahifani ochish ────────────────────────────────────────────────── */
let calls = [];
async function open({ pulse = PULSE, analytics = ANALYTICS, signals = SIGNALS,
                      role = "OWNER", url = "/", storage = {} } = {}) {
  calls = [];
  pageErrors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const u = new URL(r.url());
    calls.push(u.pathname + u.search);
    const map = {
      "/api/reports/pulse": pulse,
      "/api/reports/analytics": analytics,
      "/api/reports/signals": signals,
      "/api/inventory/low-stock": [{ id: 1, quantity: 0 }, { id: 2, quantity: 2 }],
      "/api/loyalty/summary": { receipts: 12, discountGiven: 400000, revenue: 9e6, tieredCustomers: 8 },
      "/api/shop/profile": { monthlySalesTarget: 300e6 },
    };
    const data = u.pathname in map ? map[u.pathname] : [];
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument((role_, extra) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: role_, ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.removeItem("ek.dash.layout.v1");
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, role, storage);
  await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector(".dash", { timeout: 15_000 });
  await wait(400);
  return page;
}

const shot = async (page, n) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${n}.png`), fullPage: true }); };

/* ══ A. To'liq ma'lumot ════════════════════════════════════════════════ */
console.log("── A. To'liq panel ──");
let page = await open();
{
  is(pageErrors.length === 0, "sahifa xatosiz ochildi", pageErrors[0] || "");

  const panels = await page.$$eval(".dpn", (n) => n.length);
  is(panels >= 10, "bloklar chizildi", `${panels} ta panel`);

  const kpis = await page.$$eval(".kpi2", (n) => n.length);
  is(kpis === 5, "beshta KPI kartochkasi", String(kpis));

  /* ⚠ ENG QIMMAT TEKSHIRUV — RAQAMLAR NOL BO'LIB QOLMASIN.
     Kartochka bo'sh chiziladi, javob esa keyin keladi. Sanash
     animatsiyasi eski halqani to'xtatmasa, u yangi qiymatni keyingi
     kadrda nolga qaytarardi va ekranda «0» qolib ketardi. Xato
     JIMGINA: sahifa yiqilmaydi, foizlar to'g'ri turadi, faqat eng
     katta raqamlar nol. Aynan tez tarmoqda doim takrorlanardi. */
  const nums = await page.$$eval(".kpi2__v", (n) => n.map((x) => x.textContent.trim()));
  const zeros = nums.filter((v) => /^0$/.test(v));
  is(zeros.length === 0, "KPI raqamlari sanab bo'lindi, nolda qolmadi", nums.join(" · "));

  const svg = await page.$$eval(".pls__chart svg", (n) => n.length);
  is(svg >= 1, "bugun va taqqoslash grafigi chizildi", `${svg} ta SVG`);

  /* ⚠ Ikkita chiziq bo'lishi SHART: bittasi bo'lsa taqqoslash yo'q. */
  const lines = await page.$$eval(".pls__chart svg path", (n) =>
    n.filter((p) => p.getAttribute("fill") === "none" || !p.getAttribute("fill")).length);
  is(lines >= 2, "grafikda IKKI chiziq — bugun va taqqoslash", String(lines));

  /* ⚠ ENG QIMMAT TEKSHIRUV. Bugungi chiziq joriy soatda TUGAYDI.
     Ilgari yetishmagan soatlar NOLGA aylanardi va chiziq soat 14 dan
     keyin pastga qulab, ekranda «savdo to'xtadi» degan yolg'on rasm
     chiqarardi. Uzilgan chiziqda ikkinchi `M` buyrug'i BO'LMAYDI. */
  const [todayPath, refPath] = await page.$$eval('.pls__chart svg path[fill="none"]',
    (n) => n.map((x) => x.getAttribute("d") || ""));
  const pts = (todayPath.match(/L/g) || []).length + 1;
  is(pts === 15, "bugungi chiziq joriy soatda TUGAYDI", `${pts} nuqta (kutilgan 15)`);
  is((refPath.match(/L/g) || []).length + 1 === 24,
     "taqqoslash chizig'i esa oxirigacha boradi", `${(refPath.match(/L/g) || []).length + 1} nuqta`);

  const alerts = await page.$$eval(".alr__row", (n) => n.length);
  is(alerts >= 5, "ogohlantirishlar ro'yxati to'ldi", String(alerts));

  /* Tartib: birinchi satr QIZIL bo'lishi kerak. */
  const firstTone = await page.$eval(".alr__row", (n) => n.dataset.tone);
  is(firstTone === "critical", "eng muhimi birinchi turadi", firstTone);

  /* «Xavf ostidagi pul» sarlavhada. */
  const risk = await page.$eval(".alr__money", (n) => n.textContent.trim()).catch(() => "");
  is(/\d/.test(risk), "xavf ostidagi pul sarlavhada ko'rinadi", risk);

  /* ⚠ Tarjimasiz kalit EKRANGA CHIQMASLIGI kerak. Aynan shu xato
     bo'lgan edi: ogohlantirish matnlari `ek-dash.js` da kalit bo'lib
     tug'iladi va sahifadan izlaydigan tekshiruv ularni ko'rmagan. */
  const raw = await page.evaluate(() =>
    (document.querySelector(".dash")?.innerText || "").match(/\b(dash|rpt2|common)\.[a-zA-Z]+/g) || []);
  is(raw.length === 0, "tarjimasiz kalit ekranda yo'q", raw.join(", ") || "toza");

  /* «Eng ko'p foyda» va «zarar keltirgan» ro'yxatlari KESISHMAYDI. */
  const [best, worst] = await page.$$eval(".two > div", (cols) =>
    cols.slice(0, 2).map((c) => [...c.querySelectorAll(".dtop__name")].map((x) => x.textContent.trim())));
  const both = (best || []).filter((x) => (worst || []).includes(x));
  is(both.length === 0, "bitta tovar ikkala ustunda ham chiqmaydi", both.join(", ") || "kesishmadi");

  await shot(page, "dash-full");
}

/* ══ B. Raqamlar to'g'ri joyda ═════════════════════════════════════════ */
console.log("\n── B. Raqamlar ──");
{
  /* Kun oxiriga bashorat — ishonch bilan birga. */
  const fc = await page.$eval(".pls__fc", (n) => n.textContent).catch(() => "");
  is(/ishonch/i.test(fc), "bashorat yonida ishonch darajasi bor", fc.slice(0, 60));

  /* Reja: sur'at belgisi progress ustida. */
  const pace = await page.$eval(".dtg__pace", (n) => n.style.left).catch(() => "");
  is(/%$/.test(pace), "reja sur'ati belgisi qo'yildi", pace);

  /* Filial: yomoni BIRINCHI va sababi yozilgan. */
  const first = await page.$eval(".brn__row", (n) => ({
    name: n.querySelector(".brn__name")?.textContent,
    tone: n.querySelector(".brn__dot")?.dataset.tone,
    why: [...n.querySelectorAll(".brn__tag")].map((x) => x.textContent).join(","),
  }));
  is(first.tone === "bad", "salomatligi past filial birinchi", `${first.name}/${first.tone}`);
  is(first.why.length > 0, "ball emas, SABAB yozilgan", first.why);

  /* Zarar keltirgan tovar alohida ustunda va qizil. */
  const loss = await page.$$eval('.dtop__v[data-tone="bad"]', (n) => n.map((x) => x.textContent.trim()));
  is(loss.length >= 1, "zarariga sotilgan tovar alohida ko'rsatiladi", loss.join(" "));

  /* Bekor qilingan chek lentada va ustidan chizilgan. */
  const cancelled = await page.$$eval('.live__row[data-kind="cancel"]', (n) => n.length);
  is(cancelled === 1, "bekor qilingan chek lentada qoladi", String(cancelled));

  /* Sutkadan oshgan smena belgilanadi. */
  const stale = await page.$$eval('.reg__row[data-tone="bad"]', (n) => n.length);
  is(stale === 1, "sutkadan oshiq ochiq smena belgilandi", String(stale));

  /* Tugash arafasidagi tovar — bir kunlik qizil. */
  const so = await page.$$eval('.stk__so[data-tone="bad"]', (n) => n.length);
  is(so === 1, "bir kunda tugaydigan tovar qizil", String(so));
}

/* ══ C. Drill-down ═════════════════════════════════════════════════════ */
console.log("\n── C. Chuqurlashtirish ──");
{
  const before = await page.$$eval(".kpi2__d", (n) => n.length);
  await page.evaluate(() => document.querySelector(".kpi2.is-click .kpi2__hit")?.click());
  await wait(150);
  const after = await page.$$eval(".kpi2__d", (n) => n.length);
  is(before === 0 && after === 1, "KPI bosilganda tafsilot OCHILADI, sahifa almashmaydi",
     `${before} → ${after}`);

  const rows = await page.$$eval(".kpi2__d .kpi2__row", (n) => n.length);
  is(rows >= 2, "tafsilotda raqam qayerdan chiqqani yozilgan", String(rows));

  await page.evaluate(() => document.querySelector(".kpi2.is-click .kpi2__hit")?.click());
  await wait(150);
  is((await page.$$eval(".kpi2__d", (n) => n.length)) === 0, "qayta bosilganda yopiladi");
}

/* ══ D. Ctrl+K ═════════════════════════════════════════════════════════ */
console.log("\n── D. Buyruq qatori ──");
{
  await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
  await wait(250);
  is((await page.$(".cmd")) !== null, "Ctrl+K oynani ochdi");

  const groups = await page.$$eval(".cmd__gtitle", (n) => n.map((x) => x.textContent.trim()));
  is(groups.length >= 2, "amallar va bo'limlar guruhlangan", groups.join(" · "));

  /* Klaviatura bilan yurish — kursor pastga tushadi. */
  await page.keyboard.press("ArrowDown"); await wait(80);
  const active = await page.$$eval(".cmd__row.is-active", (n) => n.length);
  is(active === 1, "faqat BITTA satr tanlangan", String(active));

  await page.keyboard.press("Escape"); await wait(250);
  is((await page.$(".cmd")) === null, "Esc yopdi");
  await shot(page, "dash-cmd");
}

/* ══ E. Bloklarni sozlash ══════════════════════════════════════════════ */
console.log("\n── E. Bloklarni sozlash ──");
{
  const wasPanels = await page.$$eval(".dpn", (n) => n.length);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".dash__icon")].pop();
    b?.click();
  });
  await wait(250);
  const rows = await page.$$eval(".lay__row", (n) => n.length);
  is(rows === 15, "o'n beshta blok ro'yxatda", String(rows));

  /* Jonli lentani o'chiramiz. */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll(".lay__row")]
      .find((r) => /jonli/i.test(r.textContent));
    row?.querySelector("input")?.click();
  });
  await wait(200);
  await page.keyboard.press("Escape"); await wait(250);

  const nowPanels = await page.$$eval(".dpn", (n) => n.length);
  is(nowPanels === wasPanels - 1, "o'chirilgan blok yo'qoldi", `${wasPanels} → ${nowPanels}`);

  const saved = await page.evaluate(() => localStorage.getItem("ek.dash.layout.v1"));
  is(saved && JSON.parse(saved).hidden.includes("live"), "tanlov SAQLANDI", saved?.slice(0, 60));
  await page.close();
}

/* ══ F. Saqlangan tartib qayta ochilganda ══════════════════════════════ */
console.log("\n── F. Saqlangan tartib ──");
{
  page = await open({ storage: { "ek.dash.layout.v1": JSON.stringify({ order: ["alerts"], hidden: ["live", "staff"] }) } });
  const hasLive = await page.$(".live");
  const hasStaff = await page.$(".tbl-sm");
  is(hasLive === null && hasStaff === null, "yashirilgan ikkita blok chiqmadi");

  /* ⚠ ENG QIMMAT TEKSHIRUV: saqlangan ro'yxatda YO'Q bloklar ham
     ko'rinishi kerak. Aks holda yangi versiyada qo'shilgan blok eski
     foydalanuvchida hech qachon paydo bo'lmasdi. */
  const panels = await page.$$eval(".dpn", (n) => n.length);
  is(panels >= 9, "saqlangan ro'yxatda yo'q bloklar ham chizildi", `${panels} ta`);
  await page.close();
}

/* ══ G. Bo'sh do'kon ═══════════════════════════════════════════════════ */
console.log("\n── G. Bo'sh do'kon ──");
{
  page = await open({ pulse: EMPTY_PULSE, analytics: EMPTY_ANALYTICS,
                      signals: null, url: "/" });
  is(pageErrors.length === 0, "bo'sh javobda ham yiqilmadi", pageErrors[0] || "");

  const panels = await page.$$eval(".dpn", (n) => n.length);
  is(panels >= 8, "bloklar baribir chizildi", String(panels));

  /* Reja yo'q — o'rniga TAKLIF chiqadi, bo'sh chiziq emas. */
  is((await page.$(".dtg__none")) !== null, "reja qo'yilmaganda taklif ko'rinadi");

  /* Bashorat yo'q — bo'sh blok chizilmaydi, yolg'on raqam ham. */
  is((await page.$(".pls__fc")) === null, "tarixsiz bashorat KO'RSATILMAYDI");
  await shot(page, "dash-empty");
  await page.close();
}

/* ══ H. Maydonlar yetishmaganda ════════════════════════════════════════ */
console.log("\n── H. Buzuq javob ──");
{
  /* ⚠ Server javobi o'zgarishi mumkin. Bosh sahifa — birinchi ekran,
     u yiqilsa foydalanuvchi hech qayerga o'tolmaydi. */
  page = await open({ pulse: {}, analytics: {}, signals: {} });
  is(pageErrors.length === 0, "bo'sh obyektlar sahifani yiqitmadi", pageErrors[0] || "");
  is((await page.$(".dash")) !== null, "sahifa baribir turadi");

  await page.close();
  page = await open({ pulse: null, analytics: null, signals: null });
  is(pageErrors.length === 0, "null javoblar ham yiqitmadi", pageErrors[0] || "");
  await page.close();
}

/* ══ I. Rol ════════════════════════════════════════════════════════════ */
console.log("\n── I. Omborchi ──");
{
  page = await open({ role: "STOREKEEPER" });
  is(pageErrors.length === 0, "omborchida ham xatosiz", pageErrors[0] || "");

  /* ⚠ ENG MUHIMI: pul so'rovi UMUMAN yuborilmasligi kerak. Serverda
     `/reports/**` unga yopiq va so'rov 403 bilan qaytardi. */
  const money = calls.filter((c) => c.startsWith("/api/reports/"));
  is(money.length === 0, "pul so'rovi YUBORILMADI", money.join(" ") || "bitta ham yo'q");

  is((await page.$(".dash__role")) !== null, "nima uchun kamligi tushuntirilgan");
  is((await page.$(".kpi2")) === null, "pul kartochkalari chizilmadi");
  is((await page.$(".alr__row, .attn__empty")) !== null, "ogohlantirishlar unga ham ko'rinadi");
  await shot(page, "dash-store");
  await page.close();
}

/* ══ J. Manzildagi holat ═══════════════════════════════════════════════ */
console.log("\n── J. Manzil ──");
{
  page = await open({ url: "/?p=month&c=week" });
  const on = await page.$$eval(".seg__b.is-on", (n) => n.map((x) => x.textContent.trim()));
  is(on.length === 2, "manzildan davr ham, taqqoslash ham tiklandi", on.join(" · "));

  /* Davr o'zgarsa manzil ham o'zgaradi — havolani yuborsa bo'ladi. */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".seg__b")].find((x) => /hafta/i.test(x.textContent) && !x.className.includes("is-on"));
    b?.click();
  });
  await wait(300);
  const url = await page.url();
  is(url.includes("?"), "tanlov manzilga yozildi", url.split("/").pop());
  await page.close();
}

/* ══ K. Avto-yangilanish ═══════════════════════════════════════════════ */
console.log("\n── K. Avto-yangilanish ──");
{
  page = await open();
  const slowBefore = calls.filter((c) => c.startsWith("/api/reports/analytics")).length;
  const fastBefore = calls.filter((c) => c.startsWith("/api/reports/pulse")).length;

  /* Varaq ko'rinmas bo'lib, keyin qaytadi — DARHOL yangilanishi kerak. */
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(200);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(400);

  const slowAfter = calls.filter((c) => c.startsWith("/api/reports/analytics")).length;
  const fastAfter = calls.filter((c) => c.startsWith("/api/reports/pulse")).length;

  is(fastAfter > fastBefore, "varaq qaytganda YENGIL so'rov takrorlandi", `${fastBefore} → ${fastAfter}`);
  /* ⚠ Og'ir so'rov TAKRORLANMASLIGI kerak: har daqiqada butun davr
     tahlilini qayta hisoblash bitta ochiq oyna bilan serverni bo'g'ardi. */
  is(slowAfter === slowBefore, "OG'IR so'rov takrorlanmadi", `${slowBefore} → ${slowAfter}`);
  await page.close();
}

/* ══ L. Telefon ════════════════════════════════════════════════════════ */
console.log("\n── L. Telefon ──");
{
  page = await open();
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await wait(500);

  /* ⚠ GORIZONTAL SILJISH BO'LMASLIGI SHART. Boshqaruv paneli keng
     jadval va grafikdan iborat; ularning bittasi ham sig'masa, butun
     sahifa yon tomonga suriladi va telefonda o'qib bo'lmaydi. */
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll(".dash *")]
      .filter((e) => e.getBoundingClientRect().right > d.clientWidth + 1)
      .map((e) => e.className?.toString?.().slice(0, 40))
      .filter(Boolean);
    return { scroll: d.scrollWidth, client: d.clientWidth, wide: [...new Set(wide)].slice(0, 5) };
  });
  is(over.scroll <= over.client + 1, "sahifa yon tomonga surilmaydi",
     `${over.scroll} / ${over.client}${over.wide.length ? " — " + over.wide.join(", ") : ""}`);

  /* Keng jadval O'Z ichida suriladi — sahifani cho'zmaydi. */
  const wrapOk = await page.evaluate(() => {
    const w = document.querySelector(".table-wrap");
    return !w || getComputedStyle(w).overflowX !== "visible";
  });
  is(wrapOk, "kassirlar jadvali o'z ichida suriladi");

  const panels = await page.$$eval(".dpn", (n) => n.length);
  is(panels >= 10, "telefonda ham hamma blok chizildi", String(panels));
  await shot(page, "dash-mobile");
  await page.close();
}

/* ══ Yakun ════════════════════════════════════════════════════════════ */
await browser.close();
server.close();
console.log(`\n${fail ? "❌" : "✅"} bosh sahifa: ${pass} o'tdi, ${fail} yiqildi`);
if (pageErrors.length) console.log("Sahifa xatolari:\n  " + pageErrors.join("\n  "));
process.exit(fail ? 1 : 0);
