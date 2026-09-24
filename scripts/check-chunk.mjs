/* ══════════════════════════════════════════════════════════════════════════
   ESKIRGAN CHUNK — ILOVA O'ZINI TIKLAYDIMI

   ═══ QANDAY NOSOZLIK QO'RIQLANADI ═════════════════════════════════════

   Do'kon shikoyati (2026-09-24): kassa, katalog va sozlamalar ochilmadi,
   konsolda «Failed to fetch dynamically imported module:
   .../assets/KassaPage-B_D2KGzd.js». O'sha nom BIR OY OLDINGI buildga
   tegishli edi.

   Ketma-ketlik:
     1. kassa monobloki kunlab yopilmaydi — sahifa ochiq turadi;
     2. yangi reliz chiqadi, Netlify eski `assets/` fayllarini o'chiradi;
     3. kassir «Savdo» ga o'tadi — ESKI HTML yo'q bo'lgan chunkni so'raydi;
     4. `import()` yiqiladi va ekran «Xatolik yuz berdi» bo'lib qoladi.

   Yechim `lib/ek-lazy.js` da: bir marta qayta urinadi, so'ng sahifani
   BIR MARTA yangilaydi (yangi HTML yangi nomlarni olib keladi).

   ═══ SINOV QANDAY ISHLAYDI ════════════════════════════════════════════

   Soxta server kassa chunkini BIRINCHI marta 404 qaytaradi, keyin
   normal beradi — bu aynan haqiqiy holat: eski nom yo'q, yangilangandan
   keyin esa yangi nom bor. Sinov ikki narsani tekshiradi:

     · sahifa O'ZI yangilanadimi (navigatsiya soni oshadimi);
     · yangilangandan keyin kassa ekrani CHIZILADIMI.

   ⚠ Ikkinchi band shart: yangilanish halqasi ham «yangilanadi», lekin
   kassir baribir ishlay olmaydi.

   ⚠ Chunk nomi HTML dan o'qiladi, qo'lga yozilmaydi: nomda kontent
   xeshi bor va har buildda o'zgaradi.

   Ishga tushirish:  node scripts/check-chunk.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4607;

const CHROME = process.env.CHROME_PATH
  || (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2",
               ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };

/* Kassa chunkining HAQIQIY nomi — qo'lda yozilmaydi. */
const kassaChunk = fs.readdirSync(path.join(DIST, "assets"))
  .find((f) => /^KassaPage-.*\.js$/.test(f));
if (!kassaChunk) {
  console.error("\n  ❌ dist/assets ichida KassaPage chunki topilmadi.");
  console.error("  Avval qurib oling:  npm run build\n");
  process.exit(1);
}

let blocked = 0;          // chunk necha marta 404 qilindi
let htmlServed = 0;       // index.html necha marta berildi (= navigatsiya)

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  /* ⚠ FAQAT BIRINCHI SO'ROV to'siladi. Doim to'sib turilsa sinov
     «yangilanish halqasi» ni ham «muvaffaqiyat» deb ko'rsatardi. */
  if (url.endsWith(kassaChunk) && blocked === 0) {
    blocked++;
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("gone");
    return;
  }

  let file = path.join(DIST, url === "/" ? "index.html" : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  if (path.basename(file) === "index.html") htmlServed++;
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--no-proxy-server"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (!r.url().includes("/api/")) return r.continue();
  const CORS = {
    "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      r.headers()["access-control-request-headers"] || "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
  return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                     body: JSON.stringify({ success: true, data: [] }) });
});
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "k", ek_type: "user", ek_role: "OWNER", ek_username: "k",
    ek_fullName: "K", ek_shopCode: "k", ek_deviceId: "k", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
  /* Service worker sinovga aralashmasin: u `cache-first` ishlaydi va
     to'silgan chunkni keshdan berib, nosozlikni yashirishi mumkin. */
  try { Object.defineProperty(navigator, "serviceWorker", { get: () => undefined }); } catch (e) {}
});

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got = "") => { bad++; console.log(`  ❌ ${m}${got ? "  →  " + got : ""}`); };

console.log("\n═══ Eskirgan chunk ═══\n");

await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 40_000 });

/* Yangilanish + qayta yuklash uchun vaqt. Qat'iy uyqu o'rniga SHARTNI
   kutamiz: kassa ekranining o'z belgisi — qidiruv maydoni. */
const until = async (fn, ms = 20_000) => {
  const till = Date.now() + ms;
  for (;;) {
    let s;
    try {
      s = await page.evaluate(() => ({
        search: !!document.querySelector(".search-bar input"),
        crash: /Xatolik|Something went wrong/i.test(document.body.innerText || ""),
        text: (document.body.innerText || "").slice(0, 120),
      }));
    } catch (_) { s = { search: false, crash: false, text: "(navigatsiya)" }; }
    if (fn(s) || Date.now() > till) return s;
    await new Promise((r) => setTimeout(r, 200));
  }
};

const s = await until((x) => x.search || x.crash);

ok(`chunk ${blocked} marta 404 qilindi (${kassaChunk})`);
if (htmlServed < 2) no("sahifa O'ZI yangilanishi kerak edi", `index.html ${htmlServed} marta berildi`);
else ok(`sahifa o'zini yangiladi (index.html ${htmlServed} marta)`);

if (s.crash) no("yangilangandan keyin xato ekrani turibdi", s.text.replace(/\s+/g, " "));
else if (!s.search) no("kassa ekrani chizilmadi", s.text.replace(/\s+/g, " "));
else ok("kassa ekrani yangilangandan keyin chizildi");

await browser.close();
server.close();

if (bad) {
  console.error(`\n  ${bad} ta buzilish. Eskirgan chunk kassirni ishsiz qoldiradi.\n`);
  process.exit(1);
}
console.log("\n  Ilova eskirgan chunkdan o'zini tikladi.\n");
