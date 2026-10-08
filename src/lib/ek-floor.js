/* ══════════════════════════════════════════════════════════════════════════
   ZAL REJASI — sof hisoblar (3-bosqich D2, V155)

   Server joyni 1000 × 640 birlikli TEKISLIKDA saqlaydi (ekran o'lchamidan
   qat'i nazar). Kassa uni foizga aylantiradi: reja planshetda ham, 27"
   monitorda ham bir xil ko'rinadi va qayta joylash kerak bo'lmaydi.

   Bu fayl DOM bilmaydi — node'da sinaladi (`test/floor.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

export const PLANE = { w: 1000, h: 640 };
export const SHAPES = ["SQUARE", "ROUND", "LONG"];

/** Stol o'lchami tekislik birligida. Uzun stol ikki baravar keng. */
export function sizeOf(shape) {
  if (shape === "LONG") return { w: 220, h: 104 };
  if (shape === "ROUND") return { w: 112, h: 112 };
  return { w: 116, h: 104 };
}

/** Joyni tekislik ichida ushlaydi (stol chetdan chiqmasin). */
export function clampPos(x, y, shape) {
  const s = sizeOf(shape);
  return {
    x: Math.round(Math.max(0, Math.min(PLANE.w - s.w, x))),
    y: Math.round(Math.max(0, Math.min(PLANE.h - s.h, y))),
  };
}

/** Rejada joyi bormi. */
export const placed = (t) => Number.isFinite(t?.x) && Number.isFinite(t?.y);

/**
 * Joyi yo'q stollarga vaqtinchalik joy — qator-qator, band joyni chetlab.
 *
 * ⚠ SERVERGA YOZILMAYDI: bu faqat ko'rinish. Rahbar rejani tahrirlasa va
 * saqlasa, o'shanda joy haqiqiy bo'ladi.
 */
export function autoPlace(tables) {
  const step = { x: 250, y: 150 };
  const taken = tables.filter(placed).map((t) => ({ ...t, ...sizeOf(t.shape) }));
  const hit = (x, y, s) => taken.some((o) => x < o.x + o.w + 12 && o.x < x + s.w + 12 && y < o.y + o.h + 12 && o.y < y + s.h + 12);
  const out = [];
  let cx = 24, cy = 24;
  for (const t of tables) {
    if (placed(t)) { out.push(t); continue; }
    const s = sizeOf(t.shape);
    let guard = 0;
    while ((hit(cx, cy, s) || cx + s.w > PLANE.w) && guard++ < 200) {
      cx += step.x;
      if (cx + s.w > PLANE.w) { cx = 24; cy += step.y; }
      if (cy + s.h > PLANE.h) { cy = 24; break; }
    }
    const p = { ...t, x: cx, y: cy, auto: true };
    taken.push({ ...p, ...s });
    out.push(p);
    cx += step.x;
    if (cx + s.w > PLANE.w) { cx = 24; cy += step.y; }
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
