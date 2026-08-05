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
  // Pul yashigi: ESC p m t1 t2 — 2-pin, 50ms/250ms impuls.
  // Yashik chek printerining RJ11 uyasiga ulanadi, alohida drayveri yo'q.
  kick:        [ESC, 0x70, 0, 25, 250],
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

  /** Qog'ozni surib kesish. Kesuvchisi yo'q printerda buyruq e'tiborsiz qoladi. */
  cut() { return this.feed(4).raw(CMD.cut); }

  /** Pul yashigini ochish impulsi. */
  kick() { return this.raw(CMD.kick); }

  /** Rust tomoniga uzatish uchun — oddiy son massivi. */
  build() { return this.bytes; }
}

/** Faqat pul yashigini ochish uchun eng qisqa ketma-ketlik. */
export const drawerKickBytes = () => [...CMD.init, ...CMD.kick];
