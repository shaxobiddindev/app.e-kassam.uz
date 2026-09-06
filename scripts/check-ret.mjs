/* ══════════════════════════════════════════════════════════════════════════
   QAYTARISH OYNASI — BROUZERDA TEKSHIRUV (V80)

   ═══ NEGA ALOHIDA TEKSHIRUV ════════════════════════════════════════════

   Qaytarish — kassadan PUL CHIQADIGAN amal va shu paytgacha uning
   brouzerdagi tekshiruvi umuman yo'q edi. Ekranda esa uchta qat'iy
   shart bor va uchalasi ham pul bilan bog'liq.

   1. SUMMA TUGMANI BOSISHDAN OLDIN KO'RINADI. Ilgari kassir uni
      faqat qaytarish bajarilgandan keyin bilardi: chegirma bilan
      sotilgan chekda u mijozga e'lon narxini aytib qo'yib, keyin
      kamroq pul berardi.

   2. SUMMA SERVERDAGI QOIDA BILAN BIR XIL hisoblanadi
      (`ek-refund.js` → `RefundAllocation.java`). Ikkalasi ajralsa,
      kassir aytgan raqam bilan kassadan chiqadigan pul boshqa
      bo'lardi.

   3. TIZIM SUMMANI O'ZI O'ZGARTIRMAYDI. Yaxlitlash faqat TAKLIF
      bo'lib chiqadi va uni kassir alohida tugma bilan qo'llaydi.
      Jimgina yaxlitlangan qaytarish — mijozning chekidagi raqamdan
      chetga chiqish.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-ret.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4616;
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

const pageErrors = [];
/** Qaytarish so'rovining tanasi — serverga NIMA ketgani shu yerda tutiladi. */
let sentBody = null;

/* ⚠ CHEK CHEGIRMA BILAN. Aynan shu holat eski hisobni sindirardi:
   10 000 uchtaga bo'linmaydi va har qaytarishda bir tiyin
   yo'qolardi (3 333.33 × 3 = 9 999.99). */
const SALE = {
  id: 501, type: "SALE", status: "PAID", paymentType: "CASH",
  subtotalAmount: 15000, discountAmount: 5000, totalAmount: 10000,
  cashierName: "V", customerName: null, createdAt: new Date().toISOString(),
  payments: [{ type: "CASH", amount: 10000 }],
  items: [{
    id: 9001, productId: 1, productName: "Kurtka", quantity: 3,
    price: 5000, subtotal: 15000, unit: "DONA",
    discountAmount: 5000, returnedQuantity: 0,
    refundUnitAmount: 3333.33, refundableAmount: 10000,
  }],
};

async function open() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const p = new URL(r.url()).pathname;
    if (/\/sales\/\d+\/return$/.test(p) && r.method() === "POST") {
      sentBody = JSON.parse(r.postData() || "{}");
      return r.respond({ status: 200, contentType: "application/json",
                         headers: CORS, body: JSON.stringify({ success: true, data: SALE }) });
    }
    const body = /\/sales$/.test(p) ? { success: true, data: [SALE] }
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
  });
  await page.goto(`http://127.0.0.1:${PORT}/sales`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));
  /* Qaytarish tugmasi — qatordagi «rotate-left» ikonkasi. */
  await page.evaluate(() => [...document.querySelectorAll("td .btn-icon")]
    .find((b) => b.querySelector(".fa-rotate-left"))?.click());
  await new Promise((r) => setTimeout(r, 600));
  return page;
}

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

const num = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;

const view = (page) => page.evaluate(() => ({
  open: !!document.querySelector(".modal-box"),
  rowAmounts: [...document.querySelectorAll(".modal-body tbody tr")]
    .map((r) => r.lastElementChild?.textContent.trim()).filter(Boolean),
  raw: document.querySelector(".ret-sum")?.textContent.replace(/\s+/g, " ").trim() || null,
  perUnit: document.querySelector(".modal-body .text-muted.ek-num")?.textContent.trim() || null,
  total: document.querySelector(".ret-sum__row b")?.textContent.trim() || null,
  tip: document.querySelector(".ret-sum__tip")?.textContent.replace(/\s+/g, " ").trim() || null,
  tipOn: !!document.querySelector(".ret-sum__tip.is-on"),
  amt: document.querySelector(".ret-amt")?.value ?? null,
  amtHold: document.querySelector(".ret-amt")?.placeholder ?? null,
}));


const page = await open();

console.log("\n── 1. Oyna ochiladi va bir donaning summasi ko'rinadi ──");
{
  const v = await view(page);
  v.open ? ok("qaytarish oynasi ochildi") : no("oyna ochilishi kerak", "yo'q");
  /(3\s?333)/.test(v.perUnit || "")
    ? ok(`bir donasi: ${v.perUnit}`) : no("bir donasi 3 333 ko'rsatilishi kerak", v.perUnit);
}

