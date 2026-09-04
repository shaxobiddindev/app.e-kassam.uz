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
import { shopHead } from "./ek-shop-print";
import { money, quantity } from "../utils";
import { paymentLabel, unitLabel } from "./ek-labels";
import { code128Svg, saleCode } from "./ek-barcode";
import { spreadDiscount } from "./ek-discount";
/* Brauzer cheki uchun QR (V34). ESC/POS printerda QR ni apparatning O'ZI
   chizadi (`Receipt.qr`), brauzerda esa SVG kerak. */
import { qrSvg } from "./ek-qr";
import { shortDate } from "./ek-format";
import { DEFAULTS, getSettings, saveSettings } from "./ek-hw-settings";

/* ── Sozlamalar ────────────────────────────────────────────────────────
   ⚠ ULAR ENDI `ek-hw-settings.js` DA va bu yerdan QAYTA EKSPORT
   qilinadi. Sabab: sozlamani o'qish uchun shu butun modulni import
   qilish kerak edi, u esa `qrcode-generator` ni ham (51 KB) o'zi bilan
   olib kelardi — «skaner yoqilganmi?» degan bitta savol uchun.

   Qayta eksport eski importlarni ishlaydigan qoldiradi va ikki manba
   paydo bo'lishiga yo'l qo'ymaydi. */
