/* ══════════════════════════════════════════════════════════════════════════
   TO'LOV OYNASI — BROUZERDA TEKSHIRUV (V58)

   ═══ NEGA ALOHIDA TEKSHIRUV ════════════════════════════════════════════

   `test/payment.test.mjs` HISOB-KITOBni qulflaydi (`settle`, `payType`,
   `restFor`). Lekin do'kon egasining talabi hisobda emas, EKRANDA:

     «naqt tanlandi va 20000 kiritildi, qolgani nasiyaga hisoblanib
      tursin; keyin klik yoki karta tanlanadi va yana kiritish
      so'ralsin… agar yana naqt qo'shmoqchi bo'lib qolsa, inputga
      naqdning ESKI QIYMATI qo'yib berilsin! har biri uchun alohida
      input ochilmasdan BITTA inputdan foydalanaversin».

   «Eski qiymati qaytadi», «maydon bitta», «tugma bosilganda hech narsa
   o'chmaydi» — bularning hammasi React holatida yashaydi va sof
   funksiya sinovi ularga yetmaydi. Shuning uchun bu yerda HAQIQIY
   sahifa ochiladi, tugmalar bosiladi va ekrandan o'qiladi.

   ═══ IKKI TUZOQ (ikkalasi ham shu skript yozilayotganda tutildi) ══════

   ⚠ CORS. So'rov `https://api.e-kassam.uz` ga, ya'ni BOSHQA manbaga
   ketadi. Javobga CORS sarlavhalari qo'yilmasa brauzer uni o'zi rad
   etadi va ilova xuddi server yiqilgandek ishlaydi — nasiya YOPIQ deb
   belgilanadi va tekshiruv butunlay boshqa holatni ko'radi. Bu xato
   `scripts/check-a11y.mjs` da hozir ham bor (§ pastdagi izoh).

   ⚠ MASKALANGAN MAYDON. `#pay-amount` — `NumField`, u kursorni o'zi
   ko'chiradi. «Uch marta bosib belgilash» ishonchsiz: yangi raqam
   eskisining oldiga yopishib, 20 000 o'rniga 20 000 100 000 chiqadi.
   Tozalash Backspace bilan va HAQIQATAN bo'shagani tekshirilib
   qilinadi.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-pay.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = 4611;
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
/* ⚠ `/shop/profile` ALOHIDA javob beradi. Bo'sh ro'yxat qaytarilsa
   `getProfile()` yiqiladi va `.catch` NASIYANI YOPIQ deb belgilaydi —
   birinchi tekshirishda aynan shu bo'lgan va do'kon egasi so'ragan
   holat (nasiya ochiq) umuman sinalmagan edi. */
const PROFILE = { creditEnabled: true, creditDueDays: 30, bonusMaxPercent: 0, creditLimit: 0 };

/* ⚠ CORS SARLAVHALARI SHART. So'rov `https://api.e-kassam.uz` ga
   (boshqa manba) va `credentials: "include"` bilan ketadi. Sarlavhasiz
   javobni brauzer O'ZI rad etadi — `fetch` «Failed to fetch» beradi va
   ilova xuddi server yiqilgandek ishlaydi.

   ⚠ `Allow-Headers: *` ISHLAMAYDI: credentialli so'rovda brauzer
   yulduzchani qabul qilmaydi va `Authorization` ni rad etadi. Shuning
   uchun preflight so'ragan sarlavhalar QAYTARIB beriladi. */
const cors = (req) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    req.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});

/** Sahifada tushgan JS xatolari — oxirida hisobga olinadi. */
const pageErrors = [];

/* Bitta tovar — mantiqni tekshirish uchun; scrol bo'limi o'z ro'yxatini beradi. */
const ONE = [{ id: 1, name: "Kurtka", salePrice: 100000, qty: 1, unit: "DONA", stockQuantity: 9 }];

