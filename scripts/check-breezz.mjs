/* ══════════════════════════════════════════════════════════════════════════
   BREEZZ ULANISHI — EGASI OYNASI (V139, E2′)

   ═══ NIMA TEKSHIRILADI ═══════════════════════════════════════════════════
   Egasi Breezz'ga do'konning butun katalogini shu oyna orqali ochadi.
   Bu yerdagi xato jim bo'ladi va qimmatga tushadi:

     · ID (shopRef) ko'rinmasa — egasi Breezz adminiga nima aytishini
       bilmaydi, ulanish umuman boshlanmaydi;
     · «boshqa Breezz do'koni uziladi» ogohlantirishi yo'qolsa — egasi
       bitta tasdiq bilan ishlab turgan ulanishni bilmasdan uzadi;
     · tasdiq so'rovi ketmasa yoki natija chizilmasa — egasi «tasdiqladim»
       deb o'ylaydi, Breezz esa kutib turaveradi;
     · menyudagi son yo'qolsa — so'rov 7 kundan keyin jimgina eskiradi;
     · oyna do'kon adminiga ochilsa — u egasining ishini qilolmaydi, lekin
       ko'radi.

   Ishga tushirish:  npm run build && node scripts/check-breezz.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4643;
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

const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

/* Bosh do'kon: «Old Market» bilan ulangan va «Qamashi Market» dan yangi
   so'rov bor — ya'ni tasdiq ESKISINI uzadi. Filial: ulanmagan, so'rovsiz. */
const LINK = { requestId: 7, merchantName: "Old Market", merchantAddress: "Qarshi",
               approvedAt: "2026-09-20T08:00:00Z", approvedBy: "egasi",
               keyIssued: true, lastUsedAt: "2026-09-25T09:30:00Z" };
const PENDING = { requestId: 11, merchantName: "Qamashi Market", merchantAddress: "Qamashi, Mustaqillik 1",
                  requestedBy: "Admin Sinov", createdAt: "2026-09-25T08:00:00Z",
                  expiresAt: "2026-10-02T08:00:00Z" };
const BEFORE = { shops: [
  { shopId: 1, shopName: "Bosh do'kon", branch: false, shopRef: "bz23456789", link: LINK, pending: [PENDING] },
  { shopId: 2, shopName: "Chilonzor", branch: true, shopRef: "bzabcdefgh", link: null, pending: [] },
], pendingCount: 1 };
const AFTER = { shops: [
  { ...BEFORE.shops[0], pending: [],
    link: { ...LINK, requestId: 11, merchantName: "Qamashi Market", lastUsedAt: null, keyIssued: false } },
  BEFORE.shops[1],
], pendingCount: 0 };

/** Sahifani ochadi. `role` — kim sifatida; `calls` — Breezz so'rovlari yig'iladi. */
async function open(role, calls, pageErrors) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.setRequestInterception(true);
  let state = BEFORE;
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const url = r.url();
    let data = [];
    if (url.includes("/shop/breezz")) {
      calls.push(`${r.method()} ${url.slice(url.indexOf("/shop/breezz"))}`);
      if (url.includes("/approve")) state = AFTER;
      data = url.includes("/pending-count") ? state.pendingCount : state;
    }
    return r.respond({ status: 200, contentType: "application/json", headers: CORS,
                       body: JSON.stringify({ success: true, data }) });
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.evaluateOnNewDocument((ekRole) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: ekRole, ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
  }, role);
  await page.goto(`http://127.0.0.1:${PORT}/breezz`, { waitUntil: "networkidle2", timeout: 30_000 });
  return page;
}

console.log("\n══ BREEZZ ULANISHI — EGASI OYNASI (V139) ══");

/* ── EGASI ─────────────────────────────────────────────────────────── */
const calls = [];
const errors = [];
const page = await open("OWNER", calls, errors);
await page.waitForSelector(".breezz-card", { timeout: 10_000 }).catch(() => {});

const cards = await page.$$eval(".breezz-card", (els) => els.map((el) => ({
  title: el.querySelector(".breezz-card__title")?.textContent.trim(),
  ref: el.querySelector(".breezz-ref__value")?.textContent.trim(),
  refIsNum: el.querySelector(".breezz-ref__value")?.classList.contains("ek-num"),
  status: el.querySelector(".breezz-status")?.textContent.replace(/\s+/g, " ").trim(),
  linked: el.querySelector(".breezz-status")?.classList.contains("is-linked"),
  warn: el.querySelector(".breezz-warn")?.textContent.trim() || null,
  reqs: el.querySelectorAll(".breezz-req").length,
  times: el.querySelectorAll(".breezz-status .ek-num, .breezz-req .ek-num").length,
})));

console.log("\n§1 Bosh do'kon va filial — har biri o'z ID si bilan");
cards.length === 2 ? ok("ikkita kartochka") : no("ikkita kartochka bo'lishi kerak", cards.length);
cards[0]?.ref === "bz23456789" && cards[1]?.ref === "bzabcdefgh"
  ? ok("ID lar chizildi") : no("ID ko'rinishi kerak", `${cards[0]?.ref} / ${cards[1]?.ref}`);
