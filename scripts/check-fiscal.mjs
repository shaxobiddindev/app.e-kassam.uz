/* ══════════════════════════════════════════════════════════════════════════
   FISKAL REKVIZITLAR: PANEL KIMGA CHIZILADI (V85)

   ═══ NEGA AYNAN SHU SINOV ══════════════════════════════════════════════

   Loyihaning birinchi qoidasi: fiskalizatsiyani ISTAMAYDIGAN do'kon
   uchun tizim bir piksel ham o'zgarmasligi kerak. Bu qoidani `npm test`
   TEKSHIRA OLMAYDI — u faqat mantiqni ko'radi, ekranni emas. Shart
   noto'g'ri yozilsa (masalan `||` o'rniga `&&`, yoki `isOwner`
   unutilsa) bugungi barcha do'kon Sozlamalar sahifasida tushunarsiz
   yangi blokni ko'rib qolardi va «bu nima?» deb qo'ng'iroq qilardi.

   Shu sababli bu yerda BUTUN YO'L tekshiriladi: server javobi →
   shart → ekrandagi matn.

   Uch holat:
     1. Oddiy do'kon (fiskal maydonlar bo'sh) — blok YO'Q
     2. Rekvizit kiritilgan (`tin` bor) — blok BOR, kassalar bilan
     3. Kassir — blok YO'Q (rekvizit kiritilgan bo'lsa ham)

   Ishga tushirish:  node scripts/check-fiscal.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4631;
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
const pageErrors = [];

/** Kassalar ro'yxati — sinov davomida yig'iladigan so'rovlar. */
let posted = [];

/**
 * @param profile  `/shop/profile` javobining fiskal qismi
 * @param role     xodim roli
 * @param registers kassalar ro'yxati
 */
async function makePage(profile, role = "OWNER", registers = []) {
  posted = [];
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
    const p = new URL(r.url()).pathname;
    if (r.method() !== "GET") posted.push(r.method() + " " + p + (new URL(r.url()).search || ""));

    let body = { success: true, data: {} };
    if (/\/shop\/profile$/.test(p)) {
      body = { success: true, data: { name: "Gulzor", ...profile } };
    } else if (/\/shop\/cash-registers$/.test(p)) {
      body = { success: true, data: registers };
    } else if (/\/shop\/features$/.test(p)) {
      body = { success: true, data: { features: [], directions: [], unconfigured: true } };
    }
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });

  await page.evaluateOnNewDocument((role) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: role, ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "monoblok-1",
      ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
  }, role);

  await page.goto(`http://127.0.0.1:${PORT}/settings`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 900));
  return page;
}

const text = (page) => page.evaluate(() => document.body.innerText);

console.log("\n══ FISKAL REKVIZITLAR (V85) ══");

/* ── §1 ODDIY DO'KON: HECH NARSA O'ZGARMAYDI ───────────────────────── */
console.log("\n§1 Fiskalizatsiyasiz do'kon");
{
  const page = await makePage({ fiscalEnabled: false, tin: null });
  const t = await text(page);
  if (/Fiskal rekvizitlar/i.test(t)) no("blok CHIZILDI — bugungi do'konlar uchun o'zgarish", "bor");
  else ok("blok chizilmadi — bir piksel ham o'zgarmadi");
  if (/Kassalar/i.test(t)) no("kassalar bo'limi chizildi", "bor");
  else ok("kassalar bo'limi ham yo'q");

  /* ⚠ So'rov ham YUBORILMASLIGI kerak: panel chizilmasa `list()`
     chaqirilmaydi. Aks holda har bir do'kon har sozlama ochilishida
     keraksiz so'rov qilardi. */
  const asked = posted.length;
  const reqs = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((e) => e.name.includes("/shop/cash-registers")).length);
  if (reqs > 0) no("kassalar SO'RALDI — panel chizilmagan bo'lsa ham", reqs);
  else ok(`kassa so'rovi yuborilmadi (${asked} ta boshqa so'rov)`);
  await page.close();
}