/** Tayyor sahifa: soxta API, soxta sessiya va savat bilan. */
async function openKassa({ w = 1600, h = 950, items = ONE, carts = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const body = r.url().includes("/shop/profile")
      ? { success: true, data: PROFILE }
      : /\/sales\b/.test(r.url()) && r.method() === "POST"
        ? { success: true, data: { id: 777, receiptUrl: null } }
        : { success: true, data: [] };
    return r.respond({ status: 200, contentType: "application/json",
                       headers: CORS, body: JSON.stringify(body) });
  });
  /* ⚠ SAHIFA XATOSI — SINOVNI YIQITADI. Ilgari u faqat yozib
     qo'yilardi va aynan shu sabab «Bajarilmoqda…» da qotib qolish
     xatosi tekshiruvdan o'tib ketgan edi: sotuvdan keyin
     `ReferenceError` tushar, ekranda esa hech narsa qizarmasdi. */
  page.on("pageerror", (e) => { pageErrors.push(e.message); });
  const seed = carts || [{ id: 1, discount: "", bonusUse: "", customer: null, items }];
  await page.evaluateOnNewDocument((cartList) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.setItem("ek_cart_v_v", JSON.stringify({
      savedAt: Date.now(), v: 3, activeId: 1, carts: cartList,
    }));
  }, seed);
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1200));
  return page;
}

/* ⚠ IKKI SAVAT. Birinchisi sotiladi va yopiladi; ikkinchisi esa
   sotuvdan KEYIN kassa ishlayotganini tekshirish uchun qoladi —
   bo'sh savatda to'lov oynasi umuman ochilmaydi va «ikkinchi sotuv»
   tekshiruvi ma'nosini yo'qotardi. */
const page = await openKassa({ carts: [
  { id: 1, discount: "", bonusUse: "", customer: null, items: ONE },
  { id: 2, discount: "", bonusUse: "", customer: null,
    items: [{ id: 2, name: "Shim", salePrice: 50000, qty: 1, unit: "DONA", stockQuantity: 9 }] },
] });

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };

const state = () => page.evaluate(() => ({
  input: document.querySelector("#pay-amount")?.value ?? null,
  hold: document.querySelector("#pay-amount")?.placeholder ?? null,
  custNeed: !!document.querySelector(".cart-cust.is-needed"),
  custHint: document.querySelector(".cart-cust__need")?.textContent.trim() || null,
  warnBtn: !!document.querySelector(".pay-warn-btn"),
  label: document.querySelector('label[for="pay-amount"]')?.textContent.trim() ?? null,
  rows: [...document.querySelectorAll(".pay-sum__row")].map((r) => ({
    name: r.querySelector(".pay-sum__name")?.textContent.trim(),
    val: r.querySelector("b")?.textContent.trim(),
    credit: r.classList.contains("pay-sum__row--credit"),
    change: r.classList.contains("pay-sum__row--change"),
  })),
  btns: [...document.querySelectorAll(".pay-type-btn")].map((b) => ({
    txt: b.textContent.replace(/\s+/g, " ").trim(),
    active: b.classList.contains("active"),
    has: b.classList.contains("has-amount"),
  })),
  submit: !document.querySelector(".pay-modal-submit")?.disabled,
  scroll: (() => { const m = document.querySelector(".pay-modal-body") || document.querySelector(".pay-modal");
                   return m ? m.scrollHeight - m.clientHeight : -1; })(),
  warns: [...document.querySelectorAll(".pay-mixed-warn")].map((w) => w.textContent.trim()),
}));

