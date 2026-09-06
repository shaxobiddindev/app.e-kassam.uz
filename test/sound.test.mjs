/* ══════════════════════════════════════════════════════════════════════════
   OVOZLI BILDIRISHNOMA — QAROR QATLAMI (V89)

   ⚠ NEGA AYNAN SHU QATLAM SINALADI. Headless Chromium'da OVOZ QURILMASI
   YO'Q: ijroni «eshitib» tekshirib bo'lmaydi. Shuning uchun arxitektura
   ataylab ikkiga bo'lingan — `decide()` sof funksiya (nima chalinishi
   KERAKLIGINI hal qiladi) va adapter (chaladi). Sinov birinchisini
   to'liq qamrab oladi; ikkinchisi esa brauzer tekshiruvida faqat
   «yiqilmadimi» darajasida ko'riladi.

   Eng muhim uchta xulq shu yerda qulflanadi:

     1. SOTUVNI BUZMASLIK — `sfx()` hech qanday holatda istisno
        tashlamaydi (V58 pretsedenti: sotuvdan keyingi bitta xato
        kassani butunlay to'xtatgan).
     2. SHOVQIN CHEGARASI — bir xil voqea oynasi va prioritet.
        Usiz o'nta tovar skanerlanganda o'nta chiyillash bo'lardi va
        kassir ovozni birinchi kuni butunlay o'chirardi.
     3. STANDART JIMLIK — faqat beshta voqea yoqiq. Boshqasi
        yoqilib ketsa, funksiya foydali bo'lishdan to'xtaydi.

   Ishga tushirish:  node test/sound.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ `ek-sound.js` `localStorage` ga tayanadi (`ek-hw-settings`), Node'da
   esa u yo'q. Modulni yuklashdan OLDIN eng sodda qo'g'irchoq qo'yamiz —
   `getSettings` faqat `getItem` ni chaqiradi. */
globalThis.localStorage = {
  _v: {},
  getItem(k) { return this._v[k] ?? null; },
  setItem(k, v) { this._v[k] = String(v); },
};
globalThis.window = { dispatchEvent() {}, CustomEvent: class {} };
globalThis.CustomEvent = class {};

const S = await import("../src/lib/ek-sound.js");

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m + `\n     olindi: ${got}`); };
const eq  = (a, b, m) => (a === b ? ok(m) : bad(m, JSON.stringify(a)));
const cfg = (over = {}) => S.config({ on: true, volume: 0.7, events: {}, ...over });

console.log("── Lug'at ──");
eq(Object.keys(S.SFX).length, 9, "to'qqizta voqea");
{
  /* ⚠ BESHTA OHANG OILASI, YIGIRMATA EMAS: kassir beshtasini bir
     kunda o'rganadi, yigirmatasini hech qachon. */
  const fams = new Set(Object.values(S.SFX).map((d) => d.t));
  eq(fams.size, 5, `beshta ohang oilasi: ${[...fams].sort().join(", ")}`);
}
{
  const on = Object.keys(S.SFX).filter((k) => S.SFX[k].on);
  eq(on.length, 5, `standart bo'yicha YOQIQ: ${on.join(", ")}`);
  on.includes("ERROR") && on.includes("SALE_DONE") && on.includes("SCAN_MISS")
    ? ok("eng muhim uchtasi yoqiq")
    : bad("xato, chek va skaner yoqiq bo'lishi kerak", on.join(","));
  /* ⚠ HAR HARAKATDA OVOZ CHIQARADIGAN KASSA BIRINCHI KUNI O'CHIRILADI
     va shundan keyin MUHIM ovozlar ham yo'qoladi. */
  S.SFX.CART_ADD.on === false && S.SFX.OK.on === false
    ? ok("kunlik takrorlanuvchi voqealar JIM")
    : bad("savatga qo'shish va «bajarildi» jim bo'lishi kerak", "yoqiq");
}

