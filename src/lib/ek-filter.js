import { normSearch } from "./ek-search.js";

/* ══════════════════════════════════════════════════════════════════════════
   USTUNLAR BO'YICHA FILTR — SOF MANTIQ (V68)

   Do'kon egasi: «har bir mumkin bo'lgan sahifada professional filtr
   bo'lsin, unda barcha ustunlarni xohlaganday saralay olish imkoni
   bo'lsin — ekranda ko'ringan har bir ustun bilan filtr qila olsin».

   ═══ NEGA SOF FUNKSIYA ════════════════════════════════════════════════

   Filtr NOTO'G'RI ishlasa, ekranda YO'Q ma'lumot ko'rinadi yoki BOR
   ma'lumot yo'qoladi — ikkalasi ham jimgina yuz beradi va omborchi
   «tovar yo'q ekan» deb xulosa chiqaradi. Shuning uchun taqqoslash
   qoidalari React'dan ajratilgan va sinov bilan qulflangan
   (`test/filter.test.mjs`).

   ═══ USTUN TURLARI ════════════════════════════════════════════════════

     text   — ichida bor · aynan · boshlanadi · bo'sh · bo'sh emas
     number — = ≠ > ≥ < ≤ · oraliq
     date   — dan · gacha · oraliq (kun aniqligida)
     enum   — ro'yxatdan bir nechtasi (VA emas, YOKI: «naqd YOKI karta»)
     bool   — ha · yo'q

   ⚠ SHARTLAR «VA» BILAN BIRLASHADI: «qoldiq < 5» VA «nomi ichida sut».
   «YOKI» faqat `enum` ichida — u tabiiy ravishda «shulardan biri»
   degani. Aralash mantiq (qavslar, YOKI guruhlari) ATAYLAB YO'Q:
   omborchiga kerak emas, ekranni esa tushunarsiz qilardi.
   ══════════════════════════════════════════════════════════════════════════ */

/** Har tur uchun ruxsat etilgan amallar — UI shu ro'yxatdan chizadi. */
export const OPS = {
  text:   ["has", "eq", "starts", "empty", "notEmpty"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "between"],
  date:   ["from", "to", "between"],
  enum:   ["in"],
  bool:   ["isTrue", "isFalse"],
};

/** Amal qiymat talab qiladimi (`empty`, `isTrue` — yo'q). */
export const NEEDS_VALUE = new Set(
  ["has", "eq", "starts", "ne", "gt", "gte", "lt", "lte", "between", "from", "to", "in"]);
/** Ikkinchi qiymat (oraliq) kerakmi. */
export const NEEDS_SECOND = new Set(["between"]);

/* ── Solishtirish uchun tayyorlash ───────────────────────────────────── */

/**
 * ⚠ KASSA QIDIRUVINING AYNAN O'ZI (`ek-search.js`), o'z nusxasi EMAS.
 *
 * Filtr bilan qidiruv bir xil javob berishi SHART: «dokon» deb
 * qidirgan odam «Do'kon» ni topadi-yu, o'sha so'z bilan filtrlaganda
 * topa olmasa, ma'lumot «yo'q» bo'lib ko'rinardi. Bu yerda o'z
 * normalizatsiyasi yozilgan edi va u apostrofni TASHLAMASDAN
 * birxillashtirardi — natijada aynan shu farq chiqdi (sinovda
 * tutildi).
 *
 * `normSearch` apostrofning barcha shakllarini tashlaydi, kirillni
 * lotinga o'giradi va `x`/`h` ni tenglashtiradi.
 */
export const norm = (v) => normSearch(String(v ?? ""));

/** Raqamga keltirish: bo'sh va noto'g'ri qiymat — `null`. */
export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s| | /g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Sanani KUN aniqligida songa aylantiradi (`20260904`).
 *
 * ⚠ Vaqt QIRQILADI. «4-sentabrgacha» degan filtr o'sha kunning
 * o'zini ham qamrashi kerak: soat bilan solishtirilsa, 4-sentabr
 * 14:30 dagi yozuv «gacha» filtridan tushib qolardi va omborchi uni
 * yo'q deb hisoblardi.
 */
export const day = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

/* ── Bitta shart ──────────────────────────────────────────────────────── */

/**
 * Qator shu shartga mos keladimi.
 *
 * @param cond {{ key, type, op, value, value2 }}
 * @param get  ustun qiymatini beruvchi funksiya
 */
