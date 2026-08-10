/* ══════════════════════════════════════════════════════════════════════════
   ESC/POS — chek printeri uchun baytlar

   Chek printeri HTML tushunmaydi. U 1970-yillardan qolgan ESC/POS
   buyruqlarini oladi: matn baytlari va orasida boshqaruv ketma-ketliklari.
   Shu sababli chek shu yerda BAYT sifatida yig'iladi va Rust tomoniga
   o'zgartirilmasdan uzatiladi.

   NEGA BRAUZER `window.print()` EMAS:
     · har chekda dialog ochiladi — kassir uchun bu qo'shimcha 2 ta bosish
     · qog'oz kesilmaydi, pul yashigi ochilmaydi (bular ESC/POS buyrug'i)
     · drayver HTML ni rasmga aylantiradi — sekin va xiraroq chiqadi

   ⚠ KODLASH: 80mm printerlarning aksariyati kirill/lotin uchun CP866 yoki
   CP1251 ni ishlatadi. O'zbek lotin alifbosi ASCII ga sig'adi, lekin
   `'` (o'g') va `‘` kabi belgilar sig'maydi — ular ASCII apostrofga
   almashtiriladi, aks holda chekka tasodifiy belgi bosiladi.
   ══════════════════════════════════════════════════════════════════════════ */

const ESC = 0x1b, GS = 0x1d;

/** Chek kengligi — 80mm printerda 48 belgi, 58mm da 32. */
export const WIDTH_80 = 48;
export const WIDTH_58 = 32;

/* ── Buyruqlar ─────────────────────────────────────────────────────────── */
const CMD = {
  init:        [ESC, 0x40],                    // ESC @  — holatni tozalash
  alignLeft:   [ESC, 0x61, 0],
  alignCenter: [ESC, 0x61, 1],
  alignRight:  [ESC, 0x61, 2],
  boldOn:      [ESC, 0x45, 1],
  boldOff:     [ESC, 0x45, 0],
  doubleOn:    [GS,  0x21, 0x11],              // eni va bo'yi 2x
  doubleOff:   [GS,  0x21, 0x00],
  // Qog'ozni to'liq kesish (GS V 66 n — n nuqta oldinga surib kesadi)
  cut:         [GS,  0x56, 66, 3],
  // Pul yashigi: ESC p m t1 t2 — 2-pin, t1=ON, t2=OFF (birligi 2 ms).
  // Yashik chek printerining RJ11 uyasiga ulanadi, alohida drayveri yo'q.
  //
  // ⚠ t2 ni KATTALASHTIRMANG. Ilgari `250` (500 ms) edi va chek AYNAN shu
  // yerda to'xtab qolardi: aksariyat ESC/POS proshivkalari impuls davomida
  // qog'ozni surishni to'liq to'xtatadi, ya'ni t1+t2 chek o'rtasidagi
  // ko'rinadigan pauzaga aylanadi. 25/25 = 100 ms, sezilmaydi.
  // Yashik ochilmay qolsa t1 ni 50 (100 ms) gacha ko'taring — t2 ni EMAS,
  // u faqat keyingi impulsgacha bo'lgan eng kam oraliq.
  kick:        [ESC, 0x70, 0, 25, 25],
};

/**
 * Chek matnini printer kodlash jadvaliga moslaydi.
 *
 * ⚠ ATAYLAB soddalashtirilgan: to'liq CP866 jadvali o'rniga faqat XAVFLI
 * belgilar almashtiriladi. Sabab — o'zbek lotin matni ASCII da, kirill esa
 * bu ilovada chek matniga tushmaydi (tovar nomlari foydalanuvchi kiritadi
 * va ular ham lotin). To'liq jadval kerak bo'lsa shu funksiya kengaytiriladi.
 */
