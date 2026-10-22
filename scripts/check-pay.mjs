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
/** Serverga YUBORILGAN cheklar — tanasi bilan (§8i). */
const sentSales = [];

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
/* ⚠ MIJOZ RO'YXATI MOCK DAN kelishi SHART. Savatdagi mijoz sahifaning
   o'z ro'yxatidan tanlanadi (`customers.find(...)`) va ro'yxat bo'sh
   bo'lsa u NULL ga aylanadi — ya'ni localStorage ga yozib qo'yish
   yetmaydi. */
async function openKassa({ w = 1600, h = 950, items = ONE, carts = null,
                           customers = null, tier = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const CORS = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: CORS });
    const p = new URL(r.url()).pathname;
    /* ⚠ YUBORILGAN TANA SAQLANADI. Ekranda to'g'ri ko'rinishi
       yetmaydi: serverga aynan nima ketgani muhim va u faqat shu
       yerdan ko'rinadi (§8i qarz muddatini shundan tekshiradi). */
    if (/\/sales\b/.test(r.url()) && r.method() === "POST") {
      try { sentSales.push(JSON.parse(r.postData() || "{}")); } catch { sentSales.push(null); }
    }
    const body = r.url().includes("/shop/profile")
      ? { success: true, data: PROFILE }
      : /\/sales\b/.test(r.url()) && r.method() === "POST"
        ? { success: true, data: { id: 777, receiptUrl: null } }
      : customers && /\/customers$/.test(p)
        ? { success: true, data: customers }
      : tier && /\/tier|\/loyalty/.test(p)
        ? { success: true, data: tier }
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
    /* «Mijozdan jami» (V94) — usul EMAS, ro'yxatning yakuni. Usullarni
       sanaydigan bandlar uni chiqarib tashlashi shart. */
    taken: r.classList.contains("pay-sum__row--taken"),
  })),
  btns: [...document.querySelectorAll(".pay-type-btn")].map((b) => ({
    txt: b.textContent.replace(/\s+/g, " ").trim(),
    active: b.classList.contains("active"),
    has: b.classList.contains("has-amount"),
  })),
  /* «Summani kiriting» — hisobning ichidagi bo'sh qator (V86). */
  empty: document.querySelector(".pay-sum__empty")?.textContent.trim() || null,
  submit: !document.querySelector(".pay-modal-submit")?.disabled,
  scroll: (() => { const m = document.querySelector(".pay-modal-body") || document.querySelector(".pay-modal");
                   return m ? m.scrollHeight - m.clientHeight : -1; })(),
  warns: [...document.querySelectorAll(".pay-mixed-warn")].map((w) => w.textContent.trim()),
  /* ⚠ FOKUS `id` bo'yicha o'qiladi, elementning o'zi bo'yicha emas:
     `evaluate` DOM tugunini qaytara olmaydi (V94). */
  focus: document.activeElement?.id || document.activeElement?.tagName || null,
  /* «Mijozdan jami» qatori (V94) — bor-yo'qligi va summasi. */
  taken: (() => {
    const r = document.querySelector(".pay-sum__row--taken");
    return r ? r.querySelector("b")?.textContent.trim() : null;
  })(),
  /* Summa maydonining «×» tugmasi (V94). */
  clearX: !!document.querySelector("#pay-amount")?.parentElement
            ?.querySelector(".field-clear"),
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
  .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
await new Promise((r) => setTimeout(r, 700));
let s = await state();
if (s.input === null) { console.log("  ❌ tölov oynasi oçilmadi"); await browser.close(); server.close();

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tuşdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tuşmadi");
} process.exit(1); }

console.log("\n── 1. Maydon BÖŞ oçiladi — VA TÖLOV YÖQ (V86) ──");
/* ⚠ BU BO'LIM 2026-09-06 DA TESKARISIGA O'ZGARDI.

   Ilgari u «maydon bo'sh ochiladi, LEKIN chek naqd» qoidasini
   qulflab turardi: hisobda kassir yozmagan «Naqd 100 000» qatori
   paydo bo'lar, «Sotish» esa ochiq turardi. Do'kon egasi buni xato
   deb ko'rsatdi va u haq — pul hisobi buziladi:

     · yashikda bo'lmagan naqd ko'rinadi;
     · Click tanlangan bo'lsa ham «naqd» deyiladi;
     · o'sha qatorni ✕ bilan o'chirib bo'lmaydi (u `paid` da yo'q).

   Yangi qoida: PUL KIRITILMAGUNCHA TO'LOV YO'Q. Maydon baribir bo'sh
   ochiladi (bu talab kuchida) va placeholder chek summasini
   ko'rsatadi — lekin bu TAKLIF, yozilgan qiymat emas. */
s.input === "" ? ok("maydon böş") : no("maydon böş bölişi kerak", `«${s.input}»`);
(s.hold || "").replace(/\D/g, "") === "100000"
  ? ok(`placeholder: ${s.hold}`) : no("placeholder 100 000 körsatişi kerak", s.hold);
s.rows.length === 0
  ? ok("hisobda birorta qator yöq — ekran yolğon gapirmaydi")
  : no("hisob böş bölişi kerak", JSON.stringify(s.rows));
s.btns.some((b) => b.has)
  ? no("birorta tugma belgilanmasligi kerak", s.btns.filter((b) => b.has).map((b) => b.txt).join(" | "))
  : ok("birorta tugmada summa yöq");
s.rows.some((r) => r.credit) ? no("nasiya bölmasligi kerak", "bor") : ok("nasiya yöq");
s.custNeed ? no("mijoz söralmasligi kerak", "ishora bor") : ok("mijoz söralmaydi");
/* ⚠ ASOSIY BAND: tugma YOPIQ. Do'kon egasi: «to'lov miqdorini
   kiritmasdan turib to'lash tugmasi ochilmasligi kerak». */
s.submit ? no("«Sotiş» YOPIQ bölişi kerak", "oçiq") : ok("«Sotiş» yopiq — summa kiritilmagan");
/* ⚠ VA NEGA yopiqligi AYTILADI. Jimgina o'chirilgan tugma kassirni
   «nega ishlamayapti» deb qidirishga majbur qilardi — bu do'kon
   egasining oldingi shikoyati edi («nega tolovga ruxsat bermayapti?»). */
/Summani kiriting/i.test(s.empty || "")
  ? ok(`sabab aytiladi: «${s.empty}»`)
  : no("«Summani kiriting» yozuvi bölişi kerak", s.empty ?? "yöq");
s.btns.length === 4 ? ok("tört usul: " + s.btns.map((b) => b.txt.split(" ")[0]).join(", "))
                    : no("törtta usul bölişi kerak", s.btns.length);
/Aralaş|Nasiya/i.test(s.btns.map((b) => b.txt).join(" "))
  ? no("«Aralaş»/«Nasiya» tugmasi qolmasligi kerak", s.btns.map((b) => b.txt).join(" | "))
  : ok("«Aralaş» ham, «Nasiya» ham tugma emas");

