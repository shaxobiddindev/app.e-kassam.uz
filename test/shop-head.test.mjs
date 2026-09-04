/* ══════════════════════════════════════════════════════════════════════════
   CHEK SARLAVHASI — DO'KON NOMI VA TELEFONI (V62)

   ⚠ NEGA SINOV KERAK. Bu yerda ikkita xato bir joyda uchrashadi va
   ikkalasi ham JIM buziladi — chek baribir chiqadi, faqat noto'g'ri
   ma'lumot bilan:

     · nom zanjiri uzilsa, chekda do'konning KODI qoladi (aynan shu
       xato yillar davomida sezilmagan: `ek_shopName` sakkiz joyda
       o'qilardi va hech qayerda yozilmasdi);

     · telefon sozlamasi e'tiborsiz qolsa, do'kon uni o'chirib qo'yib
       ham raqamini qog'ozda ko'raverardi — ya'ni sozlama YOLG'ON
       bo'lardi.

   ⚠ `ek-hardware.js` EMAS, `ek-shop-print.js` sinaladi: mantiq shu
   yerda, birinchisi esa tarjima va apparat sozlamalarini talab qiladi.

   Ishga tushirish:  node test/shop-head.test.mjs
   ══════════════════════════════════════════════════════════════════════════ */

/* Node da `localStorage` yo'q — eng kichik o'rinbosar. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { rememberShopHead, shopHead } = await import("../src/lib/ek-shop-print.js");

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  ✅ " + m); };
const bad = (m, extra) => { fail++; console.log("  ❌ " + m); if (extra) console.log("     " + extra); };
const eq = (m, got, want) => (got === want ? ok(m) : bad(m, `kutilgan «${want}», keldi «${got}»`));

console.log("═══ Do'kon nomi ═══");
{
  store.clear();
  rememberShopHead({ name: "Ulash market", phone: "+998993312032", receiptShowPhone: true });
  eq("nom profildan olinadi", shopHead().name, "Ulash market");
  eq("telefon ham", shopHead().phone, "+998993312032");
}
{
  /* ⚠ ENG MUHIM ZAXIRA: birinchi kirishda profil hali so'ralmagan
     bo'lishi mumkin va chek boshi bo'sh qolmasligi kerak. */
  store.clear();
  store.set("ek_shopCode", "ulash01");
  eq("kesh bo'sh — chaqiruvchi bergani ishlatiladi", shopHead("Berilgan nom").name, "Berilgan nom");
  eq("u ham yo'q — do'kon kodi", shopHead().name, "ulash01");
}
{
  store.clear();
  eq("hech narsa yo'q — tizim nomi", shopHead().name, "E-KASSAM.UZ");
}
{
  /* ⚠ KESH USTUN TURADI. Chaqiruvchilar `ek_shopName` dan o'qiydi va
     u kalit hech qachon yozilmagan — ya'ni ular deyarli doim bo'sh
     yoki xato qiymat beradi. Haqiqiy nom profildan keladi. */
  store.clear();
  rememberShopHead({ name: "Ulash market", phone: "", receiptShowPhone: true });
  eq("kesh chaqiruvchidan ustun", shopHead("ulash01").name, "Ulash market");
}

console.log("\n═══ Telefon sozlamasi ═══");
{
  store.clear();
  rememberShopHead({ name: "D", phone: "+998901112233", receiptShowPhone: false });
  eq("sozlama o'chiq — telefon chekka tushmaydi", shopHead().phone, "");
  eq("nom esa qoladi", shopHead().name, "D");
}
{
  /* ⚠ MAYDON YO'Q BO'LSA KO'RSATILADI: eski serverga ulangan yangi
     ilova telefonni JIMGINA yo'qotmasligi kerak. */
  store.clear();
  rememberShopHead({ name: "D", phone: "+998901112233" });
  eq("maydon yo'q — ko'rsatiladi", shopHead().phone, "+998901112233");
}
{
  store.clear();
  rememberShopHead({ name: "D", phone: "", receiptShowPhone: true });
  eq("raqam yo'q — bo'sh qator chizilmaydi", shopHead().phone, "");
}

console.log("\n═══ Buzilgan kesh ═══");
{
  /* ⚠ Chek CHIQISHI SHART. Buzilgan JSON tufayli kassir sotuvni
     yakunlay olmay qolsa, bu keshning o'zidan ko'ra qimmatroq. */
  store.clear();
  store.set("ek_shopHead", "{buzilgan");
  store.set("ek_shopCode", "ulash01");
  eq("buzilgan JSON — zaxiraga tushadi", shopHead().name, "ulash01");
  eq("telefon bo'sh", shopHead().phone, "");
}
{
  store.clear();
  rememberShopHead(null);
  eq("profil bo'sh — yiqilmaydi", shopHead("X").name, "X");
}

console.log(`\n  ${pass} o'tdi, ${fail} yiqildi`);
process.exit(fail ? 1 : 0);
