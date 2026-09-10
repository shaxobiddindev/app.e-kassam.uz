/**
 * ══════════════════════════════════════════════════════════════════════════
 * YORLIQ VALIDATSIYASI — MAYDON VA MAYDONLARARO (F4)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ ASOSIY QISM — MAYDONLARARO TEKSHIRUV, va ko'pincha aynan shu
 * unutiladi. Har bir qiymat alohida to'g'ri bo'lishi mumkin:
 * chekka 10 mm — normal, ustun 5 ta — normal, yorliq 70 mm — normal.
 * Lekin birgalikda ular A4 ga sig'maydi va buni faqat qo'shib
 * ko'rgandagina bilasiz.
 *
 * ⚠ XATO ANIQ SONNI AYTADI. «Sig'madi» degan xabar foydalanuvchini
 * taxmin qilishga majbur qiladi: nechtasini kamaytirsam ekan?
 * «11,4 mm toshdi, ustunni 4 ga tushiring yoki chekkani 5 mm ga
 * kamaytiring» — bu bajariladigan ko'rsatma.
 *
 * ⚠ XATO va OGOHLANTIRISH AJRATILADI:
 *   · xato — chop etishni TO'SADI (fizik jihatdan chiqmaydi);
 *   · ogohlantirish — to'smaydi, lekin bilib qo'yish kerak
 *     (nom kesiladi, shrift kichik, termalda rang tanlangan).
 *
 * ⚠ BU FRONT TEKSHIRUVI — QULAYLIK. Kafolat serverda: front
 * chetlab o'tilishi mumkin (eski ilova, to'g'ridan-to'g'ri so'rov).
 * Ikkalasi bir xil qoidani qo'llashi SHART; qoidalar shuning uchun
 * shu yerda RAQAM bilan yozilgan va serverdagi bilan bir xil.
 */
import { barcodeMetrics } from "./ek-label-barcode.js";

/** Chegaralar — server bilan AYNAN BIR XIL bo'lishi shart. */
export const LIMITS = {
  labelMm:   { min: 10,  max: 210 },
  sheetMm:   { min: 50,  max: 420 },
  marginMm:  { min: 0,   max: 50 },
  gapMm:     { min: 0,   max: 20 },
  fontPt:    { min: 4,   max: 72 },
  quantity:  { min: 1,   max: 999 },
  gridMin:   1,
  confirmOver: 500,
};

const err = (field, text) => ({ level: "error", field, text });
const warn = (field, text) => ({ level: "warning", field, text });
const mm1 = (n) => Math.round(Number(n) * 10) / 10;

/** Musbat, bitta kasr xonagacha, chegara ichida. */
function checkMm(out, field, value, { min, max }, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) { out.push(err(field, `${label}: son emas`)); return; }
  if (n < min || n > max) {
    out.push(err(field, `${label}: ${mm1(n)} mm — ${min}…${max} mm oralig'ida bo'lishi kerak`));
    return;
  }
  if (Math.abs(n * 10 - Math.round(n * 10)) > 1e-9) {
    out.push(err(field, `${label}: ${n} mm — faqat bitta kasr xona (${mm1(n)})`));
  }
}

/**
 * Shablonning O'ZI.
 *
 * @returns {Array<{level, field, text}>}
 */
