/* ══════════════════════════════════════════════════════════════════════════
   TUZATUVCHI CHEK: TUGMA KIMGA CHIZILADI VA ISHORA TO'G'RI KETADIMI (V86)

   ═══ NEGA AYNAN SHU SINOV ══════════════════════════════════════════════

   Ikki narsa `npm test` bilan TEKSHIRIB BO'LMAYDI — u faqat mantiqni
   ko'radi, ekranni emas:

   1. TUGMA FISKALIZATSIYASIZ DO'KONDA CHIZILMASLIGI. Loyihaning
      birinchi qoidasi: bugungi do'kon uchun bir piksel ham
      o'zgarmasin. Shart noto'g'ri yozilsa (`||` o'rniga `&&`, yoki
      `fiscalOn` unutilsa), har bir do'kon sotuvlar tarixida
      tushunarsiz yangi tugmani ko'rib qolardi.

   2. ⚠⚠ ISHORA SERVERGA TO'G'RI KETISHI. Oynada minus YOZILMAYDI:
      yo'nalish tugma bilan tanlanadi va ishora kodda qo'yiladi.
      Agar u teskari bo'lsa, ekranda «−5 000» ko'rinib, serverga
      «+5 000» ketardi — soliqqa ko'p yuborilgan summa YANA
      ko'payardi va buni faqat tekshiruvda bilib qolinardi.

      Bu yerda so'rov TANASI ushlanadi va ichidagi raqam aynan
      tekshiriladi.

   Ishga tushirish:  node scripts/check-corr.mjs
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
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--no-proxy-server"],
});

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const pageErrors = [];

/** Tuzatish so'rovining TANASI — sinovning asosiy dalili. */
let sentBody = null;

const SALE = {
  id: 501, type: "SALE", status: "PAID", paymentType: "CASH",
  totalAmount: 50000, subtotalAmount: 50000, discountAmount: 0,
  loyaltyDiscount: 0, bonusUsed: 0, roundingAmount: 0,
  cashierName: "Sinov kassir", customerName: null, items: [],
  payments: [], createdAt: new Date().toISOString(),
};

async function makePage(fiscalEnabled, role = "OWNER") {
  sentBody = null;
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

    if (p.endsWith("/sales/correction")) {
      try { sentBody = JSON.parse(r.postData() || "{}"); } catch { sentBody = "PARSE-XATO"; }
    }

    let body = { success: true, data: {} };
    if (/\/shop\/profile$/.test(p)) body = { success: true, data: { name: "Gulzor", fiscalEnabled } };
    else if (/\/sales$/.test(p) && r.method() === "GET") body = { success: true, data: [SALE] };
    else if (/\/shop\/features$/.test(p)) {
      body = { success: true, data: { features: [], directions: [], unconfigured: true } };
    }
    /* ⚠ FILIALLAR RO'YXATI MASSIV BO'LISHI SHART. Sinov yozilayotganda
       bu yerda standart `{}` qolgan edi va butun sahifa
       `i.map is not a function` bilan ErrorBoundary'ga tushib
       ketgandi — ya'ni §1 va §2 «tugma yo'q» deb BEKORGA o'tardi.
       Bo'sh ekranda hech qanday tugma bo'lmaydi. */
    else if (/\/shop\/branches$/.test(p)) body = { success: true, data: [] };
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

  await page.goto(`http://127.0.0.1:${PORT}/sales`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 900));
  return page;
}

/** Tuzatish tugmasi (qalam ikonkasi) bormi. */
const corrButton = (page) => page.evaluate(() =>
  Boolean(document.querySelector("button .fa-file-pen")));

/**
 * Nazorat qilinadigan (`controlled`) maydonga qiymat qo'yish.
 *
 * ⚠ `elementHandle.type()` BU YERDA ISHONCHSIZ va sinov birinchi
 * marta aynan shunga yiqilgan edi: maydonga qiymat tushgach `Field`
 * unga «tozalash» tugmasini qo'shadi va qayta chiziladi — ushlab
 * turilgan DOM tugun eskirib qoladi, terish esa yarmida uzilib
 * («5000» o'rniga «50», «Summa…» o'rniga «Su») jimgina davom etadi.
 *
 * React `value` ni o'z prototipi orqali kuzatadi, shuning uchun
 * qiymat NATIVE setter bilan qo'yiladi va keyin `input` hodisasi
 * yuboriladi — React uni haqiqiy terish deb qabul qiladi.
 */
async function setValue(page, index, value) {
  return page.evaluate((idx, val) => {
    const el = document.querySelectorAll(".modal-box input")[idx];
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(val));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, index, value);
}

