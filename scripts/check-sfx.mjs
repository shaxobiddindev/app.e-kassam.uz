/* ══════════════════════════════════════════════════════════════════════════
   OVOZLI BILDIRISHNOMA — BRAUZER TEKSHIRUVI (V89)

   ⚠ NIMA TEKSHIRILADI VA NIMA TEKSHIRILMAYDI. Headless Chromium'da
   HAQIQIY OVOZ QURILMASI YO'Q — «eshitib» tekshirib bo'lmaydi va
   bunday da'vo yolg'on bo'lardi. Bu yerda tekshiriladigan narsa
   boshqacha va ancha muhimroq:

     1. Ovoz qatlami sahifani YIQITMAYDI. Bu asosiy xavf: modul
        ilovaning ENG QIZG'IN yo'liga (`useToast` — 138 chaqiruv) va
        sotuv yakuniga ulangan. U yerdagi bitta istisno kassani
        butunlay to'xtatardi (V58 pretsedenti).
     2. `AudioContext` HAQIQATAN yaratiladi va imo-ishoradan keyin
        ochiladi (autoplay qulfi).
     3. Ohang HAQIQATAN yuboriladi: `OscillatorNode` yaratilishi
        sanaladi — ya'ni «chalindi» degan gap tekshiriladigan faktga
        aylanadi.
     4. Sozlama bo'limi chizilади va sozlama SAQLANADI.

   Ishga tushirish:  node scripts/check-sfx.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4603;
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
  /* ⚠ `--autoplay-policy=no-user-gesture-required` ATAYLAB QO'YILMAYDI:
     u aynan biz tekshirmoqchi bo'lgan qulfni o'chirib qo'yardi. */
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--no-proxy-server"],
});

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const errors = [];

const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
});

async function open(route, seed) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const body = r.url().includes("/shop/profile")
      ? { success: true, data: { creditEnabled: true, creditDueDays: 30, bonusMaxPercent: 0 } }
      : { success: true, data: [] };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => errors.push(`${route}: ${e.message}`));

  /* ⚠ `OscillatorNode` NI SANAYMIZ. Ovozni eshitib bo'lmaydi, lekin
     uning YARATILGANINI aniq bilish mumkin — va aynan shu «chalindi»
     degan da'voni tekshiriladigan faktga aylantiradi. */
  await page.evaluateOnNewDocument((s) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    if (s) localStorage.setItem("ek_hw", s);

    window.__sfx = { osc: 0, ctx: 0 };
    const AC = window.AudioContext;
    window.AudioContext = function (...a) {
      window.__sfx.ctx++;
      const c = new AC(...a);
      const orig = c.createOscillator.bind(c);
      c.createOscillator = () => { window.__sfx.osc++; return orig(); };
      window.__sfx.state = () => c.state;
      return c;
    };
  }, seed || null);

  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));
  return page;
}

