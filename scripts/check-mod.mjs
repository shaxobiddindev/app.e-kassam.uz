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

async function openKassa({ restaurant, kitchen = false, tables = false, terminal = false, role = "OWNER", path = "/sale", ready, shiftClosed = false, stopIds = [], sent = false, voidTicket = false }) {
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
          ...(voidTicket ? [{ id: 73, orderId: 502, tableId: 12, tableName: "Stol 2", station: "Oshxona", status: "NEW", waiter: "Sardor", createdAt: ago(1),
            lines: [{ name: "Lag'mon", quantity: 1, mods: null, seat: null, course: null, note: "Mehmon voz kechdi", voided: true }] }] : []),
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
                 lines: [{ productId: 7, quantity: 2, modifierIds: [22], discount: 0,
                           ...(sent ? { sentQty: 2, sentAt: new Date(Date.now() - 10 * 60000).toISOString() } : {}) }] };
      } else if (/\/tables\/orders\/50\d\/void$/.test(u.pathname)) {
        calls.voids = [...(calls.voids || []), body];
        const left = 2 - Number(body?.quantity || 0);
        data = { id: 502, tableId: 12, tableName: "Stol 2", hallName: "Zal", status: "OPEN", version: (body?.version ?? 3) + 1,
                 lines: left > 0 ? [{ productId: 7, quantity: left, modifierIds: [22], discount: 0, sentQty: left, sentAt: new Date().toISOString() }] : [] };
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
    } else if (u.pathname.endsWith("/reports/restaurant/staff")) {
      const at = (m) => new Date(Date.now() - m * 60000).toISOString();
      data = { staff: [
        { id: 1, login: "sm", name: "Sardor Mirzayev", roles: ["SHOP_ADMIN"], pinSet: false, enabled: true, onShift: false, since: null, lastShift: at(30), tablesToday: 0, tablesRevenue: 0, checksToday: 0, checksRevenue: 0 },
        { id: 2, login: "dn", name: "Dilnoza Karimova", roles: ["WAITER"], pinSet: true, enabled: true, onShift: true, since: at(180), lastShift: at(180), tablesToday: 9, tablesRevenue: 4860000, checksToday: 0, checksRevenue: 0 },
        { id: 3, login: "bk", name: "Bekzod Aliyev", roles: ["COOK"], pinSet: false, enabled: true, onShift: true, since: at(200), lastShift: at(200), tablesToday: 0, tablesRevenue: 0, checksToday: 0, checksRevenue: 0 },
        { id: 4, login: "ml", name: "Malika Saidova", roles: ["CASHIER"], pinSet: true, enabled: true, onShift: true, since: at(170), lastShift: at(170), tablesToday: 0, tablesRevenue: 0, checksToday: 41, checksRevenue: 16920000 },
        { id: 5, login: "an", name: "Anvar Holiqov", roles: ["STOREKEEPER"], pinSet: false, enabled: false, onShift: false, since: null, lastShift: "2026-10-07T07:00:00Z", tablesToday: 0, tablesRevenue: 0, checksToday: 0, checksRevenue: 0 }],
        tips: { cash: 240000, card: 95000, byWaiter: [{ login: "dn", name: "Dilnoza Karimova", amount: 180000, checks: 6 }, { login: "x", name: "Ali <b>", amount: 60000, checks: 2 }] } };
    } else if (u.pathname.endsWith("/reports/restaurant/report")) {
      calls.report = [...(calls.report || []), u.search];
      data = { from: u.searchParams.get("from"), to: u.searchParams.get("to"), days: 10,
               revenue: 164200000, revenuePrev: 150640000, receipts: 516, guests: 1912, perGuest: 85900, avgCheck: 318000,
               turnover: 2.6, foodCostPct: 31.4, latePct: 3.1, tablesTotal: 14,
               sources: [{ kind: "HALL", revenue: 118200000, receipts: 380 }, { kind: "TAKEAWAY", revenue: 29600000, receipts: 96 },
                         { kind: "DELIVERY", revenue: 16400000, receipts: 40 }],
               serviceCharge: 14820000, tips: 3410000,
               losses: { waste: 860000, countShortage: 410000, returns: 220000, returnsCount: 3, cancelledTables: 4 },
               dishes: [{ productId: 1, name: "Osh", qty: 412, revenue: 18540000, cost: 5850000, profit: 12690000, costPct: 31.6, group: "A" },
                        { productId: 2, name: "Qozon kabob", qty: 236, revenue: 16520000, cost: 6443000, profit: 10077000, costPct: 39.0, group: "A" },
                        { productId: 3, name: "Baliq (grill)", qty: 19, revenue: 1520000, cost: 912000, profit: 608000, costPct: 60.0, group: "C" }],
               waiters: [{ login: "dn", name: "Dilnoza Karimova", shifts: 9, tables: 120, guests: 512, revenue: 44300000, perGuest: 86500, avgMinutes: 54, tips: 1240000, cancelled: 2 },
                         { login: "jv", name: "Javohir", shifts: 10, tables: 140, guests: 604, revenue: 47900000, perGuest: 79300, avgMinutes: 61, tips: 980000, cancelled: 9 }],
               heat: [{ dow: 5, hour: 13, occupancy: 88 }, { dow: 6, hour: 20, occupancy: 99 }, { dow: 1, hour: 12, occupancy: 35 }],
               tables: [{ id: 5, name: "Stol 5", seats: 8, orders: 18, turnsPerDay: 1.8, revenue: 21400000, avgGuests: 6.2 }] };
    } else if (u.pathname.endsWith("/reports/restaurant/orders")) {
      const at = (m) => new Date(Date.now() - m * 60000).toISOString();
      data = { date: u.searchParams.get("date"), rows: [
        { kind: "TABLE", id: 1052, openedAt: at(20), hall: "Zal", table: "Stol 12", waiter: "Javohir", guests: 2, total: 98000, status: "OPEN" },
        { kind: "AWAY", id: 901, openedAt: at(35), hall: null, table: null, waiter: "Kassa", guests: 1, total: 126000, status: "TAKEAWAY" },
        { kind: "TABLE", id: 1043, openedAt: at(90), hall: "Zal", table: "Stol 3", waiter: "Dilnoza", guests: 5, total: 1120000, status: "BILL" },
        { kind: "TABLE", id: 1038, openedAt: at(150), hall: "Zal", table: "Stol 2", waiter: "Kamola", guests: 2, total: 186000, status: "PAID" },
        { kind: "TABLE", id: 1036, openedAt: at(170), hall: "Zal", table: "Stol 9", waiter: "Kamola", guests: 3, total: 0, status: "CANCELLED" }] };
    } else if (/\/reports\/restaurant\/orders\/table\/\d+$/.test(u.pathname)) {
      const id = Number(u.pathname.split("/").pop());
      const at = (m) => new Date(Date.now() - m * 60000).toISOString();
      data = id === 1038
        ? { kind: "TABLE", id, tableId: 2, status: "PAID", hall: "Zal", table: "Stol 2", waiter: "Kamola", guests: 2, note: null,
            lines: [{ course: null, name: "Osh", qty: 2, mods: null, seat: null, note: null, sum: 90000, sentQty: null }],
            subtotal: 169000, serviceCharge: 16900, total: 185900, tip: 20000,
            payments: [{ type: "CASH", amount: 185900 }], saleIds: [77],
            timeline: [{ at: at(150), kind: "OPENED", text: "Kamola" }, { at: at(100), kind: "PAID", amount: 185900 }] }
        : { kind: "TABLE", id, tableId: 3, status: "BILL", hall: "Zal", table: "Stol 3", waiter: "Dilnoza", guests: 5, note: "Tug'ilgan kun",
            lines: [{ course: 1, name: "Achchiq-chuchuk", qty: 2, mods: null, seat: null, note: null, sum: 30000, sentQty: 2 },
                    { course: 2, name: "Osh", qty: 3, mods: "Katta", seat: 1, note: null, sum: 159000, sentQty: 3 },
                    { course: 2, name: "Patir non", qty: 4, mods: null, seat: null, note: null, sum: 32000, sentQty: 0 }],
            subtotal: 221000, serviceCharge: 0, total: 1120000, tip: 0, payments: [], saleIds: [],
            timeline: [{ at: at(90), kind: "OPENED", text: "Dilnoza" }, { at: at(85), kind: "KITCHEN", text: "Oshxona", amount: 5 },
                       { at: at(60), kind: "READY", text: "Oshxona" }, { at: at(30), kind: "BILL" }] };
    } else if (/\/reports\/restaurant\/orders\/sale\/\d+$/.test(u.pathname)) {
      data = { kind: "AWAY", id: 901, tableId: null, status: "TAKEAWAY", waiter: "Kassa", guests: 1,
               lines: [{ course: null, name: "Somsa", qty: 6, sum: 72000 }], subtotal: 72000, serviceCharge: 0, total: 126000, tip: 0,
               payments: [{ type: "CARD", amount: 126000 }], saleIds: [901],
               timeline: [{ at: new Date().toISOString(), kind: "PAID", amount: 126000 }] };
    } else if (u.pathname.endsWith("/menu/ingredients")) {
      data = { stockValue: 28460000, kinds: 3, usedTodayValue: 5860000, revenueToday: 18900000, wasteTodayValue: 120000,
               lowCount: 2, shortageCount: 1,
               rows: [
                 { id: 50, name: "Mol go'shti", unit: "KG", unitDecimals: 3, stock: 3.2, minQuantity: 0, cost: 90000, stockValue: 288000,
                   usedToday: 6.8, avgDaily: 7.1, daysLeft: 0.4, dishes: ["Osh", "Lag'mon"], stopDish: false, supplierId: 1, supplierName: "Chorvador" },
                 { id: 51, name: "Pomidor", unit: "KG", unitDecimals: 3, stock: 4.1, minQuantity: 0, cost: 20000, stockValue: 82000,
                   usedToday: 3.5, avgDaily: 3.3, daysLeft: 1.2, dishes: ["Achchiq-chuchuk"], stopDish: true, supplierId: null, supplierName: null },
                 { id: 52, name: "Guruch", unit: "KG", unitDecimals: 3, stock: 18, minQuantity: 0, cost: 22000, stockValue: 396000,
                   usedToday: 4.6, avgDaily: 4.8, daysLeft: 3.7, dishes: ["Osh"], stopDish: false, supplierId: 1, supplierName: "Chorvador" }],
               orders: [{ supplierId: 1, supplierName: "Chorvador", phone: "+998901112233", sum: 1620000,
                          lines: [{ productId: 50, name: "Mol go'shti", unit: "KG", qty: 18.1, sum: 1620000 }] },
                        { supplierId: null, supplierName: null, phone: null, sum: 116000,
                          lines: [{ productId: 51, name: "Pomidor", unit: "KG", qty: 5.8, sum: 116000 }] }],
               shortages: [{ ingredientId: 53, name: "Lag'mon xamiri", unit: "KG", qty: 2.5, times: 4, lastAt: new Date().toISOString() }] };
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
  console.log("\n§15c Restoran masalliqlari (E4, 2026-10-10)");
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/ingredients", ready: "body" });
    await waitFor(page, () => /Qancha bor/.test(document.body.innerText) && /Mol go'shti/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /bugun tugaydi/.test(txt) && /1,2 kun — buyurtma bering/.test(txt) && /3,7 kun/.test(txt)
      ? ok("necha kunga yetadi: bugun tugaydi / buyurtma bering / yetarli") : no("kunlar", txt.slice(0, 600));
    /tushumning 31%i/.test(txt) && /2 xil/.test(txt) && /1 holat/.test(txt)
      ? ok("raqamlar: sarf tushumga nisbatan, tez tugaydi, kamomad") : no("KPI", txt.slice(0, 500));
    /stop-listda/.test(txt) ? ok("stop-listdagi taom masalliq qatorida belgilangan") : no("stop belgisi", "");
    /Chorvador/.test(txt) && /Yetkazuvchi ko'rsatilmagan/.test(txt) && /Mol go'shti 18,1 kg/.test(txt)
      ? ok("ertaga uchun buyurtma — yetkazuvchi bo'yicha, yetkazuvchisizlari alohida") : no("buyurtma", txt.slice(-700));
    /Lag'mon xamiri/.test(txt) && /4 marta/.test(txt) ? ok("kamomad ro'yxati") : no("kamomad", txt.slice(-400));
    const title = await page.evaluate(() => document.querySelector(".topbar-title")?.innerText || "");
    /Masalliqlar/.test(title) ? ok("sarlavha: «Masalliqlar»") : no("sarlavha", title);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-ingredients.png`, fullPage: true });

    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Faqat kam qolganlar/.test(b.innerText))?.click());
    (await waitFor(page, () => !/Guruch/.test(document.querySelector("table")?.innerText || "x")
        && /Pomidor/.test(document.querySelector("table")?.innerText || ""), 3000))
      ? ok("«Faqat kam qolganlar» — yetarlisi yashirindi") : no("filtr", await page.evaluate(() => document.querySelector("table")?.innerText.slice(0, 300)));

    await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Telegramga/.test(b.innerText))?.click());
    await waitFor(page, () => (window.__opened || []).length > 0, 3000);
    const url = await page.evaluate(() => (window.__opened || [])[0] || "");
    /^https:\/\/t\.me\/share\/url\?/.test(url) && decodeURIComponent(url).includes("Buyurtma: Chorvador")
      && decodeURIComponent(url).includes("Mol go'shti — 18,1 kg")
      ? ok("«Telegramga» — yetkazuvchiga tayyor matn bilan ulashish oynasi") : no("telegram", url.slice(0, 200));
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: false, path: "/ingredients", ready: "body" });
    await waitFor(page, () => location.pathname !== "/ingredients", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/inventory" ? ok("do'konda /ingredients → /inventory") : no("do'konda masalliq", at);
    await page.close();
  }
}

{
  console.log("\n§15d Restoran buyurtmalari (E5, 2026-10-10)");
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/orders", ready: "body" });
    await waitFor(page, () => /Stol 12/.test(document.body.innerText) && /Vaqt chizig'i/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /Hisob berildi/.test(txt) && /Olib ketish/.test(txt) && /Bekor qilingan/.test(txt) && /Chek #901/.test(txt)
      ? ok("ro'yxat: ochiq, hisob berilgan, olib ketish, bekor — holat nomi bilan") : no("ro'yxat", txt.slice(0, 600));
    const tabs = await page.evaluate(() => [...document.querySelectorAll("[role=tablist] [role=tab]")].map((b) => b.innerText.replace(/\s+/g, " ").trim()).join("|"));
    /Ochiq 2/.test(tabs) && /To'langan 1/.test(tabs) && /Bekor 1/.test(tabs) ? ok("filtrlar soni bilan: " + tabs) : no("filtrlar", tabs);

    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => /Stol 3/.test(r.innerText))?.click());
    (await waitFor(page, () => /1-kurs/i.test(document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || "") && /Tug'ilgan kun/.test(document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || ""), 4000))
      ? ok("tafsilot: kurslar va izoh") : no("tafsilot", await page.evaluate(() => document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText.slice(0, 400)));
    const aside = await page.evaluate(() => document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || "");
    /Katta/.test(aside) && /M1/.test(aside) && /oshxonaga ketmagan/.test(aside) ? ok("qo'shimcha, mehmon raqami, oshxonaga ketmagan taom") : no("qator", aside.slice(0, 500));
    /Oshxonaga: Oshxona \(5 ta\)/.test(aside) && /Tayyor: Oshxona/.test(aside) && /Hisob berildi/.test(aside) && /60 daqiqa/.test(aside)
      ? ok("vaqt chizig'i: ochildi → oshxona → tayyor → hisob, davomiyligi bilan") : no("vaqt chizig'i", aside.slice(-400));
    const openHref = await page.evaluate(() => [...document.querySelectorAll("aside[aria-label='Buyurtma tafsiloti'] a")].find((a) => /Stolni ochish/.test(a.innerText))?.getAttribute("href"));
    openHref === "/restaurant/table/3" ? ok("ochiq hisob — «Stolni ochish» → stol ekrani") : no("stolni ochish", String(openHref));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-orders.png`, fullPage: true });

    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => /Stol 2/.test(r.innerText))?.click());
    (await waitFor(page, () => /Xizmat haqi/.test(document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || "") && /Choy puli/.test(document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || ""), 4000))
      ? ok("to'langan: xizmat haqi, jami, choy puli, to'lov turi") : no("to'langan", await page.evaluate(() => document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText.slice(0, 400)));

    await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find((b) => /Olib ketish/.test(b.innerText))?.click());
    (await waitFor(page, () => document.querySelectorAll("tbody tr").length === 1 && /Somsa/.test(document.querySelector("aside[aria-label='Buyurtma tafsiloti']")?.innerText || ""), 4000))
      ? ok("«Olib ketish» filtri — stolsiz sotuv va uning cheki") : no("olib ketish", await page.evaluate(() => document.body.innerText.slice(0, 300)));
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, role: "CASHIER", path: "/orders", ready: "body" });
    await waitFor(page, () => location.pathname !== "/orders", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/sales" ? ok("kassir: /orders → /sales (hisobot ma'lumoti yopiq)") : no("kassir buyurtmalar", at);
    await page.close();
  }
}

