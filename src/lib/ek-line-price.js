/* ══════════════════════════════════════════════════════════════════════════
   QATOR NARXI — sof hisob (V97)

   ⚠ NEGA ALOHIDA FAYL. Bu hisob ilgari `LinePriceModal.jsx` ichida,
   JSX bilan aralash turardi va shu sababdan HECH QACHON sinalmagan
   edi. Natijada uchta xato uzoq vaqt sezilmay yotdi (pastdagi
   izohlarga qarang) — uchalasi ham pulga tegadigan xatolar.

   Endi hisob shu yerda, `ek-discount.js` va `ek-prices.js` kabi:
   modal faqat chizadi.
   ══════════════════════════════════════════════════════════════════════════ */

const n = (v) => Number(v) || 0;

/** Tovarning e'lon narxi (chegirmasiz dona narxi). */
export const lineBase = (item) => n(item?.salePrice);

/** Qatordagi miqdor. */
export const lineQty = (item) => n(item?.qty);

/**
 * ENG PAST NARX — SERVER BERADI (`ProductResponse.minPrice`).
 *
 * ⚠ Front uni O'ZI hisoblamaydi va bu ataylab: hisobda tovar foizi,
 * do'kon foizi, kassirning shaxsiy chegarasi VA optom narx qatnashadi.
 * Formula ikki joyda yozilsa ular ajralib ketardi va kassir «ekranda
 * ruxsat edi, saqlaganda rad etildi» holatiga tushardi.
 *
 * `null` — chegara noma'lum (eski server). Bunda ekranda chegara
 * ko'rsatilmaydi va tekshiruv faqat serverda qoladi.
 *
 * ⚠ YUQORIGA yaxlitlanadi: chegara qoidadan HECH QACHON saxiyroq
 * bo'lmasligi kerak.
 */
export function lineFloor(item) {
  if (item?.minPrice == null) return null;
  const v = Math.ceil(Number(item.minPrice));
  return Number.isFinite(v) ? v : null;
}

/**
 * MODAL OCHILGANDA KO'RINADIGAN NARX.
 *
 * ⚠ XATO #1 — CHEGIRMA QAYTA OCHILGANDA SURILARDI.
 *
 * Chegirma qator bo'yicha JAMI summa. Dona narxi undan
 * `jami / miqdor` bilan chiqadi va bu son butun bo'lmasligi mumkin:
 * aqlli chegirma (`spreadDiscount`) qatorlarga ixtiyoriy butun
 * summalarni tarqatadi, miqdor esa 3 bo'lishi mumkin. Miqdor 3,
 * chegirma 1000 → dona narxi 15000 − 333.33.
 *
 * Ilgari shu son yaxlitlanib maydonga yozilardi va kassir hech
 * narsaga tegmasdan «Saqlash» ni bossa, chegirma 1000 dan 999 ga
 * tushardi. Har ochib-yopishda yana bir marta. Buni hech kim
 * sezmasdi, chunki farq bir necha so'm edi — lekin chek jami
 * qatorlar yig'indisiga teng bo'lmay qolardi.
 *
 * Yechim {@link priceDiscount} da: narxga TEGILMAGAN bo'lsa asl
 * chegirma AYNAN saqlanadi.
 */
export function initialPrice(item) {
  const base = lineBase(item);
  const qty = lineQty(item);
  return Math.round(base - n(item?.discount) / (qty || 1));
}

/**
 * OPTOM NARX TAKLIFI; `null` — taklif qilinmaydi (V97).
 *
 * ⚠ Optom narx — egasi ALLAQACHON «bu narxda sotsa bo'ladi» deb
 * qo'ygan narx, lekin u chegirma yo'lida umuman qatnashmasdi: kassir
 * uni savatda qo'lda terishi kerak edi va foiz chegarasi tor bo'lsa
 * «chegaradan oshdi» degan bajik so'ralardi — egasining o'z qaroriga
 * rahbardan ruxsat so'ralardi.
 *
 * Uch holatda taklif qilinmaydi:
 *   • optom narx yo'q yoki nol;
 *   • u e'lon narxidan past emas (tushirish ma'nosiz);
 *   • u serverning chegarasidan past (server rad etadi — taklif
 *     qilib mijoz oldida uyaltirmaymiz).
 *
 * ⚠ Uchinchisi ESKI SERVER bilan ham to'g'ri ishlaydi: u optom
 * narxni bilmasa `minPrice` balandroq keladi va tugma o'zi
 * ko'rinmaydi.
 */
