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

   ⚠ API SO'ROVLARI JONLI SERVERGA BORMAYDI (2026-10-11). Bu yerda
   ilgari «API so'rovlari yo'q» deb yozilgan edi — bu NOTO'G'RI edi:
   ilova `https://api.e-kassam.uz` ga haqiqatan so'rov yuborardi, u
   CORS da yiqilardi va natija o'sha paytdagi serverga bog'liq edi
   (bir yurishda `/shop/features` 15 soniya osilib, LCP 18.5s chiqdi).
   Bosh sahifa aynan shu javobni KUTADI (`HomeRoute`, `ready`), ya'ni
   bu shovqin emas — raqamning bir qismi.
   Endi har bir API so'rovi `--api-ms` (standart 300 ms ≈ 150 ms RTT +
   server) dan keyin lokal 503 bilan javob oladi: ilova «server javob
   bermadi» holatida chiziladi (xususiyatlar «hammasi ochiq»), vaqt esa
   har safar bir xil. Backendning o'z sekinligi bunga qo'shilmagan.

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
const API_MS = Number(arg("api-ms", 300));
/* ⚠ «TAYYOR» — LCP dan ALOHIDA (2026-10-11). Kassada LCP elementi tepadagi
   SANA yorlig'i bo'lib chiqdi: u qobiq bilan chiziladi, kassa esa undan
   keyin. Ya'ni LCP kassirning kutishini ko'rsatmaydi va qobiqni oldinroq
   chizib, kassani kechiktiradigan o'zgarish LCP da «yaxshilanish» bo'lib
   ko'rinardi. `--ready ".search-bar input"` — shu element birinchi marta
   CHIZILGAN vaqt. */
