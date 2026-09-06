/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ HISOBOTI — QARZDORLIK BAYONNOMASI (V98)

   Do'kon egasining misoli:

       Aliyev Anvar
       Jami qarz: 1 250 000 · To'langan: 750 000 · Qoldiq: 500 000

       Sana    Chek     Qarz       To'lov      Qoldiq
       01.09   #1042    800 000    —           800 000
       03.09   #1058    450 000    —           1 250 000
       05.09   —        —          500 000     750 000

   ═══ ⚠ ISHORA YO'Q, USTUN BOR ══════════════════════════════════════════

   Jurnal oynasida summa IMZOLI ko'rsatiladi (qarz manfiy, to'lov
   musbat) — bu foydalanuvchining o'z talabi va u o'z joyida qoladi.
   Hisobotda esa yo'nalishni USTUNNING O'ZI aytadi, shuning uchun
   ishora keraksiz: «−800 000» ni «Qarz» ustuniga yozish o'quvchini
   «bu qarz kamaydimi?» degan savolga qo'yardi. Bank ko'chirmalari ham
   aynan shunday tuzilgan.

   ═══ ⚠ QOLDIQ QAYTA HISOBLANMAYDI ══════════════════════════════════════

   Har qatorning qoldig'i SERVERDAN keladi (`balanceAfter`) — u amal
   bajarilgan paytda MUZLATILGAN. Klientda yig'indi bilan qayta
   hisoblash mumkin edi, lekin o'shanda hisobot bazadagi haqiqatni
   emas, klientning taxminini ko'rsatardi. Mijozga beriladigan qog'oz
   esa tortishuvda dalil bo'ladi.
   ══════════════════════════════════════════════════════════════════════════ */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Jurnal qatorini hisobot qatoriga aylantiradi.
 *
 * ⚠ `ADJUSTMENT` ning summasi O'ZI IMZOLI: musbat — qarz oshdi
 * (qo'lda kiritilgan eski qarz), manfiy — kamaydi (kechirildi,
 * qaytarish). Shuning uchun u ishorasiga qarab tegishli ustunga
 * tushadi, alohida turga ajratilmaydi: mijoz uchun muhimi «qarzim
 * oshdimi yoki kamaydimi», uning ichki turi emas.
 */
export function statementRow(l) {
  const amount = num(l?.amount);
  const type = l?.type;
  let charge = 0, payment = 0;

  if (type === "PAYMENT") payment = Math.abs(amount);
  else if (type === "CHARGE") charge = Math.abs(amount);
  else if (amount >= 0) charge = amount;
  else payment = Math.abs(amount);

  return {
    id: l?.id,
    at: l?.createdAt,
    saleId: l?.saleId ?? null,
    reason: l?.reason || "",
    method: l?.paymentMethod || null,
    dueDate: l?.dueDate || null,
    charge,
    payment,
    /* ⚠ `null` — «server aytmadi», nol EMAS. Eski server bu maydonni
       yubormaydi va o'shanda ustun bo'sh qolishi kerak: nol yozish
       «qarzi qolmadi» degan YOLG'ON xabar bo'lardi. */
    balance: l?.balanceAfter == null ? null : num(l.balanceAfter),
  };
}

/**
 * To'liq hisobot: sarlavha raqamlari va qatorlar.
 *
 * @param ledger serverdan kelgan jurnal (yangisidan eskisiga)
 * @param range  `{ from, to }` — ISO sana (`YYYY-MM-DD`), ixtiyoriy
 */
export function buildStatement(ledger, range = {}) {
  /* ⚠ ESKISIDAN YANGISIGA. Server ro'yxatni teskari beradi (jurnal
     oynasi eng yangisini tepada ko'rsatadi), hisobot esa vaqt
     bo'yicha o'qiladi: qoldiq qatordan qatorga o'sib boradi. */
  const all = [...(ledger || [])]
    .map(statementRow)
    .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

  const from = range.from ? new Date(range.from + "T00:00:00") : null;
  const to = range.to ? new Date(range.to + "T23:59:59.999") : null;
  const inRange = (r) => {
    const d = new Date(r.at || 0);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const before = all.filter((r) => !inRange(r) && (!from || new Date(r.at || 0) < from));
  const rows = all.filter(inRange);

  /* ⚠ BOSHLANG'ICH QOLDIQ — davrdan OLDINGI oxirgi qatorning qoldig'i.
     Do'kon egasi uni alohida so'radi va u hisobotni YOPIQ qiladi:
     boshlang'ich + qarz − to'lov = yakuniy. Usiz o'quvchi «bu 500 000
     qayerdan chiqdi?» deb qolardi. */
  const opening = before.length ? (before[before.length - 1].balance ?? 0) : 0;

  const charge = rows.reduce((s, r) => s + r.charge, 0);
  const payment = rows.reduce((s, r) => s + r.payment, 0);

  /* ⚠ YAKUNIY QOLDIQ oxirgi qatorning MUZLATILGAN qiymatidan olinadi;
     server uni yubormagan bo'lsagina hisoblanadi. Ikkinchi yo'l —
     zaxira, birinchisi — haqiqat. */
  const last = rows.length ? rows[rows.length - 1].balance : null;
  const closing = last == null ? opening + charge - payment : last;

  return { rows, opening, charge, payment, closing };
}
