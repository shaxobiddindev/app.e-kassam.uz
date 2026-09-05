/* ══════════════════════════════════════════════════════════════════════════
   EKRAN KLAVIATURASI — BROUZERDA TEKSHIRUV (V67)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   Do'kon egasi: «ekran klaviaturalari ochilganda boshqa oynalar tagida
   qolib ketmasligi uchun nimadir o'ylab topish kerak».

   Klaviatura `z-index: 900`, oynalar 600 — qog'ozda hammasi joyida.
   Amalda esa `z-index` FAQAT o'z «stacking context» ida ishlaydi:
   klaviatura `#root` daraxtida chizilgani uchun undagi istalgan
   `transform`/`filter` butun klaviaturani portal orqali chiqqan
   oynaning ostiga tushirib yuborardi. Shuning uchun bu yerda RAQAM
   emas, HAQIQAT o'lchanadi: klaviatura ustidagi nuqtada
   `elementFromPoint` nima qaytaradi.

   Yana uchtasi shu yerda:
     · `000` tugmasi bor va u haqiqatan uch nol yozadi;
     · OYNA ICHIDA klaviatura QOLMAGAN (ikkitasi ustma-ust tushardi);
     · to'lov va jamg'arma oynalari HAR SAFAR mijozsiz ochiladi —
       eski mijoz qolsa, begona odamga keshbek yozilardi.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-osk.mjs
     SHOT_DIR=/tmp/shots — skrinshotlar uchun.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname, ".."); const DIST = path.join(ROOT, "dist"); const PORT = 4615;
const SHOT = process.env.SHOT_DIR || null;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => { const url = req.url.split("?")[0]; let file = path.join(DIST, url === "/" ? "index.html" : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(fs.readFileSync(file)); });
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server", "--hide-scrollbars"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CUST = { id: 5, fullName: "Рустам", phone: "+998901234567", savingsBalance: 5000, balance: 0 };
const ITEMS = [{ id: 1, name: "Tovar", salePrice: 10000, qty: 1, unit: "DONA", stockQuantity: 50 }];
const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 768, hasTouch: true, isMobile: false });
await page.setRequestInterception(true);
page.on("request", (r) => { if (!r.url().includes("/api/")) return r.continue();
  const C = { "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": r.headers()["access-control-request-headers"] || "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: C });
  const u = r.url(); let body = { success: true, data: [] };
  if (u.includes("/shop/profile")) body = { success: true, data: { creditEnabled: true } };
  else if (/\/customers(\?|$)/.test(u)) body = { success: true, data: [CUST] };
  return r.respond({ status: 200, contentType: "application/json", headers: C, body: JSON.stringify(body) }); });
page.on("pageerror", (e) => console.log("   [ERR]", e.message));
await page.evaluateOnNewDocument((items) => {
  for (const [k, v] of Object.entries({ ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    ek_touchMode: "on" })) localStorage.setItem(k, v);
  localStorage.setItem("ek_cart_v_v", JSON.stringify({ savedAt: Date.now(), v: 3, activeId: 1,
    carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items }] }));
}, ITEMS);
await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2" }); await sleep(1200);

let ok = 0, bad = 0;
const yes = (c, m, g) => { if (c) { ok++; console.log("  ✅ " + m); } else { bad++; console.log("  ❌ " + m + " → " + g); } };

/* Klaviatura ochiq bo'lgan holatda uning ustidagi nuqtada NIMA borligini
   o'lchaymiz: agar modal chiqsa — klaviatura tagida qolgan. */
/* ⚠ ASOSIY MEZON (V67): klaviatura oynani BOSMASLIGI kerak. Ustida
   turishning o'zi yetarli emas — do'kon egasi rasmda ko'rsatgan holatda
   klaviatura to'lov turlarini va summa maydonini yopib turgan edi.
   Shuning uchun ikkita to'rtburchakning KESISHUVI o'lchanadi. */
const overlap = () => page.evaluate(() => {
  const osk = document.querySelector(".osk");
  const box = document.querySelector(".pay-modal-box") || document.querySelector(".modal-box");
  if (!osk || !box) return null;
  const a = osk.getBoundingClientRect(), b = box.getBoundingClientRect();
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return {
    px: w > 0 && h > 0 ? Math.round(w * h) : 0,
    w: Math.round(w), h: Math.round(h),
    box: `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}`,
    osk: `${Math.round(a.left)},${Math.round(a.top)} ${Math.round(a.width)}×${Math.round(a.height)}`,
  };
});