const READY = arg("ready", "");

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
let zipped = 0;
let apiHits = 0;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(DIR, url === "/" ? "index.html" : url);
  /* SPA: mavjud bo'lmagan yo'l `index.html` ga tushadi. */
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR, "index.html");
  const type = MIME[path.extname(file)] || "application/octet-stream";
  const raw = fs.readFileSync(file);
  const zip = /^(text\/|application\/(javascript|json|manifest))/.test(type)
              || type === "image/svg+xml";
  /* ⚠ ODDIY `includes`, regex EMAS (2026-10-11). Bu yerda `/\bgzip\b/`
     turardi, lekin fayl Bash heredoc orqali yozilganda `\b` BACKSPACE
     belgisiga (0x08) aylangan: regex hech qachon mos kelmasdi va server
     22-sentabrdan beri HECH QACHON siqmagan. «Server siqmasdan berardi»
     tuzog'i (yuqoridagi izoh) aynan shu tuzatishning ichida qaytgan va
     barcha o'lchovlar ~2 barobar pessimistik chiqqan. Endi siqilgan
     javoblar sanaladi va bittasi ham bo'lmasa o'lchov to'xtaydi (pastda). */
  if (zip && String(req.headers["accept-encoding"] || "").includes("gzip")) {
    zipped++;
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
  await page.evaluateOnNewDocument((sel) => {
    window.__ready = 0;
    if (sel) {
      /* DOM ga tushish — hali ko'rinish emas: undan keyingi layout sekin
         protsessorda soniyaga yaqin bo'lishi mumkin. Vaqt keyingi kadr
         CHIZILGANDAN keyin olinadi (rAF → setTimeout). */
      let seen = false;
      const chk = () => {
        if (seen || !document.querySelector(sel)) return;
        seen = true;
        requestAnimationFrame(() => setTimeout(() => { window.__ready = performance.now(); }, 0));
      };
      new MutationObserver(chk).observe(document, { childList: true, subtree: true });
    }
    try {
      for (const [k, v] of Object.entries({
        ek_token: "m", ek_type: "user", ek_role: "OWNER", ek_username: "m",
        ek_fullName: "M", ek_shopCode: "m", ek_deviceId: "m", ek_lang: "uz", ek_theme: "light",
        /* Qaytgan foydalanuvchida bor (`HomeRoute` yozadi) — usiz bosh
           sahifa bo'lagi oldindan yuklanmaydi. */
        ek_home_page: "Dashboard",
        /* Oxirgi ma'lum modullar (`useShopFeatures`) — oddiy do'kon,
           restoran modullarisiz. ⚠ Shu sababli `--path restaurant` zalni
           EMAS, bosh sahifaga yo'naltirishni o'lchaydi (TABLES yo'q);
           2026-10-11 gacha ham shunday edi — modul noma'lum bo'lganda
           TABLES yopiq. */
        ek_features: JSON.stringify({ owner: "m|m", directions: [], features: ["INVENTORY", "SUPPLY", "STOCK_TAKE",
          "TRANSFER", "PICKUP", "MARKING", "SCALE", "EXPIRY", "CUSTOMERS", "CREDIT", "LOYALTY",
          "CUSTOMER_PORTAL", "ANNOUNCEMENTS", "SHIFTS", "EXPENSES", "REPORTS", "FISCAL", "TELEGRAM_REPORT"] }),
      })) localStorage.setItem(k, v);
    } catch (_) { /* private rejim — o'lchovga xalaqit bermaydi */ }
  }, READY);

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

  /* API — lokal javob, belgilangan kechikish bilan (sabab fayl boshida).
     CORS sarlavhalari shart: ularsiz brauzer javobni tarmoq xatosi deb
     ko'radi va ilova boshqa shoxdan yuradi. Preflight (OPTIONS) ham
     shu yerda ushlanadi — u ham jonli serverga ketmasin. */
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "https://api.e-kassam.uz/*" }] });
  /* ⚠ `*` YETMAYDI: ilova `credentials: "include"` bilan so'raydi va brauzer
     wildcard'ni rad etadi — preflight darhol yiqilib, so'rov tarmoq xatosi
     bo'lardi (`--api-ms` kechikishi umuman qo'llanmasdi). Manba aniq va
     `Allow-Credentials` bilan. Birinchi variantda aynan shunday bo'lgan. */
  const corsBase = [
    { name: "Access-Control-Allow-Origin", value: `http://127.0.0.1:${PORT}` },
    { name: "Access-Control-Allow-Credentials", value: "true" },
    { name: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
  ];
  cdp.on("Fetch.requestPaused", (e) => {
    const preflight = e.request.method === "OPTIONS";
    /* Sarlavhalar ham `*` bo'lolmaydi (credentials) — so'ralganini qaytaramiz. */
    const h = e.request.headers || {};
    const asked = h["Access-Control-Request-Headers"] || h["access-control-request-headers"] || "authorization,content-type";
    const cors = [...corsBase, { name: "Access-Control-Allow-Headers", value: asked }];
    setTimeout(() => {
      apiHits++;
      cdp.send("Fetch.fulfillRequest", {
        requestId: e.requestId,
        responseCode: preflight ? 204 : 503,
        responseHeaders: preflight ? cors : [...cors, { name: "Content-Type", value: "application/json" }],
        body: preflight ? "" : Buffer.from('{"success":false,"message":"measure"}').toString("base64"),
      }).catch(() => { /* sahifa yopilgan */ });
    }, preflight ? 0 : API_MS);
  });

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
      lcp, fcp, ttfb: nav.responseStart || 0, dcl: nav.domContentLoadedEventEnd || 0, ready: window.__ready,
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
console.log(`  mobil · 1.6 Mbit/s · 150 ms RTT · protsessor ${CPU}× sekin · API ${API_MS} ms · ${RUNS} yurish\n`);

/* ⚠ BIRINCHI YURISH TASHLANADI. U har safar ikki barobar sekin
   chiqadi: brauzer endi ko'tarilgan, JIT sovuq, shrift hali
   o'qilmagan. Uni medianaga qo'shish raqamni foydalanuvchi hech
   qachon ko'rmaydigan tomonga suradi. Haqiqiy kassirning monobloki
   kun bo'yi ochiq turadi — «sovuq brauzer» uning holati emas. */
console.log("    isitish (hisobga olinmaydi)…");
await once();
/* O'lchovning o'zini tekshirish: siqilgan javob yo'q bo'lsa raqam yolg'on. */
if (zipped === 0) {
  console.error("\n  ❌ Server birorta faylni siqmadi — o'lchov yaroqsiz (Netlify gzip bilan beradi).\n");
  process.exit(2);
}

const all = [];
for (let i = 0; i < RUNS; i++) {
  const r = await once();
  all.push(r);
  console.log(`    ${i + 1}.  LCP ${ms(r.lcp)}   FCP ${ms(r.fcp)}${READY ? `   TAYYOR ${ms(r.ready)}` : ""}`);
}

console.log("\n  ── MEDIANA ──────────────────────────────");
console.log(`    LCP    ${ms(median(all.map((r) => r.lcp)))}`);
console.log(`    FCP    ${ms(median(all.map((r) => r.fcp)))}`);
console.log(`    TTFB   ${ms(median(all.map((r) => r.ttfb)))}`);
if (READY) console.log(`    TAYYOR ${ms(median(all.map((r) => r.ready)))}   (${READY})`);
console.log(`    API    ${apiHits} so'rov lokal javob oldi (jonli serverga hech biri ketmadi)`);
await browser.close();
server.close();