{
  console.log("\n§15e Restoran hisoboti (E6, 2026-10-10)");
  {
    const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/restaurant-report", ready: "body" });
    await waitFor(page, () => /Tushum qayerdan keldi/.test(document.body.innerText) && /Qozon kabob/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /▲ 9% oldingi shuncha kunga/.test(txt) && /31,4%/.test(txt) && /2,6 marta/.test(txt)
      ? ok("raqamlar: o'sish, tannarx ulushi, stol aylanmasi") : no("KPI", txt.slice(0, 600));
    /Zalda/.test(txt) && /72%/.test(txt) && /Olib ketish/.test(txt) && /Yetkazish/.test(txt)
      ? ok("tushum manbalari ulush bilan") : no("manba", txt.slice(0, 800));
    /Xizmat haqi/.test(txt) && /Choy puli/.test(txt) && /Sanash kamomadi/.test(txt) && /Qaytarilgan cheklar — 3 ta/.test(txt) && /4 ta/.test(txt)
      ? ok("tushumdan tashqari pul va yo'qotishlar") : no("yo'qotishlar", txt.slice(0, 1200));
    /A: 2 ta taom/.test(txt) && /C: 1 ta taom/.test(txt) && /60%/.test(txt) ? ok("ABC: guruhlar xulosasi, yuqori tannarx ulushi") : no("ABC", txt.slice(-800));
    /\d{4}-\d{2}-\d{2}/.test(calls.report?.[0] || "") && /from=/.test(calls.report?.[0] || "") && /to=/.test(calls.report?.[0] || "")
      ? ok("davr serverga kun bilan ketdi: " + calls.report[0]) : no("davr", String(calls.report));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-report.png`, fullPage: true });

    await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find((b) => /^Ofitsiantlar$/.test(b.innerText.trim()))?.click());
    (await waitFor(page, () => /kim yaxshi xizmat/.test(document.body.innerText) && /54 daq/.test(document.body.innerText), 3000))
      ? ok("ofitsiantlar: ish kunlari, mehmon boshiga, stolda o'rtacha vaqt") : no("ofitsiantlar", await page.evaluate(() => document.body.innerText.slice(-600)));

    await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find((b) => /Zal va vaqt/.test(b.innerText))?.click());
    (await waitFor(page, () => /Zal qachon to'la/.test(document.body.innerText), 3000)) ? ok("zal bandligi jadvali") : no("zal", "");
    const cells = await page.evaluate(() => [...document.querySelectorAll("td[title]")].filter((c) => c.innerText.trim()).map((c) => c.title).join("|"));
    /Ju 13:00 — 88%/.test(cells) && /Sh 20:00 — 99%/.test(cells) ? ok("katakda raqam ham bor (rang yolg'iz emas)") : no("kataklar", cells.slice(0, 300));
    /Stol 5/.test(await page.evaluate(() => document.body.innerText)) ? ok("stollar ro'yxati") : no("stollar", "");
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-report-hall.png`, fullPage: true });
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: false, path: "/restaurant-report", ready: "body" });
    await waitFor(page, () => location.pathname !== "/restaurant-report", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/reports" ? ok("do'konda /restaurant-report → /reports") : no("do'konda hisobot", at);
    await page.close();
  }
}

