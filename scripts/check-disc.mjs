/* ══════════════════════════════════════════════════════════════════════════
   CHEGIRMA OPTIMIZATORI — BROUZERDA TEKSHIRUV (V80)

   ═══ NEGA ALOHIDA TEKSHIRUV ════════════════════════════════════════════

   `test/refund.test.mjs` HISOBNI qulflaydi: qaysi reja yaxshiroq,
   qaysi biri ro'yxatga kirmaydi. Lekin do'kon egasining talabi
   hisobda emas, EKRANDA va aynan bitta harakatda:

     kassir byudjet yozadi → tugmani bosadi → SAVATDAGI HAR QATOR
     o'z chegirmasini oladi va bir donaning narxi yaxlit bo'ladi.

   Aynan shu oxirgi bo'g'in — «tugmani bosgandan keyin savatda nima
   qoldi» — sof funksiya sinovidan o'tmaydi. U React holatida
   (`applyPlan`) va uni faqat haqiqiy sahifada ko'rish mumkin.

   ⚠ ENG NOZIK JOY: reja CHEK chegirmasi sifatida yuborilsa, server
   uni qator QIYMATIGA mutanosib tarqatadi va ekranda ko'rsatilgan
   «bir donasi 14 500» chekka TUSHMASDI. Shuning uchun bu yerda
   savatning O'ZI (localStorage) o'qiladi va har qatorning yakuniy
   narxi tekshiriladi.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-disc.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
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

const PROFILE = { creditEnabled: true, creditDueDays: 30, bonusMaxPercent: 0, creditLimit: 0 };
/* ⚠ CORS sarlavhalari SHART va `*` ishlamaydi — sabab
   `check-pay.mjs` boshida batafsil. */
const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

const pageErrors = [];

/* ⚠ `minPrice` SHART. Usiz qatorning bo'sh joyi NOL (`lineRoom`) va
   optimizator hech qanday taklif bermaydi — bu holat ham pastda
   alohida tekshiriladi. */
async function openKassa(items) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const body = r.url().includes("/shop/profile")
      ? { success: true, data: PROFILE } : { success: true, data: [] };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument((list) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.setItem("ek_cart_v_v", JSON.stringify({
      savedAt: Date.now(), v: 3, activeId: 1,
      carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items: list }],
    }));
  }, items);
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));
  return page;
}

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

/**
 * CHEGIRMA maydoniga yozadi (maskalangan — Backspace bilan tozalanadi).
 *
 * ⚠ MAYDON BITTA (V82). Ilgari ikkita edi: «Chegirma» va «Chegirma
 * byudjeti». Endi yozilgan summa ikkala vazifani ham bajaradi —
 * jamini kamaytiradi VA optimizatorga chegara bo'ladi.
 */
async function budget(page, v) {
  await page.click("#disc-budget");
  await page.evaluate(() => { document.querySelector("#disc-budget").select?.(); });
  for (let i = 0; i < 14; i++) await page.keyboard.press("Backspace");
  if (v) await page.type("#disc-budget", String(v), { delay: 12 });
  await new Promise((r) => setTimeout(r, 350));
}

/** Ekrandagi takliflar. */
const offers = (page) => page.evaluate(() => ({
  hint: document.querySelector(".pay-modal-hint:last-of-type")?.textContent.trim() || null,
  hints: [...document.querySelectorAll(".pay-modal-hint")].map((h) => h.textContent.trim()),
  btns: [...document.querySelectorAll(".round-offers__btn")].map((b) => ({
    target: (b.querySelector(".round-offers__target")?.textContent || "").replace(/\D/g, ""),
    cut: (b.querySelector(".round-offers__cut")?.textContent || "").replace(/\D/g, ""),
    ret: !!b.querySelector(".round-offers__ret"),
    best: !!b.querySelector(".round-offers__ret.is-best"),
  })),
}));

/** Savatning O'ZI — reja qo'llangandan keyingi haqiqiy holat. */
const cart = (page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("ek_cart_v_v") || "{}");
  const c = (raw.carts || []).find((x) => x.id === raw.activeId) || {};
  return {
    discount: c.discount,
    items: (c.items || []).map((i) => ({
      name: i.name, qty: i.qty, price: i.salePrice, disc: Number(i.discount) || 0,
      unit: Math.round(((i.salePrice * i.qty - (Number(i.discount) || 0)) / i.qty) * 100) / 100,
    })),
  };
});