const probe = () => page.evaluate(() => {
  const osk = document.querySelector(".osk");
  if (!osk) return { open: false };
  const r = osk.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + 20);
  const hit = document.elementFromPoint(x, y);
  const inOsk = !!hit?.closest(".osk");
  const parent = osk.parentElement;
  return {
    open: true, inOsk,
    hitClass: hit ? (hit.className?.baseVal ?? hit.className ?? hit.tagName) : null,
    parentTag: parent === document.body ? "BODY" : (parent?.id || parent?.className || parent?.tagName),
    zOsk: getComputedStyle(osk).zIndex,
    modalZ: (() => { const m = document.querySelector(".pay-modal-overlay"); return m ? getComputedStyle(m).zIndex : null; })(),
  };
});

console.log("── A. To'lov oynasi ichidagi maydon ──");
await page.keyboard.press("F9"); await sleep(700);
yes(!!(await page.$("#pay-amount")), "to'lov oynasi ochildi");
await page.evaluate(() => document.querySelector("#pay-amount")?.focus()); await sleep(500);
let p = await probe();
yes(p.open, "ekran klaviaturasi ochildi", JSON.stringify(p));
console.log(`     osk z=${p.zOsk}, modal z=${p.modalZ}, ota=${p.parentTag}`);
yes(p.inOsk, "klaviatura ustidagi nuqta klaviaturaning O'ZI (tagida qolmagan)", `nuqtada: ${p.hitClass}`);
{
  const o = await overlap();
  yes(o && o.px === 0, `oyna va klaviatura KESISHMAYDI (oyna ${o?.box}, klaviatura ${o?.osk})`,
      `${o?.w}×${o?.h}px kesishdi`);
}
SHOT && await page.screenshot({ path: `${SHOT}/v67-osk-pay.png` });

console.log("\n── A2. TOR MONOBLOK (1024×768) ──");
{
  /* ⚠ Kassa monobloklarining ko'pi shu o'lchamda: bu yerda oyna
     chapga sig'maydi, shuning uchun u YUQORIGA chiqib, balandligi
     klaviaturadan qolgan joyga moslanadi. */
  await page.setViewport({ width: 1024, height: 768, hasTouch: true });
  await sleep(600);
  await page.evaluate(() => document.querySelector("#pay-amount")?.focus()); await sleep(500);
  const o = await overlap();
  yes(o && o.px === 0, `1024×768: kesishmaydi (oyna ${o?.box}, klaviatura ${o?.osk})`,
      `${o?.w}×${o?.h}px kesishdi`);
  const body = await page.evaluate(() => {
    const b = document.querySelector(".pay-modal-body");
    return b ? b.scrollHeight - b.clientHeight : -1;
  });
  const dbg = await page.evaluate(() => {
    const b = document.querySelector(".pay-modal-body");
    const box = document.querySelector(".pay-modal-box");
    const grid = document.querySelector(".pay-grid");
    return { fit: box?.dataset.fit, zoom: grid?.style.zoom || "-",
             boxMax: getComputedStyle(box).maxHeight, boxH: Math.round(box.getBoundingClientRect().height),
             bodyC: b?.clientHeight, bodyS: b?.scrollHeight,
             oskH: getComputedStyle(document.documentElement).getPropertyValue("--osk-h") };
  });
  console.log("     debug:", JSON.stringify(dbg));
  yes(body <= 1, "va oynada scrol ham yo'q", body + "px ortiqcha");
  SHOT && await page.screenshot({ path: `${SHOT}/v67-osk-1024.png` });
  await page.setViewport({ width: 1366, height: 768, hasTouch: true }); await sleep(500);
}

console.log("\n── B. Oyna ustidagi oyna (jamg'arma) ──");
await page.keyboard.press("Escape"); await sleep(300);
await page.keyboard.down("Alt"); await page.keyboard.press("j"); await page.keyboard.up("Alt"); await sleep(600);
await page.evaluate(() => document.querySelector(".pay-modal-box--lite .qty-modal__input")?.focus()); await sleep(500);
p = await probe();
yes(p.open, "jamg'arma oynasida ham klaviatura ochildi", JSON.stringify(p));
yes(p.inOsk, "u ham oyna USTIDA", `nuqtada: ${p.hitClass}`);
{
  const o = await overlap();
  yes(o && o.px === 0, `jamg'arma oynasi ham kesishmaydi (oyna ${o?.box})`, `${o?.w}×${o?.h}px kesishdi`);
}
SHOT && await page.screenshot({ path: `${SHOT}/v67-osk-topup.png` });

