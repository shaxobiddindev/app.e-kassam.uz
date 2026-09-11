/* ══════════════════════════════════════════════════════════════════════════
   HISOBOTNI CHOP ETISH (V73)

   Do'kon egasi: «hisobotni chop qilishda ekranga sig'maslik holati bor».

   ═══ NEGA ALOHIDA TEKSHIRUV ════════════════════════════════════════════

   Chop etish ko'rinishini EKRANDAN ko'rib bo'lmaydi: u boshqa
   kenglikda (A4 ≈ 794px), boshqa uslub (`@media print`) va boshqa
   shrift muhitida chiziladi. Ya'ni ekranda mukammal turgan sahifa
   qog'ozda ustunlari kesilgan holda chiqishi mumkin va buni faqat
   chop etib ko'rgan odam biladi.

   ⚠ Bu yerda haqiqiy PDF chiqariladi (`page.pdf`) — u brauzerning
   AYNAN chop etish yo'li, ya'ni `@media print` qoidalari qo'llanadi.
   So'ng sahifadagi har element A4 kengligiga SIG'ADIMI degan savol
   o'lchov bilan tekshiriladi.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-print.mjs
     SHOT_DIR=/tmp/shots — PDF o'sha yerga yoziladi.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4621;
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
  "Access-Control-Allow-Headers": req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

let pass = 0, fail = 0;
const ok  = (m, x = "") => { pass++; console.log(`  ✅ ${m}${x ? ` (${x})` : ""}`); };
const bad = (m, x = "") => { fail++; console.log(`  ❌ ${m}${x ? ` — ${x}` : ""}`); };
const is  = (c, m, x = "") => (c ? ok(m, x) : bad(m, x));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Soxta tahlil (check-report.mjs dagi bilan bir xil shakl) ────────── */
const kpi = (mul = 1) => ({
  grossSales: 120e6 * mul, discount: 5e6 * mul, returns: 3e6 * mul,
  netSales: 112e6 * mul, cogs: 78e6 * mul, grossProfit: 34e6 * mul, margin: 30.4,
  expenses: 9e6 * mul, inventoryLoss: 1.2e6 * mul, netProfit: 23.8e6 * mul,
  receipts: 438, returnReceipts: 7, cancelledReceipts: 3, cancelledAmount: 410000,
  avgReceipt: 255000, maxReceipt: 1840000, minReceipt: 12000, itemsSold: 5210,
  cash: 40e6, card: 38e6, online: 20e6, savings: 6e6, credit: 8e6,
  customers: 310, newCustomers: 24, lossSales: 2, lossAmount: 180000,
});
const DATA = {
  from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 8, 15).toISOString(), bucket: "day",
  now: kpi(1), prev: kpi(0.82),
  series: Array.from({ length: 14 }, (_, i) => ({
    label: `${String(i + 1).padStart(2, "0")}.09`, at: new Date(2026, 8, i + 1).toISOString(),
    netSales: 6e6 + i * 4e5, cogs: 4e6, grossProfit: 2e6, returns: 0, receipts: 30,
  })),
  hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, netSales: h > 8 && h < 22 ? 3e6 : 0, receipts: 20 })),
  heat: [1, 2, 3].flatMap((d) => [10, 14, 18].map((h) => ({ dow: d, hour: h, netSales: d * h * 6e4, receipts: 5 }))),
  products: Array.from({ length: 12 }, (_, i) => ({
    productId: i + 1, name: `Tovar nomi ${i + 1}`, unit: "DONA", categoryName: "Ichimliklar",
    quantity: 1200 - i * 60, netSales: 18e6 - i * 1e6, cogs: 14e6, profit: 4e6, margin: 22.6,
    returnedQty: 0, turnover: 12.4, stockQty: 300, stockValue: 2e6,
  })),
  categories: [
    { name: "Ichimliklar", quantity: 4821, netSales: 35e6, profit: 8.2e6, margin: 23.4 },
    { name: "Oziq-ovqat", quantity: 3210, netSales: 28e6, profit: 6.1e6, margin: 21.8 },
  ],
  cashiers: [
    { userId: 1, name: "Ali Valiyev", receipts: 132, netSales: 12.4e6, discount: 3e5, returns: 2e5,
      returnCount: 3, cancelled: 1, avgReceipt: 93900, nonCashShare: 58.2 },
    { userId: 2, name: "Vali Aliyev", receipts: 98, netSales: 9.8e6, discount: 1.2e5, returns: 0,
      returnCount: 0, cancelled: 0, avgReceipt: 1e5, nonCashShare: 41.7 },
  ],
  branches: [],
  payments: [
    { type: "CASH", amount: 4975891, share: 38.5 }, { type: "CARD", amount: 4897681, share: 37.9 },
    { type: "CLICK", amount: 1519880, share: 11.8 }, { type: "PAYME", amount: 1156960, share: 9.0 },
    { type: "SAVINGS", amount: 333000, share: 2.6 }, { type: "CREDIT", amount: 28000, share: 0.2 },
  ],
  expenses: [{ name: "Ijara", amount: 5e6, share: 55.5 }, { name: "Oylik", amount: 3e6, share: 33.3 }],
  stock: { totalQuantity: 45210, totalValue: 210e6, outOfStock: 4, lowStock: 12,
           expiringSoon: 6, expired: 2, slowMoving: [{ productId: 90, name: "Sekin tovar", stockQty: 180, stockValue: 3.2e6, soldQty: 2 }] },
  debt: { total: 124e6, overdue: 37e6, bucket0to7: 20e6, bucket8to30: 67e6, bucket31plus: 37e6, debtors: 41 },
  customers: { total: 1482, active: 310, newInPeriod: 24, debtors: 41,
               segments: { VIP: 61, LOYAL: 240, POTENTIAL: 700, AT_RISK: 300, LOST: 181 } },
  anomalies: [{ kind: "HIGH_RETURNS", severity: "high", subjectName: "Ali", value: 8.4, baseline: 1.7 }],
  basket: [{ productA: 1, nameA: "Coca-Cola", productB: 2, nameB: "Chips", together: 64, confidence: 64 }],
};

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (!r.url().includes("/api/")) return r.continue();
  const C = cors(r);
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: C });
  const p = new URL(r.url()).pathname;
  const body = p === "/api/reports/analytics" ? { success: true, data: DATA }
    : p === "/api/shop/profile" ? { success: true, data: { monthlySalesTarget: null, name: "Chilonzor do'koni" } }
    : { success: true, data: [] };
  r.respond({ status: 200, contentType: "application/json", headers: C, body: JSON.stringify(body) });
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
  localStorage.removeItem("ek_rpt_period");
});
await page.goto(`http://127.0.0.1:${PORT}/reports`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector(".kpi", { timeout: 15_000 });
await wait(500);

/* ══ A. Chop etish kengligiga sig'adimi ════════════════════════════════
   A4 ning bosiladigan kengligi ≈ 794px (96 dpi). Brauzerni AYNAN shu
   kenglikda `print` uslubiga o'tkazamiz. */
console.log("── A. A4 kengligiga sig'ish ──");
const A4 = 794;
await page.setViewport({ width: A4, height: 1123 });
await page.emulateMediaType("print");
await wait(400);

const over = await page.evaluate((w) => {
  const bad = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(".rpt *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    /* Ichida o'z scroli bor quti (jadval) — chiqib ketishi mumkin va
       bu xato emas: chop etishda u kesiladi, lekin bu ATAYLAB. */
    if (r.right > w + 1) {
      const key = el.className || el.tagName;
      if (seen.has(key)) continue;
      seen.add(key);
      bad.push({ cls: String(key).slice(0, 60), right: Math.round(r.right), w: Math.round(r.width) });
    }
  }
  return { bad, bodyScroll: document.documentElement.scrollWidth };
}, A4);

is(over.bodyScroll <= A4 + 1, "sahifa A4 kengligidan chiqmaydi",
   `${over.bodyScroll}px / ${A4}px`);
is(over.bad.length === 0, "hech bir element qog'ozdan chiqmagan",
   over.bad.slice(0, 6).map((b) => `${b.cls}→${b.right}`).join(", "));

/* ══ B. Ikonka shriftisiz ham o'qiladimi ═══════════════════════════════
   ⚠ Chop etishda ikonka shrifti KELMASLIGI mumkin (u tashqi CDN dan
   yuklanadi) — o'shanda bezak ikonkalar o'rnida BO'SH KATAKCHA
   («tofu») qolib ketadi. Qog'ozda ular umuman kerak emas. */
console.log("\\n── B. Ikonkalar ──");
const icons = await page.evaluate(() => {
  const list = [...document.querySelectorAll(".rpt i.fa-solid, .rpt i.fa-brands")];
  const shown = list.filter((el) => getComputedStyle(el).display !== "none");
  return { total: list.length, shown: shown.length };
});
is(icons.shown === 0, "chop etishda bezak ikonkalar chizilmaydi",
   `${icons.shown} / ${icons.total} ko'rinmoqda`);

/* Ma'no tashiydigan belgi (izoh «i») FONT AWESOME ga bog'liq
   bo'lmasligi kerak — u shriftsiz ham ko'rinishi shart. */
const hint = await page.evaluate(() => {
  const h = document.querySelector(".kpi__hint");
  if (!h) return null;
  return { tag: h.tagName, isFa: h.className.includes("fa-"), text: (h.textContent || "").trim() };
});
is(hint && !hint.isFa, "izoh belgisi Font Awesome ga BOG'LIQ EMAS", JSON.stringify(hint));

/* ══ B2. Qog'ozdagi sarlavha ═══════════════════════════════════════════
   ⚠ Bosilgan varaqda yon panel YO'Q — sarlavhasiz hujjat «qaysi
   do'konning qaysi davri?» degan savolni javobsiz qoldirardi. Bir
   necha filialli do'konda ikkita bosilgan hisobotni ajratib
   bo'lmasdi. */
const head = await page.evaluate(() => {
  const h = document.querySelector(".rpt-print-head");
  if (!h) return null;
  return { shown: getComputedStyle(h).display !== "none", text: h.textContent.trim() };
});
is(head?.shown, "qog'ozda sarlavha bor");
is(head?.text?.includes("Chilonzor"), "sarlavhada DO'KON nomi bor", head?.text);
is(/\d{4}-\d{2}-\d{2}/.test(head?.text || ""), "sarlavhada DAVR bor", head?.text);

/* Bo'lim tanlagichi (sahifa tablari) qog'ozda kerak emas. */
const tabs = await page.evaluate(() => {
  const t = document.querySelector(".pg-tabs");
  return t ? getComputedStyle(t).display : "yo'q";
});
is(tabs === "none" || tabs === "yo'q", "sahifa tanlagichi qog'ozda chizilmaydi", tabs);

/* ══ C. Haqiqiy PDF ════════════════════════════════════════════════════ */
console.log("\\n── C. PDF ──");
await page.emulateMediaType(null);
const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" } });
is(pdf.length > 5000, "PDF chiqdi", `${Math.round(pdf.length / 1024)} KB`);
if (SHOT) fs.writeFileSync(path.join(SHOT, "rpt-print.pdf"), pdf);

is(pageErrors.length === 0, "sahifada JS xatosi tushmadi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(fail === 0 ? `\\n  ✅ HAMMASI O'TDI (${pass} o'tdi)` : `\\n  ❌ ${fail} yiqildi, ${pass} o'tdi`);
process.exit(fail === 0 ? 0 : 1);
