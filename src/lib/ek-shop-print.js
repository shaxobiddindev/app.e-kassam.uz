/* ══════════════════════════════════════════════════════════════════════════
   CHEK SARLAVHASI — DO'KON MA'LUMOTI (V62)

   ═══ MUAMMO ════════════════════════════════════════════════════════════

   Qog'oz chekning boshida do'kon nomi turishi kerak edi. Amalda esa
   `localStorage.ek_shopName` SAKKIZ joyda o'qilardi va HECH QAYERDA
   yozilmasdi — ya'ni u doim bo'sh edi va chekda do'konning KODI
   («ulash01») yoki umuman «E-KASSAM.UZ» chiqardi. Mijoz qo'lidagi
   qog'ozda do'konning haqiqiy nomi hech qachon bo'lmagan.

   Telefon esa umuman yo'q edi.

   ═══ NEGA BITTA MODUL ══════════════════════════════════════════════════

   Sarlavha UCH joyda chiziladi (ESC/POS sotuv cheki, ESC/POS qarz cheki,
   brauzer cheki) va ular allaqachon bir-biridan ajralib ketgan edi.
   Endi manba BITTA: profil so'ralganda kesh yangilanadi, chek esa
   shundan o'qiydi.

   ⚠ KESH `localStorage` DA. Chek chop etish PAYTIDA server so'roviga
   vaqt yo'q: kassir tugmani bosgan zahoti qog'oz chiqishi kerak va
   internet uzilgan bo'lishi ham mumkin (oflayn sotuv qo'llab-quvvatlanadi).
   Shuning uchun qiymatlar oldindan, profil so'ralganda saqlanadi.
   ══════════════════════════════════════════════════════════════════════════ */

const KEY = "ek_shopHead";

/**
 * Profil javobidan chek sarlavhasini saqlab qo'yish.
 *
 * ⚠ `shopApi.getProfile()` NING ICHIDAN chaqiriladi, chaqiruvchilardan
 * emas: profil to'qqizta sahifada so'raladi va har biriga «keshni ham
 * yangilashni unutmang» deb ishonib bo'lmasdi.
 */
export function rememberShopHead(profile) {
  if (!profile) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      name: profile.name || "",
      phone: profile.phone || "",
      address: profile.address || "",
      /* ⚠ `!== false`: maydon yo'q bo'lsa KO'RSATILADI. Eski serverga
         ulangan yangi ilova telefonni jimgina yo'qotmasligi kerak. */
      showPhone: profile.receiptShowPhone !== false,
    }));
  } catch { /* xotira to'la yoki shaxsiy rejim — chek baribir chiqadi */ }
}

/**
 * Chek boshiga tushadigan qatorlar.
 *
 * ⚠ NOM UCHUN ZAXIRA ZANJIRI: keshdagi nom → chaqiruvchi bergani →
 * do'kon kodi → «E-KASSAM.UZ». Birinchi kirishda kesh hali bo'sh
 * bo'lishi mumkin va o'shanda ham chek boshi bo'sh qolmasligi kerak.
 */
export function shopHead(given = "") {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { c = {}; }

  const name = c.name || given
    || localStorage.getItem("ek_shopCode") || "E-KASSAM.UZ";

  /* ⚠ Telefon FAQAT sozlama yoqilganda. Bu qoida qog'ozda ham,
     elektron chekda ham (serverda) bir xil: bittasi e'tiborsiz
     qoldirsa, do'kon sozlamani o'chirib qo'yib ham raqamini qog'ozda
     ko'raverardi. */
  const phone = c.showPhone === false ? "" : (c.phone || "");

  return { name, phone };
}
