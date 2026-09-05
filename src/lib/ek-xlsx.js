/* ══════════════════════════════════════════════════════════════════════════
   EXCEL FAYLI — O'Z YOZUVCHIMIZ, KUTUBXONASIZ (V71)

   ═══ NEGA KUTUBXONA EMAS ══════════════════════════════════════════════

   `xlsx` (SheetJS) ilovaga ~400 KB, `exceljs` ~900 KB qo'shadi — ya'ni
   butun ilovadan katta. Bu monoblokda ishlaydigan kassir har
   ochilishda kutadigan vaqt, holbuki Excel eksporti kuniga bir marta
   bosiladi. Grafiklar bilan bir xil qaror (`ek/Charts.jsx`): kerakli
   qismini o'zimiz yozamiz.

   ═══ XLSX ASLIDA NIMA ═════════════════════════════════════════════════

   `.xlsx` — bu ZIP arxiv, ichida bir nechta XML fayl. Yozish uchun
   ikkita narsa kerak: ZIP tuzuvchi va XML matni. Ikkalasi ham oddiy.

   ⚠ ZIP SIQMASDAN (`STORE`) yoziladi. Siqish (`DEFLATE`) uchun
   brauzerda `CompressionStream` bor, lekin u ASINXRON va eski
   qurilmalarda yo'q; siqilmagan fayl esa hamma joyda ochiladi va
   hisobot jadvali baribir kichkina (bir necha yuz kilobayt).

   ═══ NEGA `sharedStrings.xml` YO'Q ════════════════════════════════════

   Odatda matnlar alohida lug'atga yig'iladi va katakda uning raqami
   turadi — bu takrorlanuvchi matnlarda joy tejaydi. Bu yerda esa
   `inlineStr` ishlatiladi: matn katakning o'zida. Hisobotda takror
   kam (tovar nomlari noyob), lug'at esa yana bitta fayl, yana bitta
   indeks va yana bitta xatolik manbai bo'lardi.

   ⚠ RAQAM MATN SIFATIDA YOZILSA — Excel uni JAMLAY OLMAYDI va
   foydalanuvchi «nega yig'indi chiqmayapti?» deb qoladi. Shuning
   uchun son va matn ATAYLAB ajratiladi (`typeof value === "number"`).
   ══════════════════════════════════════════════════════════════════════════ */

/* ── CRC-32 (ZIP talab qiladi) ───────────────────────────────────────── */

/**
 * ⚠ Jadval BIR MARTA quriladi va keyin qayta ishlatiladi: har chaqiruvda
 * 256 ta qiymatni qaytadan hisoblash katta jadvalda sezilardi.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s) => new TextEncoder().encode(s);

/* ── XML ─────────────────────────────────────────────────────────────── */

/**
 * XML uchun xavfsiz matn.
 *
 * ⚠ BOSHQARUV BELGILARI TASHLANADI (0x00–0x1F, tab va qatordan
 * tashqari). Tovar nomiga tasodifan tushgan bunday belgi — skanerdan
 * yoki eski importdan — XML ni YAROQSIZ qiladi va Excel faylni
 * «buzilgan» deb umuman ochmaydi. Sabab esa ekranda ko'rinmaydi,
 * chunki bu belgilarning o'zi ko'rinmas.
 */
