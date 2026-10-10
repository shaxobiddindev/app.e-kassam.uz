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

async function openKassa({ restaurant, kitchen = false, tables = false, terminal = false, role = "OWNER", path = "/sale", ready, shiftClosed = false, stopIds = [] }) {
  const calls = { modifiers: 0, sales: [], tables: [], sse: [], orders: {},
                  resv11: { at: new Date(Date.now() + 30 * 60000).toISOString(), name: "Aziz", guests: 6 },
                  menuStop: [], stop7: false };
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
    if (u.pathname.endsWith("/auth/pin/staff")) {
      data = [{ id: 5, fullName: "Dilnoza Karimova", role: "WAITER", onShift: true },
              { id: 6, fullName: "Sardor", role: "CASHIER", onShift: false }];
    } else if (u.pathname.endsWith("/auth/pin/unlock")) {
      let body = null;
      try { body = JSON.parse(r.postData() || "null"); } catch { /* bo'sh */ }
      calls.unlock = (calls.unlock || 0) + 1;
      if (body?.pin !== "2468") {
        return r.respond({ status: 400, contentType: "application/json", headers: CORS,
                           body: JSON.stringify({ success: false, message: "PIN noto'g'ri" }) });
      }
      data = { accessToken: "w2", refreshToken: "r2", shopCode: "m", username: "m", fullName: "Dilnoza Karimova", role: "WAITER" };
    } else if (u.pathname.endsWith("/shop/features")) {
      data = { directions: restaurant ? ["RESTAURANT"] : ["RETAIL_FOOD"], unconfigured: false,
               features: restaurant ? [...ALL, "MODIFIERS", ...(kitchen ? ["KITCHEN"] : []), ...(tables ? ["TABLES"] : [])] : ALL,
               allFeatures: [...ALL, "MODIFIERS", "KITCHEN"] };
    } else if (kitchen && tables && u.pathname.includes("/kitchen/")) {
      calls.kitchen = calls.kitchen || [];
      calls.kitchen.push({ m: r.method(), p: u.pathname.replace(/^.*\/api/, "") });
      const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
      if (u.pathname.endsWith("/kitchen/tickets")) {
        data = [
          { id: 71, orderId: 502, tableId: 12, tableName: "Stol 2", station: "Oshxona", status: "NEW", waiter: "Dilnoza", createdAt: ago(25),
            lines: [{ name: "Osh", quantity: 2, mods: null, seat: 1, course: 2, note: "achchiqsiz" }] },
          { id: 72, orderId: 501, tableId: 11, tableName: "Stol 1", station: "Bar", status: "NEW", waiter: "Javohir", createdAt: ago(3),
            lines: [{ name: "Choy", quantity: 1, mods: null, seat: null, course: null, note: null }] },
        ];
      } else if (/\/kitchen\/orders\/50\d$/.test(u.pathname)) {
        data = [{ id: 77, orderId: 502, tableId: 12, tableName: "Stol 2", station: "Oshxona", status: "READY", createdAt: ago(18),
                  lines: [{ name: "burger", quantity: 2 }] }];
      }
    } else if (tables && u.pathname.endsWith("/tables/events")) {
      /* Jonli oqim (T2): har ulanishda «hello» + navbatdagi hodisalar, keyin
         javob tugaydi va kassa qayta ulanadi — sinov hodisani navbatga qo'yadi. */
      const body = "event: hello\ndata: {}\n\n"
        + calls.sse.splice(0).map((e) => `event: table\ndata: ${JSON.stringify(e)}\n\n`).join("");
      return r.respond({ status: 200, contentType: "text/event-stream", headers: CORS, body });
    } else if (tables && u.pathname.includes("/tables")) {
      let body = null;
      try { body = JSON.parse(r.postData() || "null"); } catch { /* bo'sh */ }
      calls.tables.push({ m: r.method(), p: u.pathname.replace(/^.*\/api/, ""), body });
      if (u.pathname.endsWith("/tables/halls")) {
        data = [{ id: 1, name: "Zal", sortOrder: 0, tables: [
          { id: 11, name: "Stol 1", seats: 4, sortOrder: 1, order: null, x: 40, y: 40, shape: "ROUND", reservation: calls.resv11 },
          { id: 12, name: "Stol 2", seats: 4, sortOrder: 2, x: 300, y: 200, shape: "LONG", reservation: null,
            order: { id: 502, total: 70000, guests: 2, openedAt: new Date(Date.now() - 25 * 60000).toISOString(), lineCount: 1, version: 3,
                     openedBy: "dn", openedByName: "Dilnoza Karimova", billAt: new Date(Date.now() - 5 * 60000).toISOString(),
                     ...(kitchen ? { kitchenReady: 1 } : {}) } },
        ] }];
      } else if (u.pathname.endsWith("/tables/11/reserve")) {
        calls.resv11 = r.method() === "DELETE" ? null : { at: body?.at, name: body?.name, guests: body?.guests };
      } else if (u.pathname.endsWith("/tables/11/open")) {
        data = { id: 501, tableId: 11, tableName: "Stol 1", hallName: "Zal", status: "OPEN", version: 0, lines: [] };
      } else if (u.pathname.endsWith("/tables/12/open")) {
        data = { id: 502, tableId: 12, tableName: "Stol 2", hallName: "Zal", status: "OPEN", version: 3,
                 lines: [{ productId: 7, quantity: 2, modifierIds: [22], discount: 0 }] };
      } else if (/\/tables\/orders\/50\d$/.test(u.pathname) && r.method() === "GET") {
        data = calls.orders[u.pathname.split("/").pop()] ?? null;
      } else if (/\/tables\/orders\/50\d$/.test(u.pathname) && r.method() === "PUT") {
        calls.lastPut = body;
        data = { id: 501, tableId: 11, tableName: "Stol 1", status: "OPEN", version: (body?.version ?? 0) + 1, lines: body?.lines || [] };
      } else if (/\/tables\/orders\/501\/merge$/.test(u.pathname)) {
        data = { id: 501, tableId: 11, tableName: "Stol 1", hallName: "Zal", status: "OPEN", version: (body?.version ?? 0) + 1, guests: 2,
                 lines: [{ productId: 7, quantity: 2, modifierIds: [22], discount: 0, sentQty: 2, sentAt: new Date().toISOString() }] };
      } else if (/\/tables\/orders\/501\/send$/.test(u.pathname)) {
        const now = new Date().toISOString();
        const lines = (calls.lastPut?.lines || []).map((l) => ({ ...l, sentQty: l.quantity, sentAt: now }));
        data = { order: { id: 501, tableId: 11, tableName: "Stol 1", hallName: "Zal", status: "OPEN",
                          version: (body?.version ?? 0) + 1, guests: calls.lastPut?.guests || 1, lines },
                 sent: lines };
      }
    } else if (u.pathname.endsWith("/reports/restaurant/today")) {
      calls.today = (calls.today || 0) + 1;
      const now = new Date().toISOString();
      data = { date: u.searchParams.get("date"), revenue: 3250000, revenueLastWeek: 2900000, receipts: 41, guests: 96,
               perGuest: 33854, avgCheck: 79268, tablesTotal: 14, tablesBusy: 9, tablesClosed: 38, turnover: 2.7,
               kitchenOpen: 6, kitchenLate: 1, cookMinutes: 14, tips: 120000, serviceCharge: 295000,
               hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: h >= 11 && h <= 15 ? 400000 + h * 10000 : 0, occupancy: h === 13 ? 93 : h >= 11 && h <= 15 ? 60 : 0 })),
               alerts: [{ kind: "LATE", title: "Stol 4", text: "Osh, Lag'mon", at: now, minutes: 24 },
                        { kind: "STOCK", title: "Mol go'shti", text: "2.5", unit: "KG", at: null }],
               dishes: [{ productId: 7, name: "Osh", qty: 42, revenue: 1890000 }],
               waiters: [{ login: "dn", name: "Dilnoza Karimova", tables: 9, guests: 31, revenue: 1240000, avgCheck: 137777, tips: 60000 }] };
    } else if (u.pathname.endsWith("/menu/board")) {
      data = { dishCount: 2, stopCount: calls.stop7 ? 1 : 0,
               sections: [{ id: 1, name: "Taomlar", station: "Oshxona", count: 1 }],
               dishes: [
                 { id: 7, name: "burger", type: "DISH", categoryId: 1, categoryName: "Taomlar", station: "Oshxona", thumbUrl: null,
                   price: 30000, cost: 9000, hasRecipe: true, costPct: 30, cookMinutes: 12, portion: "350 g",
                   stopListed: calls.stop7, stopListedAt: calls.stop7 ? new Date().toISOString() : null, stopListedBy: calls.stop7 ? "m" : null,
                   todayQty: 5, todayRevenue: 150000, portionsLeft: 4, limitName: "Go'sht", modifiers: ["Porsiya", "Sous"] },
                 { id: 3, name: "suv", type: "GOODS", categoryId: null, categoryName: null, station: null, thumbUrl: null,
                   price: 3000, cost: 2000, hasRecipe: false, costPct: 66.7, cookMinutes: null, portion: null,
                   stopListed: false, todayQty: 0, todayRevenue: 0, portionsLeft: null, limitName: null, modifiers: [] }] };
    } else if (/\/menu\/\d+\/stop$/.test(u.pathname)) {
      let body = null;
      try { body = JSON.parse(r.postData() || "null"); } catch { /* bo'sh */ }
      calls.menuStop.push({ id: Number(u.pathname.split("/").slice(-2)[0]), stopped: body?.stopped });
      calls.stop7 = !!body?.stopped;
      data = null;
    } else if (/\/recipes\/7$/.test(u.pathname)) {
      data = { productId: 7, productName: "burger", salePrice: 30000, cost: 9000,
               lines: [{ ingredientId: 50, name: "Go'sht", unit: "KG", unitDecimals: 3, quantity: 0.1, costPrice: 90000, lineCost: 9000 }] };
    } else if (u.pathname.endsWith("/products/categories")) {
      data = tables ? [{ id: 1, name: "Taomlar", productCount: 2, station: "Oshxona" }] : [];
    } else if (/\/products\/\d+$/.test(u.pathname)) {
      data = PRODUCTS.find((x) => String(x.id) === u.pathname.split("/").pop()) || null;
    } else if (u.pathname.endsWith("/modifiers")) {
      calls.modifiers++;
      data = GROUPS;
    } else if (u.pathname.endsWith("/shop/profile")) {
      data = { creditEnabled: false, bonusMaxPercent: 0,
               ...(kitchen ? { serviceChargePercent: 10, serviceChargeMxik: "10399001001000000" } : {}) };
    } else if (/\/products\/search$/.test(u.pathname)) {
      const q = (u.searchParams.get("q") || "").trim().toLowerCase();
      data = (q ? PRODUCTS.filter((p) => p.name.includes(q)) : PRODUCTS)
        .map((p) => (stopIds.includes(p.id) ? { ...p, stopListed: true } : p));
    } else if (u.pathname.endsWith("/security/shift/current")) {
      /* Smena: ochiq (obyekt) yoki server aniq «yopiq» deydi (null). */
      data = shiftClosed ? null : { id: 1, openedAt: new Date().toISOString(), openedByName: "M" };
    } else if (/\/sales\b/.test(u.pathname) && r.method() === "POST") {
      try { calls.sales.push(JSON.parse(r.postData() || "{}")); } catch { calls.sales.push(null); }
      data = { id: 901, receiptUrl: null };
    }
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  await page.evaluateOnNewDocument((ROLE, TERMINAL) => {
    for (const [k, v] of Object.entries({
      ek_token: "m", ek_type: "user", ek_role: ROLE, ek_username: "m",
      ek_fullName: "M", ek_shopCode: "m", ek_deviceId: "m", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    if (TERMINAL) localStorage.setItem("ek_terminal", "1"); else localStorage.removeItem("ek_terminal");
    for (const k of Object.keys(localStorage)) if (k.startsWith("ek_cart")) localStorage.removeItem(k);
  }, role, terminal);
  await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "networkidle2", timeout: 30_000 });
  /* `ready` — o'zi tanlagan selektor: do'konda restoran manzili boshqa
     sahifaga qaytadi va uning selektori kutilmaydi (§15). */
  await page.waitForSelector(ready || (terminal ? ".term-lock, .rf" : path === "/sale" ? ".product-card"
    : path === "/restaurant" ? ".rf" : ".page-content"), { timeout: 20_000 });
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

{
  console.log("\n§8 Jonli yangilanish (T2): boshqa qurilma qo'shdi, keyin to'ladi");
  const { page, calls } = await openKassa({ restaurant: true, tables: true });
  await waitFor(page, () => false, 600);
  await page.evaluate(() => document.querySelector(".cart-head__tables")?.click());
  await waitFor(page, () => document.querySelectorAll(".tbl-tile").length === 2);
  await page.evaluate(() => document.querySelectorAll(".tbl-tile")[1].click());
  await waitFor(page, () => /Stol 2/.test(document.querySelector(".cart-tab.is-on .cart-tab__name")?.textContent || ""), 4000);
  await waitFor(page, () => false, 400);

  /* O'z hodisasi (by = shu qurilma) — e'tiborsiz. ⚠ Server buyurtmasi hali
     berilmaydi: soxta oqim har qayta ulanishda «hello» yuboradi va kassa
     haqli ravishda hamma stolni qayta o'qiydi — o'shanda o'zgarish kelardi. */
  calls.sse.push({ kind: "order", tableId: 12, orderId: 502, version: 4, status: "OPEN", by: "m" });
  await waitFor(page, () => false, 1500);
  (await cartItems(page))[0]?.qty === 2 ? ok("o'z hodisasi o'tkazib yuborildi") : no("o'z hodisasi yorliqni o'zgartirdi", JSON.stringify(await cartItems(page)));
  calls.orders["502"] = { id: 502, tableId: 12, tableName: "Stol 2", hallName: "Zal", status: "OPEN", version: 4,
                          lines: [{ productId: 7, quantity: 3, modifierIds: [22], discount: 0 }] };

  calls.sse.push({ kind: "order", tableId: 12, orderId: 502, version: 4, status: "OPEN", by: "planshet" });
  const grew = await waitFor(page, () => {
    const raw = JSON.parse(localStorage.getItem("ek_cart_m_m") || "{}");
    const c = (raw.carts || []).find((x) => x.id === raw.activeId) || {};
    return c.items?.[0]?.qty === 3;
  }, 5000);
  grew ? ok("planshet qo'shgan taom yorliqqa yetdi (×2 → ×3), PUT yuborilmadi") : no("yorliq yangilanmadi", JSON.stringify(await cartItems(page)));
  !calls.tables.some((c) => c.m === "PUT") ? ok("yangilanish serverga qaytib yozilmadi") : no("bekor PUT", "bor");

  calls.orders["502"] = { ...calls.orders["502"], status: "PAID", version: 5 };
  calls.sse.push({ kind: "order", tableId: 12, orderId: 502, version: 5, status: "PAID", by: "kassa-2" });
  const gone = await waitFor(page, () => ![...document.querySelectorAll(".cart-tab__name")].some((n) => /Stol 2/.test(n.textContent)), 5000);
  gone ? ok("⚠ boshqa kassada to'langan stol yorlig'i yopildi (ikki marta pul olinmaydi)") : no("to'langan stol yorlig'i qoldi", "—");
  await page.close();
}

{
  console.log("\n§9 Zal terminali (D1): qulf, PIN, zal, ofitsiant to'lov olmaydi");
  const { page, calls } = await openKassa({ restaurant: true, tables: true, terminal: true, role: "WAITER", path: "/restaurant" });
  (await waitFor(page, () => !!document.querySelector(".term-lock"), 6000))
    ? ok("terminal qulfli ochildi") : no("qulf ekrani chiqmadi", "—");
  (await waitFor(page, () => document.querySelectorAll(".term-staff").length === 2))
    ? ok("smenadagi xodimlar ro'yxati (ism, rol)") : no("xodimlar yo'q", "—");
  /* SHOTS=<papka> — ko'z bilan tekshirish uchun skrinshot (CI da yo'q). */
  const shot = (name) => process.env.SHOTS && page.screenshot({ path: path.join(process.env.SHOTS, name) });
  await page.setViewport({ width: 1280, height: 800 });
  await shot("terminal-lock.png");
  const pressPin = async (pin) => { for (const d of pin) { await page.keyboard.press(d); await new Promise((r) => setTimeout(r, 60)); } };
  await pressPin("1111");
  (await waitFor(page, () => /noto/.test(document.querySelector(".term-lock__err")?.textContent || "")))
    ? ok("noto'g'ri PIN — xabar, qulf qoladi") : no("xato xabari yo'q", "—");
  await pressPin("2468");
  (await waitFor(page, () => !document.querySelector(".term-lock") && document.querySelectorAll(".rf-table").length === 2, 6000))
    ? ok("to'g'ri PIN — ekran ochildi, zal: ikki stol") : no("ochilmadi yoki zal yo'q", "—");
  await shot("terminal-hall.png");
  const who = await page.evaluate(() => document.querySelector(".rf-who__txt b")?.textContent || "");
  /Dilnoza/.test(who) ? ok("tepada xodim ismi: " + who) : no("xodim ismi", who);
  const busyTxt = await page.evaluate(() => document.querySelector(".rf-table--bill")?.textContent || "");
  /70[\s\u00a0\u202f]?000/.test(busyTxt) ? ok("band stolda summa (matn bilan)") : no("band stol matni", busyTxt);
  await page.evaluate(() => document.querySelectorAll(".rf-table")[1].click());
  (await waitFor(page, () => /Stol 2/.test(document.querySelector(".rt-title b")?.textContent || ""), 6000))
    ? ok("stol bosildi — restoranning stol ekrani: «Stol 2»") : no("stol ochilmadi", await page.evaluate(() => location.pathname + location.search));
  const pay = await page.evaluate(() => [...document.querySelectorAll(".rt-actions button")].map((b) => `${b.disabled}:${b.textContent.trim()}`).join("|"));
  /true:.*kassir/.test(pay) && !/To'lov$/.test(pay) ? ok("⚠ ofitsiantda to'lov tugmasi yo'q — «To'lovni kassir oladi»") : no("to'lov tugmasi", pay);
  await page.evaluate(() => document.querySelector('.rt-back')?.click());
  await waitFor(page, () => !!document.querySelector(".rf-lock"), 4000);
  await page.evaluate(() => document.querySelector(".rf-lock")?.click());
  (await waitFor(page, () => !!document.querySelector(".term-lock"), 3000))
    ? ok("qulf tugmasi — ekran yana qulflandi") : no("qulflanmadi", "—");
  await page.close();
}

{
  console.log("\n§10 Zal rejasi (D2): joy, holatlar, diqqat, bron, «hisob berildi»");
  const { page, calls } = await openKassa({ restaurant: true, tables: true, path: "/restaurant" });
  await waitFor(page, () => document.querySelectorAll(".rf-plan .rf-table").length === 2, 6000);
  await page.setViewport({ width: 1280, height: 800 });
  if (process.env.SHOTS) { await waitFor(page, () => false, 300); await page.screenshot({ path: path.join(process.env.SHOTS, "floor-plan.png") }); }
  const pos = await page.evaluate(() => [...document.querySelectorAll(".rf-plan .rf-table")].map((b) => `${b.style.left}|${b.style.top}`));
  pos[0] === "4%|6.25%" && pos[1] === "30%|31.25%" ? ok("stollar rejadagi joyida (foizda): " + pos.join(" ; ")) : no("joy", pos.join(" ; "));
  const txt = await page.evaluate(() => [...document.querySelectorAll(".rf-plan .rf-table")].map((b) => b.textContent).join(" || "));
  /Bron \d\d:\d\d/.test(txt) && /Aziz/.test(txt) && /Hisob berildi/.test(txt) && /Dilnoza Karimova/.test(txt)
    ? ok("holat matni: bron vaqti va ismi, «Hisob berildi», ofitsiant ismi") : no("holat matni", txt);
  const round = await page.evaluate(() => getComputedStyle(document.querySelector(".rf-shape--round")).borderRadius);
  /50%/.test(round) ? ok("dumaloq stol — dumaloq") : no("shakl", round);
  const al = await page.evaluate(() => [...document.querySelectorAll(".rf-alert")].map((b) => b.textContent));
  al.length === 2 && /Stol 2/.test(al[0]) && /Stol 1/.test(al[1]) ? ok("diqqat: avval hisob, keyin yaqin bron") : no("diqqat ro'yxati", al.join(" | "));

  await page.evaluate(() => document.querySelectorAll(".rf-plan .rf-table")[0].click());
  await waitFor(page, () => !!document.querySelector(".rf-sheet"));
  await page.evaluate(() => [...document.querySelectorAll(".rf-sheet__btn")].find((b) => /bekor/i.test(b.textContent))?.click());
  (await waitFor(page, () => !/Bron/.test(document.querySelectorAll(".rf-plan .rf-table")[0]?.textContent || ""), 4000))
    && calls.tables.some((c) => c.m === "DELETE" && /\/tables\/11\/reserve$/.test(c.p))
    ? ok("bron bekor qilindi — stol bo'sh") : no("bron bekor qilinmadi", JSON.stringify(calls.tables.filter((c) => /reserve/.test(c.p))));

  await page.evaluate(() => document.querySelectorAll(".rf-plan .rf-table")[0].click());
  await waitFor(page, () => !!document.querySelector(".rf-sheet"));
  await page.evaluate(() => [...document.querySelectorAll(".rf-sheet__btn")].find((b) => /Bron/.test(b.textContent))?.click());
  await waitFor(page, () => !!document.querySelector('input[type="time"]'));
  /* Vaqt maydoni brauzer tiliga qarab 12/24 soatli — klaviatura bilan terish
     tilga bog'liq bo'lardi; React ko'radigan yo'l bilan qiymat qo'yiladi. */
  await page.evaluate(() => {
    const el = document.querySelector('input[type="time"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "20:30");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await waitFor(page, () => false, 200);
  await page.evaluate(() => [...document.querySelectorAll(".modal-box button")].find((b) => /Saqlash/.test(b.textContent))?.click());
  const post = await waitFor(page, () => false, 1200).then(() => calls.tables.find((c) => c.m === "POST" && /\/tables\/11\/reserve$/.test(c.p)));
  post && /T\d\d:30:00/.test(post.body?.at || "") ? ok("bron qo'yildi: vaqt ISO bilan ketdi " + post.body.at) : no("bron POST", JSON.stringify(post));

  await page.evaluate(() => document.querySelectorAll(".rf-plan .rf-table")[1].click());
  await waitFor(page, () => /Stol 2/.test(document.querySelector(".rt-title b")?.textContent || ""), 6000);
  await waitFor(page, () => document.querySelectorAll(".rt-line").length > 0, 4000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-actions button")].find((b) => /Hisob/.test(b.textContent))?.click());
  (await waitFor(page, () => false, 800).then(() => calls.tables.some((c) => c.m === "POST" && /\/tables\/orders\/502\/bill$/.test(c.p))))
    ? ok("stol ekranida «Hisob berildi» serverga ketdi") : no("hisob POST yo'q", "—");
  await page.close();
}

{
  console.log("\n§11 Reja muharriri (D2): strelka bilan surish, shakl, saqlash");
  const { page, calls } = await openKassa({ restaurant: true, tables: true, path: "/tables-setup" });
  await waitFor(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Reja"), 6000);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Reja")?.click());
  (await waitFor(page, () => document.querySelectorAll(".fe-table").length === 2))
    ? ok("muharrir ochildi: ikki stol") : no("muharrir", "—");
  if (process.env.SHOTS) { await waitFor(page, () => false, 700); await page.screenshot({ path: path.join(process.env.SHOTS, "floor-editor.png") }); }
  await page.focus(".fe-table");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.down("Shift"); await page.keyboard.press("ArrowDown"); await page.keyboard.up("Shift");
  await page.evaluate(() => [...document.querySelectorAll(".fe-bar button")].find((b) => /Kvadrat/.test(b.textContent))?.click());
  await page.evaluate(() => [...document.querySelectorAll(".modal-box button")].find((b) => /Saqlash/.test(b.textContent))?.click());
  await waitFor(page, () => false, 800);
  const put = calls.tables.find((c) => c.m === "PUT" && /\/tables\/halls\/1\/layout$/.test(c.p));
  const first = put?.body?.find?.((x) => x.id === 11);
  first && first.x === 48 && first.y === 80 && first.shape === "SQUARE"
    ? ok("saqlandi: Stol 1 → (48, 80), kvadrat (8 va Shift bilan 40 birlik)") : no("layout PUT", JSON.stringify(put?.body));
  await page.close();
}

{
  console.log("\n§12 Stol ekrani (D3): mehmon, kurs, izoh, oshxonaga yuborish");
  const { page, calls } = await openKassa({ restaurant: true, tables: true, path: "/restaurant/table/11" });
  (await waitFor(page, () => /Stol 1/.test(document.querySelector(".rt-title b")?.textContent || "") && document.querySelectorAll(".rt-dish").length === 2, 6000))
    ? ok("stol ekrani: bo'limlar va taomlar") : no("stol ekrani ochilmadi", await page.evaluate(() => document.body.innerText.slice(0, 200)));
  await page.evaluate(() => [...document.querySelectorAll(".rt-guests button")][1].click());
  await page.evaluate(() => [...document.querySelectorAll(".rt-pill")].find((b) => b.textContent.trim() === "M2")?.click());
  await page.evaluate(() => [...document.querySelectorAll(".rt-pill")].find((b) => b.textContent.trim() === "2")?.click());
  await page.evaluate(() => [...document.querySelectorAll(".rt-dish")].find((b) => /suv/.test(b.textContent))?.click());
  await page.evaluate(() => [...document.querySelectorAll(".rt-dish")].find((b) => /suv/.test(b.textContent))?.click());
  (await waitFor(page, () => /M2 · 2-kurs/.test(document.querySelector(".rt-line--new")?.textContent || "")))
    ? ok("yangi qator: suv ×2, M2, 2-kurs") : no("yangi qator", await page.evaluate(() => document.querySelector(".rt-order")?.innerText));
  await page.evaluate(() => document.querySelector(".rt-note")?.click());
  await waitFor(page, () => !!document.querySelector(".rt-quick"));
  await page.evaluate(() => [...document.querySelectorAll(".rt-quick button")].find((b) => /Achchiqsiz/.test(b.textContent))?.click());
  await page.evaluate(() => [...document.querySelectorAll(".modal-box button")].find((b) => /Saqlash/.test(b.textContent))?.click());
  await waitFor(page, () => false, 1300);
  const l = calls.lastPut?.lines?.[0];
  l && l.productId === 3 && l.quantity === 2 && l.seat === 2 && l.course === 2 && l.note === "Achchiqsiz" && calls.lastPut.guests === 2 && !("sentQty" in l)
    ? ok("serverga: suv ×2, M2, 2-kurs, izoh, 2 mehmon; sentQty yuborilmadi") : no("PUT", JSON.stringify(calls.lastPut));
  await page.evaluate(() => document.querySelector(".rt-send")?.click());
  (await waitFor(page, () => document.querySelectorAll(".rt-line--sent").length === 1 && !document.querySelector(".rt-line--new"), 4000))
    ? ok("yuborildi: qator «oshxonada» bo'limida, yangi bo'sh") : no("yuborish", await page.evaluate(() => document.querySelector(".rt-order")?.innerText));
  const sendCall = calls.tables.find((c) => c.m === "POST" && /\/tables\/orders\/501\/send$/.test(c.p));
  sendCall && typeof sendCall.body?.version === "number" ? ok("POST /send versiya bilan ketdi") : no("send", JSON.stringify(sendCall));
  const sendDisabled = await page.evaluate(() => document.querySelector(".rt-send")?.disabled);
  sendDisabled ? ok("yangi taom yo'q — «Oshxonaga yuborish» o'chiq") : no("send tugmasi yoqiq qoldi", "—");
  await page.close();
}

{
  console.log("\n§13 Bo'lish, ko'chirish, birlashtirish (D4)");
  const { page, calls } = await openKassa({ restaurant: true, tables: true, path: "/restaurant/table/12" });
  await waitFor(page, () => document.querySelectorAll(".rt-line").length > 0, 6000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-actions button")].find((b) => /Bo'lish/.test(b.textContent))?.click());
  await waitFor(page, () => !!document.querySelector(".rt-split"));
  await page.evaluate(() => [...document.querySelectorAll(".rt-pill")].find((b) => /Taom bo'yicha/.test(b.textContent))?.click());
  await waitFor(page, () => !!document.querySelector(".rt-split .rt-step"));
  await page.evaluate(() => [...document.querySelectorAll(".rt-split .rt-step")][1].click());
  const sum = await page.evaluate(() => [...document.querySelectorAll(".modal-box button")].find((b) => /qismni/.test(b.textContent))?.textContent || "");
  /38[\s\u00a0\u202f]?000/.test(sum) ? ok("taom bo'yicha: 1 ta burger (Katta) — 38 000") : no("qism summasi", sum);
  await page.evaluate(() => [...document.querySelectorAll(".modal-box button")].find((b) => /qismni/.test(b.textContent))?.click());
  (await waitFor(page, () => /qism/.test(document.querySelector(".cart-tab.is-on .cart-tab__name")?.textContent || ""), 6000))
    ? ok("kassada «Stol 2 · qism» yorlig'i") : no("qism yorlig'i", await page.evaluate(() => location.pathname + location.search));
  const items = await cartItems(page);
  items.length === 1 && items[0].qty === 1 ? ok("qism yorlig'ida faqat tanlangan 1 ta") : no("qism savati", JSON.stringify(items));
  await waitFor(page, () => false, 1000);
  !calls.tables.some((c) => c.m === "PUT") ? ok("⚠ qism yorlig'i buyurtmani serverda almashtirmadi (PUT yo'q)") : no("qism PUT qildi", "—");
  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".pay-modal-submit"));
  await page.keyboard.type("38000", { delay: 20 });
  await new Promise((r) => setTimeout(r, 300));
  await page.click(".pay-modal-submit");
  await waitFor(page, () => false, 1500);
  const sale = calls.sales[0];
  sale && sale.tableOrderId === 502 && sale.tableLines?.length === 1 && sale.tableLines[0].quantity === 1 && sale.tableLines[0].modifierIds?.[0] === 22
    ? ok("to'lovda tableOrderId + tableLines (1 ta burger) — server faqat shuni ayiradi") : no("qisman to'lov tanasi", JSON.stringify(sale && { t: sale.tableOrderId, l: sale.tableLines }));
  await page.close();
}
{
  const { page, calls } = await openKassa({ restaurant: true, tables: true, path: "/restaurant/table/12" });
  calls.resv11 = null;
  await waitFor(page, () => document.querySelectorAll(".rt-line").length > 0, 6000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-actions button")].find((b) => /Ko'chirish/.test(b.textContent))?.click());
  await waitFor(page, () => document.querySelectorAll(".rt-tool__table").length > 0, 4000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-tool__table")].find((b) => /Stol 1/.test(b.textContent))?.click());
  await waitFor(page, () => location.pathname === "/restaurant/table/11", 4000);
  const mv = calls.tables.find((c) => c.m === "POST" && /\/tables\/orders\/502\/move$/.test(c.p));
  mv && mv.body?.tableId === 11 && (await page.evaluate(() => location.pathname)) === "/restaurant/table/11"
    ? ok("ko'chirildi: Stol 2 → Stol 1 (versiya bilan), ekran yangi stolda") : no("ko'chirish", JSON.stringify(mv));
  await waitFor(page, () => /Stol 1/.test(document.querySelector(".rt-title b")?.textContent || ""), 4000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-actions button")].find((b) => /Birlashtirish/.test(b.textContent))?.click());
  await waitFor(page, () => document.querySelectorAll(".rt-tool__table").length > 0, 4000);
  await page.evaluate(() => [...document.querySelectorAll(".rt-tool__table")].find((b) => /Stol 2/.test(b.textContent))?.click());
  await waitFor(page, () => document.querySelectorAll(".rt-line--sent").length === 1, 4000);
  const mg = calls.tables.find((c) => c.m === "POST" && /\/tables\/orders\/501\/merge$/.test(c.p));
  mg && mg.body?.fromOrderId === 502 && mg.body?.fromVersion === 3
    ? ok("birlashtirildi: Stol 2 buyurtmasi Stol 1 ga (ikkala versiya bilan), taom «oshxonada»") : no("birlashtirish", JSON.stringify(mg));
  await page.close();
}

{
  console.log("\n§14 Oshxona ekrani (D5): buyurtmalar, kechikish, «Tayyor», zal va stol");
  const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/kitchen" });
  (await waitFor(page, () => document.querySelectorAll(".kd-card").length === 2, 6000))
    ? ok("oshxona ekranida ikki buyurtma") : no("oshxona ekrani", await page.evaluate(() => document.body.innerText.slice(0, 200)));
  const late = await page.evaluate(() => document.querySelector(".kd-card--late")?.textContent || "");
  /Kechikdi/.test(late) && /Stol 2/.test(late) && /achchiqsiz/.test(late) && /\(M1\)/.test(late) && /2-kurs/.test(late)
    ? ok("25 daqiqalik — «Kechikdi» (matn bilan), izoh, mehmon, kurs") : no("kechikkan karta", late);
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".kd-tabs .rt-pill")].map((b) => b.textContent.trim()).join("|"));
  /Bar/.test(tabs) && /Oshxona/.test(tabs) ? ok("sex tablari: " + tabs) : no("sex tablari", tabs);
  await page.evaluate(() => document.querySelector(".kd-card--late .kd-ready")?.click());
  (await waitFor(page, () => document.querySelectorAll(".kd-card").length === 1, 3000))
    && calls.kitchen.some((c) => c.m === "POST" && /\/kitchen\/tickets\/71\/ready$/.test(c.p))
    ? ok("«Tayyor» — serverga ketdi, karta oshpaz ekranidan chiqdi") : no("tayyor", JSON.stringify(calls.kitchen));
  await page.close();
}
{
  const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/restaurant" });
  await waitFor(page, () => document.querySelectorAll(".rf-plan .rf-table").length === 2, 6000);
  const st = await page.evaluate(() => document.querySelector(".rf-table--ready")?.textContent || "");
  /1 ta tayyor/.test(st) ? ok("zalda Stol 2 — «1 ta tayyor» (hisobdan ustun)") : no("zal holati", st);
  const al = await page.evaluate(() => document.querySelector(".rf-alert")?.textContent || "");
  /olib chiqing/.test(al) ? ok("diqqat ro'yxatida birinchi — tayyor taom") : no("diqqat", al);
  await page.evaluate(() => document.querySelector(".rf-table--ready")?.click());
  (await waitFor(page, () => !!document.querySelector(".rt-kt--ready"), 6000))
    ? ok("stol ekranida oshxona holati: tayyor") : no("stol ekranida holat yo'q", "—");
  await page.evaluate(() => document.querySelector(".rt-kt__btn")?.click());
  (await waitFor(page, () => !document.querySelector(".rt-kt--ready"), 3000))
    && calls.kitchen.some((c) => c.m === "POST" && /\/kitchen\/tickets\/77\/served$/.test(c.p))
    ? ok("«Olib chiqdim» — serverga ketdi") : no("served", JSON.stringify(calls.kitchen));
  await page.close();
}

{
  console.log("\n§15 Do'kon va restoran aralashmaydi (2026-10-08)");
  for (const path of ["/restaurant", "/kitchen", "/tables-setup", "/modifiers"]) {
    const { page } = await openKassa({ restaurant: false, path, ready: "body" });
    await waitFor(page, () => location.pathname !== "/restaurant" && location.pathname !== "/kitchen"
      && location.pathname !== "/tables-setup" && location.pathname !== "/modifiers", 6000);
    const at = await page.evaluate(() => location.pathname);
    at !== path ? ok(`do'konda ${path} ochilmaydi → ${at}`) : no(`do'konda ${path} ochildi`, at);
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: false, path: "/products" });
    await waitFor(page, () => !!document.querySelector(".sb-nav, nav"), 6000);
    const nav = await page.evaluate(() => document.querySelector("aside, .sidebar, nav")?.innerText || "");
    /Katalog/.test(nav) && !/Restoran|Zal\b|Oshxona|Qo'shimchalar/.test(nav) ? ok("do'kon menyusida restoran bandlari yo'q") : no("do'kon menyusida restoran", nav.slice(0, 300));
    await page.close();
  }
  {
    /* E1 (2026-10-10): restoranda yon menyu BUTUNLAY boshqa — do'kon guruhlari yo'q. */
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/products" });
    await waitFor(page, () => /Boshqaruv/i.test(document.querySelector(".sidebar")?.innerText || ""), 6000);
    const nav = await page.evaluate(() => document.querySelector(".sidebar")?.innerText || "");
    /Xizmat/i.test(nav) && /Boshqaruv/i.test(nav) && /Menyu/.test(nav) && /Masalliqlar/.test(nav) && /Restaurant/.test(nav)
      ? ok("restoranda o'z menyusi: «Xizmat», «Boshqaruv», Menyu, Masalliqlar") : no("restoran menyusi", nav.slice(0, 300));
    !/Katalog|Ombor\b|Savdo/.test(nav) ? ok("restoran menyusida do'kon guruhlari (Katalog, Ombor, Savdo) yo'q") : no("do'kon guruhi restoranda", nav.slice(0, 300));
    const title = await page.evaluate(() => document.querySelector(".topbar-title")?.innerText || "");
    /Menyu/.test(title) ? ok("sarlavha restoranniki: «Menyu»") : no("sarlavha", title);
    const tabs = await page.evaluate(() => [...document.querySelectorAll(".pg-tabs [role=tab]")].map((x) => x.innerText.trim()).join("|"));
    /Taomlar/.test(tabs) ? ok("ichki tablar: " + tabs) : no("ichki tablar", tabs);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-shell.png` });
    await page.close();
  }
  for (const path of ["/pickup", "/labels", "/loyalty"]) {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path, ready: "body" });
    await waitFor(page, () => location.pathname !== "/pickup" && location.pathname !== "/labels" && location.pathname !== "/loyalty", 6000);
    const at = await page.evaluate(() => location.pathname);
    at !== path ? ok(`restoranda do'kon sahifasi ${path} ochilmaydi → ${at}`) : no(`restoranda ${path} ochildi`, at);
    await page.close();
  }
  {
    /* E2 (2026-10-10): restoran egasining bosh sahifasi — do'kon paneli emas, «Bugun». */
    const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/", ready: "body" });
    await waitFor(page, () => /Bugun restoranda/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /Bugun restoranda/.test(txt) && /Mehmon boshiga/.test(txt) && /9 \/ 14/.test(txt)
      ? ok("restoran egasining uyi — «Bugun»: mehmon boshiga, band stollar 9/14") : no("Bugun paneli", txt.slice(0, 300));
    /▲ 12%/.test(txt) ? ok("o'tgan hafta bilan solishtirish: ▲ 12%") : no("solishtirish", txt.slice(0, 400));
    /Stol 4 — buyurtma kechikmoqda/.test(txt) && /Mol go'shti tugayapti/.test(txt) && /2,5 kg|2\.5 kg/i.test(txt)
      ? ok("diqqat: kechikkan buyurtma va tugayotgan masalliq (birligi bilan)") : no("diqqat", txt.slice(0, 600));
    /Dilnoza Karimova/.test(txt) && /Choy puli/i.test(txt) ? ok("ofitsiantlar jadvali choy puli bilan") : no("ofitsiantlar", txt.slice(-400));
    !/Kunlik savdo|Dashboard/.test(txt) ? ok("do'kon bosh sahifasi chizilmadi") : no("do'kon paneli restoranda", txt.slice(0, 200));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-today.png`, fullPage: true });
    const before = calls.today;
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Kecha/.test(b.innerText))?.click());
    (await waitFor(page, () => /kun yakuni/.test(document.body.innerText), 4000)) && calls.today > before
      ? ok("«Kecha» — kun yakuni qayta so'raldi") : no("kecha", String(calls.today));
    await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => /buyurtma kechikmoqda/.test(a.innerText))?.click());
    (await waitFor(page, () => location.pathname === "/kitchen", 4000)) ? ok("kechikish qatori → oshxona") : no("kechikish havolasi", await page.evaluate(() => location.pathname));
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, role: "CASHIER", path: "/", ready: "body" });
    await waitFor(page, () => location.pathname === "/restaurant", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/restaurant" ? ok("restoranda kassirning uyi — zal") : no("kassir uyi", at);
    await page.close();
  }
}

{
  console.log("\n§15b Restoran menyusi va stop-list (E3, 2026-10-10)");
  {
    const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/menu", ready: "body" });
    await waitFor(page, () => /Texkarta/.test(document.body.innerText) && /Go'sht/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /burger/.test(txt) && /350 g/.test(txt) && /30% yaxshi/.test(txt) && /Go'sht 4 porsiyaga yetadi/.test(txt) && /Sotuvda/.test(txt)
      ? ok("menyu: karta, porsiya, tannarx ulushi bahosi, «necha porsiyaga yetadi»") : no("menyu sahifasi", txt.slice(0, 500));
    /Porsiya/.test(txt) && /Sous/.test(txt) ? ok("texkartada qo'shimchalar") : no("qo'shimchalar", txt.slice(0, 500));
    /* Menyu guruhi yopiq bo'lishi mumkin — havola ichki tablardan olinadi. */
    const href = await page.evaluate(() => [...document.querySelectorAll(".pg-tabs a, .pg-tabs [role=tab]")].find((a) => /Taomlar/.test(a.innerText))?.getAttribute("href"));
    href === "/menu" ? ok("«Taomlar» tabi → /menu") : no("Taomlar havolasi", String(href));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-menu.png`, fullPage: true });

    await page.evaluate(() => [...document.querySelectorAll("section button")].find((b) => /suv/.test(b.innerText))?.click());
    (await waitFor(page, () => /Texkarta yo'q/.test(document.body.innerText) && /66,7%\s*yuqori/.test(document.body.innerText), 3000))
      ? ok("texkartasiz ichimlik: «Texkarta yo'q», ulush «yuqori»") : no("suv paneli", (await page.evaluate(() => document.body.innerText)).slice(0, 600));

    await page.evaluate(() => [...document.querySelectorAll("section button")].find((b) => /burger/.test(b.innerText))?.click());
    await waitFor(page, () => [...document.querySelectorAll("aside button")].some((b) => /Stop-listga qo'yish/.test(b.innerText)), 3000);
    await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => /Stop-listga qo'yish/.test(b.innerText))?.click());
    (await waitFor(page, () => /Stop-listda — sotilmaydi/.test(document.body.innerText)
        && [...document.querySelectorAll("aside button")].some((b) => /Sotuvga qaytarish/.test(b.innerText)), 4000))
      && calls.menuStop[0]?.id === 7 && calls.menuStop[0]?.stopped === true
      ? ok("stop-listga qo'yildi: serverga ketdi, karta va tugma almashdi") : no("stop", JSON.stringify(calls.menuStop));
    const stopBtn = await page.evaluate(() => [...document.querySelectorAll(".rpt-bar button")].map((b) => b.innerText).find((x) => /Stop-list/.test(x)) || "");
    /Stop-list\s*·\s*1/.test(stopBtn) ? ok("sarlavhada stop-list soni") : no("stop soni", JSON.stringify(stopBtn));

    await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => /Tahrirlash/.test(b.innerText))?.click());
    (await waitFor(page, () => location.pathname === "/products" && /edit=7/.test(location.search) && /back=%2Fmenu|back=\/menu/.test(location.search), 3000))
      ? ok("«Tahrirlash» — taom formasi (/products?edit=7&back=/menu)") : no("tahrirlash", await page.evaluate(() => location.href));
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: false, path: "/menu", ready: "body" });
    await waitFor(page, () => location.pathname !== "/menu", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/products" ? ok("do'konda /menu → /products") : no("do'konda menyu", at);
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: true, tables: true, path: "/restaurant/table/11", stopIds: [3] });
    await waitFor(page, () => document.querySelectorAll(".rt-dish").length > 0, 6000);
    const names = await page.evaluate(() => [...document.querySelectorAll(".rt-dish")].map((b) => b.textContent).join("|"));
    /burger/.test(names) && !/suv/.test(names) ? ok("ofitsiant menyusida stop-listdagi taom yo'q") : no("ofitsiant menyusi", names);
    await page.close();
  }
}

{
  console.log("\n§16 Ofitsiant telefonida (390 px): zal, stol, oshxona");
  /* Telefon — ofitsiantning cho'ntagidagi qurilma: gorizontal aylantirish
     bo'lsa tugma ekrandan chiqib ketadi, 44 px dan kichik tugmani
     yurib turib bosib bo'lmaydi (CLAUDE.md #3). */
  const probe = () => {
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== "fixed";
    }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]} ${Math.round(e.getBoundingClientRect().right)}`);
    /* Ko'rinmaydigan (yopiq yon menyu, `inert`) va ekrandan tashqaridagi
       tugmalar sanalmaydi — ularni hech kim bosmaydi. */
    const seen = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < W && r.bottom > 0
        && !e.closest("[inert], [aria-hidden='true']")
        && (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : true);
    };
    const small = [...document.querySelectorAll("button, a[href], [role=button]")].filter((e) => {
      const r = e.getBoundingClientRect();
      return seen(e) && (r.height < 43.5 || r.width < 43.5);
    }).slice(0, 4).map((e) => `${(e.getAttribute("aria-label") || e.textContent || e.className).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)} @${Math.round(e.getBoundingClientRect().left)},${Math.round(e.getBoundingClientRect().top)} <${e.parentElement?.className?.split?.(" ")[0] || ""}>`);
    return { scroll: document.documentElement.scrollWidth > W + 1, wide, small };
  };
  for (const [where, ready, name] of [["/restaurant", ".rf-plan .rf-table, .rf-list .rf-table", "phone-floor"],
                                     ["/restaurant/table/11", ".rt-dish", "phone-table"],
                                     ["/kitchen", ".kd-card", "phone-kitchen"]]) {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, role: "WAITER", path: where, ready: "body" });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForSelector(ready, { timeout: 8000 }).catch(() => {});
    await waitFor(page, () => false, 300);
    const r = await page.evaluate(probe);
    !r.scroll && r.wide.length === 0 ? ok(`${where}: gorizontal aylantirish yo'q`) : no(`${where}: ekrandan chiqadi`, r.wide.join(" · "));
    r.small.length === 0 ? ok(`${where}: tugmalar ≥ 44 px`) : no(`${where}: kichik tugma`, r.small.join(" · "));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true });
    await page.close();
  }
}