function toBytes(text) {
  const normalized = String(text ?? "")
    .replace(/[‘’ʻʼ′]/g, "'")   // o‘/g‘ va turli apostroflar
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // ⚠ HAR QANDAY probel — oddiy ASCII probelga. `money()` razryadlarni
    // UZILMAS probel bilan ajratadi (U+00A0 yoki U+202F) va u ASCII emas:
    // chekda `22?500 so'm` bo'lib chiqardi. Kenglik hisobiga ta'sir
    // qilmaydi — almashtirish bittaga bitta.
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Chek qatorlari `\n` bilan yig'iladi — matn ichidagi tasodifiy
    // tab yoki qator uzilishi tartibni buzmasin.
    .replace(/[\t\r\n\v\f]/g, " ");

  const out = [];
  for (const ch of normalized) {
    const code = ch.codePointAt(0);
    // ASCII — to'g'ridan-to'g'ri. Qolgani printerda tasodifiy belgi bo'lib
    // chiqmasin uchun `?` ga aylanadi: tushunarsiz belgidan ko'ra ochiq
    // savol belgisi yaxshiroq.
    out.push(code < 0x80 ? code : 0x3f);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   Quruvchi — zanjir uslubida
   ══════════════════════════════════════════════════════════════════════════ */
export class Receipt {
  constructor(width = WIDTH_80) {
    this.width = width;
    this.bytes = [...CMD.init];
  }

  raw(arr)      { this.bytes.push(...arr); return this; }
  left()        { return this.raw(CMD.alignLeft); }
  center()      { return this.raw(CMD.alignCenter); }
  right()       { return this.raw(CMD.alignRight); }
  bold(on = true)   { return this.raw(on ? CMD.boldOn : CMD.boldOff); }
  double(on = true) { return this.raw(on ? CMD.doubleOn : CMD.doubleOff); }

  /** Bitta qator + qatar tashlash. */
  line(text = "") { return this.raw(toBytes(text)).raw([0x0a]); }

  /** Bo'sh qatorlar. */
  feed(n = 1) { for (let i = 0; i < n; i++) this.raw([0x0a]); return this; }

  /** Ajratuvchi chiziq — butun kenglik bo'ylab. */
  rule(ch = "-") { return this.line(ch.repeat(this.width)); }

  /**
   * Chap va o'ng ustun — chek uchun eng ko'p kerak bo'ladigan shakl.
   * Sig'masa CHAP tomon qisqartiriladi: narx hech qachon kesilmasligi kerak.
   */
  row(left, right) {
    const l = String(left ?? ""), r = String(right ?? "");
    const space = this.width - r.length;
    if (space < 1) return this.line(r);                 // o'ng tomon o'zi to'ldirdi
    const cut = l.length > space - 1 ? l.slice(0, space - 1) : l;
    return this.line(cut + " ".repeat(this.width - cut.length - r.length) + r);
  }

  /** Uzun matnni kenglik bo'yicha bo'lib yozadi. */
  wrap(text) {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      if (!cur.length) { cur = w; continue; }
      if (cur.length + 1 + w.length <= this.width) cur += " " + w;
      else { this.line(cur); cur = w; }
    }
    if (cur.length) this.line(cur);
    return this;
  }

  /**
   * QR kod — printerning O'Z buyrug'i bilan (`GS ( k`).
   *
   * NEGA KUTUBXONA EMAS: QR ni brauzerda rasmga aylantirib, so'ng uni
   * printerga bitmap sifatida yuborish uchun ham kutubxona, ham rasm
   * yuborish kodi kerak bo'lardi. Printerlarning deyarli hammasi QR ni
   * o'zi chizadi va natija aniqroq chiqadi — termal bosishda bitmap
   * ko'pincha xira bo'ladi va skaner o'qimaydi.
   *
   * `size` — modul kattaligi (1..16). 8 dan kichigi bajik uchun kichik:
   * skaner qiyshiq ushlaganda o'qimaydi.
   */
  qr(text, size = 8) {
    const data = [];
    for (const ch of String(text ?? "")) {
      const code = ch.codePointAt(0);
      if (code < 0x80) data.push(code);   // bajik matni ASCII (EKB- + base64url)
    }
    // Model 2
    this.raw([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // Modul kattaligi
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, size))]);
    // Xatoni tuzatish darajasi: 0x31 = M (~15%). Bajik eskirib, qog'ozi
    // g'ijimlanib qolishi mumkin — eng past daraja yetarli emas.
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]);
    // Ma'lumotni saqlash: pL/pH = uzunlik + 3
    const len = data.length + 3;
    this.raw([GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30]);
    this.raw(data);
    // Chop etish
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    return this;
  }

  /**
   * Code 128 chiziqli barkod — printerning O'Z buyrug'i bilan (`GS k 73`).
   *
   * NEGA QR EMAS: chek raqamini kassir QAYTARISHDA skanerlaydi, do'kondagi
   * skanerlar esa deyarli hammasi bir o'lchovli lazerli va QR ni umuman
   * o'qimaydi. QR faqat bajikda ishlatiladi — u telefon bilan o'qiladi.
   *
   * ⚠ Ma'lumot oldiga `{B` qo'yiladi: bu printerga "Code 128B varianti"
   * degani. Usiz printer o'zi variant tanlaydi va harfli kod (`S-000123`)
   * noto'g'ri kodlanadi.
   *
   * `height` — nuqtada (203 dpi da 60 ≈ 7.5 mm). Pastroq bo'lsa skaner
   * qiyshiq ushlaganda o'qimaydi.
   */
  barcode128(text, { height = 60, width = 2, hri = false } = {}) {
    const raw = String(text ?? "");
    const data = [];
    for (const ch of raw) {
      const code = ch.charCodeAt(0);
      if (code < 32 || code > 127) return this;   // kodlab bo'lmaydi — barkodsiz
      data.push(code);
    }
    if (!data.length) return this;

    this.raw([GS, 0x68, Math.max(1, Math.min(255, height))]);   // GS h — balandlik
    this.raw([GS, 0x77, Math.max(2, Math.min(6, width))]);      // GS w — modul kengligi
    this.raw([GS, 0x48, hri ? 2 : 0]);                          // GS H — raqam barkod OSTIDA

    // `{B` = 0x7B 0x42 — Code 128B varianti
    const payload = [0x7b, 0x42, ...data];
    this.raw([GS, 0x6b, 73, payload.length]);
    this.raw(payload);
    return this;
  }

  /** Qog'ozni surib kesish. Kesuvchisi yo'q printerda buyruq e'tiborsiz qoladi. */
  cut() { return this.feed(4).raw(CMD.cut); }

  /**
   * Pul yashigini ochish impulsi.
   *
   * ⚠ Impuls chek OXIRIGA emas, BOSHIGA qo'yiladi (init'dan keyin darhol) —
   * `kick()` qachon chaqirilganidan qat'i nazar. Impuls davomida printer
   * qog'ozni surmaydi; chek o'rtasida bu ko'rinadigan sakrash bo'lardi,
   * boshida esa hech narsa chiqmagan bo'ladi va sezilmaydi. Yon foydasi:
   * yashik chek chiqib bo'lishini kutmasdan, chek bilan BIRGA ochiladi.
   */
  kick() {
    this.bytes.splice(CMD.init.length, 0, ...CMD.kick);
    return this;
  }

  /** Rust tomoniga uzatish uchun — oddiy son massivi. */
  build() { return this.bytes; }
}

/** Faqat pul yashigini ochish uchun eng qisqa ketma-ketlik. */
export const drawerKickBytes = () => [...CMD.init, ...CMD.kick];