console.log("\n── decide(): asosiy yo'l ──");
{
  const spec = S.decide("ERROR", cfg(), { now: 1000 });
  spec ? ok("xato ovozi chiqadi") : bad("chiqishi kerak", "null");
  eq(spec.pri, 3, "xato — eng yuqori prioritet");
  Array.isArray(spec.tone) && spec.tone.length > 0 ? ok("ohang notalari bor") : bad("nota kerak", "yo'q");
  Math.abs(spec.gain - 0.55 * 0.7) < 1e-9 ? ok(`balandlik ko'paytirildi: ${spec.gain.toFixed(3)}`)
                                          : bad("gain = base × volume", spec.gain);
}
eq(S.decide("YO'Q_BUNDAY", cfg(), { now: 0 }), null, "noma'lum voqea — jimgina null (xato emas)");
eq(S.decide("ERROR", cfg({ on: false }), { now: 0 }), null, "umumiy kalit o'chiq — hech narsa chiqmaydi");
eq(S.decide("ERROR", cfg({ volume: 0 }), { now: 0 }), null, "balandlik nol — ijro qilinmaydi");

console.log("\n── Standart va foydalanuvchi tanlovi ──");
eq(S.decide("CART_ADD", cfg(), { now: 0 }), null, "standart bo'yicha jim voqea chiqmaydi");
{
  const c = cfg({ events: { CART_ADD: true } });
  S.decide("CART_ADD", c, { now: 0 }) ? ok("foydalanuvchi yoqsa — chiqadi") : bad("chiqishi kerak", "null");
}
eq(S.decide("ERROR", cfg({ events: { ERROR: false } }), { now: 0 }), null,
   "foydalanuvchi o'chirsa — standart yoqiq bo'lsa ham chiqmaydi");
/* ⚠ Yozuv YO'Q = standart. Bu ERD dagi `shop_sound_events` qoidasi
   bilan bir xil: har voqeaga qator yozib chiqilmaydi. */
eq(S.muted("ERROR", cfg({ events: {} })), false, "yozuvsiz voqea standartdan o'qiydi");

console.log("\n── ⚠ HAR AMAL — O'Z OVOZI (V90) ──");
{
  /* ⚠ BU QOIDA TESKARISIGA O'ZGARDI. Dastlab har voqeaning 400–600 ms
     «oynasi» bor edi va shu vaqt ichida takrori jim qolardi. Do'kon
     egasi buni xato deb topdi: kassir tugmani ketma-ket bossa,
     ikkinchi bosishda ovoz chiqmasdi — ya'ni «tugma ishlamadi» degan
     taassurot. Brauzer o'lchovi ham shuni ko'rsatdi: 250 ms oraliqda
     beshta amaldan uchtasi eshitilgan.

     Endi qoida: HAR AMAL O'Z OVOZINI OLADI. */
  const c = cfg();
  const human = [120, 200, 350, 600];       // odam ketma-ket bosadigan oraliqlar
  let all = true;
  for (const gap of human) {
    if (!S.decide("SCAN_MISS", c, { now: 10_000, lastAt: 10_000 - gap })) all = false;
  }
  all ? ok(`odam tezligidagi takror bosishlar (${human.join(", ")} ms) — hammasi eshitiladi`)
      : bad("har bosish eshitilishi kerak", "yutildi");

  /* Ketma-ket ikkita chek — ikkalasi ham. */
  S.decide("SALE_DONE", c, { now: 10_000, lastAt: 9_800 })
    ? ok("ketma-ket ikki chek — ikkalasi ham eshitiladi") : bad("chiqishi kerak", "null");
  S.decide("ERROR", c, { now: 10_000, lastAt: 9_900 })
    ? ok("ketma-ket ikki xato — ikkalasi ham eshitiladi") : bad("chiqishi kerak", "null");

  /* ⚠ Yagona to'siq — BITTA amal ikkita ovoz chiqarmasligi uchun.
     Odam 60 ms dan tez ikki marta bosolmaydi, ya'ni bu chegara
     foydalanuvchining hech bir harakatini yutmaydi. */
  eq(S.decide("ERROR", c, { now: 10_000, lastAt: 9_980 }), null,
     "20 ms — bu bosish emas, bitta amalning ikki marta chaqirilishi");
  S.decide("ERROR", c, { now: 10_000, lastAt: 9_930 })
    ? ok("70 ms — allaqachon eshitiladi") : bad("chiqishi kerak", "null");
}