console.log("\n── 2. Miqdor yozilganda summa DARHOL chiqadi ──");
/* ⚠ Kassir mijozga raqamni AYTISHDAN oldin ko'rishi kerak. */
/* ⚠ MAYDON MASKALANGAN va `max` bilan cheklangan (`Field kind="qty"`).
   «Bosib, Backspace bosish» ishonchsiz: kursor qayerga tushgani
   noma'lum va 3 turgan maydonga 1 yozilsa 13 chiqib, `max=3` uni
   rad etadi. Shuning uchun qiymat React ko'radigan yo'l bilan —
   native setter va `input` hodisasi orqali — QAYTA yoziladi. */
const qty = async (v) => {
  await page.evaluate((val) => {
    const el = document.querySelector(".modal-body tbody tr input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, String(val));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  await new Promise((r) => setTimeout(r, 350));
};
await qty(1);
{
  const v = await view(page);
  num(v.total) === 3333 ? ok(`bittasi uchun ${v.total}`)
                        : no("bittasi uchun 3 333.33 bo'lishi kerak", v.total);
}

console.log("\n── 3. ⚠ TO'LIQ QAYTARISHDA TO'LANGANNING O'ZI ──");
/* Eski qoida shu yerda pul yo'qotardi: 3 333.33 × 3 = 9 999.99.
   Qoldiq tiyin endi oxirgi qaytarishga qo'shiladi. */
await qty(3);
{
  const v = await view(page);
  num(v.total) === 10000 ? ok(`uchalasi uchun ${v.total} — to'langanning O'ZI`)
                         : no("10 000 bo'lishi kerak", v.total);
}

console.log("\n── 4. Taklif — faqat KERAK bo'lganda ──");
{
  const v = await view(page);
  /* 10 000 allaqachon mukammal: taklif chiqmasligi kerak. */
  v.tip === null ? ok("mukammal summada taklif yo'q")
                 : no("taklif chiqmasligi kerak", v.tip);
}
await qty(1);
{
  const v = await view(page);
  /* 3 333.33 → 3 300 (−33.33), 2% chegarasi ichida. */
  v.tip && /3\s?300/.test(v.tip)
    ? ok(`taklif chiqdi: ${v.tip}`) : no("taklif 3 300 bo'lishi kerak", v.tip);
}

console.log("\n── 5. ⚠ TAKLIF O'ZI QO'LLANMAYDI ──");
{
  const before = await view(page);
  num(before.total) === 3333
    ? ok("tugma bosilmaguncha summa o'zgarmadi")
    : no("summa o'zgarmasligi kerak", before.total);

  await page.evaluate(() => document.querySelector(".ret-sum__tip")?.click());
  await new Promise((r) => setTimeout(r, 300));
  const after = await view(page);
  num(after.total) === 3300
    ? ok(`bosilgandan keyin: ${after.total}`) : no("3 300 bo'lishi kerak", after.total);
  after.tipOn ? ok("o'zgartirilgani belgilanadi (bekor qilish mumkin)")
              : no("belgilanishi kerak", "yo'q");
}

console.log("\n── 6. Serverga QO'LDAGI summa yuboriladi ──");
{
  await page.evaluate(() => {
    const ta = document.querySelectorAll(".modal-body input, .modal-body textarea");
    const last = ta[ta.length - 1];
    if (last) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      set?.call(last, "Buzuq");
      last.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /rasmiylashtir/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 900));

  sentBody ? ok("so'rov ketdi") : no("so'rov ketishi kerak", "yo'q");
  const it = sentBody?.items?.[0];
  it?.amount === 3300
    ? ok("qatorda `amount: 3300` — server aynan shuni jurnalga yozadi")
    : no("`amount: 3300` yuborilishi kerak", JSON.stringify(sentBody));
  it?.quantity === 1 ? ok("miqdor 1") : no("miqdor 1 bo'lishi kerak", it?.quantity);
}

console.log("\n── 7. Taklifsiz qaytarishda summa YUBORILMAYDI ──");
/* ⚠ Bo'sh qoldirilsa server muzlatilgan taqsimotdan hisoblaydi va
   bu ASOSIY yo'l: qaytariladigan pul mijoz to'lagan puldir. */
{
  sentBody = null;
  const p2 = await open();
  await p2.click(".modal-body tbody tr input");
  await p2.type(".modal-body tbody tr input", "2", { delay: 15 });
  await new Promise((r) => setTimeout(r, 300));
  await p2.evaluate(() => {
    const ta = document.querySelectorAll(".modal-body input, .modal-body textarea");
    const last = ta[ta.length - 1];
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(last, "Buzuq");
    last.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 250));
  await p2.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /rasmiylashtir/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 900));
  sentBody?.items?.[0]?.amount === undefined
    ? ok("`amount` yuborilmadi — server o'zi hisoblaydi")
    : no("`amount` yuborilmasligi kerak", JSON.stringify(sentBody));
  await p2.close();
}

console.log("\n── 8. Summa maydoni: BO'SH turadi, ichida muzlatilgani ko'rinadi ──");
{
  /* ⚠ Bo'sh maydon «tegilmagan» degani va serverga `amount` umuman
     yuborilmaydi. Muzlatilgan summani QIYMAT qilib qo'ysak, har
     qaytarish «qo'lda o'zgartirilgan» bo'lib jurnalga tushardi. */
  const p3 = await open();
  await p3.evaluate(() => {
    const el = document.querySelector(".modal-body tbody tr input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "1"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  const v = await p3.evaluate(() => ({
    amt: document.querySelector(".ret-amt")?.value ?? null,
    hold: document.querySelector(".ret-amt")?.placeholder ?? null,
  }));
  v.amt === "" ? ok("maydon bo'sh") : no("maydon bo'sh bo'lishi kerak", `«${v.amt}»`);
  /(3\s?333)/.test(v.hold || "")
    ? ok(`turtkida muzlatilgan summa: ${v.hold}`) : no("turtkida 3 333 bo'lishi kerak", v.hold);

  console.log("\n── 9. Qo'lda yozilgan summa SERVERGA ketadi ──");
  await p3.evaluate(() => {
    const el = document.querySelector(".ret-amt");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "3000"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  const tot = await p3.evaluate(() =>
    document.querySelector(".ret-sum__row b")?.textContent.trim() || null);
  num(tot) === 3000 ? ok(`jami darhol yangilandi: ${tot}`) : no("jami 3 000 bo'lishi kerak", tot);
  const chip = await p3.evaluate(() => !!document.querySelector(".ret-sum__tip.is-on"));
  chip ? ok("«qo'lda kamaytirildi» belgisi chiqdi") : no("belgi chiqishi kerak", "yo'q");

  sentBody = null;
  await p3.evaluate(() => {
    const ta = document.querySelectorAll(".modal-body input, .modal-body textarea");
    const last = ta[ta.length - 1];
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(last, "Buzuq"); last.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 250));
  await p3.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /rasmiylashtir/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 900));
  sentBody?.items?.[0]?.amount === 3000
    ? ok("`amount: 3000` yuborildi") : no("`amount: 3000` bo'lishi kerak", JSON.stringify(sentBody));
  await p3.close();
}

console.log("\n── 10. ⚠ TO'LANGANDAN KO'P YOZIB BO'LMAYDI ──");
{
  /* Oshirish — tovarni qaytarib, to'langandan ko'p pul olish, ya'ni
     kassadan pul chiqarishning eng oson yo'li. Maydonning O'ZI
     to'sadi; server ham rad etadi, lekin kassir buni tugmani
     bosishdan OLDIN bilishi kerak. */
  const p4 = await open();
  await p4.evaluate(() => {
    const el = document.querySelector(".modal-body tbody tr input");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "1"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  await p4.evaluate(() => {
    const el = document.querySelector(".ret-amt");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "99999"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  const tot = await p4.evaluate(() =>
    document.querySelector(".ret-sum__row b")?.textContent.trim() || null);
  num(tot) <= 3334
    ? ok(`chegarada qoldi: ${tot}`) : no("to'langandan oshmasligi kerak", tot);

  console.log("\n── 11. Maydon tozalansa — muzlatilganiga QAYTADI ──");
  await p4.evaluate(() => {
    const el = document.querySelector(".ret-amt");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, ""); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  const back = await p4.evaluate(() => ({
    tot: document.querySelector(".ret-sum__row b")?.textContent.trim() || null,
    on: !!document.querySelector(".ret-sum__tip.is-on"),
    tip: !!document.querySelector(".ret-sum__tip"),
  }));
  num(back.tot) === 3333 ? ok(`muzlatilganiga qaytdi: ${back.tot}`)
                         : no("3 333 bo'lishi kerak", back.tot);
  !back.on ? ok("«qo'lda kamaytirildi» belgisi yo'qoldi")
           : no("belgi yo'qolishi kerak", "turibdi");
  back.tip ? ok("tavsiya tugmasi qaytdi") : no("tavsiya qaytishi kerak", "yo'q");
  await p4.close();
}

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tushdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tushmadi");
}

await browser.close();
server.close();
console.log(bad ? `\n❌ Qaytarish oynasi: ${bad} ta muammo\n` : "\n✅ Qaytarish oynasi: hammasi o'tdi\n");
process.exit(bad ? 1 : 0);
