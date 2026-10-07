/* ══════════════════════════════════════════════════════════════════════════
   TAOM QO'SHIMCHALARI KASSADA (R2, V149, docs/22-RESTORAN.md)

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════
   §1 Taom bosilsa tanlov oynasi ochiladi; majburiy «Porsiya» tanlanmaguncha
      «Savatga» o'chiq va sababi yozilgan.
   §2 «Katta + Pishloq» → bitta qator, narx 30 000 + 8 000 + 4 000.
      Xuddi shu tanlov yana → o'sha qator ×2. Boshqa tanlov → ALOHIDA qator.
   §3 ⚠ Qo'shimchasiz tovar (suv) eskicha: ikki bosish → bitta qator ×2.
   §4 Serverga taom qatorida `modifierIds`, suvda — yo'q.
   §5 Restoran bo'lmagan do'kon: `/modifiers` UMUMAN so'ralmaydi (server 403
      berardi), taom oynasiz savatga tushadi.

   Ishga tushirish:  node scripts/check-mod.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4631;
const CHROME = process.env.CHROME_PATH
  || (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

const PRODUCTS = [
  { id: 7, name: "burger", salePrice: 30000, stockQuantity: null, unit: "DONA", unitDecimals: 0, active: true, type: "SERVICE" },
  { id: 3, name: "suv",    salePrice: 3000,  stockQuantity: 30,   unit: "DONA", unitDecimals: 0, active: true },
];
const GROUPS = [
  { id: 2, name: "Porsiya", minSelect: 1, maxSelect: 1, sortOrder: 0, productIds: [7],
    options: [{ id: 21, name: "Kichik", price: 0 }, { id: 22, name: "Katta", price: 8000 }] },
  { id: 1, name: "Sous", minSelect: 0, maxSelect: 2, sortOrder: 1, productIds: [7],
    options: [{ id: 11, name: "Pishloq", price: 4000 }, { id: 12, name: "Ketchup", price: 2000 }] },
];
const ALL = ["INVENTORY", "CUSTOMERS", "REPORTS", "SHIFTS"];

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

async function openKassa({ restaurant, kitchen = false, tables = false }) {
  const calls = { modifiers: 0, sales: [], tables: [] };
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
    let data = [];
    if (u.pathname.endsWith("/shop/features")) {
      data = { directions: restaurant ? ["RESTAURANT"] : ["RETAIL_FOOD"], unconfigured: false,
               features: restaurant ? [...ALL, "MODIFIERS", ...(kitchen ? ["KITCHEN"] : []), ...(tables ? ["TABLES"] : [])] : ALL,
               allFeatures: [...ALL, "MODIFIERS", "KITCHEN"] };
    } else if (tables && u.pathname.includes("/tables")) {
      let body = null;
      try { body = JSON.parse(r.postData() || "null"); } catch { /* bo'sh */ }
      calls.tables.push({ m: r.method(), p: u.pathname.replace(/^.*\/api/, ""), body });
      if (u.pathname.endsWith("/tables/halls")) {
        data = [{ id: 1, name: "Zal", sortOrder: 0, tables: [
          { id: 11, name: "Stol 1", seats: 4, sortOrder: 1, order: null },
          { id: 12, name: "Stol 2", seats: 4, sortOrder: 2,
            order: { id: 502, total: 70000, guests: 2, openedAt: new Date(Date.now() - 25 * 60000).toISOString(), lineCount: 1, version: 3 } },
        ] }];
      } else if (u.pathname.endsWith("/tables/11/open")) {
        data = { id: 501, tableId: 11, tableName: "Stol 1", hallName: "Zal", status: "OPEN", version: 0, lines: [] };
      } else if (u.pathname.endsWith("/tables/12/open")) {
        data = { id: 502, tableId: 12, tableName: "Stol 2", hallName: "Zal", status: "OPEN", version: 3,
                 lines: [{ productId: 7, quantity: 2, modifierIds: [22], discount: 0 }] };
      } else if (/\/tables\/orders\/50\d$/.test(u.pathname) && r.method() === "PUT") {
        data = { id: 501, tableId: 11, tableName: "Stol 1", status: "OPEN", version: (body?.version ?? 0) + 1, lines: body?.lines || [] };
      }
    } else if (/\/products\/7$/.test(u.pathname)) {
      data = PRODUCTS[0];
    } else if (u.pathname.endsWith("/modifiers")) {
      calls.modifiers++;
      data = GROUPS;
    } else if (u.pathname.endsWith("/shop/profile")) {
      data = { creditEnabled: false, bonusMaxPercent: 0,
               ...(kitchen ? { serviceChargePercent: 10, serviceChargeMxik: "10399001001000000" } : {}) };
    } else if (/\/products\/search$/.test(u.pathname)) {
      const q = (u.searchParams.get("q") || "").trim().toLowerCase();
      data = q ? PRODUCTS.filter((p) => p.name.includes(q)) : PRODUCTS;
    } else if (/\/sales\b/.test(u.pathname) && r.method() === "POST") {
      try { calls.sales.push(JSON.parse(r.postData() || "{}")); } catch { calls.sales.push(null); }
      data = { id: 901, receiptUrl: null };
    }
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      ek_token: "m", ek_type: "user", ek_role: "OWNER", ek_username: "m",
      ek_fullName: "M", ek_shopCode: "m", ek_deviceId: "m", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_cart")) localStorage.removeItem(k);
  });
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await page.waitForSelector(".product-card", { timeout: 20_000 });
  return { page, calls };
}