export function validateTemplate(tpl) {
  const out = [];
  const spec = typeof tpl.spec === "string" ? safeParse(tpl.spec, out) : (tpl.spec || {});
  if (!spec) return out;

  checkMm(out, "widthMm",  tpl.widthMm,  LIMITS.labelMm, "Yorliq kengligi");
  checkMm(out, "heightMm", tpl.heightMm, LIMITS.labelMm, "Yorliq balandligi");

  if (![203, 300].includes(Number(tpl.dpi))) {
    out.push(err("dpi", `Printer zichligi: ${tpl.dpi} — 203 yoki 300 bo'lishi kerak`));
  }
  if (!["SHELF", "STICKER"].includes(tpl.kind)) {
    out.push(err("kind", `Tur noma'lum: ${tpl.kind}`));
  }

  /* ⚠ TERMAL PRINTERDA RANG YO'Q. Xato emas — ogohlantirish: shablon
     baribir chiqadi, faqat rang qora bo'lib qoladi. Sababi yozilmasa
     do'konchi «rang nega ishlamadi?» deb o'ylardi. */
  if (tpl.thermal && spec.background && spec.background !== "#ffffff"
      && spec.background !== "#fff") {
    out.push(warn("background",
      "Termal printerda rang yo'q — fon oq bo'lib chiqadi"));
  }

  const W = Number(tpl.widthMm), H = Number(tpl.heightMm);
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  if (!fields.length) out.push(err("fields", "Shablonda birorta maydon yo'q"));

  for (const f of fields) {
    const tag = f.key || "?";
    if (f.visible === false) continue;

    for (const [k, label] of [["x", "chapdan"], ["y", "tepadan"],
                              ["w", "kengligi"], ["h", "balandligi"]]) {
      const n = Number(f[k]);
      if (!Number.isFinite(n) || n < 0) {
        out.push(err(tag, `${tag}: ${label} noto'g'ri (${f[k]})`));
      }
    }

    if (f.size != null) {
      const s = Number(f.size);
      if (!Number.isFinite(s) || s < LIMITS.fontPt.min || s > LIMITS.fontPt.max) {
        out.push(err(tag, `${tag}: shrift ${f.size} pt — `
          + `${LIMITS.fontPt.min}…${LIMITS.fontPt.max} pt oralig'ida bo'lishi kerak`));
      }
    }

    /* ⚠ MAYDON YORLIQDAN CHIQMASIN — necha mm chiqqani aytiladi. */
    const overW = Number(f.x) + Number(f.w) - W;
    const overH = Number(f.y) + Number(f.h) - H;
    if (overW > 0.001) {
      out.push(err(tag, `${tag}: o'ngdan ${mm1(overW)} mm chiqib ketdi`));
    }
    if (overH > 0.001) {
      out.push(err(tag, `${tag}: pastdan ${mm1(overH)} mm chiqib ketdi`));
    }

    /* Shrift balandligi × qatorlar ≤ maydon balandligi. */
    if (f.size && f.lines) {
      const need = Number(f.size) * 0.352778 * 1.2 * Number(f.lines);
      if (need > Number(f.h) + 0.001) {
        out.push(warn(tag, `${tag}: ${f.lines} qator ${Number(f.size)} pt bilan `
          + `${mm1(need)} mm joy oladi, maydon esa ${mm1(f.h)} mm`));
      }
    }
  }

  /* ⚠ BARKOD — ENG JIMGINA BUZILADIGAN JOY. */
  const bc = fields.find((f) => f.key === "barcode" && f.visible !== false);
  if (bc) {
    const cfg = spec.barcode || {};
    const dots = Number(cfg.moduleDots ?? 2);
    if (![2, 3].includes(dots)) {
      out.push(err("barcode", `Modul ${dots} nuqta — 2 yoki 3 bo'lishi kerak: `
        + "oraliq qiymatda printer chiziqlarni turlicha yaxlitlaydi va skaner o'qimaydi"));
    } else {
      /* Namunaviy EAN-13 bilan o'lchaymiz: eng keng holat. */
      const m = barcodeMetrics("5901234123457", {
        dpi: Number(tpl.dpi), moduleDots: dots,
        quietLeftModules: cfg.quietLeftModules ?? 9,
        quietRightModules: cfg.quietRightModules ?? 7,
        heightMm: Number(bc.h),
        labelKind: tpl.kind,
      });
      if (m && m.widthMm > Number(bc.w) + 0.001) {
        out.push(err("barcode", `EAN-13 uchun ${mm1(m.widthMm)} mm kerak, `
          + `joy ${mm1(bc.w)} mm — ${mm1(m.widthMm - bc.w)} mm yetmayapti`));
      }
      if (m && !m.ok) {
        /* ⚠ CHEGARA YORLIQ TURIGA QARAB (`EAN_MIN_MM`): javon
           yorlig'ida 12 mm, noma'lum turda 18 mm. Bitta son bo'lganda
           bu ogohlantirish 15 ta tizim shablonining 14 tasida har
           doim yonardi. */
        out.push(warn("barcode", `Barkod balandligi ${mm1(bc.h)} mm — `
          + `tavsiya etilgani ${m.minHeightMm} mm; pastroqda skaner ishonchsiz`));
      }
    }
  }

  return out;
}