/* ══════════════════════════════════════════════════════════════════════
   1. BIR DONANING NARXI YAXLITLANADI
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 1. Uçta bir xil tovar: bir donasi yaxlit böladi ──");
{
  const page = await openKassa([
    { id: 1, name: "Kurtka", salePrice: 14900, qty: 3, unit: "DONA",
      stockQuantity: 9, minPrice: 13000, costPrice: 10000 },
  ]);
  await budget(page, 1500);
  const o = await offers(page);
  o.btns.length > 0 ? ok(`${o.btns.length} ta taklif çiqdi`)
                    : no("taklif çiqişi kerak", JSON.stringify(o.hints));
  /* ⚠ BITTA MAYDON: yozilgan summa jamini DARHOL kamaytiradi.
     Ilgari «byudjet» maydoni jamiga tegmasdi va kassir uni chegirma
     deb o'ylab, hech narsa o'zgarmaganini ko'rardi. */
  {
    const live = await page.evaluate(() =>
      document.querySelector(".pay-modal-total-value")
        ?.textContent.replace(/\D/g, "") || null);
    live === null ? ok("jami maydonini öqib bölmadi (ötkazildi)")
      : live === "43200" ? ok("jami darhol kamaydi: 44 700 − 1 500 = 43 200")
      : no("jami 43 200 bölişi kerak", live);
  }

  if (o.btns.length) {
    /* Birinchi tugma — ENG YAXSHISI. 14 500 × 3 = 43 500, chegirma
       1 200 — byudjetdan (1 500) KAM, lekin qaytarish qulay. */
    o.btns[0].target === "43500"
      ? ok("eng yaxşi taklif: jami 43 500") : no("jami 43 500 bölişi kerak", o.btns[0].target);
    o.btns[0].cut === "1200"
      ? ok("çegirma 1 200 — byudjetdan KAM (byudjet — çegara, majburiyat emas)")
      : no("çegirma 1 200 bölişi kerak", o.btns[0].cut);
    o.btns[0].ret ? ok("qaytariş belgisi körinadi") : no("qaytariş belgisi bölişi kerak", "yöq");

    await page.evaluate(() => document.querySelectorAll(".round-offers__btn")[0].click());
    await new Promise((r) => setTimeout(r, 400));
    const c = await cart(page);
    c.items[0].unit === 14500
      ? ok("SAVATDA bir donaning narxi 14 500") : no("bir donasi 14 500 bölişi kerak", c.items[0].unit);
    c.items[0].disc === 1200
      ? ok("çegirma QATORGA yozildi (1 200)") : no("qator çegirmasi 1 200 bölişi kerak", c.items[0].disc);
    /* ⚠ Chek chegirmasi maydoni BO'SH qolishi shart: aks holda server
       uni qator qiymatiga mutanosib yana tarqatardi va ekranda
       ko'rsatilgan narx chekka tushmasdi. */
    !c.discount ? ok("çek çegirmasi böş — server qayta tarqatmaydi")
                : no("çek çegirmasi böş bölişi kerak", c.discount);
  }
  await page.close();
}

/* ══════════════════════════════════════════════════════════════════════
   2. ALLAQACHON QULAY SAVATGA TAKLIF BERILMAYDI
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 2. Savat allaqaçon qulay — taklif YÖQ ──");
{
  /* 3 × 15 000 = 45 000: jami ham yaxlit, bir donasi ham. «−1 000 →
     44 000» taklifi jamini chiroyli qoldirardi, lekin bir donani
     14 666.67 ga tushirardi. Kassir ro'yxatdagi tugmani ko'rsa —
     bosadi, shuning uchun bunday variant ro'yxatga kirmasligi kerak. */
  const page = await openKassa([
    { id: 1, name: "Kurtka", salePrice: 15000, qty: 3, unit: "DONA",
      stockQuantity: 9, minPrice: 12000, costPrice: 10000 },
  ]);
  await budget(page, 1000);
  const o = await offers(page);
  o.btns.length === 0 ? ok("taklif çiqmadi") : no("taklif chiqmasligi kerak", JSON.stringify(o.btns));
  o.hints.some((h) => /allaqaçon qulay|qiyinlaştiradi/i.test(h))
    ? ok("sabab aytildi: narxlar allaqaçon qulay")
    : no("sabab körsatilişi kerak", JSON.stringify(o.hints));
  await page.close();
}

