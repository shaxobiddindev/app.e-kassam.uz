/* ══════════════════════════════════════════════════════════════════════════
   KASSIRNI PIN BILAN ALMASHTIRISH (V99)

   ═══ NEGA BU TEKSHIRUV BOR ════════════════════════════════════════════

   Do'kon egasi: «PIN moduli `app` ga o'tkazilsin, `auth` alohida
   serverda turadi va yuklash vaqti tizimni sekinlashtiradi».

   ⚠ ISHNING BUTUN MA'NOSI — SAHIFA QAYTA YUKLANMASLIGIDA. `auth` orqali
   o'tish savatni, ochiq smenani, skaner tinglovchisini va tarozi
   ulanishini uzardi. Agar oyna ishlab, lekin sahifa baribir qayta
   yuklansa — biz hech narsa yutmagan bo'lamiz. Shuning uchun bu yerda
   AYNAN shu o'lchanadi (§3).

   Bu yerda tekshiriladi:
     §1 Savat bo'sh bo'lmasa oyna OCHILMAYDI va sabab aytiladi.
     §2 Oyna ochiladi, PIN to'lgach O'ZI yuboriladi (tasdiq tugmasi yo'q).
     §3 ⚠ SAHIFA QAYTA YUKLANMAYDI va yangi kassirning ismi ekranda.
     §4 Noto'g'ri PIN da xato ko'rinadi va maydon TOZALANADI.
     §5 Sahifada JS xatosi yo'q.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-pin.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4623;
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

let bad = 0;
const ok = (m, extra = "") => console.log(`  ✅ ${m}${extra ? ` (${extra})` : ""}`);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const is = (cond, m, got = "") => (cond ? ok(m, got) : no(m, got));

const GOOD_PIN = "5837";
let pinSent = null;
let pinSet = null;
let lengthSaved = null;
let SHOP_PIN_LENGTH = 4;

/**
 * Ilovani ochadi.
 *
 * @param cart savat bo'sh bo'lmasin — `hasItems()` shuni ko'rishi kerak
 */
async function open({ cart = false, path: route = "/sale", role = "CASHIER" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = {
      "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers":
        r.headers()["access-control-request-headers"] || "authorization,content-type,x-device-id",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const p = new URL(r.url()).pathname;

    if (p === "/api/shop/profile") {
      return r.respond({ status: 200, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ success: true, data: { name: "Test", pinLength: SHOP_PIN_LENGTH } }) });
    }
    if (p === "/api/auth/pin" && r.method() === "POST") {
      try { pinSet = JSON.parse(r.postData() || "null")?.pin; } catch { pinSet = "PARSE_XATO"; }
      return r.respond({ status: 200, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ success: true, message: "PIN saqlandi" }) });
    }
    if (p === "/api/shop/pin-length") {
      lengthSaved = new URL(r.url()).searchParams.get("value");
      return r.respond({ status: 200, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ success: true, data: { pinLength: Number(lengthSaved) } }) });
    }
    if (p === "/api/auth/pin/switch") {
      try { pinSent = JSON.parse(r.postData() || "null")?.pin; } catch { pinSent = "PARSE_XATO"; }
      if (pinSent !== GOOD_PIN) {
        return r.respond({ status: 400, contentType: "application/json", headers: CORS,
          body: JSON.stringify({ success: false, message: "PIN noto'g'ri" }) });
      }
      return r.respond({ status: 200, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ success: true, message: "Kassir almashtirildi", data: {
          accessToken: "yangi-token", refreshToken: "yangi-refresh", shopCode: "TEST",
          username: "kassir2", fullName: "Dilnoza Qodirova", role: "CASHIER",
        } }) });
    }
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.evaluateOnNewDocument(({ hasCart, role }) => {
    for (const [k, v] of Object.entries({
      ek_token: "t", ek_type: "user", ek_role: role, ek_username: "kassir1",
      ek_fullName: "Ali Valiyev", ek_shopCode: "TEST", ek_deviceId: "d1",
      ek_lang: "uz", ek_theme: "light", ek_pinLength: "4",
    })) localStorage.setItem(k, v);
    /* ⚠ SAVAT HAR SAFAR TOZALANADI. Varaqlar bitta `localStorage` ni
       BO'LISHADI: §1 dagi savat §2 ga o'tib qolar va oyna ochilmay,
       tekshiruv «tugma ishlamayapti» deb yolg'on xato berardi. Aynan
       shu tuzoq `check-pay.mjs` da bir marta bir necha soat yegan. */
    localStorage.removeItem("ek_cart_TEST_kassir1");
    if (hasCart) {
      /* ⚠ KALIT AYNAN `ek-cart-store` DAGIDEK: `ek_cart_<do'kon>_<xodim>`.
         Birinchi urinishimda kalitni taxmin qilgan edim va §1 BO'SH
         JOYDA o'tib ketdi: `hasItems()` yozuvni topmadi, oyna esa
         savat yo'qdek ochilaverdi — ya'ni sinov qoidani emas, o'z
         xatosini o'lchagan bo'lardi. */
      localStorage.setItem("ek_cart_TEST_kassir1", JSON.stringify({
        carts: [{ id: 1, items: [{ id: 9, name: "Suv", qty: 1, price: 5000 }] }],
        activeId: 1, savedAt: Date.now(),
      }));
    }
  }, { hasCart: cart, role });

  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 900));
  return { page, errors };
}