console.log("\n── 2. Naqd 20 000 → qolgan 80 000 NASIYAGA ──");
{
  const st = await state();
  /* Nasiya OCHIQ do'kon: qoldiq «nasiyaga» deyiladi, «to'lanmagan» emas. */
  st.warns.some((w) => /nasiya yöq/i.test(w)) && no("nasiya oçiq bölişi kerak", st.warns.join(" "));
}
await type("20000");
s = await state();
const credit = () => (state()).then((x) => x.rows.find((r) => r.credit)?.val ?? "yöq");
let c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "80000" ? ok(`nasiya ${c}`) : no("nasiya 80 000 bölişi kerak", c ?? "yöq");
s.rows.some((r) => r.change) ? no("qaytim bölmasligi kerak", "bor") : ok("qaytim yöq");

console.log("\n── 3. Click 15 000 → nasiya 65 000, naqd saqlanadi ──");
await pick("Click");
s = await state();
s.input === "" ? ok("Click böş maydon bilan oçildi") : no("Click maydoni böş bölişi kerak", s.input);
await type("15000");
s = await state();
c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "65000" ? ok(`nasiya ${c}`) : no("nasiya 65 000 bölişi kerak", c ?? "yöq");
const naqdRow = s.rows.find((r) => /Naqd/i.test(r.name || ""));
(naqdRow?.val || "").replace(/\D/g, "") === "20000" ? ok(`naqd qatori ${naqdRow.val}`) : no("naqd 20 000 qolishi kerak", naqdRow?.val ?? "yöq");

console.log("\n── 4. NAQDGA QAYTSA — eski qiymati turadi (asosiy talab) ──");
await pick("Naqd");
s = await state();
s.input.replace(/\D/g, "") === "20000" ? ok(`maydonda ${s.input}`) : no("maydonda 20 000 bölişi kerak", s.input);
s.btns.find((b) => b.txt.includes("Naqd"))?.active ? ok("Naqd tugmasi tanlangan") : no("Naqd tanlangan bölişi kerak", "yöq");
const marked = s.btns.filter((b) => b.has).map((b) => b.txt.split(" ")[0]);
marked.length === 2 ? ok("pul yozilgan tugmalar belgilangan: " + marked.join(", ")) : no("ikkita tugma belgilanishi kerak", marked.join(",") || "yöq");

console.log("\n── 4b. Nasiya matni va mijoz talabi ──");
{
  const st = await state();
  const row = st.rows.find((r) => r.credit);
  /Qolgani nasiyaga/i.test(row?.name || "") ? ok(`nasiya qatori: «${row.name}»`)
    : no("«Qolgani nasiyaga» deyilishi kerak", row?.name);
  st.warns.length ? ok("mijoz talab qilinadi: " + st.warns[0]) : no("mijoz söralişi kerak", "yöq");
  st.submit ? no("mijozsiz «Sotiş» yopiq bölişi kerak", "oçiq") : ok("mijozsiz «Sotiş» yopiq");
  /* ⚠ Do'kon egasining talabi: «mijoz tanlash majburiy bo'lganda
     mijoz tanlash oynasi ishora qilib tursin». */
  st.custNeed ? ok("mijoz tanlagichi ishora qilyapti") : no("tanlagiç işora qilişi kerak", "belgi yöq");
  st.custHint ? ok(`tanlagich tagida: «${st.custHint}»`) : no("tanlagich tagida yozuv kerak", "yöq");
  st.warnBtn ? ok("ogohlantiriş bosiladigan — tanlagiçni oçadi") : no("ogohlantiriş tugma bölişi kerak", "oddiy yozuv");
  {
    /* Bosilsa — ro'yxat ochilsin. */
    await page.click(".pay-warn-btn");
    await new Promise((r) => setTimeout(r, 350));
    const open = await page.evaluate(() => !!document.querySelector(".ek-select__menu, .ek-select__pop, [role='listbox']"));
    open ? ok("bosilganda mijoz röyxati oçildi") : no("röyxat oçilişi kerak", "oçilmadi");
    /* ⚠ `Escape` ISHLATILMAYDI: ro'yxat o'zi yopilib ulgursa, tugma
       to'lov OYNASIGA borib tegadi va u yopilib ketardi (shu yerda
       tutildi). Tanlagichni o'z tugmasi bilan yopamiz. */
    await page.click(".cart-cust .ek-select__btn");
    await new Promise((r) => setTimeout(r, 300));
    (await page.$("#pay-amount"))
      ? ok("tölov oynasi oçiq qoldi") : no("tölov oynasi oçiq qolişi kerak", "yopildi");
  }
}

console.log("\n── 4c. Naqdga 0 — töliq nasiya ──");
{
  await pick("Click"); await type("");
  await pick("Naqd");  await type("0");
  const st = await state();
  const c = st.rows.find((r) => r.credit)?.val;
  (c || "").replace(/\D/g, "") === "100000"
    ? ok(`töliq nasiya ${c}`) : no("töliq nasiya 100 000 bölişi kerak", c ?? "yöq");
  st.hold === "0" ? ok("yozilgaç placeholder «0» böladi") : no("placeholder «0» bölişi kerak", st.hold);
}

console.log("\n── 5. Uçinçi usul ham qöşiladi (çeksiz) ──");
/* ⚠ HOLAT SHU YERDA QAYTA QURILADI. Ilgari bu bo'lim o'zidan
   oldingi bo'limlar qoldirgan qiymatlarga tayanardi va yuqoriga
   yangi bo'lim qo'shilishi bilan kutilmalar «o'z-o'zidan» noto'g'ri
   bo'lib qoldi. Har bo'lim o'z holatini o'zi qo'yadi. */
await pick("Naqd");  await type("20000");
await pick("Click"); await type("15000");
await pick("Karta"); await type("30000");
s = await state();
c = s.rows.find((r) => r.credit)?.val;
(c || "").replace(/\D/g, "") === "35000" ? ok(`nasiya ${c}`) : no("nasiya 35 000 bölişi kerak", c ?? "yöq");
s.rows.filter((r) => !r.credit && !r.change && !r.taken).length === 3
  ? ok("uçala usul röyxatda") : no("uçta qator bölişi kerak", JSON.stringify(s.rows.map((r) => r.name)));
/* Uchta usul bor — demak «Mijozdan jami» ham turishi kerak (V94). */
s.rows.some((r) => r.taken) ? ok("«Mijozdan jami» qatori bor")
                            : no("uçta usulda jami körsatilişi kerak", "yöq");

console.log("\n── 6. Naqd ortiqça → QAYTIM, nasiya yöq ──");
await pick("Naqd");
await type("100000");
s = await state();
const ch = s.rows.find((r) => r.change)?.val;
(ch || "").replace(/\D/g, "") === "45000" ? ok(`qaytim ${ch}`) : no("qaytim 45 000 bölişi kerak", ch ?? "yöq");
s.rows.some((r) => r.credit) ? no("nasiya qolmasligi kerak", "bor") : ok("nasiya yöq");
s.submit ? ok("«Sotiş» oçiq") : no("«Sotiş» oçiq bölişi kerak", "yopiq");