/**
 * VARAQ JOYLASHUVI — maydonlararo tekshiruvning asosiy qismi.
 *
 * ⚠ Bu yerda har bir qiymat alohida to'g'ri bo'lishi mumkin, lekin
 * YIG'INDISI varaqqa sig'maydi.
 */
export function validateSheet(tpl, sheet) {
  const out = [];
  const s = sheet || {};

  checkMm(out, "sheetWidthMm",  s.sheetWidthMm,  LIMITS.sheetMm, "Varaq kengligi");
  checkMm(out, "sheetHeightMm", s.sheetHeightMm, LIMITS.sheetMm, "Varaq balandligi");
  checkMm(out, "marginLeftMm",  s.marginLeftMm,  LIMITS.marginMm, "Chap chekka");
  checkMm(out, "marginRightMm", s.marginRightMm, LIMITS.marginMm, "O'ng chekka");
  checkMm(out, "marginTopMm",   s.marginTopMm,   LIMITS.marginMm, "Tepa chekka");
  checkMm(out, "marginBottomMm", s.marginBottomMm, LIMITS.marginMm, "Past chekka");
  checkMm(out, "gapXMm", s.gapXMm, LIMITS.gapMm, "Ustunlar orasi");
  checkMm(out, "gapYMm", s.gapYMm, LIMITS.gapMm, "Qatorlar orasi");

  const cols = Number(s.cols), rows = Number(s.rows);
  for (const [k, n, label] of [["cols", cols, "Ustunlar"], ["rows", rows, "Qatorlar"]]) {
    if (!Number.isInteger(n) || n < LIMITS.gridMin) {
      out.push(err(k, `${label}: ${s[k]} — butun son va kamida ${LIMITS.gridMin} bo'lishi kerak`));
    }
  }
  if (out.some((x) => x.level === "error")) return out;

  const W = Number(tpl.widthMm), H = Number(tpl.heightMm);

  /* ⚠ ANIQ SON: necha mm toshgani va NIMA QILISH kerakligi. */
  const needW = Number(s.marginLeftMm) + Number(s.marginRightMm)
              + cols * W + (cols - 1) * Number(s.gapXMm);
  if (needW > Number(s.sheetWidthMm) + 0.001) {
    const over = needW - Number(s.sheetWidthMm);
    const fit = Math.max(1, Math.floor(
      (Number(s.sheetWidthMm) - Number(s.marginLeftMm) - Number(s.marginRightMm)
        + Number(s.gapXMm)) / (W + Number(s.gapXMm))));
    out.push(err("cols", `Eniga ${mm1(over)} mm toshdi — ustunni ${fit} ga tushiring `
      + `yoki chekkani ${mm1(Math.min(over, Number(s.marginLeftMm)))} mm ga kamaytiring`));
  }

  const needH = Number(s.marginTopMm) + Number(s.marginBottomMm)
              + rows * H + (rows - 1) * Number(s.gapYMm);
  if (needH > Number(s.sheetHeightMm) + 0.001) {
    const over = needH - Number(s.sheetHeightMm);
    const fit = Math.max(1, Math.floor(
      (Number(s.sheetHeightMm) - Number(s.marginTopMm) - Number(s.marginBottomMm)
        + Number(s.gapYMm)) / (H + Number(s.gapYMm))));
    out.push(err("rows", `Bo'yiga ${mm1(over)} mm toshdi — qatorni ${fit} ga tushiring `
      + `yoki chekkani ${mm1(Math.min(over, Number(s.marginTopMm)))} mm ga kamaytiring`));
  }

  const perPage = cols * rows;
  const start = Number(s.startPosition ?? 1);
  if (!Number.isInteger(start) || start < 1 || start > perPage) {
    out.push(err("startPosition",
      `Boshlanish pozitsiyasi: ${s.startPosition} — 1 dan ${perPage} gacha bo'lishi kerak`));
  }

  return out;
}

