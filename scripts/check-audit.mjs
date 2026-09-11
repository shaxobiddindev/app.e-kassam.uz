/* ══════════════════════════════════════════════════════════════════════════
   AMALLAR JURNALI: OLDINGI → YANGI QIYMAT VA KASSA (V106)

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Server bu uch maydonni V101 dan beri yozadi, ekran esa ularni
   ko'rsatmasdi: ya'ni tekshiruvda birinchi so'raladigan raqamlar
   bazada bor-u, egasining ko'zi oldida yo'q edi. Aynan shunday
   nosozlik jimgina qaytishi mumkin — maydon nomi o'zgaradi, DTO
   qayta tuziladi va qator yana bo'shab qoladi.

   ⚠ `test/audit.test.mjs` RO'YXATNI tekshiradi (amal → yorliq → rang).
   Bu yerda esa CHIZILGAN QATOR o'qiladi.

   Ishga tushirish:  node scripts/check-audit.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4613;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

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

const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

/* Uch xil qator — uch xil holat:
     · ikkala qiymat ham bor      → «12 000 → 9 000»
     · faqat yangisi (yaratish)   → o'q CHIZILMASIN
     · ikkalasi ham yo'q (eski)   → qator umuman bo'lmasin  */
const ROWS = [
  { id: 3, action: "SHOP_SETTING_CHANGE", actorType: "USER", actorUsername: "ali",
    summary: "Kamomad chegarasi", details: null,
    oldValue: "12 000", newValue: "9 000", terminalId: "KASSA-2",
    createdAt: "2026-09-01T10:00:00Z" },
  { id: 2, action: "LOYALTY_TIER_CHANGE", actorType: "USER", actorUsername: "ali",
    summary: "Oltin", details: null,
    oldValue: null, newValue: "Oltin: 5000000 → 7%", terminalId: null,
    createdAt: "2026-09-01T09:00:00Z" },
  { id: 1, action: "SALE_RETURN", actorType: "USER", actorUsername: "vali",
    summary: "Chek #12 qaytarildi", details: null,
    oldValue: null, newValue: null, terminalId: null,
    createdAt: "2026-09-01T08:00:00Z" },
];

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (!r.url().includes("/api/")) return r.continue();
  const CORS = cors(r);
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
  const body = r.url().includes("/shop/audit")
    ? { success: true, data: { items: ROWS, totalItems: ROWS.length, totalPages: 1 } }
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
await page.goto(`http://127.0.0.1:${PORT}/audit`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector("tbody tr", { timeout: 10_000 });

console.log("\n══ AMALLAR JURNALI (V106) ══");

const rows = await page.$$eval("tbody tr", (trs) => trs.map((tr) => ({
  chg:   tr.querySelector(".audit-chg")?.textContent.replace(/\s+/g, " ").trim() || null,
  old:   tr.querySelector(".audit-chg__old")?.textContent.trim() || null,
  neu:   tr.querySelector(".audit-chg__new")?.textContent.trim() || null,
  arrow: !!tr.querySelector(".audit-chg__arrow"),
  term:  tr.querySelector(".audit-term")?.textContent.trim() || null,
})));

console.log("\n§1 Ikkala qiymat ham bor");
rows[0]?.old === "12 000" ? ok("eski qiymat chizildi: 12 000")
                          : no("eski qiymat ko'rinishi kerak", rows[0]?.old);
rows[0]?.neu === "9 000" ? ok("yangi qiymat chizildi: 9 000")
                         : no("yangi qiymat ko'rinishi kerak", rows[0]?.neu);
rows[0]?.arrow ? ok("o'q chizildi") : no("o'q bo'lishi kerak", "yo'q");

console.log("\n§2 ⚠ FAQAT YANGISI bo'lsa — o'q CHIZILMAYDI");
/* «→ 9 000» «nimadandir 9 000 ga» degan yolg'on taassurot berardi. */
rows[1]?.neu ? ok(`yangi qiymat turibdi: ${rows[1].neu}`)
             : no("yangi qiymat ko'rinishi kerak", rows[1]?.neu);
!rows[1]?.arrow ? ok("o'q chizilmadi") : no("o'q chizilmasligi kerak", "chizilgan");
!rows[1]?.old ? ok("eski qiymat yo'q — o'ylab topilmadi") : no("bo'sh bo'lishi kerak", rows[1]?.old);

console.log("\n§3 ⚠ ESKI YOZUVDA qator UMUMAN bo'lmaydi");
/* V101 dan oldingi qator: uchala maydon ham bo'sh. Bo'sh «→» yoki
   tire chizish «ma'lumot yo'q» ni «nol» ga aylantirardi. */
!rows[2]?.chg ? ok("bo'sh qatorda hech narsa chizilmadi")
              : no("chizilmasligi kerak", rows[2]?.chg);

console.log("\n§4 Kassa (terminal)");
rows[0]?.term === "KASSA-2" ? ok("kassa nomi ko'rinadi")
                            : no("terminal ko'rinishi kerak", rows[0]?.term);
!rows[1]?.term ? ok("terminalsiz yozuvda bo'sh chip chizilmadi")
               : no("chizilmasligi kerak", rows[1]?.term);

console.log("\n§5 Kassa bo'yicha FILTR bor");
/* «Shu kassada nima bo'ldi?» — tekshiruvning o'zagi; server aynan
   shu ustun uchun indeks yaratgan (V77). */
const hasCol = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")]
    .find((b) => /filtr/i.test(b.textContent));
  btn?.click();
  return new Promise((res) => setTimeout(() => res(
    /kassa/i.test(document.body.innerText)), 400));
});
hasCol ? ok("filtrda «Kassa» ustuni bor") : no("filtrda bo'lishi kerak", "topilmadi");

console.log("\n§6 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Amallar jurnali: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
