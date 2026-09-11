/* ══════════════════════════════════════════════════════════════════════════
   ARALASH TO'LOV — HAMMA TO'LOV OYNASIDA (V96)

   Do'kon egasi: «butun tizimda to'lov qilinadigan hamma oynada
   kassadagiday aralash to'lov tizimi bo'lishi kerak».

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Ekranda to'g'ri ko'rinishi YETMAYDI. Eng muhimi — SERVERGA AYNAN
   NIMA KETGANI: qismlar yuborilmasa, tizim eskicha bitta usul bilan
   ishlab, kassir esa ikkitasini yozganini o'ylab qolardi. Shuning
   uchun bu yerda so'rov TANASI ushlanadi va o'qiladi.

   ⚠ Kassa (`/sale`) bu yerda tekshirilmaydi — uning o'z tekshiruvi
   bor (`check-pay.mjs`) va u aralash to'lovni V53 dan beri qiladi.

   Ishga tushirish:  node scripts/check-mixed.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4607;
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

const CUSTOMER = {
  id: 7, fullName: "Vali Aliyev", phone: "+998901234567",
  balance: 500000, savingsBalance: 120000, bonusBalance: 0, totalSpent: 0,
};
const SUPPLIER = { id: 3, name: "Omad Savdo", phone: "+998901112233", balance: 800000 };

/** Yuborilgan so'rov tanalari — `{ url, body }`. */
const sent = [];

async function open(route, { extra = {} } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const p = new URL(r.url()).pathname;
    /* ⚠ TANA SAQLANADI — butun tekshiruv shunga tayanadi. */
    if (r.method() === "POST") {
      try { sent.push({ url: p, body: JSON.parse(r.postData() || "{}") }); }
      catch { sent.push({ url: p, body: null }); }
    }
    let data = [];
    if (/\/customers$/.test(p)) data = [CUSTOMER];
    else if (/\/suppliers$/.test(p)) data = [SUPPLIER];
    else if (/\/ledger/.test(p)) data = [];
    else if (/\/savings/.test(p)) data = { balance: 120000, entries: [] };
    else if (/\/shop\/profile/.test(p)) data = { name: "Sinov", phone: null };
    for (const [re, v] of Object.entries(extra)) {
      if (new RegExp(re).test(p)) data = v;
    }
    /* To'lov javobi — kvitansiyasiz: chek chiqarish bu yerda
       tekshirilmaydi va u alohida tekshiruvda bor. */
    if (r.method() === "POST") data = { balanceAfter: 0, balance: 0, receipt: null };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => pageErrors.push(`${route}: ${e.message}`));
  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
  });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));
  return page;
}

/**
 * Elementni KUTADI, qat'iy `sleep` bilan emas.
 *
 * ⚠ Birinchi urinishda qat'iy kutishlar ishlatilgan edi va tekshiruv
 * BEQAROR chiqdi: bir yugurishda oyna ochilar, ikkinchisida —
 * ochilmasdi. Ro'yxat serverdan kelguncha tugma hali chizilmagan
 * bo'ladi va uni bosish hech narsa qilmaydi. Beqaror tekshiruv esa
 * eng yomoni: u nosozlikni ham, o'zining sekinligini ham bir xil
 * ko'rsatadi.
 */
