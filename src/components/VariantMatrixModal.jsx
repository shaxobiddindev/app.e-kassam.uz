import { useEffect, useMemo, useState } from "react";
import { t } from "../lib/ek-i18n";
import Overlay from "./ek/Overlay";
import { productApi } from "../api";
import { money, quantity as fmtQty } from "../utils";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * O'LCHAM × RANG MATRITSASI (V57)
 *
 * ═══ QAYSI SAVOLGA JAVOB BERADI ════════════════════════════════════════
 *
 * «Qaysi o'lchamdan qancha qoldi?» — kiyim do'konining eng ko'p
 * beriladigan savoli. Ilgari unga javob YO'Q edi: har variant alohida
 * kartochka bo'lib ro'yxatda sochilib yotardi va omborchi ularni ko'z
 * bilan yig'ardi. «M tugadimi?» degan savolga javob berish uchun
 * ro'yxatni aylantirib, «Ko'ylak — M» ni topish kerak edi.
 *
 * ═══ QARORLAR ══════════════════════════════════════════════════════════
 *
 * ⚠ NOL QOLDIQ ALOHIDA BO'YALADI, lekin YASHIRILMAYDI. Aynan bo'sh
 * katak eng kerakli javob: u buyurtma berish kerakligini bildiradi.
 * Yashirilganda jadval to'la ko'rinib, do'kon «hammasi bor» deb
 * o'ylardi.
 *
 * ⚠ BO'SH KATAK (variant umuman yaratilmagan) bilan NOL QOLDIQ
 * BOSHQA narsa va ular boshqacha ko'rinadi: birinchisi «kiritilmagan»,
 * ikkinchisi «tugagan».
 * ══════════════════════════════════════════════════════════════════════════
 */
/* ⚠ `toast` PROP orqali: bu loyihada u global emas, sahifadan
   uzatiladi (`InventoryPage({ toast })`). Ixtiyoriy — usiz ham oyna
   ishlaydi, faqat xato jim qoladi. */
export default function VariantMatrixModal({ groupId, shopId, onClose, onPick, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    productApi.getVariantMatrix(groupId, shopId)
      .then((r) => { if (alive) setData(r.data || null); })
      .catch((e) => { if (alive) toast?.error?.(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, shopId]);

  /* Katakni tez topish uchun: «o'lcham|rang» → yozuv. */
  const byKey = useMemo(() => {
    const m = new Map();
    for (const c of data?.cells || []) m.set(`${c.sizeLabel || ""}|${c.colorName || ""}`, c);
    return m;
  }, [data]);

  const sizes = data?.sizes || [];
  /* ⚠ Rangsiz model ham bor (paypoq faqat o'lchamda keladi). Bunda
     bitta nomsiz ustun chiziladi — jadval shakli o'zgarmaydi. */
  const colors = data?.colors?.length ? data.colors : [{ value: "", label: "", hex: null }];

  return (
    <Overlay className="pay-modal-overlay ek-overlay" role="dialog" aria-modal="true"
             aria-label={t("clothing.matrix")} onEscape={onClose}>
      <div className="ek-dialog vmx">
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <i className="fa-solid fa-table-cells" aria-hidden="true" />
            {data?.groupName || t("clothing.matrix")}
          </div>
          <button className="pay-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="vmx__body">
          {loading ? (
            <div className="vmx__empty">{t("common.loading")}</div>
          ) : !sizes.length ? (
            <div className="vmx__empty">{t("common.empty")}</div>
          ) : (
            <div className="vmx__scroll">
              <table className="vmx__table">
                <thead>
                  <tr>
                    <th className="vmx__corner">{t("clothing.size")}</th>
                    {colors.map((c) => (
                      <th key={c.value}>
                        {c.hex && <span className="facet__dot" style={{ background: c.hex }} aria-hidden="true" />}
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size}>
                      <th scope="row" className="vmx__size">{size}</th>
                      {colors.map((c) => {
                        const cell = byKey.get(`${size}|${c.value}`);
                        if (!cell) {
                          /* Variant UMUMAN yaratilmagan — «tugagan» emas. */
                          return <td key={c.value} className="vmx__cell is-missing">—</td>;
                        }
                        const qty = Number(cell.quantity) || 0;
                        return (
                          <td key={c.value}
                              className={`vmx__cell ${qty <= 0 ? "is-empty" : ""} ${onPick ? "is-pickable" : ""}`}
                              onClick={() => qty > 0 && onPick?.(cell)}
                              title={`${cell.name} · ${money(cell.salePrice)}`}>
                            <span className="vmx__qty ek-num">
                              {qty > 0 ? fmtQty(qty, 0) : t("clothing.noStock")}
                            </span>
                            {cell.sku && <span className="vmx__sku">{cell.sku}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="vmx__foot">
          <span className="text-muted">{t("clothing.totalLeft")}</span>
          <b className="ek-num">{fmtQty(Number(data?.totalQuantity) || 0, 0)}</b>
        </div>
      </div>
    </Overlay>
  );
}
