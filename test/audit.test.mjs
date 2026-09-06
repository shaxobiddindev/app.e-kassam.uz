/* ══════════════════════════════════════════════════════════════════════════
   AMALLAR JURNALI: RO'YXAT TO'LIQ QOLSIN — sinov (V81).

   ═══ QANDAY NOSOZLIKNI QAYTARMASLIK UCHUN ═════════════════════════════

   Ro'yxat `AuditPage.jsx` ichida edi va uni sinovdan tekshirib
   bo'lmasdi (React sahifasini Node'dan yuklab bo'lmaydi). U jimgina
   eskirdi: serverda amal qo'shilardi, bu yerda esa yo'q.

   Natijada do'kon egasiga QIRQ BIRTA amal kelardi, ro'yxatda esa
   yigirmatasi turardi. Qolgani — `TRANSFER_*`, `BONUS_*`,
   `CART_ABANDONED`, `DEVICE_*`, hatto `SUBSCRIPTION_EXPIRED` —
   jurnalda ko'rinardi, lekin ularni TANLAB bo'lmasdi. O'n beshtasining
   yorlig'i ham yo'q edi: ekranda xom kalit chiqardi
   («enum.audit.TRANSFER_SEND»).

   ⚠ SERVER ENUMINI BU YERDAN KO'RIB BO'LMAYDI (boshqa repo). Sinov
   ICHKI ZIDDIYATLARNI ushlaydi: ro'yxatdagi amalning yorlig'i
   yo'qligini, pul to'plamidagi amal ro'yxatda yo'qligini va tillar
   orasidagi farqni. Yangi amal qo'shilganda ikkala joyni ham
   to'ldirishga majbur qiladi.

   Ishga tushirish:  node test/audit.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const { AUDIT_ACTIONS, AUDIT_MONEY } = await import("../src/lib/ek-audit.js");
const UZ = (await import("../src/lib/locales/uz.js")).default;
const RU = (await import("../src/lib/locales/ru.js")).default;
const EN = (await import("../src/lib/locales/en.js")).default;
const LANGS = { uz: UZ, ru: RU, en: EN };

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));
const yes = (v, m) => (v ? ok(m) : bad(m, v));

console.log("\n═══ 1. Ro'yxat butun va takrorsiz ═══");
yes(AUDIT_ACTIONS.length >= 40, `${AUDIT_ACTIONS.length} ta amal`);
eq(new Set(AUDIT_ACTIONS).size, AUDIT_ACTIONS.length, "takrorlanadigan amal yo'q");

console.log("\n═══ 2. ⚠ HAR AMALNING YORLIG'I UCHALA TILDA BOR ═══");
/* Yorliqsiz amal ekranda XOM KALIT bo'lib chiqadi
   («enum.audit.TRANSFER_SEND») — jurnal o'sha zahoti buzilgan
   ko'rinishga tushadi. */
{
  const missing = [];
  for (const [lang, dict] of Object.entries(LANGS)) {
    for (const a of AUDIT_ACTIONS) {
      if (!dict[`enum.audit.${a}`]) missing.push(`${lang}:${a}`);
    }
  }
  missing.length === 0
    ? ok(`${AUDIT_ACTIONS.length} × 3 = ${AUDIT_ACTIONS.length * 3} yorliq joyida`)
    : bad("yorliqsiz amal bor", missing.slice(0, 12));
}

console.log("\n═══ 3. Uchala til bir xil to'plamda ═══");
/* Bitta tilda yorliq qo'shib, boshqasini unutish — eng ko'p
   uchraydigan xato: ruscha ilova xom kalit ko'rsatib qolardi. */
{
  const keys = (d) => Object.keys(d).filter((k) => k.startsWith("enum.audit.")).sort();
  const u = keys(UZ);
  eq(keys(RU).join(), u.join(), "ru = uz");
  eq(keys(EN).join(), u.join(), "en = uz");
}

