/* ══════════════════════════════════════════════════════════════════════════
   BO'NAK CHEKIDA FISKAL BELGI CHIQMAYDI + QR KAMIDA 30 mm (V85)

   ═══ NEGA IKKALASI BIR FAYLDA ══════════════════════════════════════════

   Ikkalasi ham 943-son qarorning CHEK KO'RINISHIGA oid talabi va
   ikkalasi ham JIMGINA buziladi: chek chiqadi, hech qanday xato
   ko'rinmaydi — faqat biri qonunga zid belgi bilan, ikkinchisi
   o'qib bo'lmaydigan darajada kichik QR bilan.
   ══════════════════════════════════════════════════════════════════════════ */
import { FISCAL_RECEIPT_TYPES, isFiscalReceipt } from "../src/lib/ek-receipt-type.js";
import { qrModuleSize, qrSizeMm, modulesFor, MIN_QR_MM } from "../src/lib/ek-qr-size.js";

let bad = 0;
const ok = (m) => console.log("  ✅ " + m);
const no = (m, got) => { bad++; console.log(`  ❌ ${m}  →  ${got}`); };
const eq = (m, a, b) => (a === b ? ok(m) : no(m, `${a} ≠ ${b}`));

console.log("\n══ CHEK TURI VA FISKAL BELGI ══");

/* ⚠ Ro'yxat SERVERDAGI `SaleType.isFiscalDocument()` NING JUFTI.
   Ikkalasi bir xil bo'lishi shart — biri o'zgarib, ikkinchisi
   qolsa, chek serverda fiskal, frontda esa fiskal emas bo'lardi
   (yoki teskarisi) va farq faqat qog'ozda ko'rinardi. */
for (const t of ["ADVANCE", "INSTALLMENT", "CREDIT"]) {
  if (FISCAL_RECEIPT_TYPES.has(t)) {
    no(`⚠ «${t}» chekida fiskal belgi CHIQADI — 943-qarorning buzilishi`, "ro'yxatda");
  } else {
    ok(`«${t}» chekida fiskal belgi chiqmaydi`);
  }
}
for (const t of ["SALE", "RETURN", "CORRECTION"]) {
  if (FISCAL_RECEIPT_TYPES.has(t)) ok(`«${t}» — fiskal hujjat`);
  else no(`⚠ «${t}» fiskal belgisiz qoldi`, "ro'yxatda yo'q");
}
eq("ro'yxatda aynan uchta tur bor", FISCAL_RECEIPT_TYPES.size, 3);

console.log("\n══ QR O'LCHAMI (kamida 30 mm) ══");

/* ⚠ HAVOLA UZUNLIGI TURLICHA BO'LADI va aynan shu yerda xato bor edi:
   standart `size=8` bilan UZUN havola ~33 mm chiqardi (talab
   bajarilardi), QISQA havola esa atigi 21 mm — va buni hech kim
   sezmasdi. */
const URLS = [
  "https://ofd.uz/c/1",                                    // juda qisqa
  "https://ofd.soliq.uz/check?t=123456789012",             // o'rtacha
  "https://ofd.soliq.uz/check?t=123456789012&r=987654321&s=1234567890123456",
  "https://ofd.soliq.uz/check?t=123456789012&r=987654321&s=1234567890123456&x=" + "a".repeat(80),
];

for (const paper of [58, 80]) {
  for (const url of URLS) {
    const mm = qrSizeMm(url, paper);
    const label = `${paper} mm qog'oz, ${url.length} belgili havola → ${mm.toFixed(1)} mm`;
    if (mm >= MIN_QR_MM) ok(label);
    else no(`⚠ QR TALABDAN KICHIK: ${label}`, `${mm.toFixed(1)} < ${MIN_QR_MM}`);
  }
}

console.log("\n══ QR qog'ozdan oshib ketmaydi ══");
/* ⚠ Printer ortiqchani QIRQADI va yarim QR umuman o'qilmaydi — bu
   kichik QR dan ham yomon natija. */
const PRINTABLE = { 58: 48, 80: 72 };
for (const paper of [58, 80]) {
  for (const url of URLS) {
    const mm = qrSizeMm(url, paper);
    if (mm <= PRINTABLE[paper]) ok(`${paper} mm: ${mm.toFixed(1)} mm sig'di`);
    else no(`⚠ QR qog'ozdan KENG: ${paper} mm`, `${mm.toFixed(1)} > ${PRINTABLE[paper]}`);
  }
}

console.log("\n══ Modul kattaligi chegaralari ══");
for (const url of URLS) {
  const size = qrModuleSize(url, 80);
  if (size >= 1 && size <= 16) ok(`modul ${size} — ESC/POS chegarasida (1..16)`);
  else no("⚠ modul kattaligi ESC/POS chegarasidan tashqarida", size);
}
/* ⚠ Bo'sh matn ham yiqilmasligi kerak: chek qurilayotganda havola
   hali kelmagan bo'lishi mumkin. */
eq("bo'sh matnda ham modul soni bor", modulesFor("") > 0, true);

console.log(`\n${bad ? "❌" : "✅"} fiskal chek: ${bad ? bad + " yiqildi" : "hammasi o'tdi"}`);
process.exit(bad ? 1 : 0);
