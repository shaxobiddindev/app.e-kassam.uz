/* ══════════════════════════════════════════════════════════════════════════
   TO'LOV OYNASI SIG'ADIMI, JAMG'ARMA OYNASI, RAQAM BILAN MIQDOR (V66)

   ═══ NEGA ALOHIDA TEKSHIRUV ════════════════════════════════════════════

   `check-pay.mjs` to'lov HISOBINI va oddiy mijozsiz chekda scrol
   yo'qligini tekshiradi. Do'kon egasining talabi esa qattiqroq:
   «scrol HECH QACHON bo'lmasin, nima bo'lganda ham». Scrol aynan
   OG'IR holatda chiqqan edi: mijozda daraja + jamg'arma + qarz +
   ball, to'lov beshta usulga bo'lingan, chegirma va byudjet yozilgan,
   zarar ogohlantirishi chiqqan. Shu holat bu yerda quriladi va yettita
   ekran o'lchamida (1920 dan 980×700 gacha) o'lchanadi — `useFitHeight`
   qaysi darajaga tushgani va masshtabi ham chiqariladi.

   Yana uchta narsa shu yerda (hammasi bitta so'rovdan chiqqan):
     · savat ostidagi ikki tugma — jamg'arma CHAPDA, hira emas;
     · jamg'arma oynasi mijozsiz ochiladi va mijoz OYNANING O'ZIDA
       tanlanadi; klaviatura o'z ustunida;
     · savatda tanlangan qatorga raqam bosib miqdor yozish: 1,2,3 →
       123; 1,5 s dan keyin 3,2 → 32 (eskisi o'rniga); skaner
       tezligidagi raqamlar tegmaydi; qidiruvdan ↑ bosilsa fokus
       savatga o'tadi.

   ⚠ Bu yerda ham CORS sarlavhalari shart — sababi `check-pay.mjs` da.

   Ishga tushirish:
     CHROME_PATH=/usr/bin/google-chrome node scripts/check-fit.mjs
     SHOT_DIR=/tmp/shots — berilsa skrinshotlar o'sha yerga yoziladi.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOT = process.env.SHOT_DIR || null;
const PORT = 4612;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = { creditEnabled: true, creditDueDays: 30, bonusMaxPercent: 100, creditLimit: 0 };
const CUST = { id: 5, fullName: "Рустам Каримов", phone: "+998901234567", savingsBalance: 62020, balance: 296990 };
const CUST2 = { id: 6, fullName: "Zilola", phone: "+998907654321", savingsBalance: 0, balance: 0 };
const TIER = { tierName: "Oltin", discountPercent: 5, toNextTier: 150000, loyaltyWindowDays: 90,
               debtBalance: 296990, overdueDebt: 50000, debtSince: "2026-03-01T00:00:00Z",
               bonusBalance: 7250, bonusExpiringSoon: 3000, savingsBalance: 62020 };
const cors = (r) => ({
  "Access-Control-Allow-Origin": `http://127.0.0.1:${PORT}`,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": r.headers()["access-control-request-headers"] || "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
});
const pageErrors = [];
const posted = [];
const salesPosted = [];
const ITEMS = [
  { id: 1, name: "Qog'oz sochiq 100 SHT", salePrice: 5000, qty: 1, unit: "DONA", stockQuantity: 500 },
  { id: 2, name: "Monarx ketchup", salePrice: 13990, qty: 1, unit: "DONA", stockQuantity: 500 },
];
async function openKassa({ w = 1366, h = 768, customer = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (!r.url().includes("/api/")) return r.continue();
    const C = cors(r);
    if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: C });
    const u = r.url();
    let body = { success: true, data: [] };
    if (u.includes("/shop/profile")) body = { success: true, data: PROFILE };
    else if (/\/sales(\?|$)/.test(u) && r.method() === "POST") {
      /* Sotuv — so'rov tanasi tekshiruv uchun saqlanadi (V66). */
      try { salesPosted.push(JSON.parse(r.postData() || "{}")); } catch { salesPosted.push({}); }
      body = { success: true, data: { id: 501, paymentType: "CASH", totalAmount: 18990,
               receiptUrl: "https://app.e-kassam.uz/c/501-0123456789abcdef" } };
    }
    else if (/\/customers(\?|$)/.test(u) && r.method() === "GET") body = { success: true, data: [CUST, CUST2] };
    else if (u.includes("/loyalty/customers/5")) body = { success: true, data: TIER };
    else if (u.includes("/loyalty/customers/6")) body = { success: true, data: { ...TIER, tierName: null, debtBalance: 0, bonusBalance: 0, savingsBalance: 0 } };
    else if (u.includes("/savings/top-up")) {
      posted.push(u);
      /* Javobda KVITANSIYA ham (V66) — kassa uni ekranda ko'rsatadi. */
      body = { success: true, data: { balance: 72020, receipt: {
        id: 77, receiptNo: "J-77", date: new Date().toISOString(), kind: "SAVINGS_TOP_UP",
        shopName: "Sinov do'koni", cashierName: "V", customerName: CUST.fullName,
        amount: 10000, method: "CASH", balanceBefore: 62020, balanceAfter: 72020,
        qrUrl: "https://app.e-kassam.uz/j/77-0123456789abcdef" } } };
    }
    return r.respond({ status: 200, contentType: "application/json", headers: C, body: JSON.stringify(body) });
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.evaluateOnNewDocument((cust, items) => {
    for (const [k, v] of Object.entries({
      ek_token: "v", ek_type: "user", ek_role: "OWNER", ek_username: "v",
      ek_fullName: "V", ek_shopCode: "v", ek_deviceId: "v", ek_lang: "uz", ek_theme: "light",
    })) localStorage.setItem(k, v);
    localStorage.setItem("ek_cart_v_v", JSON.stringify({
      savedAt: Date.now(), v: 3, activeId: 1,
      carts: [{ id: 1, discount: "", bonusUse: "", customer: cust, items }],
    }));
  }, customer, ITEMS);
  await page.goto(`http://127.0.0.1:${PORT}/sale`, { waitUntil: "networkidle2", timeout: 30_000 });
  await sleep(1200);
  return page;
}
let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const yes = (c, m, got) => (c ? ok(m) : no(m, got));

