/* ══════════════════════════════════════════════════════════════════════════
   BITTA NOTO'G'RI JAVOB BUTUN SAHIFANI YIQITMASIN (V86)

   ═══ NEGA KERAK ═══════════════════════════════════════════════════════

   React'da render ichidagi istisno BUTUN DARAXTNI yiqitadi. Ya'ni
   server javobidagi kutilmagan shakl bitta ustunni emas, butun
   bo'limni o'chiradi va foydalanuvchi «Bu bo'limda xatolik yuz
   berdi» oynasini ko'radi. Kassir uchun bu kassa to'xtaganini
   bildiradi.

   ⚠ ENG KO'P UCHRAYDIGAN SABAB — YOLG'ON HIMOYA:

       setItems(r.data || []);      // `{}` truthy — o'tib ketadi
       …
       items.map(...)               // TypeError: map is not a function

   Bu loyihada u IKKI MARTA ro'y bergan (fiskal panel va
   `CommandPalette`), uchinchisi esa shu tekshiruv yozilayotganda
   o'lchab ko'rildi: `BranchSelector` bitta qatorda eski shaklga
   qaytarilganda TO'RTTA sahifa yiqildi.

   ═══ NIMA QILINADI ════════════════════════════════════════════════════

   Har bir sahifa ochiladi va HAR BIR `/api/` so'roviga eng yomon,
   lekin haqiqiy javob beriladi:

       { success: true, data: {} }

   Ya'ni «ro'yxat kutilgan joyda obyekt» — server `List<T>` dan
   `Page<T>` ga o'tganda aynan shunday bo'ladi.

   Sahifa BO'SH ko'rinishi mumkin va bu normal. Yiqilishi esa
   mumkin emas.

   ⚠ Bu `check-array.mjs` dan KENGROQ: statik tekshiruv faqat
   `|| []` shaklini biladi, bu yerda esa sahifa haqiqatan
   chiziladi — `.length`, destrukturizatsiya va boshqa har qanday
   sabab ham ushlanadi.

   Ishga tushirish:  node scripts/check-crash.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4641;
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

/* Yon menyudan ochiladigan barcha bo'limlar. */
const ROUTES = [
  "/", "/sale", "/products", "/categories", "/inventory", "/stock-take",
  "/supply", "/transfers", "/pickup", "/prices", "/customers", "/sales",
  "/reports", "/expenses", "/shop-users", "/branches", "/loyalty",
  "/announcements", "/settings", "/security", "/audit",
  /* ⚠ Yorliqlar sahifasi bu ro'yxatda YO'Q EDI (F5 da qo'shildi):
     u butunlay yangi kod — renderer, ko'rish oynasi, chop etish
     navbati — va uning yiqilishini hech nima ushlamasdi. */
  "/labels",
];

let bad = 0;

async function visit(route) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
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
    /* ⚠ ENG YOMON, LEKIN HAQIQIY JAVOB: ro'yxat o'rniga obyekt. */
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data: {} }) });
  });

  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "monoblok-1",
      ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
  });

  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 800));
  const text = await page.evaluate(() => document.body.innerText);
  await page.close();

  if (/xatolik yuz berdi/i.test(text)) {
    bad++;
    console.log(`  ❌ ${route.padEnd(16)} YIQILDI`);
  } else {
    console.log(`  ✅ ${route.padEnd(16)} tirik`);
  }
}

console.log("\n══ Ro'yxat o'rniga obyekt kelganda sahifa yiqilmaydi ══");
for (const route of ROUTES) await visit(route);

await browser.close();
server.close();

if (bad) {
  console.log(`\n❌ ${bad} ta sahifa yiqildi.`);
  console.log("   Server javobidagi kutilmagan shakl butun bo'limni o'chirdi.");
  console.log("   Ro'yxatni `asArray(...)` bilan oling (`src/lib/ek-array.js`).");
  process.exit(1);
}
console.log("\n✅ yiqilish: hamma sahifa tirik");
process.exit(0);
