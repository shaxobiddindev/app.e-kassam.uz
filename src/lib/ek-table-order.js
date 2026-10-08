/* ══════════════════════════════════════════════════════════════════════════
   STOL BUYURTMASI ↔ SAVAT (2-bosqich T1, V153, docs/22-RESTORAN.md)

   Stol kassada SAVAT YORLIG'I bo'lib ochiladi. Savatning qatorlari serverga
   qisqa ko'rinishda yoziladi (tovar ID, miqdor, qo'shimcha ID lari, qator
   chegirmasi) va boshqa qurilma ularni qaytadan savatga aylantiradi.

   ⚠ NARX SERVERGA YOZILMAYDI: to'lovda chek odatdagi `POST /sales` bilan
   ketadi va narxni server o'sha paytda hisoblaydi.

   ⚠ SOF MANTIQ — Node'da sinaladi (`test/table-order.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */
import { lineFor } from "./ek-modifiers.js";

/** Savat qatorlari → server qatorlari. */
export function linesOf(items) {
  return (items || [])
    .filter((i) => i && i.id != null && Number(i.qty) > 0)
    .map((i) => ({
      productId: i.id,
      quantity: Number(i.qty),
      modifierIds: (i.modifiers || []).map((m) => Number(m.id)).sort((a, b) => a - b),
      discount: Math.max(0, Number(i.discount) || 0),
      /* D3: mehmon, kurs, izoh — faqat bor bo'lsa (do'kon kassasi savatida yo'q).
         `sentQty` YUBORILMAYDI: uni faqat server yuritadi. */
      ...(i.seat ? { seat: Number(i.seat) } : {}),
      ...(i.course ? { course: Number(i.course) } : {}),
      ...(i.note ? { note: String(i.note) } : {}),
    }));
}

/**
 * Savat qatori kaliti mehmon, kurs va izoh bilan (D3): «M1 uchun osh» va «M2
 * uchun osh» — oshxona va hisob uchun boshqa-boshqa qator.
 */
export function seatKey(line) {
  /* ⚠ ASOS `_key` DAN EMAS, tovar va qo'shimchalardan: `_key` ning o'zi
     seatKey bo'lishi mumkin va qo'shimcha ikki marta ulanib, bir xil taom
     har bosishda yangi qator bo'lib qolardi. Format — `lineFor` niki. */
  const mods = (line?.modifiers || []).map((m) => Number(m.id)).sort((a, b) => a - b);
  const base = mods.length ? `${line.id}~${mods.join(".")}` : line?.id;
  const extra = [line?.seat ? `s${line.seat}` : "", line?.course ? `c${line.course}` : "", line?.note ? `n${line.note}` : ""]
    .filter(Boolean).join("|");
  return extra ? `${base}|${extra}` : base;
}

/**
 * O'zgarish belgisi — serverga faqat haqiqatan o'zgarganda yoziladi.
 *
 * ⚠ Usiz har chizishda (masalan qator «pulse» animatsiyasi) PUT ketardi va
 * har biri versiyani oshirib, ikkinchi qurilmani bekorga «eskirgan» qilardi.
 */
export const sigOf = (items, extra = {}) => JSON.stringify({ l: linesOf(items), g: extra.guests ?? null });

/**
 * Server buyurtmasi → savat qatorlari.
 *
 * @param products {Map<id, product>} — tovar ma'lumotlari (narx, birlik…)
 * @param groups   qo'shimcha guruhlari (`/modifiers`) — ID dan nom va narx
 * @return {items, missing} — `missing` — tovari topilmagan qatorlar soni
 *         (arxivlangan tovar): ular JIMGINA tashlanmaydi, kassirga aytiladi
 */
export function itemsFrom(order, products, groups) {
  const opts = new Map();
  for (const g of groups || []) for (const o of g.options || []) opts.set(Number(o.id), o);
  const items = [];
  let missing = 0;
  for (const l of order?.lines || []) {
    const p = products?.get?.(String(l.productId)) || products?.get?.(Number(l.productId));
    if (!p) { missing++; continue; }
    const mods = (l.modifierIds || []).map((id) => opts.get(Number(id))).filter(Boolean);
    const line = lineFor(p, mods);
    const it = { ...line, qty: Number(l.quantity), discount: Number(l.discount) || 0 };
    /* D3: mehmon, kurs, izoh va oshxonaga ketgani — kassa ham saqlaydi, aks
       holda to'lovdan oldingi bitta o'zgarish ularni o'chirib yuborardi. */
    if (l.seat) it.seat = Number(l.seat);
    if (l.course) it.course = Number(l.course);
    if (l.note) it.note = String(l.note);
    if (Number(l.sentQty) > 0) { it.sentQty = Number(l.sentQty); it.sentAt = l.sentAt || null; }
    if (it.seat || it.course || it.note) it._key = seatKey(it);
    items.push(it);
  }
  return { items, missing };
}

/** Stol necha daqiqadan beri band («45 daq»). */
export function minutesSince(iso, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : null;
}