/* ══ A. TO'LOV OYNASI — og'ir mijoz, 5 usul, chegirma ══ */
console.log("── A. To'lov oynasi — scrol yo'q (og'ir mijoz) ──");
let page = await openKassa({ customer: CUST });
const openPay = async () => {
  await page.keyboard.press("F9"); await sleep(700);
};
await openPay();
const st = () => page.evaluate(() => {
  const body = document.querySelector(".pay-modal-body");
  const box = document.querySelector(".pay-modal-box");
  return {
    open: !!document.querySelector("#pay-amount"),
    over: body ? body.scrollHeight - body.clientHeight : -1,
    fit: box?.dataset.fit, zoom: document.querySelector(".pay-grid")?.style.zoom || "",
    btns: [...document.querySelectorAll(".pay-type-btn")].map((b) => b.textContent.trim()),
    facts: [...document.querySelectorAll(".cust-fact")].map((f) => f.textContent.trim().replace(/\s+/g, " ")),
    savBtn: !!document.querySelector(".cust-fact--btn"),
    savActive: !!document.querySelector(".cust-fact--btn.active"),
    label: document.querySelector('label[for="pay-amount"]')?.textContent.trim(),
    rows: [...document.querySelectorAll(".pay-sum__row")].map((r) => r.textContent.trim().replace(/\s+/g, " ")),
    two: !!document.querySelector(".pay-two"),
    boxH: box?.getBoundingClientRect().height, vh: innerHeight,
  };
});
let s = await st();
yes(s.open, "to'lov oynasi ochildi (F9)");
yes(s.btns.length === 4, "to'lov turlari to'ri — 4 ta (jamg'arma to'rda emas)", s.btns.length);
yes(s.savBtn, "mijoz kartasida jamg'arma KATAGI (tugma) bor");
yes(s.facts.length === 4, "mijoz kartasi 4 katak: daraja, jamg'arma, qarz, ball", s.facts.length + " — " + s.facts.join(" | "));
yes(s.two, "chegirma va byudjet yonma-yon (.pay-two)");
yes(s.over <= 1, `1366×768 (oddiy): scrol yo'q (ortiq ${s.over}px, daraja ${s.fit}, zoom ${s.zoom || "1"})`, s.over);

