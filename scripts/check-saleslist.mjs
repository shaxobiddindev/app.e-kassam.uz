/* ══════════════════════════════════════════════════════════════════════════
   SOTUVLAR RO'YXATI SAHIFALANADI, EKRAN ESA YOLG'ON GAPIRMAYDI

   ═══ NUQSON ════════════════════════════════════════════════════════════

   Sotuvlar sahifasi ustunlar filtrini, qidiruvni, holat chiplaridagi
   sonlarni VA yuqoridagi KPI panelini BRAUZERDA, yuklangan massiv
   ustida hisoblardi. Massiv butun davrni qamrab olgani uchun bu
   to'g'ri edi.

   Ro'yxat 50 qatorga bo'linishi bilan uchalasi ham JIMGINA yolg'onga
   aylanadi:

       egasi «bu oy qancha tushdi?» deb qaraydi
         → panel oxirgi 50 chekni qo'shadi
         → «4 200 000» deb turadi, aslida 73 000 000
         → ekranda hech qanday xato yo'q

   ⚠ NEGA KOD SINOVI YETMAYDI. `test/list-paging.test.mjs` «chaqiruv
   bormi» degan savolga javob beradi. Bu yerda esa RAQAMNING O'ZI
   o'lchanadi: server 57 ta chek va 8 900 000 so'm deb aytadi, ekranda
   esa 50 qator turadi. Ikkisi bir-biriga qorishsa — sinov yiqiladi.

   ⚠ SO'ROVLAR HAM TUTILADI: filtr va qidiruv SERVERGA ketishi kerak.
   Ular brauzerda qolsa, ekranda chip turadi-yu, ro'yxat unga
   bo'ysunmaydi.

   Ishga tushirish:  node scripts/check-saleslist.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4631;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

/* ⚠ 57 — 50 GA BO'LINMAYDI. Bo'linadigan son «yana bormi» hisobidagi
   chekka holatni yashirib qo'yardi: oxirgi sahifa aynan `size` ta
   qator bilan tugasa, front bo'sh sahifani so'rab qotib turardi. */
const TOTAL = 57;
const SIZE = 50;

/* Jamlama SERVERDAN keladi va u ekrandagi qatorlarga MOS KELMAYDI —
   aynan shu farq sinovning ma'nosi. */
const SUMMARY = {
  counts: { all: TOTAL, paid: 40, credit: 12, cancelled: 5 },
  totals: {
    sales: 8_900_000, returns: 300_000, net: 8_600_000,
    credit: 1_200_000, paid: 7_700_000, discount: 150_000,
    count: 52, returnCount: 2,
  },
};

const sale = (id) => ({
  id, cashierName: "Kassir", customerName: null,
  totalAmount: 10_000, subtotalAmount: 10_000, discountAmount: 0,
  paymentType: "CASH", status: "PAID", type: "SALE",
  createdAt: new Date(Date.now() - id * 60_000).toISOString(),
  items: [], payments: [{ type: "CASH", amount: 10_000 }],
});

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