export function wholesaleOffer(item) {
  /* ⚠ CHEGIRMA BERILMAYDIGAN TOVAR — optom narx ham qo'yilmaydi.
     Server ham rad etadi (`lineRoom` nol qaytaradi), lekin bu qoida
     shu yerda ham turishi kerak: savatga optom narx qo'yish yo'li
     oynani ochmaydi va oynadagi `disabled` ni ko'rmaydi. */
  if (item?.discountAllowed === false) return null;

  const base = lineBase(item);
  const w = Math.round(n(item?.wholesalePrice));
  if (!(w > 0) || w >= base) return null;

  const floor = lineFloor(item);
  if (floor != null && w < floor) return null;
  return w;
}

/**
 * YAXLIT NARX TUGMALARI — eng pastdan e'lon narxigacha.
 *
 * ⚠ XATO #2 — TOR ORALIQDA TUGMALAR YO'QOLARDI.
 *
 * Qadam E'LON NARXIDAN olinardi (22000 → 1000), oraliq esa
 * bundan ancha tor bo'lishi mumkin (22000…21500). Birinchi nomzod
 * 22000 «narxdan past emas» deb rad etilardi, ikkinchisi 21000 esa
 * chegaradan pastga tushardi — va ro'yxat BO'SH qolardi. Ya'ni
 * tugmalar aynan kerak bo'lgan joyda — chegara tor bo'lganda —
 * yo'qolardi.
 *
 * Endi qadam ORALIQDAN olinadi va ENG PAST NARX HAR DOIM oxirgi
 * tugma bo'ladi: kassirga eng ko'p kerak bo'ladigani o'sha.
 */
export function quickPrices(item, count = 4) {
  const base = lineBase(item);
  const floor = lineFloor(item);
  if (floor == null || !(floor < base)) return [];

  const out = [];
  const push = (v) => {
    const r = Math.round(v);
    if (r >= floor && r < base && !out.includes(r)) out.push(r);
  };

  const span = base - floor;
  const step = span >= 50000 ? 10000
             : span >= 20000 ? 5000
             : span >= 5000  ? 1000
             : span >= 1000  ? 500
             : 100;

  /* `base - 1` — e'lon narxining o'zi tugma bo'lmasligi kerak:
     u chegirmasiz narx va «Narxni tiklash» tugmasida turibdi. */
  for (let v = Math.floor((base - 1) / step) * step;
       v > floor && out.length < count - 1;
       v -= step) push(v);

  push(floor);
  return out.sort((a, b) => b - a).slice(0, count);
}

/**
 * MAYDONDAGI MATNDAN NARX.
 *
 * ⚠ XATO #4 — NUQTA NARXNI 10 BARAVAR OSHIRARDI.
 *
 * `NumField kind="money"` ikki kasr xonaga ruxsat beradi, ya'ni maydon
 * `"14667.5"` qiymatini bemalol qaytaradi. Modalda esa
 * `replace(/\D/g, "")` turardi — u NUQTANI HAM O'CHIRARDI va son
 * `146675` bo'lib o'qilardi. E'lon narxi 150 000 bo'lsa bu son
 * chegaradan o'tib ketardi: kassir 14 667 yozib, savatga 146 675
 * tushardi.
 *
 * ⚠ IKKI TOMONDAN YOPILDI: maydonning o'zi endi kasr qabul qilmaydi
 * (`decimals={0}` — pul V80 dan beri butun so'm), bu funksiya esa
 * maydon qanday o'zgarsa ham to'g'ri o'qiydi.
 *
 * PASTGA yaxlitlanadi — MIJOZ FOYDASIGA: past narx = katta chegirma.
 */