// summalarni yozish
const type = async (sel, v) => {
  await page.focus(sel);
  for (let i = 0; i < 30; i++) {
    if (await page.$eval(sel, (el) => el.value === "")) break;
    await page.keyboard.press("End"); await page.keyboard.press("Backspace");
  }
  if (v !== "") await page.type(sel, v, { delay: 10 });
  await sleep(200);
};
const pick = async (name) => {
  const i = await page.evaluate((n) => [...document.querySelectorAll(".pay-type-btn")].findIndex((b) => b.textContent.includes(n)), name);
  await page.evaluate((k) => document.querySelectorAll(".pay-type-btn")[k].click(), i); await sleep(200);
};
await type("#pay-amount", "5000");
await pick("Karta"); await type("#pay-amount", "3000");
await pick("Click"); await type("#pay-amount", "2000");
await pick("Payme"); await type("#pay-amount", "1000");
await page.click(".cust-fact--btn"); await sleep(200);
s = await st();
yes(s.savActive, "jamg'arma katagi bosilganda FAOL bo'ldi");
yes(/jamg/i.test(s.label || ""), "summa maydoni jamg'armaga o'tdi: " + s.label, s.label);
await type("#pay-amount", "1500");
await type(".pay-two input", "990");
await type("#disc-budget", "2000");
await page.focus("#pay-amount");
s = await st();
yes(s.rows.length >= 5, `hisobda 5 usul + qoldiq: ${s.rows.length} qator`, s.rows.join(" | "));
yes(s.rows.some((r) => /Jamg/i.test(r)), "hisobda jamg'arma qatori bor", s.rows.join(" | "));
for (const [w, h] of [[1366, 768], [1280, 720], [1024, 720], [1024, 768], [1600, 900], [1920, 1080], [980, 700]]) {
  await page.setViewport({ width: w, height: h }); await sleep(450);
  const x = await st();
  yes(x.over <= 1, `${w}×${h}: scrol yo'q (ortiq ${x.over}px, daraja ${x.fit}, zoom ${x.zoom || "1"}, oyna ${Math.round(x.boxH)}/${x.vh})`, x.over + "px");
  if (w === 1366 || w === 980 || w === 1024 && h === 720) SHOT && await page.screenshot({ path: `${SHOT}/v66-pay-${w}x${h}.png` });
}
await page.setViewport({ width: 1366, height: 768 }); await sleep(400);
s = await st();
yes(s.over <= 1, `qaytadan 1366×768: daraja ${s.fit}, zoom ${s.zoom || "1"}`);
await page.click(".pay-modal-close"); await sleep(400);