console.log("\n── 7. Naqdsizda ortiqça → OGOHLANTIRIŞ, sotib bölmaydi ──");
await pick("Naqd"); await type("");
await pick("Click"); await type("500000");
s = await state();
s.warns.length ? ok("ogohlantiriş: " + s.warns[0].replace(/\s+/g, " ")) : no("ogohlantiriş çiqişi kerak", "yöq");
s.submit ? no("«Sotiş» yopilişi kerak", "oçiq") : ok("«Sotiş» yopiq");
/{|}/.test(s.warns.join(" ")) ? no("yozuvda töldirilmagan {…} qolgan", s.warns.join(" ")) : ok("yozuvda {…} qolmagan");

/* ⚠⚠ QATOR OLIB TASHLANDI, RAQAM QOLDI (V95).

   Do'kon egasi «Naqdsiz usuldan ortiq» qatorini olib tashlashni
   so'radi — u qizil ogohlantirish bilan bir xil shartda, bir xil
   raqamni ko'rsatardi.

   Bu ikki band shu ikkisini birga qulflaydi: qator QAYTA
   QO'SHILMASIN, lekin summa ekrandan YO'QOLIB HAM KETMASIN. Ikkinchisi
   birinchisidan muhimroq: ortiqcha pulning miqdorini ko'rsatmasdan
   sotuvni to'sish — kassirni sababsiz qamab qo'yish bo'lardi. */
s.rows.some((r) => /ortiq/i.test(r.name || ""))
  ? no("hisobdagi «ortiq» qatori olib taşlangan bölişi kerak", "bor")
  : ok("hisobda takroriy «ortiq» qatori yöq");
/471\s?010|400\s?000|\d/.test(s.warns.join(" ")) && /\d[\d\s]{4,}/.test(s.warns.join(" "))
  ? ok("ortiqça summasi ogohlantirişda körinadi: " + s.warns.join(" ").replace(/\s+/g, " "))
  : no("ogohlantirişda summa bölişi kerak", s.warns.join(" "));

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
(s.label || "").includes("Payme") && !/{|}/.test(s.label) ? ok(`maydon yorliği: «${s.label}»`) : no("yorliq usul nomini körsatişi kerak", s.label);

console.log("\n── 8b. Qatorlar tartibi surilmaydi ──");
{
  await pick("Naqd"); await type("");           // naqdni butunlay olib tashlash
  await pick("Karta"); await type("30000");
  await pick("Naqd");  await type("20000");     // eng oxirida qayta yozildi
  const st = await state();
  const names = st.rows.filter((r) => !r.credit && !r.change && !r.taken).map((r) => r.name.trim());
  /Naqd/.test(names[0] || "") ? ok("Naqd birinçi qatorda: " + names.join(" · "))
    : no("Naqd birinçi bölişi kerak", names.join(" · "));
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
console.log("\n── 8c. Sotuv oxirigaça ötadi ──");
{
  await pick("Karta"); await type("");
  await pick("Click"); await type("");
  /* ⚠ NAQD ENDI YOZILADI (V86). Ilgari bu yerda uchala maydon
     bo'shatilar va «hammasi naqd» degan taxminga tayanilardi — o'sha
     taxmin olib tashlandi: kiritilmagan pul to'lov emas. Kassir
     yuradigan yo'l ham shu: summani yozadi, keyin «Sotish». */
  await pick("Naqd");  await type("100000");
  await page.click(".pay-modal-submit");
  await new Promise((r) => setTimeout(r, 1600));

  const after = await page.evaluate(() => ({
    finish: !!document.querySelector(".ek-finish"),
    modal:  !!document.querySelector("#pay-amount"),
    busy:   !!document.querySelector('.pay-modal-submit[data-loading]'),
    count:  document.querySelector(".ek-finish__count")?.textContent || null,
  }));
  after.finish ? ok("yakunlaş oynasi çiqdi") : no("yakunlaş oynasi çiqişi kerak", "yöq");
  after.modal ? no("tölov oynasi yopilişi kerak", "oçiq") : ok("tölov oynasi yopildi");
  after.busy ? no("tugma «Bajarilmoqda» da qolmasligi kerak", "qotib qoldi") : ok("tugma qotib qolmadi");
  after.count ? ok(`sanoq körinadi: ${after.count}`) : no("qolgan sekundlar körinişi kerak", "yöq");

  /* Esc — yozuvda bor edi, lekin hech qayerda ushlanmagan edi. */
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 400));
  (await page.$(".ek-finish"))
    ? no("Esc yakunlaş oynasini yopişi kerak", "yopilmadi") : ok("Esc oynani yopdi");

  /* ⚠ IKKINCHI SOTUV — asosiy tekshiruv. Do'kon egasining so'zi:
     «bir marta sotuv qilgandan keyin shunday bajarilmoqda bo'lib
     qolyapti». Ya'ni birinchi sotuv o'tadi, ikkinchisi to'xtaydi. */
  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 800));
  const again = await page.evaluate(() => ({
    modal: !!document.querySelector("#pay-amount"),
    can:   !document.querySelector(".pay-modal-submit")?.disabled,
    busy:  !!document.querySelector('.pay-modal-submit[data-loading]'),
  }));
  again.modal ? ok("keyingi çek uçun tölov oynasi yana oçildi")
              : no("tölov oynasi oçilişi kerak", "oçilmadi");
  again.busy ? no("tugma böş bölişi kerak", "«Bajarilmoqda»") : ok("tugma böş");
  /* ⚠ YANGI CHEK — YANGI SUMMA (V86). Oyna bo'sh ochiladi, ya'ni
     tugma HAM yopiq bo'lishi kerak: oldingi chekning summasi
     keyingisiga o'tib ketmaydi. Bu §1 dagi qoidaning ikkinchi
     chekdagi takrori — aynan shu yerda u eng oson buzilardi. */
  again.can ? no("yangi çekda tugma yopiq bölişi kerak", "oçiq")
            : ok("yangi çek böş boşlanadi — tugma yopiq");
  /* ⚠ ASOSIY BAND SHU: summa yozilgach ikkinchi sotuv HAM o'tadi.
     Do'kon egasining shikoyati aynan ikkinchi sotuvda edi. */
  await type("100000");
  (await page.evaluate(() => !document.querySelector(".pay-modal-submit")?.disabled))
    ? ok("summa yozilgaç ikkinçi sotuv ham qilinadi")
    : no("ikkinçi sotuv qilinişi kerak", "tugma yopiq");
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

/**
 * Mijozni EKRAN ORQALI tanlaydi.
 *
 * ⚠ `localStorage` ga yozib qo'yish YETMAYDI: savatdagi mijoz
 * sahifaning o'z ro'yxatidan olinadi va tiklanganda ro'yxatda
 * topilmasa bo'shab qoladi. Sinov ham kassir yuradigan yo'ldan
 * yurishi kerak — o'shanda u haqiqiy xulqni tekshiradi.
 */
async function pickCustomer(pg, name) {
  await pg.evaluate(() => document.querySelector(".cart-cust .ek-select__btn")?.click());

  await new Promise((r) => setTimeout(r, 350));
  const done = await pg.evaluate((n) => {
    const opt = [...document.querySelectorAll("[role='option']")]
      .find((o) => o.textContent.includes(n));
    if (!opt) return { ok: false };
    opt.click(); return { ok: true };
  }, name);

  await new Promise((r) => setTimeout(r, 450));
  return done.ok === true;
}

