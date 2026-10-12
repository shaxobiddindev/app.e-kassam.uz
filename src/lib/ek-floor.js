/* ══════════════════════════════════════════════════════════════════════════
   ZAL REJASI — sof hisoblar (3-bosqich D2, V155)

   Server joyni 1000 × 640 birlikli TEKISLIKDA saqlaydi (ekran o'lchamidan
   qat'i nazar). Kassa uni foizga aylantiradi: reja planshetda ham, 27"
   monitorda ham bir xil ko'rinadi va qayta joylash kerak bo'lmaydi.

   Bu fayl DOM bilmaydi — node'da sinaladi (`test/floor.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

export const PLANE = { w: 1000, h: 640 };
export const SHAPES = ["SQUARE", "ROUND", "LONG"];

/* ══ VIZUAL MUHARRIR (V164) ═════════════════════════════════════════════
   Egasi: «raqam kiritib emas, zalning o'zida yasay olsin; murakkab bo'lib
   ketmasligi uchun shakllar soni cheklansin; ko'rsatilganda joy tejalsin,
   lekin juda yopishib ketmasin».

   ⚠ TO'RTTA TAYYOR SHAKL, boshqasi yo'q. Erkin o'lcham (eni, bo'yi) bersa,
   rahbar rejani chizish bilan band bo'lib qolardi; ofitsiantga esa stol
   qayerdaligi kerak, aniq o'lchami emas. O'lcham O'RINLAR SONIDAN kelib
   chiqadi: −/+ bosilsa stol kattalashadi va stullar qo'shiladi.

   ⚠ STULLAR stol QUTISI ichida (`CHAIR`) va stollar orasida yana `GAP`
   bo'shliq — shuning uchun reja qancha siqilsa ham stullar bir-biriga
   tegmaydi va ofitsiant o'tadigan yo'l qoladi. */
export const CHAIR = 18;
export const GAP = 16;
export const GRID = 8;
/** Serverdagi `DiningService.MAX_TABLES_PER_HALL` bilan bir xil. */
export const MAX_TABLES = 60;

export const PRESETS = [
  { key: "small", shape: "SQUARE", seats: 2 },
  { key: "square", shape: "SQUARE", seats: 4 },
  { key: "round", shape: "ROUND", seats: 4 },
  { key: "long", shape: "LONG", seats: 6 },
];
export const SEAT_RANGE = { SQUARE: [1, 4], ROUND: [2, 8], LONG: [4, 12] };
const DEFAULT_SEATS = { SQUARE: 4, ROUND: 4, LONG: 6 };

const shapeOf = (shape) => (SHAPES.includes(shape) ? shape : "SQUARE");
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/** O'rinlar soni shakl chegarasida (yo'q bo'lsa — shaklning odatdagisi). */
export function seatsOf(shape, seats) {
  const sh = shapeOf(shape);
  const [lo, hi] = SEAT_RANGE[sh];
  const n = Number(seats);
  return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, Math.round(n))) : DEFAULT_SEATS[sh];
}

/** Stolning o'zi (stullarsiz), tekislik birligida. */
export function bodyOf(shape, seats, vertical) {
  const sh = shapeOf(shape);
  const n = seatsOf(sh, seats);
  if (sh === "ROUND") { const d = 70 + (n - 2) * 8; return { w: d, h: d }; }
  if (sh === "LONG") {
    const len = Math.ceil(n / 2) * 34 + 20;
    return vertical ? { w: 64, h: len } : { w: len, h: 64 };
  }
  const a = n <= 2 ? 64 : 84;
  return { w: a, h: a };
}

/** Stol qutisi — stullar bilan. Rejadagi joy (`x`, `y`) shu qutining burchagi. */
export function sizeOf(shape, seats, vertical) {
  const b = bodyOf(shape, seats, vertical);
  return { w: b.w + CHAIR * 2, h: b.h + CHAIR * 2 };
}

export const boxOf = (t) => ({ x: t.x, y: t.y, ...sizeOf(t.shape, t.seats, t.vertical) });

/** Joyni tekislik ichida ushlaydi (stol chetdan chiqmasin). */
export function clampPos(x, y, shape, seats, vertical) {
  const s = sizeOf(shape, seats, vertical);
  return {
    x: Math.round(Math.max(0, Math.min(PLANE.w - s.w, x))),
    y: Math.round(Math.max(0, Math.min(PLANE.h - s.h, y))),
  };
}

/** Rejada joyi bormi. */
export const placed = (t) => Number.isFinite(t?.x) && Number.isFinite(t?.y);

/** Ikki quti `gap` dan yaqinmi (yoki ustma-ust). */
export function overlaps(a, b, gap = GAP) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** Stol shu joyga sig'adimi: tekislik ichida va boshqalardan `GAP` uzoqda. */
export function fits(t, items) {
  const a = boxOf(t);
  if (a.x < 0 || a.y < 0 || a.x + a.w > PLANE.w || a.y + a.h > PLANE.h) return false;
  return !items.some((o) => o !== t && o.id !== t.id && placed(o) && overlaps(a, boxOf(o)));
}

