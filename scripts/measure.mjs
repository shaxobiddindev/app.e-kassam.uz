/* ══════════════════════════════════════════════════════════════════════════
   O'LCHOV — LCP, FCP va birinchi yuklanish hajmi (4G, mobil)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   `docs/00-OVERVIEW.md` da muvaffaqiyat jadvali bor va uning «Hozir»
   ustuni loyiha boshidan beri «o'lchanmagan» deb turibdi. O'sha yerning
   o'zida yozilgan: «Birinchi vazifa: hozirgi qiymatlarni o'lchab shu
   jadvalga yozish. O'lchovsiz yaxshilanish yo'q.»

   Bandl hajmi allaqachon o'lchanadi (`check-budget.mjs`), LCP esa yo'q.
   Ular BOSHQA-BOSHQA narsa: hajm — sabab, LCP — oqibat. Kichik bandl
   ham sekin chizilishi mumkin (shrift, tashqi so'rov, bloklovchi CSS).

   ═══ QANDAY ═══════════════════════════════════════════════════════════

   Lighthouse ISHLATILMAYDI: u tarmoqni SIMULYATSIYA qiladi va natijasi
   o'z modeliga bog'liq. Bu yerda brauzerning O'ZI sekinlashtiriladi
   (CDP `Network.emulateNetworkConditions` + `Emulation.setCPUThrottling`)
   va LCP brauzerning `PerformanceObserver` idan olinadi — ya'ni
   foydalanuvchi ko'radigan raqam.

   Chegaralar Lighthouse ning mobil profilidan: 1.6 Mbit/s, 150 ms RTT,
   protsessor 4 barobar sekin. Bu «yaxshi 4G» emas, ATAYLAB o'rtacha:
   O'zbekistondagi do'konning ulanishi ideal emas.

   ⚠ HAR O'LCHOV BIR NECHA MARTA. Bitta yurish shovqinli — birinchi
   yurishda disk keshi sovuq, keyingilarida issiq. MEDIANA olinadi.

   ⚠ HAJM BU YERDA O'LCHANMAYDI va bu ataylab. Ikkita usul sinaldi va
   ular BIR-BIRIGA ZID javob berdi: CDP `encodedDataLength` lokal
   fayllarni 0 deb ko'rsatdi (kod «0 KB» chiqdi), Resource Timing
   `transferSize` esa tashqi shriftlarni 0 deb ko'rsatdi (TAO
   sarlavhasi yo'q). Ikkalasi ham to'liq emas, ya'ni raqamni himoya
   qilib bo'lmaydi. Hajm allaqachon `check-budget.mjs` da to'g'ri
   o'lchanadi (dist fayllarining gzip hajmi) — bu yerda takrorlash
   noto'g'ri raqam chiqarardi, xolos.

   ⚠ SERVER JAVOBI HISOBGA OLINMAYDI: sahifa lokal `dist` dan beriladi
   va API so'rovlari yo'q. Ya'ni bu FRONTENDNING o'z raqami — tarmoq
   orqasidagi backend sekinligi bunga qo'shilmagan.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/measure.mjs
     … --dir ../e-kassam-main --path /index.html     (landing uchun)
     … --runs 7
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PORT = 4733;

const arg = (name, def) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const DIR = path.resolve(ROOT, arg("dir", "dist"));

/* ⚠ SAHIFA YO'LI TOZALANADI. Git Bash (MSYS) `--path /index.html` ni
   Windows yo'liga aylantirib yuboradi — argument
   `C:/Program Files/Git/index.html` bo'lib keladi va navigatsiya
   «invalid URL» bilan yiqiladi. Shuning uchun boshlang'ich slesh
   ixtiyoriy: `--path index.html` ham ishlaydi, disk harfi esa
   kesib tashlanadi. */
const PAGE = (() => {
  let v = arg("path", "/");
  const m = /[/\\]([^/\\]+\.html?)$/i.exec(v);
  if (/^[A-Za-z]:/.test(v) && m) v = m[1];
  return v.startsWith("/") ? v : "/" + v;
})();
const RUNS = Number(arg("runs", 5));