export function parsePrice(raw) {
  const v = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/** Narx holati: `empty` | `high` | `low` | `ok`. */
export function priceVerdict(item, num) {
  if (!(num > 0)) return "empty";
  if (num > lineBase(item)) return "high";
  const floor = lineFloor(item);
  if (floor != null && num < floor) return "low";
  return "ok";
}

/**
 * YOZILGAN NARXDAN QATOR CHEGIRMASI — server aynan shu summani kutadi.
 *
 * ⚠ XATO #3 — CHEGIRMA KASR CHIQARDI.
 *
 * Ilgari `Math.round(… * 100) / 100` turardi, ya'ni ikki kasr
 * xonagacha. Tarozili tovarda (miqdor 0.125) chegirma 41.63 bo'lib
 * chiqardi — pul butun so'mga o'tkazilgan tizimda (V80) yagona kasr
 * qolgan joy shu edi.
 *
 * ⚠ YUQORIGA yaxlitlanadi — MIJOZ FOYDASIGA: modal ekranda qator
 * jamisini ko'rsatadi va mijoz undan KO'P to'lamasligi kerak.
 * «Ekranda bir son, chekda boshqa son» — bu faylda allaqachon
 * yozilgan eng og'ir shikoyat.
 */
export function priceDiscount(item, num) {
  if (priceVerdict(item, num) !== "ok") return 0;

  /* TEGILMAGAN NARX — asl chegirma AYNAN saqlanadi (xato #1). */
  if (num === initialPrice(item)) return n(item?.discount);

  const exact = (lineBase(item) - num) * lineQty(item);
  /* 1000 × 1.1 = 1100.0000000000002 → `ceil` 1101 berardi. */
  return Math.max(0, Math.ceil(Math.round(exact * 1e6) / 1e6));
}

/** Chegirmadan keyingi qator jamisi — CHEKDAGI son bilan bir xil. */
export function lineNetTotal(item, num) {
  return lineBase(item) * lineQty(item) - priceDiscount(item, num);
}

/**
 * SAVATGA OPTOM NARX — REJA (V97).
 *
 * <p>Optom mijoz 20 ta tovar olganda kassir har qatorning oynasini
 * ochib o'tira olmaydi. Bu funksiya bitta bosishda nima o'zgarishini
 * OLDINDAN hisoblaydi: qaysi qator, qaysi narxga, qancha chegirma.
 *
 * ⚠ CHEGIRMANI HECH QACHON KAMAYTIRMAYDI. Kassir biror qatorga
 * qo'lda kattaroq chegirma bergan bo'lsa, optom narx uni
 * o'chirmaydi — bu narxni KO'TARIB yuborardi va mijoz oldida
 * tushuntirib bo'lmaydigan holat bo'lardi. Shuning uchun
 * `canApply` faqat TUSHADIGAN qatorlarni sanaydi.
 *
 * ⚠ BEKOR QILISH FAQAT O'ZI QO'YGANINI OLADI (`isOn`): qatorning
 * hozirgi chegirmasi optom chegirmaga AYNAN teng bo'lsagina
 * nolga tushadi. Keyin qo'lda o'zgartirilgan qator tegilmaydi.
 *
 * @param lines savat qatorlari
 * @return `{ rows, canApply, isOn }` — `rows` har biri
 *         `{ index, price, discount }`
 */
export function wholesalePlan(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const rows = [];
  list.forEach((l, index) => {
    const price = wholesaleOffer(l);
    if (price == null) return;
    /* ⚠ Chegirma NOL holatdan hisoblanadi: `priceDiscount` da
       «tegilmagan narx — asl chegirma» tarmog'i bor va u shu yerda
       eski qiymatni qaytarib yuborishi mumkin edi. */
    const discount = priceDiscount({ ...l, discount: 0 }, price);
    if (discount > 0) rows.push({ index, price, discount });
  });

  const cur = (i) => n(list[i]?.discount);
  const canApply = rows.some((r) => r.discount > cur(r.index));

  return {
    rows,
    canApply,
    /* ⚠ «QO'YADIGAN NARSA QOLMADI» — «hammasi aynan optomda» EMAS.
       Boshida `every(teng)` edi va u O'LIK TUGMA yasardi: kassir
       tugmani bosgach bitta qatorga qo'lda kattaroq chegirma bersa,
       tugma «Optom narxlar» ga qaytardi-yu, bosilganda HECH NARSA
       qilmasdi (o'sha qatorga qo'yadigan narsa yo'q, qolganlari
       allaqachon o'z joyida). Bu sinovda ushlandi. */
    isOn: rows.length > 0 && !canApply,
  };
}

/**
 * REJANI QO'LLASH yoki BEKOR QILISH — yangi savat qaytaradi.
 *
 * ⚠ Reja `next` ning O'ZIDAN qayta hisoblanadi, tashqaridagi
 * eslab qolingan rejadan emas: savat oradagi bir bosishda
 * o'zgargan bo'lishi mumkin.
 */
export function applyWholesale(lines) {
  const list = Array.isArray(lines) ? lines : [];
  const plan = wholesalePlan(list);
  const off = plan.isOn;                       // hammasi optomda — bekor qilamiz
  const byIndex = new Map(plan.rows.map((r) => [r.index, r]));

  return list.map((l, index) => {
    const row = byIndex.get(index);
    if (!row) return l;
    const cur = n(l.discount);
    if (off) return cur === row.discount ? { ...l, discount: 0 } : l;
    return row.discount > cur ? { ...l, discount: row.discount } : l;
  });
}