/* ══ 1. SOZLAMA BO'LIMI ═══════════════════════════════════════════════ */
console.log("\n── 1. Sozlama bo'limi ──");
{
  const pg = await open("/settings");
  const v = await pg.evaluate(() => {
    const card = [...document.querySelectorAll(".set-card")]
      .find((c) => /Ovozli bildirishnoma/i.test(c.textContent));
    return {
      found: !!card,
      switches: card ? card.querySelectorAll('[role="switch"]').length : 0,
      range: card ? card.querySelectorAll('input[type="range"]').length : 0,
      play: card ? card.querySelectorAll("button .fa-play").length : 0,
    };
  });
  v.found ? ok("«Ovozli bildirishnoma» bo'limi chizildi") : no("bo'lim bo'lishi kerak", "yo'q");
  /* Umumiy kalit + to'qqizta voqea = o'nta kalit. */
  v.switches === 10 ? ok(`o'nta kalit (umumiy + 9 voqea)`) : no("o'nta kalit kerak", v.switches);
  v.range === 1 ? ok("balandlik slayderi bor") : no("slayder kerak", v.range);
  /* ⚠ «Eshitib ko'rish» MAJBURIY: ovoz jimgina yo'qolishi mumkin va
     usiz egasi nosozlikni umuman aniqlay olmasdi. */
  v.play === 9 ? ok("har voqeada «eshitib ko'rish» tugmasi") : no("to'qqizta tugma kerak", v.play);

  /* Sozlama SAQLANADIMI — qurilma sozlamasi, serverga ketmaydi. */
  await pg.evaluate(() => {
    const card = [...document.querySelectorAll(".set-card")]
      .find((c) => /Ovozli bildirishnoma/i.test(c.textContent));
    card.querySelectorAll('[role="switch"]')[1]?.click();   // birinchi voqea kaliti
  });
  await new Promise((r) => setTimeout(r, 300));
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem("ek_hw") || "{}"));
  saved?.sound && typeof saved.sound.events === "object"
    ? ok(`sozlama saqlandi: ${JSON.stringify(saved.sound.events)}`)
    : no("`ek_hw.sound.events` yozilishi kerak", JSON.stringify(saved?.sound));
  /* ⚠ «ESHITIB KO'RISH» — YAGONA YO'L, chunki ovoz jimgina yo'qolishi
     mumkin (brauzer rad etdi, karnay o'chiq). U CHEGARALARNI ham
     chetlab o'tishi kerak: o'chirilgan voqeani ham eshittira olsin,
     aks holda «nega jim?» degan savolga javob bo'lmasdi. */
  await pg.evaluate(() => {
    const card = [...document.querySelectorAll(".set-card")]
      .find((c) => /Ovozli bildirishnoma/i.test(c.textContent));
    card.querySelector("button .fa-play")?.closest("button")?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const c = await pg.evaluate(() => window.__sfx);
  c.osc > 0 ? ok(`«eshitib ko'rish» ohang chaldi (${c.osc} nota)`)
            : no("tugma ohang chalishi kerak", c.osc);
  await pg.close();
}

/* ══ 2. AUTOPLAY QULFI ════════════════════════════════════════════════ */
console.log("\n── 2. Autoplay qulfi ──");
{
  const pg = await open("/sale");
  /* ⚠ Brauzer `AudioContext` ni imo-ishoragacha `suspended` tutadi.
     Birinchi ovoz aynan shu sababdan jimgina yo'qolardi. */
  await pg.mouse.click(700, 400);
  await new Promise((r) => setTimeout(r, 400));
  const st = await pg.evaluate(() => ({ ctx: window.__sfx.ctx, state: window.__sfx.state?.() }));
  st.ctx > 0 ? ok("imo-ishoradan keyin `AudioContext` yaratildi") : no("yaratilishi kerak", st.ctx);
  st.state === "running" ? ok("kontekst OCHIQ — birinchi ovoz yo'qolmaydi")
                         : no("`running` bo'lishi kerak", st.state);
  await pg.close();
}

/* ══ 3. OVOZ SAHIFANI YIQITMAYDI ══════════════════════════════════════ */
console.log("\n── 3. Ovoz qatlami sahifani yiqitmaydi ──");
{
  /* Eng qizg'in yo'l: `toast` orqali ketma-ket o'nlab voqea. Modul
     shu yerda yiqilsa, kassa butunlay to'xtardi. */
  const pg = await open("/sale", JSON.stringify({ sound: { on: true, volume: 1, events: {
    ERROR: true, OK: true, INFO: true, CART_ADD: true } } }));
  const before = errors.length;
  /* Qulfni ochamiz — usiz brauzer hech narsa chalmaydi. */
  await pg.mouse.click(700, 400);
  await new Promise((r) => setTimeout(r, 300));

  /* ⚠ HAQIQIY YO'L: skaner topmagan barkod. `useScanner` tez terilgan
     raqamlarni va Enter'ni skaner deb tanidi → `SCAN_MISS` + toast.
     Sun'iy `keydown` lar hech narsani ishga tushirmasdi va sinov
     o'zini o'zi aldardi. */
  const scan = async (code) => {
    for (const ch of code) await pg.keyboard.press(ch, { delay: 5 });
    await pg.keyboard.press("Enter");
  };

  const base = await pg.evaluate(() => window.__sfx.osc);
  await scan("4780000000001");
  await new Promise((r) => setTimeout(r, 500));
  const one = await pg.evaluate(() => window.__sfx.osc);
  one > base ? ok(`topilmagan barkod ohang chaldi (${one - base} nota)`)
             : no("`SCAN_MISS` chalinishi kerak", one - base);

  /* ⚠ SHOVQIN CHEGARASI: ketma-ket beshta skanerlash beshta
     chiyillashga aylanmasligi kerak — 400 ms oyna ishlashi shart. */
  const t0 = await pg.evaluate(() => window.__sfx.osc);
  for (let i = 0; i < 5; i++) await scan("478000000000" + i);
  await new Promise((r) => setTimeout(r, 500));
  const burst = (await pg.evaluate(() => window.__sfx.osc)) - t0;
  const perTone = one - base;                       // bitta ohangdagi nota soni
  burst < perTone * 5
    ? ok(`ketma-ket beshta skanerlash chegaralandi (${burst} nota, ${perTone * 5} o'rniga)`)
    : no("oyna ishlashi kerak", burst);

  errors.length === before ? ok("skanerlash oqimida birorta JS xatosi tushmadi")
                           : no("xato tushdi", errors.slice(before).join(" | "));
  await pg.close();
}

/* ══ 4. OVOZSIZ MUHIT ═════════════════════════════════════════════════ */
console.log("\n── 4. `AudioContext` umuman yo'q bo'lsa ──");
{
  const pg = await browser.newPage();
  await pg.setRequestInterception(true);
  pg.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify({ success: true, data: [] }) });
  });
  const local = [];
  pg.on("pageerror", (e) => local.push(e.message));
  await pg.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    /* Eski WebView'da `AudioContext` bo'lmasligi mumkin. */
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });
  await pg.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await pg.mouse.click(700, 400);
  await new Promise((r) => setTimeout(r, 700));
  const alive = await pg.evaluate(() => !!document.querySelector("#root")?.children.length);
  local.length === 0 ? ok("ovozsiz muhitda ham xato tushmadi") : no("xato tushdi", local.join(" | "));
  alive ? ok("sahifa ishlayveradi — ovoz shunchaki yo'q") : no("sahifa chizilishi kerak", "bo'sh");
  await pg.close();
}

await browser.close();
server.close();

if (errors.length) {
  bad += errors.length;
  console.log("\n  ❌ Sahifada JS xatolari tushdi:");
  for (const e of [...new Set(errors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tushmadi");
}
console.log(bad ? `\n  ${bad} ta xato — ovoz qatlami buzilgan.\n` : "\n  ✅ Ovoz: hammasi o'tdi\n");
process.exit(bad ? 1 : 0);
