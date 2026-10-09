/* ══════════════════════════════════════════════════════════════════════════
   HISOBOT BO'LIMI (V69) — brauzerda

   ═══ NEGA BU TEKSHIRUV KERAK ═══════════════════════════════════════════

   Hisobot sahifasi butun ekranini BITTA javobdan chizadi va oltita
   bo'limga bo'lingan (2026-10-05 gacha o'nta edi — soddalashtirildi). Bo'limlar orasida sakrash — oddiy holat almashuvi,
   lekin ularning har biri boshqa maydonlarni o'qiydi: bitta maydon
   yo'q bo'lsa (server javobi o'zgardi, `null` keldi) o'sha bo'lim
   `TypeError` bilan yiqiladi va butun ilova bo'sh oynaga aylanadi.
   Sahifa ochilganda esa BIRINCHI bo'lim ishlab turgani uchun buni
   hech kim sezmaydi.

   Shuning uchun bu yerda HAMMA BO'LIM ochiladi va sahifada JS
   xatosi tushmagani tekshiriladi.

   MAHSULOT HISOBOTI (2026-10-05, H–K bandlar): jadval qatori bosilsa
   tovar sahifasi ochiladi, davr o'zi bilan ketadi, chek ochiladi,
   Excel to'ladi, bo'sh tovarda yiqilmaydi, eski `?tab=` havolalar
   to'g'ri bo'limni ochadi.

   Yana:
     · davr tanlagichi so'rovni QAYTA yuboradi va oraliq to'g'ri
       (mahalliy sutka boshi — eski xato aynan shu yerda edi);
     · o'sish belgisi to'g'ri yo'nalishda;
     · bo'lim almashganda YANGI SO'ROV KETMAYDI (ma'lumot qo'lda);
     · grafiklar chizildi (SVG bor), bo'sh ma'lumotda ham yiqilmaydi.

   ⚠ CORS sarlavhalari shart — sababi `check-pay.mjs` da.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-report.mjs
     SHOT_DIR=/tmp/shots — skrinshotlar
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4617;
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

const pageErrors = [];
let pass = 0, fail = 0;
const ok  = (m, x = "") => { pass++; console.log(`  ✅ ${m}${x ? ` (${x})` : ""}`); };
const bad = (m, x = "") => { fail++; console.log(`  ❌ ${m}${x ? ` — ${x}` : ""}`); };
const is  = (c, m, x = "") => (c ? ok(m, x) : bad(m, x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Soxta tahlil javobi ────────────────────────────────────────────── */
const kpi = (mul = 1) => ({
  grossSales: 120e6 * mul, discount: 5e6 * mul, returns: 3e6 * mul,
  netSales: 112e6 * mul, cogs: 78e6 * mul, grossProfit: 34e6 * mul,
  margin: 30.4, expenses: 9e6 * mul, inventoryLoss: 1.2e6 * mul,
  netProfit: 23.8e6 * mul,
  receipts: Math.round(438 * mul), returnReceipts: 7, cancelledReceipts: 3,
  cancelledAmount: 410000, avgReceipt: 255000, maxReceipt: 1840000, minReceipt: 12000,
  itemsSold: 5210 * mul,
  cash: 40e6 * mul, card: 38e6 * mul, online: 20e6 * mul, savings: 6e6 * mul, credit: 8e6 * mul,
  customers: Math.round(310 * mul), newCustomers: Math.round(24 * mul),
  lossSales: 2, lossAmount: 180000,
});
const series = Array.from({ length: 14 }, (_, i) => ({
  label: `${String(i + 1).padStart(2, "0")}.09`,
  at: new Date(2026, 8, i + 1).toISOString(),
  netSales: 6e6 + i * 4e5, cogs: 4e6 + i * 2e5, grossProfit: 2e6 + i * 2e5,
  returns: i === 5 ? 900000 : 0, receipts: 30 + i,
}));
const ANALYTICS = {
  from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 8, 15).toISOString(),
  bucket: "day", now: kpi(1), prev: kpi(0.82), series,
  hourly: Array.from({ length: 24 }, (_, h) => ({
    hour: h, netSales: h >= 9 && h <= 21 ? (h === 18 ? 14e6 : 3e6 + h * 2e5) : 0,
    receipts: h >= 9 && h <= 21 ? 20 : 0,
  })),
  heat: [1, 2, 3, 4, 5, 6, 7].flatMap((d) =>
    [10, 12, 14, 16, 18, 20].map((h) => ({ dow: d, hour: h, netSales: d * h * 60000, receipts: d + h }))),
  products: Array.from({ length: 12 }, (_, i) => ({
    productId: i + 1, name: `Tovar ${i + 1}`, unit: "DONA", categoryName: i % 2 ? "Ichimliklar" : "Non",
    quantity: 1200 - i * 60, netSales: 18e6 - i * 1e6, cogs: 14e6 - i * 8e5,
    profit: 4e6 - i * 2e5, margin: 22.6 - i, returnedQty: i === 3 ? 12 : 0,
    turnover: 12.4 - i * 0.7, stockQty: 300 + i * 10, stockValue: 2e6 + i * 1e5,
  })),
  categories: [
    { name: "Ichimliklar", quantity: 4821, netSales: 35e6, profit: 8.2e6, margin: 23.4 },
    { name: "Oziq-ovqat",  quantity: 3210, netSales: 28e6, profit: 6.1e6, margin: 21.8 },
    { name: "",            quantity: 120,  netSales: 4e6,  profit: 0.9e6, margin: 22.5 },
  ],
  cashiers: [
    { userId: 1, name: "Ali",  receipts: 132, netSales: 12.4e6, discount: 300000, returns: 200000,
      returnCount: 3, cancelled: 1, avgReceipt: 93900, nonCashShare: 58.2 },
    { userId: 2, name: "Vali", receipts: 98,  netSales: 9.8e6,  discount: 120000, returns: 0,
      returnCount: 0, cancelled: 0, avgReceipt: 100000, nonCashShare: 41.7 },
  ],
  branches: [
    { shopId: 1, name: "Chilonzor", receipts: 820, netSales: 182e6, profit: 40e6, margin: 22, customers: 310 },
    { shopId: 2, name: "Sergeli",   receipts: 640, netSales: 154e6, profit: 31e6, margin: 20.1, customers: 260 },
  ],
  payments: [
    { type: "CASH",  amount: 40e6, share: 37.7 },
    { type: "CARD",  amount: 38e6, share: 35.8 },
    { type: "CLICK", amount: 20e6, share: 18.9 },
    { type: "SAVINGS", amount: 8e6, share: 7.6 },
  ],
  expenses: [
    { name: "Ijara", amount: 5e6, share: 55.5 },
    { name: "Oylik", amount: 3e6, share: 33.3 },
    { name: "",      amount: 1e6, share: 11.2 },
  ],
  stock: {
    totalQuantity: 45210, totalValue: 210e6, outOfStock: 4, lowStock: 12,
    expiringSoon: 6, expired: 2,
    slowMoving: [
      { productId: 90, name: "Sekin tovar", stockQty: 180, stockValue: 3.2e6, soldQty: 2 },
    ],
  },
  debt: { total: 124e6, overdue: 37e6, bucket0to7: 20e6, bucket8to30: 67e6, bucket31plus: 37e6, debtors: 41 },
  customers: {
    total: 1482, active: 310, newInPeriod: 24, debtors: 41,
    segments: { VIP: 61, LOYAL: 240, POTENTIAL: 700, AT_RISK: 300, LOST: 181 },
  },
  anomalies: [
    { kind: "HIGH_RETURNS",  severity: "high", subjectName: "Ali", value: 8.4, baseline: 1.7 },
    { kind: "HIGH_DISCOUNT", severity: "warn", subjectName: "Vali", value: 4.1, baseline: 1.9 },
    { kind: "OFF_HOURS",     severity: "info", subjectName: null, value: 12, baseline: 0 },
  ],
  basket: [
    { productA: 1, nameA: "Coca-Cola", productB: 2, nameB: "Chips",    together: 64, confidence: 64 },
    { productA: 2, nameA: "Chips",     productB: 1, nameB: "Coca-Cola", together: 64, confidence: 91 },
  ],
};