const cartItems = (page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("ek_cart_m_m") || "{}");
  const c = (raw.carts || []).find((x) => x.id === raw.activeId) || {};
  return (c.items || []).map((i) => ({ name: i.name, qty: i.qty, price: i.salePrice,
    mods: (i.modifiers || []).map((m) => m.name).join("+") }));
});
const waitFor = async (page, fn, ms = 5000) => {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 60));
  }
};
const tile = (page, name) => page.evaluate((n) => {
  const el = [...document.querySelectorAll(".product-card")].find((x) => x.textContent.toLowerCase().includes(n));
  el?.click();
  return !!el;
}, name);
const option = (page, name) => page.evaluate((n) => {
  const el = [...document.querySelectorAll(".mod-opt")].find((x) => x.textContent.includes(n));
  el?.click();
  return !!el;
}, name);
const addBtn = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".mod-modal .pay-modal-footer button")].pop());
const addDisabled = (page) => page.evaluate(() =>
  [...document.querySelectorAll(".mod-modal .pay-modal-footer button")].pop()?.disabled);
const confirmMods = async (page) => {
  await page.evaluate(() => [...document.querySelectorAll(".mod-modal .pay-modal-footer button")].pop()?.click());
  await waitFor(page, () => !document.querySelector(".mod-modal"));
};

console.log("\n══ TAOM QO'SHIMCHALARI KASSADA (R2) ══\n");

