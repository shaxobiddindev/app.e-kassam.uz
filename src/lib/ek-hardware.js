/* ══════════════════════════════════════════════════════════════════════════
   Kassa apparatlari — chek printeri, pul yashigi, skaner

   Bitta qoida: kassir uchun har amal BITTA harakat bo'lsin. Sotuv yakunlandi →
   chek chiqdi, yashik ochildi. Dialog yo'q, tanlash yo'q, kutish yo'q.

   Uch xil ulanish qo'llab-quvvatlanadi va ular bir xil baytlarni oladi:

     windows  — Windows drayveri orqali RAW (Xprinter XP-80 shunday ulangan).
                Eng ishonchli: drayver USB/COM/LPT farqini o'zi yashiradi.
     tcp      — tarmoq printeri, 9100-port. Wi-Fi/Ethernet modellar uchun.
     browser  — Tauri'siz ishlaganda zaxira: HTML + `window.print()`.
                Dialog ochiladi va yashik ochilmaydi — bu KUTILGAN cheklov,
                brauzerdan apparatga to'g'ridan-to'g'ri kirish yo'q.

   ⚠ Sozlamalar `localStorage` da, SERVERDA emas: printer shu KOMPYUTERGA
   tegishli, hisobga emas. Bir do'konda ikkita kassa bo'lsa, har biri o'z
   printerini ko'rsatadi.
   ══════════════════════════════════════════════════════════════════════════ */

import { isDesktop, invoke } from "./ek-desktop";
import { Receipt, WIDTH_80, WIDTH_58, drawerKickBytes } from "./ek-escpos";
import { t } from "./ek-i18n";
import { money, quantity } from "../utils";
import { paymentLabel, unitLabel } from "./ek-labels";

const KEY = "ek_hw";

const DEFAULTS = {
  transport:   "windows",  // "windows" | "tcp" | "browser"
  printerName: "",         // windows: drayver nomi
  host:        "",         // tcp: IP
  port:        9100,
  width:       80,         // 80 | 58 (mm)
  autoPrint:   true,       // sotuv yakunlanganda chek o'zi chiqsin
  openDrawer:  true,       // naqd to'lovda yashik ochilsin
  scanner:     true,       // global barkod tutish
};

/* ── Sozlamalar ────────────────────────────────────────────────────────── */
export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  // Sozlama o'zgarishi ochiq ekranlarga yetib borsin (Sozlamalar va Kassa
  // bir vaqtda ochiq bo'lishi mumkin).
  window.dispatchEvent(new CustomEvent("ek:hw", { detail: next }));
  return next;
}

/** Windows drayverlari ro'yxati. Brauzerda — bo'sh massiv. */
export async function listPrinters() {
  if (!isDesktop()) return [];
  try {
    return (await invoke("list_printers")) || [];
  } catch (_) {
    return [];
  }
}

/* ── Baytlarni yuborish ────────────────────────────────────────────────── */
/**
 * Tayyor ESC/POS baytlarini tanlangan ulanish orqali yuboradi.
 * Xatoni YUTMAYDI — chaqiruvchi kassirga ko'rsatishi kerak: chek chiqmagani
 * jimgina o'tib ketadigan narsa emas.
 */
/**
 * Amaldagi ulanish turi.
 *
 * ⚠ Desktop'da "browser" QAYTARILMAYDI. `window.open` Tauri oynasida
 * ishlamaydi — u bo'sh OS oynasini ochadi va unga yozib bo'lmaydi, natijada
 * ekranda OQ OYNA qoladi va chek umuman chiqmaydi. Sozlamada tasodifan
 * tanlangan bo'lsa ham, printerga to'g'ridan-to'g'ri yuborish afzal.
 */
function transportOf(s) {
  if (!isDesktop()) return "browser";
  return s.transport === "tcp" ? "tcp" : "windows";
}

async function send(bytes) {
  const s = getSettings();
  if (!isDesktop()) throw new Error(t("hw.errNoDesktop"));

  if (transportOf(s) === "tcp") {
    if (!s.host) throw new Error(t("hw.errNoHost"));
    return invoke("print_tcp", { host: s.host, port: Number(s.port) || 9100, data: bytes });
  }
  return invoke("print_raw", { printer: s.printerName || null, data: bytes });
}

/* ── Chek ──────────────────────────────────────────────────────────────── */
/**
 * Chekni ESC/POS baytlariga yig'adi.
 *
 * Alohida funksiya — sinash uchun ham, oldindan ko'rish uchun ham shu
 * ishlatiladi. "Sinov cheki" bilan haqiqiy chek turli kod bo'lsa, sinov
 * o'tib, haqiqiysi buzilib chiqishi mumkin edi.
 */