if (!fs.existsSync(DIR)) {
  console.error(`Topilmadi: ${DIR} — avval \`npm run build\`.`);
  process.exit(1);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json",
               ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

/* ⚠ GZIP SHART. Birinchi o'lchovda server siqmasdan berardi va LCP
   3.22s chiqdi — bu raqam YOLG'ON pessimistik edi: Netlify fayllarni
   siqib beradi, ya'ni haqiqiy kassir uch barobar kam bayt kutadi.
   Siqilmagan o'lchov bo'yicha «byudjetdan chiqdik» deb xulosa qilish
   bo'lmagan muammoni tuzatishga majbur qilardi. */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(DIR, url === "/" ? "index.html" : url);
  /* SPA: mavjud bo'lmagan yo'l `index.html` ga tushadi. */
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR, "index.html");
  const type = MIME[path.extname(file)] || "application/octet-stream";
  const raw = fs.readFileSync(file);
  const zip = /^(text\/|application\/(javascript|json|manifest))/.test(type)
              || type === "image/svg+xml";
  if (zip && /gzip/.test(req.headers["accept-encoding"] || "")) {
    const body = gzipSync(raw);
    res.writeHead(200, { "Content-Type": type, "Content-Encoding": "gzip",
                         "Content-Length": body.length });
    res.end(body);
  } else {
    res.writeHead(200, { "Content-Type": type, "Content-Length": raw.length });
    res.end(raw);
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});

/** Lighthouse mobil profili — «yaxshi 4G» emas, o'rtacha. */
const NET = { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8,
              uploadThroughput: (750 * 1024) / 8, latency: 150 };
const CPU = 4;

async function once() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  /* Kassa ilovasi tokensiz kirish sahifasiga yo'naltiradi — o'lchov
     ekranning O'ZI haqida bo'lishi uchun sessiya oldindan qo'yiladi.
     Landing uchun bu shunchaki e'tiborsiz qoladi. */
  await page.evaluateOnNewDocument(() => {
    try {
      for (const [k, v] of Object.entries({
        ek_token: "m", ek_type: "user", ek_role: "OWNER", ek_username: "m",
        ek_fullName: "M", ek_shopCode: "m", ek_deviceId: "m", ek_lang: "uz", ek_theme: "light",
      })) localStorage.setItem(k, v);
    } catch (_) { /* private rejim — o'lchovga xalaqit bermaydi */ }
  });

  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", NET);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  /* ⚠ XIZMAT ISHCHISI CHETLAB O'TILADI. `setCacheDisabled` unga
     TA'SIR QILMAYDI: ilova PWA va ikkinchi yurishdan boshlab fayllar
     SW keshidan beriladi — `transferSize` nolga tushadi, LCP esa
     sun'iy ravishda yaxshilanadi. O'lchanayotgan mezon aynan
     BIRINCHI yuklanish, ya'ni kassir ilovani birinchi marta
     ochgandagi holat. */
  await cdp.send("Network.setBypassServiceWorker", { bypass: true });

  await page.goto(`http://127.0.0.1:${PORT}${PAGE}`, { waitUntil: "networkidle0", timeout: 90_000 });

  const m = await page.evaluate(() => new Promise((resolve) => {
    /* LCP OXIRGI yozuvdan olinadi: brauzer sahifa chizilgani sari uni
       bir necha marta yangilaydi va faqat oxirgisi haqiqiy. */
    let lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });

    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0;
    const nav = performance.getEntriesByType("navigation")[0] || {};

    setTimeout(() => resolve({
      lcp, fcp, ttfb: nav.responseStart || 0, dcl: nav.domContentLoadedEventEnd || 0,
    }), 600);
  }));

  await page.close();
  return m;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const ms = (n) => `${(n / 1000).toFixed(2)}s`;

console.log(`\n  ${path.relative(path.resolve(ROOT, ".."), DIR).replace(/\\/g, "/")}${PAGE}`);
console.log(`  mobil · 1.6 Mbit/s · 150 ms RTT · protsessor ${CPU}× sekin · ${RUNS} yurish\n`);

/* ⚠ BIRINCHI YURISH TASHLANADI. U har safar ikki barobar sekin
   chiqadi: brauzer endi ko'tarilgan, JIT sovuq, shrift hali
   o'qilmagan. Uni medianaga qo'shish raqamni foydalanuvchi hech
   qachon ko'rmaydigan tomonga suradi. Haqiqiy kassirning monobloki
   kun bo'yi ochiq turadi — «sovuq brauzer» uning holati emas. */
console.log("    isitish (hisobga olinmaydi)…");
await once();

const all = [];
for (let i = 0; i < RUNS; i++) {
  const r = await once();
  all.push(r);
  console.log(`    ${i + 1}.  LCP ${ms(r.lcp)}   FCP ${ms(r.fcp)}`);
}

console.log("\n  ── MEDIANA ──────────────────────────────");
console.log(`    LCP    ${ms(median(all.map((r) => r.lcp)))}`);
console.log(`    FCP    ${ms(median(all.map((r) => r.fcp)))}`);
console.log(`    TTFB   ${ms(median(all.map((r) => r.ttfb)))}`);
await browser.close();
server.close();
