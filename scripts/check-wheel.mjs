/* ══════════════════════════════════════════════════════════════════════════
   SENSORLI MONOBLOKDA SICHQONCHA G'ILDIRAGI SCROLL QILSIN

   ═══ HAQIQIY NUQSON USTIGA YOZILDI (2026-09-15) ════════════════════════

   Do'kon egasi: «sensorli monobloklarda mishka g'ildiragi aylantirsa
   scroll bo'lmayapti». Ekranda hech qanday xato yo'q edi — sahifa
   shunchaki qimirlamasdi.

   ⚠ SABABI CSS NING KAM MA'LUM QOIDASIDA. `.table-wrap` da faqat
   `overflow-x: auto` yozilgan, lekin bir o'q `visible` bo'lmasa
   IKKINCHISI HAM `auto` ga aylanadi. Ya'ni u vertikal scroll idishi,
   ichida esa suriladigan narsa yo'q (`scrollHeight === clientHeight`).

   Teginish rejimida unga `overscroll-behavior: contain` qo'yilgan edi —
   va u aynan shu holatda zanjirni uzadi: g'ildirak idishga tushadi, u
   sura olmaydi va sahifaga ham O'TKAZMAYDI. Jadval ekranning ko'p
   qismini egallagani uchun g'ildirak umuman ishlamayotgandek tuyulardi.

   ⚠ NEGA QO'LDA TUTILMAGAN: nuqson FAQAT teginishli qurilmada chiqadi.
   Dasturchining noutbukida `data-touch="0"` va hammasi joyida.

   ⚠ NAZORAT TAJRIBASI SHART: taqlidning o'zi g'ildirakni yutmayotganini
   isbotlash kerak, aks holda sinov o'zini o'zi aldardi. Shuning uchun
   avval SOF HTML sahifa tekshiriladi.

   Ishga tushirish:  node scripts/check-wheel.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4637;
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
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

const ROWS = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1, name: "Tovar " + (i + 1), barcode: "100" + i, sku: "S-" + i,
  salePrice: 10000, costPrice: 6000, active: true, type: "GOODS",
  unit: "DONA", stockQuantity: 10, categoryName: "Oziq-ovqat", categoryId: 1,
}));

/** Sahifani ochadi va g'ildirakni aylantirib, surilganini qaytaradi. */
async function wheelScrolls({ touch, route }) {
  const page = await browser.newPage();
  /* ⚠ MONOBLOK = KENG EKRAN + TEGINISH. Telefon taqlidi yaramaydi: u
     enni ham torraytiradi va sahifa boshqa tartibga o'tadi. */
  await page.setViewport({ width: 1366, height: 768, hasTouch: touch, isMobile: false });
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
    const p = new URL(r.url()).pathname;
    let data = [];
    if (p.endsWith("/products")) {
      data = { content: ROWS, page: 0, size: 60, total: 60, hasNext: false };
    } else if (p.includes("/shop/features")) {
      data = { features: null, directions: [], unconfigured: false };
    } else if (p.includes("/shop/profile")) data = { fiscalEnabled: false };
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data }) });
  });
  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
  });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1400));

  const tall = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el.scrollHeight > el.clientHeight + 200;
  });
  if (!tall) { await page.close(); return { tall: false }; }

  /* Kursor sahifa o'rtasida — ya'ni JADVAL ustida. */
  await page.mouse.move(683, 420);
  const before = await page.evaluate(() => document.scrollingElement.scrollTop);
  await page.mouse.wheel({ deltaY: 600 });
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => document.scrollingElement.scrollTop);
  const mode = await page.evaluate(() => document.documentElement.getAttribute("data-touch"));
  await page.close();
  return { tall: true, moved: after - before, mode };
}

console.log("\n══ Sensorli monoblokda g'ildirak ══");

/* ══ §0 NAZORAT: taqlid g'ildirakni yutmaydi ════════════════════════ */
console.log("\n§0 ⚠ NAZORAT — taqlidning o'zi ayblanmasin");
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768, hasTouch: true, isMobile: false });
  await page.goto("data:text/html," + encodeURIComponent(
    "<body style='margin:0'><div style='height:5000px'>uzun</div></body>"), { waitUntil: "load" });
  await page.mouse.move(683, 400);
  await page.mouse.wheel({ deltaY: 600 });
  await new Promise((r) => setTimeout(r, 300));
  const moved = await page.evaluate(() => document.scrollingElement.scrollTop);
  moved > 0
    ? ok(`sof HTML sahifa teginish rejimida ham suriladi (${moved}px)`)
    : no("taqlid g'ildirakni yutyapti — bu sinov hech narsa isbotlay olmaydi", String(moved));
  await page.close();
}

/* ══ §1 Sensorsiz — asos holat ═════════════════════════════════════ */
console.log("\n§1 Oddiy kompyuter (teginishsiz)");
{
  const r = await wheelScrolls({ touch: false, route: "/products" });
  if (!r.tall) no("sahifa suriladigan darajada uzun bo'lishi kerak", "qisqa");
  else r.moved > 0 ? ok(`data-touch=${r.mode} · ${r.moved}px surildi`)
                   : no("sensorsiz mashinada ham surilmadi", String(r.moved));
}

/* ══ §2 ASOSIY SINOV ═══════════════════════════════════════════════ */
console.log("\n§2 ⚠ SENSORLI MONOBLOK — G'ILDIRAK ISHLASHI SHART");
{
  const r = await wheelScrolls({ touch: true, route: "/products" });
  if (!r.tall) no("sahifa suriladigan darajada uzun bo'lishi kerak", "qisqa");
  else r.moved > 0
    ? ok(`data-touch=${r.mode} · ${r.moved}px surildi`)
    : no("⚠ G'ILDIRAK O'LIK: jadval ustidagi `overscroll-behavior: contain` "
       + "zanjirni uzyapti — kassir sahifani sura olmaydi", String(r.moved));
}

/* ══ §3 Qoida CSS da ham qulflanadi ════════════════════════════════ */
console.log("\n§3 ⚠ Gorizontal idishlarda `contain` qaytib kelmasin");
{
  const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");
  /* ⚠ `.table-wrap` va `.cat-tabs` — faqat `overflow-x: auto`, ya'ni
     vertikal suriladigan narsasi YO'Q idishlar. Ularda `contain`
     g'ildirakni sahifaga o'tkazmaydi. */
  const block = css.match(/:root\[data-touch="1"\][^{]*\{[^}]*overscroll-behavior:\s*contain[^}]*\}/g) || [];
  const guilty = block.filter((b) => /\.table-wrap|\.cat-tabs/.test(b));
  guilty.length === 0
    ? ok("`contain` faqat haqiqiy vertikal idishlarda")
    : no("`.table-wrap` yoki `.cat-tabs` ga `contain` qaytgan", guilty[0].slice(0, 90));
}

await browser.close();
server.close();

console.log(bad === 0
  ? "\n✅ g'ildirak: hammasi o'tdi\n"
  : `\n❌ g'ildirak: ${bad} ta muammo\n`);
process.exit(bad === 0 ? 0 : 1);