cards.every((c) => c.refIsNum) ? ok("ID `.ek-num` bilan (2-qoida)") : no("ID `.ek-num` bo'lishi kerak", "yo'q");

console.log("\n§2 Holat — rang bilan emas, MATN bilan ham (6-qoida)");
/Ulangan/.test(cards[0]?.status || "") && /Old Market/.test(cards[0]?.status || "")
  ? ok("«Ulangan: Old Market» yozildi") : no("ulanish matni bo'lishi kerak", cards[0]?.status);
/Ulanmagan/.test(cards[1]?.status || "") && !cards[1]?.linked
  ? ok("filial: «Ulanmagan»") : no("«Ulanmagan» bo'lishi kerak", cards[1]?.status);
cards[0]?.times >= 3 ? ok(`vaqtlar \`.ek-num\` bilan (${cards[0].times})`) : no("vaqtlar `.ek-num` bo'lishi kerak", cards[0]?.times);

console.log("\n§3 ⚠ Tasdiq ESKI ulanishni uzishini oldindan aytadi (4-qoida)");
cards[0]?.reqs === 1 ? ok("kutayotgan so'rov chizildi") : no("bitta so'rov bo'lishi kerak", cards[0]?.reqs);
/Old Market/.test(cards[0]?.warn || "") ? ok(`ogohlantirish: «${cards[0].warn}»`) : no("ogohlantirish bo'lishi kerak", cards[0]?.warn);

console.log("\n§4 Menyuda son — so'rov jimgina eskirmasin");
const tab = await page.evaluate(() => {
  const el = [...document.querySelectorAll(".pg-tabs a")].find((a) => /Breezz/.test(a.textContent));
  return el ? { text: el.textContent.replace(/\s+/g, " ").trim(), badge: el.querySelector(".tab-badge")?.textContent.trim() } : null;
});
tab?.badge === "1" ? ok(`«Breezz» tab'ida son: ${tab.badge}`) : no("tab'da 1 soni bo'lishi kerak", JSON.stringify(tab));

console.log("\n§5 Tasdiq: oyna → so'rov → yangi holat");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".breezz-req .btn-primary")][0];
  btn?.click();
});
await page.waitForSelector(".modal-box", { timeout: 5_000 }).catch(() => {});
const dialog = await page.evaluate(() => document.querySelector(".modal-box")?.textContent.replace(/\s+/g, " ") || "");
/Qamashi Market/.test(dialog) && /Old Market/.test(dialog)
  ? ok("tasdiq oynasi yangi va eski do'konni aytadi") : no("oynada ikkala nom bo'lishi kerak", dialog.slice(0, 160));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".modal-box .btn")];
  btns[btns.length - 1]?.click();
});
await page.waitForFunction(() => document.querySelectorAll(".breezz-req").length === 0, { timeout: 5_000 }).catch(() => {});
calls.some((c) => c === "POST /shop/breezz/requests/11/approve")
  ? ok("POST …/requests/11/approve yuborildi") : no("tasdiq so'rovi ketishi kerak", calls.join(", "));
const after = await page.$$eval(".breezz-card", (els) => els.map((el) => ({
  status: el.querySelector(".breezz-status")?.textContent.replace(/\s+/g, " ").trim(),
  reqs: el.querySelectorAll(".breezz-req").length,
})));
after[0]?.reqs === 0 && /Qamashi Market/.test(after[0]?.status || "")
  ? ok("yangi holat chizildi: «Ulangan: Qamashi Market»") : no("yangi holat chizilishi kerak", JSON.stringify(after[0]));
/tovarlarni olmagan/.test(after[0]?.status || "")
  ? ok("«Breezz hali tovarlarni olmagan» — sinxron bo'lmagani aytildi") : no("sinxron holati aytilishi kerak", after[0]?.status);

console.log("\n§6 Sahifa xatolari");
errors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", errors.join(" | "));
await page.close();

/* ── DO'KON ADMINI ─────────────────────────────────────────────────── */
console.log("\n§7 ⚠ Do'kon admini — oyna ham, so'rov ham YO'Q (faqat egasi)");
const adminCalls = [];
const adminErrors = [];
const adminPage = await open("SHOP_ADMIN", adminCalls, adminErrors);
await new Promise((r) => setTimeout(r, 800));
const adminView = await adminPage.evaluate(() => ({
  cards: document.querySelectorAll(".breezz-card").length,
  nav: [...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/breezz"),
}));
adminView.cards === 0 ? ok("kartochka chizilmadi") : no("admin oynani ko'rmasligi kerak", adminView.cards);
!adminView.nav ? ok("menyuda «Breezz» yo'q") : no("menyuda bo'lmasligi kerak", "bor");
adminCalls.length === 0 ? ok("serverga Breezz so'rovi ketmadi (son ham so'ralmadi)") : no("so'rov ketmasligi kerak", adminCalls.join(", "));
await adminPage.close();

await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Breezz oynasi: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