const type = async (v) => {
  /* ⚠ Maydon MASKALANGAN (NumField): uch marta bosib «hammasini
     belgilash» ishonchsiz — mask kursorni boshiga qaytaradi va yangi
     raqam eskisining oldiga yopishadi. Shuning uchun tozalash
     Backspace bilan, HAQIQIY bo'shashi tekshirilib qilinadi. */
  await page.focus("#pay-amount");
  for (let i = 0; i < 30; i++) {
    if (await page.$eval("#pay-amount", (el) => el.value === "")) break;
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
  }
  const left = await page.$eval("#pay-amount", (el) => el.value);
  if (left !== "") throw new Error("maydon tozalanmadi: " + left);
  if (v !== "") await page.type("#pay-amount", v, { delay: 12 });
  await new Promise((r) => setTimeout(r, 220));
};
const pick = async (name) => {
  const i = await page.evaluate((n) =>
    [...document.querySelectorAll(".pay-type-btn")].findIndex((b) => b.textContent.includes(n)), name);
  if (i < 0) throw new Error("tugma topilmadi: " + name);
  await page.evaluate((k) => document.querySelectorAll(".pay-type-btn")[k].click(), i);
  await new Promise((r) => setTimeout(r, 220));
};

/* ── Oynani ochish ── */
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => /Sotish|To'lov|Tolov/i.test(b.textContent))?.click());
await new Promise((r) => setTimeout(r, 700));
let s = await state();
if (s.input === null) { console.log("  ❌ to'lov oynasi ochilmadi"); await browser.close(); server.close();

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tushdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tushmadi");
} process.exit(1); }

console.log("\n── 1. Maydon BO'SH ochiladi, lekin chek naqd ──");
/* ⚠ Do'kon egasining talabi: «inputda summa yozilib turmasin, bo'sh
   tursin, lekin placeholder bo'lishi mumkin». Bo'sh maydon esa
   «to'lanmadi» degani emas — odatiy chek to'liq naqd. */
s.input === "" ? ok("maydon bo'sh") : no("maydon bo'sh bo'lishi kerak", `«${s.input}»`);
(s.hold || "").replace(/\D/g, "") === "100000"
  ? ok(`placeholder: ${s.hold}`) : no("placeholder 100 000 ko'rsatishi kerak", s.hold);
{
  const naqd = s.rows.find((r) => /Naqd/i.test(r.name || ""));
  (naqd?.val || "").replace(/\D/g, "") === "100000"
    ? ok(`hisobda naqd ${naqd.val}`) : no("hisobda naqd 100 000 bo'lishi kerak", naqd?.val ?? "yo'q");
}
s.btns.find((b) => b.txt.includes("Naqd"))?.has
  ? ok("Naqd tugmasida summa ko'rinadi") : no("Naqd tugmasi belgilanishi kerak", "yo'q");
s.rows.some((r) => r.credit) ? no("nasiya bo'lmasligi kerak", "bor") : ok("nasiya yo'q");
s.custNeed ? no("mijoz so'ralmasligi kerak", "ishora bor") : ok("mijoz so'ralmaydi");
s.submit ? ok("«Sotish» ochiq — hech narsa yozmasdan sotiladi") : no("«Sotish» ochiq bo'lishi kerak", "yopiq");
s.btns.length === 4 ? ok("to'rt usul: " + s.btns.map((b) => b.txt.split(" ")[0]).join(", "))
                    : no("to'rtta usul bo'lishi kerak", s.btns.length);
/Aralash|Nasiya/i.test(s.btns.map((b) => b.txt).join(" "))
  ? no("«Aralash»/«Nasiya» tugmasi qolmasligi kerak", s.btns.map((b) => b.txt).join(" | "))
  : ok("«Aralash» ham, «Nasiya» ham tugma emas");

