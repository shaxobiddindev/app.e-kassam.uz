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
import { money } from "../utils";
import { paymentLabel } from "./ek-labels";

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
export function buildReceipt({ saleId, cart = [], total = 0, payType, customer, offline, shopName, cashier }) {
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
    r.row(`  ${i.qty} x ${money(i.salePrice)}`, money(i.salePrice * i.qty));
  }

  r.rule();
  r.bold().double().row(t("kassa.receiptTotal"), money(total)).double(false).bold(false);
  r.row(t("kassa.receiptPayment"), paymentLabel(payType));
  if (customer?.fullName) r.row(t("kassa.receiptCustomer"), customer.fullName);

  if (offline) {
    r.feed().center().line(t("kassa.receiptOffline")).line(t("kassa.receiptOfflineSub")).left();
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
function printInBrowser({ saleId, cart = [], total = 0, payType, customer, offline, shopName }) {
  const win = window.open("", "_blank", "width=320,height=600,toolbar=no,menubar=no");
  if (!win) throw new Error(t("hw.errPopup"));

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const rows = cart.map((i) =>
    `<div class="row"><span>${esc(i.name)} x${i.qty}</span><span>${esc(money(i.salePrice * i.qty))}</span></div>`
  ).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(t("kassa.receiptNo"))} ${esc(saleId)}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums;
             font-size:12px; padding:12px; width:280px; color:#0B1524; }
      .c { text-align:center; }
      .hr { border:none; border-top:1px dashed #0B1524; margin:8px 0; }
      .row { display:flex; justify-content:space-between; padding:3px 0; gap:8px; }
      .logo { font-family:Manrope,sans-serif; font-size:18px; font-weight:800; color:#1663D8; }
      .off { margin-top:6px; padding:4px; border:1px dashed #A16207; color:#A16207; font-size:10px; text-align:center; }
    </style></head><body>
      <div class="c"><div class="logo">${esc(shopName || "E-KASSAM.UZ")}</div>
        <small>${esc(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${esc(t("kassa.receiptNo"))} ${esc(saleId)}</span><span>${esc(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      <div class="row"><b>${esc(t("kassa.receiptTotal"))}</b><b>${esc(money(total))}</b></div>
      <div class="row"><span>${esc(t("kassa.receiptPayment"))}</span><span>${esc(paymentLabel(payType))}</span></div>
      ${customer?.fullName ? `<div class="row"><span>${esc(t("kassa.receiptCustomer"))}</span><span>${esc(customer.fullName)}</span></div>` : ""}
      ${offline ? `<div class="off">${esc(t("kassa.receiptOffline"))}<br>${esc(t("kassa.receiptOfflineSub"))}</div>` : ""}
      <div class="hr"></div>
      <div class="c"><p>${esc(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