/** Navbat: soni va umumiy hajm. */
export function validateJob(items, sheet) {
  const out = [];
  let total = 0;
  for (const it of items || []) {
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q < LIMITS.quantity.min || q > LIMITS.quantity.max) {
      out.push(err("quantity", `«${it.product?.name ?? it.productId}»: soni ${it.quantity} — `
        + `${LIMITS.quantity.min}…${LIMITS.quantity.max} oralig'ida butun son bo'lishi kerak`));
    } else total += q;
  }
  /* ⚠ TASDIQ SO'RALADI, TO'SILMAYDI: 312 varaq chiqarish qonuniy ish,
     lekin tasodifan bosilgan tugma bo'lsa qimmatga tushadi. */
  if (total > LIMITS.confirmOver) {
    const per = Math.max(1, Number(sheet?.cols || 1) * Number(sheet?.rows || 1));
    out.push(warn("total", `${total} ta yorliq — ${Math.ceil(total / per)} varaq chiqadi`));
  }
  return out;
}

/**
 * ══════════════════════════════════════════════════════════════════
 * QOG'OZ ↔ PRINTER ↔ SHABLON (G7)
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠ O'LCHANDI: tayyor profillar bilan 112 ta qog'oz+printer
 * juftligi tuzish mumkin va ULARNING 21 TASI FIZIK JIHATDAN
 * CHIQMAYDI — yorliq printerning chop kalladan keng. Bugun
 * ulardan birortasi ham to'silmaydi: do'konchi saqlaydi, chop
 * etadi va yorliqning o'ng chekkasi kesilib chiqadi.
 *
 * ⚠ XATO MATNI HARAKATNI AYTADI. «Noto'g'ri qiymat» degan
 * xabar foydasiz: do'konchi nima qilishni bilmaydi. Shuning
 * uchun har bir xabarda IKKITA YO'L bor — nimani kichraytirish
 * yoki nimani almashtirish.
 *
 * ⚠ SERVERDA HAM SHU QOIDALAR (`LabelOutputValidator`). Front —
 * qulaylik, server — kafolat.
 *
 * @param media   qog'oz profili (null bo'lsa — tekshiruv yo'q)
 * @param printer printer profili (null bo'lsa — faqat qog'oz qoidalari)
 * @param tpl     shablon (null bo'lsa — shablon qoidalari o'tkaziladi)
 */
