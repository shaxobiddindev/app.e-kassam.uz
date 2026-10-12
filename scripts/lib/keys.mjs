/* ══════════════════════════════════════════════════════════════════════════
   KLAVIATURA — VAQT BELGISI BILAN (A1, 2026-10-12)

   ═══ NEGA ═════════════════════════════════════════════════════════════

   Kassa skanerni odamdan TEZLIK bilan ajratadi (`useScanner`: belgilar
   orasida 35 ms dan kam — skaner). Tezlik `KeyboardEvent.timeStamp` dan
   o'lchanadi va haqiqiy klaviaturada bu tugma BOSILGAN payt — kassa
   qanchalik band bo'lmasin, oraliq to'g'ri.

   Puppeteer'ning `keyboard.type(…, { delay })` esa vaqt belgisini
   bermaydi: Chrome uni CDP buyrug'ini QAYTA ISHLAGAN paytda qo'yadi.
   Kompyuter band bo'lsa buyruqlar to'planib qoladi va oraliq o'zgaradi:

     · `check-cart` — «odam tezligida» (80 ms) yozilgan «kefir» to'planib
       kelib skaner deb tanilardi va maydonda «ke» qolardi;
     · `check-sfx`, `check-weigh` — «skaner tezligida» (5 ms) yozilgan
       barkod cho'zilib, odam deb tanilardi va ovoz chalinmasdi.

   Ikkalasi ham yuklama ostida (server sinovlari bilan parallel, CI
   runner) yiqilardi, yolg'iz o'tardi — ya'ni ayb kodda emas, sinovda edi.
   Bu yerda vaqt belgisi ANIQ beriladi (`Input.dispatchKeyEvent.timestamp`)
   va oraliq yuklamaga bog'liq bo'lmaydi. Tekshirilgan: sahifa 300 ms band
   bo'lsa ham `timeStamp` oraliqlari aniq 80 ms, hodisalar `isTrusted`.
   ══════════════════════════════════════════════════════════════════════════ */

const SCANNER_MAX_GAP = 35;   // `useScanner.MAX_GAP` bilan bir xil
const sessions = new WeakMap();
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function cdpOf(page) {
  if (!sessions.has(page)) sessions.set(page, await page.createCDPSession());
  return sessions.get(page);
}

const vk = (ch) => (/^[0-9a-z]$/i.test(ch) ? ch.toUpperCase().charCodeAt(0) : 0);

/**
 * Matnni berilgan oraliqda yozadi — oraliq hodisaning O'Z vaqt belgisida.
 *
 * @param gapMs  35 dan kam — skaner (belgilar real vaqtdan ham tez
 *               ketishi mumkin, oxirida soat yetib olishi kutiladi);
 *               35 va undan ko'p — odam (real vaqtda ham shuncha kutiladi:
 *               ilovaning kechiktirilgan qidiruvi odamdagidek ishlasin).
 * @param enter  oxirida Enter (skaner shunday tugaydi) — o'sha oraliqda.
 */
export async function typeTimed(page, text, gapMs, { enter = false } = {}) {
  const cdp = await cdpOf(page);
  const scanner = gapMs < SCANNER_MAX_GAP;
  let last = Date.now() / 1000 - gapMs / 1000;
  const keys = [...String(text)].map((ch) => ({ key: ch, text: ch, code: vk(ch) }));
  if (enter) keys.push({ key: "Enter", text: "\r", code: 13 });

  for (const k of keys) {
    /* Skanerda — qat'iy oraliq (real vaqt sekin bo'lsa ham); odamda —
       oraliqdan KAM emas (real vaqt kechiksa — kattaroq, baribir odam). */
    const at = scanner ? last + gapMs / 1000 : Math.max(Date.now() / 1000, last + gapMs / 1000);
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: k.key, text: k.text, unmodifiedText: k.text,
      windowsVirtualKeyCode: k.code, nativeVirtualKeyCode: k.code,
      ...(k.key === "Enter" ? { code: "Enter" } : {}), timestamp: at,
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: k.key, windowsVirtualKeyCode: k.code, nativeVirtualKeyCode: k.code,
      ...(k.key === "Enter" ? { code: "Enter" } : {}), timestamp: at + 0.001,
    });
    last = at;
    if (!scanner) await sleep(gapMs);
  }
  /* Keyingi (oddiy puppeteer) hodisa vaqtda orqaga ketmasin. */
  await sleep(last * 1000 - Date.now() + 5);
}