/* ══ B. Savat ostidagi tugmalar ══ */
console.log("\n── B. Savat ostidagi ikki tugma ──");
const row = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".checkout-row .btn")];
  return btns.map((b) => ({ t: b.textContent.trim(), dis: b.disabled, r: b.getBoundingClientRect().toJSON(),
                            bg: getComputedStyle(b).backgroundColor, op: getComputedStyle(b).opacity }));
});
yes(row.length === 2, "ikkita tugma", row.length);
yes(/Jamg/i.test(row[0]?.t), "chapdagisi — jamg'arma: " + row[0]?.t, row[0]?.t);
yes(/To'lov/i.test(row[1]?.t), "o'ngdagisi — to'lov: " + row[1]?.t, row[1]?.t);
yes(Math.abs(row[0].r.top - row[1].r.top) < 2 && row[0].r.right <= row[1].r.left, "yonma-yon, bir qatorda");
yes(!row[0].dis && row[0].op === "1", "jamg'arma tugmasi hira emas, bosiladi", `dis=${row[0].dis} op=${row[0].op}`);
yes(row[0].bg !== row[1].bg, "rangi to'lov tugmasidan farq qiladi", row[0].bg + " vs " + row[1].bg);
yes(/Alt\+J/.test(row[0].t), "yorlig'i ko'rinadi (Alt+J)", row[0].t);
SHOT && await page.screenshot({ path: `${SHOT}/v66-checkout.png`, clip: { x: 1366 - 380, y: 768 - 260, width: 380, height: 260 } });

/* ══ C. Jamg'arma oynasi — mijoz oynada tanlanadi ══ */
console.log("\n── C. Jamg'arma oynasi (mijozsiz savat) ──");
await page.close();
page = await openKassa({ customer: null });
await page.keyboard.down("Alt"); await page.keyboard.press("j"); await page.keyboard.up("Alt"); await sleep(500);
const tu = () => page.evaluate(() => {
  const box = document.querySelector(".pay-modal-box--lite");
  const main = document.querySelector(".pay-lite__main")?.getBoundingClientRect();
  const keys = document.querySelector(".pay-lite__keys")?.getBoundingClientRect();
  const body = document.querySelector(".pay-modal-box--lite .pay-modal-body");
  return {
    open: !!box, w: box?.getBoundingClientRect().width,
    need: !!document.querySelector(".cart-cust--bare.is-needed"),
    hint: document.querySelector(".cart-cust__need")?.textContent.trim(),
    total: document.querySelector(".pay-modal-box--lite .pay-modal-total-value")?.textContent.trim(),
    submitDis: document.querySelector(".pay-modal-box--lite .pay-modal-footer .btn-primary")?.disabled,
    sideBySide: main && keys ? keys.left >= main.right - 1 && Math.abs(keys.top - main.top) < 40 : null,
    over: body ? body.scrollHeight - body.clientHeight : -1,
    input: document.querySelector(".pay-modal-box--lite .qty-modal__input")?.value,
    title: document.querySelector(".pay-modal-box--lite .pay-modal-title")?.textContent.trim(),
  };
});
let u = await tu();
yes(u.open, "Alt+J — jamg'arma oynasi mijozsiz ham ochildi");
yes(u.need, "mijoz tanlagichi «kerak» deb ishora qilyapti");
yes(!!u.hint, "tanlagich tagida yozuv: " + u.hint, "yo'q");
yes(u.submitDis === true, "mijozsiz «qo'shish» tugmasi yopiq");
yes(u.sideBySide, "klaviatura o'ng ustunda, asosiy qism chapda", JSON.stringify(u.sideBySide));
yes(u.w <= 842, `oyna kengligi ixcham: ${Math.round(u.w)}px`, u.w);
yes(u.over <= 1, "jamg'arma oynasida scrol yo'q", u.over);
await page.click(".pay-modal-box--lite .ek-select__btn"); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".ek-select__opt")].find((o) => /Рустам/.test(o.textContent))?.click());
await sleep(500);
u = await tu();
yes(!u.need, "mijoz tanlangach ishora yo'qoldi");
yes(/Рустам/.test(u.title), "sarlavhada mijoz nomi: " + u.title, u.title);
yes((u.total || "").replace(/\D/g, "") === "62020", "qoldiq serverdan: " + u.total, u.total);
for (const k of ["1", "0", "0", "0", "0"]) {
  await page.evaluate((kk) => [...document.querySelectorAll(".pay-lite__keys .qty-modal__key")].find((b) => b.textContent.trim() === kk)?.click(), k);
}
await sleep(200);
u = await tu();
yes((u.input || "").replace(/\D/g, "") === "10000", "klaviaturadan 10 000 yozildi: " + u.input, u.input);
yes(u.submitDis === false, "endi «qo'shish» ochiq");
SHOT && await page.screenshot({ path: `${SHOT}/v66-topup.png` });
await page.click(".pay-modal-box--lite .pay-modal-footer .btn-primary"); await sleep(700);
u = await tu();
yes(!u.open, "yuborilgach oyna yopildi");
{
  /* KVITANSIYA (V66) — ekranda, J- raqami va jamg'arma sarlavhasi bilan. */
  const tape = await page.evaluate(() => document.querySelector(".pt-tape")?.textContent || "");
  yes(/J-77/.test(tape) && /JAMG'ARMA KVITANSIYASI/.test(tape) && /72\s?020/.test(tape),
      "to'ldirishdan keyin kvitansiya ekranda (J-77, jamg'armada 72 020)", tape.slice(0, 120));
  await page.click(".pt-close"); await sleep(300);
}
yes(posted.some((p) => p.includes("/customers/5/savings/top-up")), "so'rov mijoz 5 ning jamg'armasiga ketdi", posted.join(","));
const cartCust = await page.evaluate(() => JSON.parse(localStorage.getItem("ek_cart_v_v")).carts[0].customer?.id);
yes(cartCust === 5, "mijozsiz savatga shu mijoz biriktirildi", cartCust);

