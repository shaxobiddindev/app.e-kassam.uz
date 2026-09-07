/* ══════════════════════════════════════════════════════════════════════════
   Markirovka kodidagi muddat — KASSIR EKRANIDA (V85, 7-bosqich).

   ⚠ NEGA BU SINOV BOR

   Serverdan bu yerga TOZA SANA keladi: `"2026-10-31"`, vaqtsiz va vaqt
   mintaqasisiz. Uni ekranda ko'rsatishning ikki yo'li bor va ular
   BIR XIL EMAS:

     `fmtDate` → `new Date("2026-10-31")` → UTC yarim tuni deb o'qiladi
                 → foydalanuvchi mintaqasiga qarab sana BIR KUNGA
                   surilishi mumkin

     `shortDate` → matnni matn sifatida o'giradi, `new Date` umuman
                   ishlatilmaydi → surilish YO'Q

   Muddatda bir kun — «sotsa bo'ladi» va «bo'lmaydi» orasidagi farq.
   Server tovarni bloklaydi, ekranda esa kechagi sana turadi va kassir
   nima bo'layotganini tushunmaydi. Shuning uchun bu tanlov sinov bilan
   qotirib qo'yildi: kelajakda kimdir «bir xil-ku» deb `fmtDate` ga
   almashtirsa, sinov darhol yiqiladi.

   Ishga tushirish:  node test/mark-expiry.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import path from "node:path";
import { shortDate } from "../src/lib/ek-format.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m);
                          if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (actual, expected, msg) =>
  (actual === expected ? ok(msg) : bad(`${msg} (kutilgan: ${JSON.stringify(expected)})`, actual));

console.log("\n══ Kod ichidagi muddat: sana surilmaydi ══");

/* ⚠ ASOSIY BAND. Server `LocalDate` yuboradi — `InventoryResponse.expiryDate`
   allaqachon shunday ishlaydi va partiyalar jadvalida shu tarzda
   chiziladi. Ya'ni bu shartnoma yangi emas, shunchaki yana bir joyda
   ishlatildi. */
eq(shortDate("2026-10-31"), "31-10-2026", "toza sana o'girildi");
eq(shortDate("2026-01-01"), "01-01-2026", "yil boshi");
eq(shortDate("2026-12-31"), "31-12-2026", "yil oxiri");

/* ⚠ MINTAQADAN QAT'I NAZAR BIR XIL. `new Date` ishlatilganda ayni shu
   band mintaqa manfiy bo'lganda yiqilardi (Amerika soat mintaqalari). */
{
  const before = process.env.TZ;
  let same = true;
  for (const tz of ["UTC", "Asia/Tashkent", "America/New_York", "Pacific/Kiritimati"]) {
    process.env.TZ = tz;
    if (shortDate("2026-10-31") !== "31-10-2026") same = false;
  }
  if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  same ? ok("to'rt mintaqada ham bir xil sana")
       : bad("mintaqa sanani surdi — `new Date` ishlatilyapti");
}

/* Muddat yo'q bo'lsa — komponent umuman chizmaydi, lekin himoya
   ikkinchi qatlamda ham bo'lsin. */
eq(shortDate(null), "—", "muddatsiz kod — «—»");
eq(shortDate(""), "—", "bo'sh qiymat — «—»");

console.log("\n══ Komponent to'g'ri funksiyani chaqiradi ══");
{
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "../src/components/MarkingScanModal.jsx"), "utf8");

  /* ⚠ Bu band MATNNI tekshiradi va bu ataylab: yuqoridagi bandlar
     `shortDate` TO'G'RI ishlashini isbotlaydi, bu esa komponent
     AYNAN O'SHANI ishlatishini. Ikkinchisisiz birinchisi bekor
     bo'lardi — funksiya to'g'ri, lekin chaqirilmaydi. */
  /\bshortDate\(c\.expiryDate\)/.test(src)
    ? ok("`shortDate(c.expiryDate)` chaqirilgan")
    : bad("komponent `shortDate` ishlatmayapti");

  /\bfmtDate\s*\(/.test(src)
    ? bad("`fmtDate` qaytib kelgan — sana surilishi mumkin")
    : ok("`fmtDate` ishlatilmagan");

  /* Server maydonini o'qish — busiz sana hech qachon ko'rinmaydi. */
  /expiryDate:\s*r\.expiryDate/.test(src)
    ? ok("server javobidan `expiryDate` olinadi")
    : bad("server javobidagi `expiryDate` o'qilmayapti");
}

console.log(`\n${fail ? "❌" : "✅"} muddat ko'rinishi: ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
