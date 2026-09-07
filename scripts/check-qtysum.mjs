/* ══════════════════════════════════════════════════════════════════════════
   MIQDOR YOKI SUMMA — KASSADA (V104)

   Do'kon egasi: «ba'zi mahsulotlarga pulini yozsa, miqdorini o'zi qo'yib
   savatga qo'shib beradigan qilish kerak — miqdor yoki summa».

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Hisob-kitobning o'zi `test/qty-sum.test.mjs` da sinaladi. Bu yerda
   SIMLAR tekshiriladi: tanlov chizilyaptimi, summa yozilganda ekranda
   qaysi miqdor turibdi va TASDIQLANGANDA SAVATGA nima tushdi. Sof
   funksiya to'g'ri bo'lib turib, oyna undan noto'g'ri foydalanishi
   mumkin — savatga tushgan raqam esa to'g'ridan-to'g'ri chekka ketadi.

   Ishga tushirish:  node scripts/check-qtysum.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4611;
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

/* 85 000 so'm/kg — do'kon egasining misolidagi go'sht. */
const MEAT  = { id: 1, name: "Go'sht", salePrice: 85000, qty: 1,
                unit: "KG", unitDecimals: 3, stockQuantity: 20 };
/* Bo'linmaydigan tovar: summadan chiqqan miqdor BUTUN bo'lishi shart. */
const PIECE = { id: 2, name: "Kurtka", salePrice: 30000, qty: 1,
                unit: "DONA", unitDecimals: 0, stockQuantity: 9 };

/** Kassa sahifasi — soxta API va savat bilan. */
async function openKassa(items) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const body = r.url().includes("/shop/profile")
      ? { success: true, data: { creditEnabled: true, creditDueDays: 30, bonusMaxPercent: 0, creditLimit: 0 } }
      : { success: true, data: [] };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument((cartItems) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.setItem("ek_cart_v_v", JSON.stringify({
      savedAt: Date.now(), v: 3, activeId: 1,
      carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items: cartItems }],
    }));
  }, items);
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector(".qty-num--edit", { timeout: 10000 });
  return page;
}

/* ⚠ Qat'iy `sleep` YO'Q: React qayta chizishi mashina bandligiga qarab
   o'nlab millisekund tebranadi va qotib qolgan kutish sinovni goh
   o'tkazib, goh yiqitardi. */
const waitFor = async (page, fn, ms = 4000) => {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
};

/** Oynani ochadi (savatdagi miqdor raqamiga bosib). */
async function openModal(page) {
  await page.click(".qty-num--edit");
  await page.waitForSelector(".qty-modal", { timeout: 5000 });
}

/** Maydonga yozadi (avval tozalab).

   ⚠ Uch marta bosib belgilash + Backspace ISHLAMAYDI: maydon
   boshqariladigan va har chizilishida razryadlarga qayta ajratiladi,
   belgilash esa shunda yo'qoladi — eski raqam ustiga yangisi
   YOPISHIB, «8 500 050 000» kabi son chiqardi. Oynaning o'z
   yorlig'i (Delete) esa qiymatni butunlay tozalaydi. */
async function type(page, text) {
  await page.focus(".qty-modal__input");
  await page.keyboard.press("Delete");
  await waitFor(page, () => document.querySelector(".qty-modal__input")?.value === "");
  if (text) await page.keyboard.type(text, { delay: 12 });
  await waitFor(page, () => !!document.querySelector(".qty-modal__total")?.textContent.trim());
}

const modeBtn = async (page, i) => (await page.$$(".qty-modal__mode-btn"))[i];
const totalText = (page) => page.$eval(".qty-modal__total", (e) => e.textContent.trim());
const inputValue = (page) => page.$eval(".qty-modal__input", (e) => e.value);
const cartQty = (page) => page.$eval(".qty-num--edit", (e) => e.textContent.trim());

console.log("\n══ MIQDOR YOKI SUMMA (V104) ══\n");

/* ── §1 Tanlov bor va MIQDOR yoqilgan ─────────────────────────────── */
console.log("§1 Tanlov");
let page = await openKassa([MEAT]);
await openModal(page);
const btns = await page.$$eval(".qty-modal__mode-btn",
  (els) => els.map((e) => [e.textContent.trim(), e.getAttribute("aria-pressed")]));