/* ══ 8e. JAMG'ARMA QAYTIM CHIQARA OLMAYDI (V78) ═══════════════════════

   ⚠⚠ XAVFSIZLIK QOIDASI. Jamg'arma oddiy naqdsiz usul bo'lganda
   30 000 lik chekka 20 000 naqd + 20 000 jamg'arma yozish mumkin edi
   va ortiqcha 10 000 QAYTIM bo'lib chiqardi — mijoz o'z
   jamg'armasidan naqd pul yechib olardi.

   ⚠ MAYDONNING O'ZI cheklanadi: hisob qatlamida ham kesiladi, lekin
   kassirga xatoni QILDIRMASLIK — tuzatishni so'rashdan yaxshiroq.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 8e. Jamğarma çegarasi ──");
{
  /* Mijozda katta jamg'arma; chek 100 000. */
  const CUST = { id: 9, fullName: "Sinov mijoz", phone: "+998900000009", savingsBalance: 500000 };
  const pg = await openKassa({
    customers: [CUST],
    tier: { tierName: null, discountPercent: 0, bonusBalance: 0,
            debtBalance: 0, savingsBalance: 500000 },
    carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items: ONE }],
  });
  /* ⚠ MIJOZ TANLAGICHI TO'LOV OYNASINING ICHIDA — avval oyna
     ochiladi. Kassa ekranida bunday tugma yo'q. */
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 800));
  (await pickCustomer(pg, "Sinov mijoz")) ? ok("mijoz tanlandi")
                                          : no("mijozni tanlab bölmadi");

  /* Avval naqd 60 000. */
  await pg.focus("#pay-amount");
  await pg.type("#pay-amount", "60000", { delay: 8 });
  await new Promise((r) => setTimeout(r, 250));

  /* Endi jamg'armaga o'tamiz — qolgani 40 000 bo'lishi kerak. */
  const gotSavings = await pg.evaluate(() => {
    const b = [...document.querySelectorAll(".cust-fact--btn")]
      .find((x) => /jam[gğ]/i.test(x.textContent));
    if (!b || b.disabled) return false;
    b.click(); return true;
  });
  if (!gotSavings) { no("jamğarma tugmasi topilmadi"); }
  else {
    await new Promise((r) => setTimeout(r, 300));
    const hint = await pg.$eval(".pay-modal-body", (n) => n.innerText);
    /40\s*000/.test(hint)
      ? ok("çegara QOLGAN summa (40 000) deb körsatiladi")
      : no("çegara qoldiq (500 000) bölib qoldi", hint.slice(0, 200).replace(/\n/g, " | "));

    /* Chegaradan katta son yozib ko'ramiz — maydon uni O'TKAZMASLIGI kerak. */
    await pg.focus("#pay-amount");
    for (let i = 0; i < 20; i++) {
      if (await pg.$eval("#pay-amount", (el) => el.value === "")) break;
      await pg.keyboard.press("End"); await pg.keyboard.press("Backspace");
    }
    await pg.type("#pay-amount", "200000", { delay: 8 });
    await new Promise((r) => setTimeout(r, 300));
    const val = await pg.$eval("#pay-amount", (el) => Number(el.value.replace(/\D/g, "")));
    val <= 40000 ? ok(`maydon çegaradan ötkazmadi (${val})`)
                 : no("jamğarmadan ortiqça yozib böldi", String(val));

    /* Va QAYTIM chiqmasligi kerak. */
    const txt = await pg.$eval(".pay-modal-body", (n) => n.innerText);
    !/qaytim/i.test(txt)
      ? ok("QAYTIM qatori yöq — pul çiqariş yöli yopiq")
      : no("jamğarmadan qaytim çiqdi", txt.slice(0, 200).replace(/\n/g, " | "));
  }
  await pg.close();
}

/* ══ 8f. MIJOZ KARTOCHKASI — TO'RTALASI HAM (V78) ═════════════════════

   ⚠ Ilgari har katak o'z sharti bilan chizilardi va bir mijozda
   to'rttasi, boshqasida ikkitasi chiqardi: kassir «jamg'armasi yo'q»
   bilan «jamg'armasi nol» ni ajrata olmasdi, kataklarning joyi ham
   har safar siljib turardi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 8f. Mijoz kartoçkasi ──");
{
  /* HAMMASI NOL bo'lgan mijoz — eng yomon holat. */
  /* ⚠ HAMMASI NOL bo'lgan mijoz — eng yomon holat: ilgari uning
     kartochkasida bitta ham katak chizilmasdi. */
  const NEW_CUST = { id: 9, fullName: "Yangi mijoz", phone: "+998900000009", savingsBalance: 0 };
  const pg = await openKassa({
    customers: [NEW_CUST],
    tier: { tierName: null, discountPercent: 0, bonusBalance: 0,
            debtBalance: 0, savingsBalance: 0 },
    carts: [{ id: 1, discount: "", bonusUse: "", customer: null, items: ONE }],
  });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 800));
  (await pickCustomer(pg, "Yangi mijoz")) ? ok("mijoz tanlandi")
                                          : no("mijozni tanlab bölmadi");

  const facts = await pg.$$eval(".cust-fact", (n) => n.map((x) => ({
    lab: x.querySelector(".cust-fact__lab")?.textContent.trim() || "",
    val: x.querySelector(".cust-fact__val")?.textContent.trim() || "",
  })));
  facts.length === 4
    ? ok(`törtala katak ham çizildi (${facts.map((f) => f.lab).join(" · ")})`)
    : no("kataklar soni notöğri", `${facts.length}: ` + facts.map((f) => f.lab).join(" · "));

  /* ⚠ Nol ham KO'RSATILADI: «yo'q» va «nol» kassir uchun bir xil
     ma'no, lekin katakning yo'qolishi qolganlarini surib yuborardi. */
  const zeros = facts.filter((f) => /^0\s/.test(f.val)).length;
  zeros >= 3 ? ok(`nol qiymatlar ham körinadi (${zeros} ta)`)
             : no("nol qiymatli katak yashirildi", facts.map((f) => `${f.lab}=${f.val}`).join(" | "));

  /* Jamg'arma tugmasi nolda O'CHIQ bo'lishi kerak. */
  const off = await pg.evaluate(() => {
    const b = [...document.querySelectorAll(".cust-fact--btn")]
      .find((x) => /jam[gğ]/i.test(x.textContent));
    return b ? b.disabled : null;
  });
  off === true ? ok("böş jamğarma tugmasi bosilmaydi")
               : no("böş jamğarmani tanlab böldi", String(off));
  await pg.close();
}