console.log("\n── C. `000` tugmasi va ichki klaviaturalar ──");
{
  /* ⚠ Bu bo'lim RAQAMLI rejim ochiq turganda bajariladi (`000` faqat
     o'sha yerda bo'ladi) — shuning uchun u harfli klaviatura sinovidan
     OLDIN turadi. */
  const st = await page.evaluate(() => ({
    zeros: !!document.querySelector(".osk__key--zeros"),
    clear: [...document.querySelectorAll(".osk__key--fn")].map((b) => b.textContent.trim()),
    inModal: document.querySelectorAll(".pay-modal-box .qty-modal__keys, .pay-lite__keys").length,
    oskKeys: [...document.querySelectorAll(".osk__key")].map((b) => b.textContent.trim()),
  }));
  yes(st.zeros, "klaviaturada «000» tugmasi bor");
  yes(st.clear.some((x) => /Tozalash/i.test(x)), "«Tozalash» (C) tugmasi bor: " + st.clear.join("|"), st.clear.join("|"));
  yes(st.inModal === 0, "oyna ICHIDA klaviatura qolmagan", st.inModal + " ta topildi");
  // `000` haqiqatan uch nol yozadimi
  await page.evaluate(() => {
    const f = document.querySelector(".pay-modal-box--lite .qty-modal__input") || document.querySelector("#pay-amount");
    f.focus();
  });
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll(".osk__key")].find((b) => b.textContent.trim() === "5")?.click());
  await page.evaluate(() => document.querySelector(".osk__key--zeros")?.click());
  await sleep(250);
  const val = await page.evaluate(() => (document.querySelector(".pay-modal-box--lite .qty-modal__input") || document.querySelector("#pay-amount"))?.value);
  yes((val || "").replace(/\D/g, "") === "5000", "5 + 000 → 5 000 yozildi: " + val, val);
}

console.log("\n── B2. HARFLI klaviatura va ochilgan ro'yxat ──");
{
  /* ⚠ Harfli pad BUTUN KENGLIKDA pastda turadi — raqamlidan boshqa
     holat. Do'kon egasi ko'rsatgan rasm aynan shu: mijoz qidiruvi
     ochilgan-u, ro'yxat klaviatura ostida qolgan. */
  await page.click(".pay-modal-box--lite .ek-select__btn"); await sleep(500);
  /* Kassir qidiruv maydoniga TEGADI — shunda klaviatura harfliga o'tadi. */
  await page.click(".ek-select__search input"); await sleep(600);
  const st = await page.evaluate(() => {
    const osk = document.querySelector(".osk");
    const menu = document.querySelector(".ek-select__menu, .ek-select__pop, [role='listbox']");
    if (!osk || !menu) return null;
    const a = osk.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const w = Math.min(a.right, m.right) - Math.max(a.left, m.left);
    const h = Math.min(a.bottom, m.bottom) - Math.max(a.top, m.top);
    return { text: osk.classList.contains("osk--text"), over: w > 0 && h > 0 ? Math.round(w * h) : 0,
             menu: `${Math.round(m.top)}..${Math.round(m.bottom)}`, oskTop: Math.round(a.top) };
  });
  yes(st && st.text, "qidiruv maydonida HARFLI klaviatura ochildi", JSON.stringify(st));
  yes(st && st.over === 0, `mijoz ro'yxati klaviatura ostida QOLMADI (ro'yxat ${st?.menu}, klaviatura ${st?.oskTop} dan)`,
      `${st?.over}px kesishdi`);
  SHOT && await page.screenshot({ path: `${SHOT}/v67-osk-select.png` });
  await page.keyboard.press("Escape"); await sleep(300);
}

