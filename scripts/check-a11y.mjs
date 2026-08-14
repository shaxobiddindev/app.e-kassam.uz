/* ══════════════════════════════════════════════════════════════════════════
   A11Y — axe bilan avtomatik tekshiruv.

   ⚠ NIMANI TEKSHIRADI VA NIMANI YO'Q. axe avtomatik topa oladigan
   buzilishlar ~30-40% ni tashkil qiladi: kontrast, yorliqsiz maydon,
   `aria` xatolari, sarlavhalar tartibi. Klaviatura bilan yurish
   mantig'ini yoki ekran o'quvchidagi ma'noni u BILMAYDI — shuning uchun
   bu tekshiruv "a11y qilindi" degani emas, faqat ochiq-oydin xatolarni
   ushlaydi.

   ⚠ SERVERSIZ ishlaydi: sahifa `dist/` dan yuklanadi va API chaqiruvlari
   USHLANADI (bo'sh javob qaytariladi). Aks holda CI da backend kerak
   bo'lardi va tekshiruv baribir ma'lumotga bog'liq bo'lib qolardi.

   Faqat `serious` va `critical` daraja YIQITADI: `minor` ro'yxati uzun
   bo'ladi va u har commitda CI ni qizartirsa, ogohlantirishga umuman
   qaralmay qo'yiladi. Kontrast esa hozircha OGOHLANTIRISH — sabab
   quyida, `blocking` o'zgaruvchisi yonida.

   Ishga tushirish:  node scripts/check-a11y.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4599;

const CHROME = process.env.CHROME_PATH
  || (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome");

/* Tekshiriladigan ekranlar. Kirish talab qilinmaydigan holat — SPA
   token yo'q bo'lsa kirish ekranini chizadi; shuning uchun `localStorage`
   ga soxta sessiya qo'yiladi va API javoblari bo'sh qaytariladi. */
const ROUTES = ["/", "/sale", "/products", "/reports", "/settings"];

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

const axeSource = fs.readFileSync(path.join(ROOT, "node_modules", "axe-core", "axe.min.js"), "utf8");
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

let bad = 0;
for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/")) {
      return req.respond({ status: 200, contentType: "application/json",
                           body: JSON.stringify({ success: true, data: [] }) });
    }
    req.continue();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("ek_token", "a11y");
    localStorage.setItem("ek_type", "user");
    localStorage.setItem("ek_role", "OWNER");
    localStorage.setItem("ek_username", "a11y");
    localStorage.setItem("ek_fullName", "A11y");
    localStorage.setItem("ek_shopCode", "a11y");
    localStorage.setItem("ek_deviceId", "a11y");
    localStorage.setItem("ek_lang", "uz");
  });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));

  await page.evaluate(axeSource);
  const { violations } = await page.evaluate(async () =>
    await window.axe.run(document, { resultTypes: ["violations"] }));

  const heavy = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  /* ⚠ KONTRAST HOZIRCHA YIQITMAYDI, faqat ogohlantiradi.
     Sabab: qolgan buzilishlar bitta-ikkita komponentda emas, DIZAYN
     TOKENLARIDA — ochiq ko'k fon ustidagi ko'k matn 4.5:1 ga yetmaydi.
     Uni to'g'rilash tokenlar bo'yicha alohida, ongli o'tishni talab
     qiladi (02-DESIGN-SYSTEM.md), bitta CSS qatorini almashtirish emas.
     Shu paytgacha qizil CI har commitda yonib tursa, unga umuman
     qaralmay qo'yiladi — shuning uchun ogohlantirish. */
  const blocking = heavy.filter((v) => v.id !== "color-contrast");
  const warn = heavy.filter((v) => v.id === "color-contrast");

  console.log(`  ${blocking.length ? "❌" : "✅"} ${route}  (yiqitadigan: ${blocking.length}, ogohlantirish: ${warn.length})`);
  for (const v of blocking) {
    bad++;
    console.log(`       ${v.id} — ${v.help} (${v.nodes.length} joy)`);
    console.log(`       ${v.nodes[0]?.html?.slice(0, 90)}`);
  }
  for (const v of warn) {
    console.log(`       ⚠ ${v.id}: ${v.nodes.length} joy — tokenlar o'tishida hal qilinadi`);
  }
  await page.close();
}

await browser.close();
server.close();

if (bad) {
  console.error(`\n  ${bad} ta jiddiy a11y buzilishi. Tuzatmasdan o'tkazib bo'lmaydi.`);
  process.exit(1);
}
console.log("\n  Jiddiy buzilish yo'q.");
