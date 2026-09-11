/* ══════════════════════════════════════════════════════════════════════════
   PUL MATNI HECH QAYERDA QIRQILMASIN (V99)

   ═══ HAQIQIY NUQSON ════════════════════════════════════════════════════

   Do'kon egasi ekran rasmini yubordi: savatdagi chegirmali qatorda

       13 990 so'm   13 222 so

   — ikkinchi narx O'RTASIDAN qirqilgan. Sabab: `.cart-item-name` da
   `overflow: hidden; text-overflow: ellipsis` himoyasi bor edi, NARXDA
   esa yo'q. Chegirmali qatorda ikkita son yonma-yon turadi va ular yon
   tomondagi miqdor tugmalari ostiga kirib ketardi.

   ⚠ NEGA BU NOMDAN YOMONROQ. Qirqilgan nom — noqulaylik. Qirqilgan
   NARX — kassir noto'g'ri raqamni o'qib mijozga aytadi. «13 222 so»
   ni odam «13 222» deb o'qiydi va bu to'g'ri chiqishi ham mumkin,
   chiqmasligi ham.

   ⚠ NEGA SAHIFA DARAJASIDAGI TEKSHIRUV YETMAGAN. `check-wide.mjs`
   sahifaning O'ZI yon tomonga surilishini ushlaydi. Bu yerda esa
   sahifa surilmaydi — matn qo'shni element OSTIGA kiradi. Bu boshqa
   sinf va o'z qo'riqchisini talab qiladi.

   ═══ NIMA TEKSHIRILADI ═════════════════════════════════════════════════

   Savat eng TOR holatga qo'yiladi va har bir matn elementi uchun
   `scrollWidth > clientWidth` qaraladi — ya'ni matn o'z qutisiga
   sig'maganmi. Ellipsis QO'YILGAN element ham shu shartga tushadi,
   lekin unda hech bo'lmasa «…» ko'rinadi va odam matn davom etishini
   BILADI; qo'riqchi shuning uchun ellipsissiz qirqilishni alohida
   ajratadi.

   Ishga tushirish:  node scripts/check-clip.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4661;
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
               ".json": "application/json", ".woff2": "font/woff2" };

if (!fs.existsSync(DIST)) { console.error("dist topilmadi — avval `npm run build`."); process.exit(1); }

const server = http.createServer((q, s) => {
  const u = q.url.split("?")[0];
  let f = path.join(DIST, u === "/" ? "index.html" : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  s.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
  s.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--no-proxy-server"],
});

/* ⚠ UZUN NOM VA KATTA NARX — nuqson aynan shunday qatorda ko'rinadi.
   Foydalanuvchi rasmidagi son ataylab saqlangan. */
const ITEMS = [
  { id: 1, name: "Monarx ketchup klassik 900 g", salePrice: 13990, qty: 1,
    discount: 768, unit: "DONA", unitDecimals: 0, costPrice: 9000, discountAllowed: true },
  /* ⚠ ENG UZUN NOMLI QATOR «zarariga» BELGISINI HAM OLADI (V99):
     belgi eng tor savatda, eng uzun nom yonida sinalishi kerak —
     boshqa har qanday holat undan yengilroq. */
  { id: 2, name: "Yog'och ko'mir premium 10 kg qop", salePrice: 249900, qty: 3,
    discount: 74970, unit: "DONA", unitDecimals: 0, costPrice: 180000, discountAllowed: true,
    belowCost: false, belowWholesale: true },
  { id: 3, name: "Tovuq filesi sovutilgan", salePrice: 68500, qty: 1.235,
    discount: 12345, unit: "KG", unitDecimals: 3, costPrice: 50000, discountAllowed: true },
];

const PROFILE = { id: 1, name: "Sinov", code: "v", currency: "UZS" };

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m) => { bad++; console.log("  ❌ " + m); };

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (!/\/api\//.test(r.url())) return r.continue();
  const CORS = {
    "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": r.headers()["access-control-request-headers"] || "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
  const body = r.url().includes("/shop/profile")
    ? { success: true, data: PROFILE } : { success: true, data: [] };
  return r.respond({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });
});