/** Bo'sh javob — hamma ro'yxat bo'sh, hamma raqam nol. */
const EMPTY = {
  ...ANALYTICS,
  now: Object.fromEntries(Object.entries(kpi(1)).map(([k]) => [k, 0])),
  prev: Object.fromEntries(Object.entries(kpi(1)).map(([k]) => [k, 0])),
  series: [], hourly: [], heat: [], products: [], categories: [],
  cashiers: [], branches: [], payments: [], expenses: [], basket: [],
  stock: { totalQuantity: 0, totalValue: 0, outOfStock: 0, lowStock: 0,
           expiringSoon: 0, expired: 0, slowMoving: [] },
  debt: { total: 0, overdue: 0, bucket0to7: 0, bucket8to30: 0, bucket31plus: 0, debtors: 0 },
  customers: { total: 0, active: 0, newInPeriod: 0, debtors: 0, segments: {} },
  anomalies: [],
};

/* ── Soxta mahsulot hisoboti ────────────────────────────────────────── */
const iso = (d, h = 12) => new Date(2026, 8, d, h, 15).toISOString();
const PRODUCT = {
  from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 9, 1).toISOString(), bucket: "day",
  product: { id: 1, name: "Tovar 1", unit: "DONA", category: "Non", barcode: "4780000000017",
             sku: null, plu: "12", salePrice: 15000, costPrice: 11000, minQuantity: 5, archived: false },
  now:  { soldQty: 45, netSales: 648000, cogs: 495000, profit: 153000, margin: 23.6, returnedQty: 2,
          returnedAmount: 30000, discount: 27000, receipts: 38, customers: 9, avgPrice: 14400,
          perDay: 1.5, activeDays: 20 },
  prev: { soldQty: 40, netSales: 560000, cogs: 440000, profit: 120000, margin: 21.4, returnedQty: 0,
          returnedAmount: 0, discount: 10000, receipts: 33, customers: 7, avgPrice: 14000,
          perDay: 1.3, activeDays: 18 },
  stock: { qty: 30, value: 330000, batches: 2, rate14: 1.786, daysLeft: 16,
           lastSoldAt: iso(20, 18), lastInAt: iso(3, 9), nearestExpiry: "2026-11-01" },
  series: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`,
           label: `${String(i + 1).padStart(2, "0")}.09`, qty: i % 3, net: (i % 3) * 14400 })),
  hourly: Array.from({ length: 24 }, (_, h) => (h >= 9 && h <= 21 ? (h === 18 ? 9 : 2) : 0)),
  cashiers: [ { userId: 1, name: "Ali", qty: 30, net: 432000, receipts: 25 },
              { userId: 2, name: "Vali", qty: 15, net: 216000, receipts: 13 } ],
  lines: Array.from({ length: 25 }, (_, i) => ({
    saleId: 500 + i, at: iso(25 - i), type: i === 1 ? "RETURN" : "SALE",
    status: i === 2 ? "CANCELLED" : "PAID", sign: i === 1 ? -1 : i === 2 ? 0 : 1,
    cashier: i % 2 ? "Vali" : "Ali", customer: i === 0 ? "Anvar" : null,
    qty: 2, price: 15000, discount: i === 0 ? 1000 : 0, net: i === 0 ? 29000 : 30000 })),
  linesTotal: 25,
  moves: [
    { id: 3, at: iso(20), type: "CORRECTION", delta: -1, reason: "singan", writeOffReason: "BREAKAGE", by: "omborchi", expiryDate: null },
    { id: 2, at: iso(10), type: "SALE", delta: -2, reason: null, writeOffReason: null, by: "Ali", expiryDate: null },
    { id: 1, at: iso(3), type: "IN", delta: 40, reason: null, writeOffReason: null, by: "omborchi", expiryDate: "2026-11-01" },
  ],
  movesTotal: 3,
  prices: [ { at: iso(2), oldSale: 14000, newSale: 15000, oldCost: 10500, newCost: 11000, reason: "", by: "egasi" } ],
};
/** Bo'sh tovar — sotuvsiz, qoldiqsiz, harakatsiz. */
const PRODUCT_EMPTY = {
  ...PRODUCT,
  now: Object.fromEntries(Object.keys(PRODUCT.now).map((k) => [k, 0])),
  prev: Object.fromEntries(Object.keys(PRODUCT.now).map((k) => [k, 0])),
  stock: { qty: 0, value: 0, batches: 0, rate14: 0, daysLeft: null, lastSoldAt: null, lastInAt: null, nearestExpiry: null },
  series: [], hourly: [], cashiers: [], lines: [], linesTotal: 0, moves: [], movesTotal: 0, prices: [],
};
const SALE = { id: 500, items: [{ id: 1, productId: 1, productName: "Tovar 1", quantity: 2, price: 15000,
               subtotal: 30000, unit: "DONA" }], totalAmount: 30000, paymentType: "CASH",
               status: "PAID", type: "SALE", createdAt: iso(25), cashierName: "Ali", payments: [] };
let productPayload = PRODUCT;
let productCalls = [];

let TARGET = null;
let calls = [];
/* Kunlik hisobot (2026-10-09): ikki tovar — biri sotildi va tugadi, biri keldi. */
let dayCalls = [];
const DAY = {
  date: "2026-10-09", rows: [
    { productId: 1, name: "Pista", barcode: "4780000000079", unit: "DONA", category: "Yong'oq", salePrice: 90000,
      tracksStock: true, opening: 3, received: 0, transferIn: 0, transferOut: 0, sold: 3, returned: 0,
      writtenOff: 0, other: 0, closing: 0, soldMoney: 270000, returnedMoney: 0, cost: 180000, profit: 90000, receipts: 2 },
    { productId: 2, name: "Un", barcode: null, unit: "KG", category: null, salePrice: 9000,
      tracksStock: true, opening: 10, received: 25, transferIn: 0, transferOut: 0, sold: 0, returned: 0,
      writtenOff: 1, other: 0, closing: 34, soldMoney: 0, returnedMoney: 0, cost: 0, profit: 0, receipts: 0 },
  ],
  totals: { products: 2, soldProducts: 1, soldMoney: 270000, returnedMoney: 0, cost: 180000, profit: 90000, closingValue: 204000 },
};

async function openReports(payload = ANALYTICS, url = "/reports") {
  calls = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const u = new URL(r.url());
    if (u.pathname === "/api/reports/analytics") calls.push(u.search);
    if (u.pathname.startsWith("/api/reports/product/")) productCalls.push(u.pathname + u.search);
    if (u.pathname === "/api/reports/day-products") dayCalls.push(u.search);
    const body = u.pathname === "/api/reports/analytics"
      ? { success: true, data: payload }
      : u.pathname.startsWith("/api/reports/product/")
        ? { success: true, data: productPayload }
      : u.pathname === "/api/reports/day-products"
        ? { success: true, data: { ...DAY, rows: u.searchParams.get("all") ? [...DAY.rows, { ...DAY.rows[1], productId: 3, name: "Tuz", received: 0, writtenOff: 0, opening: 5, closing: 5 }] : DAY.rows } }
      : /^\/api\/sales\/\d+$/.test(u.pathname)
        ? { success: true, data: SALE }
      : u.pathname === "/api/products" && u.searchParams.get("q")
        ? { success: true, data: { content: [{ id: 7, name: "Pista", barcode: "4780000000079", salePrice: 90000 }],
                                   totalElements: 1 } }
      /* Reja do'kon profilidan keladi (V70). */
      : u.pathname === "/api/shop/profile"
        ? { success: true, data: { monthlySalesTarget: TARGET } }
        : { success: true, data: [] };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.removeItem("ek_rpt_period");
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_flt_")) localStorage.removeItem(k);
  });
  await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: "networkidle2", timeout: 30_000 });
  if (url.startsWith("/reports/day")) {
    await page.waitForSelector(".rpt-lead", { timeout: 15_000 });
    return page;
  }
  if (url.startsWith("/reports/product")) {
    await page.waitForSelector(".prep", { timeout: 15_000 });
    return page;
  }
  await page.waitForSelector(".rpt-tabs", { timeout: 15_000 });
  /* «Kassirlar» bo'limida KPI yo'q (jadval va ro'yxat) — karta kutiladi. */
  await page.waitForSelector(".kpi, .rpt .card", { timeout: 15_000 });
  return page;
}

const shot = async (page, n) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${n}.png`), fullPage: true }); };
const openTab = async (page, key) => {
  await page.evaluate((k) => {
    const tabs = [...document.querySelectorAll(".rpt-tab")];
    tabs[k]?.click();
  }, key);
  await wait(260);
};