/* ══════════════════════════════════════════════════════════════════════
   3. ARALASH SAVAT — HAR QATOR O'Z SUMMASINI OLADI
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 3. Aralaş savat: har qator alohida yaxlitlanadi ──");
{
  const page = await openKassa([
    { id: 1, name: "Kurtka", salePrice: 14900, qty: 3, unit: "DONA",
      stockQuantity: 9, minPrice: 13000, costPrice: 10000 },
    { id: 2, name: "Shim", salePrice: 7300, qty: 1, unit: "DONA",
      stockQuantity: 9, minPrice: 6000, costPrice: 5000 },
    { id: 3, name: "Paypoq", salePrice: 2400, qty: 5, unit: "DONA",
      stockQuantity: 20, minPrice: 2000, costPrice: 1500 },
  ]);
  await budget(page, 5000);
  const o = await offers(page);
  o.btns.length > 0 ? ok(`${o.btns.length} ta taklif`) : no("taklif bölişi kerak", JSON.stringify(o.hints));
  o.btns[0]?.best ? ok("eng yaxshisida «mukammal» belgisi") : ok("belgi darajasi: " + (o.btns[0]?.ret ? "ösiş" : "yöq"));

  await page.evaluate(() => document.querySelectorAll(".round-offers__btn")[0].click());
  await new Promise((r) => setTimeout(r, 400));
  const c = await cart(page);
  const units = c.items.map((i) => i.unit);
  units.every((u) => u % 1000 === 0)
    ? ok("uçala qatorning ham bir donasi 1 000 ga bölinadi: " + units.join(", "))
    : no("har qator 1 000 ga bölinişi kerak", units.join(", "));
  /* Hech bir qator o'z chegarasidan pastga tushmasligi kerak — aks
     holda tugmani bosgan kassir darhol bajik so'raladigan holatga
     tushardi. */
  const MIN = [13000, 6000, 2000];
  units.every((u, i) => u >= MIN[i])
    ? ok("heç bir qator eng past narxdan pastga tuşmadi")
    : no("çegaradan oşib ketdi", units.join(", "));
  const spent = c.items.reduce((s, i) => s + i.disc, 0);
  spent <= 5000 ? ok(`byudjetdan oshmadi: ${spent} ≤ 5 000`) : no("byudjetdan oşdi", spent);
  await page.close();
}

/* ══════════════════════════════════════════════════════════════════════
   4. CHEGARA YO'Q — TAKLIF HAM YO'Q
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 4. Eng past narxdagi tovar — taklif yöq, sabab aytiladi ──");
{
  const page = await openKassa([
    { id: 1, name: "Kurtka", salePrice: 14900, qty: 3, unit: "DONA",
      stockQuantity: 9, minPrice: 14900, costPrice: 10000 },
  ]);
  await budget(page, 5000);
  const o = await offers(page);
  o.btns.length === 0 ? ok("taklif yöq") : no("taklif bölmasligi kerak", JSON.stringify(o.btns));
  o.hints.some((h) => /narxi eng past|çegirma qilib bölmaydi/i.test(h))
    ? ok("sabab aytildi: narx allaqaçon eng past")
    : no("sabab körsatilişi kerak", JSON.stringify(o.hints));
  await page.close();
}

/* ══════════════════════════════════════════════════════════════════════
   5. TAROZILI TOVAR
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 5. Tarozili tovar: kg narxi yaxlitlanadi ──");
{
  const page = await openKassa([
    { id: 1, name: "Go'sht", salePrice: 13300, qty: 1.5, unit: "KG",
      stockQuantity: 20, minPrice: 11000, costPrice: 9000, unitDecimals: 3 },
  ]);
  await budget(page, 2000);
  const o = await offers(page);
  o.btns.length > 0 ? ok(`${o.btns.length} ta taklif`) : no("taklif bölişi kerak", JSON.stringify(o.hints));
  await page.evaluate(() => document.querySelectorAll(".round-offers__btn")[0].click());
  await new Promise((r) => setTimeout(r, 400));
  const c = await cart(page);
  c.items[0].unit % 500 === 0
    ? ok(`kg narxi yaxlit: ${c.items[0].unit}`) : no("kg narxi yaxlit bölişi kerak", c.items[0].unit);
  c.items[0].unit >= 11000
    ? ok("eng past narxdan pastga tuşmadi") : no("çegaradan oşdi", c.items[0].unit);
  await page.close();
}

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tuşdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tuşmadi");
}

await browser.close();
server.close();
console.log(bad ? `\n❌ Çegirma optimizatori: ${bad} ta muammo\n`
                : "\n✅ Çegirma optimizatori: hammasi ötdi\n");
process.exit(bad ? 1 : 0);