const clickSwitch = (page) => page.evaluate(() => {
  const b = document.querySelector(".sb-switch");
  if (!b) return false;
  b.click();
  return true;
});

const typePin = async (page, pin) => {
  for (const d of pin) {
    await page.evaluate((digit) => {
      const b = [...document.querySelectorAll(".pin-key")]
        .find((x) => x.textContent.trim() === digit);
      b?.click();
    }, d);
    await new Promise((r) => setTimeout(r, 60));
  }
};

console.log("\n══ KASSIRNI PIN BILAN ALMASHTIRISH (V99) ══");

/* ══ §1 SAVAT BO'SH BO'LMASA — OYNA OCHILMAYDI ═══════════════════════
   To'lanmagan savat boshqa kassirning ismi bilan yopilsa, chekda ham,
   hisobotda ham noto'g'ri odam turardi. */
console.log("\n§1 Savat bo'sh bo'lmasa almashish yo'q");
{
  pinSent = null;
  const { page } = await open({ cart: true });
  const clicked = await clickSwitch(page);
  is(clicked, "almashtirish tugmasi yon panelda bor");
  await new Promise((r) => setTimeout(r, 500));

  const modal = await page.$(".pin-pad");
  is(!modal, "⚠ savat bo'sh emas — OYNA OCHILMADI");

  const warned = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes("savatni yoping"));
  is(warned, "sabab aytildi — kassir nima qilishni biladi");
  await page.close();
}

/* ══ §2–§3 ALMASHINUV ═════════════════════════════════════════════════ */
console.log("\n§2 Oyna ochiladi va PIN to'lgach o'zi yuboriladi");
{
  pinSent = null;
  const { page, errors } = await open();
  await clickSwitch(page);
  await page.waitForSelector(".pin-pad", { timeout: 8000 }).catch(() => {});
  is(!!(await page.$(".pin-pad")), "PIN oynasi ochildi");

  const dots = await page.$$eval(".pin-dot", (n) => n.length);
  is(dots === 4, "do'kon sozlamasi bo'yicha 4 ta katak", String(dots));

  /* ⚠ SAHIFA ALMASHDIMI. Belgi oynadan OLDIN qo'yiladi: qayta yuklash
     uni o'chirib yuboradi, ya'ni yo'qolgani = sahifa yangilangani. */
  await page.evaluate(() => { window.__alive = "shu-sahifa"; });

  await typePin(page, GOOD_PIN);
  await new Promise((r) => setTimeout(r, 900));

  is(pinSent === GOOD_PIN, "PIN to'lgach O'ZI yuborildi — tasdiq tugmasi kerak emas",
     String(pinSent));

  console.log("\n§3 ⚠ SAHIFA QAYTA YUKLANMAYDI — butun ishning ma'nosi shu");
  const alive = await page.evaluate(() => window.__alive);
  is(alive === "shu-sahifa",
     "⚠ sahifa QAYTA YUKLANMADI — savat, smena, skaner va tarozi joyida qoldi",
     String(alive));

  const name = await page.evaluate(() =>
    document.querySelector(".sb-user-name")?.textContent?.trim() || "");
  is(name.includes("Dilnoza"), "yangi kassirning ismi ekranda", name);

  const stored = await page.evaluate(() => ({
    u: localStorage.getItem("ek_username"),
    t: localStorage.getItem("ek_token"),
  }));
  is(stored.u === "kassir2", "sessiya yangi xodimga o'tdi", stored.u);
  /* ⚠ SAVAT KALITI ISMDAN TUZILADI. Ism yozilmasa yangi kassir
     eskisining savat maydoniga tushardi. */
  is(stored.t === "yangi-token", "yangi token saqlandi", String(stored.t));

  is(errors.length === 0, "JS xatosi yo'q", errors.join(" | "));
  await page.close();
}

/* ══ §4 NOTO'G'RI PIN ══════════════════════════════════════════════════ */
console.log("\n§4 Noto'g'ri PIN");
{
  pinSent = null;
  const { page } = await open();
  await clickSwitch(page);
  await page.waitForSelector(".pin-pad", { timeout: 8000 }).catch(() => {});
  await typePin(page, "1122");
  await new Promise((r) => setTimeout(r, 800));

  const seen = await page.evaluate(() => ({
    err: document.querySelector(".pin-error")?.textContent?.trim() || "",
    filled: document.querySelectorAll(".pin-dot--on").length,
    open: !!document.querySelector(".pin-pad"),
  }));
  is(seen.open, "oyna ochiq qoldi — kassir qayta terishi mumkin");
  is(seen.err.length > 0, "xato ko'rindi", seen.err);
  /* ⚠ MAYDON TOZALANADI. Qolgan raqamlar ustiga terish yarim-yorti
     qiymat yasar, kassir esa sababsiz «yana noto'g'ri» olardi — qulf
     esa har urinishda yaqinlashadi. */
  is(seen.filled === 0, "⚠ maydon TOZALANDI — qolgan raqam ustiga terilmaydi",
     String(seen.filled));
  await page.close();
}

