/* ══════════════════════════════════════════════════════════════════════════
   QIDIRUV SAVATGA QO'SHGANDAN KEYIN JOYIDA QOLADIMI

   ═══ NEGA BU QO'RIQCHI BOR ════════════════════════════════════════════

   Do'kon shikoyati (2026-09-24): «qidiruvdan keyin topilgan mahsulotni
   bosib savatga qo'shsa bir martadan keyin qidiruv tozalanib ketyapti».

   `addToCart` oxirida shartsiz `resetSearch()` turardi: maydon bo'shab,
   ro'yxat to'liq katalogga qaytardi. Ya'ni bitta qidiruvdan FAQAT
   BITTA tovar qo'shib bo'lardi. «Kefir» deb yozib ikki dona olmoqchi
   bo'lgan kassir so'zni qaytadan yozardi.

   ⚠ BU XATO HECH QANDAY BELGI BERMAYDI. Savatga qo'shilgan, xato yo'q,
   konsol toza — shunchaki ekran kassirning ostidan surilib ketadi.
   Shuning uchun tekshiruv statik emas, JONLI: haqiqiy Chrome'da
   yoziladi, bosiladi va maydon o'qiladi.

   ═══ IKKI YO'L ATAYLAB FARQ QILADI ════════════════════════════════════

   · BOSISH  → qidiruv joyida qoladi (kassir ro'yxatga qarab turibdi)
   · ENTER   → maydon tozalanadi

   Enter yo'lidagi tozalash PUL bilan bog'liq: matn qolsa, odati
   bo'yicha Enter ni ikki marta bosgan kassir ikki dona qo'shib
   qo'yardi. Ilgari ikkinchi Enter hech narsa qilmasdi (maydon bo'sh
   edi) va shu holat saqlanishi kerak.

   Ishga tushirish:  node scripts/check-cart.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4608;

const CHROME = process.env.CHROME_PATH
  || (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2" };

/* ⚠ NOMLAR LOTINCHA va bir-biriga O'XSHAMAYDI. Kirillcha nom yozish
   klaviatura sxemasiga bog'liq bo'lardi, o'xshash nomlar esa reyting
   birinchi qatorni qaysi tovar egallaganini noaniq qilardi — Enter
   tekshiruvi tasodifga qolardi. */
const PRODUCTS = [
  { id: 1, name: "kefir",   salePrice: 12000, stockQuantity: 50, unit: "DONA",
    unitDecimals: 0, active: true, barcode: "1000000000017" },
  { id: 2, name: "pechene", salePrice: 9000,  stockQuantity: 40, unit: "DONA",
    unitDecimals: 0, active: true, barcode: "1000000000024" },
  { id: 3, name: "suv",     salePrice: 3000,  stockQuantity: 30, unit: "DONA",
    unitDecimals: 0, active: true, barcode: "1000000000031" },
];
const PROFILE = { creditEnabled: false, creditDueDays: 30, bonusMaxPercent: 0, creditLimit: 0 };

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

const pageErrors = [];
/** Soxta serverga kelgan har bir qidiruv so'zi — kod rejimi sinovi uchun. */
const searches = [];
let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
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

  const url = new URL(r.url());
  /* ⚠ SOXTA SERVER FILTRNI O'ZI BAJARADI. Har so'rovga uchala qator
     qaytarilsa, «ro'yxat filtrlangan holda qoldimi» degan savolga
     javob bo'lmasdi: ro'yxat baribir uchta bo'lib turardi va
     tekshiruv bekorga yashil chiqardi. */
  let body = { success: true, data: [] };
  if (url.pathname.includes("/shop/profile")) {
    body = { success: true, data: PROFILE };
  } else if (/\/products\/search$/.test(url.pathname)) {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    searches.push(q);
    /* ⚠ KOD REJIMI — serverdagi qoidaning o'zi (`CODE_QUERY =
       ^\*\d{1,12}$`). `*999` ni ATAYLAB rad etamiz: server so'rovni
       rad etganda kassa buni oflayn deb o'ylamasligini tekshirish uchun. */
    if (q.startsWith("*")) {
      if (!/^\*\d{1,12}$/.test(q) || q === "*999") {
        return r.respond({ status: 400, contentType: "application/json", headers: CORS,
          body: JSON.stringify({ success: false,
            message: "Kod faqat raqamdan iborat bo'lishi kerak: *425" }) });
      }
      body = { success: true, data: [] };
    } else {
      body = { success: true,
               data: q ? PRODUCTS.filter((p) => p.name.includes(q)) : PRODUCTS };
    }
  }
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify(body) });
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });

await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "c", ek_type: "user", ek_role: "OWNER", ek_username: "c",
    ek_fullName: "C", ek_shopCode: "c", ek_deviceId: "c", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});
await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector(".search-bar input", { timeout: 20_000 });
await page.waitForSelector(".product-card", { timeout: 20_000 });