export { DEFAULTS, getSettings, saveSettings } from "./ek-hw-settings";

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
export function buildReceipt({ saleId, serverSaleId, cart = [], total = 0, subtotal, discount = 0,
                               payType, payments, customer, offline, shopName, cashier, fiscal, receiptUrl,
                               credit }) {
  const s = getSettings();
  const r = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);

  /* ⚠ NOM KESHDAN (V62). Ilgari `shopName` chaqiruvchidan kelardi va u
     `localStorage.ek_shopName` dan o'qilardi — o'sha kalit esa hech
     qayerda YOZILMASDI. Natijada chekda do'konning nomi emas, KODI
     («ulash01») yoki «E-KASSAM.UZ» chiqardi. Mijoz qo'lidagi qog'ozda
     do'konning haqiqiy nomi hech qachon bo'lmagan. */
  const head = shopHead(shopName);
  r.center().double().line(head.name).double(false);
  /* Telefon — nom ostida, sozlama yoqilgan bo'lsa (`shopHead` izohi). */
  if (head.phone) r.line(head.phone);
  r.line(t("kassa.receiptSystem"));
  r.left().rule();

  r.row(`${t("kassa.receiptNo")} ${saleId ?? "-"}`, new Date().toLocaleString("uz-UZ"));
  if (cashier) r.row(t("kassa.receiptCashier"), cashier);
  r.rule();

  /* ⚠ CHEK CHEGIRMASI QATORLARGA TAQSIMLANADI (V48).
     Chekda faqat «Chegirma −50 000» tursa, mijoz ham, do'kon ham
     ertaga bitta tovarni qaytarganda qancha pul qaytishini bilmaydi.
     Server chegirmani qatorlarga taqsimlab saqlaydi va qaytarish AYNAN
     shundan hisoblanadi — chek ham xuddi o'sha raqamlarni ko'rsatishi
     kerak (`ek-discount.js` — serverdagi qoidaning nusxasi). */
  const shares = spreadDiscount(cart, discount);

  cart.forEach((i, idx) => {
    // Tovar nomi ALOHIDA qatorda: uzun nomlar narx ustuniga bosim qilmasin.
    r.wrap(i.name);
    // Miqdor birligi bilan: "0.35 kg x 95 000". Birliksiz "0.35 x 95 000"
    // mijozga nima sotilganini aytmasdi.
    const qtyText = `${quantity(i.qty, i.unitDecimals)}${i.unit ? " " + unitLabel(i.unit) : ""}`;
    r.row(`  ${qtyText} x ${money(i.salePrice)}`, money(i.salePrice * i.qty));

    /* Qator chegirmasi = kassir tushirgan narx + chek chegirmasidan
       tushgan ulush. Chegirmasiz qatorda satr umuman chiqmaydi —
       chekni bekorga uzaytirmaslik uchun. */
    const lineDisc = (Number(i.discount) || 0) + (shares[idx] || 0);
    if (lineDisc > 0) r.row(`    ${t("kassa.discount")}`, "-" + money(lineDisc));
  });

  r.rule();
  /* ⚠ JAMI CHEGIRMA — qator chegirmalari BILAN birga (V48). Ilgari bu
     yerda faqat chek chegirmasi turardi va kassir narxni qatorda
     tushirgan bo'lsa, chekdagi «Jami − Chegirma» ayirmasi yakuniy
     summaga to'g'ri kelmasdi. */
  const lineDisc = cart.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
  const discTotal = discount + lineDisc;
  if (discTotal > 0) {
    r.row(t("kassa.receiptSubtotal"), money(subtotal ?? (total + discTotal)));
    r.row(t("kassa.discount"), "-" + money(discTotal));
  }
  r.bold().double().row(t("kassa.receiptTotal"), money(total)).double(false).bold(false);
  r.row(t("kassa.receiptPayment"), paymentLabel(payType));
  /* ⚠ ARALASH TO'LOVDA TAQSIMOT HAM CHIQADI (V53). «Aralash» degan
     bitta so'z mijozga hech narsa aytmaydi: u uyiga borib «karta bilan
     qancha to'lagan edim?» deb o'ylab qoladi va ertaga do'kon bilan
     tortishadi — nasiya blokidagi bilan aynan bir xil sabab. */
  if (Array.isArray(payments) && payments.length > 1) {
    for (const part of payments) {
      r.row("  " + paymentLabel(part.type), money(part.amount));
    }
  }
  if (customer?.fullName) r.row(t("kassa.receiptCustomer"), customer.fullName);

  /* ── NASIYA BLOKI (V47) ────────────────────────────────────────────
     ⚠ Chek mijozning QO'LIDA qoladigan yagona hujjat. «Nasiya» degan
     bitta so'z yetmaydi: mijoz uyiga borib «qancha qarzim bor edi?»
     deb o'ylab qoladi va ertaga do'kon bilan tortishadi. Shu chek
     qarzi, JAMI qarz va muddat — uchalasi ham shu yerda turadi. */
  if (credit && Number(credit.amount) > 0) {
    r.rule();
    r.center().bold().line(t("kassa.receiptCredit")).bold(false).left();
    r.row(t("kassa.receiptCreditThis"), money(credit.amount));
    if (credit.balance != null) r.row(t("kassa.receiptCreditTotal"), money(credit.balance));
    if (credit.dueDate) r.row(t("kassa.receiptCreditDue"), credit.dueDate);
    /* ⚠ IMZO JOYI. Qog'ozdagi imzo — do'konning eng oddiy va eng
       ishonchli dalili; ilova tasdig'i (V46) bo'lmagan mijozda esa
       yagona dalil. */
    r.feed().row(t("kassa.receiptCreditSign"), "______________");
  }

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

  /* ── Chek raqami barkodi ───────────────────────────────────────────
     Qaytarishda kassir shu barkodni skanerlaydi va kerakli chek bir
     soniyada topiladi. Usiz u sana va summa bo'yicha qidiradi — bir
     kunda 200 ta chek bo'lsa bu sekin va xato qilishga ochiq.

     ⚠ Faqat SERVER raqami bilan: oflayn chekda raqam qurilmada
     yaratiladi (`OFF-0001`) va serverda bunday sotuv hali yo'q — uni
     skanerlash hech narsa topmasdi. Ulanish tiklangach chek qayta
     chiqarilsa, barkod ham paydo bo'ladi.

     ⚠ Raqam barkod OSTIDA matn bilan ham yoziladi: barkod ezilsa yoki
     mijoz telefonda surat ko'rsatsa, kassir uni qo'lda kiritadi. */
  if (serverSaleId) {
    const code = saleCode(serverSaleId);
    r.feed().center().barcode128(code).line(code).left();
  }

  /* ── ELEKTRON CHEK QR (V34) ────────────────────────────────────────
     Mijoz uni telefon kamerasi bilan o'qiydi va chekning elektron
     nusxasini oladi — qog'oz yo'qolsa ham xarid tarixi qoladi.

     ⚠ Havolani SERVER beradi (`receiptUrl`, imzo bilan): front uni o'zi
     yasay olmaydi va yasamasligi ham kerak — imzo siri faqat serverda.
     Havola yo'q bo'lsa (oflayn chek yoki eski server) QR chizilmaydi. */
  if (receiptUrl) {
    r.feed().center().qr(receiptUrl, 6).line(t("kassa.receiptQrHint")).left();
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
 * QARZ TO'LOVI CHEKI (V47).
 *
 * ⚠ NEGA ALOHIDA CHEK. Qarz to'lovi — bu SOTUV EMAS: tovar yo'q, qatorlar
 * yo'q, QQS yo'q. Uni sotuv cheki qolipiga tiqish chalkashtirardi (bo'sh
 * tovar ro'yxati, «jami 0»). Mijozga esa qog'oz kerak: u pul berdi va
 * buning izini olishi kerak — aks holda «to'lagandim-ku» degan tortishuv
 * yana do'konning so'ziga qarshi mijozning so'zi bo'lib qolardi.
 */
export function buildDebtReceipt({ customer, amount, balanceAfter, balanceBefore, method,
                                   shopName, cashier, date, receiptNo, qrUrl,
                                   toSavings, bonusEarned }) {
  const s = getSettings();
  const r = new Receipt(s.width === 58 ? WIDTH_58 : WIDTH_80);

  const head = shopHead(shopName);
  r.center().double().line(head.name).double(false);
  if (head.phone) r.line(head.phone);
  r.line(t("kassa.receiptDebtPay"));
  r.left().rule();

  /* ⚠ CHEK RAQAMI (V61). Usiz qog'ozni tizimdagi yozuv bilan
     bog'lashning yo'li yo'q edi: mijoz chekni ko'rsatadi, do'kon esa
     uni sana va summa bo'yicha qidirishga majbur bo'lardi — bir kunda
     bir xil summali ikkita to'lov bo'lsa, qaysi biri ekani noaniq
     qolardi. */
  if (receiptNo) r.row(t("kassa.receiptNo"), receiptNo);
  r.row(t("common.date"), (date || new Date()).toLocaleString("uz-UZ"));
  if (cashier) r.row(t("kassa.receiptCashier"), cashier);
  if (customer?.fullName) r.row(t("kassa.receiptCustomer"), customer.fullName);
  r.rule();

  r.bold().double().row(t("kassa.receiptPaid"), money(amount)).double(false).bold(false);
  r.row(t("kassa.receiptPayment"), paymentLabel(method));
  if (balanceBefore != null) r.row(t("credit.wasDebt"), money(balanceBefore));
  /* Qolgan qarz — mijoz aynan shuni so'raydi. Nol bo'lsa ham yoziladi:
     «qarzingiz qolmadi» degan qator eng qimmatli qator. */
  r.row(t("kassa.receiptDebtLeft"), money(balanceAfter ?? 0));
  /* Ortig'i jamg'armaga va keshbek (V64) — mijoz uzatgan pulning
     TO'LIQ taqdiri qog'ozda turishi kerak. */
  if (Number(toSavings) > 0) r.row(t("savings.toSavings"), money(toSavings));
  if (Number(bonusEarned) > 0) r.row(t("kassa.receiptBonusEarned"), "+" + money(bonusEarned));

  /* ⚠ QR — chekning elektron nusxasiga (V61). Termal qog'oz vaqt
     o'tib xiralashadi va aynan qarz cheki eng uzoq saqlanishi kerak
     bo'lgan qog'oz: tortishuv oylar keyin ham chiqishi mumkin.
     Telefonga ko'chirilgan nusxa esa xiralashmaydi. */
  if (qrUrl) {
    r.rule();
    r.center().line(t("kassa.receiptQrHint"));
    r.qr(qrUrl, 6);
  }

  r.rule();
  r.center().line(t("kassa.receiptThanks")).line("e-kassam.uz");
  return r;
}

/** Qarz to'lovi chekini chiqaradi (naqdda pul yashigi ham ochiladi). */
export async function printDebtReceipt(payment) {
  const s = getSettings();
  if (!isDesktop()) return printInBrowser({ ...payment, __debt: true });

  const r = buildDebtReceipt(payment);
  if (s.openDrawer && payment.method === "CASH") r.kick();
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

  /* ── Yarashtiruv ────────────────────────────────────────────────────
     ⚠ Ilgari chekda BU BO'LIM UMUMAN YO'Q edi: qog'ozda sotuv jamlari
     chiqib, kamomad esa faqat ekranda qolardi. Holbuki kunni topshirish
     aynan shu qog'oz bilan bo'ladi va farq imzolanadigan raqam.

     Maydonlar shartli chiziladi — kassirning X-hisobotida kutilgan
     summalar `null` bo'lib keladi (server ataylab maskalaydi). */
  if (r.cash) {
    rc.rule();
    rc.row(t("cash.openingFloat"), money(r.cash.openingFloat));
    if (r.cash.expectedCash != null) rc.row(t("cash.expected"), money(r.cash.expectedCash));
    if (r.cash.countedCash != null) {
      rc.bold().row(t("cash.counted"), money(r.cash.countedCash)).bold(false);
      rc.bold().row(t("cash.difference"), money(r.cash.difference)).bold(false);
    }
  }
  if (r.nonCash?.length) {
    rc.rule();
    rc.line(t("noncash.title"));
    for (const l of r.nonCash) {
      if (l.counted == null) {
        // X-hisobot: faqat tur ko'rinadi (yoki rahbarga kutilgan summa).
        rc.row("  " + paymentLabel(l.paymentType), l.expected == null ? "-" : money(l.expected));
      } else {
        rc.row("  " + paymentLabel(l.paymentType), `${money(l.expected)} / ${money(l.counted)}`);
        if (Number(l.difference) !== 0) {
          rc.bold().row("  " + t("cash.difference"), money(l.difference)).bold(false);
        }
      }
    }
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

/* ── Narx yorliqlari ───────────────────────────────────────────────────── */
/**
 * Javon yorliqlarini CHEK PRINTERIDA chop etadi — lenta ko'rinishida.
 *
 * ═══ NEGA ALOHIDA APPARAT SHART EMAS ════════════════════════════════════
 *
 * Yorliq printeri (Zebra, TSC) 150-300 dollar turadi va kichik do'kon uni
 * yiliga bir necha marta ishlatadi. Chek printeri esa allaqachon kassada
 * turibdi va u yorliq uchun kerak bo'lgan hamma narsani biladi: katta
 * shrift, barkod, kesish. Yagona farqi — yopishqoq qog'oz yo'q.
 *
 * ⚠ IKKITA JIDDIY CHEKLOV, ikkalasi ham TEXNIK va tuzatib bo'lmaydi:
 *
 * 1. **Qog'oz o'z-o'zidan kesilmaydi.** Chiqadigan narsa — lenta; uni
 *    qaychi bilan ajratish kerak. Shuning uchun har yorliq orasiga
 *    KESISH CHIZIG'I bosiladi: usiz xodim qayerdan kesishni ko'zi bilan
 *    chamalab, yorliqlarni qiyshiq qirqardi.
 * 2. **Termal qog'oz xiralashadi** (issiq va yorug'likda tezroq).
 *    Javonda bir necha oy turadigan yorliq o'chib qolishi mumkin — bu
 *    bajik bilan bir xil cheklov.
 *
 * ⚠ Barkod EAN-13 bo'lib chiqadi (nazorat raqami to'g'ri bo'lsa), aks
 * holda Code 128. Sabab `Receipt.barcodeEan13` izohida.
 *
 * @param items  [{ name, salePrice, barcode, oldPrice }]
 * @param copies har bir tovar uchun nechta yorliq
 */
export async function printPriceLabels(items = [], opts = {}) {
  if (!isDesktop()) throw new Error(t("hw.errNoDesktop"));
  await send(buildPriceLabels(items, opts));
}

/**
 * Yorliq lentasini ESC/POS baytlariga yig'adi.
 *
 * Chop etishdan ALOHIDA — `buildReceipt` bilan bir xil sabab: sinov va
 * haqiqiy chiqarish bitta kod bo'lishi kerak, aks holda sinov o'tib,
 * haqiqiysi buzilib chiqishi mumkin.
 */
export function buildPriceLabels(items = [], { copies = 1, shopName, width } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) throw new Error(t("label.nothing"));

  const s = getSettings();
  const w = width ?? (s.width === 58 ? WIDTH_58 : WIDTH_80);
  const r = new Receipt(w);
  const n = Math.max(1, Math.min(20, Number(copies) || 1));

  for (const item of list) {
    for (let i = 0; i < n; i++) {
      r.center();
      if (shopName) r.line(shopName);
      // Nom IKKI qatorgacha o'raladi: uzun nomni kesib tashlash javondagi
      // yorliqni foydasiz qiladi — «Sut 2,5% 1l» ning «Sut 2,5%» qismi
      // yonidagi boshqa qadoqdan farq qilmaydi.
      r.bold().wrap(item.name || "-").bold(false);
      r.feed();
      // ⚠ Narx IKKI BARAVAR shriftda: yorliqning butun ma'nosi shu raqamda
      // va u bir metr naridan o'qilishi kerak.
      r.double().line(money(item.salePrice, { withUnit: true })).double(false);
      if (item.oldPrice != null && Number(item.oldPrice) > Number(item.salePrice)) {
        // Eski narx — chegirmani ko'rsatish uchun. Chizib tashlab
        // bo'lmaydi (ESC/POS da bunday uslub yo'q), shuning uchun so'z bilan.
        r.line(`${t("label.oldPrice")}: ${money(item.oldPrice, { withUnit: true })}`);
      }
      r.feed();
      if (item.barcode) {
        if (!r.barcodeEan13(item.barcode)) r.barcode128(item.barcode, { hri: true });
        r.feed();
      }
      r.line(new Date().toLocaleDateString("uz-UZ"));
      /* Kesish chizig'i — qaychi uchun ko'rsatma.
         ⚠ Qaychi belgisi (✂) ATAYLAB ishlatilmaydi: `toBytes` ASCII
         bo'lmagan har qanday belgini `?` ga aylantiradi va butun chiziq
         `??????` bo'lib chiqardi. Uzuq-uzuq chiziq bir xil vazifani
         bajaradi va har qanday printerda bir xil ko'rinadi. */
      r.left().line("- ".repeat(Math.floor(r.width / 2)).trimEnd()).center();
    }
  }

  r.cut();
  return r.build();
}

/* ── Muddat stikerlari (V48) ───────────────────────────────────────────── */
/**
 * MUDDATI YAQIN TOVARGA STIKER.
 *
 * ═══ NEGA ALOHIDA, NARX YORLIG'IDAN FARQLI ══════════════════════════════
 *
 * Narx yorlig'ida asosiy raqam — NARX; bu yerda esa SANA. Xodim javon
 * oralab yurib, «bu qachon tugaydi?» degan savolga bir metr naridan
 * javob topishi kerak. Shuning uchun sana ikki baravar shriftda, narx
 * esa pastda kichik — ikkisi joyini almashsa, stikerning ma'nosi
 * yo'qolardi.
 *
 * ⚠ QOG'OZ MASALASI. Chek lentasi YOPISHQOQ EMAS: uni tovarga yopishtirib
 * bo'lmaydi, faqat javonga qo'yish mumkin. Shuning uchun brauzerda
 * stikerlar A4 varaqqa KARTOCHKA bo'lib chiqadi — do'kon oddiy
 * yopishqoq varaq oladi va oddiy printerda bosadi. Ish stolida
 * (Tauri) esa chek printeri ham ishlatiladi: kimdadir shunisi bor.
 *
 * @param items [{ name, expiryDate, daysLeft, salePrice, barcode, qty, unit }]
 */
export async function printExpiryLabels(items = [], opts = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) throw new Error(t("label.nothing"));
  if (!isDesktop()) return printExpiryInBrowser(list, opts);
  await send(buildExpiryLabels(list, opts));
}

/** Stiker lentasini ESC/POS baytlariga yig'adi (ish stoli yo'li). */
export function buildExpiryLabels(items = [], { copies = 1, shopName, width } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) throw new Error(t("label.nothing"));

  const s = getSettings();
  const w = width ?? (s.width === 58 ? WIDTH_58 : WIDTH_80);
  const r = new Receipt(w);
  const n = Math.max(1, Math.min(20, Number(copies) || 1));

  for (const item of list) {
    for (let i = 0; i < n; i++) {
      r.center();
      if (shopName) r.line(shopName);
      r.bold().line(t("label.expiryTitle")).bold(false);
      r.bold().wrap(item.name || "-").bold(false);
      r.feed();
      // ⚠ SANA ikki baravar shriftda — stikerning butun ma'nosi shunda.
      r.double().line(shortDate(item.expiryDate)).double(false);
      if (item.daysLeft != null) {
        r.line(item.daysLeft <= 0 ? t("label.expiryToday")
                                  : t("inv.nearDays", { n: item.daysLeft }));
      }
      if (item.salePrice != null) r.line(money(item.salePrice, { withUnit: true }));
      r.feed();
      if (item.barcode) {
        if (!r.barcodeEan13(item.barcode)) r.barcode128(item.barcode, { hri: true });
        r.feed();
      }
      // Kesish chizig'i — sabab `buildPriceLabels` izohida.
      r.left().line("- ".repeat(Math.floor(r.width / 2)).trimEnd()).center();
    }
  }
  r.cut();
  return r.build();
}

/**
 * Brauzer yo'li: A4 varaqqa kartochkalar.
 *
 * ⚠ O'lcham 62×40 mm — sotuvdagi eng keng tarqalgan yopishqoq varaq
 * kataklari shunga yaqin. Aniq mos kelmasa ham, kartochka chetidagi
 * uzuq-uzuq chiziq bo'ylab qirqish har doim ishlaydi.
 */
function printExpiryInBrowser(items, { shopName } = {}) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) throw new Error(t("hw.errPopup"));

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const cards = items.map((i) => {
    const left = i.daysLeft;
    const leftText = left == null ? ""
      : left <= 0 ? t("label.expiryToday") : t("inv.nearDays", { n: left });
    return `<div class="lbl">
      <div class="hdr">${esc(t("label.expiryTitle"))}</div>
      <div class="nm">${esc(i.name || "-")}</div>
      <div class="dt">${esc(shortDate(i.expiryDate))}</div>
      ${leftText ? `<div class="lf">${esc(leftText)}</div>` : ""}
      ${i.salePrice != null ? `<div class="pr">${esc(money(i.salePrice, { withUnit: true }))}</div>` : ""}
      ${i.barcode ? `<div class="bc">${code128Svg(String(i.barcode), { height: 22 })}</div>` : ""}
      ${shopName ? `<div class="sh">${esc(shopName)}</div>` : ""}
    </div>`;
  }).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${esc(t("label.expiryTitle"))}</title>
    <style>
      @page { size: A4; margin: 8mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color:#000;
             display:flex; flex-wrap:wrap; gap:0; }
      /* Uzuq-uzuq ramka — qirqish chizig'i. Kartochkalar yonma-yon
         tursin deb chetlari birlashtirilmaydi: ikki chiziq orasidan
         qirqish osonroq. */
      .lbl { width:62mm; height:40mm; border:1px dashed #000; padding:2mm;
             display:flex; flex-direction:column; align-items:center; justify-content:center;
             text-align:center; overflow:hidden; }
      .hdr { font-size:8pt; font-weight:800; letter-spacing:.5px; }
      .nm  { font-size:10pt; font-weight:700; line-height:1.15; margin-top:1mm;
             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      /* SANA — eng katta raqam: stiker aynan shu uchun yopishtiriladi. */
      .dt  { font-size:19pt; font-weight:900; line-height:1.1; margin-top:1mm;
             font-variant-numeric: tabular-nums; }
      .lf  { font-size:9pt; font-weight:700; }
      .pr  { font-size:10pt; font-weight:700; margin-top:.5mm; }
      .bc  { margin-top:1mm; }
      .bc svg { height:22px; }
      .sh  { font-size:7pt; margin-top:auto; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>${cards}</body></html>`);
  win.document.close();
  /* Chop etish dialogi RASMLAR chizilgandan keyin — `buildReceipt`
     yo'lidagi bilan bir xil sabab. */
  win.onload = () => { win.focus(); win.print(); };
  return Promise.resolve();
}

/* ── Ombor varaqasi (V48) ──────────────────────────────────────────────── */
/**
 * OMBOR VARAQASI — omborchi qo'lidagi qog'oz.
 *
 * ═══ NEGA KERAK ════════════════════════════════════════════════════════
 *
 * Ekran omborchining stolida turadi, tovar esa hovlida. U ro'yxatni
 * yodda saqlab, ikki qavat pastga tushib, keyin qaytib kelib tekshira
 * olmaydi. Qog'oz — o'sha ro'yxatning qo'lda olib yuriladigan nusxasi
 * va u mijozning chekiga MOS bo'lishi shart: ikkalasida bir xil raqam
 * turadi va omborchi ularni yonma-yon qo'yib solishtiradi.
 *
 * ⚠ NARX YO'Q. Ombor varaqasi — TOVAR hujjati: nima, qancha va qaysi
 * chek bo'yicha. Narxni omborchi bilishi shart emas va u mijoz bilan
 * «narx boshqa edi-ku» degan keraksiz suhbatni ochardi; pul masalasi
 * kassada allaqachon yopilgan.
 *
 * ⚠ IKKI IMZO joyi: omborchi berdi, mijoz oldi. Qog'ozdagi imzo —
 * «men olmadim» degan tortishuvda do'konning yagona dalili.
 */
export async function printPickupSlip(order, opts = {}) {
  if (!order) throw new Error(t("label.nothing"));
  if (!isDesktop()) return printPickupInBrowser(order, opts);
  await send(buildPickupSlip(order, opts));
}

/** Ombor varaqasini ESC/POS baytlariga yig'adi. */
export function buildPickupSlip(order, { shopName, width } = {}) {
  const s = getSettings();
  const r = new Receipt(width ?? (s.width === 58 ? WIDTH_58 : WIDTH_80));

  r.center().double().line(t("pickup.slipTitle")).double(false);
  if (shopName) r.line(shopName);
  r.left().rule();

  r.row(`${t("kassa.receiptNo")} ${order.saleCode || "-"}`,
        order.createdAt ? new Date(order.createdAt).toLocaleString("uz-UZ") : "");
  if (order.cashierName) r.row(t("kassa.receiptCashier"), order.cashierName);
  if (order.customerName) r.row(t("kassa.receiptCustomer"), order.customerName);
  if (order.customerPhone) r.row(t("common.phone"), order.customerPhone);
  r.rule();

  for (const i of order.items || []) {
    r.wrap(i.productName);
    /* ⚠ MIQDOR ikki baravar shriftda: omborchi aynan shu raqamga qarab
       tovar sanaydi va uni bir qarashda o'qishi kerak.
       ⚠ `row` EMAS, `line`: qo'sh shriftda satrga ikki baravar kam
       belgi sig'adi va `row` ning bo'shliq hisobi buzilib, o'ng ustun
       qatorning tashqarisiga chiqib ketardi. */
    r.double().line(`  ${quantity(i.quantity)} ${unitLabel(i.unit)}`).double(false);
  }

  r.rule();
  /* Chek raqami barkodi — omborchi uni skanerlab ekranda ochadi.
     Mijozning chekidagi barkod bilan AYNAN bir xil. */
  if (order.saleId) {
    const code = saleCode(order.saleId);
    r.feed().center().barcode128(code).line(code).left();
  }
  r.feed();
  r.row(t("pickup.signStore"), "______________");
  r.feed().row(t("pickup.signCustomer"), "______________");
  r.cut();
  return r.build();
}

/** Brauzer yo'li — chek qog'ozi kengligidagi sahifa. */
function printPickupInBrowser(order, { shopName } = {}) {
  const win = window.open("", "_blank", "width=360,height=640");
  if (!win) throw new Error(t("hw.errPopup"));
  const mm = getSettings().width === 58 ? 58 : 80;
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const rows = (order.items || []).map((i) =>
    `<div class="it"><div class="nm">${esc(i.productName)}</div>
     <div class="qt">${esc(quantity(i.quantity))} ${esc(unitLabel(i.unit))}</div></div>`).join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${esc(t("pickup.slipTitle"))} ${esc(order.saleCode || "")}</title>
    <style>
      @page { size: ${mm}mm auto; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
             font-variant-numeric: tabular-nums; font-size:12px; line-height:1.35;
             color:#000; width:${mm}mm; padding:3mm; }
      .c { text-align:center; }
      .hr { border:none; border-top:1px dashed #000; margin:6px 0; }
      .row { display:flex; justify-content:space-between; gap:8px; padding:2px 0; }
      .ttl { font-size:16px; font-weight:800; letter-spacing:.5px; }
      .it { padding:4px 0; border-bottom:1px dotted #999; }
      .nm { font-weight:700; }
      /* Miqdor — eng katta raqam: omborchi shunga qarab sanaydi. */
      .qt { font-size:18px; font-weight:900; text-align:right; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    </style></head><body>
      <div class="c"><div class="ttl">${esc(t("pickup.slipTitle"))}</div>
        ${shopName ? `<small>${esc(shopName)}</small>` : ""}</div>
      <div class="hr"></div>
      <div class="row"><b>${esc(t("kassa.receiptNo"))} ${esc(order.saleCode || "-")}</b>
        <span>${esc(order.createdAt ? new Date(order.createdAt).toLocaleString("uz-UZ") : "")}</span></div>
      ${order.cashierName ? `<div class="row"><span>${esc(t("kassa.receiptCashier"))}</span><span>${esc(order.cashierName)}</span></div>` : ""}
      ${order.customerName ? `<div class="row"><span>${esc(t("kassa.receiptCustomer"))}</span><span>${esc(order.customerName)}</span></div>` : ""}
      ${order.customerPhone ? `<div class="row"><span>${esc(t("common.phone"))}</span><span>${esc(order.customerPhone)}</span></div>` : ""}
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      ${order.saleId ? `<div class="c">${code128Svg(saleCode(order.saleId), { height: 14 })}
        <div><b>${esc(saleCode(order.saleId))}</b></div></div>` : ""}
      <div class="row" style="margin-top:14px"><span>${esc(t("pickup.signStore"))}</span><span>______________</span></div>
      <div class="row" style="margin-top:12px"><span>${esc(t("pickup.signCustomer"))}</span><span>______________</span></div>
    </body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
  return Promise.resolve();
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
function printInBrowser({ saleId, serverSaleId, cart = [], total = 0, subtotal, discount = 0,
                          payType, payments, customer, offline, shopName, cashier, receiptUrl,
                          credit, __debt, amount, balanceAfter, balanceBefore, method, date,
                          receiptNo, qrUrl, toSavings, bonusEarned }) {
  const win = window.open("", "_blank", "width=360,height=640,toolbar=no,menubar=no");
  if (!win) throw new Error(t("hw.errPopup"));

  // Qog'oz kengligi — apparat sozlamasidan (58 yoki 80 mm).
  const mm = getSettings().width === 58 ? 58 : 80;
  /* ⚠ ESC/POS cheki bilan BIR XIL manbadan: brauzer cheki boshqa nom
     yoki boshqa telefon ko'rsatsa, ikkalasi ham ishonchini yo'qotardi. */
  const head = shopHead(shopName);

  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Chek chegirmasi qatorlarga taqsimlanadi — `buildReceipt` dagi bilan
     BIR XIL qoida (`ek-discount.js`). Brauzer cheki apparat chekidan
     boshqacha raqam ko'rsatsa, ikkalasi ham ishonchini yo'qotardi. */
  const shares = spreadDiscount(cart, discount);
  const lineDiscTotal = cart.reduce((sum, i) => sum + (Number(i.discount) || 0), 0);
  const discTotal = discount + lineDiscTotal;

  const rows = cart.map((i, idx) => {
    const qtyText = `${quantity(i.qty, i.unitDecimals)}${i.unit ? " " + unitLabel(i.unit) : ""}`;
    const lineDisc = (Number(i.discount) || 0) + (shares[idx] || 0);
    return `<div class="row"><span>${esc(i.name)} × ${esc(qtyText)}</span><span>${esc(money(i.salePrice * i.qty))}</span></div>`
      + (lineDisc > 0
          ? `<div class="row sub"><span>${esc(t("kassa.discount"))}</span><span>-${esc(money(lineDisc))}</span></div>`
          : "");
  }).join("");

  /* ⚠ QARZ TO'LOVI — BOSHQA HUJJAT: tovar qatorlari, QQS va chek raqami
     yo'q. Uni sotuv qolipiga tiqish «jami 0» li bo'sh chek berardi. */
  const debtBody = !__debt ? "" : `
      <div class="c"><div class="logo">${esc(head.name)}</div>
        ${head.phone ? `<small>${esc(head.phone)}</small><br>` : ""}
        <small>${esc(t("kassa.receiptDebtPay"))}</small></div>
      <div class="hr"></div>
      ${receiptNo ? `<div class="row"><span>${esc(t("kassa.receiptNo"))}</span><span>${esc(receiptNo)}</span></div>` : ""}
      <div class="row"><span>${esc(t("common.date"))}</span><span>${esc((date || new Date()).toLocaleString("uz-UZ"))}</span></div>
      ${cashier ? `<div class="row"><span>${esc(t("kassa.receiptCashier"))}</span><span>${esc(cashier)}</span></div>` : ""}
      ${customer?.fullName ? `<div class="row"><span>${esc(t("kassa.receiptCustomer"))}</span><span>${esc(customer.fullName)}</span></div>` : ""}
      <div class="hr"></div>
      <div class="row"><b>${esc(t("kassa.receiptPaid"))}</b><b>${esc(money(amount))}</b></div>
      <div class="row"><span>${esc(t("kassa.receiptPayment"))}</span><span>${esc(paymentLabel(method))}</span></div>
      ${balanceBefore != null ? `<div class="row"><span>${esc(t("credit.wasDebt"))}</span><span>${esc(money(balanceBefore))}</span></div>` : ""}
      <div class="row"><span>${esc(t("kassa.receiptDebtLeft"))}</span><span>${esc(money(balanceAfter ?? 0))}</span></div>
      ${Number(toSavings) > 0 ? `<div class="row"><span>${esc(t("savings.toSavings"))}</span><span>${esc(money(toSavings))}</span></div>` : ""}
      ${Number(bonusEarned) > 0 ? `<div class="row"><span>${esc(t("kassa.receiptBonusEarned"))}</span><span>+${esc(money(bonusEarned))}</span></div>` : ""}
      ${qrUrl ? `<div class="hr"></div><div class="c">
        ${qrSvg(qrUrl, { size: 96, margin: 1 })}
        <small>${esc(t("kassa.receiptQrHint"))}</small>
      </div>` : ""}
      <div class="hr"></div>
      <div class="c"><p>${esc(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`;

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(__debt ? t("kassa.receiptDebtPay") : t("kassa.receiptNo") + " " + saleId)}</title>
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
      /* Qatorga tushgan chegirma — tovar ostida, ichkariroq surilgan. */
      .row.sub { padding-left: 10px; font-size: 11px; }
      .logo { font-size:15px; font-weight:800; letter-spacing:.5px; }
      .off { margin-top:6px; padding:4px; border:1px dashed #000; font-size:10px; text-align:center; }
      .no { font-size:13px; font-weight:800; }
      @media print {
        /* Termal printerda kulrang matn o'qilmaydi — hammasi qora. */
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>
      ${debtBody}
      ${__debt ? "" : `
      <div class="c"><div class="logo">${esc(head.name)}</div>
        ${head.phone ? `<small>${esc(head.phone)}</small><br>` : ""}
        <small>${esc(t("kassa.receiptSystem"))}</small></div>
      <div class="hr"></div>
      <div class="row"><span>${esc(t("kassa.receiptNo"))} ${esc(saleId)}</span><span>${esc(new Date().toLocaleString("uz-UZ"))}</span></div>
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      ${discTotal > 0 ? `<div class="row"><span>${esc(t("kassa.receiptSubtotal"))}</span><span>${esc(money(subtotal ?? (total + discTotal)))}</span></div>
      <div class="row"><span>${esc(t("kassa.discount"))}</span><span>-${esc(money(discTotal))}</span></div>` : ""}
      <div class="row"><b>${esc(t("kassa.receiptTotal"))}</b><b>${esc(money(total))}</b></div>
      <div class="row"><span>${esc(t("kassa.receiptPayment"))}</span><span>${esc(paymentLabel(payType))}</span></div>
      ${Array.isArray(payments) && payments.length > 1
        ? payments.map((p) => `<div class="row"><span>&nbsp;&nbsp;${esc(paymentLabel(p.type))}</span><span>${esc(money(p.amount))}</span></div>`).join("")
        : ""}
      ${customer?.fullName ? `<div class="row"><span>${esc(t("kassa.receiptCustomer"))}</span><span>${esc(customer.fullName)}</span></div>` : ""}
      ${credit && Number(credit.amount) > 0 ? `<div class="hr"></div>
      <div class="c"><b>${esc(t("kassa.receiptCredit"))}</b></div>
      <div class="row"><span>${esc(t("kassa.receiptCreditThis"))}</span><b>${esc(money(credit.amount))}</b></div>
      ${credit.balance != null ? `<div class="row"><span>${esc(t("kassa.receiptCreditTotal"))}</span><span>${esc(money(credit.balance))}</span></div>` : ""}
      ${credit.dueDate ? `<div class="row"><span>${esc(t("kassa.receiptCreditDue"))}</span><span>${esc(credit.dueDate)}</span></div>` : ""}
      <div class="row" style="margin-top:10px"><span>${esc(t("kassa.receiptCreditSign"))}</span><span>______________</span></div>` : ""}
      ${offline ? `<div class="off">${esc(t("kassa.receiptOffline"))}<br>${esc(t("kassa.receiptOfflineSub"))}</div>` : ""}
      ${serverSaleId ? `<div class="c" style="margin-top:6px">
        ${code128Svg(saleCode(serverSaleId), { height: 12 })}
        <div class="no">${esc(saleCode(serverSaleId))}</div>
      </div>` : ""}
      ${receiptUrl ? `<div class="c" style="margin-top:8px">
        ${qrSvg(receiptUrl, { size: 96, margin: 1 })}
        <small>${esc(t("kassa.receiptQrHint"))}</small>
      </div>` : ""}
      <div class="hr"></div>
      <div class="c"><p>${esc(t("kassa.receiptThanks"))}</p><small>e-kassam.uz</small></div>`}
    </body></html>`);
  win.document.close();
  /* Tizim shrifti ishlatilgani uchun kutish shart emas — bir kadr yetadi.
     Chop etilgach oyna O'ZI yopiladi: aks holda kassirning ekranida
     har chekdan keyin bitta ochiq oyna qolib ketardi. */
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 60);
}
