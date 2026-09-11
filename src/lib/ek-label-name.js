/**
 * Shablon nomi — FOYDALANUVCHINING TILIDA (G0).
 *
 * ⚠ USTUNLAR BOR EDI, NOM ESA BITTA TILDA CHIQARDI. Bazada
 * `name`, `name_ru`, `name_en` uchalasi ham to'ldirilgan, lekin DTO
 * faqat birinchisini uzatardi: ruscha ishlaydigan do'kon shablon
 * nomlarini o'zbekcha ko'rardi. Xato hech qayerda chiqmagan —
 * ekranda MATN turardi, faqat boshqa tilda — shuning uchun uni
 * hech kim yozmagan ham. G0 o'lchovi topdi.
 *
 * ⚠ ZAXIRA — O'ZBEKCHA: tarjimasi yo'q shablon nomsiz qolmasin.
 */
import { getLang } from "./ek-i18n";

export function templateName(tpl, lang = getLang()) {
  if (!tpl) return "";
  const byLang = lang === "ru" ? tpl.nameRu : lang === "en" ? tpl.nameEn : null;
  return byLang || tpl.name || tpl.code || "";
}
