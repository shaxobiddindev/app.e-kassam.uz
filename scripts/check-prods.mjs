/* ══════════════════════════════════════════════════════════════════════════
   TOVARLAR RO'YXATI: NOMLAR BITTA CHIZIQDAN BOSHLANADI (V108)

   Do'kon egasi: «nomida rasmi yo'qlar chapga surilib qolyapti — rasm
   o'rni qoldirilsin».

   ═══ NEGA O'LCHANADI, KO'ZDAN KECHIRILMAYDI ════════════════════════════

   Bu xato ko'zga faqat ikkala holat YONMA-YON tushganda tashlanadi:
   hamma tovar rasmli bo'lsa ham, hammasi rasmsiz bo'lsa ham ro'yxat
   mutlaqo joyida ko'rinadi. Aynan shu sabab u sezilmay yashab kelgan.

   Shuning uchun bu yerda RASMLI va RASMSIZ tovar bitta jadvalda
   chiziladi va nomlarning chap chekkasi PIKSELDA solishtiriladi.

   ⚠ Balandlik ham tekshiriladi — lekin TENGLIK sifatida: rasmli va
   rasmsiz qatorlar navbatma-navbat kelganda balandlik sakrasa,
   ro'yxat yana notekis bo'lardi. Bu chapga surilishning aynan o'zi,
   faqat ikkinchi o'qda.

   Ishga tushirish:  node scripts/check-prods.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4617;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2" };

/** 1×1 shaffof PNG — haqiqiy rasm kerak emas, O'RNI kerak. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

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

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const pageErrors = [];

/* ⚠ Birinchisi RASMLI, ikkinchisi RASMSIZ — xato faqat shu juftlikda
   ko'rinadi (yuqoridagi izoh). */
const PRODUCTS = [
  { id: 1, name: "кефир",  salePrice: 12000, stockQuantity: 5, unit: "DONA",
    unitDecimals: 0, active: true, thumbUrl: "/media/thumb.png" },
  { id: 2, name: "печени", salePrice: 9000,  stockQuantity: 3, unit: "DONA",
    unitDecimals: 0, active: true, thumbUrl: null },
];

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (r.url().includes("/media/")) {
    return r.respond({ status: 200, contentType: "image/png", body: PIXEL });
  }
  if (!r.url().includes("/api/")) return r.continue();
  const CORS = {
    "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      r.headers()["access-control-request-headers"] || "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
  const body = /\/products\b/.test(new URL(r.url()).pathname)
    ? { success: true, data: PRODUCTS }
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
});
await page.goto(`http://127.0.0.1:${PORT}/products`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector("tbody tr", { timeout: 10_000 });

console.log("\n══ TOVARLAR RO'YXATI (V108) ══");

const rows = await page.$$eval("tbody tr", (trs) => trs.slice(0, 2).map((tr) => {
  const cell = tr.querySelector("td:first-child");
  const name = [...cell.querySelectorAll("span")]
    .find((s) => s.textContent.trim() && !s.classList.contains("prod-thumb"));
  const slot = cell.querySelector(".prod-thumb");
  return {
    text: name?.textContent.trim() || null,
    left: name ? Math.round(name.getBoundingClientRect().left) : null,
    slot: slot ? Math.round(slot.getBoundingClientRect().width) : null,
    img:  !!cell.querySelector("img"),
    h:    Math.round(tr.getBoundingClientRect().height),
  };
}));

console.log("\n§1 Juftlik chizildi");
rows.length === 2 && rows[0].img && !rows[1].img
  ? ok(`rasmli «${rows[0].text}» va rasmsiz «${rows[1].text}»`)
  : no("bitta rasmli, bitta rasmsiz qator kerak", JSON.stringify(rows));

console.log("\n§2 ⚠ NOMLAR BITTA CHIZIQDAN boshlanadi");
rows[0].left != null && rows[0].left === rows[1].left
  ? ok(`ikkalasi ham ${rows[0].left}px dan boshlanadi`)
  : no("chap chekka bir xil bo'lishi kerak", `${rows[0].left} ≠ ${rows[1].left}`);

console.log("\n§3 Rasm o'rni RASMSIZDA HAM turadi");
rows[1].slot === 30
  ? ok("bo'sh o'rin 30px kenglikni ushlab turibdi")
  : no("30px bo'lishi kerak", rows[1].slot);

console.log("\n§4 ⚠ QATORLAR BIR XIL BALANDLIKDA");
/* Ro'yxat notekis bo'lmasligi kerak: rasmli va rasmsiz qatorlar
   navbatma-navbat kelganda balandlik sakrasa, ko'z ularni ustma-ust
   taqqoslay olmasdi — chapga surilish bilan bir xil muammo, faqat
   ikkinchi o'qda. */
rows[1].h === rows[0].h
  ? ok(`ikkalasi ham ${rows[0].h}px`)
  : no("balandlik bir xil bo'lishi kerak", `${rows[0].h} ≠ ${rows[1].h}`);

console.log("\n§5 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Tovarlar ro'yxati: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
