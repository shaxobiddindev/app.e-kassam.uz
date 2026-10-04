/* ══════════════════════════════════════════════════════════════════════════
   DAFTARDAN KO'CHIRISH — matnni qatorlarga ajratish (2026-10-04)

   Egasi: «ba'zi do'konlarda qarzlar daftarga yozilgan — shuni tizimga
   ko'chirish imkoni qo'sh. Daftarni tizim o'zi o'qishi shart emas.»
   Qarori: telefonsiz ham kiritiladi; jadvalga ketma-ket yoziladi YOKI
   Excel'dan nusxalab qo'yiladi.

   Bu fayl — qo'yilgan matndan qatorlar yasash va qatorni tekshirish.
   React ham, brauzer ham yo'q: `node test/debt-import.test.mjs` sinaydi.

   ⚠ USTUNLAR TARTIBI TAXMIN QILINMAYDI — ANIQLANADI. Har do'konning
   jadvali boshqacha: biri «Ism | Summa», boshqasi «Sana | Ism | Tel |
   Qarz». Avval sarlavha qatori qidiriladi («Ism», «Telefon», «Summa»…);
   bo'lmasa har ustun MAZMUNIGA qarab aniqlanadi (sanaga o'xshaganlar,
   telefonga o'xshaganlar, harfli matn). Tartibni qattiq yozish
   ikkinchi do'konda summani telefon ustuniga tushirardi.

   ⚠ BITTA USTUNLI MATN HAM QABUL QILINADI: daftar ko'pincha telefonda
   «Ali aka - 150 000» ko'rinishida yozilgan bo'ladi. Qatordan sana,
   telefon va OXIRGI son ajratiladi, qolgani — ism.
   ══════════════════════════════════════════════════════════════════════════ */
import { phoneInput } from "./ek-input.js";

/** Bir so'rovda ko'pi bilan — server ham shuni kutadi (`@Size(max = 500)`). */
export const MAX_ROWS = 500;

const LETTER = /\p{L}/u;

/** Ism solishtirish kaliti: bo'shliqlar yig'iladi, katta-kichik farq qilmaydi. */
export const normName = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/* ══ Summa ══════════════════════════════════════════════════════════════ */

/* «150 ming», «1,5 mln», «150k» — daftarda shunday yoziladi. */
const MULT = [
  [/(mln|million|миллион|млн|m)$/i, 1e6],
  [/(ming|тыс\.?|тысяч[аи]?|k|т)$/i, 1e3],
];

/**
 * «150 000», «150,000», «150.000», «1 500 000 so'm», «150 ming» → son.
 * Topilmasa `null`. So'm butun — tiyin yaxlitlanadi.
 *
 * ⚠ AJRATGICH IKKI MA'NOLI: «150.000» Excel'da ham, daftarda ham — yuz
 * ellik MING, o'nlik kasr emas. Qoida: ajratgichdan keyin aynan 3 ta
 * raqam turgan har bir guruh — minglik; oxirgi guruh 1–2 raqam bo'lsa —
 * kasr. Shunda «1.500.000» ham, «150000.50» ham to'g'ri o'qiladi.
 */