{
  const { page, calls } = await openKassa({ restaurant: true });
  await waitFor(page, () => true, 300);

  console.log("§1 Tanlov oynasi va majburiy guruh");
  await tile(page, "burger");
  (await waitFor(page, () => !!document.querySelector(".mod-modal")))
    ? ok("taom bosildi — oyna ochildi") : no("oyna ochilmadi", "—");
  (await addDisabled(page)) ? ok("«Porsiya» tanlanmagan — «Savatga» o'chiq") : no("tugma yoqiq qoldi", "enabled");
  const shortText = await page.evaluate(() => document.querySelector(".mod-group__rule.is-short")?.textContent || "");
  /1/.test(shortText) ? ok(`sababi yozilgan: «${shortText.trim()}»`) : no("yetishmayotgan guruh belgilanmagan", shortText);

  console.log("\n§2 Narx va qatorlar");
  await option(page, "Katta");
  await option(page, "Pishloq");
  (await addDisabled(page)) === false ? ok("porsiya tanlandi — tugma yoqildi") : no("tugma hamon o'chiq", "disabled");
  const btnText = await page.evaluate(() => [...document.querySelectorAll(".mod-modal .pay-modal-footer button")].pop()?.textContent || "");
  /42[\s\u00a0\u202f]?000/.test(btnText) ? ok("tugmada jami: 42 000") : no("tugmadagi narx noto'g'ri", btnText);
  await confirmMods(page);
  let items = await cartItems(page);
  items.length === 1 && items[0].price === 42000 && items[0].mods === "Katta+Pishloq"
    ? ok("savatda: burger, Katta+Pishloq, 42 000") : no("savat noto'g'ri", JSON.stringify(items));

  await tile(page, "burger");
  await waitFor(page, () => !!document.querySelector(".mod-modal"));
  await option(page, "Pishloq");
  await option(page, "Katta");
  await confirmMods(page);
  items = await cartItems(page);
  items.length === 1 && items[0].qty === 2 ? ok("xuddi shu tanlov (boshqa tartibda) — o'sha qator ×2")
    : no("bir xil tanlov birlashmadi", JSON.stringify(items));

  await tile(page, "burger");
  await waitFor(page, () => !!document.querySelector(".mod-modal"));
  await option(page, "Kichik");
  await confirmMods(page);
  items = await cartItems(page);
  items.length === 2 && items[1].mods === "Kichik" && items[1].price === 30000
    ? ok("boshqa tanlov — ALOHIDA qator (30 000)") : no("boshqa tanlov alohida qator bo'lmadi", JSON.stringify(items));
  const shown = await page.evaluate(() => [...document.querySelectorAll(".cart-item-mods")].map((e) => e.textContent.trim()));
  shown.includes("+ Katta, Pishloq") ? ok("savat qatorida qo'shimchalar ko'rinadi") : no("qatorda qo'shimcha yozilmagan", JSON.stringify(shown));

  console.log("\n§3 Qo'shimchasiz tovar eskicha");
  await tile(page, "suv");
  await new Promise((r) => setTimeout(r, 250));
  await tile(page, "suv");
  await new Promise((r) => setTimeout(r, 350));
  items = await cartItems(page);
  const water = items.filter((i) => i.name === "suv");
  water.length === 1 && water[0].qty === 2 ? ok("suv: ikki bosish → bitta qator ×2, oynasiz")
    : no("oddiy tovar birlashmadi", JSON.stringify(water));
  (await page.$(".mod-modal")) ? no("suvga oyna ochildi", "mod-modal") : ok("suvga oyna ochilmadi");

  console.log("\n§4 Serverga");
  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".pay-modal-submit"));
  await new Promise((r) => setTimeout(r, 300));
  /* ⚠ Bo'sh maydon «hali qaror emas» (`payUntouched`) — summa yoziladi.
     Jami: 42 000 × 2 + 30 000 + 3 000 × 2 = 120 000. */
  await page.keyboard.type("120000", { delay: 20 });
  await new Promise((r) => setTimeout(r, 300));
  if (process.env.DEBUG) console.log("    submit:", await page.evaluate(() => ({
    disabled: document.querySelector(".pay-modal-submit")?.disabled,
    text: document.querySelector(".pay-modal-submit")?.textContent,
    toasts: [...document.querySelectorAll(".toast, [role='alert'], [role='status']")].map((e) => e.textContent).join(" | "),
  })));
  await page.click(".pay-modal-submit");
  await waitFor(page, () => false, 1500);
  if (process.env.DEBUG) console.log("    after:", await page.evaluate(() =>
    [...document.querySelectorAll(".toast, [role='alert'], [role='status'], .modal-title, .pay-modal-title")].map((e) => e.textContent).join(" | ")));
  const body = calls.sales[0];
  if (!body) no("sotuv yuborilmadi", "yo'q");
  else {
    const lines = body.items || [];
    const burgers = lines.filter((l) => l.productId === 7).map((l) => (l.modifierIds || []).slice().sort().join("."));
    burgers.sort().join("|") === "11.22|21" ? ok("burger qatorlarida modifierIds: [11,22] va [21]")
      : no("modifierIds noto'g'ri", JSON.stringify(lines));
    const w = lines.find((l) => l.productId === 3);
    w && !("modifierIds" in w) ? ok("suv qatorida modifierIds yo'q") : no("suv qatori noto'g'ri", JSON.stringify(w));
  }
  calls.modifiers === 1 ? ok("guruhlar bir marta so'raldi") : no("guruhlar so'rovi soni", calls.modifiers);
  await page.close();
}

{
  console.log("\n§5 Restoran bo'lmagan do'kon");
  const { page, calls } = await openKassa({ restaurant: false });
  await waitFor(page, () => false, 600);
  calls.modifiers === 0 ? ok("/modifiers so'ralmadi (modul yopiq)") : no("modul yopiq do'konda so'raldi", calls.modifiers);
  await tile(page, "burger");
  await new Promise((r) => setTimeout(r, 350));
  const items = await cartItems(page);
  !(await page.$(".mod-modal")) && items.length === 1 && items[0].price === 30000
    ? ok("taom oynasiz, oddiy narxda") : no("oddiy do'konda oyna yoki noto'g'ri savat", JSON.stringify(items));
  await page.close();
}