console.log("\n── Shovqin chegarasi: prioritet ──");
{
  const c = cfg({ events: { CART_ADD: true, OK: true } });
  /* ⚠ «Xato» hech qachon «qo'shildi» ostida qolib ketmasligi kerak. */
  S.decide("ERROR", c, { now: 0, activePri: 1 })
    ? ok("muhimroq ovoz pastini KESADI") : bad("kesishi kerak", "null");
  eq(S.decide("CART_ADD", c, { now: 0, activePri: 3 }), null,
     "muhim ovoz chalinayotganda pasti TASHLANADI");
  S.decide("CART_ADD", c, { now: 0, activePri: 1 })
    ? ok("teng prioritet — yangisi o'tadi") : bad("o'tishi kerak", "null");
}

console.log("\n── fromToast(): 138 ta chaqiruv shu orqali ──");
eq(S.fromToast("error"), "ERROR", "xato");
eq(S.fromToast("warning"), "WARN", "ogohlantirish");
eq(S.fromToast("success"), "OK", "muvaffaqiyat");
eq(S.fromToast("info"), "INFO", "ma'lumot");
eq(S.fromToast(undefined), "INFO", "noma'lum tur — eng zararsizi");
/* Muvaffaqiyat va ma'lumot standart bo'yicha JIM: ilovada 32 ta
   `success` va 14 ta `info` bor va ularning hammasi ovoz chiqarsa
   kassa jiringlab turardi. */
eq(S.decide(S.fromToast("success"), cfg(), { now: 0 }), null, "success — standart bo'yicha jim");
S.decide(S.fromToast("error"), cfg(), { now: 0 }) ? ok("error — standart bo'yicha eshitiladi")
                                                  : bad("eshitilishi kerak", "null");

console.log("\n── config(): buzuq saqlangan holat ──");
{
  const c1 = S.config({ volume: 99 });
  eq(c1.volume, 1, "chegaradan katta balandlik KESILADI");
  eq(S.config({ volume: -5 }).volume, 0, "manfiy balandlik nolga");
  eq(S.config({ volume: "salom" }).volume, 0.7, "son bo'lmagan qiymat — standart");
  eq(S.config({ events: "buzuq" }).events instanceof Object, true, "buzuq `events` yiqitmaydi");
  eq(S.config({}).on, true, "kalit yo'q — yoqiq deb hisoblanadi");
  eq(S.config(null).on, true, "butunlay bo'sh sozlama ham ishlaydi");
}

console.log("\n── ⚠ SOTUVNI BUZMASLIK ──");
{
  /* Eng muhim kafolat. `sfx()` istisno tashlasa yoki `Promise`
     qaytarsa, uni chaqirgan sotuv yo'li to'xtab qolishi mumkin edi. */
  let threw = null;
  try { S.sfx("ERROR"); } catch (e) { threw = e; }
  eq(threw, null, "`sfx()` istisno tashlamaydi");
  eq(S.sfx("YO'Q_BUNDAY"), undefined, "noma'lum voqeada ham jim qaytadi");
  eq(S.sfx(null), undefined, "null voqea ham yiqitmaydi");
  eq(S.sfx("ERROR"), undefined, "`Promise` emas, `undefined` qaytadi");
  let threw2 = null;
  try { S.prime(); S.preview("ERROR"); S.preview("YO'Q"); } catch (e) { threw2 = e; }
  eq(threw2, null, "`prime` va `preview` ham istisno tashlamaydi");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ovoz: ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail === 0 ? 0 : 1);