async function waitFor(pg, sel, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await pg.$(sel)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Tugmani KO'RINGUNCHA kutib bosadi. */
async function clickWhenReady(pg, sel, ms = 6000) {
  if (!(await waitFor(pg, sel, ms))) return false;
  await pg.evaluate((s) => document.querySelector(s)?.click(), sel);
  return true;
}

/**
 * Matni bo'yicha tugmani kutib bosadi (ilova, tab, footer tugmasi).
 *
 * ⚠ `root` KERAK BO'LDI: ta'minotchi sahifasida QATORDAGI tugma ham,
 * oynadagi YUBORISH tugmasi ham bir xil matnli («Qarzni to'lash»).
 * Matn bo'yicha qidiruv birinchisini — oyna ORQASIDAGI qatorni —
 * bosar va so'rov umuman yuborilmasdi. Farqi uslubida: qator
 * `btn-outline`, yuborish esa `btn-primary`.
 */
async function clickByText(pg, source, ms = 6000, root = "button") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = await pg.evaluate((src, root) => {
      const re = new RegExp(src, "i");
      const b = [...document.querySelectorAll(root)]
        .find((x) => re.test(x.textContent || "") && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    }, source, root);
    if (hit) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Usulni bosadi va summa yozadi — HAQIQIY sichqoncha bilan. */
async function put(pg, name, value, inputId) {
  const box = await pg.evaluate((n) => {
    const b = [...document.querySelectorAll(".pay-type-btn")].find((x) => x.textContent.includes(n));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, name);
  if (!box) return false;
  await pg.mouse.click(box.x, box.y);
  await new Promise((r) => setTimeout(r, 200));
  await pg.evaluate((id, v) => {
    const el = document.getElementById(id);
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
  }, inputId, value);
  await new Promise((r) => setTimeout(r, 250));
  return true;
}

const summary = (pg) => pg.evaluate(() => ({
  rows: [...document.querySelectorAll(".pay-sum__row")].map((r) => ({
    name: r.querySelector(".pay-sum__name")?.textContent.trim(),
    val: Number(r.querySelector("b")?.textContent.replace(/\D/g, "") || 0),
    taken: r.classList.contains("pay-sum__row--taken"),
  })),
  focus: document.activeElement?.id || null,
  buttons: [...document.querySelectorAll(".pay-type-btn")]
    .map((b) => b.querySelector(".pay-type-label")?.textContent.trim()),
}));

/* ══ 1. QARZ TO'LASH ══════════════════════════════════════════════════ */
console.log("\n── 1. Qarz to'lash — aralash ──");
{
  const pg = await open("/customers");
  /* ⚠ IKKI QADAM. Qatordagi tugma avval QARZ TARIXI oynasini ochadi;
     to'lov oynasi esa uning ichidagi «To'lash» tugmasidan keyin
     chiqadi. Birinchi urinishda bu o'tkazib yuborilgan va tekshiruv
     «oyna ochilmadi» deb yolg'on ayblov qo'ygan edi.

     ⚠ Tugma MATNSIZ (faqat ikonka) — `title` bo'yicha topiladi. */
  const opened = await clickWhenReady(pg, 'button[title="Qarzni to\'lash"]')
              && await clickByText(pg, "To'lash");
  const ready = opened && await waitFor(pg, "#debt-amount");
  if (!ready) {
    no("qarz to'lash oynasi ochilmadi", opened ? "maydon chizilmadi" : "tugma topilmadi");
  } else {
    const before = await summary(pg);
    before.buttons.length === 4
      ? ok(`to'rtta usul: ${before.buttons.join(" · ")}`)
      : no("to'rtta usul bo'lishi kerak", JSON.stringify(before.buttons));

    await put(pg, "Naqd", "200000", "debt-amount");
    const f1 = await pg.evaluate(() => document.activeElement?.id);
    f1 === "debt-amount" ? ok("usul bosilganda kursor summa maydonida")
                         : no("kursor summa maydonida bo'lishi kerak", f1);

    await put(pg, "Karta", "300000", "debt-amount");
    const s = await summary(pg);
    const methodRows = s.rows.filter((r) => !r.taken);
    methodRows.length === 2 ? ok(`hisobda ikkala usul: ${methodRows.map((r) => r.val).join(" + ")}`)
                            : no("ikkita qator bo'lishi kerak", JSON.stringify(s.rows));
    const taken = s.rows.find((r) => r.taken);
    taken?.val === 500000 ? ok("«Mijozdan jami» — 500 000")
                          : no("jami 500 000 bo'lishi kerak", taken?.val);

    /* ⚠⚠ ENG MUHIMI: qismlar SERVERGA ketdimi. */
    sent.length = 0;
    await pg.evaluate(() => [...document.querySelectorAll(".pay-modal-footer button")]
      .find((b) => !b.disabled && !/Yopish|Bekor/i.test(b.textContent))?.click());
    await new Promise((r) => setTimeout(r, 1000));
    const req = sent.find((x) => /debt|pay/i.test(x.url));
    if (!req) no("to'lov so'rovi yuborilmadi", JSON.stringify(sent.map((x) => x.url)));
    else {
      const p = req.body?.payments;
      Array.isArray(p) && p.length === 2
        ? ok(`serverga QISMLAR ketdi: ${p.map((x) => `${x.type} ${x.amount}`).join(" + ")}`)
        : no("`payments` ikkita qism bilan ketishi kerak", JSON.stringify(req.body?.payments));
      Number(req.body?.amount) === 500000
        ? ok("`amount` — qismlar yig'indisi (server ikkalasini solishtiradi)")
        : no("amount 500 000 bo'lishi kerak", req.body?.amount);
      /* ⚠ Eski maydon HAM ketadi — server yangilanmagan bo'lsa yoki
         oflayn navbatdagi so'rov eski serverga tushsa. */
      req.body?.method === "MIXED"
        ? ok("eski `method` maydoni ham ketdi (MIXED)")
        : no("`method` yuborilishi kerak", req.body?.method);
    }
  }
  await pg.close();
}

/* ══ 2. TA'MINOTCHIGA TO'LOV ══════════════════════════════════════════ */
console.log("\n── 2. Ta'minotchiga to'lov — aralash ──");
{
  const pg = await open("/supply");
  /* ⚠ Yetkazib beruvchilar ALOHIDA ILOVADA (tab): sahifa kirim
     hujjatlari bilan ochiladi. */
  /* ⚠ Bu tugma MATNLI («Qarzni to'lash»), mijozlar sahifasidagisi esa
     `title` li ikonka — bir xil vazifa, ikki xil belgi. Shu sababdan
     `title` bo'yicha qidirish bu yerda ishlamasdi. */
  const opened = await clickByText(pg, "Yetkazib beruvchilar")
              && await clickByText(pg, "Qarzni to'lash");
  const ready = opened && await waitFor(pg, "#supplier-pay-amount");
  if (!ready) {
    no("ta'minotchiga to'lov oynasi ochilmadi", opened ? "maydon chizilmadi" : "tugma topilmadi");
  } else {
    const s0 = await summary(pg);
    /* ⚠ ILGARI FAQAT IKKITA USUL BOR EDI (naqd, karta) — Click/Payme
       orqali o'tkazish oddiy hol bo'lsa ham ro'yxatda yo'q edi. */
    s0.buttons.length === 4
      ? ok(`to'rtta usul (ilgari ikkita edi): ${s0.buttons.join(" · ")}`)
      : no("to'rtta usul bo'lishi kerak", JSON.stringify(s0.buttons));

    await put(pg, "Naqd", "300000", "supplier-pay-amount");
    await put(pg, "Click", "200000", "supplier-pay-amount");
    const s = await summary(pg);
    const taken = s.rows.find((r) => r.taken);
    taken?.val === 500000 ? ok("jami 500 000") : no("jami 500 000 bo'lishi kerak", taken?.val);

    sent.length = 0;
    await clickByText(pg, "To'lash", 3000, "button.btn-primary");
    await new Promise((r) => setTimeout(r, 1000));
    const req = sent.find((x) => /pay/i.test(x.url));
    if (!req) no("to'lov so'rovi yuborilmadi", JSON.stringify(sent.map((x) => x.url)));
    else {
      const p = req.body?.payments;
      Array.isArray(p) && p.length === 2
        ? ok(`serverga QISMLAR ketdi: ${p.map((x) => `${x.type} ${x.amount}`).join(" + ")}`)
        : no("`payments` ikkita qism bilan ketishi kerak", JSON.stringify(p));
    }
  }
  await pg.close();
}

await browser.close();
server.close();

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tushdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tushmadi");
}
console.log(bad ? `\n  ${bad} ta xato — aralash to'lov buzilgan.\n`
                : "\n  ✅ Aralash to'lov: hammasi o'tdi\n");
process.exit(bad ? 1 : 0);