export function validateOutput(media, printer, tpl) {
  const out = [];
  if (!media) return out;

  const w  = Number(media.labelWidthMm);
  const h  = media.labelHeightMm === null || media.labelHeightMm === undefined
    ? null : Number(media.labelHeightMm);
  const ac = Math.max(1, Number(media.across) || 1);
  const gx = Number(media.gapXMm) || 0;
  const gy = Number(media.gapYMm) || 0;
  const liner = media.linerWidthMm === null || media.linerWidthMm === undefined
    ? null : Number(media.linerWidthMm);

  /* Qatorda nechta yorliq + oralaridagi bo'shliq. */
  const rowMm = w * ac + (ac - 1) * gx;

  /* ── 1. PODLOSHKAGA SIG'ADIMI ── */
  if (liner !== null && rowMm > liner + 0.001) {
    const fit = Math.max(1, Math.floor((liner + gx) / (w + gx)));
    out.push(err("across", `${ac} ta ${mm1(w)} mm yorliq va oraliqlar `
      + `${mm1(rowMm)} mm joy oladi, podloshka esa ${mm1(liner)} mm — `
      + `qatorda ${fit} ta yorliqli rulon tanlang yoki yorliqni kichraytiring`));
  }

  /* ── 2. PRINTERNING CHOP KENGLIGIGA SIG'ADIMI ──
     ⚠ ENG KO'P UCHRAYDIGAN XATO (PROMPT G, 7-bo'lim). */
  if (printer) {
    const pw = Number(printer.printWidthMm);
    if (Number.isFinite(pw) && rowMm > pw + 0.001) {
      out.push(err("printer", `${mm1(pw)} mm printerga ${mm1(rowMm)} mm yorliq `
        + `sig'maydi — yorliqni ${mm1(pw)} mm ga tushiring `
        + `yoki chop kengligi kattaroq printer tanlang`));
    }
  }

  /* ── 3. UZLUKSIZ RULONDA BALANDLIK MAJBURIY ──
     ⚠ Printer yorliq qayerda tugashini O'ZI BILA OLMAYDI: oraliq
     ham, qora belgi ham yo'q. Balandlik berilmasa u lentani
     to'xtovsiz tortadi. */
  if (String(media.sensor) === "UZLUKSIZ" && h === null) {
    /* ⚠ ANIQ SON XABARDA BO'LISHI SHART, yo'q qiymat haqidagi
       xatoda ham: «balandlikni yozing» degan xabar do'konchini
       «qancha?» degan savol bilan qoldiradi. Tayyor chek lentasi
       profillarida balandlik 40 mm. */
    out.push(err("labelHeightMm", "Uzluksiz lentada printer yorliq qayerda "
      + "tugashini bilmaydi — yorliq balandligini mm da yozing, odatda 30–40 mm"));
  }

  /* ── 4. ORALIQ / QORA BELGI DA — ORALIQ QIYMATI ──
     ⚠ Datchik aynan shu bo'shliqni ko'rib yorliqni sanaydi. Nol
     bo'lsa u hech narsa ko'rmaydi va rulon bir tekis oqib ketadi. */
  const sensed = ["ORALIQ", "QORA_BELGI"].includes(String(media.sensor));
  if (sensed && String(media.mediaType) === "RULON" && !(gy > 0)) {
    out.push(err("gapYMm", `«${sensorName(media.sensor)}» datchigi yorliqlar `
      + "orasidagi bo'shliqni o'lchaydi — oraliqni yozing, odatda 2–3 mm"));
  }

  if (!tpl) return out;

  /* ── 5. SHABLON DPI SI ↔ PRINTER DPI SI, FAQAT BAYT YO'LIDA ──
     ⚠ SABABI ANIQ VA O'LCHANGAN. Bayt yo'lida barkod moduli
     printerga NUQTADA yuboriladi (`BARCODE …,narrow,…`), joylashuv
     esa uning mm dagi enini SHABLON dpi si bilan hisoblaydi. Ikkisi
     ajralsa: 203 dpi da 2 nuqta = 0,250 mm, 300 dpi da esa
     0,169 mm — barkod joylashuv ajratgan joydan 32% tor chiqadi
     va X-o'lchami GS1 minimumidan (0,264 mm) pastga tushadi.
     Yorliq ko'zga normal ko'rinadi, skaner o'qimaydi.

     ⚠ DRAYVER VA CHEK YO'LIDA BU QOIDA YO'Q va bu ataylab: u
     yerda chizma mm da beriladi, nuqtaga aylantirishni drayver
     yoki brauzer o'zi qiladi. A4 lazer 300 dpi bo'lgani uchun
     203 dpi shablonni rad etish 15/15 tizim shablonini A4 da
     ishlamas qilib qo'yardi — ya'ni ishlayotgan narsani buzardi. */
  if (printer && BYTE_LANGS.includes(String(printer.lang || "").toUpperCase())
      && Number(tpl.dpi) !== Number(printer.dpi)) {
    const tMm = mm3(2 * 25.4 / Number(tpl.dpi));
    const pMm = mm3(2 * 25.4 / Number(printer.dpi));
    out.push(err("dpi", `Dizayn ${tpl.dpi} dpi uchun chizilgan, printer esa `
      + `${printer.dpi} dpi — barkod moduli ${tMm} mm o'rniga ${pMm} mm bo'lib `
      + `chiqadi; dizayn zichligini ${printer.dpi} ga o'zgartiring `
      + "yoki mos printer tanlang"));
  }

  /* ── 6. YORLIQ QOG'OZDAN KATTA BO'LMASIN ── */
  const tw = Number(tpl.widthMm), th = Number(tpl.heightMm);
  if (Number.isFinite(tw) && tw > w + 0.001) {
    out.push(err("widthMm", `Dizayn eni ${mm1(tw)} mm, qog'oz eni ${mm1(w)} mm — `
      + `dizaynni ${mm1(w)} mm ga tushiring yoki kengroq qog'oz tanlang`));
  }
  /* ⚠ Uzluksiz lentada bo'y solishtirilmaydi: u kerakli joyidan kesiladi. */
  if (h !== null && Number.isFinite(th) && th > h + 0.001) {
    out.push(err("heightMm", `Dizayn bo'yi ${mm1(th)} mm, qog'oz bo'yi ${mm1(h)} mm — `
      + `dizaynni ${mm1(h)} mm ga tushiring yoki balandroq qog'oz tanlang`));
  }

  /* ── 7. STIKERDA BARKOD + TINCH ZONA QOG'OZGA SIG'SIN ──
     ⚠ TINCH ZONA — BARKODNING BIR QISMI. Uni chekkaga taqab
     qo'yish barkodni o'qilmas qiladi, garchi chiziqlarning
     o'zi to'la chizilgan bo'lsa ham. */
  const spec = typeof tpl.spec === "string" ? safeParse(tpl.spec, out) : (tpl.spec || {});
  const bc = (spec?.fields || []).find((f) => f.key === "barcode" && f.visible !== false);
  if (bc) {
    const cfg = spec.barcode || {};
    const m = barcodeMetrics("5901234123457", {
      dpi: Number(printer?.dpi ?? tpl.dpi), moduleDots: Number(cfg.moduleDots ?? 2),
      quietLeftModules: cfg.quietLeftModules ?? 9,
      quietRightModules: cfg.quietRightModules ?? 7,
      heightMm: Number(bc.h), labelKind: tpl.kind,
    });
    const pad = Number(spec.padding) || 0;
    if (m && m.widthMm + 2 * pad > w + 0.001) {
      out.push(err("barcode", `Barkod tinch zonasi bilan ${mm1(m.widthMm)} mm, `
        + `chekkalar bilan ${mm1(m.widthMm + 2 * pad)} mm — qog'oz esa ${mm1(w)} mm; `
        + "modulni 2 nuqtaga tushiring yoki kengroq qog'oz tanlang"));
    }
  }

  return out;
}

/* ⚠ BAYT TILLARI — `ek-label-bytes.js` dagi ro'yxat bilan bir xil.
   Import qilinmadi: validatsiya kutubxonasi bayt yo'liga bog'lanib
   qolmasin, ikkalasi ham mustaqil sinaladi. */
const BYTE_LANGS = ["TSPL", "ZPL"];
const mm3 = (n) => (Math.round(Number(n) * 1000) / 1000).toString();

const SENSORS = { ORALIQ: "Oraliq", QORA_BELGI: "Qora belgi", UZLUKSIZ: "Uzluksiz" };
const sensorName = (s) => SENSORS[String(s)] || String(s);

/** Faqat xatolar chop etishni to'sadi. */
export const blocking = (list) => (list || []).filter((x) => x.level === "error");

function safeParse(text, out) {
  try { return JSON.parse(text); }
  catch (e) { out.push(err("spec", "Shablon tuzilishi buzuq: " + e.message)); return null; }
}