export function matchOne(cond, row, get) {
  const raw = get(row);
  const { type, op, value, value2 } = cond;

  if (type === "bool") {
    const b = raw === true || raw === "true" || raw === 1;
    return op === "isTrue" ? b : !b;
  }

  if (type === "enum") {
    /* ⚠ Bo'sh tanlov — HAMMASI. Bitta ham band tanlanmagan filtr
       «hech narsa ko'rsatma» degani emas: foydalanuvchi tanlashni
       endi boshlagan bo'lishi mumkin. */
    const list = Array.isArray(value) ? value : [];
    if (!list.length) return true;
    return list.some((v) => norm(v) === norm(raw));
  }

  if (type === "number") {
    const a = num(raw);
    const b = num(value);
    if (op === "between") {
      const c = num(value2);
      if (a === null) return false;
      if (b !== null && a < b) return false;
      if (c !== null && a > c) return false;
      return true;
    }
    if (a === null || b === null) return false;
    switch (op) {
      case "eq":  return a === b;
      case "ne":  return a !== b;
      case "gt":  return a > b;
      case "gte": return a >= b;
      case "lt":  return a < b;
      case "lte": return a <= b;
      default:    return true;
    }
  }

  if (type === "date") {
    const a = day(raw);
    if (a === null) return false;
    const b = day(value);
    const c = day(value2);
    if (op === "from")    return b === null || a >= b;
    if (op === "to")      return b === null || a <= b;
    if (op === "between") return (b === null || a >= b) && (c === null || a <= c);
    return true;
  }

  /* text */
  const s = norm(raw);
  if (op === "empty")    return s === "";
  if (op === "notEmpty") return s !== "";
  const q = norm(value);
  if (q === "") return true;          // yozilmagan shart hech narsani kesmaydi
  if (op === "eq")     return s === q;
  if (op === "starts") return s.startsWith(q);
  return s.includes(q);               // `has`
}

/**
 * Hamma shartlarni qo'llaydi (VA).
 *
 * @param conds shartlar ro'yxati
 * @param cols  ustunlar ta'rifi (`key` → `get`)
 */
export function applyFilters(rows, conds, cols) {
  if (!conds?.length) return rows;
  const byKey = new Map(cols.map((c) => [c.key, c]));
  const live = conds.filter((c) => {
    const col = byKey.get(c.key);
    if (!col) return false;
    if (!NEEDS_VALUE.has(c.op)) return true;
    if (c.type === "enum") return Array.isArray(c.value) && c.value.length > 0;
    /* ⚠ TO'LDIRILMAGAN shart HISOBGA OLINMAYDI: foydalanuvchi qatorni
       qo'shdi-yu, qiymatni hali yozmadi — bunda ro'yxat bo'shab
       qolmasligi kerak. Oraliqda esa BITTA chekka ham yetarli. */
    if (NEEDS_SECOND.has(c.op)) return c.value !== "" || c.value2 !== "";
    return c.value !== "" && c.value !== undefined && c.value !== null;
  });
  if (!live.length) return rows;
  return rows.filter((r) => live.every((c) => matchOne(c, r, byKey.get(c.key).get)));
}

/**
 * Saralash — ustun turiga qarab.
 *
 * ⚠ MATN `localeCompare` BILAN: oddiy `<` da «Z» «a» dan oldin kelardi
 * va ro'yxat ko'zga tasodifiy tartibda ko'rinardi. Raqam va sana esa
 * SON sifatida solishtiriladi — matn solishtiruvida «100» «9» dan
 * oldin chiqardi.
 */
export function applySort(rows, sort, cols) {
  if (!sort?.key) return rows;
  const col = cols.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === "desc" ? -1 : 1;
  const kind = col.type === "number" || col.type === "date" ? "num" : "text";

  return [...rows].sort((x, y) => {
    const a = col.get(x);
    const b = col.get(y);
    if (kind === "num") {
      const na = col.type === "date" ? day(a) : num(a);
      const nb = col.type === "date" ? day(b) : num(b);
      /* Bo'sh qiymat DOIM oxirida — yo'nalishdan qat'i nazar: «narxi
         yo'q» tovarlar ro'yxat boshini egallab olmasin. */
      if (na === null && nb === null) return 0;
      if (na === null) return 1;
      if (nb === null) return -1;
      return (na - nb) * dir;
    }
    const sa = norm(a);
    const sb = norm(b);
    if (sa === "" && sb === "") return 0;
    if (sa === "") return 1;
    if (sb === "") return -1;
    return sa.localeCompare(sb, "uz") * dir;
  });
}

/** Filtr + saralash — sahifalar shuni chaqiradi. */
export function applyAll(rows, conds, sort, cols) {
  return applySort(applyFilters(rows, conds, cols), sort, cols);
}

/** Ustun uchun bo'sh shart. */
export const blankCond = (col) => ({
  key: col.key,
  type: col.type || "text",
  op: (OPS[col.type || "text"] || OPS.text)[0],
  value: (col.type === "enum") ? [] : "",
  value2: "",
});