/* ══ §5 SOZLAMALAR: O'Z PIN INI QO'YISH ═══════════════════════════════
   ⚠ IKKI MARTA SO'RALADI. Bir marta terilgan PIN da xato ketsa, xodim
   uni faqat KEYINGI SMENADA — kassada, mijoz oldida — bilib qolardi,
   va o'sha payt tuzatishning yo'li yo'q edi. */
console.log("\n§5 Sozlamalar: o'z PIN ini qo'yish");
{
  pinSet = null;
  const { page } = await open({ path: "/settings", role: "CASHIER" });

  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")]
      .find((x) => /PIN qo'yish/i.test(x.textContent));
    if (!b) return false;
    b.click();
    return true;
  });
  is(opened, "«PIN qo'yish» tugmasi Sozlamalarda bor");
  await page.waitForSelector(".pin-pad", { timeout: 8000 }).catch(() => {});

  /* Birinchi marta — noto'g'ri takror. */
  await typePin(page, "5837");
  await new Promise((r) => setTimeout(r, 300));
  await typePin(page, "1122");
  await new Promise((r) => setTimeout(r, 500));

  const afterMismatch = await page.evaluate(() => ({
    err: document.querySelector(".pin-error")?.textContent?.trim() || "",
    filled: document.querySelectorAll(".pin-dot--on").length,
  }));
  is(afterMismatch.err.length > 0, "takror mos kelmadi — xato aytildi", afterMismatch.err);
  is(pinSet === null, "⚠ mos kelmagan PIN SERVERGA YUBORILMADI", String(pinSet));
  /* ⚠ BOSHIDAN. Faqat ikkinchisini tozalash xodimga birinchisi
     to'g'ri degan ishonch berardi, holbuki xato o'shanda ham
     bo'lishi mumkin. */
  is(afterMismatch.filled === 0, "⚠ ikkala maydon ham tozalandi — boshidan teriladi",
     String(afterMismatch.filled));

  /* Endi to'g'ri — ikki marta bir xil. */
  await typePin(page, "5837");
  await new Promise((r) => setTimeout(r, 300));
  await typePin(page, "5837");
  await new Promise((r) => setTimeout(r, 700));
  is(pinSet === "5837", "ikki marta bir xil terilgach saqlandi", String(pinSet));
  await page.close();
}

/* ══ §6 UZUNLIK: EGAGA KO'RINADI, KASSIRGA YO'Q ═══════════════════════ */
console.log("\n§6 PIN uzunligi — do'kon qarori");
{
  const { page } = await open({ path: "/settings", role: "CASHIER" });
  const seenByCashier = await page.evaluate(() =>
    document.body.innerText.includes("PIN uzunligi"));
  is(!seenByCashier, "⚠ kassir do'kon qarorini o'zgartira olmaydi — tanlov ko'rinmaydi");
  await page.close();
}
{
  lengthSaved = null;
  const { page } = await open({ path: "/settings", role: "OWNER" });
  const seenByOwner = await page.evaluate(() =>
    document.body.innerText.includes("PIN uzunligi"));
  is(seenByOwner, "egasida uzunlik tanlovi bor");
  await page.close();
}

/* ══ §7 ⚠ UZUNLIK EKRANGA YETIB BORADI ════════════════════════════════
   6 xonali do'konda to'rtta katak chizilsa, PIN hech qachon to'lmasdi
   va kassir «almashtirish ishlamayapti» degan xulosaga kelardi. */
console.log("\n§7 ⚠ 6 xonali do'konda 6 ta katak");
{
  SHOP_PIN_LENGTH = 6;
  const { page } = await open({ path: "/settings", role: "OWNER" });
  await new Promise((r) => setTimeout(r, 600));
  /* Profil olingach `ek_pinLength` yangilanadi — endi Kassaga o'tamiz. */
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 800));
  await clickSwitch(page);
  await page.waitForSelector(".pin-pad", { timeout: 8000 }).catch(() => {});
  const dots = await page.$$eval(".pin-dot", (n) => n.length);
  is(dots === 6, "⚠ do'kon 6 tanlaganda oynada 6 ta katak", String(dots));
  await page.close();
  SHOP_PIN_LENGTH = 4;
}

await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ PIN almashinuvi: hammasi joyida"
                      : `\n❌ ${bad} ta muammo`);
process.exit(bad === 0 ? 0 : 1);