const listAsked = [];
const sumAsked = [];
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
  const json = (data) => r.respond({ status: 200, contentType: "application/json",
                                     headers: CORS, body: JSON.stringify({ success: true, data }) });

  if (u.pathname === "/api/sales/summary") {
    sumAsked.push(u);
    return json(SUMMARY);
  }
  if (u.pathname === "/api/sales") {
    listAsked.push(u);
    const p = Number(u.searchParams.get("page") || 0);
    /* ⚠ SERVER FILTRLAYDI. Qidiruv berilgan bo'lsa — bitta chek:
       shu bilan «front o'zi qidiryaptimi» degan savol ochiq
       o'lchanadi. */
    if (u.searchParams.get("q")) {
      return json({ content: [sale(999)], page: 0, size: SIZE, total: 1, hasNext: false });
    }
    const from = p * SIZE;
    const rows = [];
    for (let i = from; i < Math.min(from + SIZE, TOTAL); i++) rows.push(sale(i + 1));
    return json({ content: rows, page: p, size: SIZE, total: TOTAL,
                  hasNext: from + rows.length < TOTAL });
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
await page.goto(`http://127.0.0.1:${PORT}/sales`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

const rowCount = () => page.$$eval("tbody tr", (rs) =>
  rs.filter((x) => x.querySelector("td.mono")).length);
const digits = (s) => (s || "").replace(/[^\d]/g, "");

console.log("\n══ Sotuvlar ro'yxati: sahifalash va jamlama ══");

/* ══ §1 ══════════════════════════════════════════════════════════ */
console.log("\n§1 ⚠ SO'ROV SAHIFA BILAN KETADI");
const first = listAsked[0];
first && first.searchParams.get("page") !== null && first.searchParams.get("size")
  ? ok(`page=${first.searchParams.get("page")} size=${first.searchParams.get("size")} `
       + `from=${(first.searchParams.get("from") || "").slice(0, 10)}`)
  : no("`/sales` so'rovi `page` va `size` bilan ketishi kerak",
       first ? first.search || "(bo'sh)" : "so'rov umuman ketmadi");

console.log("\n§2 Birinchi sahifa chizildi");
const n0 = await rowCount();
n0 === SIZE ? ok(`${n0} qator`) : no(`${SIZE} qator kutilgandi`, String(n0));

/* ══ §3 — ENG MUHIMI ═════════════════════════════════════════════ */
console.log("\n§3 ⚠ CHIPLARDAGI SON SERVERDAN, EKRANDAGI QATORDAN EMAS");
/* Ekranda 50 qator, serverda 57 chek. Chip 50 deb tursa — sonlar
   yana brauzerda sanalyapti. */
const chips = await page.$$eval(".cat-tabs .cat-tab", (bs) =>
  bs.map((b) => b.textContent.trim()));
const allChip = digits(chips[0]);
allChip === String(TOTAL)
  ? ok(`«Barchasi (${TOTAL})» — sahifadagi ${n0} qator emas`)
  : no(`«Barchasi» chipida ${TOTAL} turishi kerak`, chips[0] || "chip yo'q");
digits(chips[3]) === String(SUMMARY.counts.cancelled)
  ? ok(`«Bekor qilingan (${SUMMARY.counts.cancelled})» — ular birinchi sahifada YO'Q`)
  : no("bekor qilinganlar soni jamlamadan olinishi kerak", chips[3] || "yo'q");

console.log("\n§4 ⚠ KPI PANELI JAMLAMADAN");
/* Ekrandagi 50 chekning jami 500 000 so'm. Panelda 8 900 000
   turishi kerak — aks holda egasi tushumini olti barobar kam
   ko'radi. */
const kpi = await page.$$eval(".sales-kpi__item b.ek-num", (bs) =>
  bs.map((b) => b.textContent.trim()));
digits(kpi[0]) === String(SUMMARY.totals.sales)
  ? ok(`sotuv ${kpi[0]} — ekrandagi 50 chekning jami emas`)
  : no("KPI jamlama so'rovidan olinishi kerak", kpi[0] || "panel yo'q");
digits(kpi[3]) === String(SUMMARY.totals.credit)
  ? ok(`qarz ${kpi[3]}`)
  : no("qarz jamlamadan olinishi kerak", kpi[3] || "yo'q");

/* ══ §5 ══════════════════════════════════════════════════════════ */
console.log("\n§5 ⚠ QIDIRUV SERVERGA KETADI");
const beforeSearch = listAsked.length;
await page.evaluate(() => {
  const input = document.querySelector(".search-bar input");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "akmal");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 1400));
const searched = listAsked.slice(beforeSearch).find((u) => u.searchParams.get("q"));
searched
  ? ok(`q=${searched.searchParams.get("q")} serverga yuborildi`)
  : no("qidiruv `/sales?q=` bilan ketishi kerak", "yuborilmadi");

/* ⚠ Server bitta chek qaytardi. Ekranda 50 qator qolsa — front
   javobni e'tiborsiz qoldirib, o'zi qidiryapti. */
const nSearch = await rowCount();
nSearch === 1
  ? ok("ro'yxat SERVER javobidan chizildi (1 qator)")
  : no("qidiruvdan keyin server bergan 1 qator qolishi kerak", String(nSearch));

const sumSearched = sumAsked.find((u) => u.searchParams.get("q"));
sumSearched
  ? ok("jamlama ham qidiruv bilan qayta so'raldi")
  : no("KPI paneli filtr bilan birga yangilanishi kerak", "so'ralmadi");

/* ══ §6 ══════════════════════════════════════════════════════════ */
console.log("\n§6 ⚠ QOLGAN SAHIFA YUKLANADI");
await page.evaluate(() => {
  const input = document.querySelector(".search-bar input");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 1400));

const more = await page.$(".inf button");
if (!more) {
  no("«yana yukla» tugmasi bo'lishi kerak", "topilmadi");
} else {
  await more.click();
  await new Promise((r) => setTimeout(r, 900));
  const n1 = await rowCount();
  n1 === TOTAL
    ? ok(`${TOTAL} qator — ikkinchi sahifa qo'shildi`)
    : no(`${TOTAL} qator kutilgandi`, String(n1));
  const done = await page.$eval(".inf", (d) => d.textContent.trim()).catch(() => "");
  /^.*57.*$/.test(done)
    ? ok(`oxirida «${done}»`)
    : no("ro'yxat tugagani YOZILISHI kerak", done || "bo'sh");
}

/* ══ §7 ══════════════════════════════════════════════════════════ */
console.log("\n§7 Sahifa xatolari");
pageErrors.length === 0 ? ok("konsol toza") : no("xato yo'q bo'lishi kerak", pageErrors[0]);

await browser.close();
server.close();

console.log(bad === 0
  ? "\n✅ sotuvlar ro'yxati: hammasi o'tdi\n"
  : `\n❌ sotuvlar ro'yxati: ${bad} ta muammo\n`);
process.exit(bad === 0 ? 0 : 1);