console.log("\n── 2. Naqd 20 000 → qolgan 80 000 NASIYAGA ──");
{
  const st = await state();
  /* Nasiya OCHIQ do'kon: qoldiq «nasiyaga» deyiladi, «to'lanmagan» emas. */
  st.warns.some((w) => /nasiya yo'q/i.test(w)) && no("nasiya ochiq bo'lishi kerak", st.warns.join(" "));
}
await type("20000");
s = await state();
const credit = () => (state()).then((x) => x.rows.find((r) => r.credit)?.val ?? "yo'q");
let c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "80000" ? ok(`nasiya ${c}`) : no("nasiya 80 000 bo'lishi kerak", c ?? "yo'q");
s.rows.some((r) => r.change) ? no("qaytim bo'lmasligi kerak", "bor") : ok("qaytim yo'q");

console.log("\n── 3. Click 15 000 → nasiya 65 000, naqd saqlanadi ──");
await pick("Click");
s = await state();
s.input === "" ? ok("Click bo'sh maydon bilan ochildi") : no("Click maydoni bo'sh bo'lishi kerak", s.input);
await type("15000");
s = await state();
c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "65000" ? ok(`nasiya ${c}`) : no("nasiya 65 000 bo'lishi kerak", c ?? "yo'q");
const naqdRow = s.rows.find((r) => /Naqd/i.test(r.name || ""));
(naqdRow?.val || "").replace(/\D/g, "") === "20000" ? ok(`naqd qatori ${naqdRow.val}`) : no("naqd 20 000 qolishi kerak", naqdRow?.val ?? "yo'q");

console.log("\n── 4. NAQDGA QAYTSA — eski qiymati turadi (asosiy talab) ──");
await pick("Naqd");
s = await state();
s.input.replace(/\D/g, "") === "20000" ? ok(`maydonda ${s.input}`) : no("maydonda 20 000 bo'lishi kerak", s.input);
s.btns.find((b) => b.txt.includes("Naqd"))?.active ? ok("Naqd tugmasi tanlangan") : no("Naqd tanlangan bo'lishi kerak", "yo'q");
const marked = s.btns.filter((b) => b.has).map((b) => b.txt.split(" ")[0]);
marked.length === 2 ? ok("pul yozilgan tugmalar belgilangan: " + marked.join(", ")) : no("ikkita tugma belgilanishi kerak", marked.join(",") || "yo'q");

console.log("\n── 4b. Nasiya matni va mijoz talabi ──");
{
  const st = await state();
  const row = st.rows.find((r) => r.credit);
  /Qolgani nasiyaga/i.test(row?.name || "") ? ok(`nasiya qatori: «${row.name}»`)
    : no("«Qolgani nasiyaga» deyilishi kerak", row?.name);
  st.warns.length ? ok("mijoz talab qilinadi: " + st.warns[0]) : no("mijoz so'ralishi kerak", "yo'q");
  st.submit ? no("mijozsiz «Sotish» yopiq bo'lishi kerak", "ochiq") : ok("mijozsiz «Sotish» yopiq");
  /* ⚠ Do'kon egasining talabi: «mijoz tanlash majburiy bo'lganda
     mijoz tanlash oynasi ishora qilib tursin». */
  st.custNeed ? ok("mijoz tanlagichi ishora qilyapti") : no("tanlagich ishora qilishi kerak", "belgi yo'q");
  st.custHint ? ok(`tanlagich tagida: «${st.custHint}»`) : no("tanlagich tagida yozuv kerak", "yo'q");
  st.warnBtn ? ok("ogohlantirish bosiladigan — tanlagichni ochadi") : no("ogohlantirish tugma bo'lishi kerak", "oddiy yozuv");
  {
    /* Bosilsa — ro'yxat ochilsin. */
    await page.click(".pay-warn-btn");
    await new Promise((r) => setTimeout(r, 350));
    const open = await page.evaluate(() => !!document.querySelector(".ek-select__menu, .ek-select__pop, [role='listbox']"));
    open ? ok("bosilganda mijoz ro'yxati ochildi") : no("ro'yxat ochilishi kerak", "ochilmadi");
    /* ⚠ `Escape` ISHLATILMAYDI: ro'yxat o'zi yopilib ulgursa, tugma
       to'lov OYNASIGA borib tegadi va u yopilib ketardi (shu yerda
       tutildi). Tanlagichni o'z tugmasi bilan yopamiz. */
    await page.click(".cart-cust .ek-select__btn");
    await new Promise((r) => setTimeout(r, 300));
    (await page.$("#pay-amount"))
      ? ok("to'lov oynasi ochiq qoldi") : no("to'lov oynasi ochiq qolishi kerak", "yopildi");
  }
}

console.log("\n── 4c. Naqdga 0 — to'liq nasiya ──");
{
  await pick("Click"); await type("");
  await pick("Naqd");  await type("0");
  const st = await state();
  const c = st.rows.find((r) => r.credit)?.val;
  (c || "").replace(/\D/g, "") === "100000"
    ? ok(`to'liq nasiya ${c}`) : no("to'liq nasiya 100 000 bo'lishi kerak", c ?? "yo'q");
  st.hold === "0" ? ok("yozilgach placeholder «0» bo'ladi") : no("placeholder «0» bo'lishi kerak", st.hold);
}

console.log("\n── 5. Uchinchi usul ham qo'shiladi (cheksiz) ──");
/* ⚠ HOLAT SHU YERDA QAYTA QURILADI. Ilgari bu bo'lim o'zidan
   oldingi bo'limlar qoldirgan qiymatlarga tayanardi va yuqoriga
   yangi bo'lim qo'shilishi bilan kutilmalar «o'z-o'zidan» noto'g'ri
   bo'lib qoldi. Har bo'lim o'z holatini o'zi qo'yadi. */
await pick("Naqd");  await type("20000");
await pick("Click"); await type("15000");
await pick("Karta"); await type("30000");
s = await state();
c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "35000" ? ok(`nasiya ${c}`) : no("nasiya 35 000 bo'lishi kerak", c ?? "yo'q");
s.rows.filter((r) => !r.credit && !r.change).length === 3 ? ok("uchala usul ro'yxatda") : no("uchta qator bo'lishi kerak", s.rows.length);

console.log("\n── 6. Naqd ortiqcha → QAYTIM, nasiya yo'q ──");
await pick("Naqd");
await type("100000");
s = await state();
const ch = s.rows.find((r) => r.change)?.val;
(ch || "").replace(/\D/g, "") === "45000" ? ok(`qaytim ${ch}`) : no("qaytim 45 000 bo'lishi kerak", ch ?? "yo'q");
s.rows.some((r) => r.credit) ? no("nasiya qolmasligi kerak", "bor") : ok("nasiya yo'q");
s.submit ? ok("«Sotish» ochiq") : no("«Sotish» ochiq bo'lishi kerak", "yopiq");

console.log("\n── 7. Naqdsizda ortiqcha → OGOHLANTIRISH, sotib bo'lmaydi ──");
await pick("Naqd"); await type("");
await pick("Click"); await type("500000");
s = await state();
s.warns.length ? ok("ogohlantirish: " + s.warns[0].replace(/\s+/g, " ")) : no("ogohlantirish chiqishi kerak", "yo'q");
s.submit ? no("«Sotish» yopilishi kerak", "ochiq") : ok("«Sotish» yopiq");
/{|}/.test(s.warns.join(" ")) ? no("yozuvda to'ldirilmagan {…} qolgan", s.warns.join(" ")) : ok("yozuvda {…} qolmagan");

console.log("\n── 8. Klaviatura: F1..F4 usulni tanlaydi ──");
await pick("Click"); await type("");
for (const [key, name] of [["F1", "Naqd"], ["F2", "Karta"], ["F3", "Click"], ["F4", "Payme"]]) {
  await page.keyboard.press(key);
  await new Promise((r) => setTimeout(r, 180));
  const st = await state();
  st.btns.find((b) => b.active)?.txt.includes(name)
    ? ok(`${key} → ${name}`) : no(`${key} → ${name}`, st.btns.find((b) => b.active)?.txt);
  /{|}/.test(st.label || "") && no("yorliqda {…} qolgan", st.label);
}
s = await state();
(s.label || "").includes("Payme") && !/{|}/.test(s.label) ? ok(`maydon yorlig'i: «${s.label}»`) : no("yorliq usul nomini ko'rsatishi kerak", s.label);

console.log("\n── 8b. Qatorlar tartibi surilmaydi ──");
{
  await pick("Naqd"); await type("");           // naqdni butunlay olib tashlash
  await pick("Karta"); await type("30000");
  await pick("Naqd");  await type("20000");     // eng oxirida qayta yozildi
  const st = await state();
  const names = st.rows.filter((r) => !r.credit && !r.change).map((r) => r.name.trim());
  /Naqd/.test(names[0] || "") ? ok("Naqd birinchi qatorda: " + names.join(" · "))
    : no("Naqd birinchi bo'lishi kerak", names.join(" · "));
}

/* ══════════════════════════════════════════════════════════════════════
   8c. SOTUVNI OXIRIGACHA O'TKAZISH

   ⚠ BU BO'LIM YO'Q EDI VA BAHOSI QIMMAT BO'LDI. Tekshiruv to'lov
   oynasini har tomondan qarardi, lekin «Sotish» ni HECH QACHON
   bosmasdi. Shu sabab sotuvdan KEYINGI kod umuman ishga tushmasdi va
   u yerda to'lov qayta yozilganda o'chgan funksiyalarning chaqiruvlari
   qolib ketgani bilinmadi: sotuv o'tar, `ReferenceError` esa
   `setProcessing(false)` ga yetkazmasdi va tugma abadiy
   «Bajarilmoqda…» bo'lib qolardi — kassa butunlay to'xtardi.
   Buni tekshiruv emas, do'kon egasi topdi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 8c. Sotuv oxirigacha o'tadi ──");
{
  await pick("Karta"); await type("");
  await pick("Click"); await type("");
  await pick("Naqd");  await type("");        // hammasi naqd
  await page.click(".pay-modal-submit");
  await new Promise((r) => setTimeout(r, 1600));

  const after = await page.evaluate(() => ({
    finish: !!document.querySelector(".ek-finish"),
    modal:  !!document.querySelector("#pay-amount"),
    busy:   !!document.querySelector('.pay-modal-submit[data-loading]'),
    count:  document.querySelector(".ek-finish__count")?.textContent || null,
  }));
  after.finish ? ok("yakunlash oynasi chiqdi") : no("yakunlash oynasi chiqishi kerak", "yo'q");
  after.modal ? no("to'lov oynasi yopilishi kerak", "ochiq") : ok("to'lov oynasi yopildi");
  after.busy ? no("tugma «Bajarilmoqda» da qolmasligi kerak", "qotib qoldi") : ok("tugma qotib qolmadi");
  after.count ? ok(`sanoq ko'rinadi: ${after.count}`) : no("qolgan sekundlar ko'rinishi kerak", "yo'q");

  /* Esc — yozuvda bor edi, lekin hech qayerda ushlanmagan edi. */
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 400));
  (await page.$(".ek-finish"))
    ? no("Esc yakunlash oynasini yopishi kerak", "yopilmadi") : ok("Esc oynani yopdi");

  /* ⚠ IKKINCHI SOTUV — asosiy tekshiruv. Do'kon egasining so'zi:
     «bir marta sotuv qilgandan keyin shunday bajarilmoqda bo'lib
     qolyapti». Ya'ni birinchi sotuv o'tadi, ikkinchisi to'xtaydi. */
  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotish|To'lov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 800));
  const again = await page.evaluate(() => ({
    modal: !!document.querySelector("#pay-amount"),
    can:   !document.querySelector(".pay-modal-submit")?.disabled,
    busy:  !!document.querySelector('.pay-modal-submit[data-loading]'),
  }));
  again.modal ? ok("keyingi chek uchun to'lov oynasi yana ochildi")
              : no("to'lov oynasi ochilishi kerak", "ochilmadi");
  again.busy ? no("tugma bo'sh bo'lishi kerak", "«Bajarilmoqda»") : ok("tugma bo'sh");
  again.can ? ok("ikkinchi sotuv ham qilinadi") : no("ikkinchi sotuv qilinishi kerak", "tugma yopiq");
}