{
  console.log("\n§17 Choy puli va teng bo'lish (restoran): bitta chek, ulushlar, choy puli alohida");
  const { page, calls } = await openKassa({ restaurant: true, kitchen: true });
  await waitFor(page, () => false, 600);
  await tile(page, "suv");
  await new Promise((r) => setTimeout(r, 400));
  await page.keyboard.press("F9");
  (await waitFor(page, () => !!document.querySelector(".tip-box")))
    ? ok("restoranda to'lov oynasida choy puli va teng bo'lish") : no("choy puli bloki yo'q", "—");
  await page.evaluate(() => [...document.querySelectorAll(".tip-box .ek-quick-cash button")].find((b) => /^2 kishi$/.test(b.textContent.trim()))?.click());
  await waitFor(page, () => document.querySelectorAll(".split-list li").length === 2);
  const shares = await page.evaluate(() => [...document.querySelectorAll(".split-list li b")].map((b) => b.textContent.replace(/\D/g, "")).join(","));
  shares === "1650,1650" ? ok("3 300 → 2 × 1 650") : no("ulushlar", shares);
  await page.evaluate(() => document.querySelectorAll(".split-list li")[0].querySelectorAll("button")[0].click());
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => document.querySelectorAll(".split-list li")[1].querySelectorAll("button")[1].click());
  await new Promise((r) => setTimeout(r, 150));
  const done = await page.evaluate(() => document.querySelectorAll(".split-list li.is-done").length);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pay-tip-split.png` });
  done === 2 ? ok("ikkala mehmon to'ladi (naqd + karta)") : no("ulush belgilanmadi", String(done));
  const tipIn = await page.$(".tip-box input");
  await tipIn.click();
  await page.keyboard.type("5000", { delay: 15 });
  await page.evaluate(() => [...document.querySelectorAll(".tip-box .ek-quick-cash button")].find((b) => /Karta/i.test(b.textContent) && !b.closest(".split-list"))?.click());
  await new Promise((r) => setTimeout(r, 200));
  await page.click(".pay-modal-submit");
  await waitFor(page, () => false, 1500);
  const b = calls.sales[0] || {};
  const parts = (b.payments || []).map((x) => `${x.type}:${Number(x.amount)}`).sort().join(",");
  parts === "CARD:1650,CASH:1650" ? ok("bitta chek, to'lov ikki ulushda: " + parts) : no("to'lov qismlari", JSON.stringify(b.payments));
  Number(b.tipAmount) === 5000 && b.tipType === "CARD"
    ? ok("choy puli 5 000 (karta) — alohida maydon, to'lovga qo'shilmadi") : no("choy puli", JSON.stringify({ t: b.tipAmount, y: b.tipType }));
  await page.close();
}
{
  const { page } = await openKassa({ restaurant: false });
  await waitFor(page, () => false, 600);
  await tile(page, "suv");
  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".pay-modal-submit"));
  !(await page.$(".tip-box")) ? ok("do'konda choy puli bloki yo'q") : no("do'konda choy puli bor", "—");
  await page.close();
}
{
  console.log("\n§18 Smenasiz sotuv yo'q (2026-10-09)");
  const { page } = await openKassa({ restaurant: false, shiftClosed: true });
  await waitFor(page, () => false, 800);
  await tile(page, "suv");
  await page.keyboard.press("F9");
  await waitFor(page, () => !!document.querySelector(".pay-modal-submit"));
  await page.keyboard.type("3000", { delay: 15 });
  await new Promise((r) => setTimeout(r, 300));
  const st = await page.evaluate(() => ({ dis: document.querySelector(".pay-modal-submit")?.disabled,
                                          note: document.querySelector(".pay-modal [role=alert], [role=alert]")?.textContent || "" }));
  st.dis && /Smena ochilmagan/.test(st.note) ? ok("smena yopiq — «Sotish» o'chiq va sababi yozilgan") : no("smenasiz sotish mumkin", JSON.stringify(st));
  await page.close();
}

pageErrors.length === 0 ? ok("sahifada JS xatosi yo'q") : no("JS xatosi", pageErrors.join(" | "));

await browser.close();
server.close();
console.log(bad === 0 ? "\n  ✅ HAMMASI O'TDI" : `\n  ❌ ${bad} ta muammo`);
process.exit(bad === 0 ? 0 : 1);
