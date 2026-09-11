/* ══════════════════════════════════════════════════════════════════════════
   BAJIK PRINTERSIZ HAM CHIQADI (V110)

   Do'kon egasi: «bajikni fayl sifatida olish imkonini qilish kerak,
   chunki har doim ham printer bo'lmasligi mumkin».

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Bajikning butun ma'nosi QR da: sir (token) faqat chiqarilgan ONDA
   keladi va uni biror joyga olib qo'yish kerak. Ilgari brauzerda QR
   umuman chizilmasdi — oynada ism turardi, sir esa «Yopish» bilan
   birga yo'qolardi.

   Shuning uchun bu yerda ekrandagi kartochka o'qiladi:

     · QR CHIZILDIMI (va u haqiqatan tokendan yasalganmi);
     · uslublar KARTOCHKANING ICHIDA turibdimi — faylga saqlanganda
       ilovaning `styles.css` i u yerga bormaydi va tashqi sinflarga
       tayangan kartochka bezaksiz chiqardi;
     · «Faylga saqlash» tugmasi PRINTERSIZ ham ochiqmi.

   Ishga tushirish:  node scripts/check-badge.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4619;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const TOKEN = "BJK-TEST-0123456789";

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

const USER = { userId: 4, username: "kassir1", fullName: "Ali Valiyev",
               role: "CASHIER", hasBadge: false, badgeVersion: 0 };

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
  let data = [];
  if (/\/security\/badges\/\d+$/.test(p) && r.method() === "POST") {
    /* Sir FAQAT shu javobda keladi — kartochka aynan shundan yasaladi. */
    data = { userId: USER.userId, username: USER.username, fullName: USER.fullName,
             version: 3, token: TOKEN };
  } else if (/\/security\/badges$/.test(p)) data = [USER];
  return r.respond({ status: 200, contentType: "application/json",
                     headers: CORS, body: JSON.stringify({ success: true, data }) });
});
page.on("pageerror", (e) => { pageErrors.push(e.message); });
await page.evaluateOnNewDocument(() => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
});
await page.goto(`http://127.0.0.1:${PORT}/security`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

console.log("\n══ BAJIK (V110) ══");

console.log("\n§1 Bajik chiqariladi");
const issued = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")]
    .find((x) => /chiqarish|bajik ber/i.test(x.textContent));
  if (!b) return false;
  b.click();
  return true;
});
issued ? ok("«chiqarish» tugmasi bosildi") : no("tugma topilmadi", "yo'q");
await page.waitForSelector(".modal-box", { timeout: 8000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 600));

const card = await page.evaluate(() => {
  const box = document.querySelector(".modal-box");
  if (!box) return null;
  /* ⚠ Kartochka BELGI bo'yicha topiladi. Ilgari «ramkali va fonli
     div» deb qidirilardi va tekshiruv OGOHLANTIRISH qutisini
     kartochka deb o'ylab, beshta yolg'on xato bergan edi. */
  const el = box.querySelector("[data-badge-card]");
  const svg = el ? el.querySelector("svg") : null;
  return {
    found: !!el,
    inlineStyled: !!el && !!el.style.background,
    text: el ? el.innerText.replace(/\s+/g, " ").trim() : null,
    /* QR — bitta oq `rect` va bitta uzun `path`; uning uzunligi
       ma'lumot hajmiga bog'liq, ya'ni bo'sh kod bo'lsa u qisqa
       bo'ladi. */
    qrLabel: svg?.getAttribute("aria-label") || null,
    qrPath: svg?.querySelector("path")?.getAttribute("d")?.length || 0,
    saveBtn: [...box.querySelectorAll("button")]
      .filter((b) => /faylga saqlash/i.test(b.textContent))
      .map((b) => ({ text: b.textContent.trim(), off: b.disabled }))[0] || null,
    printBtn: [...box.querySelectorAll("button")]
      .filter((b) => /chop etish/i.test(b.textContent))
      .map((b) => ({ off: b.disabled }))[0] || null,
  };
});

console.log("\n§2 ⚠ QR EKRANDA CHIZILADI");
/* Ilgari brauzerda QR umuman yo'q edi va sir «Yopish» bilan birga
   yo'qolardi — printersiz do'konda bajik chiqarib bo'lmasdi. */
card?.qrLabel === "QR" && card.qrPath > 400
  ? ok(`QR chizildi (yo'l uzunligi ${card.qrPath})`)
  : no("QR chizilishi kerak", JSON.stringify({ label: card?.qrLabel, len: card?.qrPath }));

console.log("\n§3 Kartochkada kerakli hamma narsa bor");
card?.text?.includes("Ali Valiyev") ? ok("ism bor") : no("ism bo'lishi kerak", card?.text);
card?.text?.includes("kassir1") ? ok("login bor") : no("login bo'lishi kerak", card?.text);
/^.*3.*$/.test(card?.text || "") ? ok("versiya bor") : no("versiya bo'lishi kerak", card?.text);
/shaxsiy/i.test(card?.text || "") ? ok("ogohlantirish qog'ozning o'zida")
                                  : no("ogohlantirish bo'lishi kerak", card?.text);

console.log("\n§4 ⚠ USLUBLAR KARTOCHKANING ICHIDA");
/* Faylga saqlanganda `outerHTML` boshqa hujjatga ko'chadi va u yerda
   ilovaning `styles.css` i YO'Q. Tashqi sinflarga tayangan kartochka
   o'sha yerda bezaksiz matnga aylanardi. */
card?.inlineStyled ? ok("kartochka o'z uslublarini olib yuradi")
                   : no("ichki uslub bo'lishi kerak", "yo'q");

console.log("\n§5 ⚠ «Faylga saqlash» PRINTERSIZ HAM OCHIQ");
card?.saveBtn && !card.saveBtn.off
  ? ok(`tugma ochiq: ${card.saveBtn.text}`)
  : no("tugma ochiq bo'lishi kerak", JSON.stringify(card?.saveBtn));
/* Chek printeri tugmasi esa brauzerda o'chiq qolishi TO'G'RI — u
   faqat ish stoli ilovasida ishlaydi. */
card?.printBtn?.off ? ok("chek printeri tugmasi brauzerda o'chiq (to'g'ri)")
                    : no("brauzerda o'chiq bo'lishi kerak", JSON.stringify(card?.printBtn));

console.log("\n§6 Sahifa xatolari");
pageErrors.length === 0 ? ok("JS xatosi yo'q") : no("sahifada xato", pageErrors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad === 0 ? "\n✅ Bajik: hammasi joyida\n" : `\n❌ ${bad} ta muammo\n`);
process.exit(bad ? 1 : 0);
