/* ══════════════════════════════════════════════════════════════════════════
   OMBOR: HOLAT PANELI VA USTUN FILTRI (V68)

   ═══ NEGA SHU IKKISI BITTA TEKSHIRUVDA ═════════════════════════════════

   Ikkalasi ham «ro'yxatni toraytirish» degan bitta ishni qiladi va
   do'kon egasi ularni ATAYLAB bitta qatorga qo'ydirdi. Alohida
   sinalganda ular bir-birini bekor qilib qo'yishi mumkin edi —
   masalan tez holat filtri ustun filtridan KEYIN qo'llansa, «muddati
   o'tgan» tugmasi ustun sharti bilan birga ishlamay qolardi.

   Bu yerda tekshiriladi:
     A. Panel MUAMMO YO'Q paytda ham turadi (ilgari umuman
        chizilmasdi va holat tanlagichi ham u bilan yo'qolardi);
        ogohlantirish TONI esa faqat muammo bo'lganda yoqiladi.
     B. Holat segmenti ro'yxatni kesadi va son bilan mos keladi.
     C. Ustun filtri: shart qo'yiladi, qatorlar kesiladi, chip
        ko'rinadi, tozalanadi.
     D. Ikkalasi BIRGA: holat + ustun sharti — VA bilan.
     E. Sarlavha bosilganda saralash: o'sish → kamayish → tartibsiz.

   ⚠ CORS sarlavhalari shart — sababi `check-pay.mjs` da yozilgan.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-inv.mjs
     SHOT_DIR=/tmp/shots — berilsa skrinshotlar o'sha yerga yoziladi.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4615;
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

const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

const pageErrors = [];
/* ⚠ TAVSIYANI QO'LLASH tugmasi YUBORGAN tana (V100). Faqat
   tugma bosildimi degan sinov yetarli emas: tugma bosilib,
   ichida esa noto'g'ri narx ketsa ekran «qo'yildi» deb
   yozardi-yu, do'kon hamon zarariga sotardi. */
let priceSent = null;
/* ⚠ Bajik oqimini sinash uchun: yoqilganda narx yangilash
   so'rovi serverdagidek 428 qaytaradi. */
let put428 = false;
let pass = 0, fail = 0;
const ok  = (m, extra = "") => { pass++; console.log(`  ✅ ${m}${extra ? ` (${extra})` : ""}`); };
const bad = (m, extra = "") => { fail++; console.log(`  ❌ ${m}${extra ? ` — ${extra}` : ""}`); };
const is  = (cond, m, extra = "") => (cond ? ok(m, extra) : bad(m, extra));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ⚠ `toISOString()` ISHLATILMAYDI — u UTC beradi, Toshkent esa
   UTC+5. Yarim tundan soat 05:00 gacha u KECHAGI kunni qaytaradi:
   `day(-3)` uch kun emas, TO'RT kun oldingi sanani berardi va
   «kechikish N kun» bandi aynan shu soatlarda yiqilardi. Ya'ni
   qorovul har kecha besh soat davomida yolg'on qizil bo'lardi — va
   bunday qorovulga bir haftadan keyin hech kim qaramaydi.

   Bu qoida loyihada allaqachon yozilgan (`src/lib/ek-due.js` boshidagi
   izoh) va u yerda hurmat qilinadi; bu yerga yetib kelmagan edi.

   Sana MAHALLIY qismlardan yig'iladi: brauzer ham, ilova ham
   mahalliy vaqtda hisoblaydi. */
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ── Soxta ombor ────────────────────────────────────────────────────────
   ⚠ Har bir holat KAMIDA bitta tovar bilan: segment soni bor holat
   uchungina chiziladi va nol turgan holat sinovdan tushib qolardi. */
/* ⚠ API PARTIYA qatorlarini beradi (`/inventory`), guruhlarni emas —
   sahifa ularni `groupByProduct` bilan o'zi yig'adi. Soxta javob ham
   AYNAN shu shaklda bo'lishi shart, aks holda jadval bo'sh chiqadi va
   sinov «filtr ishlamadi» deb yolg'on gapirardi. */
const batch = (id, name, code, qty, cost, price, minQ, exp) => ({
  /* ⚠ `inventoryId` SHART: «To'g'irlash» tugmasi faqat haqiqiy
     partiyada chiziladi (`single.inventoryId != null`). Usiz qatorda
     bitta tugma qolardi va «tugmalar yopishib qolgan» degan holat
     sinovda umuman yuzaga kelmasdi. */
  id: id * 100, inventoryId: id * 100, productId: id, productName: name, barcode: code,
  quantity: qty, minQuantity: minQ, costPrice: cost, salePrice: price,
  expiryDate: exp, unit: "DONA",
});
const GOOD = [
  batch(1, "Suv 1L", "1000", 120, 2000,  3000,  10, null),
  batch(2, "Choy",   "1001",  80, 9000,  14000,  5, null),
  batch(3, "Shakar", "1002",  45, 11000, 15000,  5, null),
];
const BAD = [
  ...GOOD,
  batch(4, "Sut 1L", "2000", 12, 8000, 11000, 5, day(-3)),   // muddati o'tgan
  batch(5, "Qatiq",  "2001",  7, 6000,  9000, 5, day(3)),    // muddati yaqin
  batch(6, "Non",    "2002",  1, 2500,  4000, 20, null),     // kam qolgan
];

/* ══════════════════════════════════════════════════════════════════════
   PARTIYALAR SAHIFASI (V76) — soxta ma'lumot

   ⚠ Sanalar BUGUNGA nisbatan: «muddati o'tgan», «yaqin» va «kun
   qoldi» tushunchalari bugungi kunga bog'liq va qat'iy sana bilan
   sinov ertaga o'z-o'zidan yiqilardi.
   ══════════════════════════════════════════════════════════════════════ */
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();

const bt = (id, qty, cost, exp, extra = {}) => ({
  inventoryId: id, productId: 1, productName: "Sut 1L", barcode: "2000",
  quantity: qty, costPrice: cost, salePrice: 11000, expiryDate: exp,
  unit: "DONA", ...extra,
});

