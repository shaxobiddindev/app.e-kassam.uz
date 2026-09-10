/* ══════════════════════════════════════════════════════════════════════════
   G6 — SOZLAMALAR SHABLONDAN TO'LADI, FARQ KO'RINADI, QAYTARILADI

   ⚠ ENG MUHIM SINOV BIRINCHI BO'LIMDA: shablonni ochib, HECH
   NARSAGA TEGMASDAN saqlaganda shablon O'ZGARMASLIGI kerak.
   Eski tahrirlagichda 15/15 tizim shabloni shu paytda A4 varaq
   shabloniga aylanardi — chunki `parse` shablonda YO'Q `sheet`
   ni o'zi qo'shib qo'yardi.

   Ishga tushirish:  node test/label-diff.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import {
  addedFields, diffPaths, fieldPath, formOf, mediaIssues,
  parseSpec, removedFields, resetAll, resetPath, toTemplate, valueAt,
} from "../src/lib/ek-label-diff.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
};
const head = (s) => console.log(`\n── ${s} ──`);

/* Sinov shabloni — ATAY `sheet` siz, tizim shablonlaridagidek. */
const TPL = {
  name: "Javon — oddiy", kind: "SHELF", widthMm: 58, heightMm: 40,
  dpi: 203, thermal: true,
  spec: JSON.stringify({
    lang: "uz", padding: 2, border: true, background: "#fff",
    barcode: { visible: false },
    fields: [
      { key: "name",  x: 2, y: 2,  w: 54, h: 8, size: 9, align: "left", overflow: "shrink" },
      { key: "price", x: 2, y: 12, w: 54, h: 14, size: 20, align: "right" },
      { key: "code",  x: 2, y: 30, w: 54, h: 6, size: 7, prefix: "*" },
    ],
  }),
};

/* ══ 1. TEGMASDAN SAQLASH — SHABLON O'ZGARMASIN ══ */
head("Tegmasdan saqlash");
{
  const form = formOf(TPL);
  const back = toTemplate(form);
  const a = JSON.parse(TPL.spec), b = JSON.parse(back.spec);
  ok("spec ga hech narsa qo'shilmadi",
     JSON.stringify(a) === JSON.stringify(b),
     "qo'shilgan: " + Object.keys(b).filter((k) => !(k in a)).join(", "));
  ok("`sheet` (A4) o'ylab topilmadi", !("sheet" in b));
  ok("o'lchamlar shablondan keldi", back.widthMm === 58 && back.heightMm === 40);
  ok("dpi shablondan keldi", back.dpi === 203);
  ok("termal shablondan keldi", back.thermal === true);
  ok("nom shablondan keldi", back.name === "Javon — oddiy");
}

