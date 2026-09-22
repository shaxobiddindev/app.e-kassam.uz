/* ══════════════════════════════════════════════════════════════════════════
   YAROQLILIK MUDDATI: IKKI XONALI YIL VA PARTIYA MUDDATINI TUZATISH

   ═══ QANDAY NOSOZLIKNI QAYTARMASLIK UCHUN ═════════════════════════════

   Omborchi muddatni qutidagidek — `22-10-26` deb yozardi. Maydon esa
   sakkizta raqam kutadi: oltitasi bilan qiymat BO'SH chiqardi va
   maydon XATO HAM BERMASDI («hali yozilmoqda» deb hisoblanardi).
   Ya'ni maydon TO'LDIRILGANDEK ko'rinardi, tizimda esa muddat yo'q edi.

   Yetkazib beruvchi kirimida bu jimgina MUDDATSIZ partiya yaratardi:
   bunday partiya hech qachon `EXPIRED` bo'lmaydi, «muddati yaqin»
   ogohlantirishiga tushmaydi va FEFO da eng oxirida turadi — tovar
   muddatidan keyin ham sotilaveradi.

   Ikkinchi yarmi: kirimda bir marta xato yozilgan sanani TUZATISHNING
   yo'li yo'q edi. `correctBatch` faqat qoldiq bilan ishlaydi.

   Bu yerda tekshiriladi:
     A. `22-10-26` fokusdan chiqqanda `22-10-2026` ga to'ldiriladi;
     B. yarim yozilgan sana QIZIL bo'ladi va saqlashga yo'l bermaydi;
     C. serverga TO'G'RI ISO sana ketadi (`2026-10-22`);
     D. muddat uzaytirilganda OGOHLANTIRISH chiqadi;
     E. 428 kelganda bajik oynasi ochiladi — qorovul ulangan.

   ⚠ CORS sarlavhalari shart — sababi `check-pay.mjs` da yozilgan.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-expiry.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4621;
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

let pass = 0, fail = 0;
const ok  = (m, extra = "") => { pass++; console.log(`  ✅ ${m}${extra ? ` (${extra})` : ""}`); };
const bad = (m, extra = "") => { fail++; console.log(`  ❌ ${m}${extra ? ` — ${extra}` : ""}`); };
const is  = (cond, m, extra = "") => (cond ? ok(m, extra) : bad(m, extra));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const pageErrors = [];

/* ⚠ Sana MAHALLIY qismlardan yig'iladi, `toISOString()` dan EMAS:
   u UTC beradi va Toshkentda (UTC+5) yarim tundan 05:00 gacha
   KECHAGI kunni qaytaradi. Sabab `check-inv.mjs` da batafsil. */
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ⚠ FIKSTURA MUDDATI — 15-YANVAR, `day(30)` EMAS.

   Ilgari `day(30)` turardi va sinov BIR KUN ishlab, ertasiga yiqildi:
   2026-09-21 da u 2026-10-21 berardi, 2026-09-22 da esa 2026-10-22 —
   ya'ni sinov yozadigan `22-10-26` bilan AYNAN BIR XIL. Oyna esa
   o'zgarmagan sanani haqli ravishda rad etadi va «Saqlash» o'chiq
   qoladi. Sinov buni ilovaning nosozligi deb ko'rsatardi.

   ⚠ HAR QANDAY `day(N)` shu tuzoqni saqlaydi: u kalendar bilan
   suriladi va yiliga bir marta yozilgan sanaga tushadi. Shuning uchun
   KUNI boshqa: sinov 22-, 31- va 01-kunlarni yozadi, fikstura esa
   15-kun. Yil ahamiyatsiz — to'qnashuv MUMKIN EMAS. */
const BATCH = {
  inventoryId: 501, productId: 1, productName: "Sut 1L", unit: "DONA",
  quantity: 10, costPrice: 6000,
  expiryDate: `${new Date().getFullYear() + 1}-01-15`,
  expired: false, status: "ACTIVE", archivedAt: null, createdAt: new Date().toISOString(),
};

/** Oxirgi PATCH tanasi — sinov aynan SHUNI tekshiradi, ekrandagi matnni emas. */
let sent = null;
/** Yoqilsa server 428 qaytaradi — bajik oqimini sinash uchun. */
let need428 = false;

async function open() {
  sent = null;
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const u = new URL(r.url());

    if (u.pathname.endsWith("/expiry") && r.method() === "PATCH") {
      sent = JSON.parse(r.postData() || "{}");
      if (need428) {
        return r.respond({
          status: 428, contentType: "application/json", headers: CORS,
          body: JSON.stringify({ success: false, message: "Bajikni skanerlang",
                                 action: "BATCH_EXPIRY_CHANGE", policy: "MANAGER" }),
        });
      }
      return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                         body: JSON.stringify({ success: true, data: BATCH }) });
    }

    const body = u.pathname === "/api/inventory/product/1"
      ? { success: true, data: u.searchParams.get("archived") === "true" ? [] : [BATCH] }
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