/** Oynani ochib, yo'nalish + summa + sabab yozadi va yuboradi. */
async function fill(page, dirLabel, amount, reason) {
  await page.evaluate(() => document.querySelector("button .fa-file-pen")?.closest("button")?.click());
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate((d) => {
    const b = [...document.querySelectorAll(".modal-box button")]
      .find((x) => x.innerText.trim() === d);
    b?.click();
  }, dirLabel);
  await new Promise((r) => setTimeout(r, 150));

  /* ⚠ Maydonlar TARTIB bo'yicha: [0] summa, oxirgisi sabab.
     Oradagi `Select` tugma, `input` emas — shuning uchun
     oxirgisini olish xavfsiz. */
  const total = await page.evaluate(() => document.querySelectorAll(".modal-box input").length);
  await setValue(page, 0, amount);
  await new Promise((r) => setTimeout(r, 150));
  await setValue(page, total - 1, reason);
  await new Promise((r) => setTimeout(r, 250));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".modal-footer button")]
      .find((x) => /chiqarish/i.test(x.innerText));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 700));
}

console.log("\n══ TUZATUVCHI CHEK (V86) ══");

/* ── §1 FISKALIZATSIYASIZ DO'KON: TUGMA YO'Q ───────────────────────── */
console.log("\n§1 Fiskalizatsiyasiz do'kon");
{
  const page = await makePage(false);
  if (await corrButton(page)) no("tuzatish tugmasi CHIZILDI — bugungi do'kon uchun o'zgarish", "bor");
  else ok("tugma chizilmadi — bir piksel ham o'zgarmadi");
  await page.close();
}

/* ── §2 KASSIRGA KO'RINMAYDI ───────────────────────────────────────── */
console.log("\n§2 Kassir");
{
  const page = await makePage(true, "CASHIER");
  if (await corrButton(page)) no("KASSIRGA tuzatish tugmasi ko'rindi", "bor");
  else ok("kassirga ko'rinmadi — summani odam yozadigan yagona amal");
  await page.close();
}

/* ── §3 FISKAL DO'KON: TUGMA BOR ───────────────────────────────────── */
console.log("\n§3 Fiskal do'kon");
{
  const page = await makePage(true);
  if (await corrButton(page)) ok("tugma chizildi");
  else no("tugma chizilmadi — fiskal do'kon tuzatish qila olmaydi", "yo'q");
  await page.close();
}

/* ── §4 ⚠ ISHORA: «KO'P KETGAN» → MANFIY ───────────────────────────── */
console.log("\n§4 Ishora — ko'p ketgan");
{
  const page = await makePage(true);
  await fill(page, "Ko'p ketgan", "5000", "Summa ikki marta kiritilgan");

  if (!sentBody) no("so'rov umuman yuborilmadi", "yo'q");
  else if (sentBody.amount === -5000) ok("serverga −5 000 ketdi");
  else no("ISHORA NOTO'G'RI — soliqqa ko'p yuborilgan summa yana ko'payardi",
          JSON.stringify(sentBody.amount));

  if (sentBody?.reason === "Summa ikki marta kiritilgan") ok("sabab yuborildi");
  else no("sabab yuborilmadi", JSON.stringify(sentBody?.reason));

  if (sentBody?.parentSaleId === 501) ok("tuzatilayotgan chek biriktirildi (#501)");
  else no("ota-chek biriktirilmadi", JSON.stringify(sentBody?.parentSaleId));
  await page.close();
}

/* ── §5 ⚠ ISHORA: «KAM KETGAN» → MUSBAT ────────────────────────────── */
console.log("\n§5 Ishora — kam ketgan");
{
  const page = await makePage(true);
  await fill(page, "Kam ketgan", "7000", "Qayd etilmagan tushum");

  if (sentBody?.amount === 7000) ok("serverga +7 000 ketdi");
  else no("ISHORA NOTO'G'RI", JSON.stringify(sentBody?.amount));
  await page.close();
}

/* ── §6 SABABSIZ YUBORIB BO'LMAYDI ─────────────────────────────────── */
console.log("\n§6 Sababsiz");
{
  const page = await makePage(true);
  await page.evaluate(() => document.querySelector("button .fa-file-pen")?.closest("button")?.click());
  await new Promise((r) => setTimeout(r, 400));
  await setValue(page, 0, "5000");
  await new Promise((r) => setTimeout(r, 250));

  /* ⚠ Server ham rad etadi, lekin rahbar buni tugmani bosgandan
     KEYIN emas, OLDIN ko'rishi kerak. */
  const disabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll(".modal-footer button")]
      .find((x) => /chiqarish/i.test(x.innerText));
    return b ? b.disabled : null;
  });
  if (disabled === true) ok("sabab yozilmaguncha tugma o'chiq");
  else no("sababsiz ham yuborsa bo'ladi", String(disabled));
  await page.close();
}

/* ── §7 SAHIFA XATOLARI ────────────────────────────────────────────── */
console.log("\n§7 Sahifa xatolari");
if (pageErrors.length) no("konsolda xato", pageErrors.slice(0, 3).join(" | "));
else ok("konsol toza");

await browser.close();
server.close();
console.log(bad ? `\n❌ tuzatuvchi chek: ${bad} yiqildi` : "\n✅ tuzatuvchi chek: hammasi o'tdi");
process.exit(bad ? 1 : 0);
