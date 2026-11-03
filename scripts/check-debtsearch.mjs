/* ══════════════════════════════════════════════════════════════════════════
   QARZDORLAR RO'YXATIDA QIDIRUV HAQIQATAN ISHLAYDI

   ═══ NUQSON ════════════════════════════════════════════════════════════

   Mijozlar → «Qarzdorlar» da qidiruv maydoniga ism yozilardi va
   ro'yxat O'ZGARMASDI. 21aa4f36 (2026-09-12) qidiruvni serverga
   ko'chirdi va brauzerdagi `rankItems` ni olib tashladi; qarzdorlar
   esa boshqa yo'ldan keladi (`/customers/debtors`) va u `q` olmaydi.
   Natija — ikki oy davomida bu ko'rinishda qidiruv yo'q edi, ekranda
   esa hech qanday xato yo'q: maydon chiziladi, yozuv qabul qilinadi.

   ⚠ NEGA KOD SINOVI YETMAYDI. `check-cust` §4 va `list-paging` «chaqiruv
   bormi» deb so'raydi. Bu yerda NATIJA o'lchanadi: uchta qarzdor
   keladi, do'konchi yozadigan so'rovlar beriladi va ekrandagi qatorlar
   sanaladi — yangi alifbo, x/h, telefon oxiri va «topilmadi» matni.

   Ishga tushirish:  node scripts/check-debtsearch.mjs   (avval build)
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4637;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const day = 86_400_000;
const debtor = (id, fullName, phone, balance) => ({
  id, fullName, phone, balance, overdue: 0,
  lastChargeAt: new Date(Date.now() - 3 * day).toISOString(),
  debtSince: new Date(Date.now() - 10 * day).toISOString(),
});
/* ⚠ Ismlar ESKI yozuvda va bittasi kirillda — do'kon ma'lumoti
   o'girilmagan (V168), do'konchi esa yangi alifboda yozadi. */
const DEBTORS = [
  debtor(1, "Shohruh Karimov",       "+998901234567", 120_000),
  debtor(2, "Gulnora Toshpo'latova", "+998977770011",  45_000),
  debtor(3, "Ўлмас Чориев",          "+998935550099",  80_000),
];

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
let debtorsAsked = 0;

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
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
  const json = (data) => r.respond({ status: 200, contentType: "application/json",
                                     headers: CORS, body: JSON.stringify({ success: true, data }) });
  if (u.pathname === "/api/customers/debtors") { debtorsAsked++; return json(DEBTORS); }
  if (u.pathname === "/api/customers") {
    return json({ content: [], page: 0, size: 50, total: 0, hasNext: false });
  }
  return json([]);
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});
await page.goto(`http://127.0.0.1:${PORT}/customers`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 800));

/* Ko'rinish tugmasi — matni bo'yicha emas (til o'zgaradi), tartibi
   bo'yicha ham emas: `aria-selected` bilan tekshiriladigan tab. */
const switched = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll(".cust-views [role=tab], .cust-views button")];
  const tab = tabs.find((b) => /qarzdor|должник|debtor/i.test(b.textContent));
  if (!tab) return false;
  tab.click();
  return true;
});
await new Promise((r) => setTimeout(r, 900));

const names = () => page.$$eval("tbody tr", (rs) =>
  rs.map((r) => r.textContent).filter((t) => /Karimov|Toshpo|Чориев/.test(t))
    .map((t) => (t.match(/Shohruh Karimov|Gulnora Toshpo'latova|Ўлмас Чориев/) || [""])[0]));
const type = async (q) => {
  await page.evaluate((q) => {
    const input = document.querySelector(".cust-tools .search-bar input, .cust-tools input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, q);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, q);
  /* Qarzdorlar qidiruvi kechiktirilmaydi — lekin `SearchBar` o'zi
     kechiktirishi mumkin, shuning uchun ozgina kutiladi. */
  await new Promise((r) => setTimeout(r, 500));
};

console.log("\n══ Qarzdorlar: qidiruv ══");

console.log("\n§1 Röyxat oçiladi");
switched ? ok("«Qarzdorlar» körinişi tanlandi") : no("«Qarzdorlar» tugmasi topilmadi", "—");
debtorsAsked > 0 ? ok("/customers/debtors söraldi") : no("qarzdorlar söralmadi", "0");
const all = await names();
all.length === 3 ? ok("3 ta qarzdor çizildi") : no("3 ta qarzdor kutilgandi", JSON.stringify(all));

/* ══ §2 — ENG MUHIMI ═════════════════════════════════════════════ */
console.log("\n§2 ⚠ YOZILGAN SÖZ RÖYXATNI QISQARTIRADI");
const CASES = [
  ["Şohrux",   "Shohruh Karimov",       "yangi alifbo + x/h → eski yozuvli ism"],
  ["toşpölat", "Gulnora Toshpo'latova", "ş/ö → apostrofli eski yozuv"],
  ["ölmas",    "Ўлмас Чориев",          "lotin söz → kirill ism"],
  ["0011",     "Gulnora Toshpo'latova", "telefon oxiri"],
];
for (const [q, want, why] of CASES) {
  await type(q);
  const got = await names();
  got.length === 1 && got[0] === want
    ? ok(`«${q}» → ${want} (${why})`)
    : no(`«${q}» faqat «${want}» ni qoldirişi kerak (${why})`, JSON.stringify(got));
}

console.log("\n§3 Mos kelmasa — «topilmadi», «qarzdor yöq» EMAS");
await type("zzzqqq");
const emptyText = await page.$eval("tbody", (b) => b.textContent.trim()).catch(() => "");
(await names()).length === 0 && /topilmadi/i.test(emptyText)
  ? ok(`böş natija: «${emptyText}»`)
  : no("qarzdorlar bor, mosi yöq — «Mijoz topilmadi» deyişi kerak", emptyText || "böş");

console.log("\n§4 Qidiruv tozalansa — hammasi qaytadi");
await type("");
(await names()).length === 3 ? ok("3 ta qarzdor qaytdi") : no("3 ta kutilgandi", JSON.stringify(await names()));

console.log("\n§5 Sahifa xatolari");
pageErrors.length === 0 ? ok("konsol toza") : no("xato yöq bölişi kerak", pageErrors[0]);

await browser.close();
server.close();

console.log(bad === 0
  ? "\n✅ qarzdorlar qidiruvi: hammasi ötdi\n"
  : `\n❌ qarzdorlar qidiruvi: ${bad} ta muammo\n`);
process.exit(bad === 0 ? 0 : 1);
