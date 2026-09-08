/* ══════════════════════════════════════════════════════════════════════════
   SOTUVLAR TARIXI DAVR BILAN SO'RALADI (V100)

   ═══ NUQSON ════════════════════════════════════════════════════════════

   Sahifa do'konning BUTUN tarixini yuklardi va javob hech qachon
   kichraymasdi — u faqat o'sardi. Kuniga 200 chek qiladigan do'kon bir
   yilda 73 000 qatorga yetadi; monoblokdagi brauzer bunday javobni
   ochib ulgurmasdi.

   ⚠ NEGA SERVER SINOVI YETMAYDI. Server oyna qo'yishi mumkin, lekin
   agar EKRAN uni yubormasa yoki davr tanlagichi so'rovni qaytadan
   yubormasa, do'kon egasi hamon o'sha bitta oynada qamalib qolardi va
   buni hech narsa aytmasdi. Shuning uchun bu yerda SO'ROVNING O'ZI
   tutiladi.

   Ishga tushirish:  node scripts/check-period.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4623;
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

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

/** `/sales` ga ketgan HAR so'rovning manzili. */
const asked = [];
const pageErrors = [];

const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 900 });
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
  const u = new URL(r.url());
  if (u.pathname === "/api/sales") asked.push(u);
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify({ success: true, data: [] }) });
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});
await page.goto(`http://127.0.0.1:${PORT}/sales`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

console.log("\n══ Sotuvlar tarixi: davr (V100) ══");

console.log("\n§1 ⚠ SO'ROVDA DAVR BOR");
const first = asked[0];
first && first.searchParams.get("from") && first.searchParams.get("to")
  ? ok(`from=${first.searchParams.get("from")}  to=${first.searchParams.get("to")}`)
  : no("`/sales` so'rovi `from` va `to` bilan ketishi kerak",
       first ? first.search || "(bo'sh)" : "so'rov umuman ketmadi");

console.log("\n§2 Standart davr — JORIY OY");
/* «Bugun» juda tor (kechagi chekni qidirish ko'p uchraydi), «yil» esa
   yana o'sha muammoni qaytarardi. */
if (first?.searchParams.get("from")) {
  const from = new Date(first.searchParams.get("from"));
  const now = new Date();
  from.getDate() === 1 && from.getMonth() === now.getMonth()
    ? ok(`oy boshidan: ${from.toISOString().slice(0, 10)}`)
    : no("standart davr joriy oy bo'lishi kerak", from.toISOString());
}

console.log("\n§3 ⚠ DAVR TANLAGICHI EKRANDA");
/* Serverda jimgina oyna qo'yish oson bo'lardi-yu, do'kon egasi
   «sotuvlarim yo'qolibdi» deb o'ylardi. Davr ko'rinib turishi shart. */
const tabs = await page.$$eval(".sales-head .rpt-seg",
  (bs) => bs.map((b) => b.textContent.trim()));
tabs.length >= 5
  ? ok(`${tabs.length} ta davr tugmasi: ${tabs.slice(0, 4).join(" · ")}…`)
  : no("davr tugmalari ko'rinishi kerak", tabs.join(" | ") || "yo'q");

console.log("\n§4 ⚠ DAVR ALMASHTIRILSA QAYTA SO'RALADI");
/* Tanlagich chizilib, so'rovni yangilamasa — do'kon egasi tugmani
   bosar, ro'yxat esa o'zgarmasdi. */
const before = asked.length;
await page.evaluate(() => {
  const b = [...document.querySelectorAll(".sales-head .rpt-seg")][0]; // «Bugun»
  b?.click();
});
await page.waitForFunction((n) => window.__x || true, {}, before).catch(() => {});
await new Promise((r) => setTimeout(r, 900));
if (asked.length <= before) {
  no("davr almashganda yangi so'rov ketishi kerak", `${before} → ${asked.length}`);
} else {
  const last = asked[asked.length - 1];
  const a = first.searchParams.get("from");
  const b = last.searchParams.get("from");
  a !== b ? ok(`oyna o'zgardi: ${String(a).slice(0, 10)} → ${String(b).slice(0, 10)}`)
          : no("yangi so'rovda oyna boshqa bo'lishi kerak", `${a} = ${b}`);
}

console.log("\n§5 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Sotuvlar davri: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
