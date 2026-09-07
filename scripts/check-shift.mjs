/* ══════════════════════════════════════════════════════════════════════════
   SMENA OGOHLANTIRISHI JOY EGALLAMAYDI (V83)

   ═══ NIMA SO'RALGAN ════════════════════════════════════════════════════

   Do'kon: «bu smena ma'lumoti bu joydan olib tashlash kerak, chunki bu
   joyni isrof qilyapti — shuni smena tugmasiga hover bo'lganda
   chiqadigan qilish kerak».

   Ogohlantirish JAMI bilan to'lov tugmasi orasida ikki qatorli sariq
   quti bo'lib turardi. Kassa ekranida har piksel tovarlar
   ro'yxatidan olinadi.

   ═══ ⚠ NEGA BRAUZER SINOVI, MATN QIDIRUV EMAS ══════════════════════════

   Hover maslahati `::after` bilan chiziladi va uning eng katta xavfi —
   KESILIB QOLISH: ota-elementda `overflow: hidden` bo'lsa, quti
   ko'rinmaydi va buni faqat brauzer aytadi. Kod ichidan qidirish
   bunday nosozlikni HECH QACHON ushlamaydi.

   Ishga tushirish:  node scripts/check-shift.mjs
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

const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
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
  /* ⚠ SMENA YOPIQ — sinovning butun mavzusi shu holat. */
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify({ success: true, data: null }) });
});
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "CASHIER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});

await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

console.log("\n══ SMENA OGOHLANTIRISHI (V83) ══");

console.log("\n§1 ⚠ JAMI kartochkasidagi quti YO'Q");
const warn = await page.evaluate(() => document.querySelectorAll(".total-warn").length);
warn === 0 ? ok("`.total-warn` chizilmadi — joy bo'shadi")
           : no("quti olib tashlanishi kerak", `${warn} ta`);

console.log("\n§2 Smena tugmasi o'zi signal beradi");
const chip = await page.evaluate(() => {
  const el = document.querySelector(".shift-chip--off");
  if (!el) return null;
  return {
    text: el.querySelector("span:not(.shift-chip__tip)")?.innerText.trim() || "",
    /* ⚠ `textContent`, `innerText` EMAS: maslahat `visibility: hidden`
       holatida turadi va `innerText` bunday elementdan bo'sh satr
       qaytaradi — sinov matn yo'q deb o'ylardi. */
    tip: el.querySelector(".shift-chip__tip")?.textContent.trim() || "",
    icon: !!el.querySelector(".fa-triangle-exclamation"),
  };
});
chip ? ok(`tugma turibdi: «${chip.text}»`) : no("yopiq smena tugmasi ko'rinishi kerak", "yo'q");
chip?.icon ? ok("ogohlantirish ikonkasi bilan — rang yolg'iz signal emas")
           : no("ikonka bo'lishi kerak", "yo'q");
chip?.tip?.length > 20 ? ok("to'liq izoh maslahat ichida")
                       : no("maslahatda to'liq matn bo'lishi kerak", chip?.tip ?? "—");

console.log("\n§3 ⚠ HOVER QILGANDA MASLAHAT CHIQADI");
const box = await page.evaluate(() => {
  const el = document.querySelector(".shift-chip--off");
  if (!el) return null;
  const tip = el.querySelector(".shift-chip__tip");
  return { hidden: getComputedStyle(tip).visibility, box: el.getBoundingClientRect().toJSON() };
});
if (!box) no("tugma topilmadi", "—");
else {
  box.hidden === "hidden" ? ok("hoversiz — ko'rinmaydi")
                          : no("boshida yashirin bo'lishi kerak", box.hidden);
  /* Haqiqiy sichqoncha — sinov sinf qo'shib aldamaydi. */
  await page.mouse.move(box.box.x + box.box.width / 2, box.box.y + box.box.height / 2);
  await new Promise((r) => setTimeout(r, 350));
  const shown = await page.evaluate(() => {
    const tip = document.querySelector(".shift-chip__tip");
    return { vis: getComputedStyle(tip).visibility, op: getComputedStyle(tip).opacity };
  });
  shown.vis === "visible" && shown.op === "1"
    ? ok("hover qilinganda chiqdi")
    : no("hoverda ko'rinishi kerak", `${shown.vis}/${shown.op}`);
}

console.log("\n§4 ⚠ MASLAHAT EKRANDA TO'LIQ KO'RINADI (kesilmaydi)");
/* ⚠ ENG MUHIM BAND. `.card` ham, `.kassa-left` ham `overflow: hidden`
   bilan yopiladi — maslahat ularning ichiga SIG'ISHI shart. Buni
   faqat brauzer ayta oladi: koddan qarab bilib bo'lmaydi. */
const fit = await page.evaluate(() => {
  const tip = document.querySelector(".shift-chip__tip");
  if (!tip) return null;
  const t = tip.getBoundingClientRect();
  if (t.width < 40 || t.height < 10) return { why: "quti o'lchamsiz" };
  const out = [];
  let el = tip.parentElement;
  while (el && el !== document.body) {
    const o = getComputedStyle(el);
    const clips = ["hidden", "clip", "scroll", "auto"].includes(o.overflow)
               || ["hidden", "clip", "scroll", "auto"].includes(o.overflowY)
               || ["hidden", "clip", "scroll", "auto"].includes(o.overflowX);
    if (clips) {
      const r = el.getBoundingClientRect();
      /* 1px — brauzerning yaxlitlashi, kesilish emas. */
      if (t.right > r.right + 1 || t.left < r.left - 1
          || t.bottom > r.bottom + 1 || t.top < r.top - 1) {
        out.push(`${el.className || el.tagName}`);
      }
    }
    el = el.parentElement;
  }
  return { out, t: t.toJSON() };
});
if (!fit) no("maslahat topilmadi", "—");
else if (fit.why) no("maslahat chizilmadi", fit.why);
else if (fit.out.length) no("⚠ maslahat kesilib qoladi", fit.out.join(", "));
else ok(`maslahat to'liq ko'rinadi (${Math.round(fit.t.width)}×${Math.round(fit.t.height)})`);

console.log("\n§5 Sahifa xatolari");
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
errs.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", errs.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Smena: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