/* ⚠ HAQIQIY TIZIM SHABLONLARI ustida ham — bittasida emas. */
head("15 ta tizim shabloni (migratsiyadan o'qilgan)");
{
  const mig = path.resolve(import.meta.dirname, "..", "..",
    "api.e-kassam.uz", "src", "main", "resources", "db", "migration",
    "V131__label_system.sql");
  if (!fs.existsSync(mig)) {
    console.log("  ⏭  migratsiya fayli yo'q — o'tkazib yuborildi");
  } else {
    const sql = fs.readFileSync(mig, "utf8");
    const specs = [];
    const re = /\(\s*'([a-z_0-9]+)'\s*,\s*'(SHELF|STICKER)'/g;
    let m;
    while ((m = re.exec(sql))) {
      const rest = sql.slice(re.lastIndex);
      const i = rest.indexOf("{");
      if (i < 0) continue;
      let d = 0, j = i;
      for (; j < rest.length; j++) {
        if (rest[j] === "{") d++;
        else if (rest[j] === "}" && --d === 0) break;
      }
      try { specs.push([m[1], JSON.parse(rest.slice(i, j + 1))]); } catch { /* seed emas */ }
    }
    ok("15 ta shablon o'qildi", specs.length === 15, `topildi: ${specs.length}`);
    const broken = specs.filter(([, sp]) =>
      JSON.stringify(sp) !== JSON.stringify(parseSpec(JSON.stringify(sp))));
    ok("hech biri tegmasdan saqlaganda o'zgarmaydi", broken.length === 0,
       broken.map(([c]) => c).join(", "));
    ok("hech biriga A4 `sheet` qo'shilmaydi",
       specs.every(([, sp]) => !("sheet" in parseSpec(JSON.stringify(sp)))));
  }
}

/* ══ 2. FARQ QILADI ══ */
head("«Shablondan farq qiladi»");
{
  const base = formOf(TPL);
  ok("tegilmagan shaklda farq yo'q", diffPaths(formOf(TPL), base).length === 0);

  const wider = { ...formOf(TPL), widthMm: 60 };
  ok("eni o'zgarsa — belgilanadi", diffPaths(wider, base).includes("widthMm"));
  ok("faqat O'SHA maydon belgilanadi", diffPaths(wider, base).length === 1,
     diffPaths(wider, base).join(", "));

  const f = formOf(TPL);
  f.spec.fields[1] = { ...f.spec.fields[1], size: 24 };
  const d = diffPaths(f, base);
  ok("maydon o'lchami o'zgarsa — belgilanadi", d.includes(fieldPath("price", "size")));
  ok("qo'shni maydon belgilanmaydi", !d.includes(fieldPath("name", "size")));

  /* ⚠ MANZIL TARTIB RAQAMI EMAS, KALIT.
     Sinov TARTIB RAQAMI bilan yiqilishi kerak: birinchi maydon
     o'chirilganda `price` `name` bilan solishtirilib, o'nlab
     soxta «farq» chiqardi. Shuning uchun tasdiq — «`price`
     belgilanadi» emas, «HECH NARSA soxta belgilanmaydi». */
  const clean = formOf(TPL);
  const g = { ...clean, spec: { ...clean.spec, fields: clean.spec.fields.slice(1) } };
  ok("birinchi maydon o'chsa qolganlari soxta belgilanmaydi",
     diffPaths(g, base).length === 0, diffPaths(g, base).join(", "));

  /* ⚠ YOZILMAGAN va YOZILGAN bir xil emas. */
  const h = formOf(TPL);
  h.spec.fields[1] = { ...h.spec.fields[1], overflow: "none" };
  ok("shablonda yo'q qiymat yozilsa — bu ham farq",
     diffPaths(h, base).includes(fieldPath("price", "overflow")));
}

/* ══ 3. QAYTARISH ══ */
head("Shablon qiymatiga qaytarish");
{
  const base = formOf(TPL);
  let f = { ...formOf(TPL), widthMm: 99, heightMm: 11 };
  f = resetPath(f, base, "widthMm");
  ok("bitta maydon qaytdi", f.widthMm === 58);
  ok("qo'shnisi qaytmadi", f.heightMm === 11);

  let g = formOf(TPL);
  g.spec.fields[1] = { ...g.spec.fields[1], size: 40, align: "center" };
  g = resetPath(g, base, fieldPath("price", "size"));
  ok("maydonning bitta xossasi qaytdi", g.spec.fields[1].size === 20);
  ok("boshqa xossasi qaytmadi", g.spec.fields[1].align === "center");

  /* ⚠ SHABLONDA YO'Q QIYMAT — NOLGA EMAS, O'CHIRILADI. */
  let h = formOf(TPL);
  h.spec.fields[1] = { ...h.spec.fields[1], overflow: "clip" };
  h = resetPath(h, base, fieldPath("price", "overflow"));
  ok("shablonda yo'q kalit o'chirildi, nolga aylanmadi",
     !("overflow" in h.spec.fields[1]));

  const all = resetAll(base);
  ok("hammasi qaytdi — o'lchamlar", all.widthMm === 58 && all.heightMm === 40);
  ok("hammasi qaytdi — o'chirilgan maydonlar ham", all.spec.fields.length === 3);
  ok("qaytgandan keyin farq qolmaydi", diffPaths(all, base).length === 0);
  ok("qaytarish asl nusxaga tegmadi", base.widthMm === 58 && base.spec.fields.length === 3);
}

/* ══ 4. QO'SHILGAN VA O'CHIRILGAN MAYDONLAR ══ */
head("Maydon qo'shildi / o'chirildi");
{
  const base = formOf(TPL);
  const f = formOf(TPL);
  f.spec.fields = [...f.spec.fields, { key: "qr", x: 40, y: 2, w: 14, h: 14 }];
  ok("yangi maydon topildi", addedFields(f, base).join() === "qr");
  const g = { ...base, spec: { ...base.spec, fields: base.spec.fields.slice(0, 2) } };
  ok("o'chirilgan maydon topildi", removedFields(g, base).join() === "code");
}

/* ══ 5. MEDIA ALMASHGANDA ══ */
head("Qog'oz almashganda");
{
  const f = formOf(TPL);                       // 58×40
  ok("qog'oz tanlanmagan bo'lsa — jim", mediaIssues(f, null).length === 0);

  const same = { labelWidthMm: 58, labelHeightMm: 40, name: "58×40" };
  ok("mos qog'ozda ogohlantirish yo'q", mediaIssues(f, same).length === 0);

  const small = { labelWidthMm: 30, labelHeightMm: 20, name: "30×20" };

  /* ⚠ SURAT CHAQIRUVDAN OLDIN OLINADI. Bu sinov o'zi ham
     buzib ko'rilganda tutilmadi: surat chaqiruvdan KEYIN
     olinardi, ya'ni jimgina tuzatish allaqachon bo'lib
     ulgurgan holatni «o'zgarmadi» deb tasdiqlardi. */
  const before = JSON.stringify(f);
  const iss = mediaIssues(f, small);
  ok("shakl o'zgarmadi — jimgina tuzatilmadi", JSON.stringify(f) === before);
  ok("tor qog'ozda — yorliq eni aytiladi", iss.some((x) => x.code === "wide"));
  ok("past qog'ozda — yorliq bo'yi aytiladi", iss.some((x) => x.code === "tall"));
  ok("chiqib ketgan maydon aytiladi", iss.some((x) => x.code === "fieldWide"));
  ok("xabar ANIQ SONNI olib yuradi",
     iss.every((x) => typeof x.need === "number" && typeof x.have === "number"));

  /* ⚠ UZLUKSIZ RULONDA BALANDLIK SOLISHTIRILMAYDI. */
  const cont = { labelWidthMm: 58, labelHeightMm: null, name: "58 uzluksiz" };
  ok("uzluksiz qog'ozda bo'y tekshirilmaydi",
     !mediaIssues(f, cont).some((x) => x.code === "tall" || x.code === "fieldTall"));

  /* ⚠ KO'RINMAYDIGAN MAYDON HISOBGA OLINMAYDI. */
  const hid = formOf(TPL);
  hid.spec.fields = hid.spec.fields.map((x) => ({ ...x, visible: false }));
  ok("o'chirilgan maydon uchun ogohlantirilmaydi",
     !mediaIssues(hid, small).some((x) => x.code.startsWith("field")));
}

/* ══ 6. KUTUBXONA TOZA ══ */
head("Kutubxona");
{
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, "..", "src", "lib", "ek-label-diff.js"), "utf8");
  ok("i18n import qilinmagan — node dan sinaladi",
     !/from\s+["'][^"']*ek-i18n/.test(src));
  ok("tarjima kaliti sizib chiqmagan", !/\bt\(["'`]/.test(src));

  ok("buzuq spec dastur to'xtatmaydi", parseSpec("{ buzuq").fields.length === 0);
  ok("spec yo'q bo'lsa ham shakl chiqadi", formOf({}).spec.fields.length === 0);
  ok("manzil bo'yicha qiymat o'qiladi",
     valueAt(formOf(TPL), fieldPath("price", "size")) === 20);
  ok("yo'q maydonda undefined", valueAt(formOf(TPL), fieldPath("yoq", "size")) === undefined);

  /* ⚠ NUSXA OLINADI: tahrir galereyadagi kartochkani buzmasin. */
  const a = formOf(TPL), b = formOf(TPL);
  a.spec.fields[0].x = 99;
  ok("shakllar bir-biriga bog'liq emas", b.spec.fields[0].x === 2);
}

/* ══ 7. TAHRIRLAGICH KOMPONENTI ══ */
head("Tahrirlagich");
{
  const jsx = fs.readFileSync(
    path.resolve(import.meta.dirname, "..", "src", "components", "ek",
                 "LabelTemplateEditor.jsx"), "utf8");
  ok("hisob kutubxonadan olinadi", /ek-label-diff/.test(jsx));
  ok("«farq qiladi» MATNI bor — rang yolg'iz emas", /lbl\.diffMark/.test(jsx));
  ok("bitta maydonni qaytarish tugmasi bor", /lbl\.resetOne/.test(jsx));
  ok("hammasini qaytarish tugmasi bor", /lbl\.resetAll/.test(jsx));
  ok("qaytarish tugmasida aria-label bor", /aria-label=\{t\("lbl\.resetOne"\)\}/.test(jsx));
  ok("qog'oz almashsa ogohlantiradi", /mediaIssues/.test(jsx));
  ok("«o'zi tuzatilmadi» deb yozadi", /lbl\.misfitNoAuto/.test(jsx));

  /* ⚠ O'LIK A4 BO'LIMI QAYTIB KELMASIN. */
  ok("A4 varaq bo'limi yo'q", !/defaultSheet|sheetWidthMm|lbl\.cols/.test(jsx));
  ok("kodga yozilgan o'lchamlar ro'yxati yo'q", !/70x37|50x30/.test(jsx));

  const css = fs.readFileSync(
    path.resolve(import.meta.dirname, "..", "src", "styles.css"), "utf8");
  ok("belgi uslubi yozilgan", /\.lbl-diff\b/.test(css));
  ok("qaytarish tugmasi fokusda ko'rinadi", /\.lbl-diff__undo:focus-visible/.test(css));
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi\n`);
process.exit(fail ? 1 : 0);
