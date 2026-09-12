/* ══════════════════════════════════════════════════════════════════════════
   TOVARLAR RO'YXATI: NOMLAR BITTA CHIZIQDAN BOSHLANADI (V108)

   Do'kon egasi: «nomida rasmi yo'qlar chapga surilib qolyapti — rasm
   o'rni qoldirilsin».

   ═══ NEGA O'LCHANADI, KO'ZDAN KECHIRILMAYDI ════════════════════════════

   Bu xato ko'zga faqat ikkala holat YONMA-YON tushganda tashlanadi:
   hamma tovar rasmli bo'lsa ham, hammasi rasmsiz bo'lsa ham ro'yxat
   mutlaqo joyida ko'rinadi. Aynan shu sabab u sezilmay yashab kelgan.

   Shuning uchun bu yerda RASMLI va RASMSIZ tovar bitta jadvalda
   chiziladi va nomlarning chap chekkasi PIKSELDA solishtiriladi.

   ⚠ Balandlik ham tekshiriladi — lekin TENGLIK sifatida: rasmli va
   rasmsiz qatorlar navbatma-navbat kelganda balandlik sakrasa,
   ro'yxat yana notekis bo'lardi. Bu chapga surilishning aynan o'zi,
   faqat ikkinchi o'qda.

   Ishga tushirish:  node scripts/check-prods.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4617;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2" };

/** 1×1 shaffof PNG — haqiqiy rasm kerak emas, O'RNI kerak. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

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

/* ⚠ Birinchisi RASMLI, ikkinchisi RASMSIZ — xato faqat shu juftlikda
   ko'rinadi (yuqoridagi izoh). */
const PRODUCTS = [
  { id: 1, name: "кефир",  salePrice: 12000, stockQuantity: 5, unit: "DONA",
    unitDecimals: 0, active: true, thumbUrl: "/media/thumb.png" },
  { id: 2, name: "печени", salePrice: 9000,  stockQuantity: 3, unit: "DONA",
    unitDecimals: 0, active: true, thumbUrl: null },
  /* ⚠ UCHINCHISI OXIRIDA va ataylab: yuqoridagi juftlik §1–§4 uchun
     kerak va ularning tartibi buzilmasligi shart. Bu qator faqat
     V99 bo'limlari uchun. Optom narx tan narxdan past, chakana esa
     baland — do'kon egasi so'ragan aynan shu holat. */
  { id: 3, name: "zarariga", salePrice: 10000, costPrice: 9500,
    wholesalePrice: 9000, stockQuantity: 7, unit: "DONA",
    unitDecimals: 0, active: true, thumbUrl: null,
    belowCost: false, belowWholesale: true },
];

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (r.url().includes("/media/")) {
    return r.respond({ status: 200, contentType: "image/png", body: PIXEL });
  }
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
  const p = url.pathname;
  const qs = url.searchParams;

  /* ══ ⚠ SOXTA SERVER ENDI FILTRNI O'ZI BAJARADI ════════════════════

     Ilgari bu yerda har so'rovga bir xil ro'yxat qaytarilardi va shu
     yetardi: filtrni FRONT, yuklangan massiv ustida bajarardi.

     Sahifalash kiritilgach filtr SERVERGA ko'chdi. O'shanda bu
     tekshiruv yiqildi va u TO'G'RI yiqildi: soxta server `below`
     parametrini e'tiborsiz qoldirib, uch qator qaytarardi.

     ⚠ MUHIMI: tekshiruvni «uch qator kelsa ham bo'ladi» deb
     yumshatish MUMKIN EMAS edi. O'shanda u o'z vazifasini
     bajarmay qo'yardi — bosh sahifadagi «zarariga sotilyapti»
     havolasi ro'yxatni toraytirishi SHART va aynan shu yerda
     qo'riqlanadi.

     Shuning uchun soxta server haqiqiysiga o'xshatildi: `below` va
     `q` parametrlari qaraladi, javob esa sahifalangan shaklda
     (`{content, total, hasNext}`) qaytadi. */
  const paged = qs.has("page") || qs.has("flt") || qs.has("q") || qs.has("below");
  let rows = PRODUCTS;
  if (qs.get("below") === "true") {
    rows = rows.filter((x) => x.belowCost || x.belowWholesale);
  }
  const q = (qs.get("q") || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((x) => [x.name, x.barcode, x.sku]
      .some((v) => String(v ?? "").toLowerCase().includes(q)));
  }

  /* ⚠ `generate-code` ALOHIDA: umumiy `/products` javobi massiv
     qaytaradi va `r?.data?.barcode` `undefined` bo'lib qolardi —
     ya'ni tugma bosilsa ham kodni yozadigan tarmoq umuman
     ishlamasdi va tekshiruv bekorga yashil turardi. */
  const body = /\/generate-code$/.test(p)
    ? { success: true, data: { barcode: "20001421" } }
    : /\/products\b/.test(p)
    ? { success: true,
        data: paged
          ? { content: rows, page: 0, size: 50, total: rows.length, hasNext: false }
          : rows }
    : { success: true, data: [] };
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify(body) });
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });
/* ⚠ `pageerror` YETARLI EMAS. React xatoni ErrorBoundary bilan
   USHLAB qoladi va u `window.onerror` gacha yetib bormasligi
   mumkin — ekranda «Xatolik yuz berdi» turadi, tekshiruv esa
   yashil. Shuning uchun chegara komponentining o'z jurnali
   o'qiladi. */