{
  console.log("\n§6 Buyurtma turi va xizmat haqi (R5): zalda 10%");
  const { page, calls } = await openKassa({ restaurant: true, kitchen: true });
  await waitFor(page, () => false, 600);
  await tile(page, "suv");
  await new Promise((r) => setTimeout(r, 400));
  const rowTxt = await page.evaluate(() => document.querySelector(".total-big")?.textContent || "");
  /3[\s\u00a0\u202f]?300/.test(rowTxt) ? ok("savatda jami 3 300 (3 000 + 10%)") : no("jamiga xizmat haqi qo'shilmadi", rowTxt);
  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".order-type"));
  const btns = await page.evaluate(() => [...document.querySelectorAll(".order-type__b")].map((b) => b.getAttribute("aria-checked")));
  JSON.stringify(btns) === '["true","false","false"]' ? ok("to'lov oynasida buyurtma turi, standart «Zalda»") : no("buyurtma turi yo'q yoki noto'g'ri", JSON.stringify(btns));
  await page.evaluate(() => document.querySelectorAll(".order-type__b")[1].click());
  await new Promise((r) => setTimeout(r, 200));
  const take = await page.evaluate(() => document.querySelector(".pay-modal-total-value")?.textContent || "");
  /^3[\s\u00a0\u202f]?000/.test(take.trim()) ? ok("«Olib ketish» — xizmat haqisiz 3 000") : no("olib ketishda xizmat haqi qoldi", take);
  await page.evaluate(() => document.querySelectorAll(".order-type__b")[0].click());
  await new Promise((r) => setTimeout(r, 200));
  await page.keyboard.type("3300", { delay: 20 });
  await new Promise((r) => setTimeout(r, 300));
  await page.click(".pay-modal-submit");
  await waitFor(page, () => false, 1500);
  const b = calls.sales[0];
  b && b.orderType === "DINE_IN" && Number(b.serviceChargePercent) === 10
    ? ok("serverga orderType DINE_IN va 10% ketdi (summani server hisoblaydi)")
    : no("serverga buyurtma turi/foiz ketmadi", JSON.stringify(b && { orderType: b.orderType, pct: b.serviceChargePercent }));
  await page.close();
}

{
  console.log("\n§7 Stollar (T1): ochish, serverga yozish, to'lov");
  const { page, calls } = await openKassa({ restaurant: true, tables: true });
  await waitFor(page, () => false, 600);
  await page.evaluate(() => document.querySelector(".cart-head__tables")?.click());
  (await waitFor(page, () => document.querySelectorAll(".tbl-tile").length === 2))
    ? ok("«Stollar» oynasi: ikki stol") : no("stollar oynasi ochilmadi", "—");
  const busyTxt = await page.evaluate(() => document.querySelector(".tbl-tile.is-busy")?.textContent || "");
  /70[\s\u00a0\u202f]?000/.test(busyTxt) && /25/.test(busyTxt) ? ok("band stolda summa va vaqt matni (rang yolg'iz emas)") : no("band stol matni", busyTxt);
  await page.evaluate(() => document.querySelectorAll(".tbl-tile")[0].click());
  await waitFor(page, () => !document.querySelector(".tbl-modal"));
  const tab = await page.evaluate(() => document.querySelector(".cart-tab.is-on .cart-tab__name")?.textContent || "");
  /Stol 1/.test(tab) ? ok("stol savat yorlig'i bo'lib ochildi: «Stol 1»") : no("yorliq nomi", tab);
  await tile(page, "suv");
  await waitFor(page, () => false, 1300);
  const put = calls.tables.find((c) => c.m === "PUT");
  put && put.body?.version === 0 && put.body?.lines?.[0]?.productId === 3
    ? ok("o'zgarish serverga yozildi: versiya 0, suv qatori") : no("PUT ketmadi yoki noto'g'ri", JSON.stringify(put));
  const puts = calls.tables.filter((c) => c.m === "PUT").length;
  await waitFor(page, () => false, 1200);
  calls.tables.filter((c) => c.m === "PUT").length === puts ? ok("o'zgarishsiz qayta yozilmaydi") : no("bekor PUT", "takror");

  await page.evaluate(() => document.querySelector(".cart-head__tables")?.click());
  await waitFor(page, () => document.querySelectorAll(".tbl-tile").length === 2);
  await page.evaluate(() => document.querySelectorAll(".tbl-tile")[1].click());
  await waitFor(page, () => /Stol 2/.test(document.querySelector(".cart-tab.is-on .cart-tab__name")?.textContent || ""), 4000);
  const items = await cartItems(page);
  items.length === 1 && items[0].qty === 2 && items[0].price === 38000 && items[0].mods === "Katta"
    ? ok("band stol buyurtmasi yuklandi: burger + Katta ×2 (38 000)") : no("band stol yuklanmadi", JSON.stringify(items));

  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".pay-modal-submit"));
  await page.keyboard.type("76000", { delay: 20 });
  await new Promise((r) => setTimeout(r, 300));
  await page.click(".pay-modal-submit");
  await waitFor(page, () => false, 1500);
  const b = calls.sales[0];
  b && b.tableOrderId === 502 ? ok("to'lovda tableOrderId 502 — server stolni yopadi") : no("tableOrderId ketmadi", JSON.stringify(b && b.tableOrderId));
  await page.close();
}

pageErrors.length === 0 ? ok("sahifada JS xatosi yo'q") : no("JS xatosi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(bad === 0 ? "\n  ✅ HAMMASI O'TDI" : `\n  ❌ ${bad} ta muammo`);
process.exit(bad === 0 ? 0 : 1);