/* ── §2 REKVIZIT KIRITILGAN: PANEL PAYDO BO'LADI ───────────────────── */
console.log("\n§2 Rekvizit kiritilgan do'kon");
{
  const page = await makePage(
    { fiscalEnabled: false, tin: "123456789", tinType: "LEGAL",
      fiscalAddress: "Chilonzor 19", commissionAgentTin: null },
    "OWNER",
    [{ id: 1, name: "1-kassa", virtualCashRegisterSerial: "VK-77",
       fiscalModuleNumber: "FM-42", terminalId: "monoblok-1",
       status: "ACTIVE", fiscalReady: true },
     { id: 2, name: "Zaxira", virtualCashRegisterSerial: null,
       fiscalModuleNumber: null, terminalId: null,
       status: "INACTIVE", fiscalReady: false }]);
  const t = await text(page);

  if (/Fiskal rekvizitlar/i.test(t)) ok("blok chizildi");
  else no("blok chizilmadi — rekvizit kiritilgan bo'lsa ham", "yo'q");

  /* ⚠ Rejim hali YOQILMAGAN va buni panel ochiq aytishi kerak:
     rekvizit to'ldirilgani «endi fiskal ishlayapti» degani emas. */
  if (/Fiskal rejim o'chiq/i.test(t)) ok("rejim holati «o'chiq» deb ko'rsatildi");
  else no("rejim holati noto'g'ri", t.match(/Fiskal rejim[^\n]*/)?.[0] || "topilmadi");

  const tin = await page.$$eval("input", (els) =>
    els.map((e) => e.value).filter((v) => v === "123456789").length);
  if (tin === 1) ok("STIR maydonga tushdi (123456789)");
  else no("STIR maydonda yo'q", tin);

  if (/1-kassa/.test(t) && /VK-77/.test(t) && /FM-42/.test(t)) ok("kassa jadvalda: nomi, seriya, modul");
  else no("kassa ma'lumotlari to'liq emas", t.match(/1-kassa[^\n]*/)?.[0] || "topilmadi");

  /* ⚠ «Raqamlari to'ldirilmagan» belgisi — eng foydali ogohlantirish:
     kassa yoqilgan, lekin undan chek chiqmaydi. */
  if (/to'ldirilmagan/i.test(t)) ok("raqamsiz kassa ogohlantirish bilan belgilandi");
  else no("raqamsiz kassa oddiy ko'rinmoqda", "ogohlantirish yo'q");

  /* ⚠ Yangi kassa formasida QURILMA oldindan to'ldirilishi kerak:
     `X-Device-Id` uzun tasodifiy satr va uni qo'lda ko'chirish
     sozlashning eng ko'p xato qilinadigan qadami bo'lardi. */
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")]
      .find((b) => /qo'shish|add/i.test(b.innerText));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const prefilled = await page.$$eval("input", (els) =>
    els.some((e) => e.value === "monoblok-1"));
  if (prefilled) ok("yangi kassaga shu qurilma oldindan qo'yildi");
  else no("qurilma maydoni bo'sh — qo'lda ko'chirish kerak bo'lardi", "bo'sh");

  await page.close();
}

/* ── §3 KASSIRGA KO'RINMAYDI ───────────────────────────────────────── */
console.log("\n§3 Kassir");
{
  const page = await makePage(
    { fiscalEnabled: true, tin: "123456789", tinType: "LEGAL",
      fiscalAddress: "Chilonzor 19" }, "CASHIER");
  const t = await text(page);
  if (/Fiskal rekvizitlar/i.test(t)) no("kassirga rekvizit paneli KO'RINDI", "bor");
  else ok("kassirga ko'rinmadi — server ham uni bu yo'lga qo'ymaydi");
  await page.close();
}

console.log("\n§4 Sahifa xatolari");
if (pageErrors.length) no("konsolda xato bor", pageErrors.slice(0, 3).join(" | "));
else ok("konsol toza");

console.log(`\n${bad ? "❌" : "✅"} fiskal: ${bad ? bad + " yiqildi" : "hammasi o'tdi"}`);
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