page.on("console", (m) => {
  const txt = m.text();
  if (m.type() === "error" && txt.includes("ErrorBoundary:")) pageErrors.push(txt);
});
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});
await page.goto(`http://127.0.0.1:${PORT}/products`, { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector("tbody tr", { timeout: 10_000 });

console.log("\n══ TOVARLAR RO'YXATI (V108) ══");

const rows = await page.$$eval("tbody tr", (trs) => trs.slice(0, 2).map((tr) => {
  const cell = tr.querySelector("td:first-child");
  const name = [...cell.querySelectorAll("span")]
    .find((s) => s.textContent.trim() && !s.classList.contains("prod-thumb"));
  const slot = cell.querySelector(".prod-thumb");
  return {
    text: name?.textContent.trim() || null,
    left: name ? Math.round(name.getBoundingClientRect().left) : null,
    slot: slot ? Math.round(slot.getBoundingClientRect().width) : null,
    img:  !!cell.querySelector("img"),
    h:    Math.round(tr.getBoundingClientRect().height),
  };
}));

console.log("\n§1 Juftlik chizildi");
rows.length === 2 && rows[0].img && !rows[1].img
  ? ok(`rasmli «${rows[0].text}» va rasmsiz «${rows[1].text}»`)
  : no("bitta rasmli, bitta rasmsiz qator kerak", JSON.stringify(rows));

console.log("\n§2 ⚠ NOMLAR BITTA CHIZIQDAN boshlanadi");
rows[0].left != null && rows[0].left === rows[1].left
  ? ok(`ikkalasi ham ${rows[0].left}px dan boshlanadi`)
  : no("chap chekka bir xil bo'lishi kerak", `${rows[0].left} ≠ ${rows[1].left}`);

console.log("\n§3 Rasm o'rni RASMSIZDA HAM turadi");
rows[1].slot === 30
  ? ok("bo'sh o'rin 30px kenglikni ushlab turibdi")
  : no("30px bo'lishi kerak", rows[1].slot);

console.log("\n§4 ⚠ QATORLAR BIR XIL BALANDLIKDA");
/* Ro'yxat notekis bo'lmasligi kerak: rasmli va rasmsiz qatorlar
   navbatma-navbat kelganda balandlik sakrasa, ko'z ularni ustma-ust
   taqqoslay olmasdi — chapga surilish bilan bir xil muammo, faqat
   ikkinchi o'qda. */
rows[1].h === rows[0].h
  ? ok(`ikkalasi ham ${rows[0].h}px`)
  : no("balandlik bir xil bo'lishi kerak", `${rows[0].h} ≠ ${rows[1].h}`);

/* ══════════════════════════════════════════════════════════════════════
   §6–§8 — TOVAR OYNASI OCHILADIMI (V99)

   ⚠ BU BO'LIMLAR HAQIQIY NUQSON USTIGA YOZILDI. Do'kon egasi yozdi:
   «edit va yangi maxsulot qoshishda shu xato chiqyapti» — ekranda
   `editing is not defined`. Ya'ni tovar qo'shish ham, tahrirlash ham
   butunlay ishlamay qolgan edi.

   Yuqoridagi §1–§5 buni USHLAY OLMASDI va sababi oddiy: ular
   ro'yxatning O'ZINI qaraydi, OYNANI esa hech qachon ochmaydi.
   Ro'yxat mutlaqo joyida chiziladi — xato faqat tugma bosilganda
   chiqadi.

   ⚠ TUGMA ICHIDAGI IKONKA BO'YICHA TANLANADI (`i.fa-pen`), tarjima
   matni bo'yicha emas: `aria-label` tilga bog'liq va tarjima
   o'zgarishi tekshiruvni yiqitardi.
   ══════════════════════════════════════════════════════════════════════ */

/** Oyna ochilishini kutadi; ErrorBoundary tushsa — darhol yiqiladi. */
const openedForm = async () => {
  try {
    await page.waitForSelector(".modal-box .form-section", { timeout: 5000 });
  } catch {
    return false;
  }
  return true;
};
const boundaryDown = () =>
  page.$$eval("i.fa-triangle-exclamation", (els) =>
    els.some((e) => e.closest("div")?.querySelector("details pre")));

console.log("\n§6 ⚠ «YANGI TOVAR» OYNASI OCHILADI");
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.querySelector("i.fa-plus"));
  b?.click();
});
(await openedForm()) && !(await boundaryDown())
  ? ok("forma chizildi — oyna ochildi")
  : no("«Yangi tovar» oynasi ochilmadi", pageErrors.join(" | ") || "forma yo'q");