console.log("\n═══ 4. Pulga tegadigan amallar ro'yxatda ham bor ═══");
/* `MONEY` ro'yxatdan tashqarida qolsa, u qator ajratib ko'rsatilardi,
   lekin filtrда tanlanmasdi — ya'ni belgilangan, lekin topilmaydigan
   qator. */
{
  const lost = [...AUDIT_MONEY].filter((a) => !AUDIT_ACTIONS.includes(a));
  lost.length === 0 ? ok(`${AUDIT_MONEY.size} ta pul amali ro'yxatda`) : bad("ro'yxatda yo'q", lost);
  yes(AUDIT_MONEY.has("SALE_RETURN"), "qaytarish — pul amali");
  yes(AUDIT_MONEY.has("CASH_MOVEMENT"), "naqd harakati — pul amali");
  yes(AUDIT_MONEY.has("BONUS_ADJUST"), "qo'lda qo'shilgan ball — pul amali");
  /* ⚠ Ballni MIJOZ ishlatishi odatiy hodisa — ajratilmaydi, aks holda
     har chekda to'q rangli qator chiqib, belgining ma'nosi yo'qolardi. */
  yes(!AUDIT_MONEY.has("BONUS_SPEND"), "ball ishlatilishi ajratilmaydi");
}

console.log("\n═══ 5. Do'kon ko'radigan amallar ro'yxatda ═══");
/* Bularning hammasi do'kon RAQAMI bilan yoziladi, ya'ni egasiga
   keladi. Ro'yxatda bo'lmasa — ko'rinadi, lekin tanlanmaydi. */
{
  const MUST = ["SALE_RETURN", "SALE_CANCEL", "CASH_MOVEMENT", "SHIFT_CLOSE",
                "CART_ABANDONED", "TRANSFER_SEND", "TRANSFER_RECEIVE", "TRANSFER_CANCEL",
                "BONUS_SPEND", "BONUS_ADJUST", "BONUS_EXPIRE", "CUSTOMER_ARCHIVE",
                "LOYALTY_TIER_CHANGE", "DEVICE_TRUSTED", "DEVICE_CONFIRMED",
                "STORE_SWITCH", "ANNOUNCEMENT_CHANGE",
                "SHOP_UPDATE", "SHOP_STATUS_CHANGE", "PAYMENT_REGISTER",
                "SUBSCRIPTION_EXPIRED", "SHOP_DIRECTIONS_CHANGE", "SHOP_FEATURE_CHANGE"];
  const lost = MUST.filter((a) => !AUDIT_ACTIONS.includes(a));
  lost.length === 0 ? ok(`${MUST.length} ta amal ro'yxatda`) : bad("ro'yxatda yo'q", lost);
}

console.log("\n═══ 6. ⚠ ADMIN PANELINING ICHKI AMALLARI RO'YXATDA YO'Q ═══");
/* Ular do'kon raqamiSIZ yoziladi va do'konga HECH QACHON kelmaydi.
   Filtrga qo'yilsa, egasi tanlab, har safar bo'sh ro'yxat ko'rardi va
   «jurnal ishlamayapti» deb o'ylardi. */
{
  const NEVER = ["ADMIN_LOGIN", "ADMIN_CREATE", "ADMIN_UPDATE", "ADMIN_DELETE",
                 "ADMIN_ENABLE", "ADMIN_DISABLE", "ADMIN_PASSWORD_RESET",
                 "CONTACT_HANDLED", "CONTACT_STATUS", "IMPERSONATE"];
  const wrong = NEVER.filter((a) => AUDIT_ACTIONS.includes(a));
  wrong.length === 0 ? ok("admin amallari ro'yxatga kirmagan") : bad("ortiqcha amal", wrong);
}

console.log("\n═══ 7. ⚠ BELGI USLUBI CSS DA HAQIQATAN BOR ═══");
/* Sahifa `badge-orange` ishlatardi, `styles.css` da esa bunday sinf
   YO'Q edi. Natija maqsadning teskarisi: pulga tegadigan qator —
   jurnalning butun ma'nosi — yagona FONSIZ qator bo'lib chiqardi,
   qolgan hammasi ko'k belgi bilan turardi. Xato hech qayerda
   ko'rinmasdi: noma'lum sinf brauzerda jimgina e'tiborsiz qoladi. */
{
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../src/pages/AuditPage.jsx", import.meta.url), "utf8");
  const used = [...page.matchAll(/badge-\$\{[^}]*\?\s*"(\w+)"\s*:\s*"(\w+)"/g)]
    .flatMap((m) => [m[1], m[2]]);
  yes(used.length >= 2, `sahifada ${used.length} ta belgi rangi: ${used.join(", ")}`);
  const ghost = used.filter((c) => !css.includes(`.badge-${c}`));
  ghost.length === 0 ? ok("hamma rang `styles.css` da aniqlangan")
                     : bad("CSS da yo'q sinf", ghost);
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
