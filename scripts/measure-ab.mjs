/* ══════════════════════════════════════════════════════════════════════════
   A/B — ikkita variantni NAVBATMA-NAVBAT o'lchaydi.

   Ishga tushirish:
     CHROME_PATH=... node scripts/measure-ab.mjs <A-papka> <B-papka> [sahifa] [yurish]
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ NEGA NAVBATLASHTIRILADI. Alohida yurgizilgan ikki o'lchov
   solishtirilmaydi:
   mashina yuklamasi vaqt o'tishi bilan o'zgaradi va farq
   o'zgarishdan emas, shundan chiqadi. Bugun aynan shu bo'ldi —
   qaytarilgan o'zgarishdan keyin raqam yana boshqacha chiqdi.
   Navbatlashtirilsa, drift ikkalasiga BIR XIL ta'sir qiladi. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { gzipSync } from "node:zlib";

const A = process.argv[2];            // birinchi papka
const B = process.argv[3];            // ikkinchi papka
const PAGE = "/" + (process.argv[4] || "index.html");
const ROUNDS = Number(process.argv[5] || 5);
const PORT = 4766;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json",
               ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

let DIR = A;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(DIR, u === "/" ? "index.html" : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, "index.html");
  const t = MIME[path.extname(f)] || "application/octet-stream";
  const raw = fs.readFileSync(f);
  if (/^(text\/|application\/(javascript|json|manifest))/.test(t) && /gzip/.test(req.headers["accept-encoding"] || "")) {
    const b = gzipSync(raw);
    res.writeHead(200, { "Content-Type": t, "Content-Encoding": "gzip", "Content-Length": b.length });
    res.end(b);
  } else {
    res.writeHead(200, { "Content-Type": t, "Content-Length": raw.length });
    res.end(raw);
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});

async function once() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8, latency: 150 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.setBypassServiceWorker", { bypass: true });
  await page.goto(`http://127.0.0.1:${PORT}${PAGE}`, { waitUntil: "networkidle0", timeout: 90_000 });
  const m = await page.evaluate(() => new Promise((resolve) => {
    let lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true });
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0;
    setTimeout(() => resolve({ lcp, fcp }), 600);
  }));
  await page.close();
  return m;
}

/* ⚠ QAYTA URINISH. Puppeteer ba'zan navigatsiyani «LifecycleWatcher
   disposed» bilan uzadi — bu o'lchanayotgan sahifaga aloqasi yo'q,
   brauzerning o'z tebranishi. Usiz butun yurish (o'n raund, to'rt
   daqiqa) bitta uzilishdan bekor bo'lardi. */
async function onceSafe() {
  for (let t = 0; t < 3; t++) {
    try { return await once(); }
    catch (e) { if (t === 2) throw e; console.log(`     (qayta urinish: ${String(e.message).slice(0, 50)})`); }
  }
}

DIR = A; await onceSafe();   // isitish

const res = { A: [], B: [] };
for (let i = 0; i < ROUNDS; i++) {
  DIR = A; const a = await onceSafe();
  DIR = B; const b = await onceSafe();
  res.A.push(a); res.B.push(b);
  console.log(`  ${i + 1}.  A  LCP ${(a.lcp / 1000).toFixed(2)}s  FCP ${(a.fcp / 1000).toFixed(2)}s` +
              `   │   B  LCP ${(b.lcp / 1000).toFixed(2)}s  FCP ${(b.fcp / 1000).toFixed(2)}s`);
}

const med = (xs) => { const s = [...xs].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const s = (n) => `${(n / 1000).toFixed(2)}s`;

console.log(`\n  A (${path.basename(A)})  LCP ${s(med(res.A.map((r) => r.lcp)))}  FCP ${s(med(res.A.map((r) => r.fcp)))}`);
console.log(`  B (${path.basename(B)})  LCP ${s(med(res.B.map((r) => r.lcp)))}  FCP ${s(med(res.B.map((r) => r.fcp)))}`);
const d = med(res.B.map((r) => r.lcp)) - med(res.A.map((r) => r.lcp));
console.log(`\n  LCP farqi: ${d > 0 ? "+" : ""}${(d / 1000).toFixed(2)}s  (B − A)\n`);

await browser.close();
server.close();