/* ══ 8c2. EKRANDA BUZUQ QIYMAT BO'LMASIN (V76) ════════════════════════

   ⚠ HAQIQIY XATO shu yerdan topilgan. Smena javobi kutilmagan shaklda
   kelganda (bu sinovdagi mock aynan shunday qaytaradi — bo'sh massiv)
   `new Date(undefined).toLocaleTimeString()` ekranga «Invalid Date»
   deb YOZARDI va kassir tepada shu yozuvni ko'rib turardi. Sahifada
   JS xatosi tushmasdi, shuning uchun birorta tekshiruv bundan xabar
   bermasdi.

   Endi butun kassa ekrani buzuq qiymatlarga qaraladi: noma'lum vaqt
   ekranga son yoki inglizcha xato matni bo'lib chiqmasligi kerak.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 8c2. Ekranda buzuq qiymat ──");
{
  const pg = await openKassa();
  const junk = await pg.evaluate(() => {
    const txt = document.body.innerText || "";
    return ["Invalid Date", "NaN", "undefined", "[object Object]"]
      .filter((w) => txt.includes(w));
  });
  junk.length === 0 ? ok("ekranda «Invalid Date» / «NaN» / «undefined» yöq")
                    : no("ekranda buzuq qiymat bor", junk.join(", "));
  await pg.close();
}

/* ══ 8d. NAQD TUGMALARI CHEKKA QARAB QURILADI (V76) ═══════════════════

   ⚠ Ilgari bu yerda qotib qolgan uchta son turardi: 50 000, 100 000,
   200 000. Chek 100 000 bo'lganda ular hech qanday foyda bermasdi —
   birinchisi to'lovni YOPA OLMASDI (summadan kichik), ikkinchisi
   «Qolganini» tugmasini takrorlardi. Ya'ni to'rtta tugmadan bittasi
   ishlardi.
   ══════════════════════════════════════════════════════════════════════ */
console.log("\n── 8d. Naqd tugmalari ──");
{
  /* `ONE` — 100 000 so'mlik bitta tovar, ya'ni chek AYNAN yumaloq. */
  const pg = await openKassa();
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const cash = await pg.$$eval(".ek-quick-cash button",
    (n) => n.map((x) => x.textContent.replace(/\s/g, "")));
  /* Oxirgisi — «Qolganini», qolgani takliflar. */
  const sug = cash.slice(0, -1);

  sug.length > 0 ? ok(`taklif bor: ${sug.join(" · ")}`)
                 : no("yumaloq çekda naqd tugmalari YÖQOLDI", cash.join(" · "));

  sug.every((v) => Number(v.replace(/\D/g, "")) > 100000)
    ? ok("har bir taklif çekdan KATTA — tölovni yopa oladi")
    : no("çekni yopa olmaydigan taklif bor", sug.join(" · "));

  !sug.some((v) => v.replace(/\D/g, "") === "100000")
    ? ok("summaning ÖZI takrorlanmaydi — «Qolganini» tugmasi bor")
    : no("aniq summa ikki marta çiqdi", sug.join(" · "));

  sug.length <= 3 ? ok(`taklif soni uchtadan oshmadi (${sug.length})`)
                  : no("juda köp tugma — qator ikkinçi satrga tuşadi", String(sug.length));
  await pg.close();
}