/** Muddat oynasini ochadi. */
async function openModal(page) {
  const btn = await page.$('[aria-label*="Muddatni o\'zgartirish"]');
  if (!btn) throw new Error("«Muddatni o'zgartirish» tugmasi topilmadi");
  await btn.click();
  await page.waitForSelector(".ek-date input", { timeout: 5000 });
  await wait(200);
}

const dateInput = ".ek-date input:not([type='date'])";

/** Maydonni tozalab, berilgan raqamlarni yozadi va fokusdan chiqaradi. */
async function type(page, digits, { blur = true } = {}) {
  /* ⚠ MAYDONNI TOZALASH ALOHIDA ISH. `clickCount: 3` + `Backspace`
     yetmadi: maskali maydonda kursor mantig'i tanlovni buzadi va
     eski raqamlar yangilari bilan ARALASHIB ketardi — sinov o'zi
     yolg'on qizil bergan edi. Shuning uchun har raqam alohida
     o'chiriladi. */
  await page.click(dateInput);
  for (let i = 0; i < 12; i++) await page.keyboard.press("Backspace");
  await page.$eval(dateInput, (el) => { if (el.value !== "") throw new Error("maydon tozalanmadi: " + el.value); });
  await page.type(dateInput, digits, { delay: 12 });
  if (blur) {
    await page.keyboard.press("Tab");
    await wait(150);
  }
}

/** `#RRGGBB` va `rgb(r, g, b)` ni solishtiradi. */
function sameColor(a, b) {
  const rgb = (v) => {
    const m = String(v).match(/\d+/g);
    if (m && m.length >= 3) return m.slice(0, 3).map(Number).join(",");
    const h = String(v).trim().replace("#", "");
    if (h.length !== 6) return String(v);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
  };
  return rgb(a) === rgb(b);
}

/* ⚠ QAT'IY KUTISH EMAS, SHARTNI KUTISH. Birinchi variantda
   `wait(100)` va `wait(400)` turardi: lokalda 13/13 o'tdi, CI da esa
   uchta tekshiruv yiqildi. Sekinroq mashinada React qayta chizishga
   ulgurmaydi va «Saqlash» hali O'CHIQ turganda bosiladi — bosish hech
   narsa qilmaydi, so'rov ketmaydi, sinov esa «so'rov yo'q» deb
   ilovani ayblaydi. Qat'iy kutish har doim kimningdir mashinasida
   qisqa bo'lib chiqadi. */
const until = async (fn, what, ms = 8000) => {
  const till = Date.now() + ms;
  while (Date.now() < till) {
    if (await fn()) return true;
    await wait(50);
  }
  throw new Error("kutib bo'lmadi: " + what);
};

/** Sababni yozadi va «Saqlash» YOQILGUNCHA kutadi. */
async function fillReason(page, text) {
  await page.type('.modal-body input[type="text"].form-input', text);
  try {
    await until(
      () => page.$eval(".modal-footer .btn-primary", (b) => !b.disabled).catch(() => false),
      "«Saqlash» yoqilishi",
    );
  } catch (e) {
    /* ⚠ YIQILGANDA OYNANING HOLATI YOZILADI. Usiz sinov faqat «kutib
       bo'lmadi» derdi va sabab har safar qo'lda qidirilardi. */
    const dump = await page.evaluate(() => ({
      inputs: [...document.querySelectorAll(".modal-body input")]
        .map((el) => ({ type: el.getAttribute("type"), cls: el.className, val: el.value })),
      btn: (() => { const b = document.querySelector(".modal-footer .btn-primary");
                    return b ? { disabled: b.disabled, txt: b.textContent.trim() } : "YO'Q"; })(),
    })).catch(() => null);
    console.log("     oyna holati:", JSON.stringify(dump));
    throw e;
  }
}

const shown = (page) => page.$eval(dateInput, (el) => el.value);
const errText = (page) => page.$eval(".ek-date__err", (el) => el.textContent.trim()).catch(() => null);
const saveDisabled = (page) =>
  page.$eval(".modal-footer .btn-primary", (el) => el.disabled).catch(() => null);

/* ═══ A. Ikki xonali yil ═══════════════════════════════════════════════ */
console.log("\n══ A. Ikki xonali yil to'ldiriladi ══");
{
  const page = await open();
  await openModal(page);

  await type(page, "221026", { blur: false });
  is(await shown(page) === "22-10-26", "yozayotganda TEGILMAYDI",
     `ko'rinish: ${await shown(page)}`);

  await page.keyboard.press("Tab");
  await wait(200);
  const after = await shown(page);
  is(after === "22-10-2026", "fokusdan chiqqach 22-10-26 → 22-10-2026", `ko'rinish: ${after}`);
  is(!(await errText(page)), "xato yozuvi yo'q");
  await page.close();
}

