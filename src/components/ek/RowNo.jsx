import { SortTh } from "./DataFilter";
import { t } from "../../lib/ek-i18n";

/* ══════════════════════════════════════════════════════════════════════════
   YOZUV RAQAMI USTUNI — «1 · №142»

   ═══ NEGA IKKITA RAQAM ════════════════════════════════════════════════

   Do'kon egasi: «hamma sahifadagi ma'lumotlarga tartib raqam qo'yish
   kerak, u orqali ham qidira olsin» — va keyin: «o'chirilganda tartib
   bilan chiqmay qoladi, 1 dan keyin 5 keyin 7, bu xunuk».

   Ikkala talab bitta raqam bilan bajarilmaydi va sabab jiddiy:

     · QIDIRILADIGAN raqam O'ZGARMASLIGI shart. Egasi xodimga «Mijoz
       №142 ning qarzini ko'r» deydi. Yozuv o'chirilganda qayta
       raqamlansa, aytilgan raqam BOSHQA odamga tegib qoladi va xodim
       boshqa kishining qarziga qaraydi — ekranda hech qanday xato yo'q.

     · BO'SHLIQSIZ raqam esa ta'rifi bo'yicha o'rinni bildiradi:
       saralansa yoki keyingi sahifaga o'tilsa, u boshqa yozuvga
       tegadi. Ya'ni uni qidirib bo'lmaydi.

   Shuning uchun ikkalasi yonma-yon, lekin BOSHQACHA ko'rinishda:
   kichkina xira son — o'rin, qalin son — yozuvning o'zi. Ro'yxat hech
   qachon buzuq ko'rinmaydi, raqam esa ishonchli qoladi.

   ⚠ BO'SHLIQLARNING BIR QISMI UMUMAN YO'Q. Server raqamni yozuv
   saqlanayotganda beradi (`DocNumbers`), ketma-ketlikdan emas — bekor
   qilingan forma endi raqam yemaydi. Qolgan bo'shliqlar haqiqiy:
   ular o'chirilgan yozuvlarga tegishli.
   ══════════════════════════════════════════════════════════════════════════ */

/** Sarlavha katagi — saralanadigan va filtrlanadigan. */
export function NoTh({ flt, col = "no" }) {
  return <SortTh flt={flt} col={col}>{t("common.rowNo")}</SortTh>;
}

/**
 * Qator katagi.
 *
 * @param seq ekrandagi o'rin (1 dan boshlanadi) — bo'shliqsiz
 * @param no  yozuvning o'z raqami; `null` bo'lsa «—»
 */
export function NoTd({ seq, no }) {
  return (
    <td className="ek-rowno">
      {/* ⚠ `aria-hidden`: ekran o'quvchi uchun o'rin raqami shovqin —
          u qatorlarni o'zi sanaydi. Yozuv raqami esa o'qilishi kerak. */}
      <span className="ek-rowno__seq" aria-hidden="true">{seq}</span>
      {no == null
        ? <span className="text-muted">—</span>
        : <span className="ek-num ek-rowno__no">{t("common.rowNoShort", { n: no })}</span>}
    </td>
  );
}

/**
 * Ustun ta'rifi — `COLS` massiviga qo'shiladi.
 *
 * ⚠ SON, MATN EMAS: «№ 100 dan katta» deb kesish tabiiy, matn
 * qoidasida esa «71» «100» dan katta chiqardi.
 */
export const NO_COL = { key: "no", label: t("common.rowNo"), type: "number", get: (r) => r.docNo };

export default NoTd;