await page.evaluateOnNewDocument((list) => {
  for (const [k, v] of Object.entries({
    ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
    ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
  })) localStorage.setItem(k, v);
  localStorage.setItem("ek_cart_v_v", JSON.stringify({
    savedAt: Date.now(), v: 3, activeId: 1,
    carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items: list }],
  }));
  /* ⚠ SAVATNI ENG TOR HOLATGA: nuqson aynan shu yerda tug'iladi.
     340 — `MIN_RIGHT_W`, KassaPage dagi pastki chegara.

     ⚠ KALIT NOMI ANIQ BO'LISHI SHART. Boshida bu yerda
     `ek_kassa_rightw` yozilgan edi — bunday kalit yo'q, savat esa
     odatiy 360px da qolardi. Natijada QO'RIQCHI TOR HOLATNI UMUMAN
     SINAMASDI: kodni ataylab buzganda ham yashil turaverdi. Buni
     buzib-tekshirish ushladi. */
  localStorage.setItem("ek_kassaRightW", "340");
}, ITEMS);

await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1200));

/* ⚠ AVVAL KENGLIK QO'LLANGANINI TASDIQLAYMIZ. Bu sinov faqat TOR
   savatda ma'noga ega; kenglik o'rnatilmasa u hech narsani
   tekshirmaydigan, lekin doim yashil turadigan qo'riqchiga
   aylanadi — aynan shunday bo'lgan ham. */
const cartW = await page.$eval(".kassa-right", (el) => Math.round(el.getBoundingClientRect().width));
console.log(`\n══ Savat kengligi: ${cartW}px ══`);
if (cartW > 380) no(`savat tor emas (${cartW}px) — sinov o'z holatini yarata olmadi`);
else ok(`savat eng tor holatda (${cartW}px)`);

console.log("\n══ Savat qatorlari — eng tor holat ══");

/* ⚠ `scrollWidth - clientWidth` NI O'LCHAMANG. Bu qo'riqchining
   birinchi tahriri aynan shuni o'lchagan va HECH QACHON yiqila
   olmasdi: `scrollWidth` faqat o'zi surilish qutisi bo'lgan
   elementda ma'noga ega, oddiy fleks bolasida u NOL. Nuqson
   ekranda ko'rinib turgan holda ham sinov yashil turardi.

   Haqiqiy savol boshqa: matn O'Z QUTISIDAN va qo'shni tugmalardan
   chetga chiqdimi. Shuning uchun CHEKKALAR o'lchanadi. */
const rows = await page.$$eval(".cart-item", (els) => els.map((row) => {
  const box = (sel) => {
    const el = row.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { text: (el.innerText || "").trim(), left: r.left, right: r.right,
             clips: cs.overflow !== "visible",
             ellipsis: cs.textOverflow === "ellipsis" && cs.overflow !== "visible" };
  };
  const price = box(".cart-item-price");
  const now = box(".cart-item-price__now");
  const qty = box(".qty-ctrl");
  return {
    name: box(".cart-item-name"), price, now, qty,
    /* Joriy narx o'z qutisidan qancha chiqdi (musbat — qirqiladi). */
    nowOverBox: now && price ? Math.round(now.right - price.right) : null,
    /* Joriy narx miqdor tugmalari ostiga qancha kirdi. */
    nowOverQty: now && qty ? Math.round(now.right - qty.left) : null,
  };
}));

if (!rows.length) {
  no("savat qatorlari topilmadi — sinov o'z ishini bajara olmadi");
} else {
  ok(`${rows.length} ta qator o'lchandi`);
  for (const r of rows) {
    if (!r.price) { no("narx elementi topilmadi"); continue; }
    /* ⚠ JORIY NARX — KASSIR AYTADIGAN RAQAM. U qisqarsa ham,
       ellipsis bilan qisqarsa ham NOSOZLIK: «13 222 so» ni odam
       «13 222» deb o'qiydi va bu to'g'ri chiqishi shart emas.
       Eski narx (ustidan chizilgan) qisqarsa — mayli. */
    if (!r.now) {
      no("joriy narx elementi topilmadi");
    } else if (r.nowOverBox > 1) {
      no(`JORIY narx qutisidan ${r.nowOverBox}px chiqdi (qirqiladi): «${r.now.text}»`);
    } else if (r.nowOverQty > 0) {
      no(`JORIY narx miqdor tugmalari ostiga ${r.nowOverQty}px kirdi: «${r.now.text}»`);
    } else if (r.now.clips) {
      /* ⚠ QUTIGA SIG'GANI YETMAYDI. Joriy narxga `overflow: hidden`
         qo'yilsa, u KELAJAKDA jimgina qisqaradi: uzunroq son yoki
         boshqa til bilan matn kesiladi-yu, chekkalar o'lchovi buni
         ko'rmaydi. Shuning uchun qoidaning O'ZI tekshiriladi —
         joriy narx hech qachon qirqiladigan quti bo'lmasin. */
      no(`JORIY narxga qirqish qo'yilgan (overflow) — u qisqarmasligi kerak: «${r.now.text}»`);
    } else {
      ok(`joriy narx to'liq: «${r.now.text}»`);
    }
  }
}