await page.close();

/* ══════════════════════════════════════════════════════════════════════
   9. SCROL BO'LMASIN — HAR EKRANDA

   Do'kon egasining so'zi: «bu oynada scrol bo'lishi mumkin emas!!!».

   ⚠ ILGARI BU TEKSHIRUV YOLG'ON XOTIRJAMLIK BERARDI. U bitta katta
   ekranda (1600×950) va faqat BITTA elementda (`.pay-modal-body`)
   o'lchardi. Kassa monobloklari esa 768px yoki 720px balandlikda —
   aynan o'sha yerda oyna sig'masdi va do'kon egasi buni ekrandan
   ko'rsatdi. Endi:

     · bir nechta HAQIQIY monoblok o'lchamida tekshiriladi;
     · oynaning HAMMA bolasi qaraladi, bittasi emas;
     · savatda 9 ta tovar — ro'yxat eng uzun holatida;
     · ogohlantirishlar ham chiqarilgan (nasiya + mijoz kerak).

   ⚠ `.pay-items` HISOBGA OLINMAYDI: tovarlar ro'yxatining O'ZI ichida
   aylanishi TO'G'RI — 30 ta tovarni ekranga sig'dirib bo'lmaydi.
   To'silishi kerak bo'lgani — OYNANING aylanishi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 9. Scrol bo'lmasin — har ekranda ──");

const MANY = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, name: "Kiyim nomi uzunroq " + (i + 1),
  salePrice: 45000 + i * 1000, qty: (i % 3) + 1, unit: "DONA", stockQuantity: 99,
}));
/* Haqiqiy monobloklar va noutbuklar. 1024×768 — eng past kafolat. */
const SCREENS = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 768], [980, 700]];

