import { t } from "../../lib/ek-i18n";
import Modal from "../Modal";
import StickerSimple from "./StickerSimple";

/* ══════════════════════════════════════════════════════════════════════════
   TEZ CHOP ETISH — TOVARLAR SAHIFASIDAN (F5 → 2026-10-03)

   ⚠ O'SHA ODDIY EKRAN, OYNA ICHIDA. Ilgari bu yerda navbat komponenti
   (manba, son qoidasi, shablon, yo'l, «qaysi tovargacha chiqdi?») ochilardi
   va do'konchi nima qilishni bilmasdi. Endi «Stiker chiqarish» ekranining
   o'zi: tanlangan tovarlar ro'yxatda, sonini o'zgartirish va bitta tugma.
   Printer sozlanmagan bo'lsa — sozlash shu yerda ochiladi.

   ⚠ RO'YXAT HAQIQIY NAVBATDA saqlanadi: oyna yopilib qolsa ham ish
   yo'qolmaydi va «chiqarildi» belgisi yoziladi.
   ══════════════════════════════════════════════════════════════════════════ */
export default function LabelPrintModal({ productIds = [], onClose, toast }) {
  return (
    <Modal title={t("lbl.printTitle")} onClose={onClose} maxWidth={980}>
      <StickerSimple toast={toast} productIds={productIds} compact onPrinted={onClose} />
    </Modal>
  );
}