/** «Boshqa davr» ro'yxatidan davr tanlaydi (2026-10-05 dan segment emas). */
const pickPeriod = async (page, re) => {
  await page.evaluate(() => document.querySelector(".rpt-bar .ek-select__btn")?.click());
  await wait(200);
  await page.evaluate((src) => {
    const r = new RegExp(src, "i");
    [...document.querySelectorAll(".ek-select__opt")].find((x) => r.test(x.textContent))?.click();
  }, re.source);
  await wait(400);
};

/* ══ A. Sahifa ochiladi ════════════════════════════════════════════════ */
console.log("── A. Ochilish ──");
const page = await openReports();
{
  const kpis = await page.$$eval(".kpi", (n) => n.length);
  /* ⚠ 2026-10-05: bosh sahifada TO'RTTA asosiy raqam (sakkizta emas) —
     qolganlari o'z bo'limida. */
  is(kpis >= 4, "bosh sahifada KPI kartalari chizildi", String(kpis));
  is(!!(await page.$(".rpt-lead__q")), "bo'lim oddiy savol bilan ochiladi");
  const svg = await page.$$eval(".chart svg", (n) => n.length);
  is(svg >= 1, "dinamika grafigi chizildi", `${svg} ta SVG`);
  is(calls.length === 1, "BITTA so'rov ketdi (o'n beshta emas)", String(calls.length));

  /* Davr oralig'i — MAHALLIY sutka boshidan. Eski xato: UTC da
     olinardi va tunda oraliq teskari bo'lib, hisobot bo'm-bo'sh
     chiqardi. */
  const q = new URLSearchParams(calls[0]);
  const from = new Date(q.get("from"));
  is(from.getHours() === 0 && from.getMinutes() === 0,
     "oraliq MAHALLIY sutka boshidan boshlanadi", q.get("from"));
  is(from.getDate() === 1, "«shu oy» — oyning birinchi kunidan", String(from.getDate()));
  await shot(page, "rpt-home");
}