btns.length === 2 ? ok("ikkita tugma: miqdor va summa") : no("tanlov chizilmadi", btns.length);
btns[0]?.[1] === "true" && btns[1]?.[1] === "false"
  ? ok("oyna MIQDOR rejimida ochiladi (tarozi barkodi shu yerga tushadi)")
  : no("boshlang'ich rejim noto'g'ri", JSON.stringify(btns));

/* ── §2 Summadan miqdor ekranda ───────────────────────────────────── */
console.log("\n§2 50 000 so'mlik go'sht");
await (await modeBtn(page, 1)).click();
await waitFor(page, () => document.querySelectorAll(".qty-modal__mode-btn")[1]
  ?.getAttribute("aria-pressed") === "true");
await type(page, "50000");
let txt = await totalText(page);
/* 50 000 / 85 000 = 0.588 kg; chek 49 980 so'm — aytilgan puldan OSHMAYDI. */
txt.includes("0.588") && /49\D?980/.test(txt)
  ? ok(`ekranda: ${txt}`)
  : no("miqdor yoki summa noto'g'ri", txt);

/* ── §3 SAVATGA TUSHGAN SON ───────────────────────────────────────── */
console.log("\n§3 Tasdiqlash");
await page.click(".pay-modal-footer .btn-green");
await waitFor(page, () => !document.querySelector(".qty-modal"));
let q = await cartQty(page);
q === "0.588" ? ok("savatda 0.588 kg (summa emas, miqdor)") : no("savatga boshqa son tushdi", q);

/* ── §4 Rejim almashsa qiymat O'GIRILADI ──────────────────────────── */
console.log("\n§4 Almashtirish");
await openModal(page);
await type(page, "0.5");
await (await modeBtn(page, 1)).click();
await waitFor(page, () => /42/.test(document.querySelector(".qty-modal__input")?.value || ""));
let v = await inputValue(page);
v.replace(/\D/g, "") === "42500" ? ok(`0.5 kg → ${v} (tozalanmadi, o'girildi)`)
                                 : no("summaga o'girilmadi", v);
await (await modeBtn(page, 0)).click();
await waitFor(page, () => document.querySelector(".qty-modal__input")?.value === "0.5");
v = await inputValue(page);
v === "0.5" ? ok("qaytib bosilganda o'sha 0.5 — savat o'zgarmaydi")
            : no("qaytishda miqdor surildi", v);

/* ── §5 Pul bir birlikka yetmasa ──────────────────────────────────── */
console.log("\n§5 Yetmagan pul");
await (await modeBtn(page, 1)).click();
await type(page, "50");
const off = await page.$eval(".pay-modal-footer .btn-green", (e) => e.disabled);
off ? ok("50 so'mga 1 gramm ham chiqmaydi — «Tasdiqlash» o'chiq")
    : no("yetmagan pulda tasdiqlash ochiq qoldi", off);
txt = await totalText(page);
/85\D?000/.test(txt) ? ok(`sabab ko'rinib turadi: ${txt}`) : no("birlik narxi ko'rsatilmadi", txt);
await page.keyboard.press("Escape");
await page.close();

/* ── §6 Bo'linmaydigan tovar ──────────────────────────────────────── */
console.log("\n§6 Dona tovar");
page = await openKassa([PIECE]);
await openModal(page);
await (await modeBtn(page, 1)).click();
await type(page, "100000");
txt = await totalText(page);
/* 100 000 / 30 000 = 3.33 → 3 dona (90 000 so'm). Yaqiniga
   yaxlitlanganda 3.333 dona chiqib, server uni 3 ga aylantirar va
   ekranda bir son, chekda boshqa son turardi. */
/\b3\b/.test(txt) && !txt.includes("3.3") && /90\D?000/.test(txt)
  ? ok(`ekranda: ${txt}`) : no("dona tovarda kasr chiqdi", txt);
await page.click(".pay-modal-footer .btn-green");
await waitFor(page, () => !document.querySelector(".qty-modal"));
q = await cartQty(page);
q === "3" ? ok("savatda 3 dona") : no("savatga kasr tushdi", q);
await page.close();

/* ── Sahifa xatolari ──────────────────────────────────────────────── */
console.log("\n§7 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q")
                        : no("sahifada xato", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ miqdor/summa: hammasi joyida\n"
                      : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