/* ══ E. Qaytim → mijoz jamg'armasiga (V66) ══ */
console.log("\n── E. Qaytim jamg'armaga ──");
await page.close();
page = await openKassa({ customer: CUST });
await openPay();
await type("#pay-amount", "100000");
let cs = await page.evaluate(() => ({
  toggle: !!document.querySelector(".pay-change-sav"),
  change: document.querySelector(".pay-sum__row--change")?.textContent.replace(/\s+/g, " ").trim(),
  sums: [...document.querySelectorAll(".pay-type-btn__sum")].length,
}));
yes(cs.toggle, "qaytim bor va mijoz tanlangan — «qaytim jamg'armaga» tugmasi ko'rinadi");
yes(/81\s?010/.test(cs.change || ""), "qaytim 81 010: " + cs.change, cs.change);
yes(cs.sums === 0, "usul tugmalarida summa yo'q");
await page.click(".pay-change-sav"); await sleep(200);
cs = await page.evaluate(() => ({
  on: document.querySelector(".pay-change-sav")?.getAttribute("aria-pressed"),
  row: document.querySelector(".pay-sum__row--save")?.textContent.replace(/\s+/g, " ").trim(),
}));
yes(cs.on === "true" && /81\s?010/.test(cs.row || ""), "belgilangach qator «Jamg'armaga +81 010»: " + cs.row, JSON.stringify(cs));
SHOT && await page.screenshot({ path: `${SHOT}/v66-change.png` });
await page.keyboard.press("F9"); await sleep(1500);
const sb = salesPosted[0];
yes(!!sb, "sotuv serverga ketdi");
yes(sb?.changeToSavings === 81010 && sb?.cashGiven === 100000,
    "so'rovda changeToSavings=81 010, cashGiven=100 000", JSON.stringify({ c: sb?.changeToSavings, g: sb?.cashGiven }));
yes(Array.isArray(sb?.payments) && sb.payments.length === 1 && sb.payments[0].type === "CASH"
    && Number(sb.payments[0].amount) === 18990, "naqd qismi 18 990 (qaytimsiz)", JSON.stringify(sb?.payments));
{
  const note = await page.evaluate(() => document.querySelector(".ek-finish__note")?.textContent || "");
  yes(/81\s?010/.test(note), "yakun oynasida: " + note, note || "yo'q");
}
await sleep(3300);
yes(!(await page.$(".ek-finish")), "yakun oynasi 3 soniyada o'zi yopildi");