/* ══ B. O'sish belgisi ═════════════════════════════════════════════════ */
console.log("\n── B. Taqqoslash ──");
{
  const deltas = await page.$$eval(".kpi__delta", (n) => n.map((x) => x.className + "|" + x.textContent.trim()));
  is(deltas.length >= 4, "o'sish belgilari bor", String(deltas.length));
  is(deltas.some((d) => d.includes("is-up") && d.includes("↑")), "o'sish YUQORIGA va yashil");
  /* Qaytarish va xarajat O'SISHI yomon — ular teskari belgilanadi.
     Qaytarish endi «Savdo» bo'limida. */
  await openTab(page, 1);
  const idx = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".kpi")];
    const c = cards.find((x) => /qaytarish/i.test(x.querySelector(".kpi__label")?.textContent || ""));
    return c?.querySelector(".kpi__delta")?.className || "";
  });
  is(idx.includes("is-down"), "qaytarish O'SGANDA belgi QIZIL (o'sishi yomon)", idx);
  await openTab(page, 0);
}

/* ══ C. Hamma bo'lim ochiladi ══════════════════════════════════════════ */
console.log("\n── C. Oltita bo'lim ──");
{
  const names = await page.$$eval(".rpt-tab", (n) => n.map((x) => x.textContent.trim()));
  is(names.length === 6, "oltita bo'lim", names.join(" · "));
  const before = pageErrors.length;
  for (let i = 0; i < names.length; i++) {
    await openTab(page, i);
    const painted = await page.evaluate(() => document.querySelectorAll(".rpt .card, .kpi").length > 0);
    is(painted && pageErrors.length === before, `«${names[i]}» ochildi va xatosiz`,
       pageErrors.slice(before).join(" | "));
  }
  is(calls.length === 1, "bo'lim almashganda YANGI SO'ROV KETMADI", String(calls.length));
  await openTab(page, 2);  await shot(page, "rpt-profit");
  await openTab(page, 1);  await shot(page, "rpt-sales");
  await openTab(page, 3);  await shot(page, "rpt-products");
  await openTab(page, 0);
}