/** Ekranning hozirgi holati — savat `localStorage` dan, qolgani DOM dan. */
const state = () => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("ek_cart_c_c") || "{}");
  const c = (raw.carts || []).find((x) => x.id === raw.activeId) || {};
  return {
    q: document.querySelector(".search-bar input")?.value ?? null,
    tiles: document.querySelectorAll(".product-card").length,
    rows: document.querySelectorAll(".cart-item").length,
    items: (c.items || []).map((i) => `${i.name}×${i.qty}`),
  };
});
/* Qat'iy uyqu o'rniga SHARTNI kutamiz: qidiruv 180 ms kechikish bilan
   serverga boradi va sekin mashinada bu ko'proq cho'ziladi. */
const until = async (fn, ms = 6000) => {
  const till = Date.now() + ms;
  for (;;) {
    const s = await state();
    if (fn(s) || Date.now() > till) return s;
    await new Promise((r) => setTimeout(r, 100));
  }
};
/**
 * Qidiruv maydoniga ODAM TEZLIGIDA yozadi.
 *
 * ⚠ `delay` 80 ms VA BU SHART. `useScanner` skanerni odamdan TEZLIK
 * bilan ajratadi: belgilar orasidagi tanaffus 35 ms dan kichik bo'lsa,
 * u ketma-ketlikni barkod deb biladi va ikkinchi belgidan keyin
 * qolganini `preventDefault` bilan to'sadi. Birinchi urinishda
 * `delay: 15` edi va maydonda «kefir» emas, «ke» qolardi — tekshiruv
 * yiqilardi, ayb esa kodda emas, SINOVDA edi.
 */
const typeQ = async (text) => {
  await page.click(".search-bar input");
  await page.evaluate(() => document.querySelector(".search-bar input").select());
  for (let i = 0; i < 20; i++) await page.keyboard.press("Backspace");
  if (text) await page.type(".search-bar input", text, { delay: 80 });
};

/* ⚠ «SUV» — KATALOGDA OXIRGI va bu ataylab. Agar ro'yxat qo'shilgandan
   keyin to'liq katalogga qaytsa, keyingi bosish birinchi katakchaga —
   «kefir» ga tegadi. Ya'ni §2 nosozlikni ham ushlaydi. Birinchi
   tovarni tanlasak, filtr yo'qolgani sezilmasdi: bosish baribir
   o'sha tovarni qo'shardi va tekshiruv bekorga yashil chiqardi. */
console.log("\n── 1. Bosish: qidiruv JOYIDA qoladi ──");

await typeQ("suv");
let s = await until((x) => x.tiles === 1);
if (s.tiles !== 1) no("qidiruv bitta tovarni qoldirishi kerak", `${s.tiles} katakcha`);
else ok("qidiruv ro'yxatni toraytirdi");

await page.click(".product-card");
s = await until((x) => x.items.length === 1);
if (s.items.join() !== "suv×1") no("savatda bitta suv bo'lishi kerak", s.items.join() || "bo'sh");
else ok("bosish savatga qo'shdi");
/* ⚠ ASOSIY SINOV — shikoyatning o'zi. */
if (s.q !== "suv") no("qidiruv matni JOYIDA qolishi kerak", JSON.stringify(s.q));
else ok("qidiruv matni tozalanmadi");
if (s.tiles !== 1) no("ro'yxat filtrlangan holda qolishi kerak", `${s.tiles} katakcha`);
else ok("ro'yxat to'liq katalogga qaytmadi");

console.log("\n── 2. Ikkinchi bosish: qayta yozish kerak emas ──");

await page.click(".product-card");
s = await until((x) => x.items.join() === "suv×2");
if (s.items.join() !== "suv×2") no("ikkinchi bosish AYNAN o'sha tovarni oshirishi kerak", s.items.join() || "bo'sh");
else ok("ikkinchi dona qo'shildi — qidiruv qayta yozilmadi");
if (s.q !== "suv") no("qidiruv matni hamon joyida bo'lishi kerak", JSON.stringify(s.q));
else ok("qidiruv matni hamon joyida");

console.log("\n── 3. Bir qidiruvdan boshqa tovar ──");

await typeQ("kefir");
s = await until((x) => x.tiles === 1 && x.q === "kefir");
await page.click(".product-card");
s = await until((x) => x.items.length === 2);
if (!s.items.includes("kefir×1")) no("ikkinchi tovar ham qo'shilishi kerak", s.items.join() || "bo'sh");
else ok("bitta savatga ikkinchi tovar qo'shildi");

console.log("\n── 4. Enter yo'li: maydon TOZALANADI ──");

/* ⚠ Bu qoida ataylab bosishdan farq qiladi — fayl boshidagi izohga
   qara. Enter matnni qoldirsa, ikkinchi Enter jimgina yana bir dona
   qo'shardi. */
await typeQ("pechene");
s = await until((x) => x.tiles === 1 && x.q === "pechene");
await page.keyboard.press("Enter");
s = await until((x) => x.items.some((i) => i.startsWith("pechene")));
if (!s.items.includes("pechene×1")) no("Enter eng mos tovarni qo'shishi kerak", s.items.join() || "bo'sh");
else ok("Enter tovarni qo'shdi");
if (s.q !== "") no("Enter dan keyin maydon bo'sh bo'lishi kerak", JSON.stringify(s.q));
else ok("Enter dan keyin maydon tozalandi");