export function buildReceipt({ saleId, cart = [], total = 0, payType, customer, offline, shopName, cashier, fiscal }) {
  const s = getSettings();
  const r = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);

  r.center().double().line(shopName || "E-KASSAM.UZ").double(false);
  r.line(t("kassa.receiptSystem"));
  r.left().rule();

  r.row(`${t("kassa.receiptNo")} ${saleId ?? "-"}`, new Date().toLocaleString("uz-UZ"));
  if (cashier) r.row(t("kassa.receiptCashier"), cashier);
  r.rule();

  for (const i of cart) {
    // Tovar nomi ALOHIDA qatorda: uzun nomlar narx ustuniga bosim qilmasin.
    r.wrap(i.name);
    // Miqdor birligi bilan: "0.35 kg x 95 000". Birliksiz "0.35 x 95 000"
    // mijozga nima sotilganini aytmasdi.
    const qtyText = `${quantity(i.qty, i.unitDecimals)}${i.unit ? " " + unitLabel(i.unit) : ""}`;
    r.row(`  ${qtyText} x ${money(i.salePrice)}`, money(i.salePrice * i.qty));
  }

  r.rule();
  r.bold().double().row(t("kassa.receiptTotal"), money(total)).double(false).bold(false);
  r.row(t("kassa.receiptPayment"), paymentLabel(payType));
  if (customer?.fullName) r.row(t("kassa.receiptCustomer"), customer.fullName);

  if (offline) {
    r.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();
  }

  /* ── QQS jamlanmasi ────────────────────────────────────────────────
     Fiskal chekda QQS satr-satr emas, JAMI ko'rsatiladi: xaridorga
     kerakli raqam shu. Narx QQS'ni o'z ichiga oladi (O'zbekistonda
     chakana narx deyarli doim shunday), shuning uchun ajratish
     formulasi total × stavka / (100 + stavka). */
  const vatTotal = cart.reduce((sum, i) => {
    const rate = Number(i.vatRate);
    if (!rate) return sum;
    const line = Number(i.salePrice) * Number(i.qty);
    return sum + (i.priceIncludesVat === false ? line * rate / 100 : line * rate / (100 + rate));
  }, 0);
  if (vatTotal > 0) r.row(t("kassa.receiptVat"), money(vatTotal));

  /* ── Fiskal blok ───────────────────────────────────────────────────
     Faqat fiskal belgi HAQIQATAN olingan bo'lsa chiqadi. Belgisiz
     "fiskal chek" ko'rinishini yasash — xaridorni ham, do'konni ham
     aldash bo'lardi. */
  if (fiscal?.fiscalSign) {
    r.rule();
    r.center().line(t("kassa.receiptFiscal")).left();
    r.row(t("kassa.receiptFiscalSign"), fiscal.fiscalSign);
    if (fiscal.terminalId) r.row(t("kassa.receiptTerminal"), fiscal.terminalId);
    if (fiscal.receiptNo) r.row(t("kassa.receiptFiscalNo"), fiscal.receiptNo);
    if (fiscal.qrUrl) {
      r.feed().center().qr(fiscal.qrUrl).left();
    }
  }

  r.rule();
  r.center().line(t("kassa.receiptThanks")).line("e-kassam.uz");
  return r;
}

/**
 * Chekni chiqaradi. Naqd to'lov bo'lsa pul yashigini SHU BITTA yuborishda
 * ochadi — alohida buyruq yuborilsa yashik chekdan oldin yoki keyin
 * tasodifiy ochilardi.
 */
export async function printReceipt(sale) {
  const s = getSettings();

  // Brauzerda — dialog orqali. Desktop'da HAR DOIM printerga to'g'ridan-to'g'ri
  // (`transportOf` "browser" ni desktop'da qaytarmaydi).
  if (!isDesktop()) return printInBrowser(sale);

  const r = buildReceipt(sale);
  if (s.openDrawer && sale.payType === "CASH") r.kick();
  r.cut();
  await send(r.build());
}

/**
 * Xodim bajigini chop etish.
 *
 * ⚠ Sir (`token`) EKRANDA emas, faqat QOG'OZDA qoladi: chaqiruvchi uni
 * ko'rsatmasdan to'g'ridan-to'g'ri shu yerga uzatadi va chop etilgach
 * holatdan o'chiradi. Ekranda ko'rsatilsa uni suratga olish nusxalashning
 * eng oson yo'li bo'lardi — bajik esa aynan shundan himoyalanishi kerak.
 *
 * ⚠⚠ Termal qog'oz vaqt o'tib xiralashadi (issiq va yorug'likda tezroq).
 * Bajik uzoq ishlashi uchun uni laminatlash yoki kartaga yopishtirish
 * kerak. Bu texnik cheklov, tuzatib bo'lmaydi — termal bosishning tabiati.
 */