/* ══ D. Raqam bilan miqdor ══ */
console.log("\n── D. Savatda raqam bilan miqdor ──");
await page.close();
page = await openKassa({ customer: null });
const qty = (n = 0) => page.evaluate((i) => {
  const el = document.querySelectorAll(".cart-item")[i]?.querySelector(".qty-num");
  return { text: el?.textContent.trim(), typing: el?.classList.contains("is-typing"), win: !!el?.querySelector(".qty-num__win") };
}, n);
const press = async (keys, gap) => { for (const k of keys) { await page.keyboard.press(k); await sleep(gap); } };
await page.click(".cart-item .cart-item-name"); await sleep(150);
await press(["1", "2", "3"], 160);
await sleep(120);
let q = await qty(0);
yes(q.text === "123", "1,2,3 ketma-ket → 123", q.text);
yes(q.typing && q.win, "yozish holati ko'rinadi (fokus + chiziq)", JSON.stringify(q));
SHOT && await page.screenshot({ path: `${SHOT}/v66-typing.png`, clip: { x: 1366 - 380, y: 60, width: 380, height: 200 } });
await sleep(1700);
q = await qty(0);
yes(!q.typing, "1,5 s dan keyin ko'rsatkich o'chdi", JSON.stringify(q));
yes(q.text === "123", "miqdor 123 qoldi", q.text);
await press(["3", "2"], 160); await sleep(120);
q = await qty(0);
yes(q.text === "32", "oyna tugagach 3,2 → 32 (eskisi o'rniga)", q.text);
await press(["4"], 0); await sleep(120);
q = await qty(0);
yes(q.text === "324", "oyna ichida 4 → 324 (davom)", q.text);
await press(["Backspace"], 0); await sleep(120);
q = await qty(0);
yes(q.text === "32", "Backspace → 32", q.text);
await sleep(1700);
// skaner tezligida raqamlar — tegmasin
await press(["9", "8", "7", "6", "5"], 4); await page.keyboard.press("Enter"); await sleep(300);
q = await qty(0);
yes(q.text === "32", "skaner tezligidagi 98765 miqdorga TEGMADI", q.text);
// ikkinchi qator — yangidan
await sleep(200);
await page.keyboard.press("ArrowDown"); await sleep(100);
await press(["7"], 0); await sleep(120);
const q2 = await qty(1);
yes(q2.text === "7", "↓ bilan ikkinchi qator, 7 → 7", q2.text);
// qidiruvdan ↓ — fokus savatga, raqam miqdorga
await sleep(1700);
await page.focus("input[data-scanner]");
await page.keyboard.press("ArrowUp"); await sleep(100);
const focused = await page.evaluate(() => document.activeElement?.tagName);
yes(focused !== "INPUT", "qidiruvdan ↑ bosilganda fokus savatga o'tdi", focused);
await press(["8"], 0); await sleep(120);
q = await qty(0);
const searchVal = await page.$eval("input[data-scanner]", (el) => el.value);
yes(q.text === "8" && searchVal === "", "raqam qidiruvga emas, miqdorga yozildi", `qty=${q.text} search=«${searchVal}»`);
// +/-: yozishni yakunlaydi
await page.keyboard.press("+"); await sleep(120);
q = await qty(0);
yes(q.text === "9" && !q.typing, "«+» → 9, yozish holati tugadi", JSON.stringify(q));

if (pageErrors.length) { bad += pageErrors.length; console.log("\n  ❌ JS xatolari:"); for (const e of [...new Set(pageErrors)]) console.log("     " + e); }
else console.log("\n  ✅ Sahifada JS xatosi tushmadi");
console.log(`\n  ${bad ? "❌ " + bad + " ta yiqildi" : "✅ HAMMASI O'TDI"}`);
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