/**
 * Eng yaqin bo'sh joy — `t.x`, `t.y` atrofida halqa-halqa qidiriladi.
 * Shakl palitradan tashlanganda yoki kattalashtirilganda qo'shnisiga
 * tegsa, stol shu yerga suriladi. Joy umuman bo'lmasa — `null`.
 */
export function nearestFree(t, items) {
  const s = sizeOf(t.shape, t.seats, t.vertical);
  const sx = Math.round((Number.isFinite(t.x) ? t.x : 24) / GRID) * GRID;
  const sy = Math.round((Number.isFinite(t.y) ? t.y : 24) / GRID) * GRID;
  const at = (x, y) => ({ ...t, ...clampPos(x, y, t.shape, t.seats, t.vertical) });
  const first = at(sx, sy);
  if (fits(first, items)) return { x: first.x, y: first.y };
  const maxR = Math.ceil(Math.max(PLANE.w, PLANE.h) / GRID);
  for (let r = 1; r <= maxR; r++) {
    let best = null;
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of (Math.abs(dx) === r ? range(-r, r) : [-r, r])) {
        const x = sx + dx * GRID, y = sy + dy * GRID;
        if (x < 0 || y < 0 || x + s.w > PLANE.w || y + s.h > PLANE.h) continue;
        const c = at(x, y);
        if (!fits(c, items)) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { x: c.x, y: c.y, d };
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  return null;
}

/**
 * Stullar — stol qutisi ichida, tanadan tashqarida (birlikda, qutiga nisbatan).
 * Faqat chizish uchun: o'rinlar soni ko'zga ko'rinsin, raqam o'qilmasin.
 */
export function chairsOf(shape, seats, vertical) {
  const sh = shapeOf(shape);
  const n = seatsOf(sh, seats);
  const b = bodyOf(sh, n, vertical);
  const W = 26, D = CHAIR - 4;
  const box = { w: b.w + CHAIR * 2, h: b.h + CHAIR * 2 };
  const top = (cx) => ({ x: cx - W / 2, y: 2, w: W, h: D });
  const bottom = (cx) => ({ x: cx - W / 2, y: box.h - D - 2, w: W, h: D });
  const left = (cy) => ({ x: 2, y: cy - W / 2, w: D, h: W });
  const right = (cy) => ({ x: box.w - D - 2, y: cy - W / 2, w: D, h: W });
  if (sh === "ROUND") {
    const r = b.w / 2 + CHAIR / 2, c = box.w / 2;
    return range(0, n - 1).map((i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: c + r * Math.cos(a) - D / 2, y: c + r * Math.sin(a) - D / 2, w: D, h: D, round: true };
    });
  }
  if (sh === "LONG") {
    const a = Math.ceil(n / 2), z = n - a;
    const len = vertical ? b.h : b.w;
    const along = (k, i) => CHAIR + (len * (i + 0.5)) / k;
    return vertical
      ? [...range(0, a - 1).map((i) => left(along(a, i))), ...range(0, z - 1).map((i) => right(along(z, i)))]
      : [...range(0, a - 1).map((i) => top(along(a, i))), ...range(0, z - 1).map((i) => bottom(along(z, i)))];
  }
  const cx = box.w / 2, cy = box.h / 2;
  return [top(cx), bottom(cx), left(cy), right(cy)].slice(0, n);
}

/**
 * Zal ko'rinishi uchun kesim: hamma stol qutisi + chekka. Bo'sh tekislik
 * chizilmaydi — reja ekranga to'liq cho'ziladi (egasi: «maksimal joy
 * tejalsin»). ⚠ Eng kichik o'lcham bor: ikki stolli zal ekranni to'ldirib,
 * stollar ulkan bo'lib ketmasin.
 */
export function fitBox(tables, pad = GAP, min = { w: 480, h: 300 }) {
  const boxes = (tables || []).filter(placed).map(boxOf);
  if (!boxes.length) return { x: 0, y: 0, w: PLANE.w, h: PLANE.h };
  let x1 = Math.min(...boxes.map((b) => b.x)) - pad, y1 = Math.min(...boxes.map((b) => b.y)) - pad;
  let x2 = Math.max(...boxes.map((b) => b.x + b.w)) + pad, y2 = Math.max(...boxes.map((b) => b.y + b.h)) + pad;
  const grow = (a, b, need, lim) => {
    const extra = Math.max(0, need - (b - a));
    a -= extra / 2; b += extra / 2;
    if (a < 0) { b -= a; a = 0; }
    if (b > lim) { a -= b - lim; b = lim; }
    return [Math.max(0, a), Math.min(lim, b)];
  };
  [x1, x2] = grow(x1, x2, min.w, PLANE.w);
  [y1, y2] = grow(y1, y2, min.h, PLANE.h);
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
}