console.log("\n§7 «Kod yaratish» tugmasi ishlaydi");
/* Barkod maydoni bo'sh — tugma FAQAT shunda ko'rinadi. Yangi tovarda
   `id` yo'q, shuning uchun bu yerda tugma bo'lmasligi to'g'ri. */
const addHasCode = await page.$$eval("button", (bs) =>
  bs.some((b) => /kod yarat/i.test(b.textContent)));
!addHasCode
  ? ok("yangi tovarda tugma yo'q — kod faqat saqlangan tovarga beriladi")
  : no("yangi tovarda tugma bo'lmasligi kerak", "tugma bor");

await page.keyboard.press("Escape");
await page.waitForSelector(".modal-box", { hidden: true, timeout: 5000 });

console.log("\n§8 ⚠ «TAHRIRLASH» OYNASI OCHILADI va KOD YARALADI");
await page.evaluate(() => {
  const b = [...document.querySelectorAll("tbody tr button")].find((x) => x.querySelector("i.fa-pen"));
  b?.click();
});
if (!(await openedForm()) || (await boundaryDown())) {
  no("«Tahrirlash» oynasi ochilmadi", pageErrors.join(" | ") || "forma yo'q");
} else {
  ok("forma chizildi — oyna ochildi");
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll(".modal-box button")]
      .find((x) => /kod yarat/i.test(x.textContent));
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicked) {
    no("«Kod yaratish» tugmasi topilmadi", "tugma yo'q");
  } else {
    await page.waitForFunction(
      () => [...document.querySelectorAll(".modal-box input")]
        .some((i) => i.value === "20001421"),
      { timeout: 5000 },
    ).then(() => ok("kod maydonga yozildi: 2 000142 1"))
     .catch(() => no("kod maydonga tushmadi", pageErrors.join(" | ") || "maydon bo'sh"));
    /* ⚠ TUGMADAN KEYINGI XATO HAM MUHIM: bu yerda `load()` deb
       yozilgan edi (to'g'risi `loadData()`) va kassir yashil
       xabardan so'ng darhol qizil xato ko'rardi. */
    const toastErr = await page.$$eval("*", (els) =>
      els.some((e) => e.children.length === 0 && /is not defined/i.test(e.textContent || "")));
    !toastErr ? ok("muvaffaqiyatdan keyin xato xabari yo'q")
              : no("kоddan keyin xato xabari chiqdi", "«is not defined»");
  }
}

