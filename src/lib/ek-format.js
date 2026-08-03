/* ==========================================================================
   e-Kassam — formatlash (02-DESIGN-SYSTEM.md → "Formatlash")

   Qoida: komponentda `toLocaleString` TO'G'RIDAN-TO'G'RI chaqirilmaydi.
   Faqat shu fayldagi funksiyalar. Sabab: razryad ajratgichi, o'nlik xonalar
   va sana ko'rinishi butun mahsulotda bir xil bo'lishi shart.

   MANBA FAYL — packages/ui/ da tahrirlanadi, sync-tokens.ps1 tarqatadi.

   ⚠ Chetlanish: 01-ARCHITECTURE.md pulni tiyin (butun son) sifatida saqlashni
   talab qiladi. Hozirgi backend so'mni BigDecimal da qaytaradi. Formatlash shu
   sababli so'm ustida ishlaydi; tiyinga o'tish alohida backend migratsiyasi
   (docs/09-CHETLANISHLAR.md ga qarang).
   ========================================================================== */

const NNBSP = " ";           // tor bo'shliq — razryad ajratgichi
const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const pad = (n) => String(n).padStart(2, "0");

/**
 * Razryadlarni tor bo'shliq bilan ajratadi: 1 240 000
 *
 * Intl.NumberFormat ATAYLAB ishlatilmaydi: "uz-UZ" lokali brauzerga qarab
 * vergul ham, nuqta ham, oddiy bo'shliq ham qaytarishi mumkin. Ajratgich
 * mahsulotning hamma joyida bir xil bo'lishi shart (02-DESIGN-SYSTEM.md),
 * shuning uchun guruhlash qo'lda bajariladi.
 */
export function groupDigits(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  const sign = num < 0 ? "-" : "";
  return sign + String(Math.round(Math.abs(num))).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

/**
 * Pul. Valyuta belgisi ATAYLAB qo'shilmaydi — 02-DESIGN-SYSTEM.md bo'yicha
 * u ustun sarlavhasida turadi. Kerak bo'lganda `withUnit` bilan chaqiriladi.
 */
export function money(n, { withUnit = false } = {}) {
  const s = groupDigits(n);
  return withUnit ? `${s}${NNBSP}so'm` : s;
}

/** Miqdor: butun yoki 3 xonagacha (24 · 1.250) */
export function qty(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num)
    ? groupDigits(num)
    : num.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/** Foiz, 1 xona: 21.4% */
export function percent(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(1)}%`;
}

/** Sana: 2-avgust 2026 */
export function date(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Jadval uchun sana+vaqt: 02.08.2026 14:32 */
export function dateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Faqat vaqt: 14:32 */
export function time(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Telefon: +998 90 123 45 67 */
export function phone(v) {
  const digits = String(v || "").replace(/\D/g, "").replace(/^998/, "");
  if (digits.length !== 9) return v || "—";
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

/** Ism-familiyadan bosh harflar */
export function initials(s = "") {
  return (s || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}