console.log("\n── C2. Fokus ketsa klaviatura YOPILADI (V68) ──");
{
  /* ⚠ Bo'lim O'ZI oyna ochadi: oldingi bo'lim qanday tugaganiga
     bog'lanib qolish sinovni mo'rt qiladi (bir marta boshdan
     kechirilgan). */
  for (let i = 0; i < 6 && (await page.$(".pay-modal-box")); i++) {
    await page.keyboard.press("Escape"); await sleep(250);
  }
  await page.keyboard.press("F9");
  await page.waitForSelector("#pay-amount", { timeout: 5000 });
  await sleep(200);
  await page.evaluate(() => document.querySelector("#pay-amount")?.focus());
  await sleep(400);
  yes(!!(await page.$(".osk")), "maydonda klaviatura ochiq");

  /* Klaviatura TUGMASI fokusni olmaydi — u yopilmasligi kerak. */
  await page.evaluate(() => [...document.querySelectorAll(".osk__key")].find((b) => b.textContent.trim() === "7")?.click());
  await sleep(300);
  yes(!!(await page.$(".osk")), "tugma bosilganda YOPILMAYDI");

  /* Maydondan tashqariga — yopiladi. */
  await page.evaluate(() => document.activeElement?.blur?.());
  await sleep(500);
  yes(!(await page.$(".osk")), "fokus ketgach klaviatura yopildi", "hali ochiq");

  /* Maydondan maydonga o'tish klaviaturani yonib-o'chirmaydi. */
  await page.evaluate(() => document.querySelector("#pay-amount")?.focus());
  await sleep(350);
  const before = !!(await page.$(".osk"));
  await page.evaluate(() => {
    const a = document.querySelector("#pay-amount");
    a?.blur(); a?.focus();
  });
  await sleep(200);
  yes(before && !!(await page.$(".osk")), "maydondan maydonga o'tganda ochiq qoladi");
}

console.log("\n── D. Mijoz har ochilishda tozalanadi ──");
{
  /* Haqiqiy oqim: to'lov oynasida mijoz tanlanadi, oyna yopiladi va
     qaytadan ochiladi — eski mijoz qolmasligi kerak. */
  /* ⚠ OYNA OCHILGANINI KUTAMIZ, ko'r-ko'rona bosmaymiz. Ilgari bu yerda
     `press` + qat'iy `sleep` turardi va u SKRINSHOTSIZ ishga tushirilganda
     yiqilardi: skrinshot olish qo'shimcha vaqt bergani uchun xato faqat
     `SHOT_DIR` siz chiqar — ya'ni aynan `npm run check` da. */
  for (let i = 0; i < 6 && (await page.$(".pay-modal-box")); i++) {
    await page.keyboard.press("Escape"); await sleep(250);
  }
  await page.keyboard.press("F9");
  await page.waitForSelector(".cart-cust .ek-select__btn", { timeout: 5000 });
  await sleep(200);
  await page.click(".cart-cust .ek-select__btn");
  await page.waitForSelector(".ek-select__opt", { timeout: 5000 });
  await page.evaluate(() => [...document.querySelectorAll(".ek-select__opt")].find((o) => /Рустам/.test(o.textContent))?.click());
  await sleep(500);
  const picked = await page.evaluate(() => document.querySelector(".cart-cust .ek-select__btn")?.textContent.trim() || "");
  yes(/Рустам/.test(picked), "oynada mijoz tanlandi: " + picked, picked);

  await page.keyboard.press("Escape"); await sleep(500);
  await page.keyboard.press("F9");
  await page.waitForSelector(".cart-cust .ek-select__btn", { timeout: 5000 });
  await sleep(250);
  const again = await page.evaluate(() => document.querySelector(".cart-cust .ek-select__btn")?.textContent.trim() || "");
  yes(!/Рустам/.test(again), "qayta ochilganda mijoz TOZALANGAN: «" + again + "»", again);

  /* Jamg'arma oynasi ham har safar bo'sh ochiladi. */
  await page.keyboard.press("Escape"); await sleep(400);
  await page.keyboard.down("Alt"); await page.keyboard.press("j"); await page.keyboard.up("Alt");
  await page.waitForSelector(".pay-modal-box--lite", { timeout: 5000 });
  await sleep(250);
  const sav = await page.evaluate(() => ({
    need: !!document.querySelector(".cart-cust--bare.is-needed"),
    title: document.querySelector(".pay-modal-box--lite .pay-modal-title")?.textContent.trim() || "",
  }));
  yes(sav.need && !/Рустам/.test(sav.title), "jamg'arma oynasi ham mijozSIZ ochildi: «" + sav.title + "»", JSON.stringify(sav));
}

console.log(`\n  ${bad ? "❌ " + bad + " yiqildi" : "✅ HAMMASI O'TDI"} (${ok} o'tdi)`);
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