const LIVE = [
  bt(101, 12, 8000, day(5),  { createdAt: ago(3) }),    // yaqin (5 kun)
  bt(102, 40, 7500, day(60), { createdAt: ago(30) }),   // tinch, katta qoldiq
  bt(103,  0, 7000, day(90), { createdAt: ago(200) }),  // bo'shab qolgan
  bt(104,  6, 9000, day(-3), { createdAt: ago(500), expired: true }), // muddati o'tgan
];
const ARCH = [
  bt(201, 0, 6000, day(-40), { createdAt: ago(2000), archivedAt: ago(100) }),
];

async function openBatches({ live = LIVE, arch = ARCH } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const u = new URL(r.url());
    /* ⚠ ARXIV `?archived=true` BILAN so'raladi — ikkalasini yo'l
       bo'yicha ajratib bo'lmaydi va so'rov qatorini ham o'qish kerak.
       Aks holda ikkala bo'lim bir xil ro'yxatni ko'rsatardi. */
    const body = u.pathname === "/api/inventory/product/1"
      ? { success: true, data: u.searchParams.get("archived") === "true" ? arch : live }
      : u.pathname.includes("/shop/profile")
        ? { success: true, data: { creditEnabled: false, nearExpiryDays: 7 } }
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
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_flt_")) localStorage.removeItem(k);
  });
  await page.goto(`http://127.0.0.1:${PORT}/inventory/1`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector(".batch-tabs", { timeout: 15_000 });
  await wait(300);
  return page;
}

async function openInv(items, advice = null) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    if (process.env.DEBUG_URLS) console.log("   →", r.method(), r.url());
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    /* ⚠ YO'L bo'yicha solishtiriladi, matn ichida qidirilmaydi:
       manba nomi ham `api.e-kassam.uz` va oddiy `includes("/api")`
       xostga ham tushib, mos kelmagan javob berardi. */
    const p = new URL(r.url()).pathname;
    /* ⚠ NARX YANGILASH TANASI USHLANADI (V100): «Tavsiya bo'yicha
       qo'yish» tugmasi aynan shu so'rovni yuboradi. */
    if (r.method() === "PUT" && /^\/api\/products\/\d+$/.test(p)) {
      try { priceSent = JSON.parse(r.postData() || "null"); } catch { priceSent = "PARSE_XATO"; }
      if (put428) {
        return r.respond({
          status: 428, contentType: "application/json", headers: CORS,
          body: JSON.stringify({ success: false, badgeRequired: true,
                                 action: "PRICE_CHANGE", message: "Bajikni skanerlang" }),
        });
      }
    }
    /* ⚠ KIRIM JAVOBI ALOHIDA (V99): narx tavsiyasi aynan shu yo'ldan
       qaytadi va umumiy `data: []` javobi bilan u hech qachon
       ko'rinmasdi — tavsiya oynasi umuman ochilmasdi. */
    const body = /\/inventory\/product\/\d+\/add$/.test(p) && advice
      ? { success: true, message: "ok", data: { inventoryId: 1, priceAdvice: advice } }
      : p === "/api/inventory"
      ? { success: true, data: items }
      : r.url().includes("/shop/profile")
        ? { success: true, data: { creditEnabled: false, nearExpiryDays: 7 } }
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
    /* ⚠ SAQLANGAN FILTR TOZALANADI: `useDataFilter` uni
       `localStorage` da saqlaydi va oldingi yugurishdan qolgan shart
       keyingi sinovni jimgina yiqitardi. */
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_flt_")) localStorage.removeItem(k);
  });
  await page.goto(`http://127.0.0.1:${PORT}/inventory`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector(".inv-bar", { timeout: 15_000 });
  return page;
}