for (const [w, h] of SCREENS) {
  const pg = await openKassa({ w, h, items: MANY });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotish|To'lov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));
  /* Qisman to'lov — nasiya qatori va «mijozni tanlang» ogohlantirishi
     chiqsin: oyna eng BALAND holatida o'lchansin. */
  await pg.focus("#pay-amount");
  for (let i = 0; i < 30; i++) {
    if (await pg.$eval("#pay-amount", (el) => el.value === "")) break;
    await pg.keyboard.press("End"); await pg.keyboard.press("Backspace");
  }
  await pg.type("#pay-amount", "20000", { delay: 8 });
  await new Promise((r) => setTimeout(r, 250));

  const worst = await pg.evaluate(() => {
    const box = document.querySelector(".pay-modal-box");
    if (!box) return { sel: "oyna ochilmadi", y: 9999 };
    let out = { sel: "-", y: 0 };
    for (const el of [box, ...box.querySelectorAll("*")]) {
      if (el.closest(".pay-items")) continue;          // ro'yxatning o'zi — mumkin
      const y = el.scrollHeight - el.clientHeight;
      /* `overflow: hidden` bo'lgan blok ATAYLAB qirqadi (bezak
         doiralari) — u aylanmaydi va ota-onasini ham cho'zmaydi. */
      if (getComputedStyle(el).overflowY === "hidden") continue;
      if (y > out.y) out = { sel: (el.className || el.tagName).toString().trim().slice(0, 40), y };
    }
    return out;
  });
  worst.y <= 1 ? ok(`${w}×${h} — scrol yo'q`)
               : no(`${w}×${h} — scrol paydo bo'ldi`, `${worst.sel} +${worst.y}px`);
  await pg.close();
}

await browser.close(); server.close();

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tushdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tushmadi");
}
console.log(bad ? `\n  ${bad} ta xato — to'lov oynasi buzilgan.\n` : "\n  ✅ To'lov oynasi: hammasi o'tdi\n");
process.exit(bad ? 1 : 0);
