/* ══════════════════════════════════════════════════════════════════════════
   MIJOZ TANLASH RO'YXATINING BANDI (V139)

   Kassa va qarz/jamg'arma oynasi mijozni BITTA shakl bilan ko'rsatadi —
   ilgari ikkalasi bandni o'zi yig'ardi va biri o'zgarsa ikkinchisi
   eskicha qolardi.

   ⚠ QIDIRUV UCH YO'L BILAN (egasining talabi, 2026-09-25):
     · ism          — matn (xato yozilgani ham, `lib/ek-search.js`);
     · telefon      — RAQAM sifatida ham (`digits`): «90 123 45»,
                      «(90) 123-45-67» ketma-ket raqam bo'yicha solishtiriladi,
                      boshi yoki oxiri mos kelsa yuqori turadi. Ilgari telefon
                      faqat matn edi va bo'laklar «hammasi bor» darajasida
                      topilardi — raqamlari boshqa tartibda turgan begona
                      telefon ham xuddi shu darajada va ba'zan OLDIN chiqardi;
     · Telegram     — «@zebo_market» yoki «zebo_market». ILGARI UMUMAN
                      TOPILMASDI. Username shaxsda turadi (odam botga
                      ulanganda yoziladi).
   ══════════════════════════════════════════════════════════════════════════ */

/** `Select` qidiruvi: yorliq va izoh — matn, qo'shimcha kalit so'zlar, raqamlar. */
export const OPTION_SEARCH = {
  texts: (o) => [o.label, o.hint, ...(o.keywords || [])],
  digits: (o) => o.digits || [],
};

export function customerOption(c) {
  const username = c?.telegramUsername ? `@${c.telegramUsername}` : null;
  return {
    value: String(c.id),
    label: c.fullName,
    /* ⚠ Telefon YORLIQQA QO'SHILMAYDI, o'z ustunida turadi: ismlar uzunligi
       turlicha bo'lgani uchun raqamlar har qatorda boshqa joydan boshlanar
       va ro'yxatni ko'z bilan kuzatib o'qib bo'lmasdi. */
    hint: c.phone,
    icon: "fa-user",
    digits: c.phone ? [c.phone] : [],
    keywords: username ? [username] : [],
  };
}
