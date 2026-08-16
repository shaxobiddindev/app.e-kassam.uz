import { qrSvg } from "../lib/ek-qr";

/* ══════════════════════════════════════════════════════════════════════════
   DO'KON QR PLAKATI — devorga osiladigan A4 (V36)

   Chop etish uchun alohida oyna ochiladi: sahifa ichida chop etish
   `@media print` bilan qilinganda kassa interfeysining qoldiqlari
   (yon menyu, tugmalar) qog'ozga chiqib ketardi — chek chop etishda
   ham aynan shu sababdan alohida oyna ishlatiladi (`ek-hardware.js`).

   ⚠ PLAKATDAGI QR AYLANMAYDI. Kassadagi QR har 30 soniyada yangilanadi
   va aynan shu «odam do'konda turibdi» degan kafolatni beradi. Qog'ozda
   esa bunday kafolat YO'Q — shuning uchun plakat alohida yoqiladi va
   uning havolasi boshqa (o'zgarmas imzo bilan).
   ══════════════════════════════════════════════════════════════════════════ */

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Plakatni yangi oynada ochadi va chop etish oynasini chaqiradi.
 *
 * @param {object} p
 * @param {string} p.url       QR ga yoziladigan havola (o'zgarmas plakat havolasi)
 * @param {string} p.shopName  do'kon nomi
 */
export function printQrPoster({ url, shopName }) {
  const win = window.open("", "_blank", "width=820,height=1100");
  if (!win) throw new Error("Chop etish oynasi ochilmadi");

  /* QR KATTA: plakat devorda turadi va uni 1.5–2 metrdan skanerlashadi.
     Kichik QR bunday masofada umuman o'qilmaydi. */
  const qr = qrSvg(url, { size: 520, margin: 1 });

  win.document.write(`<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
<title>${esc(shopName)} — mijozlar kartasi</title>
<style>
  /* ⚠ A4 va nol chekka: brauzer standart chekkasi bilan QR kichrayib,
     sahifaga do'kon nomi ham, yo'riqnoma ham sig'masdi. */
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm; height: 297mm;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10mm;
    padding: 18mm 14mm;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #0F172A; text-align: center;
    /* Fon rangi chop etilsin — aks holda ramka oq qog'ozda yo'qoladi */
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .shop { font-size: 30pt; font-weight: 800; letter-spacing: -0.5pt; }
  .lead { font-size: 15pt; color: #475569; max-width: 150mm; line-height: 1.45; }
  .qr {
    padding: 8mm; background: #FFFFFF;
    border: 3pt solid #1663D8; border-radius: 6mm;
  }
  .qr svg { display: block; width: 120mm; height: 120mm; }
  .steps {
    display: flex; gap: 8mm; justify-content: center;
    margin-top: 2mm; font-size: 12pt; color: #334155;
  }
  .step { max-width: 48mm; }
  .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 9mm; height: 9mm; margin-bottom: 2mm;
    background: #1663D8; color: #FFFFFF;
    border-radius: 50%; font-weight: 700; font-size: 12pt;
  }
  .foot { margin-top: 4mm; font-size: 10pt; color: #94A3B8; }
  .bonus { font-size: 17pt; font-weight: 700; color: #1663D8; }
</style></head><body>
  <div class="shop">${esc(shopName)}</div>
  <div class="bonus">Mijozlar kartasi — har xariddan ball</div>
  <div class="lead">
    Telefoningiz kamerasini QR kodga tuting va bir daqiqada ro'yxatdan o'ting.
    Ballaringiz va barcha cheklaringiz telefoningizda saqlanadi.
  </div>

  <div class="qr">${qr}</div>

  <div class="steps">
    <div class="step"><span class="num">1</span><div>Kamerani QR ga tuting</div></div>
    <div class="step"><span class="num">2</span><div>Ism va telefon raqamingizni yozing</div></div>
    <div class="step"><span class="num">3</span><div>Kassada kartangizni ko'rsating</div></div>
  </div>

  <div class="foot">e-kassam.uz</div>
</body></html>`);
  win.document.close();

  // Bir kadr — tizim shrifti ishlatilgani uchun kutish shart emas
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 80);
}

export default printQrPoster;
