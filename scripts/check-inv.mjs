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
let pass = 0, fail = 0;
const ok  = (m, extra = "") => { pass++; console.log(`  ✅ ${m}${extra ? ` (${extra})` : ""}`); };
const bad = (m, extra = "") => { fail++; console.log(`  ❌ ${m}${extra ? ` — ${extra}` : ""}`); };
const is  = (cond, m, extra = "") => (cond ? ok(m, extra) : bad(m, extra));

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/* ── Soxta ombor ────────────────────────────────────────────────────────
   ⚠ Har bir holat KAMIDA bitta tovar bilan: segment soni bor holat
   uchungina chiziladi va nol turgan holat sinovdan tushib qolardi. */
/* ⚠ API PARTIYA qatorlarini beradi (`/inventory`), guruhlarni emas —
   sahifa ularni `groupByProduct` bilan o'zi yig'adi. Soxta javob ham
   AYNAN shu shaklda bo'lishi shart, aks holda jadval bo'sh chiqadi va
   sinov «filtr ishlamadi» deb yolg'on gapirardi. */
const batch = (id, name, code, qty, cost, price, minQ, exp) => ({
  id: id * 100, productId: id, productName: name, barcode: code,
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

async function openInv(items) {
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
    const body = p === "/api/inventory"
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
  await page.evaluate(() => {
    const add = [...document.querySelectorAll(".modal-body .btn-outline")]
      .find((b) => /shart qo'shish/i.test(b.textContent));
    add?.click();
  });
  await page.waitForSelector(".flt-row", { timeout: 8000 });
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

is(pageErrors.length === 0, "sahifada JS xatosi tushmadi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(fail === 0 ? `\n  ✅ HAMMASI O'TDI (${pass} o'tdi)` : `\n  ❌ ${fail} yiqildi, ${pass} o'tdi`);
process.exit(fail === 0 ? 0 : 1);
