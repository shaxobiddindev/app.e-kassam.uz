/* ══════════════════════════════════════════════════════════════════════════
   TO'LIQ EKRAN — JONLI tekshiruv

   ⚠ NEGA STATIK SINOV YETMAYDI. `test/fullscreen.test.mjs` faqat
   «qaysi funksiya chaqirilgan» ini biladi. Brauzer esa `requestFullscreen()`
   ni FOYDALANUVCHI HARAKATISIZ rad etadi va rad etganini hech qayerga
   yozmaydi — kod to'g'ri ko'rinadi-yu, ekran to'liq bo'lmaydi. Buni
   faqat haqiqiy Chrome'da, haqiqiy tugma bosib bilib bo'ladi.

   Kirish talab qilinmasin uchun `localStorage` ga soxta sessiya qo'yiladi
   va API javoblari ushlanadi — `check-a11y.mjs` dagi qolipning o'zi.

   Ishga tushirish:  node scripts/check-fs.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4609;

const CHROME = process.env.CHROME_PATH
  || (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome");

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
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (!req.url().includes("/api/")) return req.continue();
  const cors = {
    "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": req.headers()["access-control-request-headers"] || "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: cors });
  return req.respond({ status: 200, contentType: "application/json", headers: cors,
                       body: JSON.stringify({ success: true, data: [] }) });
});
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ek_token", "fs");
  localStorage.setItem("ek_type", "user");
  localStorage.setItem("ek_role", "OWNER");
  localStorage.setItem("ek_username", "fs");
  localStorage.setItem("ek_fullName", "FS");
  localStorage.setItem("ek_shopCode", "fs");
  localStorage.setItem("ek_deviceId", "fs");
  localStorage.setItem("ek_lang", "uz");
  localStorage.setItem("ek_theme", "light");
});
await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector(".app-layout", { timeout: 15_000 });
await page.waitForSelector(".kassa-fs-topbar-btn", { timeout: 15_000 });

const state = () => page.evaluate(() => ({
  cls: document.querySelector(".app-layout")?.className || "",
  full: !!document.fullscreenElement,
  exit: !!document.querySelector(".kassa-fs-exit"),
  title: document.querySelector(".kassa-fs-topbar-btn")?.title || "",
}));
/* Sinxron emas: `requestFullscreen()` va React qayta chizishi keyingi
   kadrlarda tugaydi. Qat'iy uyqu o'rniga SHARTNI kutamiz — sekin
   mashinada ham, tez mashinada ham bir xil natija beradi. */
const until = async (fn, ms = 4000) => {
  const till = Date.now() + ms;
  for (;;) {
    const s = await state();
    if (fn(s) || Date.now() > till) return s;
    await new Promise((r) => setTimeout(r, 100));
  }
};

let pass = 0, fail = 0;
const yes = (c, m, extra = "") => {
  c ? (pass++, console.log("  ✅ " + m))
    : (fail++, console.log(`  ❌ ${m}${extra ? "  — " + extra : ""}`));
};

let s = await state();
yes(/F11/.test(s.title), "tugma yorlig'ida F11 ko'rsatilgan", s.title);
yes(!s.cls.includes("kassa-fullscreen"), "boshlanishda oddiy holat", s.cls);

await page.keyboard.press("F11");
s = await until((x) => x.full && x.cls.includes("kassa-fullscreen"));
yes(s.cls.includes("kassa-fullscreen"), "F11 — ilova qatlamlari yashirindi", s.cls);
/* ⚠ ASOSIY SINOV. Ilgari rejim FAQAT shu sinfni qo'yardi va kassir
   tepada brauzerning manzil qatorini ko'rib turardi. */
yes(s.full, "F11 — HAQIQIY to'liq ekran yoqildi");
yes(s.exit, "chiqish tugmasi ko'rindi");

await page.keyboard.press("F11");
s = await until((x) => !x.full && !x.cls.includes("kassa-fullscreen"));
yes(!s.cls.includes("kassa-fullscreen"), "ikkinchi F11 — qatlamlar qaytdi", s.cls);
yes(!s.full, "ikkinchi F11 — ekran ham qaytdi");

/* Tugma — kassirning asosiy yo'li; u ham aynan shu ishni qilishi kerak. */
await page.click(".kassa-fs-topbar-btn");
s = await until((x) => x.full && x.cls.includes("kassa-fullscreen"));
yes(s.cls.includes("kassa-fullscreen"), "tugma — qatlamlar yashirindi", s.cls);
yes(s.full, "tugma — HAQIQIY to'liq ekran yoqildi");

/* Boshqa sahifaga o'tilganda ekran ham qaytadi: rejim faqat kassaniki. */
await page.evaluate(() => document.querySelector('a[href="/reports"], a[href="/products"]')?.click());
s = await until((x) => !x.full);
yes(!s.full, "sahifa almashganda to'liq ekrandan chiqiladi");

await browser.close();
server.close();

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