{
  console.log("\n§15f Restoran xodimlari (E7, 2026-10-10)");
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/staff", ready: "body" });
    await waitFor(page, () => /Hamma xodimlar/.test(document.body.innerText) && /Dilnoza Karimova/.test(document.body.innerText), 8000);
    const txt = await page.evaluate(() => document.querySelector("main, .main, body")?.innerText || "");
    /Hozir smenada 3 kishi/.test(txt) && /9 stol/.test(txt) && /41 chek/.test(txt) && /oshxona ekranida/.test(txt)
      ? ok("smenadagilar: ofitsiant — stollar, kassir — cheklar, oshpaz") : no("smenada", txt.slice(0, 600));
    /yo'q — terminalga kira olmaydi/.test(txt) && /parol bilan kiradi/.test(txt) && /o'chirilgan/.test(txt)
      ? ok("PIN: oshpazda yo'q (ogohlantirish), rahbar parol bilan, o'chirilgan xodim belgilangan") : no("PIN", txt.slice(0, 1200));
    /Stol ochish, taom qo'shish/.test(txt) && /Faqat oshxona ekrani/.test(txt) ? ok("har rol nima qila oladi") : no("rol", "");
    /240\s000/.test(txt) && /95\s000/.test(txt) && /6 chek/.test(txt) ? ok("bugungi choy puli: naqd, karta, ofitsiant bo'yicha") : no("choy puli", txt.slice(-600));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-staff.png`, fullPage: true });

    await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find((b) => /Oshpazlar/.test(b.innerText))?.click());
    (await waitFor(page, () => { const t = document.querySelector("table")?.innerText || ""; return /Bekzod/.test(t) && !/Dilnoza/.test(t); }, 3000))
      ? ok("«Oshpazlar» filtri") : no("filtr", await page.evaluate(() => document.querySelector("table")?.innerText.slice(0, 200)));

    await page.evaluate(() => { window.__doc = ""; window.open = () => ({ document: { write: (h) => { window.__doc += h; }, close: () => {} } }); });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Taqsimotni chop etish/.test(b.innerText))?.click());
    const doc = await page.evaluate(() => window.__doc || "");
    /Choy puli taqsimoti/.test(doc) && /Dilnoza Karimova/.test(doc) && /Ali &lt;b&gt;/.test(doc) && !/Ali <b>/.test(doc)
      ? ok("chop etish: taqsimot hujjati, ism HTML'ga qochirilgan") : no("chop etish", doc.slice(0, 300));
    const href = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => /Xodim qo'shish/.test(a.innerText))?.getAttribute("href"));
    href === "/shop-users" ? ok("«Xodim qo'shish» → mavjud xodimlar oynasi") : no("qo'shish", String(href));
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: false, path: "/staff", ready: "body" });
    await waitFor(page, () => location.pathname !== "/staff", 6000);
    const at = await page.evaluate(() => location.pathname);
    at === "/shop-users" ? ok("do'konda /staff → /shop-users") : no("do'konda xodimlar", at);
    await page.close();
  }
}

{
  console.log("\n§15g Oshxonadan keyin bekor qilish (V162, 2026-10-11)");
  {
    const { page, calls } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/restaurant/table/12", sent: true });
    await waitFor(page, () => !!document.querySelector(".rt-line--sent"), 6000);
    const btn = await page.evaluate(() => !!document.querySelector(".rt-line--sent button[aria-label*='bekor qilish']"));
    btn ? ok("rahbar: oshxonaga ketgan qatorda «Bekor qilish» tugmasi") : no("bekor tugmasi", await page.evaluate(() => document.querySelector(".rt-line--sent")?.outerHTML.slice(0, 300)));
    await page.evaluate(() => document.querySelector(".rt-line--sent button[aria-label*='bekor qilish']")?.click());
    await waitFor(page, () => /Bekor qilish: burger/.test(document.body.innerText), 3000);
    const modal = await page.evaluate(() => document.body.innerText);
    /Mehmon voz kechdi/.test(modal) && /hisobotda yo'qotish/.test(modal) ? ok("oyna: sabablar va ogohlantirish") : no("oyna", modal.slice(-500));
    await page.evaluate(() => [...document.querySelectorAll("[role=radio]")].find((b) => /Sifati yomon/.test(b.innerText))?.click());
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /tasini bekor qilish/.test(b.innerText))?.click());
    (await waitFor(page, () => !/Bekor qilish: burger/.test(document.body.innerText), 4000)) && calls.voids?.[0]?.reason === "Sifati yomon"
      && calls.voids[0].quantity === 1 && calls.voids[0].productId === 7 && JSON.stringify(calls.voids[0].modifierIds) === "[22]"
      ? ok("serverga: taom, qo'shimchalar, soni va sabab") : no("bekor so'rovi", JSON.stringify(calls.voids));
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/restaurant-void.png` });
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, role: "WAITER", path: "/restaurant/table/12", sent: true });
    await waitFor(page, () => !!document.querySelector(".rt-line--sent"), 6000);
    const btn = await page.evaluate(() => !!document.querySelector(".rt-line--sent button"));
    !btn ? ok("ofitsiantda «Bekor qilish» yo'q (faqat rahbar)") : no("ofitsiantda bekor tugmasi", "");
    await page.close();
  }
  {
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path: "/kitchen", voidTicket: true, ready: "body" });
    await waitFor(page, () => /BEKOR/.test(document.body.innerText), 6000);
    const txt = await page.evaluate(() => document.body.innerText);
    /BEKOR — Pishirmang/.test(txt) && /Lag'mon/.test(txt) ? ok("oshxona ekranida «BEKOR — Pishirmang» qatori") : no("oshxona BEKOR", txt.slice(0, 500));
    await page.close();
  }
  {
    /* Yon panel (2026-10-11): rahbarda zal va oshxonada ham bor, hisobotda ham. */
    for (const path of ["/restaurant", "/kitchen", "/restaurant-report"]) {
      const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, path, ready: "body" });
      await waitFor(page, () => !!document.querySelector(".app-layout"), 6000);
      await new Promise((r) => setTimeout(r, 400));
      const full = await page.evaluate(() => document.querySelector(".app-layout")?.classList.contains("kassa-fullscreen"));
      !full ? ok(`rahbar: ${path} — yon panel bor`) : no(`${path} yon panelsiz`, "");
      await page.close();
    }
    const { page } = await openKassa({ restaurant: true, kitchen: true, tables: true, role: "WAITER", path: "/restaurant", ready: "body" });
    await waitFor(page, () => !!document.querySelector(".app-layout"), 6000);
    const full = await page.evaluate(() => document.querySelector(".app-layout")?.classList.contains("kassa-fullscreen"));
    full ? ok("faqat ofitsiant: zal to'liq ekranda (panel boshqa joy ochmaydi)") : no("ofitsiant zali", "");
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
