/* ══════════════════════════════════════════════════════════════════════════
   TAROZI: HAQIQIY BAYTLAR EKRANDA OG'IRLIK BO'LADIMI (V111)

   ═══ NEGA AYNAN SHU SINOV ══════════════════════════════════════════════

   `test/scale.test.mjs` sof mantiqni tekshiradi va u o'tib turgan
   holda ham ekranda «—» turishi mumkin: port qatlami, holat va
   chizish oralig'ida uzilish bo'lsa, sinovlar buni KO'RMAYDI.

   Do'kon aynan shunday holatga tushdi — baytlar kelayotgan bo'lsa-da,
   og'irlik maydonida tire turgan edi. Shuning uchun bu yerda YO'LNING
   HAMMASI tekshiriladi: soxta port haqiqiy tarozining baytlarini
   beradi va panelda 0.488 kg chiqishi kutiladi.

   ⚠ Baytlar O'YLAB TOPILMAGAN — do'konning M-ER 328AC sidan olingan:

       06 01 02 53 20 30 30 2E 34 38 38 6B 67 65 03 04
       ACK SOH STX «S» « » «00.488» «kg» «e» ETX EOT

   Ishga tushirish:  node scripts/check-scale.mjs
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
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const pageErrors = [];

/** Haqiqiy tarozidan olingan ramka. */
const FRAME = [0x06, 0x01, 0x02, 0x53, 0x20, 0x30, 0x30, 0x2e,
               0x34, 0x38, 0x38, 0x6b, 0x67, 0x65, 0x03, 0x04];

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
  const p = new URL(r.url()).pathname;
  /* Tarozi bo'limi FAQAT «SCALE» moduli yoqilganda chiziladi. */
  const body = /\/shop\/features$/.test(p)
    ? { success: true, data: { features: ["SCALE"], directions: [], unconfigured: false } }
    : { success: true, data: {} };
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify(body) });
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });

/* ⚠ SOXTA PORT. Brauzerda haqiqiy tarozi yo'q, lekin YO'LNING QOLGAN
   HAMMASI haqiqiy: o'qish halqasi, ramkalarga bo'lish, og'irlikni
   ajratish va chizish. */
await page.evaluateOnNewDocument((frame) => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);

  const bytes = new Uint8Array(frame);
  const port = {
    open: async () => {},
    close: async () => {},
    setSignals: async () => {},
    writable: { getWriter: () => ({ write: async () => {}, releaseLock: () => {} }) },
    readable: new ReadableStream({
      start(c) {
        /* Tarozi uzluksiz yuboradi — halqa ham shunday kutadi. */
        const id = setInterval(() => { try { c.enqueue(bytes); } catch (_) { clearInterval(id); } }, 120);
      },
    }),
  };
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: { requestPort: async () => port, getPorts: async () => [port] },
  });
}, FRAME);

await page.goto(`http://127.0.0.1:${PORT}/settings`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));

console.log("\n══ TAROZI (V111) ══");

console.log("\n§1 Bo'lim chizildi");
const hasPanel = await page.evaluate(() =>
  /jonli tarozi/i.test(document.body.innerText));
hasPanel ? ok("«Jonli tarozi» bo'limi bor") : no("bo'lim chizilishi kerak", "yo'q");

console.log("\n§2 Ulanish");
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")]
    .find((x) => /tarozini ulash/i.test(x.textContent));
  if (!b) return false;
  b.click();
  return true;
});
clicked ? ok("«Tarozini ulash» bosildi") : no("tugma topilmadi", "yo'q");
await new Promise((r) => setTimeout(r, 1200));

const view = await page.evaluate(() => {
  const txt = document.body.innerText;
  const m = txt.match(/([\d.,]+)\s*kg/i);
  return {
    weight: m ? m[1] : null,
    steady: /barqaror/i.test(txt),
    dash: /—\s*$/m.test(txt),
    hex: /06\s+01\s+02/.test(txt),
  };
});

console.log("\n§3 ⚠ OG'IRLIK EKRANDA");
/* Do'kon aynan shu joyda «—» ko'rgan edi. */
view.weight === "0.488"
  ? ok(`og'irlik chizildi: ${view.weight} kg`)
  : no("0.488 kg chizilishi kerak", view.weight ?? "tire");

console.log("\n§4 Tarozining O'Z barqarorlik belgisi");
/* Ramkadagi «S» — barqaror. Uni o'qimasak, kassir to'rt o'lchov
   kutishga majbur bo'lardi. */
view.steady ? ok("«barqaror» deb belgilandi")
            : no("«S» bayrog'i o'qilishi kerak", "belgilanmadi");

console.log("\n§5 HEX ko'rinish");
view.hex ? ok("xom baytlar HEX bo'lib chiqdi") : no("HEX chizilishi kerak", "yo'q");

console.log("\n§6 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Tarozi: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