/* ══════════════════════════════════════════════════════════════════════
   §10–§12 — NARXI TAN NARXDAN PAST TOVARLAR (V99)

   Do'kon egasining savoli: «yangi partiya kelganda tan narxi sotuv
   narxidan yoki OPTOM narxdan oshib ketsa?»

   Kirim paytidagi tavsiya BIR MARTALIK: oyna yopilsa yo'qoladi va
   ertaga «qaysi tovarni tuzatishim kerak edi?» degan savolga javob
   yo'q. Shuning uchun holat ro'yxatda ham turadi.

   ⚠ SHU YERDA O'LCHANADI, SERVERDA EMAS: server to'g'ri bayroq
   qaytarsa ham, uni chizmagan ekran bir xil zarar keltiradi.
   ══════════════════════════════════════════════════════════════════════ */

console.log("\n§10 ⚠ ZARARIGA SOTILAYOTGAN TOVAR BELGILANADI");
const marks = await page.$$eval("tbody tr", (trs) => trs.map((tr) => ({
  name: tr.querySelector("td:first-child")?.textContent.trim() || "",
  badge: tr.querySelector(".prod-below")?.textContent.trim() || null,
  title: tr.querySelector(".prod-below")?.getAttribute("title") || null,
})));
const lossRow = marks.find((m) => /zarariga/i.test(m.name));
lossRow?.badge
  ? ok(`belgi chizildi: «${lossRow.badge}»`)
  : no("zarariga sotilayotgan tovarda belgi bo'lishi kerak", JSON.stringify(marks));
marks.filter((m) => !/zarariga/i.test(m.name)).every((m) => !m.badge)
  ? ok("sog'lom tovarlarda belgi yo'q")
  : no("belgi faqat zararli tovarda bo'lishi kerak", JSON.stringify(marks));

console.log("\n§11 ⚠ IZOH QAYSI NARX ekanini aytadi");
/* Tan narx optom narxdan oshib, chakanadan oshmasligi mumkin —
   o'shanda chakana savdo hamon foydali. Bitta umumiy matn do'kon
   egasiga qaysi narxni tuzatishni aytmasdi. */
/optom/i.test(lossRow?.title || "")
  ? ok("izohda OPTOM narx aytilgan")
  : no("izoh optom narx haqida bo'lishi kerak", lossRow?.title);

console.log("\n§12 ⚠ `?below=1` FILTRI VA UNI TOZALASH");
await page.goto(`http://127.0.0.1:${PORT}/products?below=1`,
                { waitUntil: "networkidle2", timeout: 30_000 });
await page.waitForSelector("tbody tr", { timeout: 10_000 });
const only = await page.$$eval("tbody tr td:first-child",
  (ts) => ts.map((t) => t.textContent.trim()));
only.length === 1 && /zarariga/i.test(only[0])
  ? ok("faqat narxi eskirgan tovar qoldi")
  : no("filtr faqat bitta qator qoldirishi kerak", only.join(" | "));

/* ⚠ FILTR YOQILGANI KO'RINSIN. Usiz ro'yxat sababsiz qisqargandek
   ko'rinardi va signaldan kelgan odam «tovarlarim qayoqqa ketdi?»
   deb o'ylardi. */
const note = await page.$eval(".prod-below-note", (n) => n.textContent.trim())
  .catch(() => null);
note ? ok(`filtr haqida yozuv bor: «${note.slice(0, 48)}…»`)
     : no("filtr yoqilgani yozilishi kerak", "yozuv yo'q");

/* Tozalash tugmasi — manzilni qo'lda tahrirlash yechim emas.

   ⚠ MANZIL HAM TEKSHIRILADI, faqat qatorlar soni emas. Boshida shu
   yerda «qatorlar birdan ko'p bo'ldimi» degan yagona tasdiq turardi
   va u BO'SH JOYDA o'tardi: filtr umuman ishlamay qolganda qatorlar
   allaqachon uchta bo'lar, tasdiq esa yashil qolardi. Sindirib
   tekshirishda aynan shu tutildi. */
await page.evaluate(() => document.querySelector(".prod-below-note button")?.click());
await page.waitForFunction(
  () => !location.search.includes("below")
        && !document.querySelector(".prod-below-note"),
  { timeout: 5000 },
).then(async () => {
  const n = await page.$$eval("tbody tr", (r) => r.length);
  n === 3 ? ok(`«Hammasini ko'rsatish» filtrni tozaladi — ${n} qator qaytdi`)
          : no("tozalashdan keyin hamma qator qaytishi kerak", n);
}).catch(() => no("tugma manzildagi filtrni ham tozalashi kerak", page.url()));

console.log("\n§9 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Tovarlar ro'yxati: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
