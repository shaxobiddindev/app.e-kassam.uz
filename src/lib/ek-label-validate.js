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

/** Faqat xatolar chop etishni to'sadi. */
export const blocking = (list) => (list || []).filter((x) => x.level === "error");

function safeParse(text, out) {
  try { return JSON.parse(text); }
  catch (e) { out.push(err("spec", "Shablon tuzilishi buzuq: " + e.message)); return null; }
}