export async function printBadge({ fullName, username, version, token, shopName }) {
  if (!isDesktop()) throw new Error(t("hw.errNoDesktop"));

  const s = getSettings();
  const r = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);

  r.center().double().line(t("badge.printTitle")).double(false);
  r.line(shopName || "E-KASSAM.UZ");
  r.left().rule();
  r.center().bold().line(fullName || username || "-").bold(false);
  r.line("@" + (username || "-"));
  r.line(`${t("badge.version")} ${version ?? 1}`);
  r.feed();
  r.qr(token, 8);
  r.feed();
  r.line(new Date().toLocaleString("uz-UZ"));
  r.left().rule();
  // Ogohlantirish qog'ozning O'ZIDA turadi — bajikni topgan odam ham,
  // egasi ham qoidani ko'rib turishi kerak.
  r.wrap(t("badge.printWarn"));
  r.cut();
  await send(r.build());
}

/**
 * Smena hisobotini (X yoki Z) chek printerida chop etish.
 *
 * X/Z farqi faqat sarlavhada: Z — yopilgan smena yakuni (closedAt bor),
 * X — ochiq smenaning oraliq holati. Raqamlar tuzilishi bir xil.
 */
export async function printShiftReport(r, shopName) {
  if (!isDesktop()) throw new Error(t("hw.errNoDesktop"));

  const s = getSettings();
  const rc = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);
  const fmtT = (iso) => (iso ? new Date(iso).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "-");

  rc.center().double().line(r.closedAt ? "Z-HISOBOT" : "X-HISOBOT").double(false);
  rc.line(shopName || "E-KASSAM.UZ");
  rc.left().rule();
  rc.row(t("sales.colCashier"), r.cashierName || "-");
  rc.row(t("sec.openedAt"), fmtT(r.openedAt));
  if (r.closedAt) rc.row(t("shift.closedAt"), fmtT(r.closedAt));
  rc.rule();
  rc.row(t("rpt.salesCount"), String(r.salesCount));
  rc.bold().row(t("rpt.salesTotal"), money(r.salesTotal)).bold(false);
  // To'lov turlari bo'yicha — kassir yashikdagi naqdni shu qator bilan
  // solishtiradi, hisobotning eng ko'p ishlatiladigan qismi shu.
  for (const [type, sum] of Object.entries(r.byPaymentType || {})) {
    rc.row("  " + paymentLabel(type), money(sum));
  }
  rc.rule();
  rc.row(t("rpt.cancelled"), `${r.cancelledCount} / ${money(r.cancelledTotal)}`);
  rc.row(t("rpt.confirmations"), String(r.confirmationsCount));
  if (r.suspiciousCount > 0) {
    rc.bold().row(t("rpt.suspicious"), String(r.suspiciousCount)).bold(false);
  }
  rc.rule();
  rc.center().line(new Date().toLocaleString("uz-UZ")).line("e-kassam.uz");
  rc.cut();
  await send(rc.build());
}

/** Pul yashigi — sotuvsiz ham ochiladi (qaytim, smena boshi). */
export async function openDrawer() {
  if (!isDesktop()) throw new Error(t("hw.errNoDesktop"));
  await send(drawerKickBytes());
}

/** Printer ulanganini tekshirish. */
export async function testPrint() {
  const s = getSettings();
  const r = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);
  r.center().double().line(t("hw.testTitle")).double(false);
  r.line(new Date().toLocaleString("uz-UZ"));
  r.left().rule();
  // AMALDAGI ulanish yoziladi, sozlamadagi emas — sinov cheki nima
  // sozlanganini emas, nima ISHLAYOTGANINI ko'rsatishi kerak.
  const tr = transportOf(s);
  r.row(t("hw.transport"), tr);
  r.row(t("hw.printer"), tr === "tcp" ? `${s.host}:${s.port}` : (s.printerName || t("hw.defaultPrinter")));
  r.row(t("hw.width"), `${s.width} mm`);
  r.rule();
  // Kenglik to'g'ri sozlanganini KO'Z bilan tekshirish uchun: bu qator
  // aynan chek kengligida va o'ngi kesilmasligi kerak.
  r.line("1234567890".repeat(6).slice(0, r.width));
  r.center().line(t("hw.testOk"));
  r.cut();
  await send(r.build());
}