/* ── Miqdor tugmalari narx ustiga TUSHMAYDI ──────────────────────────── */
console.log("\n══ Narx va miqdor tugmalari ustma-ust emas ══");
/* ⚠ `.cart-item-price` NI O'LCHAMANG — u `overflow: hidden` bilan
   QIRQILGAN quti va uning chekkasi har doim joyida ko'rinadi. Matn
   esa undan chetga chiqib turgan bo'lishi mumkin. Shuning uchun
   ICHKI elementlar o'lchanadi. */
const overlaps = await page.$$eval(".cart-item", (els) => els.map((row) => {
  const p = row.querySelector(".cart-item-price__now") || row.querySelector(".cart-item-price");
  const q = row.querySelector(".qty-ctrl");
  if (!p || !q) return null;
  const a = p.getBoundingClientRect(), b = q.getBoundingClientRect();
  return { over: Math.round(a.right - b.left), text: (p.innerText || "").trim() };
}).filter(Boolean));

for (const o of overlaps) {
  if (o.over > 0) no(`narx miqdor tugmalari ostiga ${o.over}px kirdi: «${o.text}»`);
  else ok("narx tugmalarga tegmaydi");
}

/* ── ZARARIGA SOTILAYOTGAN QATOR (V99) ──────────────────────────────────

   Kirim tan narxni sotuv yoki optom narxdan yuqoriga chiqarganda
   tovar zarariga sotilaveradi va kassir hozirgacha hech narsa
   ko'rmasdi: chegirmasiz sotuvda `Discounts.decide` birinchi
   qatordayoq `ALLOW` qaytaradi — zarar chegirmadan emas, TANNARXdan
   kelib chiqqani uchun.

   ⚠ AYNAN SHU EKRAN — eng tor savat va eng uzun nom. Belgi nom
   qatoriga qo'shilgani uchun u NOMNI siqib chiqarishi yoki O'ZI
   qatordan surilib chiqib ketishi mumkin edi. */
console.log("\n══ Zarariga sotilayotgan qator (V99) ══");
const loss = await page.$$eval(".cart-item", (els) => els.map((row) => {
  const b = row.querySelector(".cart-loss");
  const t = row.querySelector(".cart-item-name__txt");
  const box = row.querySelector(".cart-item-name");
  if (!t || !box) return null;
  const tb = t.getBoundingClientRect(), bb = box.getBoundingClientRect();
  return {
    name: t.textContent.trim(),
    badge: b ? b.textContent.trim() : null,
    /* Belgi nom qutisidan CHIQIB ketmaganmi. */
    outside: b ? Math.round(b.getBoundingClientRect().right - bb.right) : 0,
    /* Uzun nom uch nuqta bilan qisqarganmi (fleks bolasida ishlashi shart). */
    clipped: t.scrollWidth > t.clientWidth + 1,
    ellipsis: getComputedStyle(t).textOverflow,
    wide: Math.round(tb.width),
  };
}).filter(Boolean));

const marked = loss.filter((r) => r.badge);
marked.length === 1
  ? ok(`belgi FAQAT zararli qatorda: «${marked[0].badge}» — ${marked[0].name}`)
  : no(`bitta qatorda belgi bo'lishi kerak, topildi: ${marked.length}`);

for (const r of loss) {
  if (r.outside > 0) no(`belgi nom qutisidan ${r.outside}px chiqib ketdi: «${r.name}»`);
}
if (marked.length) ok("belgi qatordan chiqib ketmadi");

/* ⚠ ENG MUHIM TASDIQ. Nom qatori V99 da FLEKS bo'ldi va
   `text-overflow: ellipsis` fleks KONTEYNERDA ishlamaydi — qoidalar
   o'z joyida qoldirilganda uzun nom uch nuqtasiz qirqilardi.
   Shuning uchun qisqartirish bolaga ko'chirildi va bu yerda aynan
   BOLA o'lchanadi. */
const long = loss.find((r) => r.clipped);
long
  ? (long.ellipsis === "ellipsis"
      ? ok(`uzun nom uch nuqta bilan qisqardi: «${long.name}»`)
      : no(`qisqarayotgan nomda uch nuqta yo'q (${long.ellipsis}) — fleks konteynerda yo'qoladi`))
  : ok("bu kenglikda nom qisqarmadi — qoida baribir bolada turibdi");

await browser.close();
server.close();
console.log(bad ? `\n❌ ${bad} ta nosozlik\n` : "\n✅ pul matni hech qayerda qirqilmaydi\n");
process.exit(bad ? 1 : 0);