export function parseAmount(raw) {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/so['ʻ‘’`]?m|сум|sum|uzs/g, "").replace(/[\s\u00a0\u202f]+/g, "");
  let mult = 1;
  for (const [re, m] of MULT) {
    if (re.test(s)) { s = s.replace(re, ""); mult = m; break; }
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const groups = s.split(/[.,]/);
  let num;
  if (groups.length === 1) {
    num = Number(s);
  } else {
    const last = groups[groups.length - 1];
    const middleOk = groups.slice(1, -1).every((g) => g.length === 3);
    if (middleOk && last.length === 3 && mult === 1) {
      num = Number(groups.join(""));                       // 150.000 · 1 500,000
    } else if (middleOk && last.length >= 1 && last.length <= 2) {
      num = Number(groups.slice(0, -1).join("") + "." + last);  // 150000,50 · 1,5 mln
    } else if (groups.length === 2 && mult !== 1) {
      num = Number(groups[0] + "." + last);                // 1.25 mln
    } else {
      return null;
    }
  }
  if (!Number.isFinite(num)) return null;
  const v = Math.round(num * mult);
  return v > 0 ? v : null;
}

/* ══ Sana ═══════════════════════════════════════════════════════════════ */

const pad = (n) => String(n).padStart(2, "0");
/** `YYYY-MM-DD` mahalliy vaqtda — `<input type="date">` shu ko'rinishni kutadi. */
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daysAgo = (n, now = new Date()) => {
  const d = new Date(now); d.setDate(d.getDate() - n); return isoDay(d);
};
/** `2026-10-04` → `04.10.2026` — jadvalda sana shu ko'rinishda yoziladi. */
export const showDay = (iso) => (iso ? iso.split("-").reverse().join(".") : "");

function real(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? isoDay(dt) : null;
}

/**
 * «04.10.2026», «4/10/26», «2026-10-04», «04.10» → `YYYY-MM-DD`; aks holda `null`.
 *
 * @param loose «04.10» (yilsiz) ham qabul qilinsinmi. ⚠ Faqat ustun ALLAQACHON
 *   sana deb aniqlanganda: aks holda «15.10» summasi 15-oktabrga aylanardi.
 *   Yilsiz sana kelajakka tushsa — o'tgan yil (daftar o'tmishni yozadi).
 */
export function parseDate(raw, { loose = false, now = new Date() } = {}) {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return real(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return real(y, +m[2], +m[1]);
  }
  if (loose) {
    m = s.match(/^(\d{1,2})[./-](\d{1,2})$/);
    if (m) {
      const iso = real(now.getFullYear(), +m[2], +m[1]);
      if (iso && iso > isoDay(now)) return real(now.getFullYear() - 1, +m[2], +m[1]);
      return iso;
    }
  }
  return null;
}

/* ══ Telefon ════════════════════════════════════════════════════════════ */

/* «+998 90 123-45-67», «(90) 123 45 67», «901234567», «998901234567». */
const PHONE_SHAPE = /^\+?\s*(998)?[\s-]*\(?\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$/;

/** Telefonga o'xshasa — `+998XXXXXXXXX`, aks holda `null`. */
export function parsePhone(raw) {
  const s = String(raw ?? "").trim();
  if (!PHONE_SHAPE.test(s)) return null;
  const p = phoneInput(s);
  return p.valid ? p.raw : null;
}

/* ══ Qo'yilgan matn ═════════════════════════════════════════════════════ */

/** Excel nusxasi: ustunlar TAB bilan, qatorlar yangi qator bilan; qo'shtirnoq ichida yangi qator bo'lishi mumkin. */
function splitTsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

/* ⚠ SO'Z OXIRI SHART: «Ismoil aka» ham /^ism/ ga tushardi va birinchi
   qarzdor sarlavha deb tashlab yuborilardi. */
const word = (alts) => new RegExp(`^(${alts})(?=$|[\\s.:*(/№-])`, "i");
const HEAD = {
  name: word("ism|ismi|f\\.?i\\.?o\\.?|fio|mijoz|xaridor|qarzdor|name|customer|имя|фио|клиент|покупатель|должник"),
  phone: word("tel|telefon|phone|mobile|телефон|тел"),
  amount: word("summa|summasi|qarz|qarzi|miqdor|nasiya|amount|debt|sum|сумма|долг"),
  date: word("sana|sanasi|kun|qachon|date|when|дата|число"),
  note: word("izoh|eslatma|tovar|nima|note|comment|примечание|комментарий|товар"),
};

function headerMap(cells) {
  /* Sarlavhada summa bo'lmaydi — bo'lsa, bu ma'lumot qatori. */
  if (cells.some((c) => parseAmount(c) !== null)) return null;
  const map = {};
  cells.forEach((c, i) => {
    for (const [k, re] of Object.entries(HEAD)) {
      if (map[k] === undefined && re.test(c.trim())) { map[k] = i; break; }
    }
  });
  return map.name !== undefined || map.amount !== undefined ? map : null;
}

const ratio = (rows, i, test) => {
  const cells = rows.map((r) => r[i] ?? "").filter(Boolean);
  return cells.length ? cells.filter(test).length / cells.length : 0;
};

/* Ustunni MAZMUNIGA qarab aniqlash. Tartib muhim: sana va telefon avval —
   ular summaga ham «o'xshaydi», summa esa ularga o'xshamaydi. */
function guessColumns(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  const free = new Set(Array.from({ length: width }, (_, i) => i));
  const pick = (test, min) => {
    let best = -1, score = min;
    for (const i of free) {
      const r = ratio(rows, i, test);
      if (r >= score && (best < 0 || r > score)) { best = i; score = r; }
    }
    if (best >= 0) free.delete(best);
    return best >= 0 ? best : undefined;
  };
  const map = {};
  map.date = pick((c) => parseDate(c) !== null, 0.6);
  /* «+998 12» — chala, lekin baribir TELEFON urinishi: ustun shu bilan
     aniqlanmasa, qiymat hech qaysi maydonga tushmay jim yo'qolardi. */
  map.phone = pick((c) => parsePhone(c) !== null || /^\+\s*\d|^998/.test(c.trim()), 0.6);
  map.amount = pick((c) => parseAmount(c) !== null, 0.6);
  map.name = pick((c) => LETTER.test(c), 0.5);
  map.note = pick((c) => LETTER.test(c), 0.3);
  return map;
}

/* Bitta ustunli qator: «Ali aka 90 123 45 67 — 150 000 (12.09.2026) un».
   Sana va telefon avval olinadi (ular ham raqam), keyin summa; summadan
   oldingisi — ism, keyingisi — izoh. */
function parseLine(line) {
  let s = ` ${line} `;
  const out = { name: "", phone: "", amount: "", date: "", note: "" };

  const dm = s.match(/\s\(?(\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})|\d{4}-\d{1,2}-\d{1,2})\)?(?=\s)/);
  if (dm && parseDate(dm[1])) { out.date = showDay(parseDate(dm[1])); s = s.replace(dm[0], " "); }

  const pm = s.match(/(?<!\d)(\+?998[\s-]*)?\(?\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?=\D|$)/);
  if (pm && parsePhone(pm[0])) { out.phone = parsePhone(pm[0]); s = s.replace(pm[0], " "); }

  /* ⚠ Minglik guruh FAQAT 3 raqamli: «150 000 2 kg» bitta son
     (1 500 002) bo'lib qo'shilib ketmasin. Bir nechta son bo'lsa —
     ENG KATTASI qarz: «Ali 150 000 (2 ta non)» da 2 — miqdor. */
  const am = [...s.matchAll(/(?<![\d\p{L}])(\d{1,3}(?:[\s\u00a0.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)(?:\s*(?:mln|million|млн|ming|тыс|k|so['ʻ‘’`]?m|сум|sum)(?!\p{L}))*/giu)]
    .filter((m) => parseAmount(m[0]) !== null)
    .sort((a, b) => parseAmount(b[0]) - parseAmount(a[0]))[0];
  if (am) {
    out.amount = String(parseAmount(am[0]));
    const tail = s.slice(am.index + am[0].length).replace(/^[\s\-–—:;,.]+/, "").trim();
    s = s.slice(0, am.index);
    if (tail) out.note = tail;
  }
  out.name = s.replace(/[\s\-–—:;,.]+$/, "").replace(/^[\s\-–—:;,.\d)]+/, "").trim();
  return out;
}

/**
 * Qo'yilgan matn → qatorlar `{ name, phone, amount, date, note }` (hammasi matn,
 * jadval maydonlariga to'g'ridan-to'g'ri tushadi).
 *
 * @returns {{ rows: object[], header: boolean, columns: object|null }}
 */
export function parsePaste(text, { now = new Date() } = {}) {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n");
  const grid = splitTsv(raw);
  if (!grid.length) return { rows: [], header: false, columns: null };

  if (grid.every((r) => r.length === 1)) {
    return { rows: grid.map((r) => parseLine(r[0])).filter((r) => r.name || r.amount), header: false, columns: null };
  }

  const head = headerMap(grid[0]);
  const body = head ? grid.slice(1) : grid;
  const cols = head || guessColumns(body);
  const at = (r, k) => (cols[k] === undefined ? "" : r[cols[k]] ?? "");

  const rows = body.map((r) => {
    const amount = parseAmount(at(r, "amount"));
    const phoneRaw = at(r, "phone");
    return {
      name: at(r, "name").replace(/\s+/g, " "),
      /* ⚠ Telefon ustunidagi buzuq qiymat TASHLANMAYDI — maydonda qoladi
         va qator xato bo'lib ko'rinadi. Jim o'chirilsa, do'koncha
         raqamni yozgan-u, u yo'qolganini sezmasdi. */
      phone: parsePhone(phoneRaw) || phoneRaw,
      amount: amount === null ? at(r, "amount") : String(amount),
      date: showDay(parseDate(at(r, "date"), { loose: true, now })) || at(r, "date"),
      note: at(r, "note"),
    };
  }).filter((r) => r.name || r.amount || r.phone);
  return { rows, header: !!head, columns: cols };
}

/* ══ Qatorni tekshirish ═════════════════════════════════════════════════ */

/** Butunlay bo'sh qator — e'tiborga olinmaydi (jadval oxiridagi yangi qator). */
export const isBlank = (r) => !String(r.name ?? "").trim() && !String(r.phone ?? "").trim()
  && !String(r.amount ?? "").trim() && !String(r.note ?? "").trim();

/**
 * Qator xatolari: `{ name?, phone?, amount?, date? }` — qiymati locale kaliti.
 * Bo'sh obyekt — qator to'g'ri. Server ham xuddi shu qoidalarni tekshiradi
 * (`CustomerService.manualDebtError`); bu yerda — saqlashdan OLDIN ko'rsatish uchun.
 */
export function rowErrors(r, { now = new Date() } = {}) {
  const e = {};
  if (!String(r.name ?? "").trim()) e.name = "dimp.errName";
  else if (r.name.trim().length > 150) e.name = "dimp.errNameLong";
  const phone = String(r.phone ?? "").trim();
  if (phone && !phoneInput(phone).valid) e.phone = "dimp.errPhone";
  const amount = parseAmount(r.amount);
  if (amount === null) e.amount = "dimp.errAmount";
  if (r.date) {
    const d = parseDate(r.date, { loose: true, now });
    if (!d) e.date = "dimp.errDate";
    else if (d > isoDay(now)) e.date = "dimp.errFuture";
  }
  return e;
}

/**
 * Jadval qatorini server so'roviga aylantirish.
 * ⚠ Sana KUN sifatida keladi; kunning BOSHI olinadi — kechqurun
 * kiritilgan «bugungi» qarz hisoblanishni bir kunga kechiktirmasin.
 */
export function toPayload(r, defaultDate, { now = new Date() } = {}) {
  const day = (r.date && parseDate(r.date, { loose: true, now })) || defaultDate;
  const phone = String(r.phone ?? "").trim();
  return {
    fullName: r.name.trim().replace(/\s+/g, " "),
    phone: phone ? phoneInput(phone).raw : null,
    amount: parseAmount(r.amount),
    takenAt: new Date(`${day}T00:00:00`).toISOString(),
    reason: String(r.note ?? "").trim() || null,
  };
}
