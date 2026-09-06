/* ══════════════════════════════════════════════════════════════════════════
   CHEK CHEGIRMASINI QATORLARGA TAQSIMLASH

   ⚠⚠ SERVERDAGI QOIDANING AYNAN NUSXASI (`SaleService.distributeSaleDiscount`).
   Kassir to'lov oynasida «bu chegirma qaysi tovarga qanchadan tushadi?»
   degan javobni ko'radi, keyin esa AYNAN o'sha raqamlar chekda va
   hisobotda turishi kerak. Ikki joyda ikki xil yaxlitlash bo'lsa, mijoz
   chekni ko'rib «siz boshqa aytdingiz» derdi.

   Qoida: ulush = chegirma × qator jami / hammasining jami, ikki xonagacha
   PASTGA yaxlitlanadi; yaxlitlashdan qolgan tiyin esa ENG KATTA qatorga
   qo'shiladi (u yerda u eng kam seziladi).
   ══════════════════════════════════════════════════════════════════════════ */

/** Bitta qatorning o'z chegirmasidan keyingi jami. */
export const lineNet = (l) =>
  Math.max(0, (Number(l.salePrice) || 0) * (Number(l.qty) || 0) - (Number(l.discount) || 0));

/**
 * @param lines  `{ salePrice, qty, discount? }` ro'yxati
 * @param total  chek bo'yicha chegirma (so'm)
 * @returns har qatorga tushgan ulush (`lines` bilan bir tartibda)
 */
