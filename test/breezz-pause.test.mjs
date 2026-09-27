/* ══════════════════════════════════════════════════════════════════════════
   «Breezz'da pauza» tugmasi — kim ko'radi (umumiy hujjat §17, §10.12).

   ⚠ NEGA: tugma sotuv kanalini to'xtatadi. Uni faqat egasi va do'kon
   admini ko'rishi kerak, va faqat filial Breezz'ga ulangan bo'lsa.
   Kassirga tugma ko'rsatib, keyin server 403 bersa — bu faqat umid
   uyg'otardi; ulanmagan filialda esa tugma hech narsani o'zgartirmaydi.

   Ishga tushirish:  node test/breezz-pause.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */
import { canBreezzPause, canBreezzPauseRole, BREEZZ_PAUSE_ROLES } from "../src/lib/ek-breezz.js";

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, got) => { fail++; console.log("  ❌ " + m); if (got !== undefined) console.log("     olindi: " + JSON.stringify(got)); };
const eq  = (a, e, m) => (a === e ? ok(m) : bad(`${m} (kutilgan: ${JSON.stringify(e)})`, a));

console.log("\n═══ 1. Kim bosa oladi ═══");
eq(canBreezzPause("OWNER", true), true, "egasi");
eq(canBreezzPause("SHOP_ADMIN", true), true, "do'kon admini");
eq(canBreezzPause("CASHIER", true), false, "kassir — yo'q");
eq(canBreezzPause("STOREKEEPER", true), false, "omborchi — yo'q");
eq(canBreezzPause(undefined, true), false, "rol noma'lum — yo'q");

console.log("\n═══ 2. Filial ulanmagan — hech kimga ko'rinmaydi ═══");
eq(canBreezzPause("OWNER", false), false, "egasi, ulanmagan");
eq(canBreezzPause("SHOP_ADMIN", undefined), false, "holat hali kelmagan");

console.log("\n═══ 3. Rol shakllari (`roleSet`) ═══");
eq(canBreezzPauseRole("ROLE_OWNER"), true, "«ROLE_» prefiksi bilan");
eq(canBreezzPauseRole("cashier,shop_admin"), true, "vergulli ro'yxat, kichik harf");
eq(canBreezzPauseRole(["CASHIER"]), false, "massiv");
eq(BREEZZ_PAUSE_ROLES.join(), "OWNER,SHOP_ADMIN", "ro'yxat server bilan bir xil (ProductController)");

console.log(`\n${pass} ✅ · ${fail} ❌`);
if (fail) process.exit(1);