/* Ikkinchi Enter — bo'sh maydonda hech narsa qilmasligi kerak. */
await page.keyboard.press("Enter");
s = await until(() => false, 600);
if (s.items.filter((i) => i.startsWith("pechene")).join() !== "pechene×1")
  no("bo'sh maydonda Enter yana qo'shmasligi kerak", s.items.join());
else ok("bo'sh maydonda Enter jim");

/* ══ 5. CHEK YOPILGACH QIDIRUV TOZALANADI ═══════════════════════════════

   ⚠ BU SINOV STATIK va shu ataylab: bu yergacha jonli borish uchun
   to'lov oynasini ochib, summa yozib, chek chop etish kerak —
   `check-pay.mjs` ning butun ishi. Uni takrorlashning ma'nosi yo'q,
   qo'riqlanadigan narsa esa BITTA qator.

   ⚠ NEGA QO'RIQLANADI. Tozalash `addToCart` dan olib tashlanganda
   sotuvdan keyingi yo'l ham u bilan birga tozalanishni yo'qotdi:
   `doSearch(search)` oldingi so'rovni QAYTA bajarardi va keyingi
   mijoz uchun katalog «kefir» bo'yicha filtrlangan holda turardi.
   Xato tuzatishning O'ZIDAN chiqdi — shuning uchun qator qo'riqlanadi. */
console.log("\n── 5. Chek yopilgach qidiruv tozalanadi ──");
{
  const src = fs.readFileSync(path.join(ROOT, "src/pages/KassaPage.jsx"), "utf8");
  const from = src.indexOf('setFinish({ phase: "done"');
  const to = src.indexOf("closeSoldCart()", from);
  const tail = from > 0 && to > from ? src.slice(from, to) : "";
  if (!tail) no("sotuv yakuni bloki topilmadi — sinovni moslash kerak", `${from} → ${to}`);
  else if (!/\bresetSearch\(\)/.test(tail))
    no("chek yopilgach `resetSearch()` chaqirilishi kerak", "blokda yo'q");
  else if (/\bdoSearch\(search\)/.test(tail))
    no("`doSearch(search)` oldingi so'rovni qayta bajaradi", "`doSearch(\"\")` bo'lishi kerak");
  else ok("sotuv yakunida qidiruv tozalanadi va katalog to'liq o'qiladi");
}

/* ══ 6. KOD REJIMI: YOLG'IZ `*` KASSANI OFLAYN QILMAYDI ══════════════════

   ⚠ JONLI XATO (2026-09-24): 3 kunda 81 marta. Kassir `*` ni terib
   to'xtasa, 180 ms dan keyin yolg'iz `*` ketardi, server uni rad etardi,
   kassa esa HAR QANDAY xatoni tarmoq uzilishi deb bilib, «faqat kesh»
   holatiga o'tib ketardi — internet ishlab turgan paytda.

   Ikki qavat tekshiriladi:
   · yolg'iz `*` umuman yuborilmaydi;
   · server so'rovni rad etsa (4xx) — bu OFLAYN EMAS: banner chiqmaydi,
     serverning o'z sababi ko'rsatiladi. */
console.log("\n── 6. Kod rejimi: yolg'iz `*` kassani oflayn qilmaydi ──");
{
  const offline = () => page.evaluate(() => !!document.querySelector(".kassa-offline-note"));

  await typeQ("*");
  await new Promise((r) => setTimeout(r, 800));   // 180 ms kechikishdan ancha ko'p
  if (searches.includes("*")) no("yolg'iz `*` serverga yuborilmasligi kerak", `so'rovlar: ${searches.slice(-4).join(" | ")}`);
  else ok("yolg'iz `*` serverga yuborilmadi");
  if (await offline()) no("`*` terilgach kassa «faqat kesh» holatiga tushmasligi kerak");
  else ok("kassa oflayn holatga tushmadi");

  /* Server so'rovni RAD ETADI (`*999`) — tarmoq esa ishlab turibdi. */
  await typeQ("*999");
  const s6 = await until((x) => searches.includes("*999"), 4000);
  await new Promise((r) => setTimeout(r, 500));
  if (!searches.includes("*999")) no("`*999` so'rovi yuborilishi kerak edi", s6.q);
  if (await offline()) no("⚠ server rad etgani OFLAYN deb talqin qilindi — banner chiqdi");
  else ok("server rad etgani oflayn deb talqin qilinmadi");
  const note = await page.evaluate(() => document.body.innerText.includes("Kod faqat raqamdan"));
  if (!note) no("serverning sababi kassirga ko'rsatilishi kerak");
  else ok("serverning o'z sababi ko'rsatildi");
}

console.log("\n── 7. Sahifa xatolari ──");
if (pageErrors.length) no("konsol toza bo'lishi kerak", pageErrors.slice(0, 3).join(" | "));
else ok("konsol toza");

await browser.close();
server.close();

if (bad) {
  console.error(`\n  ${bad} ta buzilish.\n`);
  process.exit(1);
}
console.log("\n  Savat va qidiruv: hammasi o'tdi.");
