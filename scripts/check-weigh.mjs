/* ══════════════════════════════════════════════════════════════════════════
   TAROZILI TOVAR KASSADA — STIKER SKANERLANGANDA (2026-10-06)

   Egasi: «og'irliksiz ham stiker chiqara olsin — uni skanerlaganda taroziga
   mahsulot qo'yish so'ralsin» va «og'irligini oldindan tortib, shtrix kodli
   stiker yopishtirsin — kassada skanerlab sotsin».

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════
   §1 Og'irliksiz stiker (oddiy kod), tarozi ULANGAN: miqdor oynasi ochiladi
      va og'irlik tarozidan O'ZI yoziladi — kassir faqat Enter bosadi.
      ⚠ Ilgari kg li tovar jimgina 1 kg bo'lib savatga tushardi.
   §2 Og'irlikli stiker (EAN-13): oynasiz, og'irligi bilan savatga.
   §3 Tarozi ULANMAGAN: oyna ochiladi, og'irlik qo'lda — maydon bo'sh,
      jimgina hech narsa qo'yilmaydi.

   Tarozi soxta, lekin baytlari do'konning M-ER 328AC sidan (`check-scale.mjs`).

   Ishga tushirish:  node scripts/check-weigh.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4629;
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

const MEAT = { id: 1, name: "Pista", salePrice: 90000, unit: "KG", unitDecimals: 3, stockQuantity: 20 };
/** Do'konning M-ER 328AC tarozisidan: 0.488 kg. */
const FRAME = [0x06, 0x01, 0x02, 0x53, 0x20, 0x30, 0x30, 0x2e,
               0x34, 0x38, 0x38, 0x6b, 0x67, 0x65, 0x03, 0x04];

async function openKassa({ scale }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = {
      "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": r.headers()["access-control-request-headers"] || "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const u = new URL(r.url());
    if (process.env.DEBUG && /scan|products/.test(u.pathname)) console.log("    so'rov:", u.pathname + u.search);
    let data = [];
    if (u.pathname.endsWith("/products/scan")) {
      const code = u.searchParams.get("code");
      data = code === "2000010003501"
        ? { source: "WEIGHT", quantity: 0.35, product: MEAT }
        : { source: "PRODUCT", product: MEAT };
    } else if (u.pathname.endsWith("/shop/profile")) {
      data = { creditEnabled: false, bonusMaxPercent: 0 };
    }
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument((frame, withScale) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    /* Har bo'lim toza savat bilan — oldingi bo'limning savati xotirada qolmasin. */
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_cart")) localStorage.removeItem(k);
    if (!withScale) { localStorage.removeItem("ek_scale_port"); return; }
    localStorage.setItem("ek_scale_port", JSON.stringify({ enabled: true, poll: "ENQ_DC1", baudRate: 9600, id: "1659:8963" }));
    const bytes = new Uint8Array(frame);
    const port = {
      open: async () => {}, close: async () => {}, setSignals: async () => {}, forget: async () => {},
      getInfo: () => ({ usbVendorId: 1659, usbProductId: 8963 }),
      writable: { getWriter: () => ({ write: async () => {}, releaseLock: () => {} }) },
      readable: new ReadableStream({
        start(c) { const id = setInterval(() => { try { c.enqueue(bytes); } catch (_) { clearInterval(id); } }, 120); },
      }),
    };
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort: async () => port, getPorts: async () => [port],
               addEventListener: () => {}, removeEventListener: () => {} },
    });
  }, FRAME, scale);
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector("input[data-scanner='true']", { timeout: 10_000 });
  return page;
}

const waitFor = async (page, fn, ms = 5000) => {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 60));
  }
};
/* Skaner — `check-cart.mjs` dagidek: fokus maydonda EMAS, kodlar tez ketma-ket
   (kassa skanerni global ushlaydi; maydonga yozilsa boshi qidiruvga ketardi). */
const scan = async (page, code) => {
  await page.keyboard.press("Shift");
  await new Promise((r) => setTimeout(r, 150));
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
};
const cartQty = (page) => page.$eval(".qty-num--edit", (e) => e.textContent.trim()).catch(() => null);

console.log("\n══ TAROZILI TOVAR KASSADA (2026-10-06) ══\n");

console.log("§1 Og'irliksiz stiker, tarozi ulangan");
{
  const page = await openKassa({ scale: true });
  await new Promise((r) => setTimeout(r, 1200));   // tarozi ulanib, barqarorlashsin
  await scan(page, "20000017");
  const opened = await waitFor(page, () => !!document.querySelector(".qty-modal"));
  opened ? ok("miqdor oynasi ochildi (jimgina 1 kg qo'shilmadi)") : no("oyna ochilmadi", await cartQty(page));
  const filled = await waitFor(page, () => /488/.test(document.querySelector(".qty-modal__input")?.value || ""));
  filled ? ok("og'irlik tarozidan O'ZI yozildi: 0.488")
         : no("og'irlik yozilmadi", await page.$eval(".qty-modal__input", (e) => e.value).catch(() => "—"));
  await page.keyboard.press("Enter");
  await waitFor(page, () => !document.querySelector(".qty-modal"));
  const q = await cartQty(page);
  q === "0,488" ? ok("Enter — savatda 0,488 kg") : no("savatga boshqa son tushdi", q);
  await page.close();
}

console.log("\n§2 Og'irlikli stiker (EAN-13)");
{
  const page = await openKassa({ scale: false });
  await scan(page, "2000010003501");
  await waitFor(page, () => /0,350/.test(document.querySelector(".qty-num--edit")?.textContent || ""));
  const modal = await page.$(".qty-modal");
  !modal ? ok("oynasiz") : no("keraksiz oyna ochildi", "qty-modal");
  const q = await cartQty(page);
  q === "0,350" ? ok("savatda 0,350 kg — stikerdagi og'irlik") : no("savatda boshqa son", q);
  await page.close();
}

console.log("\n§3 Og'irliksiz stiker, tarozi YO'Q");
{
  const page = await openKassa({ scale: false });
  await scan(page, "20000017");
  const opened = await waitFor(page, () => !!document.querySelector(".qty-modal"));
  opened ? ok("oyna ochildi — og'irlik qo'lda kiritiladi") : no("oyna ochilmadi", await cartQty(page));
  const v = await page.$eval(".qty-modal__input", (e) => e.value).catch(() => "—");
  v === "" ? ok("maydon bo'sh — hech narsa jimgina qo'yilmadi") : no("maydonda qiymat bor", v);
  const asks = await page.$(".qty-modal__ask");
  !asks ? ok("tarozi yo'q — «taroziga qo'ying» so'ralmaydi") : no("tarozi yo'q bo'lsa ham so'radi", "qty-modal__ask");
  await page.close();
}

pageErrors.length === 0 ? ok("sahifada JS xatosi yo'q") : no("JS xatosi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(bad === 0 ? "\n  ✅ HAMMASI O'TDI" : `\n  ❌ ${bad} ta muammo`);
process.exit(bad === 0 ? 0 : 1);