/* ── Brauzer zaxirasi ──────────────────────────────────────────────────── */
/**
 * Tauri'siz chek — HTML va chop etish dialogi.
 *
 * ⚠ Bu shablon ilgari BUZUQ edi: u oddiy satr bo'la turib ichida
 * `{t("kassa.receiptTotal")}` yozilgan edi va JSX emasligi uchun mijozning
 * chekiga aynan shu matn bosilardi. Endi tarjima satr YIG'ILISHIDAN oldin
 * chaqiriladi.
 */
function printInBrowser({ saleId, cart = [], total = 0, subtotal, discount = 0,
                          payType, customer, offline, shopName, cashier }) {
  const win = window.open("", "_blank", "width=360,height=640,toolbar=no,menubar=no");
  if (!win) throw new Error(t("hw.errPopup"));

  // Qog'oz kengligi — apparat sozlamasidan (58 yoki 80 mm).
  const mm = getSettings().width === 58 ? 58 : 80;

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const rows = cart.map((i) => {
    const qtyText = `${quantity(i.qty, i.unitDecimals)}${i.unit ? " " + unitLabel(i.unit) : ""}`;
    return `<div class="row"><span>${esc(i.name)} × ${esc(qtyText)}</span><span>${esc(money(i.salePrice * i.qty))}</span></div>`;
  }).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(t("kassa.receiptNo"))} ${esc(saleId)}</title>
    <style>
      /* CHEK QOG'OZI - A4 EMAS.
         @page bo'lmasa brauzer chekni A4 sahifaga joylashtiradi, chetiga
         o'z sarlavha-izohini (manzil, sana, bet raqami) qo'shadi va matn
         chek printeriga umuman sig'maydi - aynan shu "noto'g'ri format"
         edi. margin:0 esa brauzerning o'sha sarlavhalarini olib tashlaydi.
         Balandlik auto: chek uzunligi tovar soniga qarab o'zgaradi. */
      @page { size: ${mm}mm auto; margin: 0; }

      * { margin:0; padding:0; box-sizing:border-box; }
      /* Shrift TIZIMNIKI: popup oynaga tashqi shrift yuklanmaydi va
         JetBrains Mono baribir tushmasdi - natijada kenglik hisoblari
         buzilardi. */
      body { font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
             font-variant-numeric: tabular-nums;
             font-size: 12px; line-height: 1.35; color: #000;
             width: ${mm}mm; padding: 3mm; }
      .c { text-align:center; }
      .hr { border:none; border-top:1px dashed #000; margin:6px 0; }
      .row { display:flex; justify-content:space-between; padding:2px 0; gap:8px; }
      .row span:last-child { white-space: nowrap; }
      .logo { font-size:15px; font-weight:800; letter-spacing:.5px; }
      .off { margin-top:6px; padding:4px; border:1px dashed #000; font-size:10px; text-align:center; }
      .no { font-size:13px; font-weight:800; }
      @media print {
        /* Termal printerda kulrang matn o'qilmaydi — hammasi qora. */
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>
      <div class="c"><div class="logo">${esc(shopName || "E-KASSAM.UZ")}</div>
        <small>${esc(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${esc(t("kassa.receiptNo"))} ${esc(saleId)}</span><span>${esc(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      ${discount > 0 ? `<div class="row"><span>${esc(t("kassa.receiptSubtotal"))}</span><span>${esc(money(subtotal ?? (total + discount)))}</span></div>
      <div class="row"><span>${esc(t("kassa.discount"))}</span><span>-${esc(money(discount))}</span></div>` : ""}
      <div class="row"><b>${esc(t("kassa.receiptTotal"))}</b><b>${esc(money(total))}</b></div>
      <div class="row"><span>${esc(t("kassa.receiptPayment"))}</span><span>${esc(paymentLabel(payType))}</span></div>
      ${customer?.fullName ? `<div class="row"><span>${esc(t("kassa.receiptCustomer"))}</span><span>${esc(customer.fullName)}</span></div>` : ""}
      ${offline ? `<div class="off">${esc(t("kassa.receiptOffline"))}<br>${esc(t("kassa.receiptOfflineSub"))}</div>` : ""}
      <div class="hr"></div>
      <div class="c"><p>${esc(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>
    </body></html>`);
  win.document.close();
  /* Tizim shrifti ishlatilgani uchun kutish shart emas — bir kadr yetadi.
     Chop etilgach oyna O'ZI yopiladi: aks holda kassirning ekranida
     har chekdan keyin bitta ochiq oyna qolib ketardi. */
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 60);
}