const rowCount = (page) => page.$$eval("table.table tbody tr", (r) => r.length).catch(() => 0);
const shot = async (page, name) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${name}.png`) }); };

/**
 * Filtr oynasida yangi shart qatorini qo'shadi.
 *
 * ⚠ IKKI XIL tugma bo'lishi mumkin (V72): shart yo'q bo'lganda —
 * o'rtadagi katta TAKLIF (`.flt-empty`), bor bo'lganda — pastdagi
 * «Shart qo'shish». Sinov ikkalasini ham bilishi kerak, aks holda u
 * ekranning holatiga bog'lanib qolardi.
 */
async function addCondition(page) {
  await page.evaluate(() => {
    const empty = document.querySelector(".flt-empty");
    if (empty) return empty.click();
    const add = [...document.querySelectorAll(".modal-body button")]
      .find((b) => /shart qo'shish/i.test(b.textContent));
    add?.click();
  });
  await page.waitForSelector(".flt-row", { timeout: 8000 });
}

/* ══ A. Panel tinch omborda ham turadi ═════════════════════════════════ */
console.log("── A. Muammosiz ombor ──");
{
  const page = await openInv(GOOD);
  const bar = await page.$(".inv-bar");
  is(!!bar, "panel MUAMMO YO'Q paytda ham turadi");
  const warn = await page.$eval(".inv-bar", (el) => el.className.includes("inv-bar--warn"));
  is(!warn, "ogohlantirish toni YOQILMAGAN — tinch kunda panel sariq emas");
  const hint = await page.$(".inv-bar__hint");
  is(!hint, "izoh qatori yo'q — bekorga joy egallamaydi");
  const segs = await page.$$eval(".inv-seg", (b) => b.map((x) => x.textContent.trim()));
  is(segs.length === 1, "faqat «Hammasi» segmenti", segs.join(" | "));
  const btn = await page.$(".inv-bar__tools .filter-btn, .inv-bar__tools .btn");
  is(!!btn, "ustun filtri tugmasi panel ICHIDA");
  await shot(page, "inv-calm");
  await page.close();
}

/* ══ B. Ogohlantirish va holat segmentlari ═════════════════════════════ */
console.log("\n── B. Muammoli ombor ──");
const page = await openInv(BAD);
{
  const warn = await page.$eval(".inv-bar", (el) => el.className.includes("inv-bar--warn"));
  is(warn, "ogohlantirish toni YOQILDI");
  is(!!(await page.$(".inv-bar__hint")), "izoh qatori chiqdi");

  const segs = await page.$$eval(".inv-seg", (b) => b.map((x) => ({
    text: x.textContent.trim(), n: Number(x.querySelector(".inv-seg__n")?.textContent || 0),
  })));
  is(segs.length === 4, "to'rt segment: hammasi + uch holat", segs.map((s) => s.text).join(" | "));

  const all = await rowCount(page);
  is(all === BAD.length, `«Hammasi» — ${BAD.length} qator`, String(all));

  /* Har segment: qator soni segmentdagi songa TENG bo'lishi shart. */
  for (let i = 1; i < segs.length; i++) {
    await page.$$eval(".inv-seg", (b, k) => b[k].click(), i);
    await new Promise((r) => setTimeout(r, 250));
    const n = await rowCount(page);
    is(n === segs[i].n, `«${segs[i].text.replace(/\s+/g, " ")}» → ${segs[i].n} qator`, String(n));
  }
  await page.$$eval(".inv-seg", (b) => b[0].click());
  await new Promise((r) => setTimeout(r, 250));
  await shot(page, "inv-warn");
}

/* ══ C. Ustun filtri ═══════════════════════════════════════════════════ */
console.log("\n── C. Ustun filtri ──");
{
  await page.click(".inv-bar__tools .filter-btn");
  await page.waitForSelector(".flt-row, .modal-box", { timeout: 8000 });
  await addCondition(page);
  ok("shart qatori qo'shildi");

  /* Ustun = qoldiq, amal = kichik, qiymat = 20.
     ⚠ `Select` — o'z komponenti, `<select>` emas: tugma bosiladi va
     ro'yxatdan variant tanlanadi. */
  const pick = async (idx, label) => {
    await page.evaluate((i) => document.querySelectorAll(".flt-row .ek-sel__btn, .flt-row button[aria-haspopup]")[i]?.click(), idx);
    await new Promise((r) => setTimeout(r, 200));
    const clicked = await page.evaluate((lbl) => {
      const opt = [...document.querySelectorAll("[role='option'], .ek-sel__opt")]
        .find((o) => o.textContent.trim() === lbl);
      if (!opt) return false;
      opt.click(); return true;
    }, label);
    await new Promise((r) => setTimeout(r, 200));
    return clicked;
  };
  is(await pick(0, "Qoldiq"), "ustun tanlandi: Qoldiq");
  is(await pick(1, "kichik"), "amal tanlandi: kichik");
  await page.type(".flt-row .form-input", "20");
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => {
    [...document.querySelectorAll(".modal-footer .btn-primary")].pop()?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const n = await rowCount(page);
  const expect = BAD.filter((x) => x.quantity < 20).length;
  is(n === expect, `qoldiq < 20 → ${expect} qator`, String(n));
  is(!!(await page.$(".flt-chip")), "faol shart CHIP bo'lib ko'rinadi");
  await shot(page, "inv-filter");

  /* ══ D. Holat + ustun sharti — VA bilan ═════════════════════════════ */
  console.log("\n── D. Holat va ustun sharti BIRGA ──");
  await page.evaluate(() => {
    const seg = [...document.querySelectorAll(".inv-seg")].find((b) => /muddati o'tgan/i.test(b.textContent));
    seg?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const both = await rowCount(page);
  const expectBoth = BAD.filter((x) => x.quantity < 20 && x.expiryDate && x.expiryDate < day(0)).length;
  is(both === expectBoth, `muddati o'tgan VA qoldiq < 20 → ${expectBoth}`, String(both));

  await page.evaluate(() => {
    [...document.querySelectorAll(".flt-chips__clear")].pop()?.click();
    [...document.querySelectorAll(".inv-seg")][0]?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  is(await rowCount(page) === BAD.length, "tozalangach hammasi qaytdi");
}

/* ══ E. Sarlavha bilan saralash ════════════════════════════════════════ */
console.log("\n── E. Saralash ──");
{
  const clickQty = () => page.evaluate(() => {
    const th = [...document.querySelectorAll("th .th-sort")].find((b) => /qoldiq/i.test(b.textContent));
    th?.click();
  });
  await clickQty(); await new Promise((r) => setTimeout(r, 250));
  const asc = await page.$$eval("table.table tbody tr td:nth-child(3)", (td) => td.map((x) => parseFloat(x.textContent.replace(/[^\d.]/g, "")) || 0));
  is(asc.every((v, i) => i === 0 || asc[i - 1] <= v), "o'sish bo'yicha", asc.join(" "));

  await clickQty(); await new Promise((r) => setTimeout(r, 250));
  const desc = await page.$$eval("table.table tbody tr td:nth-child(3)", (td) => td.map((x) => parseFloat(x.textContent.replace(/[^\d.]/g, "")) || 0));
  is(desc.every((v, i) => i === 0 || desc[i - 1] >= v), "kamayish bo'yicha", desc.join(" "));

  /* ⚠ Qatorlar TARTIBI bilan tekshirib bo'lmaydi: soxta ma'lumot
     API dan allaqachon kamayish tartibida keladi va «bekor qilingan»
     tartib «kamayish» bilan bir xil chiqardi — sinov hech narsa
     isbotlamasdi. Sarlavhaning O'ZI aytadi: saralash yoqilganida u
     `is-on` bo'ladi. */
  await clickQty(); await new Promise((r) => setTimeout(r, 250));
  const stillOn = await page.evaluate(() => {
    const th = [...document.querySelectorAll("th .th-sort")].find((b) => /qoldiq/i.test(b.textContent));
    return th?.className.includes("is-on");
  });
  is(!stillOn, "uchinchi bosish tartibni BEKOR qildi");
}

/* ══ F. Qator bosilishi va tugmalar (V72) ══════════════════════════════

   Do'kon egasi ikkita narsani ko'rsatdi: qatorning ISTALGAN joyidan
   bosilganda partiyalarga o'tib ketishi (omborchi qoldiqni o'qish
   uchun tegib qo'ysa ham sahifadan chiqib ketardi) va «Kirim» bilan
   «To'g'irlash» tugmalarining yopishib qolgani. */
console.log("\n── F. Qator va tugmalar ──");
{
  const p6 = await openInv(BAD);

  /* Qatorning «bo'sh» joyi — masalan tannarx katagi — hech qayerga
     olib bormasligi kerak. */
  const url0 = p6.url();
  await p6.evaluate(() => {
    const td = document.querySelector("table.table tbody tr td:nth-child(4)");
    td?.click();
  });
  await wait(400);
  is(p6.url() === url0, "qatorning bo'sh joyiga bosish HECH QAYERGA olib bormaydi", p6.url());

  /* Yagona nishon — NOM. */
  const opener = await p6.$("table.table tbody .inv-open");
  is(!!opener, "nomda alohida ochish tugmasi bor");
  const styled = await p6.evaluate(() => {
    const b = document.querySelector("table.table tbody .inv-open");
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { cursor: cs.cursor, hasArrow: !!b.querySelector("i") };
  });
  is(styled?.cursor === "pointer" && styled?.hasArrow,
     "u bosiladigan ko'rinishda (kursor va o'q bilan)", JSON.stringify(styled));

  await p6.evaluate(() => document.querySelector("table.table tbody .inv-open")?.click());
  await wait(500);
  is(/\/inventory\/\d+/.test(p6.url()), "nomga bosilganda partiyalarga o'tadi", p6.url());
  await p6.goBack({ waitUntil: "networkidle2" });
  await p6.waitForSelector(".inv-bar", { timeout: 10_000 });

  /* ⚠ Tugmalar YOPISHIB qolmasin — orasida haqiqiy bo'shliq bo'lsin. */
  const gap = await p6.evaluate(() => {
    const cell = [...document.querySelectorAll("table.table tbody .inv-acts")]
      .find((d) => d.querySelectorAll("button").length >= 2);
    if (!cell) return null;
    const [a, b] = [...cell.querySelectorAll("button")].map((x) => x.getBoundingClientRect());
    /* Yonma-yon bo'lsa — gorizontal, tushib ketgan bo'lsa — vertikal. */
    const sameRow = Math.abs(a.top - b.top) < 4;
    return { sameRow, dx: Math.round(b.left - a.right), dy: Math.round(b.top - a.bottom) };
  });
  is(!!gap, "ikkita tugmali qator topildi");
  if (gap) {
    is(gap.sameRow ? gap.dx >= 6 : gap.dy >= 6,
       "«Kirim» va «To'g'irlash» orasida bo'shliq bor (yopishib qolmagan)",
       JSON.stringify(gap));
  }
  await p6.close();
}

/* ══ G. Filtr oynasi va saqlanishi (V72) ═══════════════════════════════ */
console.log("\n── G. Filtr oynasi ──");
{
  const p7 = await openInv(BAD);
  await p7.click(".inv-bar__tools .filter-btn");
  await p7.waitForSelector(".flt-box", { timeout: 8000 });

  /* ⚠ ORQA FONGA BOSISH YOPMAYDI — sensor ekranda tasodifan
     tegishda yarim terilgan shart yo'qolib ketardi. */
  await p7.evaluate(() => {
    const ov = document.querySelector(".modal-overlay");
    ov?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await wait(300);
  is(!!(await p7.$(".flt-box")), "orqa fonga bosilganda oyna YOPILMADI");

  const x = await p7.evaluate(() => {
    const b = document.querySelector(".flt-x");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  is(x && x.w >= 36 && x.h >= 36, "✕ tugmasi teginish o'lchamida", JSON.stringify(x));

  const wide = await p7.evaluate(() => Math.round(document.querySelector(".flt-box").getBoundingClientRect().width));
  is(wide >= 700, "oyna kengaydi", `${wide}px`);

  /* ESC — yopadi. */
  await p7.keyboard.press("Escape");
  await wait(300);
  is(!(await p7.$(".flt-box")), "ESC oynani yopdi");

  /* ⚠ ENG MUHIMI: shart TOZALANGACH QAYTIB KELMASIN. Ilgari
     `clear()` ikki marta yozardi va ikkinchi yozuv eski shartlarni
     tiklardi — foydalanuvchi tozalasa ham, qayta kirganda shart
     joyida turardi. */
  await p7.click(".inv-bar__tools .filter-btn");
  await p7.waitForSelector(".flt-box", { timeout: 8000 });
  await addCondition(p7);
  await p7.type(".flt-row .form-input", "sut");
  await wait(300);
  const saved = await p7.evaluate(() => localStorage.getItem("ek_flt_inv"));
  is(saved && saved.includes("sut"), "shart diskka yozildi", saved);

  await p7.evaluate(() => {
    [...document.querySelectorAll(".flt-foot button")]
      .find((b) => /tozalash/i.test(b.textContent))?.click();
  });
  await wait(400);
  const after = await p7.evaluate(() => localStorage.getItem("ek_flt_inv"));
  is(!after || !after.includes("sut"),
     "tozalangach diskda ham QOLMADI (qayta kirganda paydo bo'lmaydi)", after);

  /* Sahifani qayta yuklab, haqiqatan yo'qligini tekshiramiz. */
  await p7.reload({ waitUntil: "networkidle2" });
  await p7.waitForSelector(".inv-bar", { timeout: 10_000 });
  is(!(await p7.$(".flt-chip")), "qayta yuklashdan keyin ham shart yo'q");
  await p7.close();
}

/* ══ P. Partiyalar — jadval va filtr (V76) ═════════════════════════════

   ⚠ NEGA TEKSHIRILADI. Partiyalar kartochkadan jadvalga ko'chirildi va
   kartochkada bo'lmagan uchta narsa paydo bo'ldi: saralash, ustun
   filtri va yig'indi. Ularning har biri jimgina buzilishi mumkin —
   ekran chiziladi, faqat raqamlar noto'g'ri bo'ladi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── P. Partiyalar jadvali ──");
{
  const p = await openBatches();

  is((await p.$("table.table")) !== null, "partiyalar JADVAL bo'lib chizildi");
  is((await p.$(".batch-list")) === null, "eski kartochka ro'yxati qolmadi");

  /* Faol bo'lim: muddati o'tgani bu yerda EMAS. */
  const n0 = await rowCount(p);
  is(n0 === 3, "faol bo'limda uchta partiya (muddati o'tgani alohida)", String(n0));

  /* Ustun soni — faol bo'limda «arxivlangan» ustuni YO'Q. */
  const th = await p.$$eval("table.table thead th", (n) => n.map((x) => x.textContent.trim()));
  is(th.length === 8, "sakkizta ustun", th.join(" | "));
  is(!th.some((x) => /arxivlangan/i.test(x)), "faol bo'limda «arxivlangan» ustuni yo'q");

  /* ⚠ QIYMAT USTUNI — jadvalning asosiy yutug'i: «bu partiyada qancha
     pul yotibdi?». 40 × 7500 = 300 000. */
  const vals = await p.$$eval("table.table tbody tr td:nth-child(3)",
    (n) => n.map((x) => x.textContent.replace(/\s/g, "")));
  is(vals.some((v) => v.includes("300000")), "qiymat = qoldiq × tannarx", vals.join(" · "));

  /* ⚠ YAKUN — BITTA BLOKDA (V77). Ilgari raqamlar ikki joyda edi:
     tepada «javonda bor», pastda jadval ostidagi qator. Endi avval
     JAMI, keyin bo'limlar — hammasi bir qatorda.
     Jami: 12 + 40 + 0 + 6 (muddati o'tgan) + 0 (arxiv) = 58 dona. */
  const stats = await p.$$eval(".batch-stat", (n) => n.map((x) => ({
    l: x.querySelector(".batch-stat__l").textContent.trim(),
    q: x.querySelector(".batch-stat__q").textContent.replace(/\s/g, ""),
    v: x.querySelector(".batch-stat__v").textContent.replace(/\s/g, ""),
  })));
  is(stats.length === 4, "yakun bitta blokda: jami + uchta bo'lim", String(stats.length));
  is(/jami/i.test(stats[0].l), "birinchisi — JAMI", stats[0].l);
  is(stats[0].q.includes("58"), "jami hamma bo'limni sanaydi", stats[0].q);
  is(stats[1].q.includes("52"), "faol bo'lim alohida", stats[1].q);
  is(stats[2].q.includes("6"),  "muddati o'tgani alohida", stats[2].q);

  await shot(p, "batch-table");

  /* ── Saralash ─────────────────────────────────────────────────── */
  await p.evaluate(() => {
    const th = [...document.querySelectorAll("thead th")]
      .find((x) => /qoldiq|miqdor/i.test(x.textContent));
    th?.querySelector("button")?.click();
  });
  await wait(300);
  const asc = await p.$$eval("table.table tbody tr td:nth-child(1)",
    (n) => n.map((x) => parseInt(x.textContent.replace(/\D/g, ""), 10)));
  is(asc[0] <= asc[asc.length - 1], "ustun sarlavhasi bo'yicha saralandi", asc.join(","));

  /* ── Filtr ──────────────────────────────────────────────────────
     ⚠ `Select` — O'Z komponenti, `<select>` emas: tugma bosiladi va
     ro'yxatdan variant tanlanadi (ombor filtridagi bilan bir xil). */
  const pick = async (idx, label) => {
    await p.evaluate((i) => document
      .querySelectorAll(".flt-row .ek-sel__btn, .flt-row button[aria-haspopup]")[i]?.click(), idx);
    await wait(200);
    const clicked = await p.evaluate((lbl) => {
      const opt = [...document.querySelectorAll("[role='option'], .ek-sel__opt")]
        .find((o) => o.textContent.trim() === lbl);
      if (!opt) return false;
      opt.click(); return true;
    }, label);
    await wait(200);
    return clicked;
  };
  const applyFlt = async () => {
    await p.evaluate(() => {
      [...document.querySelectorAll(".modal-footer .btn-primary")].pop()?.click();
    });
    await wait(400);
  };

  await p.evaluate(() => { [...document.querySelectorAll(".filter-btn")][0]?.click(); });
  await p.waitForSelector(".modal-body", { timeout: 8000 });
  await addCondition(p);
  is(await pick(0, "Qoldiq"), "ustun tanlandi: Qoldiq");
  is(await pick(1, "katta"), "amal tanlandi: katta");
  /* ⚠ CHEGARA 20, 10 emas va bu ATAYLAB: 10 bilan faqat bo'sh partiya
     chiqib ketardi, uning qoldig'i ham qiymati ham NOL — ya'ni
     yig'indi o'zgarmasdi va «yig'indi filtrga ergashadimi?» degan
     tekshiruv hech narsani isbotlamasdi. 20 da esa 12 donalik partiya
     ham chiqadi va ikkala son ham qimirlashi SHART. */
  await p.type(".flt-row .form-input", "20");
  await applyFlt();

  const n1 = await rowCount(p);
  is(n1 === 1, "filtr qatorlarni kesdi (qoldiq > 20)", String(n1));
  is((await p.$(".flt-chip")) !== null, "faol shart CHIP bo'lib ko'rinadi");

  /* ⚠ YIG'INDI FILTRLANGAN qatorlar bo'yicha: butun bo'lim bo'yicha
     hisoblangan bo'lsa, shart qo'yilgandan keyin ostidagi son
     o'zgarmay turardi va uni hech kim tushunmasdi.
     Qolgani bitta: 40 dona × 7 500 = 300 000 (52 va 396 000 emas). */
  const foot2 = await p.$eval(".batch-bar__sum", (n) => n.textContent.replace(/\s/g, ""));
  is(foot2.includes("40dona") && foot2.includes("300000"),
     "filtrlangan yig'indi filtr qatorida ko'rindi", foot2);

  const shown = await p.$eval(".batch-bar__n", (n) => n.textContent.trim());
  is(/1\s*\/\s*3/.test(shown), "«nechta ko'rinyapti» yozuvi yangilandi", shown);

  /* ── Filtr hech narsa topmasa ──────────────────────────────────── */
  await p.evaluate(() => { [...document.querySelectorAll(".filter-btn")][0]?.click(); });
  await p.waitForSelector(".flt-row", { timeout: 8000 });
  await p.evaluate(() => {
    const inp = document.querySelector(".flt-row .form-input");
    if (inp) inp.value = "";
  });
  await p.click(".flt-row .form-input", { clickCount: 3 });
  await p.type(".flt-row .form-input", "99999");
  await applyFlt();

  /* ⚠ «Bo'lim bo'sh» va «filtr topmadi» BOSHQA-BOSHQA yozuv: bir xil
     bo'lganda omborchi partiyalar yo'q deb o'ylab, filtrni tozalash
     kerakligini bilmasdi. */
  const emptyTxt = await p.$eval(".empty p", (n) => n.textContent.trim());
  is(/mos.*topilmadi/i.test(emptyTxt), "«filtr topmadi» yozuvi chiqdi", emptyTxt);
  is((await p.$$eval(".empty button", (n) => n.length)) === 1,
     "tozalash tugmasi ham shu yerda — chiqish yo'li ko'rinadi");

  await p.evaluate(() => document.querySelector(".empty button")?.click());
  await wait(400);
  is((await rowCount(p)) === 3, "tozalangach hamma qator qaytdi");
  await p.close();
}

/* ══ P2. Bo'limlar va arxiv ════════════════════════════════════════════ */
console.log("\n── P2. Bo'limlar ──");
{
  const p = await openBatches();

  /* Muddati o'tgan bo'limi: ogohlantirish + bitta qator. */
  await p.evaluate(() => {
    [...document.querySelectorAll(".batch-tab")]
      .find((b) => /muddati/i.test(b.textContent))?.click();
  });
  await wait(400);
  is((await p.$(".batch-warn")) !== null, "muddati o'tgan bo'limda ogohlantirish turadi");
  is((await rowCount(p)) === 1, "faqat muddati o'tgan partiya");

  /* ⚠ «Kun qoldi» ustunida manfiy son EMAS, aniq yozuv: «-3» ni
     omborchi «uch kun qoldi» deb o'qib yuborishi mumkin edi. */
  const late = await p.$eval(".batch-late", (n) => n.textContent.trim());
  is(/3/.test(late) && !late.includes("-"), "kechikish «N kun o'tdi» deb yozildi", late);

  /* Arxiv: qo'shimcha ustun va boshqa amal tugmasi. */
  await p.evaluate(() => {
    [...document.querySelectorAll(".batch-tab")]
      .find((b) => /arxiv/i.test(b.textContent))?.click();
  });
  await wait(400);
  const th2 = await p.$$eval("table.table thead th", (n) => n.map((x) => x.textContent.trim()));
  is(th2.length === 9 && th2.some((x) => /arxivlangan/i.test(x)),
     "arxivda «arxivlangan» ustuni qo'shildi", th2.join(" | "));
  const act = await p.$eval("tbody tr td:last-child button", (n) => n.textContent.trim());
  is(/qaytarish/i.test(act), "arxivda «qaytarish» tugmasi", act);
  is((await p.$(".batch-note")) !== null, "arxiv izohi turadi");
  await shot(p, "batch-archive");
  await p.close();
}

/* ══ P2b. «Barchasi» bo'limi (V77) ════════════════════════════════════

   ⚠ Omborchining ba'zi savollari bo'limga sig'maydi: «bu tovarning
   butun tarixi qanday?». Ular uchun uch bo'lim orasida yurish kerak
   bo'lardi va solishtirish ko'z bilan qilinardi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── P2b. Barchasi ──");
{
  const p = await openBatches();
  const tabs = await p.$$eval(".batch-tab", (n) => n.map((x) => x.textContent.trim()));
  is(/barchasi/i.test(tabs[0] || ""), "«Barchasi» birinchi turadi", tabs.join(" | "));

  /* ⚠ STANDART EMAS: kunlik savol — «javonda hozir nima bor?». */
  const on = await p.$eval(".batch-tab.is-on", (n) => n.textContent.trim());
  is(/faol/i.test(on), "standart bo'lim FAOL bo'lib qoladi", on);

  await p.evaluate(() => {
    [...document.querySelectorAll(".batch-tab")]
      .find((b) => /barchasi/i.test(b.textContent))?.click();
  });
  await wait(400);
  is((await rowCount(p)) === 5, "barcha partiyalar bitta ro'yxatda (3+1+1)",
     String(await rowCount(p)));

  /* Arxivdagi qator faol qatorlar orasida FARQLANISHI kerak. */
  const badges = await p.$$eval("tbody tr td:nth-last-child(2)",
    (n) => n.map((x) => x.textContent.trim()));
  is(badges.some((x) => /arxiv/i.test(x)),
     "arxivdagi partiya holat ustunida ajratilgan", badges.join(" · "));

  const th3 = await p.$$eval("table.table thead th", (n) => n.map((x) => x.textContent.trim()));
  is(th3.some((x) => /arxivlangan/i.test(x)), "arxiv sanasi ustuni ham bor", th3.join(" | "));

  /* ⚠ AMAL QATORGA qarab tanlanishi kerak, BO'LIMGA emas: bo'limga
     qarab tanlanganda arxivdagi partiyaga «Arxivga» tugmasi
     chiqardi — server rad etadigan, ma'nosiz amal. */
  const acts = await p.$$eval("tbody tr td:last-child button",
    (n) => n.map((x) => x.textContent.trim()));
  is(acts.filter((x) => /qaytarish/i.test(x)).length === 1,
     "arxivdagi qatorda «Qaytarish» tugmasi", acts.join(" · "));
  is(!acts.some((x, i) => /arxivga/i.test(x) && i === acts.length - 1),
     "arxivdagi qatorga «Arxivga» tugmasi chiqmaydi", acts.join(" · "));
  await shot(p, "batch-all");
  await p.close();
}

/* ══ P3. Bo'sh bo'lim ══════════════════════════════════════════════════ */
console.log("\n── P3. Bo'sh bo'lim ──");
{
  const p = await openBatches({ live: [], arch: [] });
  /* ⚠ Yozuv HAQIQATAN chiqishi kerak. Ilgari `Empty` ga `title` xossasi
     berilardi — unday xossa yo'q va ekranda har doim standart
     «Ma'lumot yo'q» turardi. */
  const txt = await p.$eval(".empty p", (n) => n.textContent.trim());
  is(/javonda partiya yo'q/i.test(txt), "bo'sh bo'lim O'Z yozuvini ko'rsatadi", txt);
  is((await p.$eval(".empty i", (n) => n.className)).includes("fa-box-open"),
     "ikonka to'liq nomi bilan chizildi");
  await p.close();
}

/* ══ Q. NARX TAVSIYASI — OPTOM NARX HAM (V99) ══════════════════════════

   Do'kon egasining savoli: «yangi partiya kelganda tan narxi sotuv
   narxidan yoki OPTOM narxdan oshib ketsa nima qilamiz?»

   ⚠ ILGARI TIZIM OPTOM NARX HAQIDA JIM EDI. Tavsiyada faqat chakana
   narx bor edi va tan narx optom narxdan oshganda ekranda «hammasi
   joyida, marja 5%» turardi — do'kon esa har optom sotuvda
   yo'qotardi. Optom sotuv katta miqdorda bo'lgani uchun yo'qotish
   ham chakanadagidan katta.

   ⚠ SHU YERDA O'LCHANADI, SERVERDA EMAS. Server to'g'ri bayroq
   qaytarsa ham, uni chizmagan ekran bir xil zarar keltiradi. */
console.log("\n── Q. Narx tavsiyasi: optom narx (V99) ──");
{
  /* Tan narx 9 500: optom narxdan (9 000) yuqori, chakanadan (10 000)
     past. Ya'ni chakana savdo hamon foydali, optom esa zarar. */
  const ADVICE = {
    oldCost: 8000, newCost: 9500, salePrice: 10000,
    recommendedSale: 11875, marginPercent: 5.0, belowCost: false,
    wholesalePrice: 9000, recommendedWholesale: 10688,
    wholesaleMarginPercent: -5.56, belowWholesale: true,
  };
  const p = await openInv(GOOD, ADVICE);

  await p.evaluate(() => {
    const b = [...document.querySelectorAll("table.table tbody .inv-acts button")]
      .find((x) => x.querySelector("i.fa-plus"));
    b?.click();
  });
  await p.waitForSelector(".modal-box input", { timeout: 8000 });

  /* Miqdor maydonini to'ldirib saqlaymiz. */
  await p.evaluate(() => {
    const inp = document.querySelector(".modal-box input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(inp, "5");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.evaluate(() => {
    const b = [...document.querySelectorAll(".modal-box button")]
      .find((x) => x.querySelector("i.fa-check"));
    b?.click();
  });
  await p.waitForFunction(
    () => [...document.querySelectorAll(".modal-title")].some((n) => /tan narx/i.test(n.textContent)),
    { timeout: 8000 },
  ).catch(() => {});

  const seen = await p.evaluate(() => {
    const rows = [...document.querySelectorAll(".modal-box .inv-detail__row")]
      .map((r) => r.textContent.replace(/\s+/g, " ").trim());
    const notes = [...document.querySelectorAll(".modal-box .ek-note")]
      .map((n) => n.textContent.trim());
    return { rows, notes };
  });

  is(seen.notes.some((n) => /optom narx endi tan narxdan past/i.test(n)),
     "⚠ OPTOM ZARARI haqida ogohlantirish chiqdi", seen.notes.join(" | "));
  is(!seen.notes.some((n) => /sotuv narxi endi tan narxdan past/i.test(n)),
     "chakana ogohlantirishi chiqmadi — u zarar emas", seen.notes.join(" | "));
  is(seen.rows.some((r) => /optom narx/i.test(r) && /9\s*000/.test(r)),
     "joriy optom narx ko'rsatildi", seen.rows.join(" | "));
  is(seen.rows.some((r) => /optom marja/i.test(r) && /-5[.,]6|-5[.,]5/.test(r)),
     "optom marja MANFIY ko'rsatildi — zarar aynan shunday ko'rinadi",
     seen.rows.join(" | "));
  is(seen.rows.some((r) => /optom narx/i.test(r) && /10\s*688/.test(r)),
     "optom narx uchun tavsiya berildi", seen.rows.join(" | "));
  await shot(p, "advice-wholesale");
  await p.close();
}

/* ⚠ OPTOM NARXSIZ DO'KONDA QATORLAR CHIQMASIN — chakana do'konda
   optom narx umuman qo'yilmaydi va bo'sh qatorlar oynani uzaytirib,
   asosiy raqamni pastga surib yuborardi. */
{
  const p = await openInv(GOOD, {
    oldCost: 8000, newCost: 8200, salePrice: 10000,
    recommendedSale: 10250, marginPercent: 18.0, belowCost: false,
    wholesalePrice: null, recommendedWholesale: null,
    wholesaleMarginPercent: null, belowWholesale: false,
  });
  await p.evaluate(() => {
    const b = [...document.querySelectorAll("table.table tbody .inv-acts button")]
      .find((x) => x.querySelector("i.fa-plus"));
    b?.click();
  });
  await p.waitForSelector(".modal-box input", { timeout: 8000 });
  await p.evaluate(() => {
    const inp = document.querySelector(".modal-box input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(inp, "5");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    const b = [...document.querySelectorAll(".modal-box button")]
      .find((x) => x.querySelector("i.fa-check"));
    b?.click();
  });
  await p.waitForFunction(
    () => [...document.querySelectorAll(".modal-box .inv-detail__row")].length > 0,
    { timeout: 8000 },
  ).catch(() => {});
  const rows = await p.$$eval(".modal-box .inv-detail__row",
    (rs) => rs.map((r) => r.textContent.replace(/\s+/g, " ").trim()));
  is(rows.length > 0, "tavsiya oynasi ochildi", String(rows.length));
  is(!rows.some((r) => /optom/i.test(r)),
     "optom narxsiz do'konda optom qatorlari CHIQMAYDI", rows.join(" | "));
  const notes = await p.$$eval(".modal-box .ek-note", (ns) => ns.map((n) => n.textContent.trim()));
  is(notes.length === 0,
     "⚠ hammasi joyida bo'lsa qizil belgi yo'q — bekorga qo'rqitilgan "
     + "do'kon egasi bir haftadan keyin ogohlantirishga qaramay qo'yadi",
     notes.join(" | "));
  await p.close();
}

/* ══ R. TAVSIYANI BIR BOSISHDA QO'YISH (V100) ══════════════════════════

   Tavsiya ekranda turardi-yu, uni qo'yish uchun do'kon egasi oynani
   yopib, Tovarlar sahifasiga o'tib, tovarni topib, ikkita narxni
   qo'lda ko'chirishi kerak edi. Amalda esa u shunchaki «OK» bosib
   ketardi — va tovar zarariga sotilaverardi.

   ⚠ SHU YERDA UCH NARSA O'LCHANADI, VA UCHALASI HAM MUHIM:
     1. IKKALA narx yuboriladimi — faqat chakanani qo'yish optomni
        tan narxdan pastda qoldirardi va do'kon egasi «tuzatdim» deb
        o'ylab, har optom sotuvda zarar ko'raverardi;
     2. tavsiya yo'q bo'lganda tugma umuman chizilmaydimi — bosilib
        hech narsa qilmaydigan tugma ishonchni yo'qotadi;
     3. bajik SO'RALADIMI — tugma nazoratni chetlab o'tmasligi kerak. */
console.log("\n── R. Tavsiyani qo'llash (V100) ──");

/** Kirim qo'shib, narx tavsiyasi oynasini ochadi. */
async function openAdvice(advice) {
  const p = await openInv(GOOD, advice);
  await p.evaluate(() => {
    const b = [...document.querySelectorAll("table.table tbody .inv-acts button")]
      .find((x) => x.querySelector("i.fa-plus"));
    b?.click();
  });
  await p.waitForSelector(".modal-box input", { timeout: 8000 });
  await p.evaluate(() => {
    const inp = document.querySelector(".modal-box input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(inp, "5");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    const b = [...document.querySelectorAll(".modal-box button")]
      .find((x) => x.querySelector("i.fa-check"));
    b?.click();
  });
  await p.waitForFunction(
    () => [...document.querySelectorAll(".modal-box .inv-detail__row")].length > 0,
    { timeout: 8000 },
  ).catch(() => {});
  return p;
}

/** Tavsiya oynasidagi «Tavsiya bo'yicha qo'yish» tugmasini bosadi. */
const clickApply = (p) => p.evaluate(() => {
  const b = [...document.querySelectorAll(".modal-box button")]
    .find((x) => x.querySelector("i.fa-wand-magic-sparkles"));
  if (!b) return false;
  b.click();
  return true;
});

const ADV_BOTH = {
  oldCost: 8000, newCost: 9500, salePrice: 10000,
  recommendedSale: 11875, marginPercent: 5.0, belowCost: false,
  wholesalePrice: 9000, recommendedWholesale: 10688,
  wholesaleMarginPercent: -5.56, belowWholesale: true,
};

{
  priceSent = null;
  const p = await openAdvice(ADV_BOTH);
  const clicked = await clickApply(p);
  is(clicked, "«Tavsiya bo'yicha qo'yish» tugmasi chizilgan");
  await p.waitForFunction(() => !document.querySelector(".inv-detail__row"),
                          { timeout: 8000 }).catch(() => {});

  is(priceSent && typeof priceSent === "object",
     "narx yangilash so'rovi ketdi", JSON.stringify(priceSent));
  is(priceSent?.salePrice === 11875,
     "tavsiya qilingan CHAKANA narx yuborildi", JSON.stringify(priceSent));
  /* ⚠ ENG MUHIM QATOR. Optom narx tushib qolsa, so'rov baribir
     muvaffaqiyatli qaytadi va ekran «Narxlar yangilandi» deb yozadi —
     lekin optom narx (9 000) tan narxdan (9 500) past qolaveradi. */
  is(priceSent?.wholesalePrice === 10688,
     "tavsiya qilingan OPTOM narx ham yuborildi — aks holda zarar qoladi",
     JSON.stringify(priceSent));
  await shot(p, "advice-apply");
  await p.close();
}

/* ⚠ TAVSIYA YO'Q BO'LSA TUGMA HAM YO'Q. Eski tan narx noma'lum
   bo'lganda server tavsiya bermaydi; tugma esa bosilib hech narsa
   qilmasdi. */
{
  priceSent = null;
  const p = await openAdvice({
    oldCost: null, newCost: 9500, salePrice: 10000,
    recommendedSale: null, marginPercent: 5.0, belowCost: false,
    wholesalePrice: null, recommendedWholesale: null,
    wholesaleMarginPercent: null, belowWholesale: false,
  });
  const clicked = await clickApply(p);
  is(!clicked, "tavsiya yo'q bo'lganda tugma umuman chizilmaydi");
  is(priceSent === null, "hech qanday narx so'rovi ketmadi", JSON.stringify(priceSent));
  await p.close();
}

/* ⚠ TUGMA BAJIKNI CHETLAB O'TMAYDI. Nazorat serverda: 428 kelganda
   `guard` skanerlash oynasini ochadi. Bu qator o'chsa — narx bir
   bosishda, hech kim ruxsatisiz o'zgarardi. */
{
  priceSent = null;
  put428 = true;
  const p = await openAdvice(ADV_BOTH);
  await clickApply(p);
  const asked = await p.waitForFunction(
    () => [...document.querySelectorAll(".modal-title")].some((n) => /bajik/i.test(n.textContent)),
    { timeout: 8000 },
  ).then(() => true).catch(() => false);
  is(asked, "428 kelganda BAJIK so'raldi — tugma nazoratni chetlab o'tmaydi");
  await p.close();
  put428 = false;
}

is(pageErrors.length === 0, "sahifada JS xatosi tushmadi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(fail === 0 ? `\n  ✅ HAMMASI O'TDI (${pass} o'tdi)` : `\n  ❌ ${fail} yiqildi, ${pass} o'tdi`);
process.exit(fail === 0 ? 0 : 1);
