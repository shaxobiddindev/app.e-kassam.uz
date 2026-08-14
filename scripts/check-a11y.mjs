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
   qaralmay qo'yiladi. Kontrast ham YIQITADI (2026-08-14 dan): qolgan
   8 ta buzilish tuzatildi, endi chekinishga sabab yo'q.

   Har sahifa IKKI temada tekshiriladi. Ilgari tema yozilmasdi va
   headless Chrome OS sozlamasiga ergashardi — natija kompyuterga qarab
   o'zgarardi, buzilishlarning ko'pi esa aynan qorong'i temada edi.

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
for (const theme of ["light", "dark"]) {
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
  await page.evaluateOnNewDocument((t) => localStorage.setItem("ek_theme", t), theme);
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));

  await page.evaluate(axeSource);
  const { violations } = await page.evaluate(async () =>
    await window.axe.run(document, { resultTypes: ["violations"] }));

  /* Kontrast ham shu yerda — 2026-08-14 gacha u faqat ogohlantirish edi
     (buzilishlar tokenlarda deb o'ylangan; aslida beshtasi bitta
     `opacity:.55` xiralashtirishda, qolgani tema-ga moslanmagan uch
     komponentda ekan — hammasi tuzatildi, §10ĝ). */
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  console.log(`  ${blocking.length ? "❌" : "✅"} ${route} [${theme}]  (buzilish: ${blocking.length})`);
  for (const v of blocking) {
    bad++;
    console.log(`       ${v.id} — ${v.help} (${v.nodes.length} joy)`);
    for (const n of v.nodes.slice(0, 5)) {
      console.log(`         ${(n.target || []).join(" ")}`);
      console.log(`         ${String(n.any?.[0]?.message || n.html || "").replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }
  await page.close();
}
}

await browser.close();
server.close();

if (bad) {
  console.error(`\n  ${bad} ta jiddiy a11y buzilishi. Tuzatmasdan o'tkazib bo'lmaydi.`);
  process.exit(1);
}
console.log("\n  Jiddiy buzilish yo'q.");