/* ══ D. Davr almashadi ═════════════════════════════════════════════════ */
console.log("\n── D. Davr ──");
{
  const n0 = calls.length;
  await pickPeriod(page, /^\s*kecha/);
  is(calls.length === n0 + 1, "davr o'zgarganda so'rov QAYTA ketdi");
  const q = new URLSearchParams(calls.at(-1));
  const from = new Date(q.get("from"));
  const to = new Date(q.get("to"));
  is(Math.round((to - from) / 86400000) === 1, "«kecha» — aynan bitta kun",
     `${q.get("from")} → ${q.get("to")}`);
  is(from < to, "oraliq TESKARI emas");

  /* O'z oralig'i — sana maydonlari chiqadi. */
  await pickPeriod(page, /o'z oralig'i/);
  is(!!(await page.$(".rpt-custom")), "«o'z oralig'i» da sana maydonlari chiqdi");
}

/* ══ E. Bo'sh ma'lumot ═════════════════════════════════════════════════ */
console.log("\n── E. Bo'sh davr ──");
await page.close();
{
  const p2 = await openReports(EMPTY);
  const before = pageErrors.length;
  for (let i = 0; i < 6; i++) await openTab(p2, i);
  is(pageErrors.length === before, "bo'sh ma'lumotda ham hech bir bo'lim yiqilmadi",
     pageErrors.slice(before).join(" | "));
  const empties = await p2.$$eval(".chart--empty, .empty, .ek-empty", (n) => n.length);
  is(empties > 0, "bo'sh holat yozuvi chizildi (grafik o'rni bo'm-bo'sh qolmadi)", String(empties));
  await shot(p2, "rpt-empty");
  await p2.close();
}

/* ══ F. Savat, reja va prognoz (V70) ═══════════════════════════════════ */
console.log("\n── F. Savat, reja va prognoz ──");
{
  TARGET = 200e6;
  const p3 = await openReports();

  /* Reja — «shu oy» davrida va faqat reja qo'yilgan bo'lsa. */
  await wait(400);
  const tgt = await p3.$(".tgt");
  is(!!tgt, "reja bo'limi chizildi");
  const pct = await p3.$eval(".tgt__foot b", (e) => e.textContent.trim()).catch(() => "");
  is(pct === "56%", "bajarilish foizi to'g'ri (112 mln / 200 mln)", pct);
  /* ⚠ Chiziq 100% dan oshmasligi kerak — cho'zilsa qutidan chiqib ketardi. */
  const w = await p3.$eval(".tgt__bar i", (e) => e.style.width);
  is(parseFloat(w) <= 100, "chiziq 100% dan oshmadi", w);

  /* Savat — Tovarlar bo'limida, YO'NALTIRILGAN. */
  await openTab(p3, 3);
  const rows = await p3.$$eval(".rpt .card table tbody tr", (n) => n.length);
  is(rows > 0, "tovarlar jadvali chizildi", String(rows));
  const basket = await p3.evaluate(() => {
    const card = [...document.querySelectorAll(".rpt .card")]
      .find((c) => /birga sotiladigan/i.test(c.querySelector(".card-title")?.textContent || ""));
    if (!card) return null;
    return [...card.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()));
  });
  is(!!basket && basket.length === 2, "savat juftliklari chizildi", JSON.stringify(basket));
  is(basket && basket[0][0] === "Coca-Cola" && basket[0][2] === "Chips",
     "juftlik YO'NALTIRILGAN o'qiladi (A → B)");
  is(basket && basket[0][4] !== basket[1][4],
     "ikki yo'nalish BOSHQA ishonch beradi", basket ? `${basket[0][4]} ≠ ${basket[1][4]}` : "");

  /* Reja YO'Q bo'lsa bo'lim umuman chizilmaydi. */
  await p3.close();
  TARGET = null;
  const p4 = await openReports();
  await wait(400);
  is(!(await p4.$(".tgt")), "reja qo'yilmagan bo'lsa bo'lim UMUMAN chizilmaydi");
  await p4.close();
}