/* ═══ B. Yarim yozilgan sana ═══════════════════════════════════════════ */
console.log("\n══ B. Tugallanmagan sana to'siladi ══");
{
  const page = await open();
  await openModal(page);

  await type(page, "2210202");
  const err = await errText(page);
  is(!!err, "yetti raqamdan keyin XATO ko'rinadi", err || "yo'q");
  is(await saveDisabled(page) === true, "«Saqlash» o'chiq turadi");

  /* ⚠ Eng muhim tasdiq: tugallanmagan sana bilan serverga HECH NARSA
     ketmasligi kerak. Ilgari u jimgina `null` ga aylanardi. */
  await page.click(".modal-footer .btn-primary").catch(() => {});
  await wait(300);
  is(sent === null, "tugallanmagan sana bilan so'rov YUBORILMAYDI",
     sent ? JSON.stringify(sent) : "yuborilmadi");
  await page.close();
}

/* ═══ C. Serverga to'g'ri ISO ketadi ═══════════════════════════════════ */
console.log("\n══ C. Serverga ISO sana ketadi ══");
{
  const page = await open();
  await openModal(page);
  await type(page, "221026");

  await fillReason(page, "yorliqda 2026 yozilgan");
  await page.click(".modal-footer .btn-primary");
  await until(() => sent !== null, "so'rov yuborilishi");

  is(sent?.expiryDate === "2026-10-22", "tanada `2026-10-22`",
     sent ? JSON.stringify(sent) : "so'rov yo'q");
  is(!!sent?.reason, "sabab ham yuborildi", sent?.reason || "yo'q");
  await page.close();
}

/* ═══ D. Uzaytirish ogohlantirishi ═════════════════════════════════════ */
console.log("\n══ D. Uzaytirish ogohlantiriladi ══");
{
  const page = await open();
  await openModal(page);

  /* Hozirgi muddat — bugundan 30 kun keyin. Keyingi yilga surish =
     UZAYTIRISH, ya'ni muddati o'tgan tovarni javonga qaytarish yo'li. */
  const next = String(new Date().getFullYear() + 2).slice(2);
  await type(page, `3112${next}`);
  await wait(200);
  /* ⚠ KLASS BORLIGI YETARLI EMAS — chizilgan RANG tekshiriladi.
     Birinchi urinishda oyna `ek-note--warning` bilan yozilgan edi va
     bu sinov o'tdi, ekranda esa ogohlantirish KO'K chizilardi:
     ilovaning `styles.css` ida `.ek-note` qayta aniqlangan (ko'k asos)
     va uning varianti `--warn` deb ataladi. Klass bor, qoida yo'q —
     hech qayerda xato chiqmaydi. */
  const warn = await page.$eval(
    ".modal-body .ek-note",
    (el) => getComputedStyle(el).backgroundColor,
  ).catch(() => null);
  is(!!warn, "muddat uzaytirilganda ogohlantirish chiqadi", warn || "yo'q");
  const brand = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue("--bg-brand-subtle").trim());
  is(warn !== null && !sameColor(warn, brand),
     "ogohlantirish KO'K emas — brend fonidan farq qiladi", `${warn} vs ${brand}`);
  if (SHOT) {
    fs.mkdirSync(SHOT, { recursive: true });
    await page.screenshot({ path: path.join(SHOT, "expiry-extend.png") });
  }

  /* Qisqartirishda chiqmasligi kerak: har safar chiqadigan
     ogohlantirish o'qilmay qoladi. */
  await type(page, "01012020");
  await wait(200);
  is(!(await page.$(".modal-body .ek-note")), "qisqartirishda ogohlantirish CHIQMAYDI");
  await page.close();
}

/* ═══ E. Bajik qorovuli ulangan ════════════════════════════════════════ */
console.log("\n══ E. 428 kelganda bajik so'raladi ══");
{
  need428 = true;
  const page = await open();
  await openModal(page);
  await type(page, "221026");
  await fillReason(page, "sinov");
  await page.click(".modal-footer .btn-primary");

  /* 428 kelgach bajik oynasi ochiladi. Uni ham SHART bo'yicha kutamiz. */
  let body = "";
  await until(async () => {
    body = await page.evaluate(() => document.body.innerText);
    return /[Bb]ajik/.test(body);
  }, "bajik oynasi").catch(() => {});
  is(/[Bb]ajik/.test(body), "bajik oynasi ochildi — qorovul ulangan");
  await page.close();
  need428 = false;
}

console.log("\n══ Sahifa xatolari ══");
is(pageErrors.length === 0, "konsol toza", pageErrors.join(" · "));

await browser.close();
server.close();
console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