console.log("\n── 8h. ⚠ KIRITILMAGAN PUL — TÖLOV EMAS (V86) ──");
/* ═══ IKKI SURAT, BITTA SABAB ═══════════════════════════════════════

   1-surat: «CLICK UCHUN SUMMA» yozuvi turibdi, maydon bo'sh, hisobda
   esa «Naqd 20 000 so'm». Pul Click orqali kelgan — yashikda 20 000
   ortiqcha, Click tushumi shuncha kam.

   2-surat: o'sha «Naqd 20 000 so'm ✕» qatori, yashil «Sotish» tugmasi
   ochiq. Do'kon egasi: «x ni bossa ham ketmayapti».

   IKKALASINING SABABI BITTA: qator kassir yozgan pulni emas, `paid`
   bo'sh bo'lganda o'zi qo'shiladigan «hammasi naqd» taxminini
   ko'rsatardi. Shuning uchun ✕ ham ish bermasdi — `paid` da o'chirsa
   bo'ladigan narsa yo'q edi.

   Taxmin olib tashlandi. Endi hisobda faqat KIRITILGAN pul turadi,
   ya'ni har qatorning `paid` da egasi bor va ✕ uni haqiqatan
   o'chiradi. */
{
  const pg = await openKassa({
    items: [{ id: 1, name: "Kurtka", salePrice: 20000, qty: 1, unit: "DONA", stockQuantity: 9 }],
  });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const read = () => pg.evaluate(() => ({
    label: document.querySelector('label[for="pay-amount"]')?.textContent.trim() || null,
    val: document.querySelector("#pay-amount")?.value ?? null,
    empty: document.querySelector(".pay-sum__empty")?.textContent.trim() || null,
    rows: [...document.querySelectorAll(".pay-sum__row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
    xs: document.querySelectorAll(".pay-sum__x").length,
    btn: [...document.querySelectorAll(".pay-type-btn")]
           .filter((b) => b.classList.contains("has-amount"))
           .map((b) => b.textContent.replace(/\s+/g, " ").trim()),
    submit: !document.querySelector(".pay-modal-submit")?.disabled,
  }));
  const put = async (v) => {
    await pg.focus("#pay-amount");
    for (let i = 0; i < 30; i++) {
      if (await pg.$eval("#pay-amount", (el) => el.value === "")) break;
      await pg.keyboard.press("End"); await pg.keyboard.press("Backspace");
    }
    if (v !== "") await pg.type("#pay-amount", v, { delay: 12 });
    await new Promise((r) => setTimeout(r, 260));
  };
  const tap = async (name) => {
    await pg.evaluate((n) => [...document.querySelectorAll(".pay-type-btn")]
      .find((x) => new RegExp(n, "i").test(x.textContent))?.click(), name);
    await new Promise((r) => setTimeout(r, 300));
  };

  /* ── a. Ochilishda: hech narsa yo'q, tugma yopiq ── */
  let v = await read();
  v.rows.length === 0 ? ok("oçilişda hisob böş") : no("hisob böş bölişi kerak", JSON.stringify(v.rows));
  v.submit ? no("«Sotiş» yopiq bölişi kerak", "oçiq") : ok("«Sotiş» yopiq");
  /Summani kiriting/i.test(v.empty || "")
    ? ok(`sabab aytiladi: «${v.empty}»`) : no("sabab yozilişi kerak", v.empty ?? "yöq");

  /* ── b. Click tanlanib summa yozilsa — qator CLICK bo'ladi ── */
  await tap("Click");
  await put("20000");
  v = await read();
  v.rows.some((r) => /Click/i.test(r) && /20 ?000/.test(r))
    ? ok("hisobda «Click 20 000» — tanlangan usul")
    : no("hisobda Click bölişi kerak", JSON.stringify(v.rows));
  !v.rows.some((r) => /Naqd/i.test(r))
    ? ok("«Naqd» qatori YÖQ — ekran yolğon gapirmaydi")
    : no("«Naqd» qolmasligi kerak", JSON.stringify(v.rows));
  v.btn.some((b) => /Click/i.test(b))
    ? ok("summa Click tugmasida körinadi") : no("Click tugmasida bölişi kerak", JSON.stringify(v.btn));
  v.submit ? ok("summa kiritilgaç «Sotiş» oçildi") : no("«Sotiş» oçilişi kerak", "yopiq");

  /* ── c. ✕ HAQIQATAN O'CHIRADI (do'kon egasining shikoyati) ── */
  v.xs === 1 ? ok("qatorda ✕ bor") : no("bitta ✕ bölişi kerak", v.xs);
  await pg.evaluate(() => document.querySelector(".pay-sum__x")?.click());
  await new Promise((r) => setTimeout(r, 300));
  v = await read();
  v.rows.length === 0
    ? ok("✕ bosilgach qator KETDI")
    : no("✕ qatorni öçirişi kerak", JSON.stringify(v.rows));
  v.submit ? no("qator öçgaç «Sotiş» yana yopilişi kerak", "oçiq") : ok("«Sotiş» yana yopildi");
  v.btn.length === 0 ? ok("tugmadagi belgi ham ketdi") : no("tugma belgisi qolmasligi kerak", JSON.stringify(v.btn));
  v.val === "" ? ok("maydon ham böşadi") : no("maydon böşaşi kerak", v.val);

  /* ── d. Naqdga yozilsa — qator NAQD bo'ladi ── */
  await tap("Naqd");
  await put("20000");
  v = await read();
  v.rows.some((r) => /Naqd/i.test(r) && /20 ?000/.test(r))
    ? ok("naqdga yozilsa — «Naqd 20 000»")
    : no("naqd qatori bölişi kerak", JSON.stringify(v.rows));
  await pg.close();
}

console.log("\n── 8g. ⚠ NAQDSIZ ORTIQÇA JAMĞARMAGA — SOTIŞ OÇIQ ──");
/* ═══ EKRAN O'ZI BILAN ZIDDIYATGA TUSHGAN EDI ═══════════════════════

   Do'kon egasining surati: Click 100 000, chek 20 000. Yashil qatorda
   «Jamg'armaga +80 000», tagida yashil tugma «Qaytim jamg'armaga» —
   va SHU BILAN BIRGA qizil «Ortiqcha 80 000. Qaytim faqat naqddan»
   hamda o'chirilgan «Sotish» tugmasi.

   Sabab: V78 ortiqchani jamg'armaga yo'naltirish yo'lini ochgan,
   lekin ikkita qorovul eski `pay.over > 0` shartida qolgan edi —
   biri tugmani o'chirardi, ikkinchisi qizil xatoni chizardi.
   Kassirda hech qanday yo'l yo'q edi: mijoz to'lagan, pulning
   manzili bor, chek esa yopilmasdi. */
{
  const pg = await openKassa({
    items: [{ id: 1, name: "Kurtka", salePrice: 20000, qty: 1, unit: "DONA", stockQuantity: 9 }],
    customers: [{ id: 7, fullName: "Vali", phone: "+998901234567", savingsBalance: 0 }],
  });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));
  await pickCustomer(pg, "Vali");

  /* Click tanlanadi va 100 000 yoziladi. */
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll(".pay-type-btn")].find((x) => /Click/i.test(x.textContent));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 250));
  await pg.evaluate(() => {
    const el = document.querySelector("#pay-amount");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "100000"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));

  const read = () => pg.evaluate(() => ({
    warn: [...document.querySelectorAll(".pay-mixed-warn")].map((w) => w.textContent.trim()),
    rows: [...document.querySelectorAll(".pay-sum__row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
    sav: !!document.querySelector(".pay-change-sav"),
    savOn: !!document.querySelector(".pay-change-sav.active"),
    can: !document.querySelector(".pay-modal-submit")?.disabled,
  }));

  let v = await read();
  /* ⚠ TUGMA O'CHIQ BO'LISHI TO'G'RI — hali jamg'armaga
     yo'naltirilmagan, ya'ni 80 000 ning manzili yo'q. */
  !v.can ? ok("yönaltirilmagunça «Sotiş» yopiq — töğri")
         : no("yönaltirilmagan ortiqçada yopiq bölişi kerak", "oçiq");
  v.warn.some((w) => /Ortiqça/i.test(w))
    ? ok("sabab aytiladi: ortiqça") : no("ogohlantiriş bölişi kerak", JSON.stringify(v.warn));
  v.sav ? ok("«Qaytim jamğarmaga» tugmasi bor") : no("tugma bölişi kerak", "yöq");

  await pg.evaluate(() => document.querySelector(".pay-change-sav")?.click());
  await new Promise((r) => setTimeout(r, 400));
  v = await read();

  /* ⚠ ASOSIY SHART. */
  v.can ? ok("jamğarmaga yönaltirilgaç «Sotiş» OÇILDI")
        : no("«Sotiş» oçilişi kerak", "yopiq");
  !v.warn.some((w) => /Ortiqça/i.test(w))
    ? ok("qizil «ortiqça» xatosi yöqoldi — ziddiyat yöq")
    : no("xato yöqolişi kerak edi", JSON.stringify(v.warn));
  v.rows.some((r) => /Jamğarma/i.test(r) && /80 ?000/.test(r))
    ? ok("hisobda «Jamğarmaga +80 000» qatori") : no("qator bölişi kerak", JSON.stringify(v.rows));
  v.savOn ? ok("tugma faol holatda") : no("tugma faol bölişi kerak", "yöq");
  await pg.close();
}

console.log("\n── 8i. ⚠ QARZ MUDDATI TÖLOV PAYTIDA SÖRALADI (V87) ──");
/* Do'kon egasi: «qarz berilayotganda qarz muddatini to'lov paytida
   so'raydigan qilish kerak, qo'shimchasiga sozlamadagi muddat deb
   belgilay olsin, lekin to'lov paytida muddat so'rash BIRINCHI».

   Shu paytgacha muddat faqat sozlamada edi va kassir mijoz bilan
   kelishgan kunni tizimga yoza olmasdi — u daftarda qolardi. */
{
  const CUST = { id: 7, fullName: "Muddat mijoz", phone: "+998900000007",
                 savingsBalance: 0, balance: 0 };
  const pg = await openKassa({
    customers: [CUST],
    tier: { tierName: null, discountPercent: 0, bonusBalance: 0,
            savingsBalance: 0, debtBalance: 0 },
    items: [{ id: 1, name: "Kurtka", salePrice: 100000, qty: 1, unit: "DONA", stockQuantity: 9 }],
  });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const read = () => pg.evaluate(() => ({
    row:   !!document.querySelector(".pay-due"),
    label: document.querySelector(".pay-due__label")?.textContent.trim() || null,
    value: document.querySelector("#pay-due")?.value ?? null,
    min:   document.querySelector("#pay-due")?.min ?? null,
    left:  document.querySelector(".pay-due__left")?.textContent.trim() || null,
    x:     !!document.querySelector(".pay-due__x"),
    submit: !document.querySelector(".pay-modal-submit")?.disabled,
  }));
  const put = async (v) => {
    await pg.focus("#pay-amount");
    for (let i = 0; i < 30; i++) {
      if (await pg.$eval("#pay-amount", (el) => el.value === "")) break;
      await pg.keyboard.press("End"); await pg.keyboard.press("Backspace");
    }
    if (v !== "") await pg.type("#pay-amount", v, { delay: 12 });
    await new Promise((r) => setTimeout(r, 260));
  };
  /* Mahalliy sana — sinov ham `ek-due.js` bilan bir xil qoidada
     yurishi kerak (UTC ishlatsa kechqurun bir kunga adashardi). */
  const isoDay = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ── a. Nasiya YO'Q — muddat ham so'ralmaydi ── */
  await put("100000");
  let v = await read();
  v.row ? no("töliq tölangan çekda muddat söralmasligi kerak", "qator bor")
        : ok("töliq tölovda muddat qatori yöq");

  /* ── b. Nasiya paydo bo'ldi — muddat SO'RALADI ── */
  await put("40000");
  v = await read();
  v.row ? ok("nasiya çiqişi bilan muddat qatori paydo böldi")
        : no("muddat qatori bölişi kerak", "yöq");
  /* ⚠ SOZLAMADAGI 30 KUN — TAYYOR TAKLIF (`PROFILE.creditDueDays`). */
  v.value === isoDay(30)
    ? ok(`sozlamadan töldirildi: ${v.value} (bugun + 30)`)
    : no(`sozlamadagi 30 kun qöyilişi kerak (${isoDay(30)})`, v.value);
  v.min === isoDay(0) ? ok("ötmişga qöyib bölmaydi (min = bugun)")
                      : no(`min bugun bölişi kerak (${isoDay(0)})`, v.min);
  /(30|kun)/i.test(v.left || "") ? ok(`qolgan kun körinadi: ${v.left}`)
                                 : no("«30 kun» yozuvi bölişi kerak", v.left);

  /* ── c. Kassir boshqa kunni tanladi ── */
  await pg.$eval("#pay-due", (el, val) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, isoDay(3));
  await new Promise((r) => setTimeout(r, 300));
  v = await read();
  v.value === isoDay(3) ? ok("kassir kelişilgan kunni qöydi") : no("sana özgarişi kerak", v.value);
  /3/.test(v.left || "") ? ok(`qolgan kun yangilandi: ${v.left}`)
                         : no("«3 kun» bölişi kerak", v.left);

  /* ── d. Muddatsiz ham mumkin ── */
  v.x ? ok("✕ bor — muddatsiz qiliş yöli oçiq") : no("✕ bölişi kerak", "yöq");
  await pg.evaluate(() => document.querySelector(".pay-due__x")?.click());
  await new Promise((r) => setTimeout(r, 250));
  v = await read();
  v.value === "" ? ok("✕ muddatni oldi — «kelishilmagan»") : no("maydon böşaşi kerak", v.value);

  /* ── e. SERVERGA AYNAN O'SHA SANA KETADI ── */
  await pg.$eval("#pay-due", (el, val) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, isoDay(10));
  await new Promise((r) => setTimeout(r, 250));
  /* Nasiyada mijoz SHART — usiz «Sotish» yopiq. */
  await pg.evaluate(() => document.querySelector(".cart-cust .ek-select__btn")?.click());
  await new Promise((r) => setTimeout(r, 350));
  await pg.evaluate((n) => [...document.querySelectorAll("[role='option']")]
    .find((o) => o.textContent.includes(n))?.click(), "Muddat mijoz");
  await new Promise((r) => setTimeout(r, 450));

  const before = sentSales.length;
  await pg.click(".pay-modal-submit");
  await new Promise((r) => setTimeout(r, 1600));
  const body = sentSales[before] || null;
  body ? ok("çek serverga ketdi") : no("çek yuborilişi kerak", "yöq");
  body?.creditDueDate === isoDay(10)
    ? ok(`serverga muddat ketdi: ${body.creditDueDate}`)
    : no(`serverga ${isoDay(10)} ketişi kerak`, JSON.stringify(body?.creditDueDate));
  await pg.close();
}

console.log("\n── 8j. ⚠ USUL TUGMASI KURSORNI SUMMAGA QAYTARADI (V94) ──");
/* ═══ IZOH VA'DA BERGAN, KOD BAJARMAGAN ════════════════════════════

   F1..F4 yonidagi izohda «usulni tanlaydi va kursorni summa maydoniga
   qaytaradi» deb turardi, `focusMethod` esa faqat `setPayFocus` qilardi.
   Do'kon egasi ko'rsatdi: tugma bosiladi, summa yozila boshlanadi va
   hech qayerga tushmaydi.

   ⚠ SICHQONCHA BILAN BOSILADI (`page.click`), `evaluate` ichidagi
   `.click()` bilan emas: aynan HAQIQIY bosishda fokus tugmaga o'tadi
   va shundan keyin maydonga qaytishi kerak. `evaluate` dagi bosish
   fokusni umuman ko'chirmasdi — ya'ni tekshiruv o'tib ketaverardi. */
{
  const pg = await openKassa({ items: ONE });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const focusOf = () => pg.evaluate(() => document.activeElement?.id || null);

  for (const name of ["Karta", "Click", "Payme", "Naqd"]) {
    const box = await pg.evaluate((n) => {
      const b = [...document.querySelectorAll(".pay-type-btn")].find((x) => x.textContent.includes(n));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, name);
    if (!box) { no(`«${name}» tugmasi topilmadi`, "yöq"); continue; }
    await pg.mouse.click(box.x, box.y);
    await new Promise((r) => setTimeout(r, 250));
    const f = await focusOf();
    f === "pay-amount" ? ok(`«${name}» → kursor summa maydonida`)
                       : no(`«${name}» dan keyin fokus summada bölişi kerak`, f);
  }

  /* ⚠ KARETKA OXIRIDA — boshida EMAS. Kassir naqdga 20 000 yozib
     Click ga o'tib qaytsa, keyingi raqam sonning OLDIGA tushmasligi
     kerak. */
  await pg.evaluate(() => {
    const el = document.querySelector("#pay-amount");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "20000"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  await pg.evaluate(() => [...document.querySelectorAll(".pay-type-btn")]
    .find((x) => /Karta/i.test(x.textContent))?.click());
  await new Promise((r) => setTimeout(r, 150));
  await pg.evaluate(() => [...document.querySelectorAll(".pay-type-btn")]
    .find((x) => /Naqd/i.test(x.textContent))?.click());
  await new Promise((r) => setTimeout(r, 300));
  const caret = await pg.evaluate(() => {
    const el = document.querySelector("#pay-amount");
    return { pos: el.selectionStart, len: el.value.length, val: el.value };
  });
  caret.pos === caret.len && caret.len > 0
    ? ok(`karetka oxirida (${caret.val}, ${caret.pos}/${caret.len})`)
    : no("karetka qiymat oxirida turishi kerak", JSON.stringify(caret));
  await pg.close();
}

console.log("\n── 8k. ⚠ MIJOZDAN JAMI (V94) ──");
/* Do'kon egasining talabi: «bu joyda mijozdan jami qancha pul
   olinayotgani ko'rsatilsin». */
{
  const pg = await openKassa({
    items: [{ id: 1, name: "Kurtka", salePrice: 28990, qty: 1, unit: "DONA", stockQuantity: 9 }],
  });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const put = async (name, v) => {
    await pg.evaluate((n) => [...document.querySelectorAll(".pay-type-btn")]
      .find((x) => x.textContent.includes(n))?.click(), name);
    await new Promise((r) => setTimeout(r, 200));
    await pg.evaluate((val) => {
      const el = document.querySelector("#pay-amount");
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      set?.call(el, val); el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
    await new Promise((r) => setTimeout(r, 300));
  };
  const readTaken = () => pg.evaluate(() => {
    const r = document.querySelector(".pay-sum__row--taken");
    return {
      shown: !!r,
      val: r ? Number(r.querySelector("b").textContent.replace(/\D/g, "")) : null,
      rows: [...document.querySelectorAll(".pay-sum__row")]
        .filter((x) => !x.classList.contains("pay-sum__row--taken")
                    && !x.classList.contains("pay-sum__row--change")
                    && !x.classList.contains("pay-sum__row--credit"))
        .map((x) => Number(x.querySelector("b")?.textContent.replace(/\D/g, "") || 0)),
    };
  });

  /* ⚠ BITTA USULDA QATOR YO'Q: jami o'sha qatorning O'ZI bo'lardi va
     uni takrorlash — ortiqcha element (do'kon egasining umumiy
     qoidasi). */
  await put("Naqd", "100000");
  let r = await readTaken();
  r.shown ? no("bitta usulda «jami» körsatilmasin", r.val)
          : ok("bitta usulda ortiqça qator çizilmadi");

  /* Uchta usul — egasining suratidagi holat. */
  await put("Karta", "1000000");
  await put("Click", "1000000");
  r = await readTaken();
  const sum = r.rows.reduce((a, b) => a + b, 0);
  r.shown ? ok(`uçta usulda «Mijozdan jami» çiqdi: ${r.val}`)
          : no("uçta usulda «jami» körsatilişi kerak", "yöq");
  /* ⚠⚠ JAMI KO'RINGAN QATORLARGA TENG BO'LISHI SHART. Agar u boshqa
     hisobdan olinsa, ekranda ikkita bir-biriga zid raqam turardi va
     kassir qaysi biriga ishonishni bilmasdi. */
  r.val === sum
    ? ok(`jami köringan qatorlar yiğindisiga teng (${sum})`)
    : no("jami qatorlar yiğindisiga teng bölişi kerak", `${r.val} ≠ ${sum}`);
  sum === 2100000
    ? ok("2 100 000 — naqd 100 000 + karta 1 000 000 + Click 1 000 000")
    : no("kutilgan yiğindi 2 100 000", sum);
  await pg.close();
}

console.log("\n── 8l. ⚠ MAYDONDAGI «×» (V94) ──");
{
  const pg = await openKassa({ items: ONE });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 700));

  const xOf = () => pg.evaluate(() =>
    !!document.querySelector("#pay-amount")?.closest(".field")?.querySelector(".field-clear"));

  /* ⚠ BO'SH MAYDONDA TUGMA YO'Q: bosiladigan, lekin hech nima
     qilmaydigan tugma ishonchni yo'qotadi (`ui/index.jsx` qoidasi). */
  (await xOf()) ? no("böş maydonda «×» çizilmasin", "bor") : ok("böş maydonda «×» yöq");

  await pg.evaluate(() => {
    const el = document.querySelector("#pay-amount");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    set?.call(el, "45000"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  (await xOf()) ? ok("qiymat yozilgaç «×» çiqdi") : no("«×» çiqişi kerak", "yöq");

  /* ⚠ Uzun son «×» tagiga kirib ketmasin. */
  const pad = await pg.evaluate(() => {
    const el = document.querySelector("#pay-amount");
    return { cls: el.className.includes("has-clear"),
             pr: parseInt(getComputedStyle(el).paddingRight, 10) };
  });
  pad.cls && pad.pr >= 30
    ? ok(`öng böşliq oçildi (padding-right ${pad.pr}px)`)
    : no("`has-clear` öng böşliq berişi kerak", JSON.stringify(pad));

  /* ⚠⚠ TUGMA KO'RINADIGAN JOYDA VA BOSILADIGAN O'LCHAMDA BO'LSIN.
     DOM da borligi YETMAYDI: 0×0 o'lchamli yoki maydondan tashqarida
     qolgan tugmani kassir hech qachon bosa olmaydi, sinov esa
     «bor» deb o'tkazib yuborardi.

     ⚠ Ikonkaning O'ZI tekshirilmaydi — brauzer tekshiruvida Font
     Awesome yuklanmaydi (barcha ikonkalar bo'sh chiqadi). Shrifting
     yo'qligi bu yerda o'lchanadigan narsa emas. */
  const geo = await pg.evaluate(() => {
    const inp = document.querySelector("#pay-amount");
    const x = inp.closest(".field").querySelector(".field-clear");
    const a = inp.getBoundingClientRect(), b = x.getBoundingClientRect();
    return {
      w: Math.round(b.width), h: Math.round(b.height),
      inside: b.right <= a.right + 1 && b.left >= a.left && b.top >= a.top - 1 && b.bottom <= a.bottom + 1,
      vis: getComputedStyle(x).visibility !== "hidden" && getComputedStyle(x).opacity !== "0",
    };
  });
  geo.w >= 18 && geo.h >= 18 && geo.inside && geo.vis
    ? ok(`«×» maydon içida va bosiladigan ölçamda (${geo.w}×${geo.h})`)
    : no("«×» maydon içida, körinadigan va ≥18px bölişi kerak", JSON.stringify(geo));

  await pg.evaluate(() => document.querySelector("#pay-amount")
    .closest(".field").querySelector(".field-clear").click());
  await new Promise((r) => setTimeout(r, 350));
  const after = await pg.evaluate(() => ({
    val: document.querySelector("#pay-amount").value,
    rows: document.querySelectorAll(".pay-sum__row").length,
    x: !!document.querySelector("#pay-amount")?.closest(".field")?.querySelector(".field-clear"),
  }));
  after.val === "" ? ok("«×» maydonni tozaladi") : no("maydon böşaşi kerak", after.val);
  after.x ? no("tozalangaç «×» yöqolişi kerak", "qoldi") : ok("tozalangaç «×» yöqoldi");
  await pg.close();
}

console.log("\n── 9. Scrol bölmasin — har ekranda ──");

const MANY = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, name: "Kiyim nomi uzunroq " + (i + 1),
  salePrice: 45000 + i * 1000, qty: (i % 3) + 1, unit: "DONA", stockQuantity: 99,
}));
/* Haqiqiy monobloklar va noutbuklar. 1024×768 — eng past kafolat. */
const SCREENS = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 768], [980, 700]];

for (const [w, h] of SCREENS) {
  const pg = await openKassa({ w, h, items: MANY });
  await pg.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /Sotiş|Tölov|Tolov/i.test(b.textContent))?.click());
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
  worst.y <= 1 ? ok(`${w}×${h} — scrol yöq`)
               : no(`${w}×${h} — scrol paydo böldi`, `${worst.sel} +${worst.y}px`);
  await pg.close();
}

await browser.close(); server.close();

if (pageErrors.length) {
  bad += pageErrors.length;
  console.log("\n  ❌ Sahifada JS xatolari tuşdi:");
  for (const e of [...new Set(pageErrors)].slice(0, 6)) console.log("       " + e);
} else {
  console.log("\n  ✅ Sahifada birorta JS xatosi tuşmadi");
}
console.log(bad ? `\n  ${bad} ta xato — tölov oynasi buzilgan.\n` : "\n  ✅ Tölov oynasi: hammasi ötdi\n");
process.exit(bad ? 1 : 0);