export function xmlEscape(v) {
  return String(v ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Ustun harfi: 0 → A, 25 → Z, 26 → AA. */
export function colName(i) {
  let n = i, s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/**
 * Varaq nomi — Excel qoidalari bo'yicha.
 *
 * ⚠ Excel `: \ / ? * [ ]` belgilarini QABUL QILMAYDI va nom 31
 * belgidan uzun bo'lolmaydi. Qoidaga rioya qilmasak, fayl ochilmaydi
 * va sabab hech qayerda yozilmaydi.
 */
export function safeSheetName(name, fallback = "Sheet") {
  const clean = String(name ?? "").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return clean || fallback;
}

/** Bitta varaq XML si. */
function sheetXml(rows) {
  const out = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
  ];
  rows.forEach((row, r) => {
    out.push(`<row r="${r + 1}">`);
    (row || []).forEach((cell, c) => {
      if (cell === null || cell === undefined || cell === "") return;   // bo'sh katak yozilmaydi
      const ref = `${colName(c)}${r + 1}`;
      if (typeof cell === "number" && Number.isFinite(cell)) {
        out.push(`<c r="${ref}"><v>${cell}</v></c>`);
      } else if (typeof cell === "object" && cell.bold) {
        /* Sarlavha qatori — `s="1"` uslubi (`styles.xml` da qalin). */
        out.push(`<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`);
      } else {
        out.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`);
      }
    });
    out.push("</row>");
  });
  out.push("</sheetData></worksheet>");
  return out.join("");
}

/* Eng kichik uslub jadvali: 0 — oddiy, 1 — QALIN (sarlavha uchun). */
const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
  + '<borders count="1"><border/></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
  /* ⚠ `cellStyles` — «Normal» nomli standart uslub. Usiz fayl
     ochiladi, lekin dasturlar «kitobda standart uslub yo'q» deb
     ogohlantiradi va o'zinikini qo'yadi: bir xil fayl turli
     dasturlarda boshqacha ko'rinardi. */
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

/* ── ZIP ─────────────────────────────────────────────────────────────── */

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;

  const put = (arr) => { parts.push(arr); offset += arr.length; };
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  for (const f of files) {
    const nameBytes = utf8(f.name);
    const data = utf8(f.data);
    const crc = crc32(data);
    /* ⚠ Sana MUZLATILGAN (1980-01-01). Ikki sabab: bir xil hisobot
       har safar BAYT-BAYT bir xil fayl beradi (taqqoslash oson) va
       mahalliy vaqt mintaqasi natijaga ta'sir qilmaydi. Excel bu
       maydonni umuman ko'rsatmaydi. */
    const head = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x0021),                 // vaqt, sana
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    const localOffset = offset;
    put(new Uint8Array(head));
    put(nameBytes);
    put(data);

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x0021),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(localOffset),
    ]));
    central.push(nameBytes);
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) { parts.push(c); centralSize += c.length; }

  parts.push(new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ]));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/* ── Ommaviy API ─────────────────────────────────────────────────────── */

/**
 * Varaqlardan `.xlsx` bayt massivini quradi.
 *
 * @param sheets `[{ name, rows }]` — `rows` katak massivlari massivi.
 *               Katak: son, matn yoki `{ v, bold }`.
 *
 * ⚠ Bo'sh ro'yxat ham FAYL beradi (bitta bo'sh varaq): Excel nolta
 * varaqli kitobni ochmaydi va foydalanuvchi «eksport ishlamadi» deb
 * o'ylardi — holbuki eksport qilinadigan narsa yo'q edi.
 */
export function buildXlsx(sheets) {
  const list = (sheets && sheets.length ? sheets : [{ name: "Sheet1", rows: [] }]);
  /* ⚠ NOM TAKRORLANMASLIGI SHART — Excel bir xil nomli ikki varaqli
     kitobni ochmaydi. Kesilgandan keyin ikki uzun nom bir xil bo'lib
     qolishi mumkin, shuning uchun tekshiruv KESISHDAN KEYIN. */
  const used = new Set();
  const names = list.map((s, i) => {
    let n = safeSheetName(s.name, `Sheet${i + 1}`);
    let k = 2;
    while (used.has(n.toLowerCase())) n = `${safeSheetName(s.name, "Sheet").slice(0, 28)} ${k++}`;
    used.add(n.toLowerCase());
    return n;
  });

  const files = [
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" `
            + 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")
        + "</Types>",
    },
    {
      name: "_rels/.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + "</Relationships>",
    },
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")
        + "</sheets></workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + names.map((_, i) => `<Relationship Id="rId${i + 1}" `
            + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            + `Target="worksheets/sheet${i + 1}.xml"/>`).join("")
        /* ⚠ Uslub `rId` i varaqlardan KEYIN raqamlanadi: bir xil `rId`
           ikki marta ishlatilsa Excel faylni buzilgan deb ochmaydi. */
        + `<Relationship Id="rId${names.length + 1}" `
        + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + "</Relationships>",
    },
    { name: "xl/styles.xml", data: STYLES_XML },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows || []) })),
  ];

  return zip(files);
}

/**
 * Faylni yuklab beradi (brauzerda).
 *
 * ⚠ `URL.revokeObjectURL` kechiktirilib chaqiriladi: darhol
 * chaqirilganda Safari yuklashni boshlashga ulgurmay, fayl bo'sh
 * chiqardi.
 */
export function downloadXlsx(name, sheets) {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.endsWith(".xlsx") ? name : `${name}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