export function spreadDiscount(lines, total) {
  const d = Number(total) || 0;
  const out = lines.map(() => 0);
  if (d <= 0 || !lines.length) return out;

  const nets = lines.map(lineNet);
  const base = nets.reduce((s, n) => s + n, 0);
  if (base <= 0) return out;

  let given = 0;
  let biggest = 0;
  for (let i = 0; i < lines.length; i++) {
    /* ⚠ PASTGA yaxlitlash (`floor`), yumaloqlash emas — serverda ham
       `RoundingMode.DOWN`. Aks holda ulushlar yig'indisi chegirmadan
       oshib ketishi mumkin edi. */
    const share = Math.floor((d * nets[i]) / base * 100) / 100;
    out[i] = share;
    given += share;
    if (nets[i] > nets[biggest]) biggest = i;
  }
  const rest = Math.round((d - given) * 100) / 100;
  if (rest !== 0) out[biggest] = Math.round((out[biggest] + rest) * 100) / 100;
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   YAXLITLASH TAKLIFLARI (V56)

   ═══ MUAMMO ═══════════════════════════════════════════════════════════

   Chek 141 200 so'm chiqdi. Mijoz 142 000 beradi, kassir 800 qaytaradi —
   maydasi yo'q, navbat kutadi, oxir-oqibat kassir «qo'ying, keyin»
   deb qo'l siltaydi va o'sha 800 hisobsiz ketadi.

   Do'kon egasining so'rovi: tizim shu qoldiqni O'ZI ko'rsin va
   chegirma qilib taklif qilsin — «141 000 qilaymi?» Ya'ni do'kon 200
   so'm beradi, lekin qaytim muammosi butunlay yo'qoladi.

   ═══ QOIDA ═══════════════════════════════════════════════════════════

   1. Har qatorning BO'SH JOYI hisoblanadi: `(narx − eng past narx) ×
      miqdor`. Eng past narxni SERVER beradi (`minPrice`) — u yerda
      tovar foizi, do'kon foizi va kassir chegarasi allaqachon
      hisoblangan.

   2. Yaxlit maqsadlar: jami 500 · 1 000 · 5 000 · 10 000 ga
      PASTGA yaxlitlanadi. Har biri uchun kerakli chegirma =
      jami − maqsad.

   3. Bo'sh joyga SIG'ADIGANLARI qoladi. Sig'masa taklif ham
      qilinmaydi: kassirga bajik so'raydigan taklif berish — uni
      rahbar chaqirishga majburlash degani.

   ⚠ TAQSIMOT QATOR QIYMATIGA EMAS, BO'SH JOYIGA MUTANOSIB. Do'kon
   egasining misolida piyoz va kartoshka ko'p yutadi, 700 so'mlik Kola
   deyarli hech narsa — chunki uning bo'sh joyi kichik. Qiymatga
   mutanosib bo'lsa, marjasi past qator o'z chegarasidan oshib ketardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Yaxlitlash qadamlari — kattadan kichikka qarab tekshiriladi. */
export const ROUND_STEPS = [10000, 5000, 1000, 500];

/**
 * Bitta qatorning bo'sh joyi — unga yana qancha chegirma sig'adi.
 *
 * @param l `{ salePrice, qty, discount?, minPrice? }`
 *
 * ⚠ `minPrice` bo'lmasa bo'sh joy NOL: eski server javobida bu maydon
 * yo'q va bunda taklif berish — kassirni bajik so'raladigan holatga
 * olib kirish demak.
 */
export function lineRoom(l) {
  const price = Number(l.salePrice) || 0;
  const qty = Number(l.qty) || 0;
  const min = l.minPrice == null ? null : Number(l.minPrice);
  if (min == null || !Number.isFinite(min)) return 0;

  const room = (price - min) * qty - (Number(l.discount) || 0);
  return room > 0 ? Math.floor(room) : 0;
}

/** Butun savatning bo'sh joyi. */
export const cartRoom = (lines) =>
  (lines || []).reduce((s, l) => s + lineRoom(l), 0);

/**
 * Yaxlitlash takliflari.
 *
 * @param lines savat qatorlari
 * @param total joriy jami (chegirmalardan keyin)
 * @param limit nechta taklif qaytarilsin
 * @returns `[{ target, discount }]` — kichik chegirmadan kattasiga
 */
export function roundingOffers(lines, total, limit = 3) {
  const t = Math.round(Number(total) || 0);
  const room = cartRoom(lines);
  if (t <= 0 || room <= 0) return [];

  /* ⚠ JAMI ALLAQACHON YAXLIT BO'LSA — TAKLIF YO'Q.
     Bu tizimning maqsadi «noqulay qoldiqni yo'qotish», «yaxlit
     chegirma berish» emas. 61 000 lik chekda qaytim muammosi yo'q va
     unga «−1 000 → 60 000» deb taklif qilish do'konni har chekda
     bekorga puldan qilardi: kassir taklifni ko'rsa, uni bosadi. */
  if (t % ROUND_STEPS[ROUND_STEPS.length - 1] === 0) return [];

  const out = [];
  const seen = new Set();
  /* Kichik qadamdan boshlanadi: kassir birinchi navbatda eng arzon
     yechimni ko'rishi kerak — 200 so'mlik taklif 6 200 lik takliftan
     ancha ko'p ishlatiladi. */
  for (const step of [...ROUND_STEPS].reverse()) {
    const target = Math.floor(t / step) * step;
    const discount = t - target;
    if (discount <= 0 || discount > room) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push({ target, discount });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Chegirmani qatorlarning BO'SH JOYIGA mutanosib taqsimlaydi.
 *
 * ⚠ `spreadDiscount` dan farqi shunda: u qator QIYMATIGA mutanosib
 * taqsimlaydi va marjasi past qatorni o'z chegarasidan oshirib
 * yuborishi mumkin. Bu yerdagisi esa har qatorga faqat sig'adiganini
 * beradi.
 *
 * Qoldiq tiyinlar bo'sh joyi ENG KATTA qatorga qo'shiladi — u yerda
 * ular chegaradan oshirmasligi kafolatlangan.
 */
export function spreadByRoom(lines, total) {
  const d = Math.round(Number(total) || 0);
  const out = (lines || []).map(() => 0);
  if (d <= 0 || !lines?.length) return out;

  const rooms = lines.map(lineRoom);
  const base = rooms.reduce((s, r) => s + r, 0);
  if (base <= 0) return out;

  let given = 0;
  let biggest = 0;
  for (let i = 0; i < lines.length; i++) {
    const share = Math.min(rooms[i], Math.floor((d * rooms[i]) / base));
    out[i] = share;
    given += share;
    if (rooms[i] > rooms[biggest]) biggest = i;
  }
  /* Yaxlitlashdan qolgani — bo'sh joyi eng katta qatorga, lekin uning
     chegarasidan oshmasdan. */
  const rest = d - given;
  if (rest > 0) out[biggest] = Math.min(rooms[biggest], out[biggest] + rest);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   BYUDJETLI TAKLIFLAR (V57)

   ═══ NEGA YUQORIDAGISI YETMADI ═════════════════════════════════════════

   `roundingOffers` savolni «shu chekdagi noqulay qoldiqni eng arzonga
   qanday yo'qotaman?» deb qo'yadi va 141 200 uchun «−200» deb javob
   beradi. Do'kon egasining savoli esa BOSHQA edi:

     «20 000 chegirma qilmoqchiman. Shundan oshmaydigan, lekin piyoz va
      kartoshkadagi 500 va 700 ni yo'qotadigan summa taklif qilsin.»

   Ya'ni boshlang'ich nuqta — KASSIR BERMOQCHI BO'LGAN SUMMA, chekning
   qoldig'i emas. «Eng arzon» javob bu yerda noto'g'ri: kassir 20 000
   bermoqchi, tizim esa unga 200 taklif qilardi.

   ═══ QOIDA ═══════════════════════════════════════════════════════════

   Byudjet B va jami T berilganda, erishish mumkin bo'lgan jamilar
   oralig'i [T − B, T]. Shu oraliqdagi YAXLIT sonlar qidiriladi va har
   yaxlitlik darajasidan (10 000 · 5 000 · 1 000 · 500) BITTADAN,
   eng CHUQURI (ya'ni byudjetni eng to'la ishlatadigani) olinadi.

   Misol: T = 141 200, B = 20 000 → oraliq [121 200, 141 200]

     10 000 →  130 000  (−11 200)
      5 000 →  125 000  (−16 200)
      1 000 →  122 000  (−19 200)

   Uchalasi ham 500/700 qoldiqni yo'qotadi, uchalasi ham byudjetdan
   oshmaydi, lekin har biri BOSHQACHA murosa: birinchisi do'konga
   arzon, oxirgisi mijozga shirin. Tanlashni kassirga qoldiramiz.

   ⚠ HAR DARAJADAN BITTADAN — aks holda ro'yxat 130 000, 140 000,
   135 000, 125 000 … bo'lib ketardi va kassir o'qib chiqolmasdi.

   ⚠ QAYTIM MULOHAZASI. O'zbekistonda amaldagi eng kichik qulay pul
   birligi — 1 000 so'm. Shuning uchun 1 000 ga karrali jami «qaytim
   muammosi yo'q» degani; 500 — eng past daraja va ro'yxatda ham
   oxirgi o'rinda turadi.

   ⚠ JAMI YAXLIT BO'LSA HAM TAKLIF CHIQADI — `roundingOffers` dan
   farqi shu. U yerda maqsad qoldiqni yo'qotish edi va yaxlit chekka
   taklif berish do'konni bekorga puldan qilardi. Bu yerda esa kassir
   chegirma bermoqchi ekanini O'ZI aytdi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Byudjetdan oshmaydigan yaxlitlash takliflari.
 *
 * @param lines  savat qatorlari
 * @param total  joriy jami (berilgan chegirmalardan keyin)
 * @param budget kassir bermoqchi bo'lgan ENG KO'P chegirma
 * @param limit  nechta taklif
 * @returns `[{ target, discount, step }]` — yaxlitligi bo'yicha kamayib
 */
export function budgetOffers(lines, total, budget, limit = 3) {
  const t = Math.round(Number(total) || 0);
  /* ⚠ BO'SH JOY BILAN KESILADI. Byudjet — kassirning XOHISHI, bo'sh
     joy esa QOIDA (tovar foizi, optom narx, tan narx). Taklif qoidadan
     oshsa, uni bosgan kassir darhol bajik so'raladigan holatga tushardi
     — ya'ni tizim uni o'zi tuzoqqa boshlagan bo'lardi. */
  const cap = Math.min(Math.round(Number(budget) || 0), cartRoom(lines));
  if (t <= 0 || cap <= 0) return [];

  const floorTotal = t - cap;
  const out = [];
  const seen = new Set();
  for (const step of ROUND_STEPS) {
    /* Oraliqdagi ENG PAST yaxlit son — byudjetni eng to'la ishlatadi. */
    const target = Math.ceil(floorTotal / step) * step;
    if (target <= 0 || target > t) continue;
    const discount = t - target;
    if (discount <= 0 || discount > cap) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push({ target, discount, step });
    if (out.length >= limit) break;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   IKKI XIL CHEGARA — VA ULARNING FARQI

   Chegirmaning ikkita butunlay boshqa chegarasi bor va ularni chalkashtirish
   kassirga yolg'on gapirish bo'lardi:

     · BO'SH JOY (`cartRoom`)      — do'kon QOIDASI. Undan oshgan chegirma
       mumkin, lekin RAHBAR TASDIG'I bilan (bajik). Do'kon hali ham
       foydada.
     · ZARAR CHEGARASI (`cartLossRoom`) — TAN NARX. Undan oshgan chegirma
       do'konni ZARARGA sotdiradi.

   Kassir «ortiqcha yozdim» degan bir xil ogohlantirishni ikkala holatda
   ham ko'rsa, ikkinchisining og'irligini bilmasdi.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Qatorning TAN NARXIGACHA bo'lgan joyi — undan pastda zarar boshlanadi.
 *
 * ⚠ `costPrice` bo'lmasa (xizmat, eski javob) — cheksiz emas, `lineRoom`
 * ning o'zi qaytadi: bilmagan narsamizni «zarar emas» deb aytish
 * mumkin emas.
 */
export function lineLossRoom(l) {
  const price = Number(l.salePrice) || 0;
  const qty = Number(l.qty) || 0;
  const cost = l.costPrice == null ? null : Number(l.costPrice);
  if (cost == null || !Number.isFinite(cost)) return lineRoom(l);

  const room = (price - cost) * qty - (Number(l.discount) || 0);
  return room > 0 ? Math.floor(room) : 0;
}

/** Butun savatning zararsiz chegarasi. */
export const cartLossRoom = (lines) =>
  (lines || []).reduce((s, l) => s + lineLossRoom(l), 0);

/**
 * Kiritilgan chegirma qanday baholanadi.
 *
 * @returns `"ok"`   — qoida ichida;
 *          `"over"` — qoidadan oshdi, rahbar tasdig'i kerak;
 *          `"loss"` — tan narxdan past, do'kon zarar ko'radi.
 */
export function discountVerdict(lines, amount) {
  const d = Math.round(Number(amount) || 0);
  if (d <= 0) return "ok";
  if (d > cartLossRoom(lines)) return "loss";
  if (d > cartRoom(lines)) return "over";
  return "ok";
}

/* ══════════════════════════════════════════════════════════════════════════
   CHEGIRMA OPTIMIZATORI (V80) — QAYTARISHNI HAM O'YLAYDIGAN TAKLIF

   ═══ NEGA `budgetOffers` YETMADI ══════════════════════════════════════

   Yuqoridagi ikkala funksiya ham BITTA savolga javob beradi: «CHEK
   JAMISI qanday qilib yaxlit bo'ladi?». Ular chegirmani serverga
   BUTUN CHEK bo'yicha bitta son qilib beradi va server uni qator
   QIYMATIGA mutanosib tarqatadi.

   Natijada 44 200 lik chek 44 000 bo'ladi — jami chiroyli. Lekin
   uchta bir xil tovarning bir donasi 14 666.67 ga tushadi va bu
   ERTAGA chiqadi: mijoz bittasini qaytarganda kassir 14 666 so'm
   67 tiyin berishi kerak. Bunday pul yo'q. U yaxlitlaydi, ayirma
   hisobsiz qoladi.

   ═══ YANGI SAVOL ══════════════════════════════════════════════════════

   «Byudjetdan oshmasdan, do'kon chegarasini buzmasdan, BIR DONANING
   narxi ham, jami ham qulay bo'ladigan taqsimot bormi?»

   Uchta bir xil tovar uchun javob: bir donasini 14 500 ga tushirish —
   jami 43 500, chegirma 700. Byudjetdan (aytaylik 1 000) kam ishlatdi,
   lekin qaytarish MUAMMOSIZ.

   ═══ USTUVORLIK TARTIBI (do'kon egasi belgilagan) ═════════════════════

     1. XAVFSIZLIK — hech bir qator o'z chegarasidan pastga tushmaydi,
        chegirma byudjetdan oshmaydi. Bu BAHO EMAS, SARALASH: shartni
        buzgan variant ro'yxatga umuman kirmaydi.
     2. QAYTARISH QULAYLIGI — bir donaning narxi (`ek-refund.js`).
     3. YAXLIT QATOR NARXI — nechta qator qulay narxga tushdi.
     4. YAXLIT JAMI — chekning o'zi.
     5. BYUDJETDAN FOYDALANISH — kassir bermoqchi bo'lganiga yaqinlik.
     6. TEKIS TAQSIMOT — bitta qator hammasini yutib yubormasin.

   ⚠ TARTIB LEKSIKOGRAFIK: yuqoridagi band teng chiqqandagina keyingisi
   qaraladi. Shuning uchun qaytarish bahosi 100 bo'lgan 9 800 lik
   chegirma, bahosi 40 bo'lgan 10 000 likdan USTUN — 5-band 2-bandni
   hech qachon bosib keta olmaydi.

   ⚠ NIMA UCHUN QATORMA-QATOR YUBORILADI. Server chek chegirmasini
   qator QIYMATIGA mutanosib tarqatadi va bu taqsimot optimizator
   topgan narsadan boshqa bo'lardi — ya'ni ekranda ko'rsatilgan narx
   chekka tushmasdi. Shuning uchun taklif qo'llanganda har qatorga O'Z
   summasi yoziladi (`discountAmount`), chek chegirmasi esa tegilmaydi.
   ══════════════════════════════════════════════════════════════════════════ */

import { refundScore, cartRefundScore, REFUND_TIERS } from "./ek-refund.js";

/** Pul aniqligi — ikki xona. */
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
/** Yarim tiyin — suzuvchi nuqta xatosidan himoya. */
const EPS = 0.005;

/**
 * Qatorning optimizator uchun kerakli o'lchovlari.
 *
 * `paid` — hozirgi holatda to'lanadigan summa (qator chegirmasi
 * ayirilgan), `room` — unga yana qancha chegirma sig'adi.
 */
function measure(l) {
  const price = Number(l.salePrice) || 0;
  const qty = Number(l.qty) || 0;
  const paid = r2(Math.max(0, price * qty - (Number(l.discount) || 0)));
  const room = lineRoom(l);
  return { price, qty, paid, room, unit: qty > 0 ? paid / qty : 0 };
}

/**
 * BIR DONANING NARXINI yaxlit pog'onaga tushirish.
 *
 * Har qatorga alohida qaraladi va byudjet ARZONIDAN boshlab
 * sarflanadi: bir som evaziga eng ko'p qulaylik beradigan qator
 * birinchi navbatda tuzatiladi. Aks holda bitta qimmat qator butun
 * byudjetni yeb, qolganlari noqulay narxda qolardi.
 */
function snapUnits(rows, step, budget) {
  const add = rows.map(() => 0);
  const picks = [];

  rows.forEach((r, i) => {
    if (r.qty <= 0 || r.paid <= 0) return;
    const target = Math.floor(r.unit / step) * step;
    if (target <= 0) return;
    const cost = r2(r.paid - target * r.qty);
    if (cost <= EPS || cost > r.room + EPS) return;

    const gain = (refundScore(target) - refundScore(r.unit)) * r.paid;
    if (gain <= 0) return;
    picks.push({ i, cost, gain });
  });

  /* Bir som evaziga eng ko'p foyda — birinchi. Teng bo'lsa arzoni:
     qolgan byudjet keyingi qatorga ham yetsin. */
  picks.sort((a, b) => (b.gain / b.cost) - (a.gain / a.cost) || a.cost - b.cost);

  let spent = 0;
  for (const p of picks) {
    if (spent + p.cost > budget + EPS) continue;
    add[p.i] = p.cost;
    spent = r2(spent + p.cost);
  }
  return add;
}

/**
 * CHEK JAMISINI yaxlit pog'onaga tushirish — bazadagi taqsimot ustiga.
 *
 * ⚠ Qoldiq qatorlarning BO'SH JOYIGA mutanosib tarqatiladi
 * (`spreadByRoom` bilan bir qoida), qiymatiga emas: marjasi past qator
 * o'z chegarasidan oshib ketmasligi kerak.
 */
function roundTotal(rows, step, budget, base) {
  const add = base.slice();
  const left = rows.map((r, i) => Math.max(0, r.room - add[i]));
  const roomLeft = left.reduce((s, v) => s + v, 0);
  const spent = add.reduce((s, v) => s + v, 0);
  const cap = Math.min(budget - spent, roomLeft);
  if (cap <= EPS) return add;

  const total = r2(rows.reduce((s, r, i) => s + r.paid - add[i], 0));
  const target = Math.ceil((total - cap) / step) * step;
  const need = r2(total - target);
  if (need <= EPS || need > cap + EPS) return add;

  let given = 0;
  let biggest = 0;
  for (let i = 0; i < rows.length; i++) {
    const share = Math.min(left[i], r2((need * left[i]) / roomLeft));
    add[i] = r2(add[i] + share);
    given = r2(given + share);
    if (left[i] > left[biggest]) biggest = i;
  }
  const rest = r2(need - given);
  if (rest > 0) add[biggest] = r2(Math.min(rows[biggest].room, add[biggest] + rest));
  return add;
}

/** Rejaning bahosi — ustuvorlik tartibidagi 2–6-bandlar. */
function scorePlan(rows, add) {
  const parts = rows.map((r, i) => ({
    paid: r2(r.paid - add[i]),
    qty: r.qty,
  }));
  const units = parts.map((p) => (p.qty > 0 ? p.paid / p.qty : 0));

  const refund = cartRefundScore(
    parts.map((p, i) => ({ unitRefund: units[i], qty: p.qty })));

  /* Nechta qator qulay narxga tushdi — qator SONI bo'yicha.
     ⚠ 2-banddan farqi shunda: u summaga mutanosib va bitta katta
     qator hukmron bo'ladi; bu esa har qatorni teng sanaydi. Ikkalasi
     birga «bitta katta qator ham, hamma mayda qator ham» degan
     javobni beradi.

     Chegara — 100 ga bo'linish (60 ball): 50 lik pog'ona amalda
     qaytarib bo'lmaydigan summa va uni «qulay» deb sanash bahoni
     ma'nosiz qilardi. */
  let real = 0;
  let nice = 0;
  parts.forEach((p, i) => {
    if (p.paid <= 0) return;
    real++;
    if (refundScore(units[i]) >= 60) nice++;
  });
  const roundItems = real ? nice / real : 1;

  const total = r2(parts.reduce((s, p) => s + p.paid, 0));

  /* Tekislik: qatorlar chegirma ULUSHI qanchalik bir-biriga yaqin.
     Bittasiga 30%, qolganiga 0% berish texnik jihatdan to'g'ri, lekin
     mijoz chekni ko'rganda «nega faqat bunisi arzonlashdi?» deb
     so'raydi va kassirda javob bo'lmaydi. */
  let lo = 1;
  let hi = 0;
  rows.forEach((r, i) => {
    if (r.paid <= 0) return;
    const rate = add[i] / r.paid;
    if (rate < lo) lo = rate;
    if (rate > hi) hi = rate;
  });
  const even = real ? Math.max(0, Math.min(1, 1 - (hi - lo))) : 1;

  return { refund, roundItems, roundTotal: refundScore(total), even, total };
}

/**
 * Ikki rejani LEKSIKOGRAFIK taqqoslaydi (manfiy = birinchisi yaxshiroq).
 *
 * ⚠ Kasr baholar ikki xonagacha kesiladi: 82.3 va 82.31 orasidagi farq
 * hech narsani anglatmaydi, lekin kesilmasa u keyingi bandlarni —
 * jumladan byudjetdan foydalanishni — hech qachon ishlatmasdi.
 */
function comparePlans(a, b) {
  const at = (v) => Math.round(v * 100) / 100;
  return (
    at(b.score.refund) - at(a.score.refund)
    || at(b.score.roundItems) - at(a.score.roundItems)
    || b.score.roundTotal - a.score.roundTotal
    || b.discount - a.discount
    || at(b.score.even) - at(a.score.even)
  );
}

/**
 * ENG YAXSHI CHEGIRMA REJALARI.
 *
 * @param lines  savat qatorlari `{ salePrice, qty, discount?, minPrice? }`
 * @param budget kassir bermoqchi bo'lgan ENG KO'P chegirma
 * @param limit  nechta reja qaytarilsin
 * @returns `[{ discount, total, add, units, score }]` — yaxshisidan
 *          yomoniga. `add` — HAR QATORGA qo'shiladigan chegirma.
 */
export function optimizeDiscount(lines, budget, limit = 3) {
  const cap = Math.min(Math.round(Number(budget) || 0), cartRoom(lines));
  if (!lines?.length || cap <= 0) return [];

  const rows = lines.map(measure);
  if (rows.every((r) => r.paid <= 0)) return [];

  /* ⚠ HOZIRGI HOLATNING BAHOSI — o'lchov nuqtasi. Chegirmasiz savat
     ham qulay bo'lishi mumkin (3 × 15 000 — bir donasi tekis 15 000)
     va bunday savatga «−1 000, jami 44 000» deb taklif berish bir
     donani 14 666.67 ga tushirardi: jami chiroyli, qaytarish esa
     imkonsiz. Taklif tizimining butun ma'nosi shuni oldini olish. */
  const base = cartRefundScore(rows.map((r) => ({ unitRefund: r.unit, qty: r.qty })));

  const zeros = rows.map(() => 0);
  const steps = REFUND_TIERS.map((t) => t.step);
  const cands = [];

  /* Faqat bir donaning narxi. */
  for (const s of steps) cands.push(snapUnits(rows, s, cap));
  /* Faqat jami — eski xatti-harakat, lekin qatorma-qator taqsimlangan. */
  for (const s of steps) cands.push(roundTotal(rows, s, cap, zeros));
  /* Ikkalasi: avval bir dona, qolgan byudjetga jami. */
  for (const s1 of steps) {
    const base = snapUnits(rows, s1, cap);
    if (base.every((v) => v <= EPS)) continue;
    for (const s2 of steps) cands.push(roundTotal(rows, s2, cap, base));
  }

  const seen = new Set();
  const plans = [];
  for (const add of cands) {
    const discount = r2(add.reduce((s, v) => s + v, 0));
    if (discount <= EPS) continue;
    /* ⚠ XAVFSIZLIK — BAHO EMAS, SARALASH. Chegaradan oshgan reja
       ro'yxatga kirmaydi: uni bosgan kassir darhol bajik so'raladigan
       holatga tushardi, ya'ni tizim uni o'zi tuzoqqa boshlagan
       bo'lardi. */
    if (discount > cap + EPS) continue;
    if (add.some((v, i) => v < -EPS || v > rows[i].room + EPS)) continue;

    const key = add.map((v) => v.toFixed(2)).join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const score = scorePlan(rows, add);
    /* ⚠ QAYTARISHNI YOMONLASHTIRADIGAN TAKLIF KO'RSATILMAYDI.

       Kassir ro'yxatdagi tugmani ko'rsa — bosadi; u har bir variantni
       qaytarish nuqtai nazaridan tekshirib o'tirmaydi, buning uchun
       tizim bor. Shuning uchun tanlov faqat YAXSHILAYDIGAN yoki
       hech bo'lmasa buzmaydigan rejalardan iborat bo'ladi.

       Ro'yxat bo'sh chiqsa kassir jim qolmaydi: to'lov oynasi «bu
       byudjetda qulay variant yo'q» deb aytadi va u chegirmani
       qo'lda yozishi mumkin — qo'lda yozilgani hech qachon
       to'silmagan. */
    if (score.refund < base - EPS) continue;

    plans.push({
      discount,
      total: score.total,
      add,
      units: rows.map((r, i) => (r.qty > 0 ? r2((r.paid - add[i]) / r.qty) : 0)),
      score,
      /** Hozirgi holatga nisbatan qaytarish qulayligining o'sishi. */
      gain: Math.round(score.refund - base),
    });
  }

  plans.sort(comparePlans);
  return plans.slice(0, limit);
}

/**
 * Hozirgi savatning qaytarish bahosi — chegirmasiz holat.
 *
 * Taklifni «yaxshilanish» deb ko'rsatish uchun kerak: kassir 60 dan
 * 100 ga ko'tarilganini ko'rsa, tugmani nega bosayotganini tushunadi.
 */
export function currentRefundScore(lines) {
  const rows = (lines || []).map(measure);
  return cartRefundScore(rows.map((r) => ({ unitRefund: r.unit, qty: r.qty })));
}