/* ══ G. Excel eksporti (V71) ═══════════════════════════════════════════

   ⚠ HAQIQIY YO'L tekshiriladi, `buildXlsx` ning o'zi emas (uning sof
   sinovi `test/xlsx.test.mjs` da). Bu yerda savol boshqa: tugma
   bosilganda ekrandagi MA'LUMOT faylga tushdimi. Yo'lda uzilish
   bo'lsa (`data` hali yo'q, maydon nomi o'zgargan) sof sinov buni
   ko'rmasdi.

   Yuklab olishni ushlash uchun `URL.createObjectURL` almashtiriladi:
   headless brauzerda faylni diskdan o'qish ishonchsiz, Blob esa
   xotirada va uni bayt-bayt tekshirsa bo'ladi. */
console.log("\n── G. Excel eksporti ──");
{
  TARGET = null;
  const p5 = await openReports();
  await p5.evaluate(() => {
    window.__xlsx = null;
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__xlsxBlob = blob;
      return real(blob);
    };
    /* Yuklab olishni bosmasin — sinovda fayl saqlanmaydi. */
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__xlsxName = this.download; return; }
      return click.call(this);
    };
  });

  await p5.evaluate(() => {
    const b = [...document.querySelectorAll(".rpt-bar__tools button")]
      .find((x) => /excel/i.test(x.textContent));
    b?.click();
  });
  await wait(500);

  const info = await p5.evaluate(async () => {
    if (!window.__xlsxBlob) return null;
    const buf = new Uint8Array(await window.__xlsxBlob.arrayBuffer());
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    let text = "";
    for (let i = 0; i < buf.length; i++) text += String.fromCharCode(buf[i]);
    return { name: window.__xlsxName, size: buf.length, head, text, type: window.__xlsxBlob.type };
  });

  is(!!info, "Excel fayli yaratildi");
  if (info) {
    is(info.head === "PK\u0003\u0004", "haqiqiy ZIP (xlsx) imzosi", JSON.stringify(info.head));
    is(/^hisobot-\d{4}-\d{2}-\d{2}\.xlsx$/.test(info.name || ""), "fayl nomi davr sanasi bilan", info.name);
    is(info.type.includes("spreadsheetml"), "MIME turi xlsx", info.type);
    is(info.size > 3000, "fayl bo'sh emas", `${info.size} bayt`);
    /* Har bo'lim o'z varag'ida. ⚠ `<sheet name=` bo'yicha sanaladi
       (`workbook.xml` dagi ro'yxat), fayl nomlari bo'yicha emas: ular
       `[Content_Types].xml` va `.rels` da ham uchraydi va son ikki
       barobar chiqardi. */
    const sheets = (info.text.match(/<sheet name="/g) || []).length;
    is(sheets >= 9, "har bo'lim O'Z VARAG'IDA", `${sheets} ta varaq`);
    /* ⚠ Eng muhimi: SON son bo'lib tushdimi. «12 000 so'm» degan
       katakni Excel jamlay olmaydi. */
    is(info.text.includes("<v>112000000</v>"), "sof savdo SON sifatida yozildi (matn emas)");
    is(info.text.includes("Coca-Cola") && info.text.includes("Chips"),
       "savat juftliklari ham faylda");
    is(info.text.includes("Ali") && info.text.includes("Vali"), "kassirlar varag'i to'ldi");
  }
  await p5.close();
}

/* ══ H. Eski havolalar (`?tab=`) ════════════════════════════════════════
   ⚠ Bosh sahifadagi «batafsil» havolalari `/reports?tab=profit` ga olib
   boradi. 2026-10-05 gacha sahifa URL'ni umuman o'qimasdi va har havola
   birinchi bo'limni ochardi. Eski bo'lim nomlari (money, stock, …) yangi
   bo'limga tushishi kerak. */
console.log("\n── H. Havolalar ──");
for (const [tab, want] of [["profit", /foyda/i], ["money", /savdo/i], ["stock", /tovarlar/i], ["watch", /kassirlar/i]]) {
  const px = await openReports(ANALYTICS, `/reports?tab=${tab}`);
  const on = await px.$eval(".rpt-tab.is-on", (e) => e.textContent.trim()).catch(() => "");
  is(want.test(on), `?tab=${tab} → «${on}»`);
  await px.close();
}
{
  const px = await openReports(ANALYTICS, "/custom-report");
  is(px.url().endsWith("/reports"), "eski «Maxsus hisobot» manzili hisobotga olib boradi", px.url());
  await px.close();
}

/* ══ I. Mahsulot hisoboti ═══════════════════════════════════════════════ */
console.log("\n── I. Mahsulot hisoboti ──");
{
  productPayload = PRODUCT; productCalls = [];
  const p6 = await openReports();
  await openTab(p6, 3);
  await p6.evaluate(() => document.querySelector("#rpt-all-products tbody tr.tr-link")?.click());
  await p6.waitForSelector(".prep .kpi", { timeout: 15_000 }).catch(() => {});
  await wait(400);
  is(/\/reports\/product\/1\?/.test(p6.url()), "jadval qatori bosilsa tovar sahifasi ochildi", p6.url());
  is(/period=month/.test(p6.url()), "davr o'zi bilan ketdi («Shu oy»)", p6.url());
  is(productCalls.length === 1 && productCalls[0].startsWith("/api/reports/product/1?"),
     "BITTA so'rov ketdi", productCalls.join(" | "));
  const lead = await p6.$eval(".rpt-lead", (e) => e.textContent).catch(() => "");
  is(/45 dona sotildi/.test(lead) && /16 kunga yetadi/.test(lead),
     "bir gapda javob: qancha sotildi va necha kunga yetadi", lead.trim());
  const kpis = await p6.$$eval(".prep .kpi", (n) => n.length);
  is(kpis === 8, "sakkizta raqam (to'rtta katta, to'rtta kichik)", String(kpis));
  const rows = await p6.$$eval(".prep table tbody tr.tr-link", (n) => n.length);
  is(rows === 20, "sotuvlar ro'yxati — avval 20 ta", String(rows));
  await p6.evaluate(() => [...document.querySelectorAll(".prep-foot button")][0]?.click());
  await wait(200);
  const rowsAll = await p6.$$eval(".prep table tbody tr.tr-link", (n) => n.length);
  is(rowsAll === 25, "«Hammasini ko'rsatish» — 25 ta", String(rowsAll));
  const badges = await p6.$$eval(".prep table tbody tr.tr-link .badge", (n) => n.slice(0, 3).map((x) => x.textContent.trim()));
  is(badges[1] === "Qaytarish" && badges[2] === "Bekor qilingan",
     "qaytarish va bekor qilingan MATN bilan ajraladi (rang yolg'iz emas)", badges.join(", "));
  const svg = await p6.$$eval(".prep .chart", (n) => n.length);
  is(svg >= 2, "kunlik va soatlik grafik chizildi", String(svg));
  const moves = await p6.evaluate(() => document.body.textContent.includes("Kirim") && document.body.textContent.includes("Sindi"));
  is(moves, "kirim-chiqim va chiqit sababi ko'rindi");
  await shot(p6, "prep");

  /* Chek ochiladi */
  await p6.evaluate(() => document.querySelector(".prep table tbody tr.tr-link")?.click());
  await p6.waitForSelector(".modal-box", { timeout: 5000 }).catch(() => {});
  is(!!(await p6.$(".modal-box")), "qator bosilsa chek ochildi");
  await p6.keyboard.press("Escape");
  await wait(200);

  /* Excel */
  await p6.evaluate(() => {
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { window.__xlsxBlob = blob; return real(blob); };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__xlsxName = this.download; return; }
      return click.call(this);
    };
  });
  await p6.evaluate(() => [...document.querySelectorAll(".rpt-bar__tools button")]
    .find((x) => /excel/i.test(x.textContent))?.click());
  await wait(500);
  const x = await p6.evaluate(async () => {
    if (!window.__xlsxBlob) return null;
    const buf = new Uint8Array(await window.__xlsxBlob.arrayBuffer());
    let text = ""; for (let i = 0; i < buf.length; i++) text += String.fromCharCode(buf[i]);
    return { name: window.__xlsxName, sheets: (text.match(/<sheet name="/g) || []).length,
             hasQty: text.includes("<v>45</v>"), hasAli: text.includes("Ali") };
  });
  is(!!x && /^tovar-.*\.xlsx$/.test(x.name || ""), "tovar Excel fayli", x?.name);
  is(!!x && x.sheets >= 6 && x.hasQty && x.hasAli, "varaqlar to'ldi (sotildi 45 — SON, kassirlar)",
     x ? `${x.sheets} varaq` : "");

  /* Orqaga — «Tovarlar» bo'limi */
  await p6.evaluate(() => document.querySelector(".prep-head__back")?.click());
  await p6.waitForSelector(".rpt-tabs", { timeout: 10_000 }).catch(() => {});
  const on = await p6.$eval(".rpt-tab.is-on", (e) => e.textContent.trim()).catch(() => "");
  is(/tovarlar/i.test(on), "«Hisobotlar» tugmasi «Tovarlar» bo'limiga qaytardi", on);
  await p6.close();
}

/* ══ J. Bo'sh tovar ═════════════════════════════════════════════════════ */
console.log("\n── J. Bo'sh tovar ──");
{
  productPayload = PRODUCT_EMPTY;
  const before = pageErrors.length;
  const p7 = await openReports(ANALYTICS, "/reports/product/1");
  await wait(600);
  is(pageErrors.length === before, "sotuvsiz, qoldiqsiz tovarda yiqilmadi", pageErrors.slice(before).join(" | "));
  const txt = await p7.evaluate(() => document.body.textContent);
  is(/Omborda qolmagan/.test(txt) && /sotilmadi/.test(txt), "«sotilmadi» va «omborda qolmagan» deb aytdi");
  await p7.close();
  productPayload = PRODUCT;
}

/* ══ K. Menyudan — qidiruv ══════════════════════════════════════════════ */
console.log("\n── K. Qidiruv ──");
{
  const p8 = await openReports(ANALYTICS, "/reports/product");
  await p8.type(".rpt-find__input", "pis");
  await p8.waitForSelector(".rpt-find__row", { timeout: 5000 }).catch(() => {});
  const found = await p8.$$eval(".rpt-find__row", (n) => n.map((x) => x.textContent));
  is(found.length === 1 && /Pista/.test(found[0]), "tovar serverdan topildi", found.join(" | "));
  await p8.click(".rpt-find__row").catch(() => {});
  await wait(500);
  is(/\/reports\/product\/7$/.test(p8.url()), "tanlangach hisobot ochildi", p8.url());
  await p8.close();
}

/* ══ L. Kunlik hisobot (2026-10-09) ═════════════════════════════════════ */
console.log("\n── L. Kunlik hisobot ──");
{
  dayCalls = []; calls = [];
  const p9 = await openReports(ANALYTICS, "/reports/day");
  await p9.waitForSelector(".table tbody tr", { timeout: 8000 }).catch(() => {});
  const lead = await p9.$eval(".rpt-lead", (n) => n.textContent).catch(() => "");
  is(/nima bo'ldi/.test(lead) && /xarid bo'ldi/.test(lead) && !/so'm so'm/.test(lead), "kun xulosasi oddiy gap bilan", lead.slice(0, 160));
  is(dayCalls.length === 1 && /date=\d{4}-\d{2}-\d{2}/.test(dayCalls[0]) && calls.length === 1,
     "bitta kun so'raldi (tovarlar + xulosa)", dayCalls.join(" ") + " | " + calls.join(" "));
  const rowsTxt = await p9.$$eval(".table tbody tr", (n) => n.map((x) => x.textContent));
  const pista = rowsTxt.find((x) => /Pista/.test(x)) || "";
  is(/−3/.test(pista) && /270/.test(pista), "Pista: −3 sotildi, 270 000 so'm", pista);
  const un = rowsTxt.find((x) => /^Un/.test(x.trim())) || "";
  is(/\+25/.test(un) && /−1/.test(un) && /34/.test(un), "Un: +25 keldi, −1 buzildi, kun oxirida 34", un);
  const body = await p9.evaluate(() => document.body.textContent);
  is(/tugab qolgan/i.test(body) && /Pista/.test(body), "«Kun oxirida tugab qolgan tovarlar» — Pista");
  is(/Kun boshida bor edi \+ keldi/.test(body), "jadval ustida hisob qoidasi oddiy so'z bilan");
  await p9.evaluate(() => [...document.querySelectorAll(".rpt-tab")].find((b) => /Hamma tovarlar/.test(b.textContent))?.click());
  await wait(800);
  is(dayCalls.some((c) => /all=true/.test(c)), "«Hamma tovarlar» — harakatsizlari ham so'raldi", dayCalls.join(" "));
  const n3 = await p9.$$eval(".table tbody tr", (n) => n.length);
  is(n3 >= 3, "harakatsiz tovar ham jadvalda", String(n3));
  await p9.evaluate(() => document.querySelector("[aria-label='Oldingi kun']")?.click());
  await wait(800);
  is(dayCalls.length >= 3, "oldingi kunga o'tildi", dayCalls.join(" "));
  await shot(p9, "day-report");
  await p9.close();
}

is(pageErrors.length === 0, "sahifada JS xatosi tushmadi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(fail === 0 ? `\n  ✅ HAMMASI O'TDI (${pass} o'tdi)` : `\n  ❌ ${fail} yiqildi, ${pass} o'tdi`);
process.exit(fail === 0 ? 0 : 1);