/** Keyingi nom: «Stol 7» — mavjud nomlardagi eng katta raqamdan keyingisi. */
export function nextName(items, prefix) {
  const max = (items || []).reduce((m, t) => {
    const n = Number(/(\d+)\s*$/.exec(String(t.name || ""))?.[1]);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix ? prefix + " " : ""}${max + 1}`;
}

/**
 * Joyi yo'q stollarga vaqtinchalik joy — bo'sh joy chapdan-yuqoridan.
 *
 * ⚠ SERVERGA YOZILMAYDI: bu faqat ko'rinish. Rahbar rejani tahrirlasa va
 * saqlasa, o'shanda joy haqiqiy bo'ladi.
 */
export function autoPlace(tables) {
  const out = (tables || []).map((t) => ({ ...t }));
  for (const t of out) {
    if (placed(t)) continue;
    const p = nearestFree({ ...t, x: 24, y: 24 }, out) || { x: 0, y: 0 };
    t.x = p.x; t.y = p.y; t.auto = true;
  }
  return out;
}

/**
 * Rejadagi o'qish tartibi: yuqoridan pastga, chapdan o'ngga (taxminan bir
 * qatordagilar — 60 birlik ichida — bitta qator). Telefonda reja plitkaga
 * aylanadi va tartib shundan olinadi.
 */
export function byPlace(tables) {
  return [...tables].sort((a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x));
}

/** Oshxonada shuncha daqiqadan ko'p kutsa — «kechikmoqda» (D5). */
export const LATE_MIN = 20;
/** Oshxona ekranida: shundan keyin «shoshiling». */
export const HURRY_MIN = 12;

/**
 * Stol holati: «ready» · «late» · «bill» · «busy» · «resv» · «free».
 *
 * ⚠ TARTIB — KIM HARAKAT QILISHI KERAKLIGI BO'YICHA: tayyor taom sovuyapti
 * (ofitsiant darhol borishi kerak) — eng ustun; keyin kechikayotgan taom
 * (oshxonani so'rash); keyin hisob (kassaga). Oddiy band — eng past.
 */
export function statusOf(t, now = Date.now()) {
  const o = t?.order;
  if (o) {
    if (Number(o.kitchenReady) > 0) return "ready";
    const w = Date.parse(o.kitchenWaitingSince || "");
    if (Number.isFinite(w) && now - w >= LATE_MIN * 60000) return "late";
    return o.billAt ? "bill" : "busy";
  }
  if (t?.reservation) return "resv";
  return "free";
}

/** Oshxona buyurtmasining shoshilinchligi: «new» · «hurry» · «late» (D5). */
export function urgencyOf(createdAt, now = Date.now()) {
  const m = (now - Date.parse(createdAt || "")) / 60000;
  if (!Number.isFinite(m)) return "new";
  return m >= LATE_MIN ? "late" : m >= HURRY_MIN ? "hurry" : "new";
}

/**
 * «Diqqat talab qiladi» ro'yxati: hisob berilgan stollar (eng eskisi birinchi)
 * va bir soat ichidagi bronlar (eng yaqini birinchi; o'tib ketgani ham — u
 * mehmon kechikayotganini aytadi).
 */
export function attention(halls, now = Date.now()) {
  const out = [];
  for (const h of halls || []) {
    for (const t of h.tables || []) {
      const st = statusOf(t, now);
      if (st === "ready") {
        out.push({ kind: "ready", table: t, hall: h, at: now });
      } else if (st === "late") {
        out.push({ kind: "late", table: t, hall: h, at: Date.parse(t.order.kitchenWaitingSince) });
      } else if (t.order?.billAt) {
        out.push({ kind: "bill", table: t, hall: h, at: Date.parse(t.order.billAt) });
      } else if (!t.order && t.reservation?.at) {
        const at = Date.parse(t.reservation.at);
        if (Number.isFinite(at) && at - now <= 60 * 60000) out.push({ kind: "resv", table: t, hall: h, at });
      }
    }
  }
  const rank = { ready: 0, late: 1, bill: 2, resv: 3 };
  return out.sort((a, b) => (a.kind === b.kind ? a.at - b.at : rank[a.kind] - rank[b.kind]));
}

/** «20:30» — bron vaqti. */
export function hhmm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * «HH:MM» → bugungi (o'tib ketgan bo'lsa ertangi) ISO vaqt. Bron odatda
 * shu kechaga; tunda «01:00» deyilsa — ertaga tunda.
 */
export function atToday(hm, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const d = new Date(now);
  d.setHours(h, mi, 0, 0);
  if (d.getTime() < now.getTime() - 60 * 60000) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
