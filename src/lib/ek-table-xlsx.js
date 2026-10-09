/* ══════════════════════════════════════════════════════════════════════════
   JADVAL → EXCEL QATORLARI (2026-10-09)

   Egasi: «har qanday jadval ko'rinishidagi ma'lumotni Excel'ga yuklab olish
   imkoni bo'lsin». Ikki manba:

     · `rowsFromCols` — sahifaning ustunlar ta'rifidan (DataFilter `COLS`:
       `{label, type, get, options}`). Sahifalab yuklanadigan ro'yxatda
       hamma qatorlar serverdan yig'iladi va shu ta'rif bilan yoziladi.
     · `rowsFromTable` — ekrandagi `<table>` ning o'zidan. Oddiy jadvallar
       uchun: nima ko'rinsa (filtr va saralashdan keyin) — o'sha.

   ⚠ RAQAM — RAQAM bo'lib yoziladi, matn emas: Excel'da qo'shib, saralab
   bo'lsin. «1 250 000 so'm», «−3», «12,5» → 1250000, −3, 12.5.
   ⚠ Shtrix-kod, telefon, «0» bilan boshlanadigan kod — MATN: raqamga
   aylansa Excel uni 5,9E+12 deb ko'rsatib, oxirgi xonalarini yo'qotardi.

   Bu fayl DOM ga faqat `rowsFromTable` da tegadi — qolgani node'da
   sinaladi (`test/table-xlsx.test.mjs`).
   ══════════════════════════════════════════════════════════════════════════ */

const SPACES = /[\s    ]/g;
const UNITS = /(so['ʻ’`]?m|сум|sum|uzs|dona|шт|kg|кг|ta)\.?$/i;

/**
 * Ekrandagi matn raqammi — bo'lsa son, bo'lmasa `null`.
 * Uzun raqamlar (≥ 12 xona) va «0» bilan boshlanganlar raqam EMAS.
 */
export function toNumber(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  let s = String(text ?? "").trim();
  if (!s || s === "—" || s === "-") return null;
  s = s.replace(UNITS, "").trim().replace(SPACES, "").replace(/^[−–]/, "-").replace(/^\+/, "");
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  const digits = s.replace(/^-/, "").split(/[.,]/)[0];
  if (digits.length >= 12 || (digits.length > 1 && digits[0] === "0")) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Bitta katak: raqam bo'lsa son, aks holda toza matn («—» — bo'sh). */
export function cell(text) {
  const n = toNumber(text);
  if (n != null) return n;
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s === "—" ? "" : s;
}

const pad = (n) => String(n).padStart(2, "0");
/** Sana — «YYYY-MM-DD HH:MM» (Excel uni o'zi taniydi va saralaydi). */
export function dateText(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return d.getHours() || d.getMinutes() ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

/**
 * Ustunlar ta'rifidan qatorlar. Ustun: `{label, type, get(row), options?, xlsx?(row)}`.
 * `xlsx` — Excel'ga boshqacha qiymat kerak bo'lsa (masalan yorliq).
 * Yashirin ustun (`hidden` yoki `xlsx === false`) yozilmaydi.
 */
export function rowsFromCols(cols, rows, { yes = "ha", no = "yo'q" } = {}) {
  const use = (cols || []).filter((c) => c && !c.hidden && c.xlsx !== false);
  const head = use.map((c) => ({ v: String(c.label ?? ""), bold: true }));
  const body = (rows || []).map((r) => use.map((c) => {
    const v = typeof c.xlsx === "function" ? c.xlsx(r) : c.get?.(r);
    if (v == null || v === "") return "";
    if (c.type === "number") return toNumber(v) ?? cell(v);
    if (c.type === "date") return dateText(v);
    if (c.type === "bool") return v ? yes : no;
    if (c.type === "enum" && Array.isArray(c.options)) {
      const o = c.options.find((x) => String(x.value) === String(v));
      return o ? String(o.label) : String(v);
    }
    return typeof v === "number" ? v : cell(v);
  }));
  return [head, ...body];
}

/**
 * Ekrandagi jadvaldan qatorlar.
 *
 * ⚠ Sarlavhasi bo'sh ustun (tugmalar, belgi) yozilmaydi. «Ma'lumot yo'q»
 * qatori (bitta katak, `colspan`) ham. Katak ichida `data-xlsx` bo'lsa —
 * matn o'rniga shu (masalan to'liq sana yoki xom raqam).
 */
export function rowsFromTable(table) {
  if (!table) return [];
  const headRow = table.tHead?.rows?.[table.tHead.rows.length - 1];
  const heads = headRow ? [...headRow.cells].map((c) => c.innerText.replace(/\s+/g, " ").trim()) : [];
  const keep = heads.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const pick = (cells) => {
    /* `colspan` li qatorlar ustunlarni suradi — ularni ochib, o'rniga bo'sh. */
    const flat = [];
    for (const c of cells) {
      const v = c.dataset?.xlsx ?? c.innerText;
      flat.push(v);
      for (let k = 1; k < (c.colSpan || 1); k++) flat.push("");
    }
    return keep.length ? keep.map((i) => cell(flat[i])) : flat.map(cell);
  };
  const out = keep.length ? [keep.map((i) => ({ v: heads[i], bold: true }))] : [];
  for (const sec of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])]) {
    for (const tr of sec.rows) {
      if (tr.cells.length === 1 && (tr.cells[0].colSpan || 1) > 1) continue;
      const row = pick(tr.cells);
      if (row.some((v) => v !== "")) out.push(row);
    }
  }
  return out;
}

/** Fayl nomi: «mijozlar-2026-10-09». */
export function fileName(name, now = new Date()) {
  const base = String(name || "jadval").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${base}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Sahifalab yuklanadigan ro'yxatning HAMMA qatori — SalesPage dagi sinalgan
 * sikl. `getPage(page, size)` → javob (`{content,total}` yoki massiv).
 * ⚠ Cheklov oshsa `null` (chaqiruvchi «juda ko'p» deydi); server bir xil
 * sahifani qaytarsa sikl to'xtaydi.
 */
export async function collectPages(getPage, { size = 200, cap = 20000 } = {}) {
  const out = [];
  for (let page = 0; page < Math.ceil(cap / size) + 1; page++) {
    const r = await getPage(page, size);
    const d = r?.data ?? r;
    /* ⚠ JAVOB SHAKLLARI HAR XIL: massiv, `{content, total}` (`Paging`) va
       `{items, totalItems}` (audit). Biri tanilmasa eksport JIMGINA bo'sh
       chiqardi — audit aynan shunday edi. */
    const got = Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content
              : Array.isArray(d?.items) ? d.items : [];
    const total = Array.isArray(d) ? null : Number(d?.total ?? d?.totalElements ?? d?.totalItems);
    if (Number.isFinite(total) && total > cap) return null;
    out.push(...got);
    if (got.length < size || (Number.isFinite(total) && out.length >= total)) break;
    if (out.length > cap) return null;
  }
  return out;
}
